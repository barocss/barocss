import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { encodeStudioFile, readStudioFile } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { isUserToken, type UserToken } from '@barocss/cad-model/team/ecr';
import { bindTaskQuestions, answerTaskQuestions } from '@barocss/cad-model/team/taskQuestions';
import { interfacesRevision } from '@barocss/cad-model/team/interfaces';
import {
  applyTaskDecision, bindTaskDecision, buildTaskCandidate, claimTaskUserToken,
  type TaskContext, type TaskSubmission,
} from '@barocss/cad-model/team/taskExecution';
import { compileTaskPlan, type BoundTask, type TaskPlan, type TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { TaskRunStore, RunStoreError, type RunLimits, type RunOperation, type RunRecord, type RunState, type RunTask, type TaskAttempt, type WritePoint } from './store';

export interface WorkerTicket {
  runId: string;
  task: BoundTask;
  attempt: TaskAttempt;
  plan: TaskPlanRequest;
  doc: StudioDoc;
}
export interface WorkerReply {
  runId: string;
  epoch: number;
  attemptId: string;
  operationId: string;
  submission: TaskSubmission;
  usage: number;
  nativeCandidateDigest?: string;
}
export type TaskWorker = (ticket: WorkerTicket, signal: AbortSignal) => Promise<WorkerReply>;
export interface DecisionRequest {
  runId: string;
  operationId: string;
  taskId: string;
  epoch: number;
  attemptId: string;
  specRevision: string;
  candidateDigest: string;
  approved: boolean;
}
export interface AnswerRequest {
  runId: string;
  operationId: string;
  taskId: string;
  epoch: number;
  specRevision: string;
  batch: number;
  answers: Record<string, string | number | null>;
}
export type HostOutcome = RunOperation & { duplicate?: true };
type Control = 'pause' | 'resume' | 'stop' | 'tick';
const positiveInt = (n: number) => Number.isSafeInteger(n) && n > 0;
const nonnegativeInt = (n: number) => Number.isSafeInteger(n) && n >= 0;
const reservedUsage = (task: RunTask) => task.attempt?.usage === undefined ? task.attempt?.reservation ?? 0 : 0;
const activeAttempt = (task: RunTask) => task.phase === 'running' || task.phase === 'validating';
const withTask = (state: RunState, task: RunTask): RunState => ({ ...state, tasks: state.tasks.map(t => t.id === task.id ? task : t) });
const withOperation = (state: RunState, op: RunOperation): RunState => ({
  ...state, operations: state.operations.some(item => item.id === op.id)
    ? state.operations.map(item => item.id === op.id ? op : item) : [...state.operations, op],
});

class RunTimeout extends Error {}
async function until<T>(deadline: number, operation: () => Promise<T>, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expire = () => { onTimeout?.(); return new RunTimeout('The local operation reached its wall-time limit.'); };
  try {
    const left = deadline - performance.now();
    if (left <= 0) throw expire();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new RunTimeout('The local operation reached its wall-time limit.'));
        onTimeout?.();
      }, Math.ceil(left));
    });
    const result = await Promise.race([operation(), timeout]);
    if (performance.now() > deadline) throw expire();
    return result;
  } finally { clearTimeout(timer); }
}

function admitted(doc: StudioDoc, request: TaskPlanRequest): TaskPlan {
  const result = compileTaskPlan(doc, request);
  if ('error' in result) throw new Error(`${result.error.code}: ${result.error.message}`);
  if (result.tasks.length !== 2 || result.tasks.some(task => task.dependsOn.length)) {
    throw new Error('This run profile requires two independent tasks.');
  }
  return result;
}
async function readNative(bytes: Uint8Array, expected: string): Promise<StudioDoc> {
  const result = await readStudioFile(bytes);
  if ('error' in result || digestOf(result.doc) !== expected)
    throw new RunStoreError('RUN_CORRUPT', 'The native document cannot be recovered with the recorded model digest.');
  return result.doc;
}
function taskContext(plan: TaskPlan, doc: StudioDoc, task: BoundTask, sequence: number, until: number): TaskContext {
  return {
    activePlan: plan, identity: plan.identity, policyRevision: plan.policyRevision, sequence,
    leases: new Map([[task.occurrence, { part: task.occurrence, holder: task.holder, contract: interfacesRevision(doc), until }]]),
  };
}
function recoverState(record: RunRecord): RunState {
  const state = record.state;
  const unknown = state.tasks.filter(activeAttempt).reduce((sum, task) => sum + reservedUsage(task), state.budget.unknown);
  return {
    ...state,
    budget: { ...state.budget, unknown },
    tasks: state.tasks.map(task => activeAttempt(task) ? { ...task, phase: 'stale', reason: 'RUN_INTERRUPTED' }
      : task.phase === 'committing' && record.pending?.taskId === task.id
        ? { ...task, phase: record.pending.priorPhase, reason: 'RUN_INTERRUPTED' } : task),
    operations: state.operations.map(op => op.phase === 'reserved' ? { ...op, phase: 'interrupted', code: 'RUN_INTERRUPTED' } : op),
  };
}

