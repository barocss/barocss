import { prepareEngineScene } from './engine-scene.js';
import { prepareEngineWebGPUFrame } from './engine-webgpu-frame.js';
import { createEngineWebGPUPipeline } from './engine-webgpu-pipeline.js';
import { uploadEngineWebGPUGeometry } from './engine-webgpu-geometry.js';
import { uploadEngineWebGPUUniforms } from './engine-webgpu-uniforms.js';
import { createEngineWebGPURenderTargets } from './engine-webgpu-targets.js';
import { submitEngineWebGPURenderPass } from './engine-webgpu-renderpass.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { EngineWebGPUGeometryBuffers } from './engine-webgpu-geometry.js';
import type { GPUDeviceHandle } from './webgpu-platform.js';

/** One staged opaque EngineScene frame, entirely caller-owned until disposed.
 * Not a mounted viewport: the caller separately owns device, canvas and presentation.
 */
export async function renderEngineWebGPUOnce(
  device: GPUDeviceHandle, input: EngineSceneV0, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm', budget?: EngineWebGPUWaitBudget,
) {
  // Admit before allocating any GPU handles. Both views share original authored data.
  const prepared = prepareEngineScene(input);
  const frame = prepareEngineWebGPUFrame(prepared.scene, width, height);
  const waits = budget ?? new EngineWebGPUWaitBudget();
  const disposals: (() => void)[] = [];
  try {
    const pipeline = await createEngineWebGPUPipeline(device, format, waits);
    waits.check('offscreen resources');
    const targets = createEngineWebGPURenderTargets(device, width, height, format);
    disposals.push(() => targets.dispose());
    const geometry = new Map<string, EngineWebGPUGeometryBuffers>();
    disposals.push(() => { for (const item of geometry.values()) item.dispose(); geometry.clear(); });
    const used = new Set(frame.draws.map(draw => draw.geometryId));
    for (const item of prepared.geometries) {
      if (used.has(item.geometry.id)) {
        waits.check('geometry upload');
        geometry.set(item.geometry.id, uploadEngineWebGPUGeometry(device, item.geometry));
      }
    }
    waits.check('draw uniforms');
    const uniforms = uploadEngineWebGPUUniforms(device, pipeline, frame);
    disposals.push(() => uniforms.dispose());
    const commands = frame.draws.map((draw, index) => {
      const resource = geometry.get(draw.geometryId);
      const group = uniforms.draws[index];
      if (!resource || resource.indexFormat !== frame.indexFormats[draw.geometryId] || !group || group.id !== draw.id)
        throw new TypeError('Unmatched EngineScene draw resources');
      return { geometry: resource, bindGroup: group.bindGroup };
    });
    waits.check('offscreen submission');
    const drawCount = submitEngineWebGPURenderPass(device, pipeline, targets.color, targets.depth,
      commands, prepared.scene.background);
    let disposed = false;
    return Object.freeze({
      targets, drawCount, geometryCount: geometry.size,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const release of disposals.reverse()) {
          try { release(); } catch { /* always attempt remaining resource owners */ }
        }
      },
    });
  } catch (cause) {
    for (const release of disposals.reverse()) {
      try { release(); } catch { /* preserve original frame failure */ }
    }
    throw cause;
  }
}
