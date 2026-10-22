// A7.5 (O94; #2181, owner 2026-10-21): candidates isolated, verified and approved. A7/A8's Integrator already refuses a
// stale base, rebases only explicitly, runs the gates and the Verifier, and holds what is undecided. A7.5 adds, around
// it, a board of candidates:
//   - each candidate is built on its own copy of the accepted state — the accepted part and the other candidates never
//     see it — and its evidence (facts, requirement verdicts, gates) is stamped with the revision and the acceptance
//     token it was built on;
//   - every call carries an operationId: a second delivery of one is answered from the board's trace, never applied
//     twice; a cancelled or timed-out candidate leaves everything else as it was, and its result arriving later is
//     refused (CANCELLED, TIMED_OUT); a per-candidate budget is refused by name;
//   - accepting runs the Integrator on the accepted state, then a **replay gate**: the document saved as the studio
//     saves it, read back by a fresh reader (a fresh process from the CLI), evaluated again — its facts and requirement
//     verdicts must match within each check's tolerance, or the patch is rejected with a typed reason;
//   - undo and redo restore the accepted document. The **acceptance token** is a counter that every accept, undo and
//     redo moves on and never reuses: a candidate is accepted only on the token it was built on, so one built before
//     an undo can never become valid again by accident — even when the content it was built on is back.
// The board's clock is logical (ticks), so a run is the same to the byte.
import type { StudioDoc } from '../engine/doc';
import { encodeStudioFile, readStudioFile } from '../engine/container';
import { BATCHABLE_TOOLS, dispatchTool, type ChatState, type Evaluate } from '../chat/tools';
import type { Op } from '../chat/proposals';
import { checkSpec } from '../chat/spec';
import { factsOf } from '../chat/observe';
import { integrate, revisionOf, runGates, type GateResult } from './team';

export type BoardCode = 'DUPLICATE' | 'CANCELLED' | 'TIMED_OUT' | 'BUDGET_EXCEEDED' | 'STALE_BASE' | 'UNSUPPORTED_OP' | 'WRONG_UNIT' | 'WRONG_TARGET'
  | 'MISSING_DEPENDENCY' | 'NOT_BUILT' | 'UNKNOWN_CANDIDATE' | 'GATE_FAILED' | 'REPLAY_UNREADABLE' | 'REPLAY_FACTS_DIFFER' | 'REPLAY_VERDICT_DIFFERS'
  | 'NOTHING_TO_UNDO' | 'NOTHING_TO_REDO' | 'CORRUPT_FILE';
export type BudgetName = 'ops' | 'bodies' | 'triangles';
export interface CandidateRequest {
  operationId: string; candidate: string;
  patch: { ops: Op[]; /** The unit the values are in (the studio's documents are mm). */ units?: string; /** Candidates that must be accepted first. */ dependsOn?: string[] };
  budget?: Partial<Record<BudgetName, number>>;
  /** Ticks from its start by which its result must arrive. */
  deadline?: number;
}
/** What a candidate's or a reopened document's state says: its facts, and each requirement's verdict and measure. */
export interface Evidence {
  revision: string; token: number;
  facts: { solids: number; volume_mm3: number; bbox: { min: number[]; max: number[] } | null };
  verdicts: Record<string, { status: string; measured?: number }>;
  gates?: GateResult[];
}
export type CandidateStatus = 'pending' | 'built' | 'failed' | 'cancelled' | 'timed_out' | 'accepted' | 'refused';
interface Candidate { id: string; operationId: string; token: number; base: string; ops: Op[]; dependsOn: string[]; budget: Partial<Record<BudgetName, number>>; startedAt: number; deadline: number | null; status: CandidateStatus; state?: ChatState; evidence?: Evidence; code?: BoardCode; message?: string }
export interface Outcome { seq: number; op: string; operationId: string; candidate?: string; ok: boolean; code?: BoardCode; message?: string; duplicate?: true; revision: string; token: number; volume_mm3: number | null; evidence?: Evidence }
/** A document read back by a fresh reader: its evidence, or why it could not be read. */
export type Reopen = (bytes: Uint8Array) => Promise<Evidence | { error: string }>;