/** One local run writer. Providers propose operations. Only a verified, user-approved native document can be published. */
export class TaskRunHost {
  private readonly controllers = new Map<string, AbortController>();
  private constructor(private readonly store: TaskRunStore, private readonly evaluate: Evaluate, private doc: StudioDoc, private plan: TaskPlan) {}
  static async create(directory: string, runId: string, doc: StudioDoc, request: TaskPlanRequest, limits: RunLimits, limit: number, evaluate: Evaluate, afterWrite?: (point: WritePoint) => void) {
    if (![1, 2].includes(limits.concurrent) || !positiveInt(limits.attemptsPerTask) || !positiveInt(limits.reservation)
      || !positiveInt(limits.leaseTicks) || !positiveInt(limits.timeoutMs) || limits.timeoutMs > 0x7fffffff || !positiveInt(limit)) {
      throw new Error('Invalid local run limits.');
    }
    const path = resolve(directory), requested = structuredClone(request), bounded = structuredClone(limits);
    const source = await readNative(encodeStudioFile(doc), digestOf(doc)), plan = admitted(source, requested);
    const state: RunState = {
      phase: 'active', controlRevision: 0, sequence: 0, plan: requested, specRevision: plan.specRevision,
      limits: bounded, budget: { limit, used: 0, unknown: 0 }, operations: [],
      tasks: plan.tasks.map(task => ({ id: task.id, phase: 'ready', attempts: 0 })),
    };
    return new TaskRunHost(TaskRunStore.create(path, runId, source, state, afterWrite), evaluate, source, plan);
  }
  static async open(directory: string, evaluate: Evaluate, afterWrite?: (point: WritePoint) => void) {
    const store = TaskRunStore.open(directory, afterWrite);
    try {
      const record = store.snapshot, doc = await readNative(store.acceptedBytes, record.accepted.modelDigest);
      const plan = admitted(doc, record.state.plan);
      if (plan.specRevision !== record.state.specRevision)
        throw new RunStoreError('RUN_CORRUPT', 'The run specification does not match its accepted model.');
      store.recover(record.revision, recoverState(record));
      return new TaskRunHost(store, evaluate, doc, plan);
    } catch (error) {
      try { store.close(); } catch { /* Keep the original recovery failure. */ }
      throw error;
    }
  }

  get snapshot() { return this.store.snapshot; }
  get acceptedBytes() { return this.store.acceptedBytes; }

  private request(record: RunRecord, operationId: string, payload: unknown): HostOutcome {
    if (typeof operationId !== 'string' || !operationId || operationId.length > 160) throw new Error('Invalid operation ID.');
    const key = digestOf(payload), prior = record.state.operations.find(op => op.id === operationId);
    if (prior) return prior.key === key ? { ...prior, duplicate: true }
      : { id: operationId, key, epoch: record.epoch, phase: 'failed', code: 'RUN_OPERATION_CONFLICT' };
    return { id: operationId, key, epoch: record.epoch, phase: 'reserved' };
  }
  private refusal(op: RunOperation, code: string): HostOutcome { return { ...op, phase: 'failed', code }; }

