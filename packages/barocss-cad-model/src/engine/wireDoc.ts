// The document as the engine worker sees it: what evaluation reads (parameters, nodes, outputs and the
// placed instances, and the section library (FRc) — not render, drawing, direct geometry, looks, mates or pending revisions), with its
// nodes sent by id. Nodes are immutable (an edit makes a new object), so each node object crosses to
// the worker once; later requests name it. Both sides keep the same table and forget, at the same
// request, the nodes no request has named for a while (they process the requests in one order).
import type { ModelNode, PartInstance, StudioDoc } from './doc';
import { blobRefs, dropBlobs, getBlob, onBlobsEvicted, putKnownBlob, type BlobArray } from './blobs';

export interface WireDoc {
  doc: Omit<StudioDoc, 'nodes'> & { nodes: [] };
  /** The nodes, by id. */
  ids: number[];
  /** Nodes the worker does not have yet. */
  added: [number, ModelNode][];
  /** Mesh blobs the worker does not have yet (M1): hash and array, each sent once (a copy; the store keeps its own). */
  blobs?: [string, BlobArray][];
  /** Blobs a sweep dropped here (PERF3 B13, O135): the worker drops them too, in step. */
  dropped?: string[];
}

/** Requests between prunes, and how many requests a node may go unnamed before it is forgotten. */
const PRUNE_EVERY = 64, KEEP_FOR = 256;

/** What evaluation reads of a document (an instance's part likewise). */
export function evaluatedPart(doc: StudioDoc): StudioDoc {
  const out: StudioDoc = { format: doc.format, schema: doc.schema, units: doc.units, parameters: doc.parameters, nodes: doc.nodes, outputs: doc.outputs };
  if (doc.instances?.length) out.instances = doc.instances.map(stripInstance);
  // (FRc, O117: the section library a frame's section may name is model input; the rest of `frames` is not.)
  if (doc.frames?.sections?.length) out.frames = { version: 1, sections: doc.frames.sections };
  // (R12c.2, D155: the fits are evaluated with the part — their limits in the notes, a miss or a contradicted pair a refusal.)
  if (doc.fits?.faces?.length) out.fits = doc.fits;
  // (R12c.4, D158: a bearing's row and its seats' classes are model input.)
  if (doc.bearings?.rows.length) { out.bearings = doc.bearings; if (doc.fits) out.fits = doc.fits; }
  // (R12c.5, D159: a gland's O-ring row.)
  if (doc.orings?.rows.length) { out.orings = doc.orings; if (doc.fits) out.fits = doc.fits; }
  // (O139: a retaining ring's row.)
  if (doc.rings?.rows.length) out.rings = doc.rings;
  // (R12c.6b, D161: a wheel's, a belt's or a coupling's drive row.)
  if (doc.drives?.rows.length) out.drives = doc.drives;
  return out;
}
const stripInstance = (i: PartInstance): PartInstance => ({ ...i, doc: evaluatedPart(i.doc) });

/** The client's side: node objects to ids, and when each was last named. */
export class WireSender {
  private ids = new Map<ModelNode, number>();
  private used = new Map<number, { node: ModelNode; at: number }>();
  private next = 1;
  private seq = 0;
  private sentBlobs = new Set<string>();
  /** Dropped by a sweep since the last pack: forgotten as sent (a blob put back is sent again), and told the worker. */
  private dropped: string[] = [];
  constructor() { onBlobsEvicted(h => this.forget(h)); }
  /** These blobs are gone from the store: not sent any more, and the worker told with the next document. */
  forget(hashes: readonly string[]): void { for (const h of hashes) if (this.sentBlobs.delete(h)) this.dropped.push(h); }
  pack(doc: StudioDoc): WireDoc {
    const seq = ++this.seq, ids: number[] = [], added: [number, ModelNode][] = [];
    for (const node of doc.nodes) {
      let id = this.ids.get(node);
      if (id === undefined) { id = this.next++; this.ids.set(node, id); added.push([id, node]); }
      this.used.set(id, { node, at: seq }); ids.push(id);
    }
    if (seq % PRUNE_EVERY === 0) for (const [id, u] of this.used) if (u.at < seq - KEEP_FOR) { this.used.delete(id); this.ids.delete(u.node); }
    const blobs: [string, BlobArray][] = [];
    for (const h of blobRefs(doc)) { const a = getBlob(h); if (a && !this.sentBlobs.has(h)) { this.sentBlobs.add(h); blobs.push([h, a]); } }
    const dropped = this.dropped.filter(h => !this.sentBlobs.has(h)); this.dropped = [];
    return { doc: { ...evaluatedPart(doc), nodes: [] }, ids, added, ...(blobs.length ? { blobs } : {}), ...(dropped.length ? { dropped } : {}) };
  }
}

/** The worker's side: ids to nodes, forgotten by the same rule. */
export class WireReceiver {
  private nodes = new Map<number, { node: ModelNode; at: number }>();
  private seq = 0;
  unpack(w: WireDoc): StudioDoc {
    const seq = ++this.seq;
    if (w.dropped) dropBlobs(w.dropped);
    for (const [h, a] of w.blobs ?? []) putKnownBlob(h, a);
    for (const [id, node] of w.added) this.nodes.set(id, { node, at: seq });
    const nodes: ModelNode[] = [];
    for (const id of w.ids) {
      const e = this.nodes.get(id);
      if (!e) throw new Error(`engine worker: node ${id} was never sent`);
      e.at = seq; nodes.push(e.node);
    }
    if (seq % PRUNE_EVERY === 0) for (const [id, e] of this.nodes) if (e.at < seq - KEEP_FOR) this.nodes.delete(id);
    return { ...w.doc, nodes };
  }
}
