import { prepareEngineScene } from './engine-scene.js';
import { prepareEngineWebGPUFrame } from './engine-webgpu-frame.js';
import { copyGpuData, freezeGpuData } from './gpu-data.js';
import { renderCheckedEngineWebGPUOnce } from './engine-webgpu-checked-once.js';
import { configureEngineWebGPUCanvas } from './engine-webgpu-canvas-config.js';
import { presentCheckedEngineWebGPUColor } from './engine-webgpu-checked-present.js';
import { readEngineWebGPUColor } from './engine-webgpu-readback.js';
import { observeEngineWebGPUDeviceLoss } from './engine-webgpu-device-loss.js';
import { claimEngineWebGPUContext } from './engine-webgpu-context-claim.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';
import type { EngineSceneV0, PreparedEngineScene } from './engine-scene.js';
import type { GPUCanvasHandle, GPUDeviceHandle } from './webgpu-platform.js';

type Frame = Awaited<ReturnType<typeof renderCheckedEngineWebGPUOnce>>;
type State = 'ready' | 'busy' | 'lost' | 'disposed' | 'unavailable';
type ColorFormat = 'rgba8unorm' | 'bgra8unorm';

/** Private fixed-backing session; device/context/backing remain caller-owned.
 * Original source is authority; derived offscreen bytes do not certify physical pixels.
 */
export async function createEngineWebGPUSession(
  device: GPUDeviceHandle, context: GPUCanvasHandle, input: EngineSceneV0,
  width: number, height: number, format: ColorFormat,
) {
  let source = prepareEngineScene(input);
  const dimensionLimit = device.limits.maxTextureDimension2D;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
      width > 2048 || height > 2048 || !Number.isSafeInteger(dimensionLimit) ||
      width > dimensionLimit || height > dimensionLimit)
    throw new RangeError('Engine WebGPU session dimensions exceed bounded device limits');
  if (format !== 'rgba8unorm' && format !== 'bgra8unorm')
    throw new TypeError('Engine WebGPU session requires rgba8unorm or bgra8unorm');
  const readbackBytes = Math.ceil(width * 4 / 256) * 256 * height;
  function resourceBytes(prepared: PreparedEngineScene, priorBytes = 0): number {
    const frame = prepareEngineWebGPUFrame(prepared.scene, width, height);
    const bytes = prepared.bufferBytes + frame.uniformBufferBytes + width * height * 8;
    if (priorBytes + bytes + readbackBytes > 67108864)
      throw new RangeError('Engine WebGPU session logical resources exceed64MiB');
    const used = new Set(prepared.draws.map(draw => draw.geometryId));
    const sizes = [128, prepared.draws.length ? 256 : 0, readbackBytes];
    for (const geometry of prepared.geometries) {
      if (used.has(geometry.geometry.id))
        sizes.push(geometry.positions.byteLength, Math.ceil(geometry.indices.byteLength / 4) * 4);
    }
    const limit = device.limits.maxBufferSize;
    if (!Number.isSafeInteger(limit) || limit < 1 || sizes.some(size => size > limit))
      throw new RangeError('Engine WebGPU session buffers exceed actual device limits');
    return bytes;
  }
  let acceptedBytes = resourceBytes(source);
  const releaseClaim = claimEngineWebGPUContext(context);
  let accepted: Frame | undefined;
  let canvas: ReturnType<typeof configureEngineWebGPUCanvas> | undefined;
  let state: State = 'busy', busy = true, generation = 0;
  let terminal: { cause: unknown } | undefined;
  let activeBudget: EngineWebGPUWaitBudget | undefined = new EngineWebGPUWaitBudget();
  let stopObserving = (): void => {};
  const cleanupFailures: unknown[] = [];
  function releaseAccepted(): void {
    const frame = accepted, configuration = canvas;
    accepted = undefined; canvas = undefined;
    try { frame?.dispose(); } catch (cause) { cleanupFailures.push(cause); }
    try { configuration?.dispose(); } catch (cause) { cleanupFailures.push(cause); }
    if (!busy) releaseClaim();
  }
  function terminate(next: 'lost' | 'disposed' | 'unavailable', cause: unknown): void {
    if (!terminal) terminal = { cause };
    if (state !== 'disposed') state = next;
    activeBudget?.cancel(terminal.cause);
    stopObserving();
    releaseAccepted();
  }
  function finish(): void {
    busy = false; activeBudget = undefined;
    if (terminal) releaseClaim();
    else state = 'ready';
  }
  function live(): void {
    if (terminal) throw terminal.cause;
    if (busy) throw new TypeError('Engine WebGPU session is busy');
  }
  function begin(): EngineWebGPUWaitBudget {
    busy = true; state = 'busy';
    activeBudget = new EngineWebGPUWaitBudget();
    return activeBudget;
  }
  const session = Object.freeze({
    getScene(): EngineSceneV0 {
      if (state === 'disposed') throw new TypeError('Engine WebGPU session is disposed');
      return freezeGpuData(copyGpuData(source.scene));
    },
    getStatus(): Readonly<{ state: State; generation: number }> {
      return Object.freeze({ state, generation });
    },
    async update(nextInput: EngineSceneV0): Promise<void> {
      live();
      if (generation === Number.MAX_SAFE_INTEGER) throw new RangeError('Engine WebGPU generation exhausted');
      const next = prepareEngineScene(nextInput), bytes = resourceBytes(next, acceptedBytes);
      const budget = begin();
      let candidate: Frame | undefined, presentation = false;
      try {
        candidate = await renderCheckedEngineWebGPUOnce(device, next.scene, width, height, format, budget);
        budget.check('session candidate admission');
        presentation = true;
        await presentCheckedEngineWebGPUColor(device, context, candidate.targets.color, width, height, budget);
        budget.check('session update admission');
        const previous = accepted;
        accepted = candidate; candidate = undefined;
        source = next; acceptedBytes = bytes; generation++;
        previous?.dispose();
      } catch (cause) {
        try { candidate?.dispose(); } catch { /* Retain the original update refusal. */ }
        if (presentation && !terminal) terminate('unavailable', cause);
        throw cause;
      } finally { finish(); }
    },
    async readPixels(): Promise<Uint8Array> {
      live();
      const frame = accepted!, budget = begin();
      try {
        return await readEngineWebGPUColor(device, frame.targets.color, width, height, format, budget);
      } finally { finish(); }
    },
    dispose(): void {
      if (state !== 'disposed') {
        terminate('disposed', new Error('Engine WebGPU session is disposed'));
        state = 'disposed';
      }
      if (cleanupFailures.length)
        throw new AggregateError(cleanupFailures.splice(0), 'Engine WebGPU session disposal refused');
    },
  });
  let candidate: Frame | undefined;
  const budget = activeBudget;
  try {
    stopObserving = observeEngineWebGPUDeviceLoss(device, cause => terminate('lost', cause));
    await Promise.resolve();
    budget.check('session device admission');
    candidate = await renderCheckedEngineWebGPUOnce(device, source.scene, width, height, format, budget);
    budget.check('session Canvas configuration');
    canvas = configureEngineWebGPUCanvas(context, device, width, height, format);
    await presentCheckedEngineWebGPUColor(device, context, candidate.targets.color, width, height, budget);
    budget.check('session initial admission');
    accepted = candidate; candidate = undefined; generation = 1;
    return session;
  } catch (cause) {
    try { candidate?.dispose(); } catch { /* Preserve initial failure identity. */ }
    if (!terminal) terminate('unavailable', cause);
    throw cause;
  } finally { finish(); }
}
