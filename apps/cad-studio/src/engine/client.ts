import type { EvalResult } from './evaluate';
import type { StudioDoc } from './doc';

/** One worker; the newest evaluation wins and stale replies are dropped. */
export class EngineClient {
  private worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  private next = 1;
  private pending = new Map<number, (data: unknown) => void>();
  private latestEval = 0;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number }>) => {
      const resolve = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      resolve?.(event.data);
    };
  }

  evaluate(doc: StudioDoc, revision: number): Promise<EvalResult | null> {
    const id = this.next++; this.latestEval = id;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve(id === this.latestEval ? (data as { result: EvalResult }).result : null));
      this.worker.postMessage({ type: 'evaluate', id, doc, revision });
    });
  }

  stl(doc: StudioDoc, key: string): Promise<Uint8Array | null> {
    const id = this.next++;
    return new Promise(resolve => {
      this.pending.set(id, data => resolve((data as { bytes: Uint8Array | null }).bytes));
      this.worker.postMessage({ type: 'stl', id, doc, key });
    });
  }
}
