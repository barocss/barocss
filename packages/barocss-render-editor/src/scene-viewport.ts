import {showScene, type MeshCamera, type SceneView, type Viewer} from '@barocss/gpu';
import type {RenderSceneDocument} from './document.js';
import type {RenderEditorPreparedCandidate} from './session.js';
import type {PresentationResult, RenderEditorPresenter} from './controller.js';

/** Private compatibility contract for the existing GPU Source1 identity query (#1095). */
export interface SceneViewportObjectPick {sceneName: string; sourceVersion: 1; objectId: string; approximate: true}
export interface SceneViewportPickPoint {xCss: number; yCss: number}
export interface SceneViewportPresenter extends RenderEditorPresenter {
  resize(width: number, height: number): void;
  /** The shown frame, RGBA rows top to bottom. */
  readPixels(): Promise<Uint8Array>;
  pickObject(point: SceneViewportPickPoint, document: RenderSceneDocument, camera: MeshCamera): SceneViewportObjectPick | null;
}

/** Look through a document camera (the viewer fits its own clip planes). */
export function applySceneCamera(viewer: Viewer, camera: MeshCamera): void {
  Object.assign(viewer.camera, {projection: 'perspective', position: [...camera.eye], target: [...camera.target], up: [...camera.up], fovY: camera.fovYDegrees});
  viewer.requestRender();
}

/**
 * One scene on a viewer (the @barocss/gpu WebGPU viewer, made by the caller with autoResize false and
 * no controls). Presentations change the shown source and camera together or refuse and keep the last.
 * The viewer replaces a lost device itself, so the preview does not become unavailable on a loss.
 */
export function createSceneViewportPresenter(viewer: Viewer): SceneViewportPresenter {
  let view: SceneView | null = null;
  let shown: RenderSceneDocument | null = null;
  let disposed = false;
  const errorOf = (error: unknown) => error instanceof Error ? error : new Error('Viewport failed.');
  const sameCamera = (a: MeshCamera, b: MeshCamera) => (['eye', 'target', 'up'] as const).every(field => a[field].every((value, index) => Object.is(value, b[field][index])))
    && Object.is(a.fovYDegrees, b.fovYDegrees) && Object.is(a.near, b.near) && Object.is(a.far, b.far);
  const live = () => !disposed && view !== null && viewer.ready;
  const refused = (error: unknown, recovered = live()): PresentationResult => ({ok: false, error: errorOf(error), recovered});
  const show = (source: string): {ok: true} | {ok: false; error: Error} => {
    if (!view) return {ok: false, error: new Error('The viewport is unavailable.')};
    const result = view.update(source);
    return result.ok ? result : {ok: false, error: new Error(result.diagnostics.map(d => d.message).join('; ') || 'The scene source was refused.')};
  };
  return {
    present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocument) {
      if (disposed || !view) return refused(new Error('The viewport is unavailable.'), false);
      try {
        if (!shown || previous.sceneSource !== shown.sceneSource || !sameCamera(previous.camera, shown.camera)) {
          return refused(new Error('Presentation rollback must name the actual displayed source and camera.'), live());
        }
        if (candidate.mode === 'source' && !sameCamera(candidate.document.camera, shown.camera)) {
          return refused(new Error('Source-only presentation must preserve the actual viewport camera.'), live());
        }
        if (candidate.mode === 'camera') {
          if (shown.sceneSource !== candidate.document.sceneSource || shown.sourceVersion !== candidate.document.sourceVersion) {
            return refused(new Error('Camera-only presentation cannot replace the displayed scene source.'), live());
          }
          applySceneCamera(viewer, candidate.document.camera);
          shown = candidate.document;
          return {ok: true};
        }
        // A refused source leaves the shown scene as it was.
        const source = show(candidate.document.sceneSource);
        if (!source.ok) return refused(source.error);
        if (candidate.mode === 'source') { shown = Object.freeze({...candidate.document, camera: shown.camera}); return {ok: true}; }
        applySceneCamera(viewer, candidate.document.camera);
        shown = candidate.document;
        return {ok: true};
      } catch (error) { shown = null; return refused(error, false); }
    },
    recover(document) {
      if (disposed) return refused(new Error('The viewport is disposed.'), false);
      view?.dispose(); view = null; shown = null;
      try {
        view = showScene(viewer, document.sceneSource, {fit: false});
        applySceneCamera(viewer, document.camera);
        shown = document;
        return {ok: true};
      } catch (error) { return refused(error, false); }
    },
    resize(width, height) { if (disposed) return; viewer.setSize(width, height); },
    async readPixels() {
      if (!live()) throw new Error('The viewport is unavailable.');
      return (await viewer.capture()).data;
    },
    pickObject(point, expected, camera) {
      if (disposed || !view || !shown) throw new Error('The viewport is unavailable.');
      if (shown.documentId !== expected.documentId || shown.revision !== expected.revision || shown.version !== expected.version
        || shown.sourceVersion !== expected.sourceVersion || shown.sceneSource !== expected.sceneSource || !sameCamera(shown.camera, camera)) {
        throw new Error('The applied scene does not match the displayed frame.');
      }
      const hit = viewer.raycast(point.xCss, point.yCss);
      if (!hit?.mesh.name || view.meshes.get(hit.mesh.name) !== hit.mesh) return null;
      return {sceneName: view.result.ir.name, sourceVersion: 1, objectId: hit.mesh.name, approximate: true};
    },
    dispose() { if (disposed) return; disposed = true; view?.dispose(); view = null; shown = null; viewer.dispose(); }
  };
}
