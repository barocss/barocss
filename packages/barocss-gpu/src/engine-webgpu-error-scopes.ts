import type { GPUDeviceHandle } from './webgpu-platform.js';
import { EngineWebGPUWaitBudget } from './engine-webgpu-wait-budget.js';

/** Trusted private operations only; caller serializes borrowed device scope activity. */
export async function withEngineWebGPUErrorScopes<T>(
  device: GPUDeviceHandle, operation: () => Promise<T>, onRefusal: () => void,
  detail: string, budget?: EngineWebGPUWaitBudget,
): Promise<T> {
  let pushed = 0, failed = false, original: unknown, result: T | undefined;
  const errors: { message: string }[] = [];
  const waits = budget ?? new EngineWebGPUWaitBudget();
  try {
    waits.check('error scope push');
    for (const filter of ['out-of-memory', 'internal', 'validation']) {
      device.pushErrorScope(filter); pushed++;
    }
    result = await operation();
  } catch (cause) { failed = true; original = cause; }
  for (let index = 0; index < pushed; index++) {
    try {
      const error = await waits.wait(device.popErrorScope(), 'error scope result');
      if (error !== null) errors.push(error);
    } catch (cause) {
      if (!failed) { failed = true; original = cause; }
    }
  }
  if (!failed && !errors.length) {
    try { waits.check('error scope admission'); }
    catch (cause) { failed = true; original = cause; }
  }
  if (failed || errors.length) {
    try { onRefusal(); } catch { /* Preserve original refusal over cleanup errors. */ }
    if (failed) throw original;
    throw new AggregateError(errors, detail);
  }
  return result!;
}
