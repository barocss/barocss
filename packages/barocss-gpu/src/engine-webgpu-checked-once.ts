import { prepareEngineScene } from './engine-scene.js';
import { renderEngineWebGPUOnce } from './engine-webgpu-one-shot.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { GPUDeviceHandle } from './webgpu-platform.js';

/** Private offscreen admission barrier. Caller serializes borrowed device error scopes.
 * No Canvas presentation, timeout, device acquisition or device-loss ownership.
 */
export async function renderCheckedEngineWebGPUOnce(
  device: GPUDeviceHandle, input: EngineSceneV0, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm',
): Promise<Awaited<ReturnType<typeof renderEngineWebGPUOnce>>> {
  const source = prepareEngineScene(input);
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('Engine WebGPU offscreen dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Unsupported opaque Engine WebGPU offscreen color format');
  let pushed = 0, failed = false, original: unknown;
  let frame: Awaited<ReturnType<typeof renderEngineWebGPUOnce>> | undefined;
  const errors: { message: string }[] = [];
  try {
    for (const filter of ['out-of-memory', 'internal', 'validation']) {
      device.pushErrorScope(filter); pushed++;
    }
    frame = await renderEngineWebGPUOnce(device, source.scene, width, height, format);
    await device.queue.onSubmittedWorkDone();
  } catch (cause) { failed = true; original = cause; }
  // Pop every owned scope, including after a partial push or a rejected pop.
  for (let index = 0; index < pushed; index++) {
    try {
      const error = await device.popErrorScope();
      if (error !== null) errors.push(error);
    } catch (cause) {
      if (!failed) { failed = true; original = cause; }
    }
  }
  if (failed || errors.length) {
    try { frame?.dispose(); } catch { /* Preserve original refusal over cleanup errors. */ }
    if (failed) throw original;
    throw new AggregateError(errors, 'Engine WebGPU offscreen error admission refused');
  }
  return frame!;
}
