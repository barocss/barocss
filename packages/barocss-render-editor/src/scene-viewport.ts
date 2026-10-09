import {mountScene, type SceneRenderer} from '@barocss/gpu';
import type {RenderSceneDocumentV0} from './document.js';
import type {RenderEditorPreparedCandidate} from './session.js';
import type {PresentationResult, RenderEditorPresenter} from './controller.js';

/** One owned source1 renderer. No canvas, input or clock is constructed by the pure root. */
export function createSceneViewportPresenter(canvas: HTMLCanvasElement, onUnavailable?: (error: Error) => void): RenderEditorPresenter & {resize(width: number, height: number): void; readPixels(): Uint8Array} {
  let renderer: SceneRenderer<1> | null = null;
  let disposed = false;
  const errorOf = (error: unknown) => error instanceof Error ? error : new Error('Viewport failed.');
  const live = () => { try { renderer!.readPixels(); return true; } catch { return false; } };
  const refused = (error: unknown, recovered = live()): PresentationResult => ({ok: false, error: errorOf(error), recovered});
  const onLoss = () => onUnavailable?.(new Error('WebGL2 context is lost. Recover the viewport.'));
  canvas.addEventListener('webglcontextlost', onLoss);
  return {
    present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0) {
      if (disposed || !renderer) return refused(new Error('The viewport is unavailable.'), false);
      try {
        if (candidate.mode === 'camera') { const result = renderer.setCamera(candidate.document.camera); return result.ok ? result : refused(result.error); }
        const source = renderer.update(candidate.document.sceneSource);
        if (!source.ok) return refused(source.error);
        if (candidate.mode === 'source') return {ok: true};
        const camera = renderer.setCamera(candidate.document.camera);
        if (camera.ok) return {ok: true};
        // update and setCamera are separate GPU transactions. Compensate explicitly.
        const sourceBack = renderer.update(previous.sceneSource);
        const cameraBack = renderer.setCamera(previous.camera);
        return refused(camera.error, sourceBack.ok && cameraBack.ok && live());
      } catch (error) { return refused(error, false); }
    },
    recover(document) {
      if (disposed) return refused(new Error('The viewport is disposed.'), false);
      renderer?.dispose(); renderer = null;
      try { renderer = mountScene(canvas, document.sceneSource, document.camera, {sourceVersion: 1}); return {ok: true}; }
      catch (error) { return refused(error, false); }
    },
    resize(width, height) { if (disposed || !renderer) return; try { renderer.resize(width, height); } catch (error) { if (!live()) onUnavailable?.(errorOf(error)); throw error; } },
    readPixels() { if (!renderer) throw new Error('The viewport is unavailable.'); return renderer.readPixels(); },
    dispose() { if (disposed) return; disposed = true; canvas.removeEventListener('webglcontextlost', onLoss); renderer?.dispose(); renderer = null; }
  };
}
