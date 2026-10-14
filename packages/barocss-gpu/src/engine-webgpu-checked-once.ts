import { prepareEngineScene } from './engine-scene.js';
import { renderEngineWebGPUOnce } from './engine-webgpu-one-shot.js';
import { withEngineWebGPUErrorScopes } from './engine-webgpu-error-scopes.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { GPUDeviceHandle } from './webgpu-platform.js';

/** Private offscreen admission barrier. Caller serializes borrowed device error scopes.
 * No Canvas presentation, timeout, device acquisition or device-loss ownership.
 */
export async function renderCheckedEngineWebGPUOnce(
  device: GPUDeviceHandle, input: EngineSceneV0, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm', budget?: EngineWebGPUWaitBudget,
): Promise<Awaited<ReturnType<typeof renderEngineWebGPUOnce>>> {
  const source = prepareEngineScene(input);
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('Engine WebGPU offscreen dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Unsupported opaque Engine WebGPU offscreen color format');
  const waits = budget ?? new EngineWebGPUWaitBudget();
  let frame: Awaited<ReturnType<typeof renderEngineWebGPUOnce>> | undefined;
  return withEngineWebGPUErrorScopes(device, async () => {
    frame = await renderEngineWebGPUOnce(device, source.scene, width, height, format, waits);
    await waits.wait(device.queue.onSubmittedWorkDone(), 'offscreen queue');
    return frame;
  }, () => frame?.dispose(), 'Engine WebGPU offscreen error admission refused', waits);
}