  private owns(record: RunRecord, ticket: WorkerTicket) {
    const task = record.state.tasks.find(item => item.id === ticket.task.id);
    return task && activeAttempt(task) && task.attempt?.id === ticket.attempt.id
      && record.epoch === ticket.attempt.epoch && record.state.phase !== 'stopped' ? task : undefined;
  }

  private conclude(ticket: WorkerTicket, op: RunOperation, update: Pick<RunTask, 'phase' | 'reason' | 'candidate' | 'submission'>, usage?: number): HostOutcome {
    const record = this.store.snapshot, task = this.owns(record, ticket);
    if (!task) return this.refusal(op, 'RUN_LATE_RESULT');
    const reservation = ticket.attempt.reservation;
    const budget = { ...record.state.budget };
    if (task.attempt!.usage === undefined) {
      if (usage === undefined) budget.unknown += reservation;
      else budget.used += usage;
    }
    const result: RunOperation = { ...op, phase: update.phase === 'awaiting-decision' ? 'completed' : 'failed', code: update.reason, usage };
    const next = withTask({ ...record.state, budget }, { ...task, ...update });
    this.store.checkpoint(record.revision, withOperation(next, result));
    return result;
  }

  dispatch(operationId: string, taskId: string, worker: TaskWorker, inputKey?: string): Promise<HostOutcome> {
    return this.execute('dispatch', operationId, taskId, worker, inputKey);
  }

  refresh(operationId: string, taskId: string): Promise<HostOutcome> {
    const record = this.store.snapshot, op = this.request(record, operationId, ['refresh', taskId]);
    if (op.phase !== 'reserved' || op.duplicate) return Promise.resolve(op);
    const prior = record.state.tasks.find(task => task.id === taskId)?.submission;
    const bound = this.plan.tasks.find(task => task.id === taskId);
    if (!prior || !bound || prior.inputDigest !== bound.inputDigest)
      return Promise.resolve(this.refusal(op, 'RUN_REFRESH_INPUT_CHANGED'));
    return this.execute('refresh', operationId, taskId, async ticket => ({
      runId: ticket.runId, epoch: ticket.attempt.epoch, attemptId: ticket.attempt.id, operationId, usage: 0,
      submission: { taskId, heightMm: prior.heightMm, specRevision: ticket.attempt.specRevision, inputDigest: ticket.attempt.inputDigest },
    }));
  }

