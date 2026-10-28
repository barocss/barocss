// Stable feature ids (A1): every node carries `id`, `n<k>` with k a serial the document hands out once and
// never again (`StudioDoc.nextId`). The kernel feature is that id, so a face is `n3.top` for as long as the
// feature that made it lives: deleting, moving or inserting other features renames nothing. A document built
// by appending numbers its features as they come (node i is `n<i>`), so its names read as they always did; a
// node without an id (an older file, a hand-built document) is given one by `withIds`.
import type { ModelNode, StudioDoc } from './doc';

/** A node's feature id (its `id`; one without reads as its index, `n<i>`). */
export const featureId = (nodes: readonly ModelNode[], index: number): string => nodes[index]?.id ?? `n${index}`;

const serial = (id: string | undefined): number => { const m = /^n(\d+)$/.exec(id ?? ''); return m ? Number(m[1]) : -1; };

/** The next serial a document hands out: past every id it has, and never below what it handed out before. */
export function nextSerial(doc: Pick<StudioDoc, 'nodes' | 'nextId'>): number {
  let next = Math.max(doc.nextId ?? 0, doc.nodes.length);
  for (const n of doc.nodes) next = Math.max(next, serial(n.id) + 1);
  return next;
}

/**
 * The document with an id on every node (the same object when each has one). A node without one takes `n<i>`
 * (its index) when no node has it and it was never handed out (i ≥ `nextId`), so a document built by appending
 * — or an older file — reads as it always did; otherwise the next serial. `nextId` is kept past every id.
 */
export function withIds<T extends Pick<StudioDoc, 'nodes' | 'nextId'>>(doc: T): T {
  let missing = false;
  for (const n of doc.nodes) if (n.id === undefined) { missing = true; break; }
  if (!missing) { const next0 = nextSerial(doc); return doc.nextId === next0 ? doc : { ...doc, nextId: next0 }; }
  const used = new Set(doc.nodes.flatMap(n => n.id === undefined ? [] : [n.id])), floor = doc.nextId ?? 0;
  let next = floor; for (const id of used) next = Math.max(next, serial(id) + 1);
  const nodes = doc.nodes.map((n, i) => {
    if (n.id !== undefined) return n;
    let id = `n${i}`;
    if (i < floor || used.has(id)) { while (used.has(`n${next}`)) next++; id = `n${next++}`; }
    used.add(id);
    return { ...n, id };
  });
  return { ...doc, nodes, nextId: nextSerial({ nodes, nextId: next }) };
}

const indexCache = new WeakMap<readonly ModelNode[], Map<string, number>>();
const TEXT_INTERNAL = /^(.+)_g(0|[1-9]\d*)_c(0|[1-9]\d*)_(sketch|extrude|union)$/;
function textOwner(id: string): string | null { return TEXT_INTERNAL.exec(id)?.[1] ?? null; }
function textInternalOwner(node: ModelNode, id: string): boolean {
  return node.kind === 'text' || node.kind === 'text-relief' && TEXT_INTERNAL.exec(id)?.[4] === 'sketch';
}

/** The authored node of an exact id, a patterned hole, or a strictly formed text component id. */
export function nodeIndexOf(nodes: readonly ModelNode[], id: string): number {
  let map = indexCache.get(nodes);
  if (!map) { map = new Map(nodes.map((_, i) => [featureId(nodes, i), i])); indexCache.set(nodes, map); }
  const direct = map.get(id) ?? map.get(id.replace(/_p\d+$/, ''));
  if (direct !== undefined) return direct;
  const owner = textOwner(id), index = owner === null ? undefined : map.get(owner);
  return index !== undefined && textInternalOwner(nodes[index], id) ? index : -1;
}

/**
 * The feature ids a persistent name is made from: a face `n3.top#2`, an edge `n2.side0|n1.top`, a mesh face's
 * merged names `n1.top+n2.cap`. (Not a mate's origin plane `origin:xy`: it has no `.`.)
 */
export function featureIdsOf(name: string): string[] {
  const out: string[] = [];
  for (const part of name.split(/[|+]/)) { const dot = part.indexOf('.'); if (dot > 0) out.push(part.slice(0, dot)); }
  return out;
}
/** The node indices a persistent name comes from (those still in `nodes`). */
export function nodesOfName(nodes: readonly ModelNode[], name: string): number[] {
  return featureIdsOf(name).map(id => nodeIndexOf(nodes, id)).filter(i => i >= 0);
}
/** A persistent name with its feature ids replaced (`rename` returns the new id, or the same). */
export function renameFeatureIds(name: string, rename: (id: string) => string): string {
  return name.split(/([|+])/).map(part => { const dot = part.indexOf('.'); return dot > 0 ? rename(part.slice(0, dot)) + part.slice(dot) : part; }).join('');
}
/** Existing names retain their meaning; generated text ownership additionally needs the actual node context. */
export function fromFeature(name: string, id: string, nodes?: readonly ModelNode[]): boolean {
  for (const feature of featureIdsOf(name)) {
    if (feature === id || feature.replace(/_p\d+$/, '') === id) return true;
    if (!nodes || textOwner(feature) !== id) continue;
    const owner = nodeIndexOf(nodes, id);
    if (owner >= 0 && textInternalOwner(nodes[owner], feature) && nodeIndexOf(nodes, feature) === owner) return true;
  }
  return false;
}
/** Whether a face (by its name) is a cut face of a split with serial `from` or later (a section's splits). */
export function cutAfter(name: string, from: number): boolean {
  for (const part of name.split('+')) { const m = /^n(\d+)\.cut/.exec(part); if (m && Number(m[1]) >= from) return true; }
  return false;
}

// Body keys (A1.1b): a body is keyed by the serial of the feature that produced it, `b<k>` for node `n<k>`
// (`b<k>_<side>` for a split's halves, `b<k>_part<j>` for an import's or a separation's solids), so looks,
// materials and animation tracks stay with it as features come and go. A document built by appending has
// node i = n<i>, so its keys read as they always did.
/** The serial of a feature id `n<k>` (−1 for anything else). */
export const serialOf = (id: string): number => serial(id);
/** The key of the body node `index` makes (`side`: 'solid', or a split's or an import's part). */
export const bodyKeyFor = (nodes: readonly ModelNode[], index: number, side = 'solid'): string => {
  const k = serial(featureId(nodes, index)), at = k >= 0 ? `b${k}` : `b${featureId(nodes, index)}`;
  return side === 'solid' ? at : `${at}_${side}`;
};
/** The node and side a body key names (null when no node has it). */
export function bodyNodeOf(nodes: readonly ModelNode[], key: string): { node: number; side: string } | null {
  const m = /^b(\d+)(?:_(.+))?$/.exec(key); if (!m) return null;
  const node = nodeIndexOf(nodes, `n${m[1]}`);
  return node < 0 ? null : { node, side: m[2] ?? 'solid' };
}
