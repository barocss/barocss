import type { GPUCanvasHandle, GPUDeviceHandle } from './webgpu-platform.js';

const COPY_DST = 2, RENDER_ATTACHMENT = 16;

/** Configure an existing browser WebGPU canvas for copying an accepted offscreen frame.
 * The backing canvas size is set by the caller; no device or DOM ownership is implied.
 */
export function configureEngineWebGPUCanvas(
  context: GPUCanvasHandle, device: GPUDeviceHandle, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm',
): { dispose(): void } {
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('WebGPU Canvas backing dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Unsupported opaque WebGPU Canvas color format');
  // COPY_DST is mandatory: the generic renderer presents via copyTextureToTexture.
  context.configure({ device, format, alphaMode: 'opaque', usage: COPY_DST | RENDER_ATTACHMENT });
  let disposed = false;
  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      context.unconfigure();
    },
  });
}
