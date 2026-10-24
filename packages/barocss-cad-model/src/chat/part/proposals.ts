// The v2 `proposals` group's handlers and the proposal machinery (R3, moved from chat/tools.ts): the autonomy gate, a
// change worked out on a copy, accepted, rebased or previewed, and its parts. The tools' runner comes in as `run`;
// chat/tools keeps the public functions' signatures as thin wrappers.
import { prefixDoc, type ModelNode, type StudioDoc } from '../../engine/doc';
import type { BodyResult } from '../../engine/evaluate';
import { featureId } from '../../engine/ids';
import { deleteFeatures, featureDependents, renumber } from '../features';
import { factsOf } from '../observe';
import { treeDiff } from '../transactions';
import { diffLine, nextProposalId, PLAN_CHARS, PROMPT_CHARS, riskOf, riskRank, withHistory } from '../proposals';
import type { ChecksDelta, Proposal, Risk } from '../../engine/schema/proposals';
import { checkSpec, modelHash } from '../spec';
import { MUTATORS } from '../toolDefinitions';
import { errorOf, moveOpsWith, runOps, type OpsRun } from './history';
import { type ChatState, type Evaluate, type ToolOutcome, type PartRun, type PartHandler, json, fail, strings } from '../toolKit';
import { isObj } from '../../util/guards';

/**
 * How far an agent may go on its own (D41), set per turn by the studio (`CAD_AUTONOMY`):
 * L1 proposes only; L2 (default; the owner's option b) applies value edits of one feature or of parameters that keep
 * every hard requirement passing, and proposes anything else (more features, adding, deleting or moving features,
 * what a feature is built on), the user accepting proposals — except a turn starting on an empty part, which builds
 * it directly (the first build); L3 also changes the part and accepts its own
 * proposals of low or medium risk changing no hard requirement; L4 any that breaks no hard requirement.
 * A proposal with approval reasons (an assembly, mates, a drawing, a locked part) is always the user's.
 */
export function autonomy(): 1 | 2 | 3 | 4 {
  const n = typeof process !== 'undefined' ? Number(process.env?.CAD_AUTONOMY) : NaN;
  return n === 1 || n === 3 || n === 4 ? n : 2;
}
// (add_library changes no model: it adds data to the document, marked as the agent's until a person confirms it.)
export const ASSEMBLY_CHANGES = new Set(['set_joints', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'insert_part', 'snap_part', 'set_inputs', 'set_variants', 'set_frames', 'set_waypoint']);
/** Whether a call changes the part (requirements are the brief, not the part; a dry run changes nothing). */
export function changesPart(name: string, input: unknown): boolean {
  if (name === 'set_requirements' || name === 'accept_proposal') return false;
  if ((name === 'apply_ops' || name === 'run_script') && isObj(input) && input.dryRun === true) return false;
  return MUTATORS.has(name) || ASSEMBLY_CHANGES.has(name);
}
/** Fields that say what a feature is built on or how it is made (references, choices, counts), not its values. */
const STRUCTURAL = new Set(['sideTags', 'kind', 'parent', 'left', 'right', 'tool', 'sketch', 'node', 'side', 'edges', 'faces', 'open', 'made', 'blob', 'positions', 'indices', 'repair', 'pieces', 'solids', 'count', 'suppressed', 'representation', 'op', 'axis', 'plane', 'toward']);
const dimLike = (x: unknown) => typeof x === 'number' || (isObj(x) && Object.keys(x).length === 1 && typeof x.parameter === 'string');
/** Whether `b` differs from `a` only in values (numbers, or a value bound to a parameter) outside the structural fields. */
function valuesOnly(a: unknown, b: unknown, key = ''): boolean {
  if (a === b) return true;
  // (A SubD cage with the same faces and creases — its vertices moved — is the feature's values, D83: what it is built
  // of, the topology, is its structure.)
  if (key === 'cage' && isObj(a) && isObj(b)) return JSON.stringify(a.faces) === JSON.stringify(b.faces) && JSON.stringify(a.creases ?? []) === JSON.stringify(b.creases ?? []) && Array.isArray(a.positions) && Array.isArray(b.positions) && a.positions.length === b.positions.length;
  if (STRUCTURAL.has(key)) return JSON.stringify(a) === JSON.stringify(b);
  if (dimLike(a) && dimLike(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => valuesOnly(x, b[i], key));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => !NODE_MARKS.has(k)), kb = Object.keys(b).filter(k => !NODE_MARKS.has(k));
    return ka.length === kb.length && ka.every(k => k in b && valuesOnly(a[k], b[k], k));
  }
  return false;
}
/** What the studio keeps on a node about its references (not the feature). */
const NODE_MARKS = new Set(['sigs', 'rematched', 'held']);
/** The hard requirements passing on each turn's base, worked out once. */
const basePassing = new WeakMap<StudioDoc, Promise<Set<string>>>();
/**
 * Why the turn's changes (from `base` to `cur`) need a proposal at L2, or null when they apply directly: values of
 * one feature, or parameter values, with every hard requirement that passed at the turn's start still passing.
 */
