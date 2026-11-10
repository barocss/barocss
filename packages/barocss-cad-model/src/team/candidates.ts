// A7.5 (O94; #2181, owner 2026-10-21): candidates isolated, verified and approved. A7/A8's Integrator already refuses a
// stale base, rebases only explicitly, runs the gates and the Verifier, and holds what is undecided. A7.5 adds, around
// it, a board of candidates:
//   - each candidate is built on its own copy of the accepted state — the accepted part and the other candidates never
//     see it — and its evidence (facts, requirement verdicts, gates) is stamped with the revision and the acceptance
//     token it was built on;
//   - every call reserves its operationId and request before evaluating. In-flight repeats receive a pending result,
//     then completed repeats replay the first outcome. A conflicting request cannot reuse that ID. A cancelled or
//     timed-out candidate leaves everything else as it was. Its late result cannot publish; a budget is refused by name;
//   - accepting runs the Integrator on the accepted state, then a **replay gate**: the document saved as the studio
//     saves it, read back by a fresh reader (a fresh process from the CLI), evaluated again — its facts and requirement
//     verdicts must match within each check's tolerance, or the patch is rejected with a typed reason;
//   - undo and redo restore the accepted document. The **acceptance token** is a counter that every accept, undo and
//     redo moves on and never reuses: a candidate is accepted only on the token it was built on, so one built before
//     an undo can never become valid again by accident — even when the content it was built on is back.
// The board's clock is logical (ticks), so a run is the same to the byte.
import type { StudioDoc } from '../engine/doc';
import { encodeStudioFile, readStudioFile } from '../engine/container';
import { personRowsRefusal } from '../engine/rowSources';
import { BATCHABLE_TOOLS, dispatchTool, type ChatState, type Evaluate } from '../chat/tools';
import type { Op } from '../engine/schema/proposals';
import { checkSpec } from '../chat/spec';
import { factsOf } from '../chat/observe';
import { integrate, revisionOf, runGates, type GateResult } from './team';
import { canonical } from '../util/revision';
import { r9 } from '../util/round';

export type BoardCode = 'DUPLICATE' | 'CANCELLED' | 'TIMED_OUT' | 'BUDGET_EXCEEDED' | 'STALE_BASE' | 'UNSUPPORTED_OP' | 'WRONG_UNIT' | 'WRONG_TARGET'
  | 'MISSING_DEPENDENCY' | 'NOT_BUILT' | 'UNKNOWN_CANDIDATE' | 'GATE_FAILED' | 'REPLAY_UNREADABLE' | 'REPLAY_FACTS_DIFFER' | 'REPLAY_VERDICT_DIFFERS'
  | 'NOTHING_TO_UNDO' | 'NOTHING_TO_REDO' | 'CORRUPT_FILE' | 'OPERATION_PENDING' | 'OPERATION_CONFLICT'
  | 'CANDIDATE_REPLACED' | 'ALREADY_COMMITTED' | 'BAD_REQUEST';
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
  facts: { solids: number; volume: number; bbox: { min: number[]; max: number[] } | null };
  verdicts: Record<string, { status: string; measured?: number }>;
  gates?: GateResult[];
}
export type CandidateStatus = 'pending' | 'built' | 'failed' | 'cancelled' | 'timed_out' | 'accepted' | 'refused';
interface Candidate {
  id: string; token: number; base: string; ops: Op[]; prerequisites: Candidate[];
  budget: Partial<Record<BudgetName, number>>; startedAt: number; deadline: number | null;
  status: CandidateStatus; state?: ChatState; evidence?: Evidence;
}
export interface Outcome { seq: number; op: string; operationId: string; candidate?: string; ok: boolean; code?: BoardCode; message?: string; duplicate?: true; revision: string; token: number; volume: number | null; evidence?: Evidence }
/** A document read back by a fresh reader: its evidence, or why it could not be read. */
export type Reopen = (bytes: Uint8Array) => Promise<Evidence | { error: string }>;

const clone = <T>(v: T): T => structuredClone(v);
const copyState = ({ rowFiles, ...state }: ChatState): ChatState => ({ ...clone(state), rowFiles });
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

// The board accepts the same JSON data as its CLI. Optional object fields may be absent.
function operationPayload(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  const array = Array.isArray(value);
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  const keys = Reflect.ownKeys(value).filter(key => !array || key !== 'length');
  if (array && keys.length !== value.length) return false;
  ancestors.add(value);
  const valid = keys.every((key, index) => {
    if (typeof key !== 'string' || (array && key !== String(index))) return false;
    const field = Object.getOwnPropertyDescriptor(value, key)!;
    return field.enumerable && Object.hasOwn(field, 'value')
      && ((!array && field.value === undefined) || operationPayload(field.value, ancestors));
  });
  ancestors.delete(value);
  return valid;
}

