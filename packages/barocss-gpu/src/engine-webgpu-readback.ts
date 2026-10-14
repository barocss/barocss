import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import { observeEngineWebGPUDeviceLoss } from './engine-webgpu-device-loss.js';
import { withEngineWebGPUErrorScopes } from './engine-webgpu-error-scopes.js';
import type { GPUBufferHandle, GPUDeviceHandle, GPUTextureHandle } from './webgpu-platform.js';

/** Trusted live generic offscreen color only. Caller serializes borrowed device scopes.
 * Returns a fresh tight encoded RGBA copy in top-left row order; no physical pixel proof.
 */
export async function readEngineWebGPUColor(
  device: GPUDeviceHandle, color: GPUTextureHandle, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm', budget?: EngineWebGPUWaitBudget,
): Promise<Uint8Array> {
  const dimensionLimit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width > 2048 || height > 2048 || !Number.isSafeInteger(dimensionLimit) ||
      width > dimensionLimit || height > dimensionLimit)
    throw new RangeError('Engine WebGPU readback dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Engine WebGPU readback requires rgba8unorm or bgra8unorm');
  const rowBytes = Math.ceil(width * 4 / 256) * 256, bytes = rowBytes * height;
  const bufferLimit = device.limits.maxBufferSize;
  if (!Number.isSafeInteger(bufferLimit) || bufferLimit < 1 || bytes > bufferLimit || bytes > 16777216)
    throw new RangeError('Engine WebGPU readback buffer exceeds bounded device limits');
  const waits = budget ?? new EngineWebGPUWaitBudget();
  let buffer: GPUBufferHandle | undefined, retired = false;
  let stopObserving = (): void => {};
  let failed = false, primary: unknown, result: Uint8Array | undefined;
  try {
    stopObserving = observeEngineWebGPUDeviceLoss(device, cause => waits.cancel(cause));
    await Promise.resolve();
    waits.check('readback device admission');
    result = await withEngineWebGPUErrorScopes(device, async () => {
      waits.check('readback allocation');
      buffer = device.createBuffer({ size: bytes, usage: 1 | 8 }); // MAP_READ | COPY_DST
      const encoder = device.createCommandEncoder();
      encoder.copyTextureToBuffer({ texture: color, origin: { x: 0, y: 0, z: 0 } },
        { buffer, bytesPerRow: rowBytes, rowsPerImage: height },
        { width, height, depthOrArrayLayers: 1 });
      waits.check('readback submission');
      device.queue.submit([encoder.finish()]);
      await waits.wait(device.queue.onSubmittedWorkDone(), 'readback queue');
      waits.check('readback mapping');
      const mappedBuffer = buffer;
      const mapping = mappedBuffer.mapAsync(1);
      // A structural/native mapping may settle after timeout or loss and owner release.
      void mapping.then(() => {
        if (retired) {
          try { mappedBuffer.unmap(); } catch { /* Observe late cleanup without an orphan rejection. */ }
        }
      }, () => {});
      await waits.wait(mapping, 'readback mapping');
      waits.check('readback mapped bytes');
      const padded = new Uint8Array(mappedBuffer.getMappedRange());
      if (padded.byteLength !== bytes) throw new RangeError('Engine WebGPU mapped readback size differs');
      const copy = new Uint8Array(width * height * 4);
      for (let row = 0; row < height; row++)
        copy.set(padded.subarray(row * rowBytes, row * rowBytes + width * 4), row * width * 4);
      if (format === 'bgra8unorm') {
        for (let offset = 0; offset < copy.length; offset += 4)
          [copy[offset], copy[offset + 2]] = [copy[offset + 2], copy[offset]];
      }
      return copy;
    }, () => {}, 'Engine WebGPU readback validation refused', waits);
    waits.check('readback result admission');
  } catch (cause) { failed = true; primary = cause; }
  stopObserving();
  retired = true;
  const failures: unknown[] = [];
  if (buffer) {
    try { buffer.unmap(); } catch (cause) { failures.push(cause); }
    try { buffer.destroy(); } catch (cause) { failures.push(cause); }
  }
  if (failed) throw primary;
  if (failures.length) throw new AggregateError(failures, 'Engine WebGPU readback cleanup refused');
  return result!;
}
