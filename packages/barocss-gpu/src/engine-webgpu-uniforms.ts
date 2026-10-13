import type { GPUBufferHandle, GPUDeviceHandle } from './webgpu-platform.js';
import type { EngineWebGPUPipeline } from './engine-webgpu-pipeline.js';
import type { PreparedEngineWebGPUFrame } from './engine-webgpu-frame.js';

const COPY_DST = 8, UNIFORM = 64;
export interface EngineWebGPUUniformResources {
  readonly camera: GPUBufferHandle;
  readonly draws: readonly { readonly id: string; readonly buffer: GPUBufferHandle; readonly bindGroup: object }[];
  dispose(): void;
}

/** Private, caller-owned uniform resources. Frame is a CPU-prepared result of original scene admission. */
export function uploadEngineWebGPUUniforms(
  device: GPUDeviceHandle, pipeline: EngineWebGPUPipeline, frame: PreparedEngineWebGPUFrame,
): EngineWebGPUUniformResources {
  if (frame.format !== 'barocss-gpu-engine-webgpu-frame' || frame.version !== 0 ||
      !(frame.cameraBytes instanceof Float32Array) || frame.cameraBytes.byteLength !== 128 ||
      !Array.isArray(frame.draws) || frame.draws.length > 32 ||
      frame.draws.some(draw => !(draw.uniformBytes instanceof Float32Array) || draw.uniformBytes.byteLength !== 80))
    throw new TypeError('WebGPU uniforms require a qualified EngineScene frame');
  const owned: GPUBufferHandle[] = [];
  try {
    const camera = device.createBuffer({ size: 128, usage: UNIFORM | COPY_DST });
    owned.push(camera);
    device.queue.writeBuffer(camera, 0, frame.cameraBytes);
    const draws = frame.draws.map(draw => {
      const buffer = device.createBuffer({ size: 256, usage: UNIFORM | COPY_DST });
      owned.push(buffer);
      device.queue.writeBuffer(buffer, 0, draw.uniformBytes);
      const bindGroup = device.createBindGroup({ layout: pipeline.groupLayout, entries: [
        { binding: 0, resource: { buffer: camera, offset: 0, size: 128 } },
        { binding: 1, resource: { buffer, offset: 0, size: 80 } },
      ] });
      return Object.freeze({ id: draw.id, buffer, bindGroup });
    });
    let disposed = false;
    return Object.freeze({
      camera, draws: Object.freeze(draws),
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const buffer of owned.splice(0)) try { buffer.destroy(); } catch { /* continue peer cleanup */ }
      },
    });
  } catch (cause) {
    for (const buffer of owned.splice(0)) try { buffer.destroy(); } catch { /* retain original failure */ }
    throw cause;
  }
}
