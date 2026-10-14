import { prepareEngineScene } from './engine-scene.js';
import { renderEngineWebGPUOnce } from './engine-webgpu-one-shot.js';
import { configureEngineWebGPUCanvas } from './engine-webgpu-canvas-config.js';
import { presentEngineWebGPUColor } from './engine-webgpu-present.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { GPUCanvasHandle, GPUDeviceHandle } from './webgpu-platform.js';

const activeContexts = new WeakSet<GPUCanvasHandle>();

/** Private one-shot composition. Caller owns the live device and matching canvas backing.
 * Not a mounted viewport, update transaction, validation scope or device-loss observer.
 */
export async function renderEngineWebGPUCanvasOnce(
  device: GPUDeviceHandle, context: GPUCanvasHandle, input: EngineSceneV0,
  width: number, height: number, format: 'rgba8unorm' | 'bgra8unorm',
): Promise<Readonly<{ drawCount: number; geometryCount: number; dispose(): void }>> {
  // Preserve an admitted original snapshot across asynchronous shader compilation.
  const source = prepareEngineScene(input);
  const limit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width > 2048 || height > 2048 ||
      !Number.isSafeInteger(limit) || width > limit || height > limit)
    throw new RangeError('Engine WebGPU Canvas dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Unsupported opaque Engine WebGPU Canvas color format');
  if (activeContexts.has(context)) throw new TypeError('Engine WebGPU Canvas is already claimed');
  activeContexts.add(context);
  let frame: Awaited<ReturnType<typeof renderEngineWebGPUOnce>> | undefined;
  let canvas: ReturnType<typeof configureEngineWebGPUCanvas> | undefined;
  let disposed = false;
  function release(): unknown[] {
    if (disposed) return [];
    disposed = true;
    const failures: unknown[] = [];
    try { frame?.dispose(); } catch (cause) { failures.push(cause); }
    try { canvas?.dispose(); } catch (cause) { failures.push(cause); }
    activeContexts.delete(context);
    return failures;
  }
  try {
    frame = await renderEngineWebGPUOnce(device, source.scene, width, height, format);
    canvas = configureEngineWebGPUCanvas(context, device, width, height, format);
    await presentEngineWebGPUColor(device, context, frame.targets.color, width, height);
    return Object.freeze({
      drawCount: frame.drawCount, geometryCount: frame.geometryCount,
      dispose(): void {
        const failures = release();
        if (failures.length) throw new AggregateError(failures, 'Engine WebGPU Canvas disposal refused');
      },
    });
  } catch (cause) {
    release(); // Cleanup failures must not replace the original staging/presentation failure.
    throw cause;
  }
}