export async function proposalNeededAtL2(base: StudioDoc, cur: ChatState, evaluate: Evaluate): Promise<string | null> {
  const d = treeDiff(base, cur.doc), what = [d.added.length ? `adds ${d.added.length}` : '', d.deleted.length ? `deletes ${d.deleted.length}` : '', d.moved.length ? `moves ${d.moved.length}` : ''].filter(Boolean);
  if (what.length) return `this turn ${what.join(', ')} feature${d.added.length + d.deleted.length + d.moved.length > 1 ? 's' : ''}`;
  // (A sketch is part of the feature built from it: a box's width and height are one feature's values.)
  const nodes = cur.doc.nodes, index = new Map(nodes.map((_, i) => [featureId(nodes, i), i])), consumer = new Map<number, number>();
  nodes.forEach((n, j) => { const r = n as { sketch?: unknown; sections?: { sketch?: unknown }[] }; for (const k of [r.sketch, ...(r.sections ?? []).map(x => x.sketch)]) if (typeof k === 'number' && !consumer.has(k)) consumer.set(k, j); });
  const owners = new Set(d.changed.map(c => { const i = index.get(c.id)!; return nodes[i]?.kind === 'sketch' && consumer.has(i) ? consumer.get(i)! : i; }));
  if (owners.size > 1) return `this turn changes ${owners.size} features (${d.changed.map(c => c.label).join(', ')})`;
  if (d.parameters && Object.values(d.parameters).some(p => p.before === undefined || p.after === undefined)) return 'this turn adds or removes parameters';
  const before = new Map(base.nodes.map((n, i) => [featureId(base.nodes, i), n]));
  for (const c of d.changed) if (!valuesOnly(before.get(c.id), nodes[index.get(c.id)!])) return `this changes ${c.label} beyond its values (what it is built on, its kind or options)`;
  const hard = (cur.doc.requirements ?? []).filter(r => r.hard);
  if (!hard.length) return null;
  let passing = basePassing.get(base);
  if (!passing) {
    passing = (async () => { const r = await evaluate(base); const c = await checkSpec(base, r?.ok ? r.bodies : [], evaluate); return new Set([...c.outcomes].filter(([, o]) => o.status === 'pass').map(([id]) => id)); })();
    basePassing.set(base, passing);
  }
  const was = await passing, now = await checkSpec(cur.doc, cur.bodies, evaluate);
  const broken = hard.filter(r => was.has(r.id) && now.outcomes.get(r.id)?.status !== 'pass').map(r => r.id);
  return broken.length ? `this leaves hard requirement${broken.length > 1 ? 's' : ''} ${broken.join(', ')} failing` : null;
}
/** Why an agent may not accept this proposal at this autonomy, or null (D41). */
export function agentMayNotAccept(p: Proposal, level: number): string | null {
  if (level < 3) return `At autonomy L${level} the user accepts proposals in the studio: tell them ${p.id} is ready.`;
  if (p.risk.approval.length) return `${p.id} always needs the user's approval (${p.risk.approval.join(', ')}).`;
  const hard = new Set(p.risk.hard_requirements_changed), breaks = (p.checks?.newly_failing ?? []).filter(x => hard.has(x));
  if (p.rebased && (riskRank(p.risk.level) > riskRank(p.rebased.risk_was.level) || hard.size)) return `${p.id} was rebased and its risk rose or a hard requirement changes: the user decides.`;
  if (level === 3 && (p.risk.level === 'high' || hard.size)) return `At autonomy L3 an agent accepts only low or medium risk changing no hard requirement; ${p.id} is ${p.risk.level}${hard.size ? `, changing ${[...hard].join(', ')}` : ''}: the user decides.`;
  if (breaks.length) return `${p.id} breaks hard requirement${breaks.length > 1 ? 's' : ''} ${breaks.join(', ')}: the user decides.`;
  return null;
}

