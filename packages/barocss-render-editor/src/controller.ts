import {compileGpu, validateMeshCamera} from '@barocss/gpu';
import type {MeshCamera} from '@barocss/gpu';
import {sampleRenderSceneAnimationSource} from './source-animation.js';
import {RenderEditorError, normalizeRenderEditorError} from './errors.js';
import {validateRenderEditorDocument, compileRenderEditorSource} from './document.js';
import type {RenderSceneDocument} from './document.js';
import type {RenderEditorApplyMode, RenderEditorPreparedCandidate, RenderEditorSession, RenderEditorSessionSnapshot} from './session.js';

export type PresentationResult = {ok: true} | {ok: false; error: Error; recovered: boolean};
export interface RenderEditorPresenter {
  present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocument): PresentationResult;
  recover(document: RenderSceneDocument): PresentationResult;
  dispose(): void;
}
export interface RenderEditorControllerSnapshot {
  readonly presentedRevision: number | null;
  readonly presentationError: RenderEditorError | null;
  readonly cameraPreview: MeshCamera | null;
  readonly viewportCamera: MeshCamera | null;
  readonly transformPreview: {readonly objectId: string; readonly source: string} | null;
  readonly animationPreview: {readonly source: string; readonly timeSeconds: number} | null;
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
  navigateViewportCamera(camera: MeshCamera): RenderEditorActionResult;
  resetViewportCamera(): RenderEditorActionResult;
  applyViewportCameraToScene(): RenderEditorActionResult;
  previewCamera(camera: MeshCamera): RenderEditorActionResult;
  applyCameraPreview(): RenderEditorActionResult;
  cancelCameraPreview(): RenderEditorActionResult;
  previewObjectSource(objectId: string, source: string): RenderEditorActionResult;
  applyObjectPreview(): RenderEditorActionResult;
  cancelObjectPreview(): RenderEditorActionResult;
  previewAnimation(timeSeconds: number): RenderEditorActionResult;
  cancelAnimationPreview(): RenderEditorActionResult;
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
  let presentedDocument: RenderSceneDocument | null = null;
  let authorDocument: RenderSceneDocument | null = null;
  let previewBaseline: RenderEditorSessionSnapshot | null = null;
  let transformBaseline: RenderEditorSessionSnapshot | null = null;
  let animationBaseline: RenderEditorSessionSnapshot | null = null;
  let transactionActive = false, viewEpoch = 0;
  let snapshot: RenderEditorControllerSnapshot = Object.freeze({presentedRevision: null, presentationError: null, cameraPreview: null, viewportCamera: null, transformPreview: null, animationPreview: null, disposed: false});
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
    viewEpoch++; presentedDocument = null; authorDocument = null; previewBaseline = null; transformBaseline = null; animationBaseline = null;
    const notice = caused(error);
    emit({...snapshot, presentedRevision: null, presentationError: notice, cameraPreview: null, viewportCamera: null, transformPreview: null, animationPreview: null});
    return failure(notice);
  };
  const present = (candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocument): RenderEditorActionResult => {
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
  const cameraCandidate = (accepted: RenderSceneDocument, camera: MeshCamera, mode: 'camera' | 'both' = 'camera'): RenderEditorPreparedCandidate => {
    let owned: MeshCamera;
    try { owned = validateMeshCamera(camera); } catch (cause) { throw caused(cause, 'DOCUMENT_INPUT'); }
    const document = validateRenderEditorDocument({...accepted, camera: owned});
    return Object.freeze({document, metadata: compileRenderEditorSource(document.sceneSource), mode, purpose: 'apply'});
  };
  const displayCandidate = (candidate: RenderEditorPreparedCandidate, camera: MeshCamera | null = snapshot.viewportCamera): RenderEditorPreparedCandidate => {
    if (!camera) return candidate;
    const document = validateRenderEditorDocument({...candidate.document, camera});
    return Object.freeze({...candidate, document});
  };
  const restoreAccepted = (resetViewport = false): RenderEditorActionResult => {
    if (!presenter || !presentedDocument) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before restoring the view.');
    const accepted = session.getSnapshot().accepted;
    // A direct CPU commit may have replaced the source. Restore both APIs then;
    // setCamera alone cannot present that newly accepted geometry.
    const mode = presentedDocument.sceneSource === accepted.sceneSource && presentedDocument.sourceVersion === accepted.sourceVersion ? 'camera' : 'both';
    const viewportCamera = resetViewport ? null : snapshot.viewportCamera;
    const candidate = cameraCandidate(accepted, viewportCamera ?? accepted.camera, mode), result = present(candidate, presentedDocument);
    if (!result.ok) return result;
    if (session.getSnapshot().accepted !== accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during view restoration. Recover the viewport.'));
    presentedDocument = candidate.document; authorDocument = accepted; previewBaseline = null; transformBaseline = null; animationBaseline = null;
    const epoch = viewEpoch;
    emit({...snapshot, presentedRevision: accepted.revision, presentationError: null, cameraPreview: null, viewportCamera, transformPreview: null, animationPreview: null});
    if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable during restoration.'));
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
  const objectCandidate = (accepted: RenderSceneDocument, objectId: string, source: string) => {
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
      if (snapshot.cameraPreview || snapshot.transformPreview || snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view or transform before applying other changes.');
      if (!presenter || snapshot.presentedRevision === null || authorDocument !== session.getSnapshot().accepted) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before applying an edit.');
      const candidate = prepare();
      if (!candidate) return {ok: true};
      const previous = presentedDocument!;
      const viewportCamera = candidate.purpose === 'open' ? null : snapshot.viewportCamera;
      const displayed = displayCandidate(candidate, viewportCamera), epoch = viewEpoch;
      transactionActive = true;
      try {
        session.commitPrepared(candidate, () => {
          const result = present(displayed, previous);
          if (!result.ok) throw result.error;
        });
        if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable after the authoring commit.'));
        if (session.getSnapshot().accepted !== candidate.document) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed after the authoring commit. Recover the viewport.'));
        presentedDocument = displayed.document; authorDocument = candidate.document;
        emit({...snapshot, presentedRevision: candidate.document.revision, presentationError: null, cameraPreview: null, viewportCamera,
          transformPreview: null, animationPreview: null});
        if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable after Apply.'));
        return {ok: true};
      } finally {transactionActive = false;}

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
      check(); presenter = null; presentedDocument = null; authorDocument = null; previewBaseline = null; transformBaseline = null; animationBaseline = null; viewEpoch++;
      try { previous.dispose(); } finally { emit({...snapshot, presentedRevision: null, cameraPreview: null, viewportCamera: null, transformPreview: null, animationPreview: null}); }
    },
    apply: (mode = 'both') => run(() => session.prepareDraft(mode)),
    open: text => run(() => session.prepareOpen(text)),
    undo: () => run(() => session.prepareUndo()), redo: () => run(() => session.prepareRedo()),
    navigateViewportCamera(camera) {
      try {
        check();
        if (snapshot.cameraPreview || snapshot.transformPreview || snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view, transform or animation sample before navigation.');
        const baseline = session.getSnapshot();
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (!presenter || !presentedDocument || authorDocument !== baseline.accepted) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before navigating.');
        const candidate = cameraCandidate(baseline.accepted, camera);
        if (cameraEqual(candidate.document.camera, presentedDocument.camera)) return {ok: true};
        const epoch = viewEpoch;
        transactionActive = true;
        try {
          const result = present(candidate, presentedDocument); if (!result.ok) return result;
          if (session.getSnapshot().accepted !== baseline.accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during viewport navigation. Recover the viewport.'));
          presentedDocument = candidate.document;
          emit({...snapshot, presentedRevision: baseline.accepted.revision, presentationError: null,
            viewportCamera: cameraEqual(candidate.document.camera, baseline.accepted.camera) ? null : candidate.document.camera});
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable during navigation.'));
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during navigation. The last displayed view is kept.');
          return {ok: true};
        } finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    resetViewportCamera() {
      try {
        check();
        if (snapshot.cameraPreview || snapshot.transformPreview || snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view, transform or animation sample first.');
        if (session.getSnapshot().disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (!snapshot.viewportCamera && authorDocument === session.getSnapshot().accepted && presentedDocument) return {ok: true};
        transactionActive = true;
        try {return restoreAccepted(true);} finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    applyViewportCameraToScene() {
      try {
        check();
        if (snapshot.cameraPreview || snapshot.transformPreview || snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view, transform or animation sample first.');
        const baseline = session.getSnapshot(), camera = snapshot.viewportCamera;
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (!presenter || !presentedDocument || authorDocument !== baseline.accepted) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before setting the scene camera.');
        if (!camera) return {ok: true};
        if (baseline.cameraDirty) throw new RenderEditorError('DOCUMENT_INPUT', 'Apply or discard the camera draft before setting the scene camera from the view.');
        transactionActive = true;
        try {
          session.setDraftCamera(camera);
          const staged = session.getSnapshot();
          if (staged.accepted !== baseline.accepted || staged.draftSource !== baseline.draftSource || staged.objectInputInvalid !== baseline.objectInputInvalid
            || staged.draftAnimation !== baseline.draftAnimation || staged.animationInputInvalid !== baseline.animationInputInvalid
            || staged.activeObjectId !== baseline.activeObjectId || staged.savedRevision !== baseline.savedRevision || !cameraEqual(staged.draftCamera, camera)) {
            throw new RenderEditorError('STALE_CANDIDATE', 'Another draft changed while the scene camera was staged. Your drafts are kept. Apply them explicitly.');
          }
        } finally {transactionActive = false;}
        return controller.apply('both');
      } catch (cause) {return failure(cause);}
    },
    previewCamera(camera) {
      try {
        check();
        if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample before navigating or transforming.');
        if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform before navigating the camera.');
        const baseline = snapshot.cameraPreview ? previewBase() : session.getSnapshot();
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (!presenter || !presentedDocument || (!snapshot.cameraPreview && authorDocument !== baseline.accepted)) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before navigating the view.');
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
      try { check(); if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample before navigating or transforming.');
        if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform first.'); if (!snapshot.cameraPreview) return {ok: true}; transactionActive = true;
        try { return restoreAccepted(); } finally { transactionActive = false; }
      } catch (cause) { return failure(cause); }
    },
    applyCameraPreview() {
      try {
        check(); if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample before navigating or transforming.');
        if (snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the object transform first.'); const baseline = previewBase(), camera = snapshot.cameraPreview!;
        transactionActive = true;
        try {
          const restored = restoreAccepted(); if (!restored.ok) return restored;
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed before the view could be staged.');
          session.setDraftCamera(camera);
          const staged = session.getSnapshot();
          if (staged.accepted !== baseline.accepted || staged.draftSource !== baseline.draftSource || staged.objectInputInvalid !== baseline.objectInputInvalid || staged.draftAnimation !== baseline.draftAnimation || staged.animationInputInvalid !== baseline.animationInputInvalid
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
        if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample before navigating or transforming.');
        if (snapshot.cameraPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Use or cancel the camera view before transforming an object.');
        const baseline = snapshot.transformPreview ? transformBase() : session.getSnapshot();
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (baseline.sourceDirty || baseline.cameraDirty || baseline.objectInputInvalid) throw new RenderEditorError('SOURCE_REFUSED', 'Apply or discard source, object and camera drafts before using transform handles.', baseline.diagnostics);
        if (typeof objectId !== 'string' || baseline.activeObjectId !== objectId || !baseline.metadata.objects.some(object => object.id === objectId)
          || (snapshot.transformPreview && snapshot.transformPreview.objectId !== objectId)) throw new RenderEditorError('DOCUMENT_INPUT', 'Transform the currently selected applied object only.');
        if (!presenter || !presentedDocument || (!snapshot.transformPreview && authorDocument !== baseline.accepted)) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before transforming an object.');
        const qualified = objectCandidate(baseline.accepted, objectId, source);
        const candidate = displayCandidate(qualified.candidate), changed = qualified.changed;
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
      try {check(); if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample first.'); if (!snapshot.transformPreview) return {ok: true}; transactionActive = true;
        try {return restoreAccepted();} finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    applyObjectPreview() {
      try {
        check(); if (snapshot.animationPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Reset the animation sample before navigating or transforming.');
        if (snapshot.cameraPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Use or cancel the camera view first.');
        if (!snapshot.transformPreview) return {ok: true};
        const baseline = transformBase(), source = snapshot.transformPreview.source;
        transactionActive = true;
        try {
          const restored = restoreAccepted(); if (!restored.ok) return restored;
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or selection changed before the transform could be staged.');
          session.setDraftObjectSource(source);
          const staged = session.getSnapshot();
          if (staged.accepted !== baseline.accepted || staged.draftSource !== source || staged.objectInputInvalid !== baseline.objectInputInvalid || staged.draftAnimation !== baseline.draftAnimation || staged.animationInputInvalid !== baseline.animationInputInvalid
            || staged.activeObjectId !== baseline.activeObjectId || staged.savedRevision !== baseline.savedRevision || !cameraEqual(staged.draftCamera, baseline.draftCamera)) {
            throw new RenderEditorError('STALE_CANDIDATE', 'Another draft changed while the transform was staged. Your drafts are kept. Apply them explicitly.');
          }
        } finally {transactionActive = false;}
        return controller.apply('both');
      } catch (cause) {return failure(cause);}
    },
    previewAnimation(timeSeconds) {
      try {
        check();
        if (snapshot.cameraPreview || snapshot.transformPreview) throw new RenderEditorError('STALE_CANDIDATE', 'Finish or cancel the temporary view or transform before playback.');
        const baseline = snapshot.animationPreview ? animationBaseline : session.getSnapshot();
        if (!baseline || session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during playback. Reset the sample before continuing.');
        if (baseline.disposed) throw new RenderEditorError('DISPOSED', 'The editor session is disposed.');
        if (baseline.sourceDirty || baseline.cameraDirty || baseline.objectInputInvalid || baseline.animationInputInvalid) throw new RenderEditorError('SOURCE_REFUSED', 'Apply or discard drafts before playback.', baseline.diagnostics);
        const accepted = baseline.accepted;
        if (accepted.version !== 1 || !accepted.animation.tracks.length) throw new RenderEditorError('DOCUMENT_INPUT', 'Playback requires applied animation keys.');
        if (!presenter || !presentedDocument || (!snapshot.animationPreview && authorDocument !== accepted)) throw new RenderEditorError('PRESENTATION_REFUSED', 'Recover the viewport before playback.');
        const source = sampleRenderSceneAnimationSource(accepted.sceneSource, accepted.animation, accepted.camera, timeSeconds);
        const document = validateRenderEditorDocument({...accepted, sceneSource: source, camera: snapshot.viewportCamera ?? accepted.camera});
        const candidate: RenderEditorPreparedCandidate = Object.freeze({document, metadata: compileRenderEditorSource(source), mode: 'source', purpose: 'apply'});
        transactionActive = true;
        try {
          const result = present(candidate, presentedDocument); if (!result.ok) return result;
          if (session.getSnapshot().accepted !== accepted) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during sample presentation. Recover the viewport.'));
          presentedDocument = document; animationBaseline = baseline;
          const epoch = viewEpoch;
          emit({...snapshot, presentedRevision: accepted.revision, presentationError: null, animationPreview: Object.freeze({source, timeSeconds})});
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable during playback.'));
          if (session.getSnapshot() !== baseline) throw new RenderEditorError('STALE_CANDIDATE', 'The scene or draft changed during playback. Reset the sample before continuing.');
          return {ok: true};
        } finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    cancelAnimationPreview() {
      try {check(); if (!snapshot.animationPreview) return {ok: true}; transactionActive = true;
        try {return restoreAccepted();} finally {transactionActive = false;}
      } catch (cause) {return failure(cause);}
    },
    recover() {
      try { check(); } catch (cause) { return failure(cause); }
      try {
        if (!presenter) throw new RenderEditorError('PRESENTATION_REFUSED', 'No viewport is attached.');
        previewBaseline = null; transformBaseline = null; animationBaseline = null; transactionActive = true;
        try {
          const epoch = viewEpoch, document = session.getSnapshot().accepted, result = presenter.recover(document);
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The preview is unavailable.'));
          if (!result.ok) return unavailable(result.error);
          if (session.getSnapshot().accepted !== document) return unavailable(new RenderEditorError('STALE_CANDIDATE', 'The applied scene changed during viewport recovery. Recover it again.'));
          presentedDocument = document; authorDocument = document;
          emit({...snapshot, presentedRevision: document.revision, presentationError: null, cameraPreview: null, viewportCamera: null, transformPreview: null, animationPreview: null});
          if (epoch !== viewEpoch) return failure(snapshot.presentationError ?? new RenderEditorError('PRESENTATION_REFUSED', 'The viewport became unavailable during recovery.'));
          return {ok: true};
        } finally { transactionActive = false; }
      } catch (cause) { return unavailable(cause); }
    },
    presentationUnavailable(error) { if (!snapshot.disposed) unavailable(error); },
    dispose() {
      if (snapshot.disposed) return;
      check(); const previous = presenter; presenter = null; presentedDocument = null; authorDocument = null; previewBaseline = null; transformBaseline = null; animationBaseline = null; viewEpoch++;
      try { previous?.dispose(); } finally { emit({presentedRevision: null, presentationError: null, cameraPreview: null, viewportCamera: null, transformPreview: null, animationPreview: null, disposed: true}); listeners.clear(); }
    }
  };
  if (initialPresenter) controller.attachPresenter(initialPresenter);
  return controller;
}
