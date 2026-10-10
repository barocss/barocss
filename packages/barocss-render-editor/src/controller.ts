import {validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';
import {validateRenderEditorDocument, compileRenderEditorSource} from './document.js';
import type {RenderSceneDocumentV0} from './document.js';
import type {RenderEditorApplyMode, RenderEditorPreparedCandidate, RenderEditorSession, RenderEditorSessionSnapshot} from './session.js';

export type PresentationResult = {ok: true} | {ok: false; error: Error; recovered: boolean};
export interface RenderEditorPresenter {
  present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0): PresentationResult;
  recover(document: RenderSceneDocumentV0): PresentationResult;
  dispose(): void;
}
export interface RenderEditorControllerSnapshot {
  readonly presentedRevision: number | null;
  readonly presentationError: RenderEditorError | null;
  readonly cameraPreview: MeshCamera | null;
  readonly disposed: boolean;
}
export type RenderEditorActionResult = {ok: true} | {ok: false; error: RenderEditorError};
export interface RenderEditorController {
  readonly session: RenderEditorSession;
  getSnapshot(): RenderEditorControllerSnapshot;
  subscribe(listener: () => void): () => void;
  attachPresenter(presenter: RenderEditorPresenter): RenderEditorActionResult;
  detachPresenter(presenter: RenderEditorPresenter): void;
  apply(mode?: RenderEditorApplyMode): RenderEditorActionResult;
  open(text: string): RenderEditorActionResult;
  undo(): RenderEditorActionResult;
  redo(): RenderEditorActionResult;
  recover(): RenderEditorActionResult;
  previewCamera(camera: MeshCamera): RenderEditorActionResult;
  applyCameraPreview(): RenderEditorActionResult;
  cancelCameraPreview(): RenderEditorActionResult;
  presentationUnavailable(error: Error): void;
  dispose(): void;
}

function caused(cause: unknown, code: 'DOCUMENT_INPUT' | 'PRESENTATION_REFUSED' = 'PRESENTATION_REFUSED'): RenderEditorError {
  const error = normalizeRenderEditorError(cause, code);
  if (error !== cause) Object.defineProperty(error, 'cause', {value: cause, configurable: true});
  return error;
}
function cameraEqual(a: MeshCamera, b: MeshCamera): boolean {
  return (['eye', 'target', 'up'] as const).every(field => a[field].every((value, axis) => Object.is(value, b[field][axis])))
    && Object.is(a.fovYDegrees, b.fovYDegrees) && Object.is(a.near, b.near) && Object.is(a.far, b.far);
}

