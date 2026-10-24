import { printLayers, type PrintLayers } from '@barocss/cad-model/print/layers';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { extrudePrintSupport } from './printSupport';
import type { PrintDisplay } from './printDisplay';

export interface PrintRequest {
  request: number; sourceKey: number; meshes: DisplayMesh[]; layer: number;
  direction?: [number, number, number]; layerHeight?: number; overhangLimit?: number;
}
export type PrintReply = { request: number; display: PrintDisplay } | { request: number; error: string };
let latest = 0, summaryKey = 0, cacheKey = '', model: PrintLayers | null = null, supportMesh: DisplayMesh | null = null;
self.onmessage = (event: MessageEvent<PrintRequest>) => {
  const job = event.data; latest = job.request;
  setTimeout(() => {
    if (latest !== job.request) return;
    try {
      if (!job.meshes.length || !job.meshes.some(m => m.indices.length)) throw new Error('No visible solid mesh to preview.');
      if (job.layerHeight !== undefined && !(Number.isFinite(job.layerHeight) && job.layerHeight > 0)) throw new Error('Layer height must be a finite positive distance.');
      if (job.direction && (job.direction.some(x => !Number.isFinite(x)) || !(Math.hypot(...job.direction) > 0))) throw new Error('Build direction must be finite and nonzero.');
      if (job.overhangLimit !== undefined && !(Number.isFinite(job.overhangLimit) && job.overhangLimit > 0 && job.overhangLimit < 90)) throw new Error('Overhang limit must be between 0 and 90 degrees.');
      if (!Number.isSafeInteger(job.layer) || job.layer < 0) throw new Error('Layer index must be a nonnegative safe integer.');
      const key = JSON.stringify([job.sourceKey, job.direction ?? null, job.layerHeight ?? null, job.overhangLimit ?? null]);
      if (!model || cacheKey !== key) {
        const next = printLayers(job.meshes, { direction: job.direction, layerHeight: job.layerHeight, overhangLimit: job.overhangLimit });
        if (!Number.isSafeInteger(next.count) || next.count < 1) throw new Error('Layer height produces an unsupported layer count.');
        const mesh = extrudePrintSupport(next.supportColumns);
        model = next; supportMesh = mesh; cacheKey = key; summaryKey++;
      }
      const k = Math.min(job.layer, model.count - 1), layer = model.layer(k);
      const { layer: lazyLayer, ...summary } = model; void lazyLayer;
      const display: PrintDisplay = { request: job.request, summaryKey, summary, layer, supportMesh: supportMesh!, topMM: Math.min(model.height, (k + 1) * model.layerMM.mm), supports: true, printed: true };
      if (latest === job.request) self.postMessage({ request: job.request, display } satisfies PrintReply);
    } catch (error) {
      if (latest === job.request) self.postMessage({ request: job.request, error: error instanceof Error ? error.message : String(error) } satisfies PrintReply);
    }
  }, 0);
};