  private async execute(kind: 'dispatch' | 'refresh', operationId: string, taskId: string, worker: TaskWorker, inputKey?: string): Promise<HostOutcome> {
    const record = this.store.snapshot, state = record.state, op = this.request(record, operationId, [kind, taskId, inputKey]);
    if (op.phase !== 'reserved' || op.duplicate) return op;
    const task = state.tasks.find(item => item.id === taskId), running = state.tasks.filter(activeAttempt);
    if (state.phase !== 'active') return this.refusal(op, 'RUN_NOT_ACTIVE');
    const expired = task?.phase === 'awaiting-decision' && !!task.attempt && state.sequence > task.attempt.leaseUntil;
    if (!task || (!['ready', 'stale', 'failed'].includes(task.phase) && !(kind === 'refresh' && expired)))
      return this.refusal(op, 'RUN_TASK_UNAVAILABLE');
    if (running.length >= state.limits.concurrent || task.attempts >= state.limits.attemptsPerTask)
      return this.refusal(op, 'RUN_LIMIT');
    const reserved = running.reduce((sum, item) => sum + reservedUsage(item), 0);
    const reservation = kind === 'dispatch' ? state.limits.reservation : 0;
    if (reserved + state.budget.used + state.budget.unknown + reservation > state.budget.limit)
      return this.refusal(op, 'RUN_BUDGET');

    const doc = structuredClone(this.doc), plan = this.plan;
    const bound = plan.tasks.find(item => item.id === taskId)!;
    if (bound.blockers.length) return this.refusal(op, 'TASK_REQUIRED_UNKNOWN');
    const sequence = state.sequence + 1;
    const attempt: TaskAttempt = {
      id: `${record.epoch}:${sequence}:${task.id}`, operationId, epoch: record.epoch,
      leaseUntil: Math.min(sequence + state.limits.leaseTicks, state.plan.throughSequence),
      reservation, inputDigest: bound.inputDigest, specRevision: plan.specRevision, base: record.accepted,
    };
    if (sequence > attempt.leaseUntil) return this.refusal(op, 'RUN_LEASE_EXPIRED');
    const ticket: WorkerTicket = { runId: record.runId, task: bound, attempt, plan: state.plan, doc };
    const pending = withTask({ ...state, sequence }, { id: task.id, phase: 'running', attempts: task.attempts + 1, attempt });
    this.store.checkpoint(record.revision, withOperation(pending, op));
    const controller = new AbortController();
    this.controllers.set(attempt.id, controller);
    const deadline = performance.now() + state.limits.timeoutMs;
    let reply: WorkerReply;
    try {
      reply = structuredClone(await until(deadline, () => worker(structuredClone(ticket), controller.signal), () => controller.abort()));
    } catch (error) {
      return this.conclude(ticket, op, { phase: 'failed', reason: error instanceof RunTimeout ? 'RUN_TIMEOUT' : 'RUN_WORKER_FAILED' });
    } finally {
      this.controllers.delete(attempt.id);
    }

    const current = this.store.snapshot, owned = this.owns(current, ticket);
    if (!owned) return this.refusal(op, 'RUN_LATE_RESULT');
    const usage = nonnegativeInt(reply?.usage) ? reply.usage : undefined;
    if (reply?.runId !== record.runId || reply.epoch !== attempt.epoch || reply.attemptId !== attempt.id || reply.operationId !== operationId)
      return this.conclude(ticket, op, { phase: 'failed', reason: 'RUN_REPLY_MISMATCH' });
    if (usage === undefined || usage > attempt.reservation)
      return this.conclude(ticket, op, { phase: 'failed', reason: 'RUN_BUDGET' }, usage);
    let submission: TaskSubmission;
    try {
      submission = structuredClone(reply.submission);
      if (!submission || Object.keys(submission).sort().join(',') !== 'heightMm,inputDigest,specRevision,taskId'
        || submission.taskId !== taskId || submission.specRevision !== attempt.specRevision || submission.inputDigest !== attempt.inputDigest
        || !Number.isFinite(submission.heightMm) || submission.heightMm <= 0) throw new Error('Invalid scoped submission.');
    } catch {
      return this.conclude(ticket, op, { phase: 'failed', reason: 'TASK_SUBMISSION_MISMATCH' }, usage);
    }
    if (current.state.sequence > attempt.leaseUntil)
      return this.conclude(ticket, op, { phase: 'stale', reason: 'RUN_LEASE_EXPIRED' }, usage);
    if (current.accepted.sha256 !== record.accepted.sha256 || current.state.specRevision !== plan.specRevision)
      return this.conclude(ticket, op, { phase: 'stale', reason: 'RUN_SPEC_MOVED', submission }, usage);
    const validating = { ...current.state, budget: { ...current.state.budget, used: current.state.budget.used + usage } };
    this.store.checkpoint(current.revision, withTask(validating, { ...owned, attempt: { ...owned.attempt!, usage }, phase: 'validating' }));
    const context = taskContext(plan, doc, bound, current.state.sequence, attempt.leaseUntil);
    try {
      const candidate = await until(deadline, () => buildTaskCandidate(plan, { doc, bodies: [] }, submission, { ...context, worker: bound.holder }, this.evaluate));
      if ('error' in candidate) return this.conclude(ticket, op, { phase: 'failed', reason: candidate.error.code }, usage);
      if (reply.nativeCandidateDigest !== undefined && reply.nativeCandidateDigest !== candidate.candidateDigest)
        return this.conclude(ticket, op, { phase: 'failed', reason: 'RUN_WORKER_EVIDENCE_MISMATCH' }, usage);
      const latest = this.store.snapshot;
      if (latest.accepted.sha256 !== record.accepted.sha256 || latest.state.specRevision !== plan.specRevision)
        return this.conclude(ticket, op, { phase: 'stale', reason: 'RUN_SPEC_MOVED', submission }, usage);
      if (latest.state.sequence > attempt.leaseUntil)
        return this.conclude(ticket, op, { phase: 'stale', reason: 'RUN_LEASE_EXPIRED' }, usage);
      return this.conclude(ticket, op, { phase: 'awaiting-decision', candidate, submission }, usage);
    } catch (error) {
      if (error instanceof RunStoreError) throw error;
      return this.conclude(ticket, op, { phase: 'failed', reason: error instanceof RunTimeout ? 'RUN_TIMEOUT' : 'RUN_NATIVE_FAILED' }, usage);
    }
  }

