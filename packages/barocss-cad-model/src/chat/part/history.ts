// The v2 `model` and `history` groups' handlers and the ops runner they share (R3, moved from chat/tools.ts): a
// batch of ops or a script run on a copy, all or nothing, and the session's checkpoints. The tools' runner comes in as
// `run` (no module imports chat/tools); otherwise verbatim.
import type { ModelNode } from '../../engine/doc';
import { bodyKeyFor, featureId, nodeIndexOf } from '../../engine/ids';
import { v1Call } from '../groups';
import { parse, runScript, SCRIPT_VERSION, ScriptError, type ScriptHost, type ScriptRun } from '../script';
import { changeOf, factsOf } from '../observe';
import { newTransactions, OP_IDS, treeDiff, type TreeDiff } from '../transactions';
import { canonical } from '../../util/revision';
import { moveOp } from '../remap';
import type { Op } from '../../engine/schema/proposals';
import { modelHash } from '../spec';
import { verifyReferences } from '../../engine/references';
import { rememberedEvaluate } from '../../engine/evalMemo';
import { BATCHABLE, takesArgument } from '../toolDefinitions';
import { CHAT_COMMANDS } from './features';
import { type ChatState, type Evaluate, type ToolOutcome, type PartRun, type PartHandler, because, json, CHECKPOINTS, accept, fail } from '../toolKit';
import { isObj } from '../../util/guards';

