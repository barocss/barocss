// Mesh blobs (M1, R3.3): a mesh feature's arrays kept outside the document, by the SHA-256 of their bytes
// (WebCrypto, in the browser and Node alike). The document names them (`blob: {positions, indices}`), so it stays
// small whatever the mesh (undo copies, recovery, the worker's wire, chat); identical arrays are stored once
// (nodes, undo steps, pieces). Saved files carry them in the binary container (engine/container.ts); the
// recovery copy keeps them in IndexedDB. Blobs no holder reaches are evicted at idle points (PERF3 B13, O135):
// `evictBlobs` keeps what the roots name (the document, the undo and redo steps, each one's open proposals' ops and
// placed and pending parts), what is pinned (an operation not yet committed) and what was put since the last sweep
// (a grace generation: a holder not listed keeps its hash across one sweep, and is reported); the rest is dropped and
// the worker's wire told (`onBlobsEvicted`). A dropped blob asked for again is logged as an error: a missed holder.
import type { ModelNode, StudioDoc } from './doc';

export type BlobArray = Float64Array | Float32Array | Uint32Array | Int32Array | Uint8Array;
export type BlobType = 'f64' | 'f32' | 'u32' | 'i32' | 'u8';
export const blobTypeOf = (a: BlobArray): BlobType => a instanceof Float64Array ? 'f64' : a instanceof Float32Array ? 'f32' : a instanceof Int32Array ? 'i32' : a instanceof Uint8Array ? 'u8' : 'u32';
/** Positions at their own precision (D45): single precision when every value is one, else double. */
export function positionsArray(p: ArrayLike<number>): Float64Array | Float32Array {
  for (let i = 0; i < p.length; i++) if (Math.fround(p[i]) !== p[i]) return Float64Array.from(p);
  return Float32Array.from(p);
}

const store = new Map<string, BlobArray>();
/** Blobs put since the last sweep (each survives one sweep). */
const fresh = new Set<string>();
/** Blobs dropped by a sweep (the last ones, capped): one asked for again is a holder the sweep did not see. */
const evicted = new Set<string>();
const EVICTED_KEPT = 4096;
/** What eviction did this session (the studio shows it in DEV): sweeps, bytes freed (the last sweep's and in all), dropped hashes asked for again. */
export const blobStats = { sweeps: 0, lastFreed: 0, freed: 0, lastDropped: 0, evictedAsked: [] as string[] };
const keep = (h: string, a: BlobArray) => { if (!store.has(h)) { store.set(h, a); fresh.add(h); evicted.delete(h); } };

/** The SHA-256 of an array's bytes, hex. */
export async function sha256(a: BlobArray): Promise<string> {
  const view = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  // (WebCrypto takes a copy only when the view is not the whole buffer.)
  const bytes = view.byteOffset === 0 && view.byteLength === view.buffer.byteLength ? view : view.slice();
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
  let hex = ''; for (let i = 0; i < d.length; i++) hex += d[i].toString(16).padStart(2, '0');
  return hex;
}
/** Stores an array, returning its hash (the same array content, the same blob). */
export async function putBlob(a: BlobArray): Promise<string> {
  const h = await sha256(a);
  keep(h, a);
  return h;
}
/** Stores an array under a hash already known (read from a file and checked, or from the studio across a wire). */
export function putKnownBlob(hash: string, a: BlobArray): void { keep(hash, a); }
export function getBlob(hash: string): BlobArray | undefined {
  const a = store.get(hash);
  if (!a && evicted.has(hash)) {
    evicted.delete(hash); blobStats.evictedAsked.push(hash);
    // eslint-disable-next-line no-console -- the coordinator's rule (O135): a missed holder is an error to see
    console.error(`blob ${hash.slice(0, 12)}… was evicted and is asked for again: a holder the sweep did not see (engine/blobs.ts evictBlobs)`);
  }
  return a;
}
/** An array of the type over the bytes. */
export const arrayOf = (dtype: BlobType, buffer: ArrayBuffer): BlobArray => dtype === 'f64' ? new Float64Array(buffer) : dtype === 'f32' ? new Float32Array(buffer) : dtype === 'i32' ? new Int32Array(buffer) : dtype === 'u8' ? new Uint8Array(buffer) : new Uint32Array(buffer);
export const hasBlob = (hash: string): boolean => store.has(hash);

/** A mesh node (without inline arrays) with its arrays stored as blobs and named. */
export async function meshNodeBlobs<N extends object>(node: N, positions: ArrayLike<number>, indices: ArrayLike<number>): Promise<N & { blob: { positions: string; indices: string } }> {
  const [p, i] = await Promise.all([putBlob(positionsArray(positions)), putBlob(Uint32Array.from(indices))]);
  return { ...node, blob: { positions: p, indices: i } };
}

