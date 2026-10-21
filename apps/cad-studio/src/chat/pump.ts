// PERF3 A3 (D82): an agent's turn sends the part after every tool that changed it; each one evaluated for the preview
// would queue evaluations the next state makes stale. One runs at a time; a state arriving meanwhile replaces the one
// waiting (latest wins), so a burst of states costs at most two evaluations.
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';

export interface LatestPump<T> { push(value: T): void; close(): void }
interface PumpState<T, R> { run: (v: T) => Promise<R>; done: (r: R, v: T) => void; busy: boolean; waiting: { v: T } | null; closed: boolean }

export function latestPump<T, R>(run: (v: T) => Promise<R>, done: (r: R, v: T) => void): LatestPump<T> {
  const p: PumpState<T, R> = { run, done, busy: false, waiting: null, closed: false };
  return { push: v => { if (p.closed) return; p.waiting = { v }; if (!p.busy) void drain(p); }, close: () => { p.closed = true; p.waiting = null; } };
}
async function drain<T, R>(p: PumpState<T, R>) {
  p.busy = true;
  while (p.waiting && !p.closed) {
    const { v } = p.waiting; p.waiting = null;
    let r: R; try { r = await p.run(v); } catch { continue; }
    // (A result already superseded by a waiting state is dropped.)
    if (!p.closed && !p.waiting) p.done(r, v);
  }
  p.busy = false;
}

// A node's JSON, once per object.
const json = new WeakMap<ModelNode, string>();
function jsonOf(n: ModelNode): string { let s = json.get(n); if (s === undefined) { s = JSON.stringify(n); json.set(n, s); } return s; }
/**
 * The document with every node equal to one of `before`'s (same place, or anywhere) replaced by that object: a part
 * read from JSON shares what did not change, so the engine's wire sends and its chain re-evaluates only the rest.
 */
export function reshareNodes(before: StudioDoc, doc: StudioDoc): StudioDoc {
  let byJson: Map<string, ModelNode> | null = null, changed = false;
  const nodes = doc.nodes.map((n, i) => {
    const same = before.nodes[i], s = jsonOf(n);
    if (same && same !== n && jsonOf(same) === s) { changed = true; return same; }
    if (same === n) return n;
    byJson ??= new Map(before.nodes.map(b => [jsonOf(b), b]));
    const found = byJson.get(s);
    if (found) { changed = true; return found; }
    return n;
  });
  return changed ? { ...doc, nodes } : doc;
}
