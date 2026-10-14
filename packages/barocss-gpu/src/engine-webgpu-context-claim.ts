import type { GPUCanvasHandle } from './webgpu-platform.js';

const active = new WeakSet<GPUCanvasHandle>();

/** Shared exclusive context custody for private generic Canvas operations. */
export function claimEngineWebGPUContext(context: GPUCanvasHandle): () => void {
  if (active.has(context)) throw new TypeError('Engine WebGPU Canvas is already claimed');
  active.add(context);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active.delete(context);
  };
}