  async decide(input: DecisionRequest, user: UserToken): Promise<HostOutcome> {
    const record = this.store.snapshot, state = record.state;
    const { operationId, runId, taskId, epoch, attemptId, specRevision, candidateDigest, approved } = input;
    const op = this.request(record, operationId, ['decision', runId, taskId, epoch, attemptId, specRevision, candidateDigest, approved]);
    if (!isUserToken(user) || typeof approved !== 'boolean') return this.refusal(op, 'RUN_USER_REQUIRED');
    if (op.phase !== 'reserved' || op.duplicate) return op;
    if (state.phase !== 'active' || record.pending) return this.refusal(op, 'RUN_COMMIT_HELD');
    const held = state.tasks.find(task => task.id === taskId);
    if (held?.phase !== 'awaiting-decision' || !held.candidate || !held.submission || !held.attempt
      || runId !== record.runId || epoch !== record.epoch || attemptId !== held.attempt.id
      || state.specRevision !== specRevision || held.candidate.specRevision !== specRevision
      || held.candidate.candidateDigest !== candidateDigest) return this.refusal(op, 'RUN_DECISION_STALE');
    if (state.sequence > held.attempt.leaseUntil) return this.refusal(op, 'RUN_LEASE_EXPIRED');
    const pending = withTask(state, { ...held, phase: 'committing' });
    this.store.reserveCommit(record.revision, {
      operationId, taskId: held.id, candidateDigest: candidateDigest, specRevision: specRevision,
    }, withOperation(pending, op));

    const refuse = (code: string): HostOutcome => {
      const current = this.store.snapshot, outcome = this.refusal(op, code);
      if (current.pending?.operationId === operationId) {
        this.store.discardCommit(current.revision, operationId, withOperation(withTask(current.state, {
          ...held, phase: 'awaiting-decision', reason: code,
        }), outcome));
      }
      return outcome;
    };
    const canCommit = (current: RunRecord) => current.epoch === record.epoch && current.pending?.operationId === operationId
      && current.accepted.sha256 === record.accepted.sha256 && current.state.specRevision === specRevision
      && current.state.phase === 'active' && current.state.controlRevision === state.controlRevision;
    const doc = structuredClone(this.doc), plan = this.plan, bound = plan.tasks.find(task => task.id === held.id)!;
    const context = taskContext(plan, doc, bound, state.sequence, held.attempt.leaseUntil), submission = held.submission;
    const deadline = performance.now() + state.limits.timeoutMs;

    try {
      const candidate = await until(deadline, () => buildTaskCandidate(plan, { doc, bodies: [] }, submission, { ...context, worker: bound.holder }, this.evaluate));
      if ('error' in candidate) return refuse(candidate.error.code);
      if (candidate.candidateDigest !== candidateDigest) return refuse('RUN_CANDIDATE_MOVED');
      const afterBuild = this.store.snapshot;
      if (!canCommit(afterBuild)) return refuse('RUN_DECISION_MOVED');
      if (afterBuild.state.sequence > held.attempt.leaseUntil) return refuse('RUN_LEASE_EXPIRED');
      const choice = bindTaskDecision(candidate, approved, user);
      if ('error' in choice) return refuse(choice.error.code);
      const accepted = await until(deadline, () => applyTaskDecision(choice, { doc, bodies: [] }, context, this.evaluate));
      if ('error' in accepted) return refuse(accepted.error.code);
      const nextDoc = approved ? await until(deadline, () => readNative(encodeStudioFile(accepted.doc), digestOf(accepted.doc))) : doc;
      const current = this.store.snapshot;
      if (!canCommit(current)) return refuse('RUN_DECISION_MOVED');
      if (current.state.sequence > held.attempt.leaseUntil) return refuse('RUN_LEASE_EXPIRED');
      const result: RunOperation = { ...op, phase: 'completed', code: approved ? 'RUN_ACCEPTED' : 'RUN_REJECTED' };
      if (!approved) {
        this.store.discardCommit(current.revision, operationId, withOperation(withTask(current.state, { ...held, phase: 'cancelled', reason: 'RUN_REJECTED' }), result));
        return result;
      }

      const nextPlan = admitted(nextDoc, current.state.plan);
      const next = withOperation({ ...current.state, specRevision: nextPlan.specRevision,
        tasks: current.state.tasks.map(task => task.id === held.id ? { ...held, phase: 'completed' }
          : task.phase === 'awaiting-decision' ? { ...task, phase: 'stale', reason: 'RUN_SPEC_MOVED' } : task),
      }, result);
      this.store.publish(current.revision, operationId, nextDoc, next);
      this.doc = nextDoc;
      this.plan = nextPlan;
      return result;
    } catch (error) {
      if (error instanceof RunStoreError) throw error;
      return refuse(error instanceof RunTimeout ? 'RUN_TIMEOUT' : 'RUN_NATIVE_FAILED');
    }
  }

