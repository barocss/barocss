import { mountEngineScene } from '@barocss/gpu';
import type { EngineSceneRenderer } from '@barocss/gpu';
import { preparePrismFeatureScene } from './prism-feature-scene.js';
import type { PrismDisplayScene } from './prism-feature-scene.js';
export interface PrismDisplayCandidate { commit(): void; dispose(): void }
export interface PrismDisplayPort { prepare(display: PrismDisplayScene): Promise<PrismDisplayCandidate> }
type Renderer = Pick<EngineSceneRenderer, 'resize' | 'dispose'>;
/** Stage on a second canvas. A refused candidate never updates the accepted renderer. */
export function createPrismFeatureDisplay(host: HTMLElement, mount: typeof mountEngineScene = mountEngineScene) {
  let accepted: { canvas: HTMLCanvasElement; renderer: Renderer | null } | null = null;
  let disposed = false, epoch = 0;
  const pending = new Set<{ canvas: HTMLCanvasElement; renderer: Renderer | null }>();
  const size = () => { const rect = host.getBoundingClientRect(), ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    return { width: Math.max(1, Math.min(2048, Math.round(rect.width * ratio))), height: Math.max(1, Math.min(2048, Math.round(rect.height * ratio))) }; };
  const remove = (item: { canvas: HTMLCanvasElement; renderer: Renderer | null }) => { try { item.renderer?.dispose(); } finally { item.canvas.remove(); pending.delete(item); } };
  return {
    async prepare(display: PrismDisplayScene): Promise<PrismDisplayCandidate> {
      if (disposed) throw new Error('Prism display disposed.');
      const token = ++epoch, canvas = host.ownerDocument.createElement('canvas'), viewport = size();
      canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;visibility:hidden';
      canvas.setAttribute('aria-label', display.scene.geometries.length ? 'Trimmed prism triangles' : 'Empty subtraction result');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const item: { canvas: HTMLCanvasElement; renderer: Renderer | null } = { canvas, renderer: null };
      pending.add(item); host.appendChild(canvas);
      try {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        if (disposed || token !== epoch) throw new Error('Prism display candidate is stale.');
        item.renderer = mount(canvas, display.scene, viewport);
        return {
          commit() {
            if (disposed || token !== epoch || !pending.has(item)) throw new Error('Prism display candidate is stale.');
            // Resize before swapping; resize refusal leaves the accepted canvas visible.
            const current = size();
            if (item.renderer) item.renderer.resize(current.width, current.height);
            else { canvas.width = current.width; canvas.height = current.height; }
            const prior = accepted; accepted = item; pending.delete(item); canvas.style.visibility = 'visible';
            if (prior) { try { remove(prior); } catch { /* Old-resource cleanup cannot reverse a successful canvas swap. */ } }
          },
          dispose() { if (accepted !== item) remove(item); },
        };
      } catch (cause) { remove(item); throw cause; }
    },
    resize() {
      if (!accepted || disposed) return;
      const viewport = size();
      if (accepted.renderer) accepted.renderer.resize(viewport.width, viewport.height);
      else { accepted.canvas.width = viewport.width; accepted.canvas.height = viewport.height; }
    },
    dimensions: () => accepted ? { width: accepted.canvas.width, height: accepted.canvas.height } : size(),
    aspect() { const viewport = size(); return viewport.width / viewport.height; },
    fit(display: PrismDisplayScene) { return preparePrismFeatureScene(display.packet, display.view, this.aspect()); },
    dispose() { if (disposed) return; disposed = true; ++epoch; for (const item of pending) remove(item); if (accepted) remove(accepted); accepted = null; },
  };
}
