import { isMainThread, parentPort, threadId, Worker, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import { interfacesRevision } from '@barocss/cad-model/team/interfaces';
import { buildTaskCandidate, taskSubmissionForDimension } from '@barocss/cad-model/team/taskExecution';
import { compileTaskPlan } from '@barocss/cad-model/team/taskPlan';
import type { TaskWorker, WorkerReply, WorkerTicket } from './host';

interface ThreadInput {
  kind: 'barocss-task-v1';
  ticket: WorkerTicket;
  valueMm: number;
  gate?: SharedArrayBuffer;
  nativeGate?: SharedArrayBuffer;
}
export interface ThreadStart { type: 'ready'; threadId: number; startedAt: number; taskId: string }
export interface ThreadFinish {
  type: 'complete';
  reply: WorkerReply;
  threadId: number;
  finishedAt: number;
  nativeStartedAt: number;
  nativeMs: number;
}
type ThreadMessage = ThreadStart | ThreadFinish | { type: 'failure'; code: string };
export interface ThreadOptions {
  gate?: SharedArrayBuffer;
  nativeGate?: SharedArrayBuffer;
  onStart?: (event: ThreadStart) => void;
  onFinish?: (event: ThreadFinish) => void;
}

/** Use a real Node isolate with its own evaluator and a structured-cloned native input. */
export function threadWorker(entry: URL, valueMm: number, options: ThreadOptions = {}): TaskWorker {
  return (ticket, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Worker cancelled before launch.')); return; }
    const input: ThreadInput = { kind: 'barocss-task-v1', ticket, valueMm, gate: options.gate, nativeGate: options.nativeGate };
    const worker = new Worker(entry, { workerData: input, execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 384 } });
    let finished: ThreadFinish | undefined, failure: Error | undefined;
    const cancel = () => {
      failure = new Error('Worker cancelled.');
      void worker.terminate().catch(() => undefined);
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.on('message', (message: ThreadMessage) => {
      try {
        if (message.type === 'ready') options.onStart?.(message);
        else if (message.type === 'complete') {
          finished = message;
          options.onFinish?.(message);
        } else failure = new Error(message.code);
      } catch (error) {
        failure = error instanceof Error ? error : new Error(String(error));
        void worker.terminate().catch(() => undefined);
      }
    });
    worker.once('error', error => { failure = error instanceof Error ? error : new Error(String(error)); });
    worker.once('exit', code => {
      signal.removeEventListener('abort', cancel);
      if (failure || code !== 0 || !finished) reject(failure ?? new Error(`Worker exited before its result (${code}).`));
      else resolve(finished.reply);
    });
  });
}

/** Shared bootstrap for bundled local host entries. A worker can return evidence, but it cannot write or approve. */
export async function serveTaskThread(evaluate: Evaluate): Promise<boolean> {
  if (isMainThread || workerData?.kind !== 'barocss-task-v1' || !parentPort) return false;
  const port = parentPort, { ticket, valueMm, gate, nativeGate } = workerData as ThreadInput;
  const send = (message: ThreadMessage) => port.postMessage(message);
  send({ type: 'ready', threadId, startedAt: performance.timeOrigin + performance.now(), taskId: ticket.task.id });
  if (gate) Atomics.wait(new Int32Array(gate), 0, 0);
  let start: number | undefined;
  const native: Evaluate = doc => {
    if (start === undefined) {
      start = performance.now();
      if (nativeGate) {
        const values = new Int32Array(nativeGate);
        if (Atomics.add(values, 0, 1) === 0) Atomics.wait(values, 0, 1);
        else Atomics.notify(values, 0);
      }
    }
    return evaluate(doc);
  };
  try {
    const { attempt, doc } = ticket, plan = compileTaskPlan(doc, ticket.plan);
    if ('error' in plan) { send({ type: 'failure', code: plan.error.code }); return true; }
    const task = plan.tasks.find(row => row.id === ticket.task.id);
    if (!task || task.holder !== ticket.task.holder || task.inputDigest !== attempt.inputDigest || plan.specRevision !== attempt.specRevision) {
      send({ type: 'failure', code: 'TASK_SUBMISSION_MISMATCH' });
      return true;
    }
    const pin = { taskId: task.id, specRevision: plan.specRevision, inputDigest: task.inputDigest };
    const submission = taskSubmissionForDimension(pin, task.writes.field, valueMm);
    const candidate = await buildTaskCandidate(plan, { doc, bodies: [] }, submission, {
      activePlan: plan, identity: plan.identity, policyRevision: plan.policyRevision, worker: task.holder,
      sequence: 0, leases: new Map([[task.occurrence, { part: task.occurrence, holder: task.holder, contract: interfacesRevision(doc), until: attempt.leaseUntil }]]),
    }, native);
    if ('error' in candidate && candidate.error.code !== 'TASK_NATIVE_GATE' && candidate.error.code !== 'TASK_HOLE_FACE') {
      send({ type: 'failure', code: candidate.error.code });
      return true;
    }
    // The host validates the same scoped submission before recording a native refusal.
    const evidence = 'error' in candidate ? { nativeGateRefused: true as const } : { nativeCandidateDigest: candidate.candidateDigest };
    send({
      type: 'complete', threadId, finishedAt: performance.timeOrigin + performance.now(), nativeStartedAt: performance.timeOrigin + start!, nativeMs: performance.now() - start!,
      reply: { runId: ticket.runId, epoch: attempt.epoch, attemptId: attempt.id, operationId: attempt.operationId, submission, usage: 1, ...evidence },
    });
  } catch {
    send({ type: 'failure', code: 'RUN_NATIVE_FAILED' });
  }
  return true;
}