  /** A trusted policy revision pauses the run and removes all obsolete authority before acknowledging it. */
  revisePolicy(operationId: string, policyRevision: string, concurrent: 1 | 2, user: UserToken): HostOutcome {
    const record = this.store.snapshot, state = record.state;
    const op = this.request(record, operationId, ['policy', policyRevision, concurrent]);
    if (!isUserToken(user)) return this.refusal(op, 'RUN_USER_REQUIRED');
    if (op.phase !== 'reserved' || op.duplicate) return op;
    if (state.phase === 'stopped' || typeof policyRevision !== 'string' || policyRevision === state.plan.policyRevision
      || ![1, 2].includes(concurrent) || concurrent > state.limits.concurrent) return this.refusal(op, 'RUN_POLICY_REFUSED');
    const request = { ...state.plan, policyRevision };
    let plan: TaskPlan;
    try { plan = admitted(this.doc, request); } catch { return this.refusal(op, 'RUN_POLICY_REFUSED'); }
    if (!claimTaskUserToken(user)) return this.refusal(op, 'RUN_USER_REQUIRED');
    const unknown = state.tasks.filter(activeAttempt).reduce((sum, task) => sum + reservedUsage(task), state.budget.unknown);
    const result: RunOperation = { ...op, phase: 'completed', code: 'RUN_POLICY_REVISED' };
    const next = withOperation({
      ...state, phase: 'paused', controlRevision: state.controlRevision + 1, plan: request, specRevision: plan.specRevision,
      limits: { ...state.limits, concurrent }, budget: { ...state.budget, unknown },
      tasks: state.tasks.map(task => ['completed', 'cancelled'].includes(task.phase) ? task
        : { id: task.id, attempts: task.attempts, phase: 'stale', reason: 'RUN_POLICY_MOVED' }),
      operations: state.operations.map(item => item.phase === 'reserved' ? { ...item, phase: 'interrupted', code: 'RUN_POLICY_MOVED' } : item),
    }, result);
    if (record.pending) this.store.discardCommit(record.revision, record.pending.operationId, next);
    else this.store.checkpoint(record.revision, next);
    this.plan = plan;
    for (const controller of this.controllers.values()) controller.abort();
    return result;
  }

