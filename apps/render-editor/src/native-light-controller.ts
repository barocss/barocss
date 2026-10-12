import {createRenderNativeLightSession, RenderEditorError} from '@barocss/render-editor';
import type {RenderNativeLightDocument, RenderNativeLightSession} from '@barocss/render-editor';

/** Headless ownership only. A superseded factory is awaited and cleaned up, never fake-cancelled. */
export function createNativeLightController() {
  let closed = false, generation = 0, session: RenderNativeLightSession | null = null;
  return Object.freeze({
    getSession: () => session,
    async mount(canvas: HTMLCanvasElement, initial: RenderNativeLightDocument, options: {width: number; height: number}): Promise<RenderNativeLightSession | null> {
      if (closed) throw new RenderEditorError('DISPOSED', 'Light controller is closed.');
      const started = ++generation, previous = session; session = null;
      previous?.dispose();
      const next = await createRenderNativeLightSession(canvas, initial, options);
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
