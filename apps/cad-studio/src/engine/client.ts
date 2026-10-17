import type { EvalResult } from './evaluate';
import type { StudioDoc } from './doc';
import type { DrawingResult } from '../drawing/project';
import { WireSender } from './wireDoc';

/** One worker; the newest evaluation wins and stale replies are dropped. */
export class EngineClient {
  private worker!: Worker;
  private next = 1;
  private pending = new Map<number, (data: unknown) => void>();
  private latestEval = 0;
  /** Every request's document goes through this, in the order the worker receives them. */
  private wire = new WireSender();

  constructor() { this.start(); }
  private start() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<{ id: number }>) => {
      const resolve = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      resolve?.(event.data);
    };
  }
  /**
   * Stops whatever the worker is computing (a long Boolean on a mesh, D42): the worker is ended and a new one
   * started (its caches empty); every request waiting gets a refusal ("Stopped").
   */
  restart(): void {
    this.worker.terminate();
    const error = { title: 'Stopped', hint: 'The computation was stopped.', detail: '' };
    const cancelled = { result: { ok: false, revision: 0, error, ms: 0 }, step: { error: 'cancelled' }, drawing: { ok: false, error }, bytes: null };
    for (const resolve of this.pending.values()) resolve(cancelled);
    this.pending.clear(); this.latestEval = 0; this.wire = new WireSender();
    this.start();
  }

  evaluate(doc: StudioDoc, revision: number): Promise<EvalResult | null> {
    const id = this.next++; this.latestEval = id;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve(id === this.latestEval ? (data as { result: EvalResult }).result : null));
      this.worker.postMessage({ type: 'evaluate', id, doc: this.wire.pack(doc), revision });
    });
  }

  /** A command's preview (its own cache, no mass properties): never dropped as stale. */
  preview(doc: StudioDoc, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.worker.postMessage({ type: 'preview', id, doc: this.wire.pack(doc), revision });
    });
  }

  /** The section view's split part (a cache of its own, so dragging the plane leaves a command's preview alone). */
  section(doc: StudioDoc, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.worker.postMessage({ type: 'section', id, doc: this.wire.pack(doc), revision });
    });
  }

  /** Another part on its own (an instance): never dropped as stale. */
  part(doc: StudioDoc, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.worker.postMessage({ type: 'part', id, doc: this.wire.pack(doc), revision });
    });
  }

  /** A placed part's display bodies (copies of one part share its tessellation): never dropped as stale. */
  placed(doc: StudioDoc, base: StudioDoc, place: { m: number[]; t: [number, number, number] }, revision: number): Promise<EvalResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { result: EvalResult }).result));
      this.worker.postMessage({ type: 'placed', id, doc: this.wire.pack(doc), base: this.wire.pack(base), place, revision });
    });
  }

  step(doc: StudioDoc, name: string): Promise<{ text: string } | { error: string }> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { step: { text: string } | { error: string } }).step));
      this.worker.postMessage({ type: 'step', id, doc: this.wire.pack(doc), name });
    });
  }

  /** The part's drawing views (hidden-line projections), never dropped as stale. */
  drawing(doc: StudioDoc, options: { tangentEdges?: boolean; section?: { y: number } } = {}): Promise<DrawingResult> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { drawing: DrawingResult }).drawing));
      this.worker.postMessage({ type: 'drawing', id, doc: this.wire.pack(doc), options });
    });
  }

  stl(doc: StudioDoc, key: string): Promise<Uint8Array | null> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { bytes: Uint8Array | null }).bytes));
      this.worker.postMessage({ type: 'stl', id, doc: this.wire.pack(doc), key });
    });
  }
}
