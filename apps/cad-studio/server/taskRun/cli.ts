import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { userToken } from '@barocss/cad-model/team/ecr';
import type { TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { openModel, writeAtomic } from '../cadDoc';
import { TaskRunHost, type HostOutcome } from './host';
import { TaskRunStore, type RunLimits, type RunRecord } from './store';
import { threadWorker } from './thread';

interface Io { stdout: Pick<NodeJS.WriteStream, 'write'>; stderr: Pick<NodeJS.WriteStream, 'write'> }
interface Config { name: string; source: string; plan: TaskPlanRequest; limits: RunLimits; budget: number; heightsMm: Record<string, number> }
const HELP = 'cad-cli task-run <start dir config.json | status dir | work dir operation task height | refresh dir operation task | export dir part.bcad | decide dir operation task approve|reject | pause|resume|stop dir operation | policy dir operation revision 1|2 | answer dir operation task batch answers.json>';

async function operator(challenge: string) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('This action requires a terminal operator.');
  const terminal = createInterface({ input: process.stdin, output: process.stderr, terminal: false });
  try {
    const answer = await terminal.question(`Type "${challenge}" to continue.\n> `);
    if (answer.trim() !== challenge) throw new Error('The terminal action was not confirmed.');
    return userToken(new Date().toISOString());
  } finally { terminal.close(); }
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
  if (!directory || !['start', 'status', 'work', 'refresh', 'export', 'decide', 'pause', 'resume', 'stop', 'policy', 'answer'].includes(command)) {
    io.stderr.write(HELP + '\n');
    return 2;
  }
  let revision = 0, host: TaskRunHost | undefined;
  const evaluate = async (doc: StudioDoc) => evaluatePart(doc, ++revision);
  const worker = new URL('./taskRunWorker.mjs', import.meta.url);
  try {
    if (command === 'start') {
      if (args.length !== 1) throw new Error(HELP);
      const config = JSON.parse(readFileSync(args[0], 'utf8')) as Config;
      const source = await openModel(config.source);
      if ('error' in source) throw new Error(source.error);
      const tasks = config.plan.tasks.map(task => {
        const height = config.heightsMm[task.id];
        if (!Number.isFinite(height) || height <= 0) throw new Error(`Expected a positive height for ${task.id}.`);
        return { id: task.id, height };
      });
      host = await TaskRunHost.create(directory, config.name, source.doc, config.plan, config.limits, config.budget, evaluate);
      const active = host;
      const run = ({ id, height }: typeof tasks[number]) => active.dispatch('initial:' + id, id, threadWorker(worker, height), 'height-mm:' + height);
      const outcomes = config.limits.concurrent === 2 ? await Promise.all(tasks.map(run)) : [await run(tasks[0]), await run(tasks[1])];
      print({ ...status(active.snapshot), outcomes });
      return outcomes.every(outcome => outcome.phase === 'completed') ? 0 : 1;
    }

    if (command === 'status' && !args.length) { print(status(TaskRunStore.inspect(directory))); return 0; }
    host = await TaskRunHost.open(directory, evaluate);
    const [operation, task, value, file] = args;
    const record = host.snapshot, short = record.state.specRevision.slice(0, 12);
    let outcome: HostOutcome;
    if (command === 'export' && args.length === 1 && /\.bcad$/i.test(operation)) {
      const parent = realpathSync(dirname(resolve(operation))), inside = relative(realpathSync(directory), parent);
      if (!isAbsolute(inside) && inside !== '..' && !inside.startsWith('..' + sep)) throw new Error('Export to a file outside the run store.');
      writeAtomic(operation, host.acceptedBytes);
      print({ accepted: record.accepted });
      return 0;
    }
    if (command === 'work' && args.length === 3 && Number.isFinite(Number(value)) && Number(value) > 0) {
      outcome = await host.dispatch(operation, task, threadWorker(worker, Number(value)), 'height-mm:' + Number(value));
    } else if (command === 'refresh' && args.length === 2) {
      outcome = await host.refresh(operation, task);
    } else if (command === 'decide' && args.length === 3 && (value === 'approve' || value === 'reject')) {
      const held = record.state.tasks.find(item => item.id === task);
      if (!held?.candidate || !held.attempt || held.phase !== 'awaiting-decision') throw new Error('No current candidate is awaiting this decision.');
      print({ ...status(host.snapshot), task, decision: value });
      const token = await operator(`${value} ${task} ${held.candidate.candidateDigest.slice(0, 12)}`);
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
