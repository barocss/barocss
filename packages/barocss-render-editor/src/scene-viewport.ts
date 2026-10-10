import {mountScene, type SceneRenderer} from '@barocss/gpu';
import type {RenderSceneDocumentV0} from './document.js';
import type {RenderEditorPreparedCandidate} from './session.js';
import type {PresentationResult, RenderEditorPresenter} from './controller.js';

/** One owned source1 renderer. No canvas, input or clock is constructed by the pure root. */
export function createSceneViewportPresenter(canvas: HTMLCanvasElement, onUnavailable?: (error: Error) => void): RenderEditorPresenter & {resize(width: number, height: number): void; readPixels(): Uint8Array} {
  let renderer: SceneRenderer<1> | null = null;
  let shown: RenderSceneDocumentV0 | null = null;
  let disposed = false;
  const errorOf = (error: unknown) => error instanceof Error ? error : new Error('Viewport failed.');
  const live = () => { try { renderer!.readPixels(); return true; } catch { return false; } };
  const refused = (error: unknown, recovered = live()): PresentationResult => ({ok: false, error: errorOf(error), recovered});
  const onLoss = (event: Event) => {
    event.preventDefault();
    // Old GL handles must be released during loss, before a restored context exists.
    renderer?.dispose(); renderer = null; shown = null;
    onUnavailable?.(new Error('The preview was lost. Restore the preview to continue.'));
  };
  canvas.addEventListener('webglcontextlost', onLoss);
  return {
    present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0) {
      if (disposed || !renderer) return refused(new Error('The viewport is unavailable.'), false);
      try {
        if (candidate.mode === 'camera') {
          if (!shown || shown.sceneSource !== candidate.document.sceneSource || shown.sourceVersion !== candidate.document.sourceVersion) {
            return refused(new Error('Camera-only presentation cannot replace the displayed scene source.'), live());
          }
          const result = renderer.setCamera(candidate.document.camera);
          if (result.ok) shown = candidate.document;
          return result.ok ? result : refused(result.error);
        }
        const source = renderer.update(candidate.document.sceneSource);
        if (!source.ok) return refused(source.error);
        if (candidate.mode === 'source') { shown = Object.freeze({...candidate.document, camera: shown?.camera ?? previous.camera}); return {ok: true}; }
        const camera = renderer.setCamera(candidate.document.camera);
        if (camera.ok) { shown = candidate.document; return {ok: true}; }
        // update and setCamera are separate GPU transactions. Compensate explicitly.
        const sourceBack = renderer.update(previous.sceneSource);
        const cameraBack = renderer.setCamera(previous.camera);
        const recovered = sourceBack.ok && cameraBack.ok && live();
        shown = recovered ? previous : null;
        return refused(camera.error, recovered);
      } catch (error) { shown = null; return refused(error, false); }
    },
    recover(document) {
      if (disposed) return refused(new Error('The viewport is disposed.'), false);
      renderer?.dispose(); renderer = null; shown = null;
      try { renderer = mountScene(canvas, document.sceneSource, document.camera, {sourceVersion: 1}); shown = document; return {ok: true}; }
      catch (error) { return refused(error, false); }
    },
    resize(width, height) { if (disposed || !renderer) return; try { renderer.resize(width, height); } catch (error) { if (!live()) onUnavailable?.(errorOf(error)); throw error; } },
    readPixels() { if (!renderer) throw new Error('The viewport is unavailable.'); return renderer.readPixels(); },
    dispose() { if (disposed) return; disposed = true; canvas.removeEventListener('webglcontextlost', onLoss); renderer?.dispose(); renderer = null; shown = null; }
  };
}
