// Ops moved from the state they were made on to another one (O133). Two things in an op name features by where they
// were, not by what they are:
//   - feature ids the op sequence made itself (`n5`, a face `n5.top`, a body `b5`): handed out from the document's
//     next serial, so on another state the same calls hand out others;
//   - feature indices: `index` of edit_feature, delete_feature and the cage tools, and a node's references to earlier
//     ones (a sketch, a body, a gear's mate: engine/doc's index references, the ones `renumber` rewrites).
// Each is moved by identity: an index is the feature at that place in the source's order (its id), found by its id in
// the destination's order; an id the sequence made is the one the destination handed out in its place.
import type { ModelNode } from '../engine/doc';
import { renumber } from './features';
import type { Op } from './proposals';
import { CAGE_MUTATORS } from './cageTools';
import { isObj } from '../util/guards';

/** The tools whose `index` argument names a feature by its place. */
const INDEXED = new Set(['edit_feature', 'delete_feature', ...CAGE_MUTATORS]);
/** A feature id or body key in a string: `n12`, `n12.top`, `n12_p1`, `b12`, `b12_cut`. */
const TOKEN = /(?<![\w])([nb])(\d+)(?!\d)/g;

/** A value with every id the map moves renamed (in strings and in object keys): `n5` → `n7`, `n5.top` → `n7.top`, `b5` → `b7`. */
export function renameIds<T>(v: T, ids: ReadonlyMap<string, string>): T {
  if (!ids.size) return v;
  const str = (s: string) => s.replace(TOKEN, (all, kind: string, k: string) => { const to = ids.get(`n${k}`); return to ? `${kind}${to.slice(1)}` : all; });
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') return str(x);
    if (Array.isArray(x)) return x.map(walk);
    if (isObj(x)) { const out: Record<string, unknown> = {}; for (const [k, y] of Object.entries(x)) out[str(k)] = walk(y); return out; }
    return x;
  };
  return walk(v) as T;
}

/** Where an op was made and where it goes: each state's feature ids in order, and the ids moved between them. */
export interface Places { from: readonly string[]; to: readonly string[]; ids: ReadonlyMap<string, string> }
/** An index of the source as the destination's, or −1 with the id it named (gone there). */
function moveIndex(i: number, p: Places, missing: string[]): number {
  const id = p.from[i]; if (id === undefined) return i;
  const to = p.ids.get(id) ?? id, k = p.to.indexOf(to);
  if (k < 0) missing.push(to);
  return k;
}
/** A node's index references moved (`renumber`), and its ids renamed. */
export function moveNode(node: ModelNode, p: Places, missing: string[]): ModelNode {
  return renameIds(renumber(node, i => moveIndex(i, p, missing)), p.ids);
}

/**
 * An op moved to the destination: its ids renamed, its `index` and the index references of the nodes it brings
 * (add_features' features, edit_feature's feature) moved; the ops a batch or a proposal holds as the outer op's
 * (best effort: a batch's later op naming a feature an earlier one of it made is moved as the outer one is).
 * `missing`: the features it names that the destination no longer has.
 */
export function moveOp(op: Op, p: Places): { op: Op; missing: string[] } {
  const missing: string[] = [];
  return { op: renameIds(movedIndices(op, p, missing), p.ids), missing };
}
/** An op's indices moved (its ids are renamed after, once, for the op and the ops it holds). */
function movedIndices(op: Op, p: Places, missing: string[]): Op {
  const args: Record<string, unknown> = { ...(op.args ?? {}) };
  if (INDEXED.has(op.tool) && typeof args.index === 'number') args.index = moveIndex(args.index, p, missing);
  if (op.tool === 'add_features' && Array.isArray(args.features)) args.features = args.features.map(n => movedNode(n, p, missing));
  if (op.tool === 'edit_feature' && args.feature !== undefined) args.feature = movedNode(args.feature, p, missing);
  if ((op.tool === 'apply_ops' || op.tool === 'propose') && Array.isArray(args.ops)) args.ops = args.ops.map(o => isObj(o) && typeof o.tool === 'string' ? movedIndices(o as unknown as Op, p, missing) : o);
  return { ...op, args };
}
const movedNode = (n: unknown, p: Places, missing: string[]) => isObj(n) && typeof n.kind === 'string' ? renumber(n as unknown as ModelNode, i => moveIndex(i, p, missing)) : n;
