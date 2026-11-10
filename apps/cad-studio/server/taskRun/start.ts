import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { readTaskRunHandoff } from '../../src/files/taskRunHandoff';
import { TaskRunHost } from './host';
import { deriveLocalRunPlan } from './localPlan';
import type { RunLimits, RunRecord } from './store';
import { threadWorker } from './thread';

interface LocalTaskRun {
  doc: StudioDoc;
  config: { name: string; plan: TaskPlanRequest; limits: RunLimits; budget: number };
  tasks: { id: string; height: number }[];
}

export async function prepareTaskRunHandoff(bytes: Uint8Array) {
  const { doc, offer, sourceSHA256 } = await readTaskRunHandoff(bytes);
  const config = deriveLocalRunPlan(doc, 'handoff:' + sourceSHA256, sourceSHA256, offer.occurrences);
  return { doc, config, tasks: config.targets.map(target => ({ id: target.id, height: target.heightMm })) };
}

export function localRunStatus(record: RunRecord) {
  const { state } = record;
  return {
    runId: record.runId, epoch: record.epoch, phase: state.phase, specRevision: state.specRevision, accepted: record.accepted,
    budget: state.budget, next: state.phase !== 'active' ? state.phase : record.pending ? 'committing' : 'select a task',
    tasks: state.tasks.map(t => ({ id: t.id, phase: t.phase, reason: t.reason, attempts: t.attempts,
      candidateDigest: t.candidate?.candidateDigest, geometry: t.candidate?.geometry })),
  };
}

export async function startLocalTaskRun(directory: string, { doc, config, tasks }: LocalTaskRun) {
  let revision = 0;
  const evaluate = async (model: StudioDoc) => evaluatePart(model, ++revision);
  const worker = new URL('./taskRunWorker.mjs', import.meta.url);
  const host = await TaskRunHost.create(directory, config.name, doc, config.plan, config.limits, config.budget, evaluate);
  try {
    const run = ({ id, height }: typeof tasks[number]) => host.dispatch('initial:' + id, id, threadWorker(worker, height), 'height-mm:' + height);
    const outcomes = config.limits.concurrent === 2 ? await Promise.all(tasks.map(run)) : [await run(tasks[0]), await run(tasks[1])];
    return { ...localRunStatus(host.snapshot), outcomes };
  } finally { host.close(); }
}
