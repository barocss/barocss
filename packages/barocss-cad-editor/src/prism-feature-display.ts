import { mountEngineScene } from '@barocss/gpu';
import type { EngineSceneRenderer, EngineSceneV0 } from '@barocss/gpu';
import { preparePrismFeatureScene } from './prism-feature-scene.js';
import type { PrismDisplayScene } from './prism-feature-scene.js';
export interface PrismDisplayCandidate { commit(): void; dispose(): void }
export interface PrismPreviewDisplayCandidate extends PrismDisplayCandidate { show(): void }
export interface CadEditorSceneDisplay { scene: EngineSceneV0; canvasLabel?: string }
export interface PrismDisplayPort {
  prepare(display: CadEditorSceneDisplay): Promise<PrismDisplayCandidate>;
  preparePreview?(display: CadEditorSceneDisplay): Promise<PrismPreviewDisplayCandidate>;
  updateScene?(display: CadEditorSceneDisplay): void;
}
type Renderer = Pick<EngineSceneRenderer, 'resize' | 'dispose'> & Partial<Pick<EngineSceneRenderer, 'update'>>;
interface DisplayItem { canvas: HTMLCanvasElement; renderer: Renderer | null; retired: boolean; removed: boolean }
/** Retain one accepted canvas and at most one staged or visible candidate. */
export function createPrismFeatureDisplay(host: HTMLElement, mount: typeof mountEngineScene = mountEngineScene) {
  let accepted: DisplayItem | null = null, pending: DisplayItem | null = null, preview: DisplayItem | null = null;
  let disposed = false, epoch = 0;
  const size = () => { const rect = host.getBoundingClientRect(), ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    return { width: Math.max(1, Math.min(2048, Math.round(rect.width * ratio))), height: Math.max(1, Math.min(2048, Math.round(rect.height * ratio))) }; };
  const remove = (item: DisplayItem): boolean => {
    item.retired = true;
    const renderer = item.renderer; item.renderer = null;
    // Cleanup cannot undo promotion. Always attempt canvas removal independently.
    try { renderer?.dispose(); } catch { /* The retired renderer is no longer owned. */ }
    if (!item.removed) {
      try { item.canvas.remove(); item.removed = true; } catch { /* Keep the slot until removal can be retried. */ }
    }
    return item.removed;
  };
  const discard = (item: DisplayItem) => {
    if (accepted === item) return;
    if (preview === item) {
      preview = null;
      // Restore the existing backing/camera before cleanup, without size reads,
      // mounting or resize: all of those may fail while cancellation must work.
      if (accepted) accepted.canvas.style.visibility = 'visible';
      item.canvas.style.visibility = 'hidden';
    }
    if (remove(item) && pending === item) pending = null;
  };
  const resizeItem = (item: DisplayItem) => {
    const viewport = size();
    if (item.renderer) item.renderer.resize(viewport.width, viewport.height);
    else { item.canvas.width = viewport.width; item.canvas.height = viewport.height; }
  };
  const prepare = async (display: CadEditorSceneDisplay): Promise<PrismPreviewDisplayCandidate> => {
    if (disposed) throw new Error('Prism display disposed.');
    const token = ++epoch;
    // Invalidate and remove the old slot before even allocating a canvas. This
    // includes preparations whose yield has not returned a candidate handle.
    if (pending) discard(pending);
    if (pending) throw new Error('Prism display could not remove the previous candidate canvas.');
    const viewport = size(), canvas = host.ownerDocument.createElement('canvas');
    const item: DisplayItem = { canvas, renderer: null, retired: false, removed: false };
    pending = item;
    const current = () => {
      if (disposed || token !== epoch || pending !== item || item.retired) throw new Error('Prism display candidate is stale.');
    };
    try {
      canvas.style.cssText = 'width:100%;height:100%;position:absolute;inset:0;visibility:hidden';
      canvas.setAttribute('aria-label', display.canvasLabel ?? (display.scene.geometries.length ? 'Trimmed prism triangles' : 'Empty subtraction result'));
      canvas.width = viewport.width; canvas.height = viewport.height;
      host.appendChild(canvas);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      current();
      item.renderer = mount(canvas, display.scene, viewport);
      current();
      return {
        show() {
          current();
          if (preview === item) return;
          resizeItem(item); current();
          // Everything that can refuse a candidate has finished before this
          // synchronous visibility swap. The accepted renderer remains intact.
          canvas.style.visibility = 'visible';
          if (accepted) accepted.canvas.style.visibility = 'hidden';
          preview = item;
        },
        commit() {
          current();
          resizeItem(item); current();
          const prior = accepted;
          canvas.style.visibility = 'visible';
          if (prior) prior.canvas.style.visibility = 'hidden';
          accepted = item; pending = null; preview = null;
          // Even a failed detach is nonfatal after promotion. Retain that hidden
          // cleanup slot so a later prepare cannot allocate a third canvas.
          if (prior && !remove(prior)) pending = prior;
        },
        dispose() { discard(item); },
      };
    } catch (cause) { discard(item); throw cause; }
  };
  return {
    prepare: (display: CadEditorSceneDisplay): Promise<PrismDisplayCandidate> => prepare(display),
    preparePreview: prepare,
    updateScene(display: CadEditorSceneDisplay) {
      if (disposed) throw new Error('Prism display disposed.');
      if (pending || preview) throw new Error('Prism display cannot update while a candidate is pending or visible.');
      const renderer = accepted?.renderer;
      if (!renderer) throw new Error('Prism display requires an accepted renderer.');
      if (typeof renderer.update !== 'function') throw new Error('Prism display renderer does not support scene updates.');
      // The renderer owns transactional presentation and rollback. Preserve our
      // canvas/ownership on refusal; context loss cannot promise retained pixels.
      const result = renderer.update(display.scene);
      if (!result.ok) throw result.error;
    },
    resize() {
      const visible = preview ?? accepted;
      if (visible && !disposed) resizeItem(visible);
    },
    dimensions: () => {
      const visible = preview ?? accepted;
      return visible ? { width: visible.canvas.width, height: visible.canvas.height } : size();
    },
    aspect() { const viewport = size(); return viewport.width / viewport.height; },
    fit(display: PrismDisplayScene) { return preparePrismFeatureScene(display.packet, display.view, this.aspect()); },
    dispose() {
      if (disposed) return;
      disposed = true; ++epoch; preview = null;
      if (pending) remove(pending);
      if (accepted) remove(accepted);
      pending = null; accepted = null;
    },
  };
}