interface AcceptedSnapshot { state: ChatState; lineage: AcceptedGeneration | null }
interface AcceptedGeneration { candidate: Candidate; previous: AcceptedGeneration | null }
interface Operation {
  op: string; operationId: string; key: string; candidate?: string; outcome?: Outcome;
}
type OutcomeFields = Pick<Outcome, 'ok' | 'code' | 'message' | 'evidence'>;

/** The evidence of a state: facts and the requirements' verdicts (their measures where numeric). */
export async function evidenceOf(doc: StudioDoc, bodies: ChatState['bodies'], evaluate: Evaluate, token: number): Promise<Evidence> {
  const f = factsOf(doc, bodies), spec = await checkSpec(doc, bodies, evaluate), verdicts: Evidence['verdicts'] = {};
  for (const [id, o] of spec.outcomes) verdicts[id] = { status: o.status, ...(typeof o.measured === 'number' ? { measured: r9(o.measured) } : {}) };
  return { revision: revisionOf(doc), token, facts: { solids: f.solids, volume: r9(f.volume), bbox: f.bbox ? { min: f.bbox.min.map(r9), max: f.bbox.max.map(r9) } : null }, verdicts };
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
  if (a.solids !== b.solids || Math.abs(a.volume - b.volume) > 1e-9 * Math.max(1, Math.abs(a.volume)) || JSON.stringify(a.bbox) !== JSON.stringify(b.bbox))
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
  private accepted: AcceptedSnapshot; private token = 0; private now = 0; private seq = 0;
  private readonly undoStack: AcceptedSnapshot[] = []; private readonly redoStack: AcceptedSnapshot[] = [];
  private readonly candidates = new Map<string, Candidate>();
  private readonly operations = new Map<string, Operation>();
  private readonly trace: Outcome[] = [];
  private readonly evaluate: Evaluate;
  private readonly reopen: Reopen;
  constructor(start: ChatState, evaluate: Evaluate, reopen?: Reopen) {
    this.accepted = { state: copyState(start), lineage: null };
    // An evaluator may cache or retain its input and result. Only the board owns its snapshots.
    this.evaluate = async doc => clone(await evaluate(clone(doc)));
    this.reopen = reopen ?? inProcessReopen(this.evaluate);
  }

  /** The accepted document, its revision and token (the token moves on every accept, undo and redo, never back). */
  get state(): { doc: StudioDoc; revision: string; token: number } { return { doc: clone(this.accepted.state.doc), revision: revisionOf(this.accepted.state.doc), token: this.token }; }
  get outcomes(): Outcome[] { return clone(this.trace); }
  statusOf(id: string): CandidateStatus | null { return this.candidates.get(id)?.status ?? null; }
  evidenceOf(id: string): Evidence | null { return clone(this.candidates.get(id)?.evidence ?? null); }
  /** The logical clock: ticks pass. */
  tick(n = 1): void { this.now += n; }

  /** The accepted part's volume (mm³), null with no body. */
  volume(): number | null { const v = this.accepted.state.bodies.reduce((s, b) => s + (b.volume ?? 0), 0); return this.accepted.state.bodies.length ? r9(v) : null; }

  private emit(out: Omit<Outcome, 'seq'>): Outcome {
    const event = { ...out, seq: ++this.seq };
    this.trace.push(event);
    return event;
  }
  private current(op: string, operationId: string, candidate: string | undefined, fields: OutcomeFields): Outcome {
    return this.emit({
      op, operationId, ...(candidate ? { candidate } : {}), ...fields,
      revision: revisionOf(this.accepted.state.doc), token: this.token, volume: this.volume(),
    });
  }
  private begin(op: string, operationId: string, candidate?: string, payload?: unknown): Operation | Outcome {
    const key = canonical([op, candidate, payload]), prior = this.operations.get(operationId);
    if (!prior) {
      const operation = { op, operationId, candidate, key };
      this.operations.set(operationId, operation);
      return operation;
    }
    if (prior.key !== key) return clone(this.current(op, operationId, candidate, {
      ok: false, code: 'OPERATION_CONFLICT', message: `operation ${operationId} was reserved for a different request`,
    }));
    if (!prior.outcome) return clone(this.current(op, operationId, candidate, {
      ok: false, code: 'OPERATION_PENDING', message: `operation ${operationId} is still in progress`,
    }));
    const first = prior.outcome;
    return clone(this.emit({
      ...first, duplicate: true, code: 'DUPLICATE',
      message: `operation ${operationId} was delivered before (seq ${first.seq}): answered from the trace, not applied again`,
    }));
  }
  private finish(op: Operation, fields: OutcomeFields): Outcome {
    const out = this.current(op.op, op.operationId, op.candidate, fields);
    op.outcome = out;
    return clone(out);
  }
  private refuse(op: Operation, code: BoardCode, message: string): Outcome { return this.finish(op, { ok: false, code, message }); }

  private includes(candidate: Candidate): boolean {
    if (this.candidates.get(candidate.id) !== candidate || candidate.status !== 'accepted') return false;
    for (let entry = this.accepted.lineage; entry; entry = entry.previous) if (entry.candidate === candidate) return true;
    return false;
  }

  private candidateProblem(c: Candidate, phase: 'pending' | 'built'): { code: BoardCode; message: string } | null {
    if (this.candidates.get(c.id) !== c) return { code: 'CANDIDATE_REPLACED', message: `${c.id} was replaced by a new candidate` };
    if (c.status === 'cancelled') return { code: 'CANCELLED', message: `${c.id} was cancelled` };
    if (c.status === 'timed_out') return { code: 'TIMED_OUT', message: `${c.id} exceeded its build deadline` };
    if (c.status !== phase) return { code: 'NOT_BUILT', message: `${c.id} is ${c.status}` };
    const refuseStale = (code: BoardCode, message: string) => {
      if (phase === 'pending') { c.status = 'refused'; delete c.state; }
      return { code, message };
    };
    if (c.token !== this.token) return refuseStale('STALE_BASE', `${c.id} was built on token ${c.token} (revision ${c.base}); the part is at token ${this.token} (revision ${revisionOf(this.accepted.state.doc)}): build it again on it`);
    const missing = c.prerequisites.find(p => !this.includes(p));
    if (missing) return refuseStale('MISSING_DEPENDENCY', `${c.id} requires the accepted generation of ${missing.id}`);
    if (phase === 'pending' && c.deadline !== null && this.now - c.startedAt > c.deadline) {
      c.status = 'timed_out'; delete c.state;
      return { code: 'TIMED_OUT', message: `${c.id}'s result arrived ${this.now - c.startedAt} ticks after its start, past its ${c.deadline}` };
    }
    return null;
  }

  /** A candidate started on a private copy of the accepted state. */
  start(req: CandidateRequest): Outcome {
    const { operationId, candidate, ...payload } = req;
    const { budget, deadline } = payload;
    if (!operationPayload(payload)
      || (budget !== undefined && (!budget || Object.values(budget).some(value => !Number.isSafeInteger(value) || value! < 0)))
      || (deadline !== undefined && (!Number.isSafeInteger(deadline) || deadline < 0))) {
      return clone(this.current('start', operationId, candidate, {
        ok: false, code: this.operations.has(operationId) ? 'OPERATION_CONFLICT' : 'BAD_REQUEST',
        message: 'the candidate needs JSON data and nonnegative integer budget and deadline values',
      }));
    }
    const op = this.begin('start', operationId, candidate, payload); if ('ok' in op) return op;
    try {
      const units = req.patch.units ?? 'mm', ops = req.patch.ops;
      if (units !== 'mm') return this.refuse(op, 'WRONG_UNIT', `the patch's values are in ${units}; the studio's documents are mm`);
      const unsupported = ops.find(o => !BATCHABLE_TOOLS.has(o.tool));
      if (unsupported) return this.refuse(op, 'UNSUPPORTED_OP', `${unsupported.tool} is not an operation a candidate may hold`);
      const prerequisites: Candidate[] = [], missing: string[] = [];
      for (const id of req.patch.dependsOn ?? []) {
        const required = this.candidates.get(id);
        if (required && id !== candidate && this.includes(required)) prerequisites.push(required);
        else missing.push(id);
      }
      if (missing.length) return this.refuse(op, 'MISSING_DEPENDENCY', `it depends on ${missing.join(', ')}, not accepted`);
      if (budget?.ops !== undefined && ops.length > budget.ops) return this.refuse(op, 'BUDGET_EXCEEDED', `budget ops: ${ops.length} over ${budget.ops}`);
      const state = copyState(this.accepted.state);
      state.turnBase = clone(state.doc);
      this.candidates.set(candidate, {
        id: candidate, token: this.token, base: revisionOf(state.doc), ops: clone(ops), prerequisites,
        budget: { ...budget }, startedAt: this.now, deadline: req.deadline ?? null, status: 'pending', state,
      });
      return this.finish(op, { ok: true });
    } catch (error) {
      return this.refuse(op, 'GATE_FAILED', errorText(error));
    }
  }

  /** Evaluate on the candidate's copy and publish evidence only while that generation is current. */
  async run(operationId: string, id: string): Promise<Outcome> {
    const op = this.begin('run', operationId, id); if ('ok' in op) return op;
    const c = this.candidates.get(id); if (!c) return this.refuse(op, 'UNKNOWN_CANDIDATE', `no candidate ${id}`);
    const initial = this.candidateProblem(c, 'pending'); if (initial) return this.refuse(op, initial.code, initial.message);
    const fail = (code: BoardCode, message: string) => {
      c.status = 'failed'; delete c.state;
      return this.refuse(op, code, message);
    };
    try {
      const own = copyState(c.state!), ev = await this.evaluate(own.doc);
      const afterRead = this.candidateProblem(c, 'pending');
      if (afterRead) return this.refuse(op, afterRead.code, afterRead.message);
      const before: ChatState = { ...own, bodies: ev && ev.ok ? ev.bodies : own.bodies };
      const dispatched = await dispatchTool(before, 'apply_ops', { ops: c.ops }, this.evaluate);
      const afterDispatch = this.candidateProblem(c, 'pending');
      if (afterDispatch) return this.refuse(op, afterDispatch.code, afterDispatch.message);
      if (dispatched.isError) {
        let message = dispatched.content; try { message = JSON.parse(message).error ?? message; } catch { /* plain response */ }
        return fail(/No face, edge or body|no feature|index/i.test(message) ? 'WRONG_TARGET' : 'GATE_FAILED', message);
      }
      const result = dispatched.state;
      const tris = result.bodies.reduce((s, b) => s + b.mesh.indices.length / 3, 0);
      const over = c.budget.bodies !== undefined && result.bodies.length > c.budget.bodies ? `budget bodies: ${result.bodies.length} over ${c.budget.bodies}` : c.budget.triangles !== undefined && tris > c.budget.triangles ? `budget triangles: ${tris} over ${c.budget.triangles}` : null;
      if (over) return fail('BUDGET_EXCEEDED', over);
      const { gates } = await runGates({ before, after: result, broken: 0 }, this.evaluate);
      const afterGates = this.candidateProblem(c, 'pending');
      if (afterGates) return this.refuse(op, afterGates.code, afterGates.message);
      const evidence = { ...(await evidenceOf(result.doc, result.bodies, this.evaluate, c.token)), gates };
      const final = this.candidateProblem(c, 'pending');
      if (final) return this.refuse(op, final.code, final.message);
      const denied = personRowsRefusal(this.accepted.state.doc, result.doc, this.accepted.state.rowFiles);
      if (denied) return fail('GATE_FAILED', denied);
      c.status = 'built'; c.evidence = evidence; delete c.state;
      return this.finish(op, { ok: true, evidence });
    } catch (error) {
      const problem = this.candidateProblem(c, 'pending');
      return problem ? this.refuse(op, problem.code, problem.message) : fail('GATE_FAILED', errorText(error));
    }
  }

  /** Discard an uncommitted candidate. Its kernel work may still return, but it cannot publish. */
  cancel(operationId: string, id: string): Outcome {
    const op = this.begin('cancel', operationId, id); if ('ok' in op) return op;
    const c = this.candidates.get(id); if (!c) return this.refuse(op, 'UNKNOWN_CANDIDATE', `no candidate ${id}`);
    if (c.status === 'accepted') return this.refuse(op, 'ALREADY_COMMITTED', `${id} is accepted: undo it instead`);
    c.status = 'cancelled'; delete c.state;
    return this.finish(op, { ok: true });
  }

  /** Prepare and replay independently, then commit at a single synchronous check of the board's current state. */
  async accept(operationId: string, id: string): Promise<Outcome> {
    const op = this.begin('accept', operationId, id); if ('ok' in op) return op;
    const c = this.candidates.get(id); if (!c) return this.refuse(op, 'UNKNOWN_CANDIDATE', `no candidate ${id}`);
    const initial = this.candidateProblem(c, 'built'); if (initial) return this.refuse(op, initial.code, initial.message);
    let accepted: ChatState, live: Evidence;
    try {
      const out = await integrate(copyState(this.accepted.state), { id, by: 'board', base: c.base, ops: c.ops }, this.evaluate, { seq: this.seq + 1 });
      const afterIntegration = this.candidateProblem(c, 'built');
      if (afterIntegration) return this.refuse(op, afterIntegration.code, afterIntegration.message);
      if (out.trace.decision !== 'applied') {
        const finding = out.trace.gates.flatMap(x => x.findings)[0];
        return this.refuse(op, out.trace.decision === 'stale' ? 'STALE_BASE' : 'GATE_FAILED', finding ? `${finding.code}: ${finding.message}` : out.trace.decision);
      }
      accepted = out.state;
      live = await evidenceOf(accepted.doc, accepted.bodies, this.evaluate, c.token + 1);
    } catch (error) {
      const problem = this.candidateProblem(c, 'built');
      return problem ? this.refuse(op, problem.code, problem.message) : this.refuse(op, 'GATE_FAILED', errorText(error));
    }
    const beforeReplay = this.candidateProblem(c, 'built');
    if (beforeReplay) return this.refuse(op, beforeReplay.code, beforeReplay.message);
    let replay: Awaited<ReturnType<Reopen>>;
    try {
      replay = await this.reopen(encodeStudioFile(accepted.doc));
    } catch (error) {
      replay = { error: errorText(error) };
    }
    const final = this.candidateProblem(c, 'built');
    if (final) return this.refuse(op, final.code, final.message);
    try {
      if ('error' in replay) return this.refuse(op, 'REPLAY_UNREADABLE', `saved candidate could not be replayed: ${replay.error}`);
      const tol = Object.fromEntries((accepted.doc.requirements ?? []).map(q => [q.id, q.check.tol ?? 1e-9]));
      const diff = replayDiff(live, replay, tol);
      if (diff) return this.refuse(op, diff.code, diff.message);
    } catch (error) {
      return this.refuse(op, 'REPLAY_UNREADABLE', `saved candidate could not be replayed: ${errorText(error)}`);
    }

    const denied = personRowsRefusal(this.accepted.state.doc, accepted.doc, this.accepted.state.rowFiles);
    if (denied) return this.refuse(op, 'GATE_FAILED', denied);
    // No await or callback from the host between checking the generation and publishing this snapshot.
    this.undoStack.push(this.accepted); this.redoStack.length = 0;
    this.accepted = { state: accepted, lineage: { candidate: c, previous: this.accepted.lineage } };
    this.token++; c.status = 'accepted';
    return this.finish(op, { ok: true, evidence: live });
  }
  /** Restore the previous accepted state on a new token. */
  undo(operationId: string): Outcome {
    const op = this.begin('undo', operationId); if ('ok' in op) return op;
    const prev = this.undoStack.pop(); if (!prev) return this.refuse(op, 'NOTHING_TO_UNDO', 'nothing accepted to undo');
    this.redoStack.push(this.accepted); this.accepted = prev; this.token++;
    return this.finish(op, { ok: true });
  }
  /** Restore the undone accepted state on a new token. */
  redo(operationId: string): Outcome {
    const op = this.begin('redo', operationId); if ('ok' in op) return op;
    const next = this.redoStack.pop(); if (!next) return this.refuse(op, 'NOTHING_TO_REDO', 'nothing undone to redo');
    this.undoStack.push(this.accepted); this.accepted = next; this.token++;
    return this.finish(op, { ok: true });
  }
  /** The accepted document as the studio saves it. */
  save(): Uint8Array { return encodeStudioFile(this.accepted.state.doc); }
  /** A board on a saved file, read fresh (a corrupt file refused, typed). */
  static async open(bytes: Uint8Array, evaluate: Evaluate, reopen?: Reopen): Promise<CandidateBoard | { code: 'CORRUPT_FILE'; message: string }> {
    let read: Awaited<ReturnType<typeof readStudioFile>>;
    try { read = await readStudioFile(bytes); } catch (e) { return { code: 'CORRUPT_FILE', message: e instanceof Error ? e.message : String(e) }; }
    if ('error' in read) return { code: 'CORRUPT_FILE', message: read.error };
    const ev = await evaluate(read.doc); if (!ev || !ev.ok) return { code: 'CORRUPT_FILE', message: ev && !ev.ok ? ev.error.title : 'not evaluated' };
    return new CandidateBoard({ doc: read.doc, bodies: ev.bodies, turnBase: read.doc } as ChatState, evaluate, reopen);
  }
}
