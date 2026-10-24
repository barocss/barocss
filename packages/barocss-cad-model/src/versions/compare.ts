// CG6 (DA-2): what changed from one document to another, as data — for a version compare. Features by their stable
// ids in id form (versions/idForm.ts), so a feature inserted early does not show every later one as edited; parameters
// and configurations by name; mates, placed parts and the other listed records by id; every other field by name. The
// geometry's difference is the worker's (chat/proposalDiff.ts), shown in the viewport.
import type { ModelNode, StudioDoc } from '../engine/doc';
import { canonical } from '../util/revision';
import { idFormOf, nodeKey, withoutSigs } from './idForm';

export type ChangeKind = 'added' | 'removed' | 'edited';
/** A value at a path that differs (`from` absent: added; `to` absent: removed). */
export interface FieldChange { path: string; from?: unknown; to?: unknown }
export interface FeatureChange {
  id: string;
  kind: ChangeKind | 'moved';
  /** The feature's kind (extrude, fillet …), from the side that has it. */
  feature: string;
  /** Edited: the fields that differ (index references compared as the ids they name). */
  fields?: FieldChange[];
}
export interface ValueChange { name: string; kind: ChangeKind; from?: unknown; to?: unknown }
export interface ItemChange { id: string; kind: ChangeKind; fields?: FieldChange[] }
export interface DocChanges {
  /** Whether the documents are the same, field for field. */
  same: boolean;
  features: FeatureChange[];
  parameters: ValueChange[];
  configurations: ValueChange[];
  mates: ItemChange[];
  instances: ItemChange[];
  /** Every other field that differs, by name. */
  fields: string[];
}

/** The fields compared on their own (the rest are listed by name); `outputs` and `nextId` follow from the nodes. */
const OWN = new Set(['nodes', 'outputs', 'nextId', 'parameters', 'configurations', 'mates', 'instances']);
const KEYED_LISTS = ['mates', 'instances'] as const;
/** The deepest a field's difference is followed before the value is given whole. */
const DEPTH = 4;

const isPlain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x) && !ArrayBuffer.isView(x);
/** Where two values differ, path by path (arrays of different lengths, and values past the depth, given whole). */
export function fieldChanges(a: unknown, b: unknown, path = '', depth = 0, out: FieldChange[] = []): FieldChange[] {
  if (canonical(a ?? null) === canonical(b ?? null)) return out;
  const at = (k: string | number) => path ? `${path}.${k}` : String(k);
  if (depth < DEPTH && isPlain(a) && isPlain(b)) {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (a[k] === undefined && b[k] !== undefined) out.push({ path: at(k), to: b[k] });
      else if (b[k] === undefined && a[k] !== undefined) out.push({ path: at(k), from: a[k] });
      else fieldChanges(a[k], b[k], at(k), depth + 1, out);
    }
    return out;
  }
  if (depth < DEPTH && Array.isArray(a) && Array.isArray(b) && a.length === b.length) { a.forEach((x, i) => fieldChanges(x, b[i], at(i), depth + 1, out)); return out; }
  out.push({ path: path || '.', ...(a !== undefined ? { from: a } : {}), ...(b !== undefined ? { to: b } : {}) });
  return out;
}

/** The ids of `a` (in order) that keep their order in `b`: the longest common subsequence of the ids both have. */
function inOrder(a: readonly string[], b: readonly string[]): Set<string> {
  const n = a.length, m = b.length, len: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) len[i][j] = a[i] === b[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
  const keep = new Set<string>();
  for (let i = 0, j = 0; i < n && j < m;) { if (a[i] === b[j]) { keep.add(a[i]); i++; j++; } else if (len[i + 1][j] >= len[i][j + 1]) i++; else j++; }
  return keep;
}

/** The features added, removed, edited and moved from `a` to `b`, in `b`'s order (removed ones after, in `a`'s). */
export function featureChanges(a: Pick<StudioDoc, 'nodes' | 'nextId'>, b: Pick<StudioDoc, 'nodes' | 'nextId'>): FeatureChange[] {
  const A = idFormOf(a), B = idFormOf(b), out: FeatureChange[] = [];
  const common = (o: readonly string[], other: Map<string, ModelNode>) => o.filter(id => other.has(id));
  const kept = inOrder(common(A.order, B.nodes), common(B.order, A.nodes));
  for (const id of B.order) {
    const nb = B.nodes.get(id)!, na = A.nodes.get(id);
    if (!na) { out.push({ id, kind: 'added', feature: nb.kind }); continue; }
    if (nodeKey(na) !== nodeKey(nb)) {
      out.push({ id, kind: 'edited', feature: nb.kind, fields: fieldChanges(withoutSigs(na), withoutSigs(nb)) });
    }
    if (!kept.has(id)) out.push({ id, kind: 'moved', feature: nb.kind });
  }
  for (const id of A.order) if (!B.nodes.has(id)) out.push({ id, kind: 'removed', feature: A.nodes.get(id)!.kind });
  return out;
}

function valueChanges(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}): ValueChange[] {
  const out: ValueChange[] = [];
  for (const name of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[name] === undefined) out.push({ name, kind: 'added', to: b[name] });
    else if (b[name] === undefined) out.push({ name, kind: 'removed', from: a[name] });
    else if (canonical(a[name]) !== canonical(b[name])) out.push({ name, kind: 'edited', from: a[name], to: b[name] });
  }
  return out;
}
function itemChanges(a: readonly { id: string }[] = [], b: readonly { id: string }[] = []): ItemChange[] {
  const ia = new Map(a.map(x => [x.id, x])), ib = new Map(b.map(x => [x.id, x])), out: ItemChange[] = [];
  for (const y of b) {
    const x = ia.get(y.id);
    if (!x) out.push({ id: y.id, kind: 'added' });
    else if (canonical(x) !== canonical(y)) out.push({ id: y.id, kind: 'edited', fields: fieldChanges(x, y) });
  }
  for (const x of a) if (!ib.has(x.id)) out.push({ id: x.id, kind: 'removed' });
  return out;
}

/** What changed from document `a` to document `b`. */
export function changesOf(a: StudioDoc, b: StudioDoc): DocChanges {
  const features = featureChanges(a, b), parameters = valueChanges(a.parameters, b.parameters), configurations = valueChanges(a.configurations, b.configurations);
  const [mates, instances] = KEYED_LISTS.map(k => itemChanges(a[k], b[k]));
  const ra = a as unknown as Record<string, unknown>, rb = b as unknown as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !OWN.has(k) && canonical(ra[k] ?? null) !== canonical(rb[k] ?? null)).sort();
  const same = canonical(a) === canonical(b);
  return { same, features, parameters, configurations, mates, instances, fields };
}
