import { spawn } from 'node:child_process';
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { compileTaskPlan } from '@barocss/cad-model/team/taskPlan';
import { readTaskSubmission } from '@barocss/cad-model/team/taskExecution';
import { digestOf, sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { isTaskRunBaselineRequest, isTaskRunLocator, isTaskRunRebuildRequest, sameTaskRunCheckpoint, type TaskRunCheckpointRequest, type TaskRunCheckpointPin, type TaskRunLaunch, type TaskRunLocator, type TaskRunRebuildRequest, type TaskRunReplanPin, type TaskRunReviewRequest, type TaskRunStatus } from '../../src/chat/taskRunOffer';
import { encodeTaskCheckpoint, MAX_TASK_CHECKPOINT_BYTES, type TaskCheckpoint } from '../../src/files/taskCheckpoint';
import { encodeCandidateReview } from '../../src/files/taskCandidateReview';
import { TaskRunHost } from './host';
import { prepareTaskRunHandoff, startLocalTaskRun } from './start';
import { candidateReviewFor, taskApprovalFor, taskApprovals, taskCheckpointFor, RunStoreError, TaskRunStore, type RunRecord, type RunTask } from './store';

export class LocalRunRequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

type LocalRunReply = { result: TaskRunLaunch } | { status: number; error: string };

type HandoffAction = 'start' | 'reopen';
type LocalRunAction = HandoffAction | 'rebuild';

function runInProcess(root: string, bytes: Uint8Array, action: LocalRunAction): Promise<TaskRunLaunch> {
  return new Promise((resolve, reject) => {
    // The local runner has a separate PID and a fresh native blob store for each admission.
    const child = spawn(process.execPath, [fileURLToPath(new URL('./localTaskRun.mjs', import.meta.url)), root, action], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    const failed = () => reject(new LocalRunRequestError(500, 'The local task run process did not return a result.'));
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', text => { output += text; });
    let processError = false;
    const markFailed = () => { processError = true; };
    child.stdin.on('error', markFailed);
    child.once('error', markFailed);
    child.once('close', code => {
      if (code !== 0 || processError) return failed();
      let reply: LocalRunReply;
      try { reply = JSON.parse(output); }
      catch { return failed(); }
      if ('result' in reply) resolve(reply.result);
      else reject(new LocalRunRequestError(reply.status, reply.error));
    });
    child.stdin.end(bytes);
  });
}

export function createLocalTaskRuns(root: string) {
  let active: { action: LocalRunAction; bytesHash: string; result: Promise<TaskRunLaunch> } | undefined;
  return async (bytes: Uint8Array, action: LocalRunAction): Promise<TaskRunLaunch> => {
    const bytesHash = sha256Hex(bytes);
    if (active) {
      if (active.action === action && active.bytesHash === bytesHash) return { ...await active.result, reused: true };
      throw new LocalRunRequestError(409, 'Another local task action is in progress. Try again when it finishes.');
    }
    const result = runInProcess(root, bytes, action);
    active = { action, bytesHash, result };
    try { return await result; }
    finally { active = undefined; }
  };
}

function privateDirectory(path: string) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || (process.getuid && (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0)))
    throw new LocalRunRequestError(409, 'The local task run directory must be private and owned by this account.');
  return realpathSync(path);
}