/**
 * Every blob a document names: its mesh nodes', its placed parts' and pending revisions', and the mesh nodes its open
 * proposals' ops bring (accepting one needs them, O135) — deduplicated.
 */
export function blobRefs(doc: StudioDoc, out = new Set<string>()): Set<string> {
  for (const n of doc.nodes) addRefs(n, out);
  for (const i of doc.instances ?? []) blobRefs(i.doc, out);
  for (const p of Object.values(doc.pendingParts ?? {})) blobRefs(p.doc, out);
  for (const p of doc.proposals ?? []) if (p.status === 'open') for (const op of p.ops) opRefs(op.args, out);
  return out;
}
/** The blobs mesh nodes anywhere in an op's arguments name (a feature added, a node replaced, a batch's ops). */
function opRefs(v: unknown, out: Set<string>): void {
  if (Array.isArray(v)) { for (const x of v) opRefs(x, out); return; }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  if (o.kind === 'mesh') addRefs(o as unknown as ModelNode, out);
  for (const x of Object.values(o)) if (x && typeof x === 'object') opRefs(x, out);
}
function addRefs(n: ModelNode, out: Set<string>): void {
  if (n.kind === 'mesh' && n.blob) { out.add(n.blob.positions); out.add(n.blob.indices); }
  // (A repair's result: its own blobs, the original kept beside them, D47.)
  if (n.kind === 'mesh' && n.repair) { out.add(n.repair.result.positions); out.add(n.repair.result.indices); out.add(n.repair.result.fill); }
}
// ---- Eviction (PERF3 B13, O135) ------------------------------------------------------------------------------------
const pins = new Map<string, number>();
let holds = 0;
const forgetters = new Set<(hashes: readonly string[]) => void>();
/** Keeps these blobs whatever the roots, until the returned release (an operation not committed yet: a repair's result). */
export function pinBlobs(hashes: Iterable<string>): () => void {
  const list = [...hashes];
  for (const h of list) pins.set(h, (pins.get(h) ?? 0) + 1);
  let done = false;
  return () => { if (done) return; done = true; for (const h of list) { const n = (pins.get(h) ?? 1) - 1; if (n > 0) pins.set(h, n); else pins.delete(h); } };
}
/** No sweep until the returned release (a chat turn running, a repair pending, the recovery store mid-write). */
export function holdSweeps(): () => void {
  holds++; let done = false;
  return () => { if (!done) { done = true; holds--; } };
}
/** Told the hashes each sweep drops (the worker's wire forgets them, so a blob put back is sent again). */
export function onBlobsEvicted(fn: (hashes: readonly string[]) => void): () => void { forgetters.add(fn); return () => { forgetters.delete(fn); }; }
export interface Sweep { kept: number; dropped: string[]; bytes: number; /** Put since the last sweep and reached by no root: kept this once (a holder not listed, or not committed yet). */ graced: string[] }
/**
 * One sweep: drops every blob no root reaches (`blobRefs`), none pinned and none put since the last sweep; null while a
 * sweep is held. The roots: the document, every undo and redo step.
 */
export function evictBlobs(roots: Iterable<StudioDoc>, pinned: Iterable<string> = []): Sweep | null {
  if (holds > 0) return null;
  const reach = new Set<string>();
  for (const d of roots) blobRefs(d, reach);
  for (const h of pinned) reach.add(h);
  for (const h of pins.keys()) reach.add(h);
  const dropped: string[] = [], graced: string[] = [];
  let bytes = 0;
  for (const [h, a] of store) {
    if (reach.has(h)) continue;
    if (fresh.has(h)) { graced.push(h); continue; }
    store.delete(h); dropped.push(h); bytes += a.byteLength; evicted.add(h);
  }
  if (evicted.size > EVICTED_KEPT) { let n = evicted.size - EVICTED_KEPT; for (const h of evicted) { if (n-- <= 0) break; evicted.delete(h); } }
  fresh.clear();
  blobStats.sweeps++; blobStats.lastFreed = bytes; blobStats.freed += bytes; blobStats.lastDropped = dropped.length;
  if (dropped.length) for (const fn of forgetters) fn(dropped);
  return { kept: store.size, dropped, bytes, graced };
}
/** Forgets these blobs here (the worker's side of a sweep, told by the wire). */
export function dropBlobs(hashes: readonly string[]): void { for (const h of hashes) { store.delete(h); fresh.delete(h); } }

/** The hashes named but not in the store (a file or recovery copy missing them). */
export const missingBlobs = (doc: StudioDoc): string[] => [...blobRefs(doc)].filter(h => !store.has(h));

/**
 * The document with every blob written back inline as plain arrays (for what must stand alone: templates kept in
 * localStorage). Null when a blob is missing.
 */
