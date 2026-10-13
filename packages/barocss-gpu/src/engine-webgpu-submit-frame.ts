import { submitEngineWebGPURenderPass } from './engine-webgpu-renderpass.js';
import type { GPUDeviceHandle } from './webgpu-platform.js';
import type { PreparedEngineWebGPUFrame } from './engine-webgpu-frame.js';
import type { EngineWebGPUPipeline } from './engine-webgpu-pipeline.js';
import type { EngineWebGPUUniformResources } from './engine-webgpu-uniforms.js';
import type { EngineWebGPURenderTargets } from './engine-webgpu-targets.js';
import type { EngineWebGPUGeometryBuffers } from './engine-webgpu-geometry.js';

/** Frame-level assembly: all resources are already staged and caller-owned. */
export function submitPreparedEngineWebGPUFrame(
  device: GPUDeviceHandle,
  frame: PreparedEngineWebGPUFrame,
  pipeline: EngineWebGPUPipeline,
  targets: EngineWebGPURenderTargets,
  uniforms: EngineWebGPUUniformResources,
  geometries: ReadonlyMap<string, EngineWebGPUGeometryBuffers>,
  background: readonly [number, number, number],
): number {
  if (frame.format !== 'barocss-gpu-engine-webgpu-frame' || frame.version !== 0 ||
      frame.draws.length !== uniforms.draws.length)
    throw new TypeError('WebGPU frame and uniform staging must match');
  const commands = frame.draws.map((draw, index) => {
    const geometry = geometries.get(draw.geometryId);
    const binding = uniforms.draws[index];
    if (!geometry || geometry.id !== draw.geometryId || geometry.indexFormat !== frame.indexFormats[draw.geometryId] ||
        !binding || binding.id !== draw.id)
      throw new TypeError('WebGPU draw requires matching staged geometry and uniform identity');
    return { geometry, bindGroup: binding.bindGroup };
  });
  // Finish all cross-resource validations before device command encoding.
  return submitEngineWebGPURenderPass(device, pipeline, targets.color, targets.depth, commands, background);
}
