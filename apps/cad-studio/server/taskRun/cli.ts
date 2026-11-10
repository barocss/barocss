import { closeSync, constants, fstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { readStudioFile, readStudioWorkingCopy } from '@barocss/cad-model/engine/container';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { userToken } from '@barocss/cad-model/team/ecr';
import type { TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { sha256Hex } from '@barocss/cad-model/util/digest';
import { canonical } from '@barocss/cad-model/util/revision';
import { encodeTaskCheckpoint, readTaskCheckpoint, TASK_CHECKPOINT_EXT } from '../../src/files/taskCheckpoint';
import { decodeCandidateReview, encodeCandidateReview, MAX_TASK_CANDIDATE_BYTES, readCandidateReview,
  TASK_CANDIDATE_EXT, type CandidateReviewReceipt } from '../../src/files/taskCandidateReview';
import { notLocalModel, openModel, writeAtomic } from '../cadDoc';
import { TaskRunHost, type HostOutcome } from './host';
import { deriveLocalRunPlan, localRunPlanInputs } from './localPlan';
import { candidateReviewFor, TaskRunStore, type RunLimits, type RunRecord } from './store';
import { threadWorker } from './thread';

interface Io { stdout: Pick<NodeJS.WriteStream, 'write'>; stderr: Pick<NodeJS.WriteStream, 'write'> }
interface Config { name: string; source: string; plan: TaskPlanRequest; limits: RunLimits; budget: number; heightsMm: Record<string, number> }
const HELP = 'cad-cli task-run <plan source.bcad occurrenceA occurrenceB | start dir config.json | start dir --plan plan.json | status dir | work dir operation task height | refresh dir operation task | export dir part.bcad|part.bcad-run | review dir task part.bcad-candidate | decide dir operation task approve|reject [--review file.bcad-candidate] | pause|resume|stop dir operation | policy dir operation revision 1|2 | answer dir operation task batch answers.json>';

function exportPath(directory: string, output: string): string {
  const parent = realpathSync.native(dirname(output)), run = statSync(directory, { bigint: true });
  for (let path = parent; ; path = dirname(path)) {
    const here = statSync(path, { bigint: true });
    if (here.dev === run.dev && here.ino === run.ino) throw new Error('Export to a file outside the run store.');
    if (dirname(path) === path) break;
  }
  return join(parent, basename(output));
}

async function operator(challenge: string) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('This action requires a terminal operator.');
  const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  try {
    const answer = await terminal.question(`Type "${challenge}" to continue.\n> `);
    if (answer.trim() !== challenge) throw new Error('The terminal action was not confirmed.');
    return userToken(new Date().toISOString());
  } finally { terminal.close(); }
}

function readLocalFile(file: string, limit: number, label: string) {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw new Error(`Expected a local ${label} file within the supported size.`);
    const bytes = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < bytes.length) {
      const count = readSync(fd, bytes, size, bytes.length - size, null);
      if (!count) break;
      size += count;
    }
    if (size !== stat.size) throw new Error(`The ${label} changed while reading.`);
    return new Uint8Array(bytes.buffer, bytes.byteOffset, size);
  } finally { closeSync(fd); }
}