export function inlineMeshes(doc: StudioDoc): StudioDoc | null {
  let ok = true;
  const node = (n: ModelNode): ModelNode => {
    if (n.kind !== 'mesh' || !n.blob) return n;
    const p = store.get(n.blob.positions), i = store.get(n.blob.indices);
    if (!p || !i) { ok = false; return n; }
    const rest = { ...n, positions: Array.from(p), indices: Array.from(i) };
    delete rest.blob;
    return rest;
  };
  const walk = (d: StudioDoc): StudioDoc => ({ ...d, nodes: d.nodes.map(node), ...(d.instances ? { instances: d.instances.map(i => ({ ...i, doc: walk(i.doc) })) } : {}),
    ...(d.pendingParts ? { pendingParts: Object.fromEntries(Object.entries(d.pendingParts).map(([k, p]) => [k, { ...p, doc: walk(p.doc) }])) } : {}) });
  const out = walk(doc);
  return ok ? out : null;
}

// ---- The recovery copy's blobs, in the store the app sets (PKG-g2, O99) -------------------------------------------
/**
 * Where the recovery copy's blobs are kept between sessions: an async key-value store of typed arrays by hash (the
 * studio's is IndexedDB, `ui/blobStore.ts`). The model names no browser storage; with none set (a test, the CLI, the
 * servers) nothing is kept and nothing is found.
 */
export interface BlobStore {
  /** The hashes kept. */
  keys(): Promise<Set<string>>;
  /** Those of `hashes` kept, by hash. */
  get(hashes: readonly string[]): Promise<Map<string, { type: BlobType; data: BlobArray }>>;
  /** Keeps these; false when it would not (private mode, quota). */
  put(entries: readonly { hash: string; type: BlobType; data: BlobArray }[]): Promise<boolean>;
  /** Forgets these. */
  delete(hashes: readonly string[]): Promise<void>;
}
let recovery: BlobStore | null = null;
/** The app sets the store the recovery copy's blobs are kept in (null: none). */
export function setBlobStore(s: BlobStore | null): void { recovery = s; }
/** Writes the document's blobs that the store does not have yet; false when it would not (none set, private mode, quota). */
export async function saveRecoveryBlobs(doc: StudioDoc): Promise<boolean> {
  const refs = [...blobRefs(doc)]; if (!refs.length) return true;
  if (!recovery) return false;
  // (No sweep while the recovery store is written: it reads the blobs as it goes.)
  const release = holdSweeps();
  try {
    const have = await recovery.keys(), entries: { hash: string; type: BlobType; data: BlobArray }[] = [];
    for (const h of refs) { const a = store.get(h); if (a && !have.has(h)) entries.push({ hash: h, type: blobTypeOf(a), data: a }); }
    return entries.length ? await recovery.put(entries) : true;
  } catch { return false; } finally { release(); }
}
/** Loads the blobs a recovered document names into the store; the hashes still missing. */
export async function loadRecoveryBlobs(doc: StudioDoc): Promise<string[]> {
  const need = missingBlobs(doc); if (!need.length) return [];
  if (!recovery) return need;
  try {
    for (const [h, v] of await recovery.get(need)) putKnownBlob(h, v.data);
    return missingBlobs(doc);
  } catch { return need; }
}
/** Deletes every kept blob the document does not name (after a save: the recovery copy is gone). */
export async function collectRecoveryBlobs(keep: StudioDoc | null): Promise<void> {
  if (!recovery) return;
  try {
    const live = keep ? blobRefs(keep) : new Set<string>(), gone = [...await recovery.keys()].filter(h => !live.has(h));
    if (gone.length) await recovery.delete(gone);
  } catch { /* storage unavailable */ }
}

// ---- Over JSON (the chat server's turn): blobs as base64, beside the document ------------------------------------
export type WireBlobs = Record<string, { dtype: BlobType; base64: string }>;
/** The document's blobs (or just those of `only`) as base64 (for a JSON request). */
export function blobsAsBase64(doc: StudioDoc, only?: readonly string[]): WireBlobs {
  const out: WireBlobs = {};
  for (const h of only ?? blobRefs(doc)) {
    const a = store.get(h); if (!a) continue;
    const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out[h] = { dtype: blobTypeOf(a), base64: btoa(bin) };
  }
  return out;
}
/** Blobs read from base64 into the store, each checked against its hash; the hashes refused. */
export async function blobsFromBase64(blobs: WireBlobs): Promise<string[]> {
  const bad: string[] = [];
  for (const [h, b] of Object.entries(blobs)) {
    const bin = atob(b.base64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const a = arrayOf(b.dtype, bytes.buffer);
    if (await sha256(a) !== h) { bad.push(h); continue; }
    putKnownBlob(h, a);
  }
  return bad;
}