function syncDirectory(path: string) {
  const fd = openSync(path, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

type PreparedHandoff = Awaited<ReturnType<typeof prepareTaskRunHandoff>>;

function handoffRunKey({ config, tasks }: PreparedHandoff) {
  return digestOf({ source: config.sourceSHA256, occurrences: tasks.map(task => task.id).sort() });
}

function inspectHandoffRun(directory: string, runKey: string, { config, tasks }: PreparedHandoff, reused: boolean): TaskRunLaunch {
  const record = TaskRunStore.inspect(directory);
  const source = record.commits[0]?.from ?? record.accepted;
  const scopes = (plan: typeof config.plan) => plan.tasks.map(({ id, occurrence, feature, capability, units, frame }) =>
    ({ id, occurrence, feature, capability, units, frame })).sort((a, b) => a.id.localeCompare(b.id));
  if (source.modelDigest !== config.modelDigest
    || digestOf(record.state.plan.identity) !== digestOf(config.plan.identity)
    || digestOf(scopes(record.state.plan)) !== digestOf(scopes(config.plan))
    || digestOf(record.state.tasks.map(task => task.id).sort()) !== digestOf(tasks.map(task => task.id).sort()))
    throw new LocalRunRequestError(409, 'The existing local task run has a different source or selection.');
  return { ...taskRunStatus(runKey, record), directory, reused };
}

function reopenLocalTaskRun(root: string, prepared: PreparedHandoff): TaskRunLaunch {
  const key = handoffRunKey(prepared);
  try {
    const directory = privateDirectory(join(privateDirectory(resolve(root)), key));
    return inspectHandoffRun(directory, key, prepared, true);
  } catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new LocalRunRequestError(404, 'No local task run has been started for this handoff.');
    throw new LocalRunRequestError(409, 'Could not read the existing local task run.');
  }
}

async function launchLocalTaskRun(root: string, prepared: PreparedHandoff): Promise<TaskRunLaunch> {
  const key = handoffRunKey(prepared);
  root = resolve(root);
  const created = mkdirSync(root, { recursive: true, mode: 0o700 });
  const privateRoot = privateDirectory(root);
  if (created) {
    const parent = realpathSync(dirname(created));
    for (let path = privateRoot; path !== parent && path !== dirname(path); path = dirname(path)) syncDirectory(path);
    syncDirectory(parent);
  }
  const directory = join(privateRoot, key);
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  privateDirectory(directory);
  syncDirectory(privateRoot);

  const inspect = (reused = true) => inspectHandoffRun(directory, key, prepared, reused);
  try { return inspect(); }
  catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new LocalRunRequestError(409, `Could not read the existing local run. Check ${directory}.`);
  }
  try {
    await startLocalTaskRun(directory, prepared);
    return inspect(false);
  }
  catch (error) {
    if (error instanceof RunStoreError && error.code === 'RUN_BUSY')
      throw new LocalRunRequestError(409, 'Another process owns this local task run. Try again when it finishes.');
    if (error instanceof RunStoreError && error.code === 'RUN_EXISTS') return inspect();
    throw new LocalRunRequestError(500, `Could not finish starting the local run. Check ${directory}.`);
  }
}

export async function runLocalTaskHandoff(root: string, bytes: Uint8Array, action: HandoffAction = 'start'): Promise<LocalRunReply> {
  try {
    const prepared = await prepareTaskRunHandoff(bytes).catch((error: unknown) => {
      throw new LocalRunRequestError(400, error instanceof Error ? error.message : 'Invalid task run handoff.');
    });
    return { result: action === 'reopen' ? reopenLocalTaskRun(root, prepared) : await launchLocalTaskRun(root, prepared) };
  }
  catch (error) {
    return error instanceof LocalRunRequestError ? { status: error.status, error: error.message }
      : { status: 500, error: 'Could not access the local task run directory.' };
  }
}

function taskRunStatus(runKey: string, record: RunRecord): TaskRunStatus {
  const approvals = taskApprovals(record).map(toCheckpointPin);
  return { runKey, runId: record.runId, phase: record.state.phase, revision: record.revision,
    baselineDigest: record.accepted.modelDigest, checkpoint: checkpointPin(record),
    ...(approvals.length ? { approvals } : {}),
    tasks: record.state.tasks.map(task => ({
      id: task.id, phase: task.phase, reason: task.reason, review: reviewPin(record, task.id), rebuild: rebuildPin(record, task),
      replan: replanPin(record, task),
    })) };
}

function replanPin(record: RunRecord, task: RunTask): TaskRunReplanPin | undefined {
  if (record.state.phase !== 'active' || record.pending || task.phase !== 'stale' || !task.attempt || !task.submission) return;
  const bound = record.state.plan.tasks.find(bound => bound.id === task.id);
  if (!bound) return;
  return { attemptId: task.attempt.id, occurrence: bound.occurrence, feature: bound.feature,
    field: bound.capability === 'rectangle-width' ? 'width' : 'height' };
}

function rebuildPin(record: RunRecord, task: RunTask): string | undefined {
  const { state } = record;
  if (state.phase !== 'active' || record.pending || task.phase !== 'stale' || !task.attempt || !task.submission
    || task.attempts >= state.limits.attemptsPerTask || state.sequence >= state.plan.throughSequence) return;
  return task.attempt.id;
}