const r9 = (v: number) => Math.round(v * 1e9) / 1e9 + 0;
const clone = <T>(v: T): T => structuredClone(v);

/** The evidence of a state: facts and the requirements' verdicts (their measures where numeric). */
export async function evidenceOf(doc: StudioDoc, bodies: ChatState['bodies'], evaluate: Evaluate, token: number): Promise<Evidence> {
  const f = factsOf(doc, bodies), spec = await checkSpec(doc, bodies, evaluate), verdicts: Evidence['verdicts'] = {};
  for (const [id, o] of spec.outcomes) verdicts[id] = { status: o.status, ...(typeof o.measured === 'number' ? { measured: r9(o.measured) } : {}) };
  return { revision: revisionOf(doc), token, facts: { solids: f.solids, volume_mm3: r9(f.volume_mm3), bbox: f.bbox ? { min: f.bbox.min.map(r9), max: f.bbox.max.map(r9) } : null }, verdicts };
}
/** A fresh reader in this process: the saved bytes parsed as the studio opens a file, evaluated again. */
export function inProcessReopen(evaluate: Evaluate): Reopen {
  return async bytes => {
    let read: Awaited<ReturnType<typeof readStudioFile>>;
    try { read = await readStudioFile(bytes); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
    if ('error' in read) return { error: read.error };
    const ev = await evaluate(read.doc); if (!ev || !ev.ok) return { error: ev && !ev.ok ? ev.error.title : 'not evaluated' };
    return evidenceOf(read.doc, ev.bodies, evaluate, -1);
  };
}
/** Where two evidences differ: facts to 1e-9 (relative, for the volume), each verdict, each measure within its check's tolerance. */
export function replayDiff(live: Evidence, back: Evidence, tolerances: Readonly<Record<string, number>>): { code: 'REPLAY_FACTS_DIFFER' | 'REPLAY_VERDICT_DIFFERS'; message: string } | null {
  const a = live.facts, b = back.facts;
  if (a.solids !== b.solids || Math.abs(a.volume_mm3 - b.volume_mm3) > 1e-9 * Math.max(1, Math.abs(a.volume_mm3)) || JSON.stringify(a.bbox) !== JSON.stringify(b.bbox))
    return { code: 'REPLAY_FACTS_DIFFER', message: `read back, the part is not the one accepted: ${JSON.stringify(b)} against ${JSON.stringify(a)}` };
  for (const id of new Set([...Object.keys(live.verdicts), ...Object.keys(back.verdicts)])) {
    const x = live.verdicts[id], y = back.verdicts[id];
    if (!x || !y || x.status !== y.status) return { code: 'REPLAY_VERDICT_DIFFERS', message: `requirement ${id}: ${x?.status ?? 'absent'} as accepted, ${y?.status ?? 'absent'} read back` };
    if (x.measured !== undefined && y.measured !== undefined && Math.abs(x.measured - y.measured) > (tolerances[id] ?? 1e-9)) return { code: 'REPLAY_VERDICT_DIFFERS', message: `requirement ${id}: measured ${x.measured} as accepted, ${y.measured} read back (tolerance ${tolerances[id] ?? 1e-9})` };
  }
  return null;
}

/** The board: the accepted state, its history and token, the candidates, every call's outcome by operationId. */
export class CandidateBoard {
  private accepted: ChatState; private token = 0; private now = 0; private seq = 0;
  private readonly undoStack: ChatState[] = []; private readonly redoStack: ChatState[] = [];
  private readonly candidates = new Map<string, Candidate>(); private readonly done = new Map<string, Outcome>();
  readonly outcomes: Outcome[] = [];
  constructor(start: ChatState, private readonly evaluate: Evaluate, private readonly reopen: Reopen = inProcessReopen(evaluate)) { this.accepted = start; }

  /** The accepted document, its revision and token (the token moves on every accept, undo and redo, never back). */
  get state(): { doc: StudioDoc; revision: string; token: number } { return { doc: this.accepted.doc, revision: revisionOf(this.accepted.doc), token: this.token }; }
  statusOf(id: string): CandidateStatus | null { return this.candidates.get(id)?.status ?? null; }
  evidenceOf(id: string): Evidence | null { return this.candidates.get(id)?.evidence ?? null; }
  /** The logical clock: ticks pass. */
  tick(n = 1): void { this.now += n; }

  /** The accepted part's volume (mm³), null with no body. */
  volume(): number | null { const v = this.accepted.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0); return this.accepted.bodies.length ? r9(v) : null; }
  private record(op: string, operationId: string, o: Partial<Outcome> & { ok: boolean }): Outcome {
    const out: Outcome = { seq: ++this.seq, op, operationId, ...o, revision: revisionOf(this.accepted.doc), token: this.token, volume_mm3: this.volume() } as Outcome;
    this.outcomes.push(out); this.done.set(operationId, out); return out;
  }
  /** A second delivery of an operation: its first outcome, said to be a duplicate — never run again. */
  private duplicate(operationId: string): Outcome | null {
    const first = this.done.get(operationId); if (!first) return null;
    const out: Outcome = { ...first, seq: ++this.seq, duplicate: true, code: 'DUPLICATE', message: `operation ${operationId} was delivered before (seq ${first.seq}): answered from the trace, not applied again` };
    this.outcomes.push(out); return out;
  }
  private refuse(op: string, operationId: string, code: BoardCode, message: string, candidate?: string): Outcome { return this.record(op, operationId, { ok: false, code, message, ...(candidate ? { candidate } : {}) }); }

  /** A candidate started on a private copy of the accepted state: checked before it runs (unit, ops, dependencies, its ops budget). */
  start(req: CandidateRequest): Outcome {
    const dup = this.duplicate(req.operationId); if (dup) return dup;
    const units = req.patch.units ?? 'mm', ops = req.patch.ops, budget = req.budget ?? {};
    if (units !== 'mm') return this.refuse('start', req.operationId, 'WRONG_UNIT', `the patch's values are in ${units}; the studio's documents are in mm`, req.candidate);
    const unsupported = ops.find(o => !BATCHABLE_TOOLS.has(o.tool));
    if (unsupported) return this.refuse('start', req.operationId, 'UNSUPPORTED_OP', `${unsupported.tool} is not an operation a candidate may hold`, req.candidate);
    const missing = (req.patch.dependsOn ?? []).filter(d => this.candidates.get(d)?.status !== 'accepted');
    if (missing.length) return this.refuse('start', req.operationId, 'MISSING_DEPENDENCY', `it depends on ${missing.join(', ')}, not accepted`, req.candidate);
    if (budget.ops !== undefined && ops.length > budget.ops) return this.refuse('start', req.operationId, 'BUDGET_EXCEEDED', `budget ops: ${ops.length} over ${budget.ops}`, req.candidate);
    this.candidates.set(req.candidate, { id: req.candidate, operationId: req.operationId, token: this.token, base: revisionOf(this.accepted.doc), ops: clone(ops), dependsOn: req.patch.dependsOn ?? [], budget, startedAt: this.now, deadline: req.deadline ?? null, status: 'pending',
      state: { ...this.accepted, doc: clone(this.accepted.doc), turnBase: clone(this.accepted.doc) } });
    return this.record('start', req.operationId, { ok: true, candidate: req.candidate });
  }
  /** The candidate built on its copy and its result delivered — refused when it was cancelled or its deadline passed meanwhile. */
  async run(operationId: string, id: string): Promise<Outcome> {
    const dup = this.duplicate(operationId); if (dup) return dup;
    const c = this.candidates.get(id); if (!c) return this.refuse('run', operationId, 'UNKNOWN_CANDIDATE', `no candidate ${id}`, id);
    if (c.status !== 'pending') return this.refuse('run', operationId, c.status === 'cancelled' ? 'CANCELLED' : c.status === 'timed_out' ? 'TIMED_OUT' : 'NOT_BUILT', `${id} is ${c.status}`, id);
    const own = c.state!, ev = await this.evaluate(own.doc), before: ChatState = { ...own, bodies: ev && ev.ok ? ev.bodies : own.bodies };
    const r = await dispatchTool(before, 'apply_ops', { ops: c.ops }, this.evaluate);
    // (The result arrives now: after a cancel or past its deadline it is refused, its work discarded.)
    // (The status read again: a cancel may have come while it was building.)
    if ((c.status as CandidateStatus) === 'cancelled') return this.refuse('run', operationId, 'CANCELLED', `${id}'s result arrived after it was cancelled: refused`, id);
    if (c.deadline !== null && this.now - c.startedAt > c.deadline) { c.status = 'timed_out'; delete c.state; return this.refuse('run', operationId, 'TIMED_OUT', `${id}'s result arrived ${this.now - c.startedAt} ticks after its start, past its ${c.deadline}`, id); }
    if (r.isError) {
      let msg = r.content; try { msg = JSON.parse(r.content).error ?? msg; } catch { /* as it is */ }
      c.status = 'failed'; c.code = /No face, edge or body|no feature|index/i.test(msg) ? 'WRONG_TARGET' : 'GATE_FAILED'; c.message = msg; delete c.state;
      return this.refuse('run', operationId, c.code, msg, id);
    }
    const tris = r.state.bodies.reduce((s, b) => s + b.mesh.indices.length / 3, 0);
    const over = c.budget.bodies !== undefined && r.state.bodies.length > c.budget.bodies ? `budget bodies: ${r.state.bodies.length} over ${c.budget.bodies}` : c.budget.triangles !== undefined && tris > c.budget.triangles ? `budget triangles: ${tris} over ${c.budget.triangles}` : null;
    if (over) { c.status = 'failed'; c.code = 'BUDGET_EXCEEDED'; delete c.state; return this.refuse('run', operationId, 'BUDGET_EXCEEDED', over, id); }
    const g = await runGates({ before, after: r.state, broken: 0 }, this.evaluate), evidence = { ...(await evidenceOf(r.state.doc, r.state.bodies, this.evaluate, c.token)), gates: g.gates };
    c.status = 'built'; c.evidence = evidence; c.state = r.state;
    return this.record('run', operationId, { ok: true, candidate: id, evidence });
  }
  /** A candidate cancelled: its state discarded; nothing else touched. */
  cancel(operationId: string, id: string): Outcome {
    const dup = this.duplicate(operationId); if (dup) return dup;
    const c = this.candidates.get(id); if (!c) return this.refuse('cancel', operationId, 'UNKNOWN_CANDIDATE', `no candidate ${id}`, id);
    if (c.status === 'accepted') return this.refuse('cancel', operationId, 'NOT_BUILT', `${id} is accepted: undo it instead`, id);
    c.status = 'cancelled'; delete c.state; return this.record('cancel', operationId, { ok: true, candidate: id });
  }
  /** A built candidate accepted: on the token it was built on, through the Integrator, then the replay gate. */
  async accept(operationId: string, id: string): Promise<Outcome> {
    const dup = this.duplicate(operationId); if (dup) return dup;
    const c = this.candidates.get(id); if (!c) return this.refuse('accept', operationId, 'UNKNOWN_CANDIDATE', `no candidate ${id}`, id);
    if (c.status !== 'built') return this.refuse('accept', operationId, c.status === 'cancelled' ? 'CANCELLED' : c.status === 'timed_out' ? 'TIMED_OUT' : 'NOT_BUILT', `${id} is ${c.status}, not built`, id);
    if (c.token !== this.token) return this.refuse('accept', operationId, 'STALE_BASE', `${id} was built on token ${c.token} (revision ${c.base}); the part is at token ${this.token} (revision ${revisionOf(this.accepted.doc)}): build it again on it`, id);
    const out = await integrate(this.accepted, { id, by: 'board', base: c.base, ops: c.ops }, this.evaluate, { seq: this.seq + 1 });
    if (out.trace.decision !== 'applied') { const f = out.trace.gates.flatMap(x => x.findings)[0]; return this.refuse('accept', operationId, out.trace.decision === 'stale' ? 'STALE_BASE' : 'GATE_FAILED', f ? `${f.code}: ${f.message}` : out.trace.decision, id); }
    // The replay gate: saved as the studio saves it, read back fresh, evaluated again; facts and verdicts as accepted.
    const live = await evidenceOf(out.state.doc, out.state.bodies, this.evaluate, this.token + 1);
    let bytes: Uint8Array;
    try { bytes = encodeStudioFile(out.state.doc); } catch (e) { return this.refuse('accept', operationId, 'REPLAY_UNREADABLE', `it cannot be saved: ${e instanceof Error ? e.message : String(e)}`, id); }
    const back = await this.reopen(bytes);
    if ('error' in back) return this.refuse('accept', operationId, 'REPLAY_UNREADABLE', `saved, it does not read back: ${back.error}`, id);
    const tol = Object.fromEntries((out.state.doc.requirements ?? []).map(q => [q.id, typeof (q.check as { tol?: number }).tol === 'number' ? (q.check as { tol: number }).tol : 1e-9]));
    const diff = replayDiff(live, back, tol);
    if (diff) return this.refuse('accept', operationId, diff.code, diff.message, id);
    this.undoStack.push(this.accepted); this.redoStack.length = 0;
    this.accepted = out.state; this.token++; c.status = 'accepted'; delete c.state;
    return this.record('accept', operationId, { ok: true, candidate: id, evidence: live });
  }
  /** The last accept undone: the document before it back, a new token. */
  undo(operationId: string): Outcome {
    const dup = this.duplicate(operationId); if (dup) return dup;
    const prev = this.undoStack.pop(); if (!prev) return this.refuse('undo', operationId, 'NOTHING_TO_UNDO', 'nothing accepted to undo');
    this.redoStack.push(this.accepted); this.accepted = prev; this.token++;
    return this.record('undo', operationId, { ok: true });
  }
  /** The undone accept made again: its document back, a new token. */
  redo(operationId: string): Outcome {
    const dup = this.duplicate(operationId); if (dup) return dup;
    const next = this.redoStack.pop(); if (!next) return this.refuse('redo', operationId, 'NOTHING_TO_REDO', 'nothing undone to redo');
    this.undoStack.push(this.accepted); this.accepted = next; this.token++;
    return this.record('redo', operationId, { ok: true });
  }
  /** The accepted document as the studio saves it. */
  save(): Uint8Array { return encodeStudioFile(this.accepted.doc); }
  /** A board on a saved file, read fresh (a corrupt file refused, typed). */
  static async open(bytes: Uint8Array, evaluate: Evaluate, reopen?: Reopen): Promise<CandidateBoard | { code: 'CORRUPT_FILE'; message: string }> {
    let read: Awaited<ReturnType<typeof readStudioFile>>;
    try { read = await readStudioFile(bytes); } catch (e) { return { code: 'CORRUPT_FILE', message: e instanceof Error ? e.message : String(e) }; }
    if ('error' in read) return { code: 'CORRUPT_FILE', message: read.error };
    const ev = await evaluate(read.doc); if (!ev || !ev.ok) return { code: 'CORRUPT_FILE', message: ev && !ev.ok ? ev.error.title : 'not evaluated' };
    return new CandidateBoard({ doc: read.doc, bodies: ev.bodies, turnBase: read.doc } as ChatState, evaluate, reopen);
  }
}
