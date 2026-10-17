// Transactions for agents (A4.1): a batch of tool calls applied all or nothing, tried first as a dry run if
// asked; client op ids so a retried batch is not applied twice; checkpoints of the part to go back to and to
// compare with. A diff is by stable feature id (A1): what was added, changed (before → after) and deleted.
import { featureLabel, type ModelNode, type StudioDoc } from '../engine/doc';
import { featureId } from '../engine/ids';

/** A node without what the studio keeps about its references (signatures, marks): what the feature is. */
const essence = (n: ModelNode) => { const { sigs: _, rematched: __, held: ___, ...rest } = n; return JSON.stringify(rest); };

export interface TreeDiff {
  added: { id: string; label: string }[];
  changed: { id: string; label: string; before: string; after: string }[];
  deleted: { id: string; label: string }[];
  /** Features that moved in the history (their order changed). */
  moved: string[];
  parameters?: Record<string, { before?: number; after?: number }>;
  requirements?: { added: string[]; changed: string[]; deleted: string[] };
}
/** What changed from `a` to `b`, feature by feature (by stable id), and in parameters and requirements. */
export function treeDiff(a: StudioDoc, b: StudioDoc): TreeDiff {
  const ia = new Map(a.nodes.map((n, i) => [featureId(a.nodes, i), { n, i }])), ib = new Map(b.nodes.map((n, i) => [featureId(b.nodes, i), { n, i }]));
  const out: TreeDiff = { added: [], changed: [], deleted: [], moved: [] };
  for (const [id, { n, i }] of ib) {
    const was = ia.get(id);
    if (!was) { out.added.push({ id, label: featureLabel(n, i, b.nodes) }); continue; }
    if (essence(was.n) !== essence(n)) out.changed.push({ id, label: featureLabel(n, i, b.nodes), before: featureLabel(was.n, was.i, a.nodes), after: featureLabel(n, i, b.nodes) });
  }
  for (const [id, { n, i }] of ia) if (!ib.has(id)) out.deleted.push({ id, label: featureLabel(n, i, a.nodes) });
  const common = b.nodes.map((_, i) => featureId(b.nodes, i)).filter(id => ia.has(id)), before = a.nodes.map((_, i) => featureId(a.nodes, i)).filter(id => ib.has(id));
  out.moved = common.filter((id, k) => before[k] !== id);
  const keys = new Set([...Object.keys(a.parameters), ...Object.keys(b.parameters)]), params: TreeDiff['parameters'] = {};
  for (const k of keys) if (a.parameters[k] !== b.parameters[k]) params[k] = { ...(k in a.parameters ? { before: a.parameters[k] } : {}), ...(k in b.parameters ? { after: b.parameters[k] } : {}) };
  if (Object.keys(params).length) out.parameters = params;
  const ra = new Map((a.requirements ?? []).map(r => [r.id, JSON.stringify(r)])), rb = new Map((b.requirements ?? []).map(r => [r.id, JSON.stringify(r)]));
  const req = { added: [...rb.keys()].filter(k => !ra.has(k)), changed: [...rb.keys()].filter(k => ra.has(k) && ra.get(k) !== rb.get(k)), deleted: [...ra.keys()].filter(k => !rb.has(k)) };
  if (req.added.length || req.changed.length || req.deleted.length) out.requirements = req;
  return out;
}
export const isEmptyDiff = (d: TreeDiff) => !d.added.length && !d.changed.length && !d.deleted.length && !d.moved.length && !d.parameters && !d.requirements;

/** What a session keeps for transactions: the op ids applied, and named checkpoints of the part. */
export interface Transactions { applied: string[]; checkpoints: Record<string, StudioDoc> }
export const newTransactions = (): Transactions => ({ applied: [], checkpoints: {} });
/** At most this many op ids remembered (the oldest forgotten first). */
export const OP_IDS = 500;
