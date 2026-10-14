import type { GPUDeviceHandle, GPUTextureHandle } from './webgpu-platform.js';
import type { EngineWebGPUPipeline } from './engine-webgpu-pipeline.js';
import type { EngineWebGPUGeometryBuffers } from './engine-webgpu-geometry.js';
import { encodeEngineSRGB } from './engine-scene-shaders.js';

export interface EngineWebGPUDrawCommand {
  readonly geometry: EngineWebGPUGeometryBuffers;
  /** Fully constructed group0 camera/draw uniforms; owned by the caller. */
  readonly bindGroup: object;
}

/** A single opaque shared-depth render pass, in admitted EngineScene draw order.
 * Caller owns canvas/context, depth attachment, uniform resources and lifecycle.
 */
export function submitEngineWebGPURenderPass(
  device: GPUDeviceHandle,
  pipeline: EngineWebGPUPipeline,
  color: GPUTextureHandle,
  depth: GPUTextureHandle,
  draws: readonly EngineWebGPUDrawCommand[],
  background: readonly [number, number, number],
): number {
  if (!Array.isArray(draws) || draws.length > 32 ||
      draws.some(draw => !draw || !draw.geometry || !draw.bindGroup ||
        !Number.isInteger(draw.geometry.indexCount) || draw.geometry.indexCount < 3 ||
        draw.geometry.indexCount % 3 !== 0 ||
        (draw.geometry.indexFormat !== 'uint16' && draw.geometry.indexFormat !== 'uint32')))
    throw new TypeError('Engine WebGPU render pass requires up to 32 admitted indexed triangle draws');
  if (!Array.isArray(background) || background.length !== 3 ||
      background.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1))
    throw new TypeError('Render pass background must be three finite linear color channels in 0..1');
  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: color.createView(),
      clearValue: { r: encodeEngineSRGB(background[0]), g: encodeEngineSRGB(background[1]),
        b: encodeEngineSRGB(background[2]), a: 1 },
      loadOp: 'clear', storeOp: 'store',
    }],
    depthStencilAttachment: {
      view: depth.createView(), depthClearValue: 1,
      depthLoadOp: 'clear', depthStoreOp: 'store',
    },
  });
  pass.setPipeline(pipeline.pipeline);
  for (const { geometry, bindGroup } of draws) {
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, geometry.positions);
    pass.setIndexBuffer(geometry.indices, geometry.indexFormat);
    pass.drawIndexed(geometry.indexCount);
  }
  pass.end();
  device.queue.submit([encoder.finish()]);
  return draws.length;
}