/** Ops run in order on a copy, each on what the one before left: the result, or the first refusal (nothing applied). */
export interface OpsRun { cur: ChatState; results: Record<string, unknown>[]; ops: Op[]; /** The feature ids in order before each op kept (O133: what its indices name). */ orders: string[][]; diff: TreeDiff; change: Record<string, unknown>; broken: Record<string, unknown>[] }
export async function runOps(dispatch: PartRun, state: ChatState, input: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | OpsRun> {
  // (The same ops on the same part again — a proposal accepted or rebased — are the evaluations already made, PERF3 A3.)
  evaluate = rememberedEvaluate(evaluate);
  const ops = Array.isArray(input) ? input : null;
  if (!ops?.length) return { fail: fail(state, 'Pass "ops": a list of {tool, args, opId?}.') };
  const tx = state.tx ?? newTransactions(), results: Record<string, unknown>[] = [], kept: Op[] = [], orders: string[][] = [];
  let cur: ChatState = state;
  for (let k = 0; k < ops.length; k++) {
    let op = ops[k] as Record<string, unknown>;
    // (An op may name a consolidated tool, A5.3: it is kept as the v1 call, so a proposal replays the same.)
    if (isObj(op) && typeof op.tool === 'string') { const v1 = v1Call(op.tool, op.args); if (v1 && !('error' in v1)) op = { ...op, tool: v1.name, args: v1.args }; }
    if (!isObj(op) || typeof op.tool !== 'string' || !BATCHABLE.has(op.tool)) return { fail: fail(state, `op ${k}: tool is one of ${[...BATCHABLE].join(', ')}.`, { kept: 'nothing was applied' }) };
    const opId = typeof op.opId === 'string' ? op.opId : undefined, opArgs = isObj(op.args) ? op.args : {};
    if (opId && tx.applied.includes(opId)) { results.push({ op: k, opId, skipped: 'already applied' }); continue; }
    // (Through the dispatcher: a part tool may name an instance with "part", assembly tools are batchable too.)
    const r = await dispatch(cur, op.tool, opArgs, evaluate);
    if (r.isError) { let why: unknown = r.content; try { why = JSON.parse(r.content).error; } catch { /* plain text */ } return { fail: fail(state, `op ${k} (${op.tool}${opId ? ` ${opId}` : ''}) was refused: ${String(why)} Nothing was applied.`, { failed_op: k, kept: 'nothing was applied' }) }; }
    orders.push(idsOf(cur.doc.nodes)); cur = r.state; let did: unknown = r.summary; try { did = JSON.parse(r.content).did ?? r.summary; } catch { /* plain text */ }
    results.push({ op: k, ...(opId ? { opId } : {}), did }); kept.push({ tool: op.tool, args: opArgs, ...(opId ? { opId } : {}) });
  }
  const diff = treeDiff(state.doc, cur.doc), change = changeOf(factsOf(state.doc, state.bodies), factsOf(cur.doc, cur.bodies));
  const refs = await verifyReferences(cur.doc, cur.bodies, evaluate), broken = [...refs.problems.map(p => ({ where: p.where, name: p.name, ...(p.candidates.length ? { could_be: p.candidates } : { gone: true }) })), ...refs.changes.map(c => ({ where: c.where, name: c.was, now: c.now }))];
  return { cur, results, ops: kept, orders, diff, change, broken };
}
/** A document's feature ids in order. */
export const idsOf = (nodes: readonly ModelNode[]) => nodes.map((_, i) => featureId(nodes, i));
/** The studio side of a script (A5.2): each call through the dispatcher on the working part, a concise result. */
class ScriptOn implements ScriptHost {
  readonly commands = CHAT_COMMANDS;
  constructor(private readonly dispatch: PartRun, public cur: ChatState, private readonly evaluate: Evaluate, private readonly because: string) {}
  indexOf(id: string): number { return nodeIndexOf(this.cur.doc.nodes, id); }
  idAt(index: number): string | null { return Number.isInteger(index) && this.cur.doc.nodes[index] ? featureId(this.cur.doc.nodes, index) : null; }
  /**
   * The body a feature is part of now: the one holding its faces (after holes, a union or a cut, the body it went into),
   * else the body it made (A5.5: `difference([plate, tool])` after the plate's holes; unions in a loop onto one body).
   */
  bodyOf(id: string): string {
    const i = this.indexOf(id), made = i >= 0 ? bodyKeyFor(this.cur.doc.nodes, i) : id, prefix = `${id}.`;
    const holding = this.cur.bodies.filter(b => b.mesh.faces.some(f => f.name.split('+').some(n => n.startsWith(prefix))));
    return holding.length === 1 ? holding[0].key : holding.find(b => b.key === made)?.key ?? holding[0]?.key ?? made;
  }
  async call(tool: string, args: Record<string, unknown>): Promise<{ ok: true; added: string[]; did: string } | { ok: false; why: string }> {
    const was = this.cur.doc.nodes, before = new Set<string>();
    for (let i = 0; i < was.length; i++) before.add(featureId(was, i));
    // (Concise results and the script's reason, on the tools that take them: A9-3 refuses an argument a tool does not.)
    const v1 = v1Call(tool, args), named = v1 && !('error' in v1) ? v1.name : tool;
    const r = await this.dispatch(this.cur, tool, { ...args, ...(takesArgument(named, 'response_format') ? { response_format: 'concise' } : {}), ...(this.because && takesArgument(named, 'because') ? { because: this.because } : {}) }, this.evaluate);
    let out: Record<string, unknown> = {}; try { out = JSON.parse(r.content); } catch { /* plain text */ }
    if (r.isError) return { ok: false, why: String(out.error ?? r.content) };
    this.cur = r.state;
    const now = r.state.doc.nodes, added: string[] = [];
    for (let i = 0; i < now.length; i++) if (!before.has(featureId(now, i))) added.push(featureId(now, i));
    return { ok: true, added, did: String(out.did ?? r.summary) };
  }
}
/** A script run on a copy (A5.2): the part it leaves, its calls by line, the names it set; or the first problem, typed with its line (nothing applied). */
async function runScriptOn(dispatch: PartRun, state: ChatState, source: unknown, evaluate: Evaluate): Promise<{ fail: ToolOutcome } | { cur: ChatState; calls: ScriptRun['calls']; names: Record<string, string>; diff: TreeDiff; change: Record<string, unknown>; broken: Record<string, unknown>[] }> {
  if (typeof source !== 'string' || !source.trim()) return { fail: fail(state, 'Pass "source": the script (its language is in the tool description).') };
  const host = new ScriptOn(dispatch, state, rememberedEvaluate(evaluate), because);
  let run: ScriptRun;
  try { run = await runScript(parse(source), host); } catch (e) {
    if (!(e instanceof ScriptError)) throw e;
    return { fail: fail(state, `${e.message}${e.code === 'REFUSED' ? '' : '.'} Nothing was applied.`, { code: `script_${e.code.toLowerCase()}`, line: e.line, col: e.col, kept: 'nothing was applied' }) };
  }
  const cur = host.cur, diff = treeDiff(state.doc, cur.doc), change = changeOf(factsOf(state.doc, state.bodies), factsOf(cur.doc, cur.bodies));
  const refs = await verifyReferences(cur.doc, cur.bodies, evaluate), broken = [...refs.problems.map(p => ({ where: p.where, name: p.name, ...(p.candidates.length ? { could_be: p.candidates } : { gone: true }) })), ...refs.changes.map(c => ({ where: c.where, name: c.was, now: c.now }))];
  return { cur, calls: run.calls, names: run.names, diff, change, broken };
}

/**
 * Ops made on one state replayed one at a time on another (O133): each moved first (`moveOp`: the indices it names by
 * the ids they had — `orders`, the ids in order before each op — and the ids the ops made themselves as the ones the
 * replay hands out), then run. The ops as moved, or the first that names a feature gone or is refused.
 */
export async function moveOpsWith(dispatch: PartRun, state: ChatState, ops: readonly Op[], orders: readonly (readonly string[])[], evaluate: Evaluate, ids: Map<string, string> = new Map(), made?: readonly (readonly string[])[]): Promise<{ ops: Op[]; state: ChatState } | { error: string; op: number; ops: Op[] }> {
  let cur: ChatState = { ...state, policy: undefined };
  const out: Op[] = [];
  for (let k = 0; k < ops.length; k++) {
    const before = idsOf(cur.doc.nodes), { op, missing } = moveOp(ops[k], { from: orders[k] ?? before, to: before, ids });
    // (Stopped at the first that does not apply: the rest moved as far as known, not run.)
    const rest = () => [...out, op, ...ops.slice(k + 1).map((o, j) => moveOp(o, { from: orders[k + 1 + j] ?? before, to: before, ids }).op)];
    if (missing.length) return { error: `op ${k} (${op.tool}) names ${[...new Set(missing)].join(', ')}, which the part no longer has`, op: k, ops: rest() };
    const r = await dispatch(cur, op.tool, op.args ?? {}, evaluate);
    if (r.isError) return { error: `op ${k} (${op.tool}) was refused: ${errorOf(r)}`, op: k, ops: rest() };
    // (The ids it made, in the order made, are the ones it made where it was made: what later ops name.)
    const now = idsOf(r.state.doc.nodes), had = new Set(before), madeHere = now.filter(x => !had.has(x));
    const was = new Set(orders[k] ?? []), madeThere = made?.[k] ?? (orders[k + 1] ?? []).filter(x => !was.has(x));
    madeThere.forEach((x, i) => { if (madeHere[i] && madeHere[i] !== x) ids.set(x, madeHere[i]); });
    out.push(op); cur = r.state;
  }
  return { ops: out, state: cur };
}

export const errorOf = (o: ToolOutcome) => { try { return String(JSON.parse(o.content).error); } catch { return o.content; } };

async function applyOpsTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate, dispatch: PartRun): Promise<ToolOutcome> {
  // All or nothing: each op runs on what the one before left; one refusal and nothing is applied.
  const tx = state.tx ?? newTransactions(), dry = args.dryRun === true, run = await runOps(dispatch, state, args.ops, evaluate);
  if ('fail' in run) return run.fail;
  const { cur, results, diff, change, broken } = run;
  const body = { ...(dry ? { dryRun: true, would_apply: results } : { ok: true, applied: results }), diff, change, ...(broken.length ? { broken_references: broken } : {}) };
  if (dry) return { state, content: json(body), isError: false, changed: false, summary: `dry run: ${results.length} ops` };
  const applied = [...tx.applied, ...results.flatMap(r => typeof r.opId === 'string' && !r.skipped ? [r.opId] : [])].slice(-OP_IDS);
  // The feature diff is for display; approval and saving must cover the whole document.
  return { state: { ...cur, tx: { ...tx, applied } }, content: json({ ...body, facts: factsOf(cur.doc, cur.bodies) }), isError: false, changed: canonical(state.doc) !== canonical(cur.doc), summary: `${results.length} ops applied` };
}
async function runScriptTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate, dispatch: PartRun): Promise<ToolOutcome> {
  // (A5.2, O10: a script's commands and features as one change, all or nothing, as apply_ops.)
  const dry = args.dryRun === true, run = await runScriptOn(dispatch, state, args.source, evaluate);
  if ('fail' in run) return run.fail;
  const { cur, calls, names, diff, change, broken } = run;
  const body = { ...(dry ? { dryRun: true } : { ok: true }), script: SCRIPT_VERSION, calls, names, diff, change, ...(broken.length ? { broken_references: broken } : {}) };
  if (dry) return { state, content: json(body), isError: false, changed: false, summary: `dry run: a script of ${calls.length} calls` };
  return { state: cur, content: json({ ...body, facts: factsOf(cur.doc, cur.bodies) }), isError: false, changed: canonical(state.doc) !== canonical(cur.doc), summary: `a script of ${calls.length} calls` };
}
async function checkpointTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const label = String(args.name ?? ''); if (!label) return fail(state, 'A checkpoint takes a name.');
  const tx = state.tx ?? newTransactions(), names = Object.keys(tx.checkpoints).filter(n => n !== label);
  const checkpoints = Object.fromEntries([...names.slice(-(CHECKPOINTS - 1)).map(n => [n, tx.checkpoints[n]] as const), [label, state.doc] as const]);
  return { state: { ...state, tx: { ...tx, checkpoints } }, content: json({ ok: true, checkpoint: label, model_hash: modelHash(state.doc), checkpoints: Object.keys(checkpoints) }), isError: false, changed: false, summary: `checkpoint ${label}` };
}
async function restoreTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const doc = state.tx?.checkpoints[String(args.name ?? '')];
  if (!doc) return fail(state, `No checkpoint "${String(args.name)}"; checkpoints: ${Object.keys(state.tx?.checkpoints ?? {}).join(', ') || 'none'}.`);
  return accept(state, doc, evaluate, `restored checkpoint ${String(args.name)}`, { diff: treeDiff(state.doc, doc) });
}
async function diffTool(state: ChatState, args: Record<string, unknown>): Promise<ToolOutcome> {
  const pick = (n: unknown) => n === undefined || n === 'current' ? state.doc : n === 'best' ? state.policy?.best?.doc : state.tx?.checkpoints[String(n)];
  const a = pick(args.from), b = pick(args.to);
  if (!a || !b) return fail(state, `from and to are checkpoint names, "best" or "current" (checkpoints: ${Object.keys(state.tx?.checkpoints ?? {}).join(', ') || 'none'}).`);
  return { state, content: json({ from: args.from ?? 'current', to: args.to ?? 'current', diff: treeDiff(a, b) }), isError: false, changed: false, summary: 'diff' };
}
async function restoreBestTool(state: ChatState, args: Record<string, unknown>, evaluate: Evaluate): Promise<ToolOutcome> {
  const best = state.policy?.best;
  if (!best) return fail(state, 'No checked snapshot yet: run check_spec first.');
  if (best.hash === modelHash(state.doc)) return fail(state, 'The part is the best snapshot already.');
  return accept(state, best.doc, evaluate, `restored the best snapshot ${best.hash} (${best.pass} passing)`);
}

/** The history group's handlers, by v1 tool name (R3). */
export const HISTORY_HANDLERS: Readonly<Record<string, PartHandler>> = { apply_ops: applyOpsTool, run_script: runScriptTool, checkpoint: checkpointTool, restore: restoreTool, diff: diffTool, restore_best: restoreBestTool };