  /** Record the answer through the existing task-question authority and publish its exact native spec revision. */
  async answer(input: AnswerRequest, user: UserToken): Promise<HostOutcome> {
    const record = this.store.snapshot, state = record.state;
    const { operationId, runId, taskId, epoch, specRevision, batch } = input;
    if (!input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers)
      || Object.values(input.answers).some(value => value !== null && typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))) {
      return this.refusal(this.request(record, operationId, ['invalid-answer', runId, taskId, epoch, specRevision, batch]), 'TASK_QUESTION_VALUE');
    }
    const answers = structuredClone(input.answers);
    const op = this.request(record, operationId, ['answer', runId, taskId, epoch, specRevision, batch, answers]);
    if (!isUserToken(user)) return this.refusal(op, 'RUN_USER_REQUIRED');
    if (op.phase !== 'reserved' || op.duplicate) return op;
    if (state.phase !== 'active' || record.pending) return this.refusal(op, 'RUN_COMMIT_HELD');
    const held = state.tasks.find(task => task.id === taskId);
    if (!held || !['ready', 'stale', 'failed'].includes(held.phase) || runId !== record.runId || epoch !== record.epoch || specRevision !== state.specRevision)
      return this.refusal(op, 'RUN_QUESTION_STALE');

    const doc = structuredClone(this.doc), plan = admitted(doc, state.plan);
    const context = { activePlan: plan, identity: plan.identity, policyRevision: plan.policyRevision };
    const binding = bindTaskQuestions(plan, doc, context, taskId, batch);
    if ('error' in binding) return this.refusal(op, binding.error.code);
    const intent = { kind: 'spec' as const, operationId, taskId, specRevision, questionDigest: digestOf(binding) };
    this.store.reserveCommit(record.revision, intent, withOperation(withTask(state, { ...held, phase: 'committing' }), op));

    const refuse = (code: string) => {
      const current = this.store.snapshot, outcome = this.refusal(op, code);
      if (current.pending?.operationId === operationId)
        this.store.discardCommit(current.revision, operationId, withOperation(withTask(current.state, held), outcome));
      return outcome;
    };
    try {
      const answer = answerTaskQuestions(binding, doc, context, answers, user);
      if ('error' in answer) return refuse(answer.error.code);
      const nextDoc = await readNative(encodeStudioFile(answer.doc), digestOf(answer.doc));
      const nextPlan = admitted(nextDoc, state.plan);
      const current = this.store.snapshot;
      if (current.pending?.operationId !== operationId || current.state.phase !== 'active'
        || current.state.controlRevision !== state.controlRevision || current.state.specRevision !== specRevision)
        return refuse('RUN_QUESTION_STALE');

      const result: RunOperation = { ...op, phase: 'completed', code: 'RUN_ANSWERED' };
      const next = withOperation({ ...current.state, specRevision: nextPlan.specRevision,
        tasks: current.state.tasks.map(task => task.id === held.id ? { id: task.id, attempts: task.attempts, phase: 'ready' }
          : task.phase === 'awaiting-decision' ? { ...task, phase: 'stale', reason: 'RUN_SPEC_MOVED' } : task),
      }, result);
      this.store.publish(current.revision, operationId, nextDoc, next);
      this.doc = nextDoc;
      this.plan = nextPlan;
      return result;
    } catch (error) {
      if (error instanceof RunStoreError) throw error;
      return refuse('RUN_SPEC_UNADMITTED');
    }
  }

  control(operationId: string, action: Control, user: UserToken): HostOutcome {
    const record = this.store.snapshot, op = this.request(record, operationId, ['control', action]);
    if (!isUserToken(user)) return this.refusal(op, 'RUN_USER_REQUIRED');
    if (op.phase !== 'reserved' || op.duplicate) return op;
    if (!['pause', 'resume', 'stop', 'tick'].includes(action) || record.state.phase === 'stopped'
      || (action === 'resume' && record.state.phase !== 'paused') || !claimTaskUserToken(user)) return this.refusal(op, 'RUN_CONTROL_REFUSED');
    const state = structuredClone(record.state);
    if (action === 'tick') state.sequence++;
    else {
      state.controlRevision++;
      state.phase = action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'stopped';
    }
    const result: RunOperation = { ...op, phase: 'completed' };
    if (action === 'stop') {
      for (const task of state.tasks) {
        if (activeAttempt(task)) state.budget.unknown += reservedUsage(task);
        if (task.phase !== 'completed') { task.phase = 'cancelled'; task.reason = 'RUN_STOPPED'; }
      }
      state.operations = state.operations.map(item => item.phase === 'reserved' ? { ...item, phase: 'interrupted', code: 'RUN_STOPPED' } : item);
    }
    const next = withOperation(state, result);
    if (action === 'stop' && record.pending) this.store.discardCommit(record.revision, record.pending.operationId, next);
    else this.store.checkpoint(record.revision, next);
    if (action === 'stop') for (const controller of this.controllers.values()) controller.abort();
    return result;
  }

  close() {
    for (const controller of this.controllers.values()) controller.abort();
    this.store.close();
  }
}
