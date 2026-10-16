import type { StudioDoc } from '../engine/doc';
import { faceKey } from './faces';
import type { FaceTable } from './mates';

/** Parts' mate faces from a worker, each part read once per change (by its nodes and parameters). */
export class FaceClient {
  private worker = new Worker(new URL('./faces.worker.ts', import.meta.url), { type: 'module' });
  private next = 1;
  private pending = new Map<number, (table: FaceTable) => void>();
  private cache = new Map<string, Promise<FaceTable>>();

  constructor() {
    this.worker.onmessage = (event: MessageEvent<{ id: number; table: FaceTable }>) => {
      this.pending.get(event.data.id)?.(event.data.table);
      this.pending.delete(event.data.id);
    };
  }

  table(doc: StudioDoc): Promise<FaceTable> {
    const key = faceKey(doc), have = this.cache.get(key);
    if (have) return have;
    const id = this.next++;
    const p = new Promise<FaceTable>(resolve => { this.pending.set(id, resolve); this.worker.postMessage({ id, doc: { ...doc, render: undefined, direct: undefined, instances: undefined } }); });
    if (this.cache.size > 32) this.cache.clear();
    this.cache.set(key, p);
    return p;
  }
}
