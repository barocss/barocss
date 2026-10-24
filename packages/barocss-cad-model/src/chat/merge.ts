// A chat turn merged onto the document as it is now (O133, the owner's decision on the README defect "Chat turn
// overwrites edits made during it"): the agent's turn is a patch — A7's ops on a base — and when the person edited
// the part while it ran, the base is stale (A7's STALE_BASE) and the turn is rebased explicitly onto what the person
// has now, op by op. Ops that collide with the person's edits are not applied: they wait as one proposal, each with a
// typed reason, and the rest apply.
//
// Each op is captured as what it did, made explicit (`captureOp`): the features it added (each after the feature it
// followed), changed and deleted, the parameters, body outputs, looks and other fields it wrote, the proposals and
// history it added. A feature's references to earlier ones are indices in the document; captured, each is that
// feature's serial ("id form"), so an op does not depend on where features are, and an implicit target — the newest
// sketch, a selector, a default — is the feature it picked. The person's own change is captured the same way, from
// the turn's base to the document now.
//
// The ids the turn made (handed out from the base's next serial) move past the ones the person took meanwhile, all by
// the same offset, so the agent's n4 and a box the person added as n4 never meet; names and body keys follow (n4.top,
// b4). An op conflicts when it
//   - changes or deletes a feature the person changed or deleted (TURN_SAME_NODE),
//   - uses a feature the person deleted, or deletes one the person's change uses, or does not build on the part as
//     the person left it (TURN_NODE_GONE),
//   - writes a parameter the person changed, or a feature it writes names one (TURN_PARAMETER_CHANGED),
//   - writes a field (a body's look, the brief, requirements, material, …) the person changed too (TURN_FIELD_CHANGED),
//   - restores a checkpoint, a whole earlier state (TURN_NOT_REPLAYABLE),
//   - uses what an op not applied made, changed or wrote (TURN_BUILDS_ON_DEFERRED),
//   - reorders the history (TURN_SHAPE_DIFFERS);
//   - or the person kept editing while it was merged, twice over: then every op waits, unrun (TURN_STILL_EDITING).
// Ops not applied become one proposal on the merged part (their calls moved to it, `moveOps`), with their reasons;
// the person previews, accepts or rejects it as any other.
import { STUDIO_DOC_FIELDS, type BodyLook, type BodyRef, type ModelNode, type StudioDoc } from '../engine/doc';
import { featureId, nextSerial, serialOf } from '../engine/ids';
import { canonical } from '../util/revision';
import { renumber } from './features';
import { nextProposalId, PLAN_CHARS, withHistory } from './proposals';
import type { HistoryEntry, Op, Proposal, Risk, TurnCode, TurnConflict } from '../engine/schema/proposals';
import { moveOp, renameIds } from './remap';
import { modelHash } from './spec';
import { moveOps, proposalOf, type ChatState, type Evaluate } from './tools';
import { isObj } from '../util/guards';
import { refusal } from '../engine/refusal';

/** The fields a turn's op may write besides features, parameters, body outputs and looks, proposals and history. */
const OWN = new Set<string>(['format', 'schema', 'units', 'nextId', 'nodes', 'outputs', 'parameters', 'bodies', 'proposals', 'history']);
const FIELDS: readonly string[] = STUDIO_DOC_FIELDS.filter(k => !OWN.has(k));
/** The tools that bring back a whole earlier state. */
const RESTORES = new Set(['restore', 'restore_best', 'restore_version', 'switch_branch', 'merge_branch']);
const TOKEN = /(?<![\w])[nb](\d+)(?!\d)/g;

/** What an op did, explicit: features in id form (each index reference the referenced feature's serial). */
export interface TurnEffect {
  /** Features added, each after the feature it followed (null: first). */
  added: { id: string; after: string | null; node: ModelNode }[];
  changed: { id: string; node: ModelNode }[];
  deleted: string[];
  /** The features kept changed their order. */
  moved: boolean;
  /** Parameters written (null: removed). */
  parameters: Record<string, number | null>;
  /** Body outputs written, in id form (null: removed). */
  outputs: Record<string, BodyRef | null>;
  /** Bodies' looks written (null: removed). */
  bodies: Record<string, BodyLook | null>;
  /** Other fields of the document written (null: removed). */
  fields: Record<string, unknown>;
  /** Proposals added or changed. */
  proposals: Proposal[];
  /** History entries added. */
  history: HistoryEntry[];
}
/** One call of the turn that changed the part: the call (as a proposal replays it), the feature ids in order before it, the ids it made, what it did. */
export interface TurnOp { tool: string; args: Record<string, unknown>; order: string[]; made: string[]; effect: TurnEffect }
/** A turn's patch (A7's on a base): the base's revision (`revisionOf`) and next serial, the ops in order. */
export interface TurnPatch { id: string; by: { agent: string; model?: string }; base: string; nextId: number; ops: TurnOp[] }

