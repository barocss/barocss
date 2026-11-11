import { randomUUID } from 'node:crypto';
import {
  closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { TaskCandidate, TaskSubmission } from '@barocss/cad-model/team/taskExecution';
import type { TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { isTaskRunNativeFailure, isTaskRunReplacementProvenance, type TaskRunNativeFailure, type TaskRunReplacementProvenance, type TaskRunTaskPhase } from '../../src/chat/taskRunOffer';
import type { NativeRef, TaskCheckpoint } from '../../src/files/taskCheckpoint';
import type { CandidateReviewReceipt } from '../../src/files/taskCandidateReview';

export type { NativeRef } from '../../src/files/taskCheckpoint';
export type TaskPhase = TaskRunTaskPhase;
export interface TaskAttempt {
  id: string;
  operationId: string;
  epoch: number;
  leaseUntil: number;
  reservation: number;
  usage?: number;
  inputDigest: string;
  specRevision: string;
  base: NativeRef;
}
export interface RunTask {
  id: string;
  phase: TaskPhase;
  attempts: number;
  attempt?: TaskAttempt;
  candidate?: TaskCandidate;
  submission?: TaskSubmission;
  reason?: string;
  nativeFailure?: TaskRunNativeFailure;
}
export interface RunOperation {
  id: string;
  key: string;
  epoch: number;
  phase: 'reserved' | 'completed' | 'failed' | 'interrupted';
  code?: string;
  usage?: number;
}
export interface RunLimits {
  concurrent: 1 | 2;
  attemptsPerTask: number;
  reservation: number;
  leaseTicks: number;
  timeoutMs: number;
}
export interface RunState {
  phase: 'active' | 'paused' | 'stopped';
  controlRevision: number;
  sequence: number;
  plan: TaskPlanRequest;
  specRevision: string;
  limits: RunLimits;
  budget: { limit: number; used: number; unknown: number };
  tasks: RunTask[];
  operations: RunOperation[];
}
export type CommitIntent = {
  operationId: string;
  taskId: string;
  specRevision: string;
} & ({ kind?: 'task'; candidateDigest: string } | { kind: 'spec'; questionDigest: string });
type CommitReceipt = CommitIntent & { epoch: number; from: NativeRef; to: NativeRef; plan?: TaskPlanRequest };
export interface RunRecord {
  version: 1;
  runId: string;
  epoch: number;
  revision: number;
  accepted: NativeRef;
  state: RunState;
  pending?: CommitIntent & { base: NativeRef; controlRevision: number; priorPhase: TaskPhase };
  commits: CommitReceipt[];
  replacement?: TaskRunReplacementProvenance;
}
export type WritePoint = 'native-durable' | 'record-durable';
interface Owner { epoch: number; pid: number; id: string }

type StoreCode = 'RUN_BUSY' | 'RUN_CLOSED' | 'RUN_CORRUPT' | 'RUN_EXISTS' | 'RUN_STALE' | 'RUN_STORAGE';
export class RunStoreError extends Error {
  constructor(readonly code: StoreCode, message: string) {
    super(message);
    this.name = 'RunStoreError';
  }
}
const issue = (code: StoreCode, message: string): never => { throw new RunStoreError(code, message); };
const errno = (error: unknown, code: string) => (error as NodeJS.ErrnoException)?.code === code;
const SHA = /^[a-f0-9]{64}$/;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const nativeRef = (value: NativeRef | undefined) => value && SHA.test(value.sha256) && SHA.test(value.modelDigest);
const sameNative = (a: NativeRef, b: NativeRef) => a.sha256 === b.sha256 && a.modelDigest === b.modelDigest;
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

function jsonAt(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function syncDirectory(path: string) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeAtomic(directory: string, name: string, bytes: Uint8Array | string, replace: boolean): boolean {
  const temporary = join(directory, '.write-' + randomUUID()), target = join(directory, name);
  const fd = openSync(temporary, 'wx', 0o600);
  try {
    try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
    if (replace) renameSync(temporary, target);
    else {
      try { linkSync(temporary, target); } catch (error) {
        if (errno(error, 'EEXIST')) return false;
        throw error;
      }
    }
    syncDirectory(directory);
    return true;
  } finally {
    try { unlinkSync(temporary); } catch { /* The temporary name is never used during recovery. */ }
  }
}

function running(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (error) {
    if (errno(error, 'ESRCH')) return false;
    if (errno(error, 'EPERM')) return true;
    throw error;
  }
}
function takeOwner(directory: string, beforeClaim?: () => void): Owner {
  const epochs = readdirSync(directory).flatMap(name => {
    const m = /^writer-([1-9]\d*)\.json$/.exec(name);
    return m ? [Number(m[1])] : [];
  });
  const latest = epochs.reduce((high, epoch) => Math.max(high, epoch), 0);
  if (!count(latest + 1)) issue('RUN_CORRUPT', 'Invalid writer epoch.');
  if (latest) {
    const old = jsonAt(join(directory, `writer-${latest}.json`)) as Owner;
    if (old?.epoch !== latest || !count(old.pid) || old.pid === 0 || !id(old.id)) issue('RUN_CORRUPT', 'Invalid writer record.');
    let released: unknown;
    try { released = jsonAt(join(directory, `released-${latest}.json`)); } catch (error) {
      if (!errno(error, 'ENOENT')) throw error;
    }
    if (released !== undefined && released !== old.id) issue('RUN_CORRUPT', 'Invalid writer release.');
    if (released === undefined && running(old.pid)) issue('RUN_BUSY', 'Another host owns this run.');
  }
  beforeClaim?.();
  const next = { epoch: latest + 1, pid: process.pid, id: randomUUID() };
  // A dead owner record is kept. Concurrent recovery attempts compete for the same next name.
  if (!writeAtomic(directory, `writer-${next.epoch}.json`, JSON.stringify(next), false)) issue('RUN_BUSY', 'Another host acquired this run.');
  return next;
}

function recordAt(directory: string): RunRecord {
  const envelope = jsonAt(join(directory, 'run.json')) as { digest?: string; record?: RunRecord };
  const record = envelope?.record;
  if (record?.version !== 1 || !id(record.runId) || !count(record.epoch) || !record.epoch || !count(record.revision)
    || !nativeRef(record.accepted) || !record.state || !Array.isArray(record.commits) || digestOf(record) !== envelope.digest) {
    return issue('RUN_CORRUPT', 'The run record is invalid or its checksum differs.');
  }
  if (!['active', 'paused', 'stopped'].includes(record.state.phase) || !count(record.state.controlRevision)
    || !count(record.state.sequence) || !SHA.test(record.state.specRevision) || !record.state.plan
    || !Array.isArray(record.state.tasks) || !Array.isArray(record.state.operations)
    || ![1, 2].includes(record.state.limits?.concurrent) || !count(record.state.limits?.attemptsPerTask)
    || !count(record.state.limits?.reservation) || !count(record.state.limits?.leaseTicks) || !count(record.state.limits?.timeoutMs)
    || !count(record.state.budget?.limit) || !count(record.state.budget?.used) || !count(record.state.budget?.unknown)) {
    return issue('RUN_CORRUPT', 'The run state has an invalid shape.');
  }
  if (record.replacement !== undefined && (!isTaskRunReplacementProvenance(record.replacement) ||
      record.replacement.previous.runId === record.runId || record.state.tasks.length !== 1 ||
      record.state.tasks[0]?.id !== record.replacement.previous.pin.occurrence))
    return issue('RUN_CORRUPT', 'The replacement provenance is invalid.');
  for (const task of record.state.tasks) {
    const failure = task?.nativeFailure;
    if (failure === undefined) continue;
    const scope = record.state.plan.tasks.find(bound => bound.id === task.id);
    if (!isTaskRunNativeFailure(failure) || task.phase !== 'failed' || task.reason !== 'TASK_NATIVE_GATE'
      || task.attempt?.id !== failure.attemptId || task.attempt.base.modelDigest !== failure.baselineDigest
      || scope?.occurrence !== failure.occurrence || scope.feature !== failure.feature)
      return issue('RUN_CORRUPT', 'The native finding does not match its task attempt.');
  }
  const seen = new Set<string>();
  let previous: NativeRef | undefined;
  for (const receipt of record.commits) {
    if (!id(receipt?.operationId) || seen.has(receipt.operationId) || !nativeRef(receipt.from) || !nativeRef(receipt.to)
      || (previous && !sameNative(previous, receipt.from))) return issue('RUN_CORRUPT', 'The accepted receipt chain is invalid.');
    seen.add(receipt.operationId);
    previous = receipt.to;
  }
  if (previous && !sameNative(previous, record.accepted)) return issue('RUN_CORRUPT', 'The latest receipt and accepted file disagree.');
  if (record.pending && (!id(record.pending.operationId) || seen.has(record.pending.operationId)
    || !nativeRef(record.pending.base) || !sameNative(record.pending.base, record.accepted)
    || !record.state.operations.some(o => o.id === record.pending!.operationId && o.epoch === record.epoch && o.phase === 'reserved'))) {
    return issue('RUN_CORRUPT', 'The pending publication does not match the accepted file.');
  }
  return record;
}

function readObject(directory: string, ref: NativeRef): Uint8Array {
  try {
    const bytes = readFileSync(join(directory, 'native', ref.sha256 + '.bcad'));
    if (sha256Hex(bytes) !== ref.sha256) issue('RUN_CORRUPT', 'The accepted native file digest differs.');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  } catch (error) {
    if (error instanceof RunStoreError) throw error;
    return issue('RUN_CORRUPT', messageOf(error));
  }
}

/** Project the current task review from one authoritative run snapshot. */
export function candidateReviewFor(record: RunRecord, taskId: string): CandidateReviewReceipt {
  const { state } = record;
  const tasks = state.tasks.filter(task => task?.id === taskId), task = tasks.length === 1 ? tasks[0] : undefined;
  const attempt = task?.attempt, candidate = task?.candidate, submission = task?.submission;
  if (state.phase !== 'active' || record.pending || task?.phase !== 'awaiting-decision' || !attempt || !candidate || !submission)
    return issue('RUN_STALE', 'No current candidate is awaiting review.');
  if (!id(attempt.id) || !count(attempt.leaseUntil) || state.sequence > attempt.leaseUntil || !nativeRef(attempt.base) ||
      !sameNative(attempt.base, record.accepted) || candidate.baselineDigest !== record.accepted.modelDigest ||
      attempt.specRevision !== state.specRevision || candidate.specRevision !== state.specRevision ||
      submission.specRevision !== state.specRevision || candidate.taskId !== taskId || submission.taskId !== taskId ||
      attempt.inputDigest !== candidate.inputDigest || submission.inputDigest !== candidate.inputDigest)
    return issue('RUN_STALE', 'The candidate no longer matches its accepted baseline or task.');
  const operations = state.operations.filter(operation => operation?.id === attempt.operationId);
  if (operations.length !== 1 || operations[0].phase !== 'completed' || operations[0].epoch !== attempt.epoch)
    return issue('RUN_CORRUPT', 'The candidate attempt and operation disagree.');
  return { runId: record.runId, revision: record.revision, attemptId: attempt.id,
    plan: state.plan, baseline: record.accepted, submission, scope: candidate.scope, candidateDigest: candidate.candidateDigest };
}

/** Project the latest publishable task checkpoint from one checked durable record. */
export function taskCheckpointFor(record: RunRecord): TaskCheckpoint {
  const commit = record.commits.at(-1);
  if (!commit || commit.kind === 'spec' || record.pending)
    return issue('RUN_STALE', 'Export requires a committed task and no pending publication.');
  return checkpointFromCommit(record, commit);
}

export function taskApprovalFor(record: RunRecord, operationId: string): TaskCheckpoint {
  const commit = record.commits.find(commit => commit.operationId === operationId);
  if (!commit || commit.kind === 'spec') return issue('RUN_STALE', 'The approval is not in this local run.');
  return checkpointFromCommit(record, commit);
}

export function taskApprovals(record: RunRecord): TaskCheckpoint[] {
  return record.commits.flatMap(commit => commit.kind === 'spec' ? [] : [checkpointFromCommit(record, commit)]);
}

function checkpointFromCommit(record: RunRecord, commit: Exclude<CommitReceipt, { kind: 'spec' }>): TaskCheckpoint {
  const task = record.state.tasks.find(task => task?.id === commit.taskId), candidate = task?.candidate;
  const operation = record.state.operations.find(op => op?.id === commit.operationId);
  if (task?.phase !== 'completed' || !candidate || candidate.taskId !== commit.taskId || candidate.specRevision !== commit.specRevision ||
      candidate.candidateDigest !== commit.candidateDigest || operation?.phase !== 'completed' ||
      operation.code !== 'RUN_ACCEPTED' || operation.epoch !== commit.epoch)
    return issue('RUN_CORRUPT', 'The committed task and its durable receipt disagree.');
  const receipt: TaskCheckpoint = { runId: record.runId, revision: record.revision, taskId: commit.taskId,
    operationId: commit.operationId, plan: commit.plan ?? record.state.plan,
    specRevision: commit.specRevision, candidateDigest: commit.candidateDigest,
    proposalId: candidate.proposalId, scope: candidate.scope, from: commit.from, accepted: commit.to };
  return receipt;
}

/** The run record is authoritative. Native objects are immutable and durable before a record can refer to them. */
export class TaskRunStore {
  private record?: RunRecord;
  private closed = false;
  private uncertain = false;
  private notifying = false;
  private constructor(private readonly directory: string, private readonly owner: Owner, private readonly afterWrite?: (point: WritePoint) => void) {}

  static create(directory: string, runId: string, doc: StudioDoc, state: RunState, afterWrite?: (point: WritePoint) => void, replacement?: TaskRunReplacementProvenance): TaskRunStore {
    if (!id(runId) || runId.length > 120) issue('RUN_CORRUPT', 'Invalid run name.');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    directory = realpathSync(directory);
    const requireAbsentRecord = () => {
      try { lstatSync(join(directory, 'run.json')); issue('RUN_EXISTS', 'A run already exists.'); } catch (error) {
        if (!errno(error, 'ENOENT')) throw error;
      }
    };
    const store = new TaskRunStore(directory, takeOwner(directory, requireAbsentRecord), afterWrite);
    try {
      mkdirSync(store.objects, { recursive: true, mode: 0o700 });
      syncDirectory(directory);
      const accepted = store.writeNative(doc);
      store.writeRecord({ version: 1, runId: runId + ':' + randomUUID(), epoch: store.owner.epoch, revision: 0, accepted, state, commits: [], ...(replacement && { replacement }) });
      return store;
    } catch (error) {
      store.closeAfterError();
      throw error;
    }
  }

  /** Read the durable checkpoint while a writer is active, without acquiring or advancing its epoch. */
  static inspect(directory: string): RunRecord {
    return TaskRunStore.readAcceptedBaseline(directory).record;
  }

  static readAcceptedBaseline(directory: string, guard?: (record: RunRecord) => void) {
    const path = realpathSync(directory), record = recordAt(path);
    guard?.(record);
    return { record, bytes: readObject(path, record.accepted) };
  }

  /** Export one committed task from a single read of the durable pointer. The native files are immutable. */
  static readTaskCheckpoint(directory: string, select = taskCheckpointFor) {
    const path = realpathSync(directory), record = recordAt(path);
    const receipt = select(record);
    return { receipt, before: readObject(path, receipt.from), accepted: readObject(path, receipt.accepted) };
  }

  /** Read an exportable pending candidate from one durable record without taking its writer lease. */
  static readCandidateReview(directory: string, taskId: string) {
    const path = realpathSync(directory), record = recordAt(path), { state } = record;
    const receipt = candidateReviewFor(record, taskId);
    return { receipt, bytes: readObject(path, record.accepted), controlRevision: state.controlRevision };
  }

  static open(directory: string, afterWrite?: (point: WritePoint) => void, guard?: (record: RunRecord) => void): TaskRunStore {
    directory = realpathSync(directory);
    const store = new TaskRunStore(directory, takeOwner(directory, guard && (() => guard(recordAt(directory)))), afterWrite);
    try {
      const prior = recordAt(directory);
      store.readNative(prior.accepted);
      store.record = prior;
      return store;
    } catch (error) {
      store.closeAfterError();
      if (error instanceof RunStoreError) throw error;
      return issue('RUN_CORRUPT', messageOf(error));
    }
  }

  get epoch() { return this.owner.epoch; }
  get snapshot(): RunRecord { return structuredClone(this.current()); }
  get acceptedBytes(): Uint8Array { return this.readNative(this.current().accepted); }
  private get objects(): string { return join(this.directory, 'native'); }

  private current(): RunRecord {
    if (this.closed || this.uncertain) issue('RUN_CLOSED', 'Reopen the run before using this writer.');
    return this.record ?? issue('RUN_CORRUPT', 'The writer has no run record.');
  }
  private expect(revision: number): RunRecord {
    if (this.notifying) issue('RUN_BUSY', 'A durability callback cannot change the run.');
    const record = this.current();
    return record.revision === revision ? record : issue('RUN_STALE', 'The run record changed before publication.');
  }
  private readNative(ref: NativeRef): Uint8Array { return readObject(this.directory, ref); }
  private writeNative(doc: StudioDoc): NativeRef {
    const bytes = encodeStudioFile(doc), ref = { sha256: sha256Hex(bytes), modelDigest: digestOf(doc) };
    try {
      if (!writeAtomic(this.objects, ref.sha256 + '.bcad', bytes, false)) {
        this.readNative(ref);
        syncDirectory(this.objects);
      }
      this.notify('native-durable');
      return ref;
    } catch (error) {
      this.uncertain = true;
      return issue('RUN_STORAGE', messageOf(error));
    }
  }
  private writeRecord(record: RunRecord): void {
    try {
      writeAtomic(this.directory, 'run.json', JSON.stringify({ digest: digestOf(record), record }), true);
      this.record = structuredClone(record);
      this.notify('record-durable');
    } catch (error) {
      this.uncertain = true;
      issue('RUN_STORAGE', messageOf(error));
    }
  }
  private notify(point: WritePoint): void {
    this.notifying = true;
    try { this.afterWrite?.(point); } finally { this.notifying = false; }
  }
  private advance(record: RunRecord, next: Partial<Pick<RunRecord, 'state' | 'pending' | 'accepted' | 'commits'>>) {
    this.writeRecord({ ...record, ...next, epoch: this.epoch, revision: record.revision + 1 });
  }

  /** Persist recovery state under the new writer epoch before dispatching or applying decisions. */
  recover(revision: number, state: RunState): void {
    const record = this.expect(revision);
    if (record.epoch === this.epoch || record.epoch > this.epoch) issue('RUN_STALE', 'This writer cannot recover that epoch.');
    // The previous pointer is authoritative. A staged native object alone never denotes a commit.
    this.advance(record, { state, pending: undefined });
  }

  checkpoint(revision: number, state: RunState): void {
    const record = this.expect(revision);
    if (record.epoch !== this.epoch) issue('RUN_STALE', 'Recover the current writer epoch first.');
    this.advance(record, { state });
  }
  reserveCommit(revision: number, intent: CommitIntent, state: RunState): void {
    const record = this.expect(revision);
    const task = record.state.tasks.find(item => item.id === intent.taskId);
    const validTask = task && (intent.kind === 'spec'
      ? ['ready', 'stale', 'failed'].includes(task.phase)
      : task.phase === 'awaiting-decision' && task.candidate?.candidateDigest === intent.candidateDigest
        && task.candidate.specRevision === intent.specRevision);
    if (record.epoch !== this.epoch || record.state.phase !== 'active' || state.phase !== 'active'
      || record.state.controlRevision !== state.controlRevision || record.pending || !validTask || !id(intent.operationId)
      || !state.tasks.some(item => item.id === intent.taskId && item.phase === 'committing')
      || !state.operations.some(o => o.id === intent.operationId && o.epoch === this.epoch && o.phase === 'reserved')
      || record.commits.some(item => item.operationId === intent.operationId) || intent.specRevision !== record.state.specRevision) {
      issue('RUN_STALE', 'The run cannot reserve this publication.');
    }
    this.advance(record, { state, pending: { ...intent, base: record.accepted, controlRevision: state.controlRevision, priorPhase: task!.phase } });
  }
  discardCommit(revision: number, operationId: string, state: RunState): void {
    const record = this.expect(revision);
    if (record.epoch !== this.epoch || record.pending?.operationId !== operationId) issue('RUN_STALE', 'The publication is no longer reserved.');
    this.advance(record, { state, pending: undefined });
  }
  publish(revision: number, operationId: string, doc: StudioDoc, state: RunState): void {
    const record = this.expect(revision), pending = record.pending;
    if (record.epoch !== this.epoch || record.state.phase !== 'active' || state.phase !== 'active'
      || pending?.operationId !== operationId || pending.controlRevision !== record.state.controlRevision
      || pending.controlRevision !== state.controlRevision || pending.specRevision !== record.state.specRevision
      || !record.state.tasks.some(item => item.id === pending.taskId && item.phase === 'committing')
      || !state.tasks.some(item => item.id === pending.taskId && item.phase === (pending.kind === 'spec' ? 'ready' : 'completed'))
      || !state.operations.some(o => o.id === operationId && o.epoch === this.epoch && o.phase === 'completed')
      || !sameNative(pending.base, record.accepted)) {
      return issue('RUN_STALE', 'The candidate no longer owns publication.');
    }
    const accepted = this.writeNative(doc);
    if (sameNative(accepted, record.accepted)) issue('RUN_STALE', 'The candidate made no accepted change.');
    const { operationId: committed, taskId, specRevision, base } = pending;
    const common = { operationId: committed, taskId, specRevision, epoch: this.epoch, from: base, to: accepted };
    const receipt: CommitReceipt = pending.kind === 'spec' ? { ...common, kind: 'spec', questionDigest: pending.questionDigest }
      : { ...common, candidateDigest: pending.candidateDigest, plan: record.state.plan };
    this.advance(record, { accepted, state, pending: undefined, commits: [...record.commits, receipt] });
  }
  close(): void {
    if (this.notifying) issue('RUN_BUSY', 'A durability callback cannot release the writer.');
    if (this.closed) return;
    this.closed = true;
    if (!writeAtomic(this.directory, `released-${this.epoch}.json`, JSON.stringify(this.owner.id), false)) {
      issue('RUN_CORRUPT', 'The writer epoch was already released.');
    }
  }
  private closeAfterError(): void {
    try { this.close(); } catch { /* The first storage failure remains authoritative. */ }
  }
}
