import {compileGpu, validateMeshCamera} from '@barocss/gpu';
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
  readonly transformPreview: {readonly objectId: string; readonly source: string} | null;
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
  previewObjectSource(objectId: string, source: string): RenderEditorActionResult;
  applyObjectPreview(): RenderEditorActionResult;
  cancelObjectPreview(): RenderEditorActionResult;
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
  let transformBaseline: RenderEditorSessionSnapshot | null = null;
  let transactionActive = false, viewEpoch = 0;
  let snapshot: RenderEditorControllerSnapshot = Object.freeze({presentedRevision: null, presentationError: null, cameraPreview: null, transformPreview: null, disposed: false});
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
    viewEpoch++; presentedDocument = null; previewBaseline = null; transformBaseline = null;
    const notice = caused(error);
    emit({...snapshot, presentedRevision: null, presentationError: notice, cameraPreview: null, transformPreview: null});
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
    presentedDocument = accepted; previewBaseline = null; transformBaseline = null;
    emit({...snapshot, presentedRevision: accepted.revision, presentationError: null, cameraPreview: null, transformPreview: null});
    return {ok: true};
  };
  const previewBase = (): RenderEditorSessionSnapshot => {
    if (!snapshot.cameraPreview || !previewBaseline) throw new RenderEditorError('DOCUMENT_INPUT', 'There is no camera view to use.');
    const current = session.getSnapshot();
    if (current.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
    if (current !== previewBaseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during navigation. Cancel view before continuing.');
    return previewBaseline;
  };
  const transformBase = (): RenderEditorSessionSnapshot => {
    if (!snapshot.transformPreview || !transformBaseline) throw new RenderEditorError('DOCUMENT_INPUT', 'There is no object transform to use.');
    const current = session.getSnapshot();
    if (current.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
    if (current !== transformBaseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or selection changed during the transform. Cancel the transform before continuing.');
    return transformBaseline;
  };
  const objectCandidate = (accepted: RenderSceneDocumentV0, objectId: string, source: string) => {
    const document = validateRenderEditorDocument({...accepted, sceneSource: source});
    const before = compileGpu({kind: 'scene', source: accepted.sceneSource, sourceVersion: 1});
    const after = compileGpu({kind: 'scene', source, sourceVersion: 1});
    if (!before.ok || !after.ok || before.execution.kind !== 'sdf' || after.execution.kind !== 'sdf') throw new RenderEditorError('SOURCE_REFUSED', 'Transform source qualification failed.');
    const original = before.execution.scene, proposed = after.execution.scene;
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (original.name !== proposed.name || !same(original.background, proposed.background) || original.objects.length !== proposed.objects.length) {
      throw new RenderEditorError('DOCUMENT_INPUT', 'A transform must preserve the scene identity, background and object inventory.');
    }
    let changed = false;
    for (let index = 0; index < original.objects.length; index++) {
      const a = original.objects[index]!, b = proposed.objects[index]!;
      if (a.id !== b.id || a.type !== b.type || !same(a.color, b.color) || (a.id !== objectId && !same(a, b))) {
        throw new RenderEditorError('DOCUMENT_INPUT', 'A transform may change only the selected object position, rotation or primitive dimensions.');
      }
      if (a.id === objectId) changed = !same(a, b);
    }
    const candidate: RenderEditorPreparedCandidate = Object.freeze({document, metadata: compileRenderEditorSource(source), mode: 'source', purpose: 'apply'});
    return {candidate, changed};
  };
  const run = (prepare: () => RenderEditorPreparedCandidate | null): RenderEditorActionResult => {
    try {
      check();
      if (snapshot.cameraPreview || snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view or transform before applying other changes.');
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
      emit({...snapshot, presentedRevision: candidate.document.revision, presentationError: null, cameraPreview: null, transformPreview: null});
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
      check(); presenter = null; presentedDocument = null; previewBaseline = null; transformBaseline = null; viewEpoch++;
      try { previous.dispose(); } finally { emit({...snapshot, presentedRevision: null, cameraPreview: null, transformPreview: null}); }
    },
    apply: (mode = 'both') => run(() => session.prepareDraft(mode)),
    open: text => run(() => session.prepareOpen(text)),
    undo: () => run(() => session.prepareUndo()), redo: () => run(() => session.prepareRedo()),
    previewCamera(camera) {
      try {
        check();
        if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform before navigating the camera.');
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
      try { check(); if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform first.'); if (!snapshot.cameraPreview) return {ok: true}; transactionActive = true;
        try { return restoreAccepted(); } finally { transactionActive = false; }
      } catch (cause) { return failure(cause); }
    },
    applyCameraPreview() {
      try {
        check(); if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform first.'); const baseline = previewBase(), camera = snapshot.cameraPreview!;
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
    previewObjectSource(objectId, source) {
      try {
        check();
        if (snapshot.cameraPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Use or cancel the camera view before transforming an object.');
        const baseline = snapshot.transformPreview ? transformBase() : session.getSnapshot();
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (baseline.sourceDirty || baseline.cameraDirty || baseline.objectInputInvalid) throw new RenderEditorError('SOURCE_REFUSED', 'Apply or discard source, object and camera drafts before using transform handles.', baseline.diagnostics);
        if (typeof objectId !== 'string' || baseline.activeObjectId !== objectId || !baseline.metadata.objects.some(object => object.id === objectId)
          || (snapshot.transformPreview && snapshot.transformPreview.objectId !== objectId)) throw new RenderEditorError('DOCUMENT_INPUT', 'Transform the currently selected applied object only.');
        if (!presenter || !presentedDocument || (!snapshot.transformPreview && presentedDocument !== baseline.accepted)) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before transforming an object.');
        const {candidate, changed} = objectCandidate(baseline.accepted, objectId, source);
        if (!changed) {
          if (!snapshot.transformPreview) return {ok: true};
          transactionActive = true; try {return restoreAccepted();} finally {transactionActive = false;}
        }
        transactionActive = true;
        try {
          const result = present(candidate, presentedDocument); if (!result.ok) return result;
          if (session.getSnapshot().accepted !== baseline.accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during object presentation. Recover the viewport.'));
          presentedDocument = candidate.document; transformBaseline = baseline;
          emit({...snapshot, presentedRevision: baseline.accepted.revision, presentationError: null,
            transformPreview: Object.freeze({objectId, source: candidate.document.sceneSource})});
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or selection changed during the transform. Cancel before continuing.');
          return {ok: true};
        } finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    cancelObjectPreview() {
      try {check(); if (!snapshot.transformPreview) return {ok: true}; transactionActive = true;
        try {return restoreAccepted();} finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    applyObjectPreview() {
      try {
        check(); if (snapshot.cameraPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Use or cancel the camera view first.');
        if (!snapshot.transformPreview) return {ok: true};
        const baseline = transformBase(), source = snapshot.transformPreview.source;
        transactionActive = true;
        try {
          const restored = restoreAccepted(); if (!restored.ok) return restored;
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or selection changed before the transform could be staged.');
          session.setDraftObjectSource(source);
          const staged = session.getSnapshot();
          if (staged.accepted !== baseline.accepted || staged.draftSource !== source || staged.objectInputInvalid !== baseline.objectInputInvalid
            || staged.activeObjectId !== baseline.activeObjectId || staged.savedRevision !== baseline.savedRevision || !cameraEqual(staged.draftCamera, baseline.draftCamera)) {
            throw new RenderEditorError('STALE_CANDIDATE', 'Another draft changed while the transform was staged. Your drafts are kept. Apply them explicitly.');
          }
        } finally {transactionActive = false;}
        return controller.apply('both');
      } catch (cause) {return failure(cause);}
    },
    recover() {
      try { check(); } catch (cause) { return failure(cause); }
      try {
        if (!presenter) throw new RenderEditorError('PRESENTATION_REFUSED', 'No viewport is attached.');
        previewBaseline = null; transformBaseline = null; transactionActive = true;
        try {
          const epoch = viewEpoch, document = session.getSnapshot().accepted, result = presenter.recover(document);
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The preview is unavailable.'));
          if (!result.ok) return unavailable(result.error);
          if (session.getSnapshot().accepted !== document) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during viewport recovery. Recover it again.'));
          presentedDocument = document;
          emit({...snapshot, presentedRevision: document.revision, presentationError: null, cameraPreview: null, transformPreview: null});
          return {ok: true};
        } finally { transactionActive = false; }
      } catch (cause) { return unavailable(cause); }
    },
    presentationUnavailable(error) { if (!snapshot.disposed) unavailable(error); },
    dispose() {
      if (snapshot.disposed) return;
      check(); const previous = presenter; presenter = null; presentedDocument = null; previewBaseline = null; transformBaseline = null; viewEpoch++;
      try { previous?.dispose(); } finally { emit({presentedRevision: null, presentationError: null, cameraPreview: null, transformPreview: null, disposed: true}); listeners.clear(); }
    }
  };
  if (initialPresenter) controller.attachPresenter(initialPresenter);
  return controller;
}
