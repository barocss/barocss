import type { GPUDeviceHandle, GPUCanvasHandle, GPUTextureHandle } from './webgpu-platform.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';

/** Present an already completed opaque offscreen color target to an existing WebGPU canvas.
 * This does not acquire a device, configure a canvas, or claim GPU frame acceptance.
 */
export async function presentEngineWebGPUColor(
  device: GPUDeviceHandle,
  context: GPUCanvasHandle,
  source: GPUTextureHandle,
  width: number,
  height: number,
  budget?: EngineWebGPUWaitBudget,
): Promise<void> {
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('WebGPU presentation requires bounded backing dimensions');
  const waits = budget ?? new EngineWebGPUWaitBudget();
  waits.check('presentation copy');
  const destination = context.getCurrentTexture();
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToTexture({ texture: source }, { texture: destination },
    { width, height, depthOrArrayLayers: 1 });
  device.queue.submit([encoder.finish()]);
  await waits.wait(device.queue.onSubmittedWorkDone(), 'presentation queue');
}