const idsOf = (nodes: readonly ModelNode[]) => nodes.map((_, i) => featureId(nodes, i));
/** A node with its index references as serials. */
const idForm = (nodes: readonly ModelNode[], node: ModelNode): ModelNode => renumber(node, i => serialOf(featureId(nodes, i)));
/** What a feature is, without what the studio keeps about its references (as treeDiff compares). */
function essence(n: ModelNode): string { const rest: Partial<ModelNode> = { ...n }; delete rest.sigs; delete rest.rematched; delete rest.held; return canonical(rest); }
const same = (a: unknown, b: unknown) => canonical(a ?? null) === canonical(b ?? null);
/** The keys of two records that differ, each with its value in `b` (null: gone). */
function keyed<T>(a: Record<string, T> | undefined, b: Record<string, T> | undefined, value: (v: T) => T = v => v): Record<string, T | null> {
  const out: Record<string, T | null> = {}, A = a ?? {}, B = b ?? {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (!same(A[k], B[k])) out[k] = k in B ? value(B[k]) : null;
  return out;
}

/** What took `before` to `after`, made explicit (a call of the turn, or the person's change since its base). */
export function effectOf(before: StudioDoc, after: StudioDoc): TurnEffect {
  const ia = new Map(idsOf(before.nodes).map((id, i) => [id, i])), b = idsOf(after.nodes), ib = new Set(b);
  const added: TurnEffect['added'] = [], changed: TurnEffect['changed'] = [];
  b.forEach((id, i) => {
    const node = idForm(after.nodes, after.nodes[i]), was = ia.get(id);
    if (was === undefined) added.push({ id, after: i > 0 ? b[i - 1] : null, node });
    else if (essence(idForm(before.nodes, before.nodes[was])) !== essence(node)) changed.push({ id, node });
  });
  const deleted = idsOf(before.nodes).filter(id => !ib.has(id));
  const kept = b.filter(id => ia.has(id)), keptBefore = idsOf(before.nodes).filter(id => ib.has(id));
  const fields: Record<string, unknown> = {};
  for (const k of FIELDS) { const x = (before as unknown as Record<string, unknown>)[k], y = (after as unknown as Record<string, unknown>)[k]; if (!same(x, y)) fields[k] = y ?? null; }
  const was = new Map((before.proposals ?? []).map(p => [p.id, p])), hist = new Set((before.history ?? []).map(h => h.id));
  return {
    added, changed, deleted, moved: kept.some((id, k) => keptBefore[k] !== id),
    parameters: keyed(before.parameters, after.parameters),
    outputs: keyed(before.outputs, after.outputs, r => ({ ...r, node: serialOf(featureId(after.nodes, r.node)) })),
    bodies: keyed(before.bodies, after.bodies), fields,
    proposals: (after.proposals ?? []).filter(p => !same(was.get(p.id), p)),
    history: (after.history ?? []).filter(h => !hist.has(h.id)),
  };
}
/** A call of the turn captured (the tool server records each one that changed the part). */
export function captureOp(before: StudioDoc, after: StudioDoc, tool: string, args: Record<string, unknown>): TurnOp {
  const order = idsOf(before.nodes), had = new Set(order);
  return { tool, args, order, made: idsOf(after.nodes).filter(id => !had.has(id)), effect: effectOf(before, after) };
}

/** The features a node refers to: its index references (as serials, in id form) and the names in it (`n3.top`, `b3`). */
function refsOf(node: ModelNode, into: Set<string>): Set<string> {
  renumber(node, s => { into.add(`n${s}`); return s; });
  const walk = (x: unknown): void => {
    if (typeof x === 'string') { for (const m of x.matchAll(TOKEN)) into.add(`n${m[1]}`); return; }
    if (Array.isArray(x)) { for (const y of x) walk(y); return; }
    if (isObj(x)) for (const y of Object.values(x)) walk(y);
  };
  walk(node);
  return into;
}
/** Whether a node names a parameter (`{parameter: w}`, or `w` in an expression). */
function names(node: ModelNode, param: string): boolean {
  const re = new RegExp(`(?<![\\w.])${param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`);
  const walk = (x: unknown): boolean => typeof x === 'string' ? re.test(x) : Array.isArray(x) ? x.some(walk) : isObj(x) ? Object.values(x).some(walk) : false;
  return walk(node);
}

/** The part being merged: features in id form, in order, and the rest of the document. */
interface Work { order: string[]; nodes: Map<string, ModelNode>; doc: StudioDoc }
function workOf(doc: StudioDoc): Work {
  const order = idsOf(doc.nodes);
  return { order, nodes: new Map(order.map((id, i) => [id, idForm(doc.nodes, doc.nodes[i])])), doc };
}
/** The document the work is, or the feature references that no longer resolve. */
function docOf(w: Work): { doc: StudioDoc } | { missing: string[] } {
  const at = new Map(w.order.map((id, i) => [`n${serialOf(id)}`, i])), missing: string[] = [];
  const back = (s: number) => { const i = at.get(`n${s}`); if (i === undefined) { missing.push(`n${s}`); return -1; } return i; };
  const nodes = w.order.map(id => renumber(w.nodes.get(id)!, back));
  const outputs: Record<string, BodyRef> = {};
  for (const [k, r] of Object.entries(w.doc.outputs)) outputs[k] = { ...r, node: back(r.node) };
  if (missing.length) return { missing: [...new Set(missing)] };
  const doc = { ...w.doc, nodes, outputs };
  return { doc: { ...doc, nextId: nextSerial(doc) } };
}
/** The work with an op's effect applied (on a copy). */
function applied(w: Work, e: TurnEffect): Work {
  const order = w.order.filter(id => !e.deleted.includes(id)), nodes = new Map(w.nodes);
  for (const id of e.deleted) nodes.delete(id);
  for (const c of e.changed) nodes.set(c.id, c.node);
  for (const a of e.added) {
    const k = a.after === null ? -1 : order.indexOf(a.after);
    order.splice(a.after !== null && k < 0 ? order.length : k + 1, 0, a.id); nodes.set(a.id, a.node);
  }
  const d = w.doc as unknown as Record<string, unknown>, doc: Record<string, unknown> = { ...d };
  const put = <T>(cur: Record<string, T> | undefined, writes: Record<string, T | null>) => { const out = { ...(cur ?? {}) }; for (const [k, v] of Object.entries(writes)) { if (v === null) delete out[k]; else out[k] = v; } return out; };
  doc.parameters = put(w.doc.parameters, e.parameters);
  doc.outputs = put(w.doc.outputs, e.outputs);
  if (Object.keys(e.bodies).length) doc.bodies = put(w.doc.bodies, e.bodies);
  for (const [k, v] of Object.entries(e.fields)) { if (v === null) delete doc[k]; else doc[k] = v; }
  if (e.proposals.length) { const by = new Map(e.proposals.map(p => [p.id, p])), list = (w.doc.proposals ?? []).map(p => by.get(p.id) ?? p); for (const p of e.proposals) if (!list.some(q => q.id === p.id)) list.push(p); doc.proposals = list; }
  return { order, nodes, doc: doc as unknown as StudioDoc };
}
/** The work's outputs in id form (the document's are indices, `workOf` keeps them as serials). */
function serialOutputs(doc: StudioDoc): StudioDoc {
  const outputs: Record<string, BodyRef> = {};
  for (const [k, r] of Object.entries(doc.outputs)) outputs[k] = { ...r, node: serialOf(featureId(doc.nodes, r.node)) };
  return { ...doc, outputs };
}

export interface Merged {
  /** The part as merged: the person's document with the ops applied (and the proposal of the rest, when any). */
  doc: StudioDoc;
  /** The ops applied, by their place in the turn. */
  applied: number[];
  /** The ops not applied, each with its reason. */
  deferred: TurnConflict[];
  /** The proposal holding the ops not applied, or null. */
  proposal: string | null;
}

/** Whether the person changed the part while the turn ran (anything but the design history): the turn's base is stale. */
export const changedDuring = (base: StudioDoc, now: StudioDoc): boolean => canonical({ ...base, history: null }) !== canonical({ ...now, history: null });

/**
 * The turn's ops applied to the part as the person has it now (`now`), from the base they were made on (`base`), each
 * that does not conflict; the rest as one proposal on the result, with their reasons.
 */
export async function mergeTurn(base: StudioDoc, now: StudioDoc, patch: TurnPatch, evaluate: Evaluate, o: { deferAll?: string; rowFiles?: ChatState['rowFiles'] } = {}): Promise<Merged> {
  // (Every op waiting, without running anything — nothing to await, so no edit lands in between: the last resort.)
  if (o.deferAll !== undefined) {
    const deferred = patch.ops.map((op, k): TurnConflict => ({ op: k, tool: op.tool, code: 'TURN_STILL_EDITING', reason: o.deferAll! }));
    const p = staticProposal(now, patch, deferred);
    return { doc: p.doc, applied: [], deferred, proposal: p.id };
  }
  // (The person's change, as an op's: what they changed, deleted, wrote, and what their new features use.)
  const person = effectOf(base, now);
  const personTouched = new Set([...person.changed.map(c => c.id), ...person.deleted]), personDeleted = new Set(person.deleted);
  const personUses = new Set<string>(); for (const n of [...person.added, ...person.changed]) refsOf(n.node, personUses);
  // (The turn's ids past the person's: one offset for all of them, so names and keys follow.)
  const offset = Math.max(0, nextSerial(now) - patch.nextId), ids = new Map<string, string>();
  if (offset) for (const op of patch.ops) for (const id of op.made) { const k = serialOf(id); if (k >= patch.nextId) ids.set(id, `n${k + offset}`); }
  const moveSerial = (s: number) => s >= patch.nextId ? s + offset : s;
  const moveEffect = (e: TurnEffect): TurnEffect => {
    const r = renameIds(e, ids);
    const outputs: Record<string, BodyRef | null> = {};
    for (const [k, v] of Object.entries(r.outputs)) outputs[k] = v && { ...v, node: moveSerial(v.node) };
    return { ...r, added: r.added.map(a => ({ ...a, node: renumber(a.node, moveSerial) })), changed: r.changed.map(c => ({ ...c, node: renumber(c.node, moveSerial) })), outputs };
  };

  // (What the ops not applied made, changed, deleted or wrote: an op using any of it is not applied either.)
  const late = { ids: new Set<string>(), parameters: new Set<string>(), fields: new Set<string>(), bodies: new Set<string>(), outputs: new Set<string>() };
  const paramsNow = Object.keys({ ...base.parameters, ...now.parameters });
  const conflictOf = (op: TurnOp, e: TurnEffect, w: Work): [TurnCode, string] | null => {
    if (RESTORES.has(op.tool)) return ['TURN_NOT_REPLAYABLE', `it brings back a whole earlier state of the part, from before your edits`];
    const own = new Set(e.added.map(a => a.id)), uses = new Set<string>();
    for (const n of [...e.added, ...e.changed]) refsOf(n.node, uses);
    for (const v of Object.values(e.outputs)) if (v) uses.add(`n${v.node}`);
    for (const id of own) uses.delete(id);
    const touched = [...e.changed.map(c => c.id), ...e.deleted];
    const nodes = [...e.added, ...e.changed].map(x => x.node);
    const writes = Object.keys(e.parameters), mentions = paramsNow.filter(p => nodes.some(n => names(n, p)));
    const onLate = [...uses, ...touched].find(id => late.ids.has(id)) ?? [...writes, ...mentions].find(p => late.parameters.has(p))
      ?? Object.keys(e.fields).find(k => late.fields.has(k)) ?? Object.keys(e.bodies).find(k => late.bodies.has(k)) ?? Object.keys(e.outputs).find(k => late.outputs.has(k));
    if (onLate) return ['TURN_BUILDS_ON_DEFERRED', `it builds on ${onLate}, which an earlier change of the turn made or changed and was not applied`];
    const both = touched.find(id => personTouched.has(id));
    if (both) return ['TURN_SAME_NODE', `you ${personDeleted.has(both) ? 'deleted' : 'changed'} ${both} during the turn, and it ${e.deleted.includes(both) ? 'deletes' : 'changes'} it too`];
    const gone = [...uses].find(id => personDeleted.has(id)) ?? [...uses].find(id => !w.nodes.has(id));
    if (gone) return ['TURN_NODE_GONE', `it uses ${gone}, which you deleted during the turn`];
    const used = e.deleted.find(id => personUses.has(id));
    if (used) return ['TURN_NODE_GONE', `it deletes ${used}, which what you added or changed during the turn uses`];
    const output = Object.keys(e.outputs).find(k => k in person.outputs);
    if (output) return ['TURN_SAME_NODE', `you changed the body ${output} during the turn, and it changes it too`];
    const param = writes.find(p => p in person.parameters) ?? mentions.find(p => p in person.parameters);
    if (param) return ['TURN_PARAMETER_CHANGED', `you changed the parameter ${param} during the turn, and it ${writes.includes(param) ? 'sets' : 'uses'} it`];
    const field = Object.keys(e.fields).find(k => k in person.fields);
    if (field) return ['TURN_FIELD_CHANGED', `you changed ${field} during the turn, and it changes it too`];
    const look = Object.keys(e.bodies).find(k => k in person.bodies);
    if (look) return ['TURN_FIELD_CHANGED', `you changed the look of ${look} during the turn, and it changes it too`];
    if (e.moved) return ['TURN_SHAPE_DIFFERS', `it reorders the history, which you changed during the turn`];
    return null;
  };

  // (Each op decided on the structure; the result evaluated once. An op that does not build is found op by op, and
  // not applied, with the evaluation's reason.)
  const run = async (check: boolean): Promise<{ w: Work; applied: number[]; deferred: TurnConflict[]; bodies: ChatState['bodies'] } | null> => {
    for (const s of Object.values(late)) s.clear();
    let w = workOf(serialOutputs(now)), bodies: ChatState['bodies'] = [];
    const done: number[] = [], deferred: TurnConflict[] = [];
    const defer = (k: number, op: TurnOp, e: TurnEffect, code: TurnCode, reason: string) => {
      deferred.push({ op: k, tool: op.tool, code, reason });
      for (const id of [...e.added.map(a => a.id), ...e.changed.map(c => c.id), ...e.deleted]) late.ids.add(id);
      for (const k2 of Object.keys(e.parameters)) late.parameters.add(k2);
      for (const k2 of Object.keys(e.fields)) late.fields.add(k2);
      for (const k2 of Object.keys(e.bodies)) late.bodies.add(k2);
      for (const k2 of Object.keys(e.outputs)) late.outputs.add(k2);
    };
    for (const [k, op] of patch.ops.entries()) {
      const e = moveEffect(op.effect), why = conflictOf(op, e, w);
      if (why) { defer(k, op, e, why[0], why[1]); continue; }
      const next = applied(w, e);
      if (check) {
        const d = docOf(next);
        if ('missing' in d) { defer(k, op, e, 'TURN_NODE_GONE', `it uses ${d.missing.join(', ')}, which the part no longer has`); continue; }
        const r = await evaluate(d.doc);
        if (!r) return null;
        if (!r.ok) { defer(k, op, e, 'TURN_NODE_GONE', `it does not build on the part as you left it: ${r.error.title}`); continue; }
        bodies = r.bodies;
      }
      w = next; done.push(k);
    }
    return { w, applied: done, deferred, bodies };
  };
  let r = await run(false);
  let doc: StudioDoc | null = null, bodies: ChatState['bodies'] = [];
  if (r) {
    const d = docOf(r.w);
    const e = 'doc' in d ? await evaluate(d.doc) : null;
    if ('doc' in d && e?.ok) { doc = d.doc; bodies = e.bodies; }
  }
  if (!doc) {
    r = await run(true);
    if (!r) throw refusal('MERGE_SUPERSEDED', 'The evaluation was superseded while the chat turn was merged.');
    const d = docOf(r.w);
    if (!('doc' in d)) throw refusal('MERGE_MISSING', `The merged part names ${d.missing.join(', ')}, which it does not have.`);
    doc = d.doc; bodies = r.bodies;
    if (!r.applied.length) { const e = await evaluate(doc); if (e?.ok) bodies = e.bodies; }
  }
  // (The history the applied ops added, after the person's.)
  for (const k of r!.applied) for (const h of patch.ops[k].effect.history) doc = withHistory(doc, historyOf(h));
  if (!r!.deferred.length) return { doc, applied: r!.applied, deferred: [], proposal: null };
  const withProposal = await deferredProposal({ doc, bodies, rowFiles: o.rowFiles }, patch, r!.deferred, ids, evaluate);
  return { doc: withProposal.doc, applied: r!.applied, deferred: r!.deferred, proposal: withProposal.id };
}

/** The ops not applied as a proposal, their calls moved without running them (risk high: not worked out). */
function staticProposal(doc: StudioDoc, patch: TurnPatch, deferred: readonly TurnConflict[]): { doc: StudioDoc; id: string } {
  const ops = deferred.map(c => patch.ops[c.op]), to = doc.nodes.map((_, i) => featureId(doc.nodes, i));
  const shift = Math.max(0, nextSerial(doc) - patch.nextId), ids = new Map<string, string>();
  if (shift) for (const op of ops) for (const id of op.made) { const k = serialOf(id); if (k >= patch.nextId) ids.set(id, `n${k + shift}`); }
  const calls = ops.map(op => moveOp({ tool: op.tool, args: op.args }, { from: op.order, to, ids }).op);
  return proposalRecord(doc, patch, deferred, calls, null, `not worked out: ${deferred[0]?.reason ?? ''}`);
}
/** A history entry as one to add again (its id handed out anew). */
function historyOf(h: HistoryEntry): Omit<HistoryEntry, 'id'> { const out: Partial<HistoryEntry> = { ...h }; delete out.id; return out as Omit<HistoryEntry, 'id'>; }

/** The ops not applied as one open proposal on the merged part: their calls moved to it, their reasons its plan. */
async function deferredProposal(state: ChatState, patch: TurnPatch, deferred: readonly TurnConflict[], ids: Map<string, string>, evaluate: Evaluate): Promise<{ doc: StudioDoc; id: string }> {
  const ops = deferred.map(c => patch.ops[c.op]), calls: Op[] = ops.map(o => ({ tool: o.tool, args: o.args }));
  const moved = await moveOps(state, calls, ops.map(o => o.order), evaluate, new Map(ids), ops.map(o => o.made));
  const list = moved.ops;
  // (Its risk and checks as a proposal's, when its calls replay on the merged part; else said, and high.)
  const made = 'error' in moved ? null : await proposalOf(state, list, evaluate);
  const ok = made && !('fail' in made) ? made : null;
  return proposalRecord(state.doc, patch, deferred, ok?.ops ?? list, ok, `does not replay on the part as it is${'error' in moved ? `: ${moved.error}` : ''}`);
}
/** The proposal of the ops not applied, added to the document: worked out (`made`), or high risk with why not. */
function proposalRecord(doc0: StudioDoc, patch: TurnPatch, deferred: readonly TurnConflict[], calls: Op[], made: { risk: Risk; summary: string; orders: string[][]; checks?: Proposal['checks'] } | null, why: string): { doc: StudioDoc; id: string } {
  const ops = deferred.map(c => patch.ops[c.op]), n = deferred.length, id = nextProposalId(doc0);
  const risk: Risk = made?.risk ?? { level: 'high', features_touched: new Set(ops.flatMap(o => [...o.effect.added.map(a => a.id), ...o.effect.changed.map(c => c.id), ...o.effect.deleted])).size, references_broken: 0, hard_requirements_changed: [], approval: [] };
  const plan = deferred.map(c => `${c.tool}: not applied — ${c.reason}`).join('\n');
  const p: Proposal = {
    id, title: `The rest of the chat turn (${n} change${n > 1 ? 's' : ''} not applied)`, status: 'open', by: patch.by, at: new Date().toISOString(),
    plan: plan.slice(0, PLAN_CHARS), base: modelHash(doc0), ops: calls, ...(made ? { orders: made.orders } : {}), risk, summary: made?.summary ?? why,
    ...(made?.checks ? { checks: made.checks } : {}), merge: { turn: patch.id, conflicts: [...deferred] },
  };
  const doc = withHistory({ ...doc0, proposals: [...(doc0.proposals ?? []), p] }, { kind: 'proposal', by: patch.by, proposal: id, summary: `${id} ${p.title}: ${deferred.map(c => c.code).join(', ')}`, risk });
  return { doc, id };
}
