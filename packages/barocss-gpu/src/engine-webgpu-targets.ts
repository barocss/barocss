import type { GPUDeviceHandle, GPUTextureHandle } from './webgpu-platform.js';

const COPY_SRC = 1, RENDER_ATTACHMENT = 16;
export interface EngineWebGPURenderTargets {
  readonly width: number;
  readonly height: number;
  readonly format: 'rgba8unorm' | 'bgra8unorm';
  readonly color: GPUTextureHandle;
  readonly depth: GPUTextureHandle;
  readonly logicalBytes: number;
  dispose(): void;
}

/** An offscreen opaque color + depth target for generic EngineScene.
 * The caller owns the WebGPU device and explicitly disposes the returned targets.
 */
export function createEngineWebGPURenderTargets(
  device: GPUDeviceHandle, width: number, height: number,
  format: 'rgba8unorm' | 'bgra8unorm',
): EngineWebGPURenderTargets {
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('Engine WebGPU render target dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Engine WebGPU color format requires rgba8unorm or bgra8unorm');
  const owned: GPUTextureHandle[] = [];
  try {
    const color = device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      dimension: '2d', format, sampleCount: 1,
      usage: RENDER_ATTACHMENT | COPY_SRC,
    });
    owned.push(color);
    const depth = device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      dimension: '2d', format: 'depth24plus', sampleCount: 1,
      usage: RENDER_ATTACHMENT,
    });
    owned.push(depth);
    let disposed = false;
    return Object.freeze({
      width, height, format, color, depth,
      // Logical two 4-byte-per-pixel attachments. Not a physical GPU memory estimate.
      logicalBytes: width * height * 8,
      dispose(): void {
        if (disposed) return;
        disposed = true;
        for (const texture of owned.splice(0)) {
          try { texture.destroy(); } catch { /* release remaining resources */ }
        }
      },
    });
  } catch (cause) {
    for (const texture of owned.splice(0)) {
      try { texture.destroy(); } catch { /* preserve the allocation failure */ }
    }
    throw cause;
  }
}
