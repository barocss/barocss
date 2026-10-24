// CG6 (DA-2): a document's features in "id form" — each node's references to earlier nodes by index (engine/doc's
// BodyRef.node, a sketch, a gear's mate …: the ones chat/features' `renumber` rewrites) replaced by the serial of the
// feature they name. Two states of a part then compare feature by feature: inserting a feature early in the tree moves
// every later index, but no id. Compare and merge work in this form and turn back with `indexForm`.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { featureId, serialOf, withIds } from '../engine/ids';
import { renumber } from '../chat/features';
import { canonical } from '../util/revision';

/** A reference past the document's nodes, kept recognisable in id form (never a serial: serials are ≥ 0). */
const outside = (i: number) => -1 - i;

export interface IdForm {
  /** The feature ids in tree order. */
  order: string[];
  /** Each feature's node in id form, by id. */
  nodes: Map<string, ModelNode>;
}

/** The document's features in id form (the document given ids first, as every evaluation does). */
export function idFormOf(doc: Pick<StudioDoc, 'nodes' | 'nextId'>): IdForm {
  const nodes = withIds(doc).nodes, order = nodes.map((_, i) => featureId(nodes, i));
  const toSerial = (i: number) => i >= 0 && i < nodes.length ? serialOf(order[i]) : outside(i);
  return { order, nodes: new Map(nodes.map((n, i) => [order[i], renumber(n, toSerial)])) };
}

/** The serials a node (in id form) names by index. */
export function serialRefsOf(node: ModelNode): number[] {
  const out: number[] = [];
  renumber(node, s => { out.push(s); return s; });
  return out;
}
/** The feature ids a node names by persistent name (`n5.top`, `n2.side0|n3.top`): any string token `n<k>.`. */
const NAMED = /(?<![\w])n(\d+)(?:_p\d+)?\./g;
export function namedIdsOf(node: unknown): string[] {
  const out = new Set<string>();
  const walk = (x: unknown): void => {
    if (typeof x === 'string') { for (const m of x.matchAll(NAMED)) out.add(`n${m[1]}`); return; }
    if (Array.isArray(x)) { for (const y of x) walk(y); return; }
    if (x && typeof x === 'object') for (const y of Object.values(x)) walk(y);
  };
  walk(node);
  return [...out];
}

/** Nodes in id form, in the order given, back to index form; `missing`: the serials named that are not in the order. */
export function indexForm(order: readonly string[], nodes: ReadonlyMap<string, ModelNode>): { nodes: ModelNode[]; missing: number[] } {
  const at = new Map(order.map((id, i) => [serialOf(id), i])), missing: number[] = [];
  const toIndex = (s: number) => { if (s < 0) return -1 - s; const i = at.get(s); if (i === undefined) { missing.push(s); return -1; } return i; };
  return { nodes: order.map(id => renumber(nodes.get(id)!, toIndex)), missing };
}

/** A node's content as compared (`sigs` left out: the stored signatures of the faces it names follow their geometry). */
export const nodeKey = (node: ModelNode): string => canonical(withoutSigs(node));
/** A node without its stored signatures. */
export function withoutSigs(node: ModelNode): Record<string, unknown> {
  const out: Record<string, unknown> = { ...node };
  delete out.sigs;
  return out;
}