function readDecisionReview(file: string): CandidateReviewReceipt {
  const bytes = readLocalFile(file, MAX_TASK_CANDIDATE_BYTES, 'candidate review');
  const review = decodeCandidateReview(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if ('error' in review) throw new Error(review.error);
  return review;
}

async function localPlan(sourcePath: string, occurrences: readonly string[], expectedSHA256?: string) {
  const why = notLocalModel(sourcePath);
  if (why) throw new Error(why);
  const source = resolve(sourcePath), bytes = readLocalFile(source, 16 * 1024 * 1024, 'native plan source');
  const sourceSHA256 = sha256Hex(bytes);
  if (expectedSHA256 !== undefined && expectedSHA256 !== sourceSHA256)
    throw new Error('The native source bytes changed. Generate and review a new plan.');
  const model = await readStudioFile(bytes);
  if ('error' in model) throw new Error(model.error);
  if (model.notes.length) throw new Error('Save the native source in Studio before planning: ' + model.notes.join(', '));
  return { doc: model.doc, plan: deriveLocalRunPlan(model.doc, source, sourceSHA256, occurrences) };
}

async function readStart(args: readonly string[]) {
  if (args.length === 2 && args[0] === '--plan') {
    const bytes = readLocalFile(args[1], 128 * 1024, 'local run plan');
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const inputs = localRunPlanInputs(value);
    const { doc, plan } = await localPlan(inputs.source, inputs.occurrences, inputs.sourceSHA256);
    if (canonical(plan) !== canonical(value)) throw new Error('The plan differs from the authored source and local run limits. Generate and review it again.');
    return { doc, config: plan, tasks: plan.targets.map(target => ({ id: target.id, height: target.heightMm })) };
  }
  if (args.length !== 1 || args[0] === '--plan') throw new Error(HELP);
  const config = JSON.parse(readFileSync(args[0], 'utf8')) as Config;
  const source = await openModel(config.source);
  if ('error' in source) throw new Error(source.error);
  const tasks = config.plan.tasks.map(task => {
    const height = config.heightsMm[task.id];
    if (!Number.isFinite(height) || height <= 0) throw new Error(`Expected a positive height for ${task.id}.`);
    return { id: task.id, height };
  });
  return { doc: source.doc, config, tasks };
}

function requireMatchingReview(review: CandidateReviewReceipt, current: CandidateReviewReceipt) {
  // Unrelated work and writer recovery can advance the run revision without changing the candidate.
  if (review.revision > current.revision || canonical({ ...review, revision: current.revision }) !== canonical(current))
    throw new Error('The reviewed candidate differs from the current attempt. Export and review it again.');
}

async function confirmReviewedDecision(run: string, operation: string, task: string, decision: 'approve' | 'reject', file: string, print: (value: unknown) => void) {
  const review = readDecisionReview(file);
  const initial = TaskRunStore.readCandidateReview(run, task);
  requireMatchingReview(review, initial.receipt);
  print({ reviewedCandidate: review, decision });
  const token = await operator(`${decision} ${review.candidateDigest.slice(0, 12)}`);
  const guard = (record: RunRecord) => {
    requireMatchingReview(review, candidateReviewFor(record, task));
    if (record.state.controlRevision !== initial.controlRevision) throw new Error('The run controls changed during confirmation. Review the candidate again.');
    if (record.state.operations.some(prior => prior.id === operation)) throw new Error('The operation ID is already in use.');
  };
  return { token, guard };
}
function status(record: RunRecord) {
  const { state } = record;
  return {
    runId: record.runId, epoch: record.epoch, phase: state.phase, specRevision: state.specRevision, accepted: record.accepted,
    budget: state.budget, next: state.phase !== 'active' ? state.phase : record.pending ? 'committing' : 'select a task',
    tasks: state.tasks.map(t => ({ id: t.id, phase: t.phase, reason: t.reason, attempts: t.attempts,
      candidateDigest: t.candidate?.candidateDigest, geometry: t.candidate?.geometry })),
  };
}

export async function taskRunMain(argv: readonly string[], io: Io): Promise<number> {
  const [command, directory, ...args] = argv;
  const print = (value: unknown) => io.stdout.write(JSON.stringify(value) + '\n');
  if (!directory || !['plan', 'start', 'status', 'work', 'refresh', 'export', 'review', 'decide', 'pause', 'resume', 'stop', 'policy', 'answer'].includes(command)) {
    io.stderr.write(HELP + '\n');
    return 2;
  }
  let revision = 0, host: TaskRunHost | undefined;
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, ++revision);
  const worker = new URL('./taskRunWorker.mjs', import.meta.url);
  try {
    if (command === 'plan') {
      if (args.length !== 2) throw new Error(HELP);
      print((await localPlan(directory, args)).plan);
      return 0;
    }
    if (command === 'start') {
      const { doc, config, tasks } = await readStart(args);
      host = await TaskRunHost.create(directory, config.name, doc, config.plan, config.limits, config.budget, evaluate);
      const active = host;
      const run = ({ id, height }: typeof tasks[number]) => active.dispatch('initial:' + id, id, threadWorker(worker, height), 'height-mm:' + height);
      const outcomes = config.limits.concurrent === 2 ? await Promise.all(tasks.map(run)) : [await run(tasks[0]), await run(tasks[1])];
      print({ ...status(active.snapshot), outcomes });
      return outcomes.every(outcome => outcome.phase === 'completed') ? 0 : 1;
    }

    const run = realpathSync(directory);
    if (command === 'status' && !args.length) { print(status(TaskRunStore.inspect(run))); return 0; }
    if (command === 'review') {
      const [task, output] = args;
      if (args.length !== 2 || !output.toLowerCase().endsWith(TASK_CANDIDATE_EXT)) throw new Error(HELP);
      const target = exportPath(run, output);
      const { receipt, bytes } = TaskRunStore.readCandidateReview(run, task);
      const baseline = await readStudioWorkingCopy(new Uint8Array(bytes));
      if ('error' in baseline) throw new Error(baseline.error);
      const text = encodeCandidateReview(receipt), checked = readCandidateReview(text, baseline.doc);
      if ('error' in checked) throw new Error(checked.error);
      writeAtomic(target, text);
      print({ candidateReview: receipt });
      return 0;
    }
    if (command === 'export' && args.length === 1 && args[0].toLowerCase().endsWith(TASK_CHECKPOINT_EXT)) {
      const [output] = args;
      const target = exportPath(run, output);
      const { receipt, before, accepted } = TaskRunStore.readTaskCheckpoint(run);
      const bytes = encodeTaskCheckpoint(receipt, before, accepted);
      const checked = await readTaskCheckpoint(bytes);
      if (!checked || 'error' in checked) throw new Error(checked?.error ?? 'The worker checkpoint could not be checked.');
      writeAtomic(target, bytes);
      print({ checkpoint: receipt });
      return 0;
    }
    const [operation, task, value, file] = args;
    let confirmed: Awaited<ReturnType<typeof confirmReviewedDecision>> | undefined;
    if (command === 'decide') {
      if ((value !== 'approve' && value !== 'reject') || (args.length !== 3 && (args.length !== 5 || file !== '--review')))
        throw new Error(HELP);
      if (args.length === 5) {
        if (!operation || operation.length > 160) throw new Error('Invalid operation ID.');
        confirmed = await confirmReviewedDecision(run, operation, task, value, args[4], print);
      }
    }
    host = await TaskRunHost.open(run, evaluate, undefined, confirmed?.guard);
    const record = host.snapshot, short = record.state.specRevision.slice(0, 12);
    let outcome: HostOutcome;
    if (command === 'export' && args.length === 1 && /\.bcad$/i.test(operation)) {
      writeAtomic(exportPath(run, operation), host.acceptedBytes);
      print({ accepted: record.accepted });
      return 0;
    }
    if (command === 'work' && args.length === 3 && Number.isFinite(Number(value)) && Number(value) > 0) {
      outcome = await host.dispatch(operation, task, threadWorker(worker, Number(value)), 'height-mm:' + Number(value));
    } else if (command === 'refresh' && args.length === 2) {
      outcome = await host.refresh(operation, task);
    } else if (command === 'decide') {
      const held = record.state.tasks.find(item => item.id === task);
      if (!held?.candidate || !held.attempt || held.phase !== 'awaiting-decision') throw new Error('No current candidate is awaiting this decision.');
      if (!confirmed) print({ ...status(host.snapshot), task, decision: value });
      const token = confirmed?.token ?? await operator(`${value} ${task} ${held.candidate.candidateDigest.slice(0, 12)}`);
      outcome = await host.decide({ operationId: operation, runId: record.runId, epoch: record.epoch, taskId: task,
        attemptId: held.attempt.id, specRevision: held.candidate.specRevision, candidateDigest: held.candidate.candidateDigest, approved: value === 'approve' }, token);
    } else if ((command === 'pause' || command === 'resume' || command === 'stop') && args.length === 1) {
      outcome = host.control(operation, command, await operator(`${command} ${short}`));
    } else if (command === 'policy' && args.length === 3 && (value === '1' || value === '2')) {
      outcome = host.revisePolicy(operation, task, value === '1' ? 1 : 2, await operator(`policy ${task} ${short}`));
    } else if (command === 'answer' && args.length === 4 && Number.isSafeInteger(Number(value))) {
      const answers = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string | number | null>;
      print({ ...status(host.snapshot), task, batch: Number(value), answers });
      outcome = await host.answer({ operationId: operation, runId: record.runId, epoch: record.epoch, specRevision: record.state.specRevision,
        taskId: task, batch: Number(value), answers }, await operator(`answer ${task} ${short}`));
    } else throw new Error(HELP);
    print({ ...status(host.snapshot), outcome });
    return outcome.phase === 'completed' ? 0 : 1;
  } catch (error) {
    io.stderr.write(`cad-cli task-run: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  } finally { host?.close(); }
}
