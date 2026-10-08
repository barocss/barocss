import { Canvas2DError } from './schema.js';

export type TickInfo = Readonly<{
  frame: number;
  timestampMS: number;
  elapsedMS: number;
  deltaMS: number;
}>;
export type TickListener = (info: TickInfo) => void;
export type FrameScheduler = {
  requestFrame(callback: (timestampMS: number) => void): unknown;
  cancelFrame(token: unknown): void;
};
export type Canvas2DTicker = {
  readonly running: boolean;
  onTick(listener: TickListener, priority?: number): () => void;
  start(): void;
  stop(): void;
  dispose(): void;
};

function invalid(message: string): never { throw new Canvas2DError('INVALID_SCENE', message); }

function checkedScheduler(value: FrameScheduler | undefined): FrameScheduler {
  if (value === undefined) {
    if (typeof globalThis.requestAnimationFrame !== 'function' ||
        typeof globalThis.cancelAnimationFrame !== 'function') {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'animation frame scheduler is unavailable');
    }
    return {
      requestFrame(callback) { return globalThis.requestAnimationFrame(callback); },
      cancelFrame(token) { globalThis.cancelAnimationFrame(token as number); },
    };
  }
  if (value === null || typeof value !== 'object' ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    invalid('ticker scheduler must be a plain object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 2 || keys.some(key => key !== 'requestFrame' && key !== 'cancelFrame') ||
      !descriptors.requestFrame?.enumerable || !('value' in descriptors.requestFrame) ||
      !descriptors.cancelFrame?.enumerable || !('value' in descriptors.cancelFrame) ||
      typeof descriptors.requestFrame.value !== 'function' || typeof descriptors.cancelFrame.value !== 'function') {
    invalid('ticker scheduler needs requestFrame and cancelFrame functions');
  }
  const requestFrame = descriptors.requestFrame.value as FrameScheduler['requestFrame'];
  const cancelFrame = descriptors.cancelFrame.value as FrameScheduler['cancelFrame'];
  return {
    requestFrame(callback) { return requestFrame.call(value, callback); },
    cancelFrame(token) { cancelFrame.call(value, token); },
  };
}

export function createTicker(scheduler?: FrameScheduler): Canvas2DTicker {
  const clock = checkedScheduler(scheduler);
  const entries: { listener: TickListener; priority: number; order: number }[] = [];
  let nextOrder = 0;
  let frame = 0;
  let lastTime: number | null = null;
  let running = false;
  let disposed = false;
  let generation = 0;
  let hasPending = false;
  let pendingToken: unknown;

  function active(): void {
    if (disposed) throw new Canvas2DError('DISPOSED', 'ticker is disposed');
  }
  function halt(): void {
    if (!running) return;
    running = false;
    generation++;
    lastTime = null;
    if (hasPending) {
      hasPending = false;
      clock.cancelFrame(pendingToken);
    }
  }
  function deliver(timestampMS: number): void {
    if (typeof timestampMS !== 'number' || !Number.isFinite(timestampMS) || timestampMS < 0 ||
        Object.is(timestampMS, -0) || (lastTime !== null && timestampMS < lastTime)) {
      halt();
      invalid('ticker timestamp must be finite, non-negative and monotonic');
    }
    const elapsedMS = lastTime === null ? 0 : timestampMS - lastTime;
    lastTime = timestampMS;
    frame++;
    const info: TickInfo = Object.freeze({ frame, timestampMS, elapsedMS, deltaMS: Math.min(elapsedMS, 100) });
    const planned = [...entries].sort((a, b) => b.priority - a.priority || a.order - b.order);
    for (const entry of planned) {
      if (disposed) break;
      try { entry.listener(info); }
      catch (error) { if (!disposed) halt(); throw error; }
    }
    if (running && !hasPending) queue();
  }
  function queue(): void {
    const currentGeneration = generation;
    let scheduling = true;
    let called = false;
    try {
      const token = clock.requestFrame(timestampMS => {
        if (scheduling) {
          halt();
          invalid('ticker scheduler must defer its callback');
        }
        if (called || !running || currentGeneration !== generation) return;
        called = true;
        hasPending = false;
        deliver(timestampMS);
      });
      if (running && currentGeneration === generation) {
        pendingToken = token;
        hasPending = true;
      } else clock.cancelFrame(token);
    } catch (error) { halt(); throw error; }
    finally { scheduling = false; }
  }

  return Object.freeze({
    get running() { return running; },
    onTick(listener: TickListener, priority = 0): () => void {
      active();
      if (typeof listener !== 'function' || typeof priority !== 'number' ||
          !Number.isInteger(priority) || Object.is(priority, -0) || priority < -100 || priority > 100) {
        invalid('ticker listener or priority is invalid');
      }
      if (entries.length >= 128) throw new Canvas2DError('SCENE_LIMIT', 'ticker listener limit is 128');
      const entry = { listener, priority, order: nextOrder++ };
      entries.push(entry);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const index = entries.indexOf(entry);
        if (index >= 0) entries.splice(index, 1);
      };
    },
    start(): void {
      active();
      if (running) return;
      running = true;
      generation++;
      lastTime = null;
      queue();
    },
    stop(): void { active(); halt(); },
    dispose(): void {
      if (disposed) return;
      halt();
      disposed = true;
      entries.length = 0;
    },
  });
}