function verifyRebuildSelection(record: RunRecord, request: TaskRunRebuildRequest) {
  const task = record.state.tasks.find(task => task.id === request.taskId);
  if (record.runId !== request.runId || record.revision !== request.revision || record.accepted.modelDigest !== request.baselineDigest
    || !task || rebuildPin(record, task) !== request.attemptId)
    throw new LocalRunRequestError(409, 'The candidate changed. Refresh the local run status before rebuilding.');
  return task;
}

/** Replay the stored scoped submission on the current native baseline under the one-writer guard. */
export async function runLocalTaskRebuild(root: string, request: unknown): Promise<LocalRunReply> {
  if (!isTaskRunRebuildRequest(request)) return { status: 400, error: 'Expected the local run, revision and stale attempt IDs.' };
  let host: TaskRunHost | undefined;
  try {
    const directory = privateDirectory(join(privateDirectory(resolve(root)), request.runKey));
    const guard = (record: RunRecord) => verifyRebuildSelection(record, request);
    const { bytes, record } = TaskRunStore.readAcceptedBaseline(directory, guard);
    const native = await readStudioFile(bytes);
    if ('error' in native || digestOf(native.doc) !== record.accepted.modelDigest)
      throw new LocalRunRequestError(409, 'The local run baseline could not be verified.');
    const plan = compileTaskPlan(native.doc, record.state.plan);
    if ('error' in plan || plan.specRevision !== record.state.specRevision)
      throw new LocalRunRequestError(409, 'The local run specification could not be verified.');
    const task = guard(record), prior = readTaskSubmission(task.submission), bound = plan.tasks.find(item => item.id === task.id);
    if (!prior || prior.taskId !== task.id || !bound || bound.blockers.length || prior.inputDigest !== bound.inputDigest)
      throw new LocalRunRequestError(409, 'The task inputs changed. Prepare a new plan.');
    let revision = 0;
    host = await TaskRunHost.open(directory, async (doc: StudioDoc) => evaluatePart(doc, ++revision), undefined, guard);
    const operation = 'studio-rebuild:' + digestOf(request);
    const outcome = await host.refresh(operation, task.id);
    if (outcome.phase !== 'completed')
      throw new LocalRunRequestError(409, `The candidate could not be rebuilt (${outcome.code ?? outcome.phase}). Refresh the local run status.`);
    return { result: { ...taskRunStatus(request.runKey, host.snapshot), directory, reused: true } };
  } catch (error) {
    if (error instanceof LocalRunRequestError) return { status: error.status, error: error.message };
    if (error instanceof RunStoreError && error.code === 'RUN_BUSY') return { status: 409, error: 'Another process owns this local task run.' };
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { status: 404, error: 'The local task run could not be found.' };
    return { status: 409, error: 'Could not rebuild the local task candidate.' };
  } finally { host?.close(); }
}

function toCheckpointPin({ taskId, operationId, accepted }: TaskCheckpoint): TaskRunCheckpointPin {
  return { taskId, operationId, acceptedSHA256: accepted.sha256 };
}

function checkpointPin(record: RunRecord) {
  try {
    return toCheckpointPin(taskCheckpointFor(record));
  } catch (error) {
    if (!(error instanceof RunStoreError) || error.code !== 'RUN_STALE') throw error;
  }
}

function reviewPin(record: RunRecord, taskId: string) {
  try {
    const { attemptId, candidateDigest } = candidateReviewFor(record, taskId);
    return { attemptId, candidateDigest };
  } catch (error) {
    if (!(error instanceof RunStoreError) || error.code !== 'RUN_STALE') throw error;
  }
}

const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;

function readReviewRequest(value: unknown): TaskRunReviewRequest {
  if (!isObj(value) || Object.keys(value).length !== 6 || !isTaskRunLocator(value)
    || !id(value.taskId) || !id(value.attemptId) || !sha(value.candidateDigest) || !sha(value.baselineDigest))
    throw new LocalRunRequestError(400, 'Expected the local run, candidate and baseline IDs.');
  const { runKey, runId, taskId, attemptId, candidateDigest, baselineDigest } = value;
  return { runKey, runId, taskId, attemptId, candidateDigest, baselineDigest };
}

function readOwnedTaskRun(root: string, { runKey, runId }: TaskRunLocator): RunRecord {
  try {
    const directory = privateDirectory(join(privateDirectory(resolve(root)), runKey));
    const record = TaskRunStore.inspect(directory);
    if (record.runId !== runId) throw new LocalRunRequestError(409, 'The local run changed. Start the plan again.');
    return record;
  } catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new LocalRunRequestError(404, 'The local task run could not be found.');
    throw new LocalRunRequestError(409, 'Could not read the local task run.');
  }
}