/**
 * A proposal's change worked out on a copy (A4.2): the ops run as a person would apply them (no regression
 * guard: the checks' delta and the risk say what it does), the requirements checked before and after.
 */
export async function proposalOfWith(dispatch: PartRun, state: ChatState, ops: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | OpsRun & { checks?: ChecksDelta; risk: Risk; summary: string }> {
  const run = await runOps(dispatch, { ...state, policy: undefined }, ops, evaluate);
  if ('fail' in run) return run;
  const { cur, diff, broken } = run;
  let checks: ChecksDelta | undefined;
  const hardChanged = new Set<string>();
  if (state.doc.requirements?.length || cur.doc.requirements?.length) {
    const a = await checkSpec(state.doc, state.bodies, evaluate), b = await checkSpec(cur.doc, cur.bodies, evaluate);
    const flipped = [...b.outcomes].filter(([id, o]) => (a.outcomes.get(id)?.status ?? 'unknown') !== o.status);
    checks = { before: countsOf(a.summary), after: countsOf(b.summary), newly_failing: flipped.filter(([, o]) => o.status === 'fail').map(([id]) => id), newly_passing: flipped.filter(([, o]) => o.status === 'pass').map(([id]) => id) };
    const hard = new Set([...(state.doc.requirements ?? []), ...(cur.doc.requirements ?? [])].filter(r => r.hard).map(r => r.id));
    for (const [id] of flipped) if (hard.has(id)) hardChanged.add(id);
    for (const id of [...(diff.requirements?.added ?? []), ...(diff.requirements?.changed ?? []), ...(diff.requirements?.deleted ?? [])]) if (hard.has(id)) hardChanged.add(id);
  }
  const risk = riskOf(state.doc, cur.doc, diff, broken.length, [...hardChanged]);
  const summary = [diffLine(diff), ...(checks ? [`checks ${checks.before.pass}/${checks.before.fail}/${checks.before.unknown} → ${checks.after.pass}/${checks.after.fail}/${checks.after.unknown}`] : [])].filter(Boolean).join(', ') || 'no change';
  return { ...run, checks, risk, summary };
}
export const countsOf = (s: { pass: number; fail: number; unknown: number }) => ({ pass: s.pass, fail: s.fail, unknown: s.unknown });

/** Who decides: a person in the studio, or an agent (its model). */
export interface Decider { agent: string; model?: string }
/**
 * A proposal accepted (A4.2, A4.3): its ops replayed on the part as it is now, less the parts left out (`leaveOut`,
 * feature ids, with what depends on them), the proposal marked, the decision in the history with who proposed it,
 * the prompt, plan and requirements, and the model it made. A proposal made on a part changed since is refused as
 * stale: rebase it first and look again (D41). The replay's refusal, if any, is returned and nothing changes.
 */
export async function acceptProposalWith(dispatch: PartRun, state: ChatState, id: string, evaluate: Evaluate, o: { by?: Decider; leaveOut?: readonly string[] } = {}): Promise<{ state: ChatState; leftOut: string[] } | { error: string; stale?: true }> {
  const p = state.doc.proposals?.find(q => q.id === id), by = o.by ?? { agent: 'user' };
  if (!p || p.status !== 'open') return { error: p ? `${id} is ${p.status} already.` : `No proposal ${id}.` };
  if (p.base !== modelHash(state.doc)) return { error: `${id} was made on a part that has changed since: rebase it and look at the result before accepting.`, stale: true };
  const run = await runOps(dispatch, { ...state, policy: undefined }, p.ops, evaluate);
  if ('fail' in run) return { error: errorOf(run.fail) };
  let cur = run.cur, leftOut: string[] = [];
  if (o.leaveOut?.length) {
    const parts = proposalParts(state.doc, cur.doc), wrong = o.leaveOut.filter(x => !parts.some(q => q.id === x && q.kind !== 'deleted'));
    if (wrong.length) return { error: `${wrong.join(', ')}: not an added or changed feature of ${id} (${parts.filter(q => q.kind !== 'deleted').map(q => q.id).join(', ') || 'none'}).` };
    leftOut = leaveOutClosure(parts, o.leaveOut);
    const partial = partialDoc(state.doc, cur.doc, parts, leftOut);
    if ('error' in partial) return partial;
    const r = await evaluate(partial.doc);
    if (!r) return { error: 'The evaluation was superseded; try again.' };
    if (!r.ok) return { error: `Without ${leftOut.join(', ')} the part does not build: ${r.error.title}. ${r.error.hint}` };
    cur = { ...cur, doc: partial.doc, bodies: r.bodies };
  }
  const at = new Date().toISOString(), hash = modelHash(cur.doc);
  const decided = { by: by.agent, at, model_hash: hash, ...(leftOut.length ? { left_out: leftOut } : {}), ...(p.rebased ? { note: 'rebased before it was accepted' } : {}) };
  let doc: StudioDoc = { ...cur.doc, proposals: (state.doc.proposals ?? []).map(q => q.id === id ? { ...q, status: 'accepted' as const, decided } : q) };
  doc = withHistory(doc, { kind: 'accept', by, proposed_by: p.by, proposal: id, model_hash: hash, summary: `${id} ${p.title}${leftOut.length ? ` (without ${leftOut.join(', ')})` : ''}`,
    ...(p.prompt ? { prompt: p.prompt } : {}), ...(p.plan ? { plan: p.plan } : {}), ...(p.requirements ? { requirements: p.requirements } : {}), ...(p.rebased ? { base_was: p.rebased.original } : {}), risk: p.risk });
  return { state: { ...cur, doc }, leftOut };
}
/**
 * A stale proposal made again on the part as it is now (D41): its ops replayed as a fresh proposal — diff, facts'
 * change, broken references, the checks' delta and risk all recomputed — kept with the base it was made on first
 * and the risk it had then, and recorded in the history. It stays open, to be looked at before it is accepted.
 */
export async function rebaseProposalWith(dispatch: PartRun, state: ChatState, id: string, evaluate: Evaluate, by: Decider = { agent: 'user' }): Promise<{ state: ChatState; made: OpsRun & { checks?: ChecksDelta; risk: Risk; summary: string } } | { error: string }> {
  const p = state.doc.proposals?.find(q => q.id === id);
  if (!p || p.status !== 'open') return { error: p ? `${id} is ${p.status} already.` : `No proposal ${id}.` };
  const now = modelHash(state.doc);
  if (p.base === now) return { error: `${id} was made on the part as it is: nothing to rebase.` };
  // (O133: its ops' feature indices and the ids it made itself moved to the part as it is, when it says what they named.)
  let ops = p.ops;
  if (p.orders?.length === p.ops.length) {
    const moved = await moveOpsWith(dispatch, state, p.ops, p.orders, evaluate);
    if ('error' in moved) return { error: `${id} no longer applies: ${moved.error}` };
    ops = moved.ops;
  }
  const made = await proposalOfWith(dispatch, state, ops, evaluate);
  if ('fail' in made) return { error: `${id} no longer applies: ${errorOf(made.fail)}` };
  const rebased = { original: p.rebased?.original ?? p.base, from: p.base, at: new Date().toISOString(), risk_was: p.rebased?.risk_was ?? p.risk };
  const q: Proposal = { ...p, base: now, ops: made.ops, orders: made.orders, risk: made.risk, summary: made.summary, rebased, ...(made.checks ? { checks: made.checks } : {}) };
  if (!made.checks) delete q.checks;
  const doc = withHistory({ ...state.doc, proposals: state.doc.proposals!.map(x => x.id === id ? q : x) }, { kind: 'rebase', by, proposal: id, base_was: p.base, model_hash: now, summary: `${id} rebased: ${made.summary}`, risk: made.risk });
  return { state: { ...state, doc }, made };
}

/** A feature a proposal adds, changes or deletes, and the ones (of the proposal's) that go when it is left out. */
export interface ProposalPart { id: string; label: string; kind: 'added' | 'changed' | 'deleted'; children: string[] }
/** The proposal's parts from the part `base` to what it leaves, `after` (sketches go with their features). */
export function proposalParts(base: StudioDoc, after: StudioDoc): ProposalPart[] {
  const diff = treeDiff(base, after), out: ProposalPart[] = [];
  const index = new Map(after.nodes.map((_, i) => [featureId(after.nodes, i), i]));
  const own = new Set([...diff.added, ...diff.changed].map(x => x.id).filter(x => after.nodes[index.get(x)!]?.kind !== 'sketch'));
  for (const kind of ['added', 'changed'] as const) for (const x of diff[kind]) {
    if (!own.has(x.id)) continue;
    // (A change put back leaves what is built on it standing, as it stood before: only an added feature has children.)
    const children = kind === 'added' ? featureDependents(after, index.get(x.id)!).map(i => featureId(after.nodes, i)).filter(c => own.has(c)) : [];
    out.push({ id: x.id, label: x.label, kind, children });
  }
  const baseIndex = new Map(base.nodes.map((_, i) => [featureId(base.nodes, i), i]));
  for (const x of diff.deleted) if (base.nodes[baseIndex.get(x.id)!]?.kind !== 'sketch') out.push({ id: x.id, label: x.label, kind: 'deleted', children: [] });
  return out;
}
/** The parts left out with everything that depends on them (unticking a parent unticks its children). */
export function leaveOutClosure(parts: readonly ProposalPart[], ids: readonly string[]): string[] {
  const out = new Set(ids), byId = new Map(parts.map(q => [q.id, q]));
  for (const x of out) for (const c of byId.get(x)?.children ?? []) out.add(c);
  return parts.filter(q => out.has(q.id)).map(q => q.id);
}
/** The parts left out after ticking (`on`) or unticking a part: unticked, its children go too; ticked, its parents come back. */
export function toggledLeaveOut(parts: readonly ProposalPart[], leaveOut: readonly string[], id: string, on: boolean): string[] {
  if (!on) return leaveOutClosure(parts, [...leaveOut, id]);
  const back = new Set([id]);
  for (let grew = true; grew;) { grew = false; for (const q of parts) if (!back.has(q.id) && q.children.some(c => back.has(c))) { back.add(q.id); grew = true; } }
  return leaveOut.filter(x => !back.has(x));
}
/**
 * What a proposal leaves without some of its parts: changed features put back as they were (their references
 * renumbered to where those features are now), added ones deleted with the sketches only they use.
 */
export function partialDoc(base: StudioDoc, after: StudioDoc, parts: readonly ProposalPart[], leaveOut: readonly string[]): { doc: StudioDoc } | { error: string } {
  const out = new Set(leaveOut), nodes = [...after.nodes];
  const index = new Map(after.nodes.map((_, i) => [featureId(after.nodes, i), i])), baseIndex = new Map(base.nodes.map((_, i) => [featureId(base.nodes, i), i]));
  for (const q of parts) {
    if (!out.has(q.id) || q.kind !== 'changed') continue;
    const was = base.nodes[baseIndex.get(q.id)!];
    let missing: string | null = null;
    const back = renumber(was, i => { const at = index.get(featureId(base.nodes, i)); if (at === undefined) missing = featureId(base.nodes, i); return at ?? i; });
    if (missing) return { error: `${q.id} cannot be put back as it was: it was built on ${missing}, which the proposal deletes.` };
    nodes[index.get(q.id)!] = { ...back, id: q.id } as ModelNode;
  }
  const added = parts.filter(q => out.has(q.id) && q.kind === 'added').map(q => index.get(q.id)!);
  if (!added.length) return { doc: prefixDoc({ ...after, nodes }, nodes.length) };
  const r = deleteFeatures({ ...after, nodes }, added);
  return 'error' in r ? { error: `Leaving out ${leaveOut.join(', ')}: ${r.error}` } : { doc: r.doc };
}
/** The bodies a proposal would leave (its ghost preview), or its refusal. */
export async function previewProposalWith(dispatch: PartRun, state: ChatState, id: string, evaluate: Evaluate): Promise<{ doc: StudioDoc; bodies: BodyResult[] } | { error: string }> {
  const p = state.doc.proposals?.find(q => q.id === id);
  if (!p) return { error: `No proposal ${id}.` };
  const run = await runOps(dispatch, { ...state, policy: undefined }, p.ops, evaluate);
  if ('fail' in run) { let why = run.fail.content; try { why = JSON.parse(why).error; } catch { /* plain text */ } return { error: why }; }
  return { doc: run.cur.doc, bodies: run.cur.bodies };
}

async function proposeTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate, dispatch: PartRun): Promise<ToolOutcome> {
  // (A4.2: the change worked out and kept on the side, the part as it was; the user accepts or rejects it.)
  const title = typeof args.title === 'string' ? args.title.trim() : '';
  if (!title) return fail(state, 'A proposal takes a title.');
  const reqs = strings(args.requirements), known = new Set((state.doc.requirements ?? []).map(r => r.id)), unknown = reqs.filter(r => !known.has(r));
  if (unknown.length) return fail(state, `No requirement ${unknown.join(', ')}; requirements: ${[...known].join(', ') || 'none'}.`);
  const made = await proposalOfWith(dispatch, state, args.ops, evaluate);
  if ('fail' in made) return made.fail;
  const env = typeof process !== 'undefined' ? process.env : undefined;
  const by = { agent: 'chat', ...(env?.CAD_MODEL ? { model: env.CAD_MODEL } : {}) };
  const plan = typeof args.plan === 'string' ? args.plan : undefined;
  const p: Proposal = { id: nextProposalId(state.doc), title: title.slice(0, 120), status: 'open', by, at: new Date().toISOString(), ...(plan ? { plan: plan.slice(0, PLAN_CHARS) } : {}),
    ...(reqs.length ? { requirements: reqs } : {}), ...(env?.CAD_PROMPT ? { prompt: env.CAD_PROMPT.slice(0, PROMPT_CHARS) } : {}), base: modelHash(state.doc), ops: made.ops, orders: made.orders, risk: made.risk, summary: made.summary, ...(made.checks ? { checks: made.checks } : {}) };
  const doc = withHistory({ ...state.doc, proposals: [...(state.doc.proposals ?? []), p] }, { kind: 'proposal', by, proposal: p.id, summary: `${p.id} ${p.title}: ${p.summary}`, ...(plan ? { plan } : {}), ...(reqs.length ? { requirements: reqs } : {}), risk: p.risk });
  return { state: { ...state, doc }, content: json({ ok: true, proposal: p.id, applied: false, note: 'The part is unchanged: the user accepts or rejects the proposal in the studio.', diff: made.diff, change: made.change, ...(made.broken.length ? { broken_references: made.broken } : {}), ...(made.checks ? { checks: made.checks } : {}), risk: p.risk }), isError: false, changed: true, summary: `proposed ${p.id}: ${p.summary}` };
}
async function acceptProposalTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate, dispatch: PartRun): Promise<ToolOutcome> {
  const id = String(args.id ?? ''), p = state.doc.proposals?.find(q => q.id === id);
  if (!p || p.status !== 'open') return fail(state, p ? `${id} is ${p.status} already.` : `No proposal "${id}"; open: ${(state.doc.proposals ?? []).filter(q => q.status === 'open').map(q => q.id).join(', ') || 'none'}.`);
  const env = typeof process !== 'undefined' ? process.env : undefined, by = { agent: 'chat', ...(env?.CAD_MODEL ? { model: env.CAD_MODEL } : {}) };
  const level = autonomy();
  const early = level < 3 || p.risk.approval.length ? agentMayNotAccept(p, level) : null;
  if (early) return fail(state, early);
  // (Stale: made again on the part as it is, and shown; accepting it is a second call, D41.)
  if (p.base !== modelHash(state.doc)) {
    const r = await rebaseProposalWith(dispatch, state, id, evaluate, by);
    if ('error' in r) return fail(state, r.error, { kept: `${id} stays open` });
    const q = r.state.doc.proposals!.find(x => x.id === id)!;
    return { state: r.state, content: json({ ok: true, rebased: id, accepted: false, note: 'The part changed since this was proposed: it was made again on the part as it is. Read what it does now; call accept_proposal again to accept it.', diff: r.made.diff, change: r.made.change, ...(r.made.broken.length ? { broken_references: r.made.broken } : {}), ...(q.checks ? { checks: q.checks } : {}), risk: q.risk, risk_was: q.rebased!.risk_was, may_accept: agentMayNotAccept(q, level) ?? true }), isError: false, changed: true, summary: `rebased ${id}: ${q.summary}` };
  }
  const why = agentMayNotAccept(p, level);
  if (why) return fail(state, why);
  const r = await acceptProposalWith(dispatch, state, id, evaluate, { by, leaveOut: strings(args.leave_out) });
  if ('error' in r) return fail(state, r.error, { kept: `${id} stays open` });
  return { state: r.state, content: json({ ok: true, accepted: id, ...(r.leftOut.length ? { left_out: r.leftOut } : {}), feature_count: r.state.doc.nodes.length, facts: factsOf(r.state.doc, r.state.bodies) }), isError: false, changed: true, summary: `accepted ${id}` };
}
async function listProposalsTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const list = (state.doc.proposals ?? []).filter(p => args.all === true || p.status === 'open');
  return { state, content: json({ proposals: list.map(({ ops, ...p }) => ({ ...p, ops: ops.length, stale: p.status === 'open' && p.base !== modelHash(state.doc) })) }), isError: false, changed: false, summary: `${list.length} proposal${list.length === 1 ? '' : 's'}` };
}

/** The proposal group's handlers, by v1 tool name (R3). */
export const PROPOSAL_HANDLERS: Readonly<Record<string, PartHandler>> = { propose: proposeTool, accept_proposal: acceptProposalTool, list_proposals: listProposalsTool };
