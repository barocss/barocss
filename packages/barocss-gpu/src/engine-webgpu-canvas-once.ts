import { prepareEngineScene } from './engine-scene.js';
import { renderCheckedEngineWebGPUOnce } from './engine-webgpu-checked-once.js';
import { configureEngineWebGPUCanvas } from './engine-webgpu-canvas-config.js';
import { presentCheckedEngineWebGPUColor } from './engine-webgpu-checked-present.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import { observeEngineWebGPUDeviceLoss } from './engine-webgpu-device-loss.js';
import type { EngineSceneV0 } from './engine-scene.js';
import type { GPUCanvasHandle, GPUDeviceHandle } from './webgpu-platform.js';

const activeContexts = new WeakSet<GPUCanvasHandle>();

/** Private one-shot composition. Caller owns the live device and matching canvas backing.
 * Caller serializes device scopes; no mounted updates or pixel rollback.
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
  const budget = new EngineWebGPUWaitBudget();
  activeContexts.add(context);
  let frame: Awaited<ReturnType<typeof renderCheckedEngineWebGPUOnce>> | undefined;
  let canvas: ReturnType<typeof configureEngineWebGPUCanvas> | undefined;
  let disposed = false;
  let accepted = false;
  let stopObserving = (): void => {};
  let lossFailures: unknown[] = [];
  function release(): unknown[] {
    if (disposed) return [];
    disposed = true;
    stopObserving();
    const failures: unknown[] = [];
    try { frame?.dispose(); } catch (cause) { failures.push(cause); }
    try { canvas?.dispose(); } catch (cause) { failures.push(cause); }
    activeContexts.delete(context);
    return failures;
  }
  try {
    stopObserving = observeEngineWebGPUDeviceLoss(device, cause => {
      budget.cancel(cause);
      if (accepted) lossFailures = release();
    });
    // A native loss promise can already be settled when this operation starts.
    await Promise.resolve();
    budget.check('Canvas device admission');
    frame = await renderCheckedEngineWebGPUOnce(device, source.scene, width, height, format, budget);
    budget.check('Canvas configuration');
    canvas = configureEngineWebGPUCanvas(context, device, width, height, format);
    await presentCheckedEngineWebGPUColor(device, context, frame.targets.color, width, height, budget);
    budget.check('Canvas lease admission');
    accepted = true;
    return Object.freeze({
      drawCount: frame.drawCount, geometryCount: frame.geometryCount,
      dispose(): void {
        const failures = [...lossFailures, ...release()];
        lossFailures = [];
        if (failures.length) throw new AggregateError(failures, 'Engine WebGPU Canvas disposal refused');
      },
    });
  } catch (cause) {
    release(); // Cleanup failures must not replace the original staging/presentation failure.
    throw cause;
  }
}