export function readLocalTaskRunStatus(root: string, request: unknown): TaskRunStatus {
  if (!isObj(request) || Object.keys(request).length !== 2 || !isTaskRunLocator(request))
    throw new LocalRunRequestError(400, 'Expected the local run key and ID.');
  const record = readOwnedTaskRun(root, request);
  try { return taskRunStatus(request.runKey, record); }
  catch { throw new LocalRunRequestError(409, 'Could not read the local task run status.'); }
}

export function readLocalTaskBaseline(root: string, request: unknown) {
  if (!isTaskRunBaselineRequest(request))
    throw new LocalRunRequestError(400, 'Expected the local run and baseline digest.');
  try {
    const directory = privateDirectory(join(privateDirectory(resolve(root)), request.runKey));
    const { record, bytes } = TaskRunStore.readAcceptedBaseline(directory, current => {
      if (current.runId !== request.runId || current.accepted.modelDigest !== request.baselineDigest)
        throw new LocalRunRequestError(409, 'The run baseline changed. Refresh the local run status.');
    });
    if (!bytes.length || bytes.length > MAX_TASK_CHECKPOINT_BYTES)
      throw new LocalRunRequestError(413, 'The run baseline exceeds the supported size.');
    return { bytes, sha256: record.accepted.sha256 };
  } catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new LocalRunRequestError(404, 'The local task run could not be found.');
    throw new LocalRunRequestError(409, 'Could not read the local run baseline.');
  }
}

/** The service owns the root. A browser supplies only the identifiers from its launched run and current document. */
export function readLocalTaskCandidate(root: string, request: unknown): string {
  const selection = readReviewRequest(request);
  const { taskId, attemptId, candidateDigest, baselineDigest } = selection;
  const record = readOwnedTaskRun(root, selection);
  if (record.accepted.modelDigest !== baselineDigest)
    throw new LocalRunRequestError(409, 'Open the exact native baseline of this worker candidate first.');
  try {
    const receipt = candidateReviewFor(record, taskId);
    if (receipt.attemptId !== attemptId || receipt.candidateDigest !== candidateDigest)
      throw new LocalRunRequestError(409, 'The worker candidate changed. Refresh the local run status.');
    return encodeCandidateReview(receipt);
  } catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if (error instanceof RunStoreError && error.code === 'RUN_STALE')
      throw new LocalRunRequestError(409, 'This candidate is no longer awaiting review. Refresh the local run.');
    throw new LocalRunRequestError(409, 'Could not read the current worker candidate.');
  }
}

export function readLocalTaskApproval(root: string, request: unknown): Uint8Array {
  return readLocalCheckpoint(root, request, taskApprovalFor);
}

export function readLocalTaskCheckpoint(root: string, request: unknown): Uint8Array {
  return readLocalCheckpoint(root, request, taskCheckpointFor);
}

function readLocalCheckpoint(root: string, request: unknown, select: (record: RunRecord, operationId: string) => TaskCheckpoint): Uint8Array {
  if (!isObj(request) || Object.keys(request).length !== 5 || !isTaskRunLocator(request)
    || !id(request.taskId) || !id(request.operationId) || !sha(request.acceptedSHA256))
    throw new LocalRunRequestError(400, 'Expected the local run and approved checkpoint IDs.');
  const { runKey, runId, taskId, operationId, acceptedSHA256 } = request;
  const selected: TaskRunCheckpointRequest = { runKey, runId, taskId, operationId, acceptedSHA256 };
  try {
    const directory = privateDirectory(join(privateDirectory(resolve(root)), runKey));
    const { receipt, before, accepted } = TaskRunStore.readTaskCheckpoint(directory, record => {
      if (record.runId !== runId) throw new LocalRunRequestError(409, 'The local run changed.');
      const checkpoint = select(record, operationId);
      if (!sameTaskRunCheckpoint(selected, toCheckpointPin(checkpoint)))
        throw new LocalRunRequestError(409, 'The approved checkpoint changed. Refresh the local run status.');
      return checkpoint;
    });
    return encodeTaskCheckpoint(receipt, before, accepted);
  } catch (error) {
    if (error instanceof LocalRunRequestError) throw error;
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new LocalRunRequestError(404, 'The local task run could not be found.');
    throw new LocalRunRequestError(409, 'Could not read the approved local checkpoint.');
  }
}
