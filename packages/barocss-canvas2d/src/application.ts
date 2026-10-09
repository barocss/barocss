import { createCanvas2D } from './renderer.js';
import type { Canvas2DOptions, Canvas2DRenderer } from './renderer.js';
import { createDisplayTree } from './display-tree.js';
import type { DisplayTree } from './display-tree.js';
import { createTicker } from './ticker.js';
import type { Canvas2DTicker, FrameScheduler, TickListener } from './ticker.js';
import { Canvas2DError } from './schema.js';

export type Canvas2DApplicationOptions = {
  contextId: string;
  renderer: Canvas2DOptions;
  scheduler?: FrameScheduler;
  autoStart?: boolean;
};

export type Canvas2DApplication = {
  readonly renderer: Canvas2DRenderer;
  readonly tree: DisplayTree;
  readonly ticker: Canvas2DTicker;
  readonly running: boolean;
  onUpdate(listener: TickListener, priority?: number): () => void;
  start(): void;
  stop(): void;
  render(): void;
  dispose(): void;
};

function invalid(message: string): never {
  throw new Canvas2DError('INVALID_SCENE', message);
}

function checkedOptions(value: Canvas2DApplicationOptions): Canvas2DApplicationOptions {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    invalid('application options must be a plain record');
  }
  const keys = Reflect.ownKeys(value);
  const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
  if (!Object.hasOwn(value, 'contextId') || !Object.hasOwn(value, 'renderer') ||
      keys.some(key => typeof key !== 'string' ||
        !['contextId', 'renderer', 'scheduler', 'autoStart'].includes(key) ||
        !descriptors[key]?.enumerable || !('value' in descriptors[key]))) {
    invalid('application options have unknown, missing or accessor fields');
  }
  if (Object.hasOwn(value, 'autoStart') && typeof descriptors.autoStart.value !== 'boolean') {
    invalid('application autoStart must be a boolean');
  }
  return {
    contextId: descriptors.contextId.value,
    renderer: descriptors.renderer.value,
    scheduler: descriptors.scheduler?.value,
    autoStart: descriptors.autoStart?.value ?? false,
  };
}

/** Owns a renderer, tree and ticker. Normal updates precede one automatic render. */
export function createCanvas2DApplication(canvas: HTMLCanvasElement,
  options: Canvas2DApplicationOptions): Canvas2DApplication {
  const admitted = checkedOptions(options);
  const tree = createDisplayTree(admitted.contextId);
  const ticker = createTicker(admitted.scheduler);
  let renderer: Canvas2DRenderer | null = null;
  let disposed = false;
  let updateDepth = 0;
  const subscriptions = new Set<() => void>();
  let unsubscribeRender: (() => void) | null = null;

  function active(): void {
    if (disposed) throw new Canvas2DError('DISPOSED', 'application is disposed');
  }
  function submit(): void {
    active();
    renderer!.updateScene(tree.snapshot());
    renderer!.render();
  }
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    const failures: unknown[] = [];
    function attempt(action: () => void): boolean {
      try { action(); return true; }
      catch (error) { if (failures.length === 0) failures.push(error); return false; }
    }
    for (const unsubscribe of [...subscriptions]) attempt(unsubscribe);
    if (unsubscribeRender) attempt(unsubscribeRender);
    // A throwing host cancellation has already halted the ticker. Retry once to
    // complete its disposed flag/listener cleanup without a second cancellation.
    if (!attempt(() => ticker.dispose())) attempt(() => ticker.dispose());
    if (renderer) attempt(() => renderer!.dispose());
    if (failures.length !== 0) throw failures[0];
  }

  try {
    renderer = createCanvas2D(canvas, admitted.renderer);
    unsubscribeRender = ticker.onTick(() => submit(), -100);
    const application: Canvas2DApplication = Object.freeze({
      renderer,
      tree,
      ticker,
      get running() { return !disposed && ticker.running; },
      onUpdate(listener: TickListener, priority = 0): () => void {
        active();
        if (typeof listener !== 'function' || !Number.isInteger(priority) ||
            Object.is(priority, -0) || priority < -99 || priority > 100) {
          invalid('application update listener or priority is invalid');
        }
        const unsubscribeTick = ticker.onTick(info => {
          updateDepth++;
          try { listener(info); }
          finally { updateDepth--; }
        }, priority);
        const unsubscribe = () => {
          unsubscribeTick();
          subscriptions.delete(unsubscribe);
        };
        subscriptions.add(unsubscribe);
        return unsubscribe;
      },
      start(): void { active(); ticker.start(); },
      stop(): void { active(); ticker.stop(); },
      render(): void {
        active();
        if (updateDepth !== 0) invalid('application render is unavailable inside an update callback');
        submit();
      },
      dispose,
    });
    if (admitted.autoStart) application.start();
    return application;
  } catch (error) {
    try { dispose(); } catch { /* Preserve the original construction failure. */ }
    throw error;
  }
}
