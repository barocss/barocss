import { presentEngineWebGPUColor } from './engine-webgpu-present.js';
import { withEngineWebGPUErrorScopes } from './engine-webgpu-error-scopes.js';
import type { GPUCanvasHandle, GPUDeviceHandle, GPUTextureHandle } from './webgpu-platform.js';

/** Refuse successful presentation on device errors. Already submitted pixels cannot be undone. */
export async function presentCheckedEngineWebGPUColor(
  device: GPUDeviceHandle, context: GPUCanvasHandle, source: GPUTextureHandle,
  width: number, height: number,
): Promise<void> {
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('Engine WebGPU presentation dimensions exceed bounded device limits');
  await withEngineWebGPUErrorScopes(device,
    () => presentEngineWebGPUColor(device, context, source, width, height),
    () => {}, 'Engine WebGPU presentation error admission refused');
}
