import type { GPUDeviceHandle } from './webgpu-platform.js';

type Observer = (cause: unknown) => void;
interface LossState {
  observers: Set<Observer>;
  terminal?: { cause: unknown };
}
const devices = new WeakMap<GPUDeviceHandle, LossState>();

function notify(observer: Observer, cause: unknown): void {
  try { observer(cause); } catch { /* One observer cannot prevent other owners from retiring. */ }
}

/** One native subscription per borrowed device; each owner removes its own callback. */
export function observeEngineWebGPUDeviceLoss(device: GPUDeviceHandle, observer: Observer): () => void {
  let state = devices.get(device);
  if (!state) {
    state = { observers: new Set() };
    devices.set(device, state);
    const current = state;
    const finish = (cause: unknown): void => {
      current.terminal = { cause };
      const observers = Array.from(current.observers);
      current.observers.clear();
      for (const callback of observers) notify(callback, cause);
    };
    void device.lost.then(info => {
      const error = new Error('Engine WebGPU device lost (' + info.reason.slice(0, 32) +
        '): ' + info.message.slice(0, 384), { cause: info });
      error.name = 'EngineWebGPUDeviceLostError';
      finish(error);
    }, finish);
  }
  if (state.terminal) notify(observer, state.terminal.cause);
  else state.observers.add(observer);
  const current = state;
  return () => { current.observers.delete(observer); };
}
