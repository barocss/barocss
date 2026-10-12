import {createRenderNativeDirectionalLightSession, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeDirectionalLightDocumentV1, RenderNativeDirectionalLightSession} from '@barocss/render-editor';
import type {NativeDirectionalLightWebGPUOptions} from '@barocss/gpu';

/** Headless ownership only. A superseded factory is awaited and cleaned up, never fake-cancelled. */
export function createNativeDirectionalLightController() {
  let closed = false, generation = 0, session: RenderNativeDirectionalLightSession | null = null;
  return Object.freeze({
    getSession: () => session,
    async mount(canvas: HTMLCanvasElement, initial: RenderNativeDirectionalLightDocumentV1, options: NativeDirectionalLightWebGPUOptions): Promise<RenderNativeDirectionalLightSession | null> {
      if (closed) throw new RenderEditorError('DISPOSED', 'Directional light controller is closed.');
      const started = ++generation, previous = session; session = null;
      previous?.dispose();
      const next = await createRenderNativeDirectionalLightSession(canvas, initial, options);
      if (closed || generation !== started) {next.dispose(); return null;}
      session = next; return next;
    },
    dispose(): void {
      if (closed) return;
      closed = true; generation++;
      const previous = session; session = null; previous?.dispose();
    },
  });
}