/** Pure synchronous orchestration. Hosts inject their presentation resources. */
export function createRenderEditorController(session: RenderEditorSession, initialPresenter?: RenderEditorPresenter): RenderEditorController {
  let presenter: RenderEditorPresenter | null = null;
  let presentedDocument: RenderSceneDocumentV0 | null = null;
  let previewBaseline: RenderEditorSessionSnapshot | null = null;
  let transactionActive = false, viewEpoch = 0;
  let snapshot: RenderEditorControllerSnapshot = Object.freeze({presentedRevision: null, presentationError: null, cameraPreview: null, disposed: false});
  const listeners = new Set<() => void>();
  const emit = (next: RenderEditorControllerSnapshot) => {
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) { try { listener(); } catch { /* An observer cannot invalidate an accepted frame. */ } }
  };
  const check = () => {
    if (snapshot.disposed) throw new RenderEditorError('DISPOSED', 'The editor controller is disposed.');
    if (transactionActive) throw new RenderEditorError('STALE_CANDIDATE', 'A presentation transaction is active.');
  };
  const failure = (error: unknown): RenderEditorActionResult => ({ok: false, error: error instanceof RenderEditorError ? error : caused(error)});
  const unavailable = (error: unknown): RenderEditorActionResult => {
    viewEpoch++; presentedDocument = null; previewBaseline = null;
    const notice = caused(error);
    emit({...snapshot, presentedRevision: null, presentationError: notice, cameraPreview: null});
    return failure(notice);
  };
  const present = (candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0): RenderEditorActionResult => {
    const epoch = viewEpoch;
    try {
      if (!presenter) throw new RenderEditorError('PRESENTATION_REFUSED', 'No viewport is attached.');
      const result = presenter.present(candidate, previous);
      if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The preview is unavailable.'));
      if (!result.ok) {
        const error = caused(result.error);
        if (!result.recovered) return unavailable(error);
        emit({...snapshot, presentationError: error}); return failure(error);
      }
      return {ok: true};
    } catch (cause) { return unavailable(cause); }
  };
  const cameraCandidate = (accepted: RenderSceneDocumentV0, camera: MeshCamera, mode: 'camera' | 'both' = 'camera'): RenderEditorPreparedCandidate => {
    let owned: MeshCamera;
    try { owned = validateMeshCamera(camera); } catch (cause) { throw caused(cause, 'DOCUMENT_INPUT'); }
    const document = validateRenderEditorDocument({...accepted, camera: owned});
    return Object.freeze({document, metadata: compileRenderEditorSource(document.sceneSource), mode, purpose: 'apply'});
  };
  const restoreAccepted = (): RenderEditorActionResult => {
    if (!presenter || !presentedDocument) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before restoring the view.');
    const accepted = session.getSnapshot().accepted;
    // A direct CPU commit may have replaced the source. Restore both APIs then;
    // setCamera alone cannot present that newly accepted geometry.
    const mode = presentedDocument.sceneSource === accepted.sceneSource && presentedDocument.sourceVersion === accepted.sourceVersion ? 'camera' : 'both';
    const candidate = cameraCandidate(accepted, accepted.camera, mode), result = present(candidate, presentedDocument);
    if (!result.ok) return result;
    if (session.getSnapshot().accepted !== accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during view restoration. Recover the viewport.'));
    presentedDocument = accepted; previewBaseline = null;
    emit({...snapshot, presentedRevision: accepted.revision, presentationError: null, cameraPreview: null});
    return {ok: true};
  };
  const previewBase = (): RenderEditorSessionSnapshot => {
    if (!snapshot.cameraPreview || !previewBaseline) throw new RenderEditorError('DOCUMENT_INPUT', 'There is no camera view to use.');
    const current = session.getSnapshot();
    if (current.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
    if (current !== previewBaseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during navigation. Cancel view before continuing.');
    return previewBaseline;
  };
  const run = (prepare: () => RenderEditorPreparedCandidate | null): RenderEditorActionResult => {
    try {
      check();
      if (snapshot.cameraPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Use view or Cancel view before applying other changes.');
      if (!presenter || snapshot.presentedRevision === null || presentedDocument !== session.getSnapshot().accepted) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before applying an edit.');
      const candidate = prepare();
      if (!candidate) return {ok: true};
      const previous = session.getSnapshot().accepted;
      transactionActive = true;
      try { session.commitPrepared(candidate, () => {
        const result = present(candidate, previous);
        if (!result.ok) throw result.error;
      }); } finally { transactionActive = false; }
      presentedDocument = candidate.document;
      emit({...snapshot, presentedRevision: candidate.document.revision, presentationError: null, cameraPreview: null});
      return {ok: true};
    } catch (error) { return failure(error); }
  };
  const controller: RenderEditorController = {
    session,
    getSnapshot: () => snapshot,
    subscribe(listener) { check(); listeners.add(listener); return () => { listeners.delete(listener); }; },
    attachPresenter(next) {
      try { check(); if (presenter && presenter !== next) throw new RenderEditorError('PRESENTATION_REFUSED', 'A viewport is already attached.'); presenter = next; return controller.recover(); }
      catch (error) { return failure(error); }
    },
    detachPresenter(previous) {
      if (presenter !== previous) return;
      check(); presenter = null; presentedDocument = null; previewBaseline = null; viewEpoch++;
      try { previous.dispose(); } finally { emit({...snapshot, presentedRevision: null, cameraPreview: null}); }
    },
    apply: (mode = 'both') => run(() => session.prepareDraft(mode)),
    open: text => run(() => session.prepareOpen(text)),
    undo: () => run(() => session.prepareUndo()), redo: () => run(() => session.prepareRedo()),
    previewCamera(camera) {
      try {
        check();
        const baseline = snapshot.cameraPreview ? previewBase() : session.getSnapshot();
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (!presenter || !presentedDocument || (!snapshot.cameraPreview && presentedDocument !== baseline.accepted)) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before navigating the view.');
        const candidate = cameraCandidate(baseline.accepted, camera);
        transactionActive = true;
        try {
          const result = present(candidate, presentedDocument); if (!result.ok) return result;
          if (session.getSnapshot().accepted !== baseline.accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during view presentation. Recover the viewport.'));
          presentedDocument = candidate.document; previewBaseline = baseline;
          emit({...snapshot, presentedRevision: baseline.accepted.revision, presentationError: null, cameraPreview: candidate.document.camera});
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during navigation. Cancel view before continuing.');
          return {ok: true};
        } finally { transactionActive = false; }
      } catch (cause) { return failure(cause); }
    },
    cancelCameraPreview() {
      try { check(); if (!snapshot.cameraPreview) return {ok: true}; transactionActive = true;
        try { return restoreAccepted(); } finally { transactionActive = false; }
      } catch (cause) { return failure(cause); }
    },
    applyCameraPreview() {
      try {
        check(); const baseline = previewBase(), camera = snapshot.cameraPreview!;
        transactionActive = true;
        try {
          const restored = restoreAccepted(); if (!restored.ok) return restored;
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed before the view could be staged.');
          session.setDraftCamera(camera);
          const staged = session.getSnapshot();
          if (staged.accepted !== baseline.accepted || staged.draftSource !== baseline.draftSource || staged.objectInputInvalid !== baseline.objectInputInvalid
            || staged.activeObjectId !== baseline.activeObjectId || staged.savedRevision !== baseline.savedRevision || !cameraEqual(staged.draftCamera, camera)) {
            throw new RenderEditorError('STALE_CANDIDATE', 'The scene or camera changed while the view was staged. Your drafts are kept. Apply them explicitly.');
          }
        } finally { transactionActive = false; }
        return controller.apply('both');
      } catch (cause) { return failure(cause); }
    },
    recover() {
      try { check(); } catch (cause) { return failure(cause); }
      try {
        if (!presenter) throw new RenderEditorError('PRESENTATION_REFUSED', 'No viewport is attached.');
        previewBaseline = null; transactionActive = true;
        try {
          const epoch = viewEpoch, document = session.getSnapshot().accepted, result = presenter.recover(document);
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The preview is unavailable.'));
          if (!result.ok) return unavailable(result.error);
          if (session.getSnapshot().accepted !== document) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during viewport recovery. Recover it again.'));
          presentedDocument = document;
          emit({...snapshot, presentedRevision: document.revision, presentationError: null, cameraPreview: null});
          return {ok: true};
        } finally { transactionActive = false; }
      } catch (cause) { return unavailable(cause); }
    },
    presentationUnavailable(error) { if (!snapshot.disposed) unavailable(error); },
    dispose() {
      if (snapshot.disposed) return;
      check(); const previous = presenter; presenter = null; presentedDocument = null; previewBaseline = null; viewEpoch++;
      try { previous?.dispose(); } finally { emit({presentedRevision: null, presentationError: null, cameraPreview: null, disposed: true}); listeners.clear(); }
    }
  };
  if (initialPresenter) controller.attachPresenter(initialPresenter);
  return controller;
}
