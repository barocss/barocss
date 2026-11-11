import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { sha256Hex } from '@barocss/cad-model/util/digest';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import type { BoundTask, TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import type { TaskRunReplacementProvenance, TaskRunReplanSelection } from '../../src/chat/taskRunOffer';
import { readTaskRunHandoff } from '../../src/files/taskRunHandoff';
import { TaskRunHost } from './host';
import { deriveLocalRunPlan } from './localPlan';
import type { RunLimits, RunRecord } from './store';
import { threadWorker } from './thread';

interface LocalTaskRun {
  replaces?: TaskRunReplanSelection;
  doc: StudioDoc;
  config: { name: string; plan: TaskPlanRequest; limits: RunLimits; budget: number };
  tasks: { id: string; valueMm: number; field: BoundTask['writes']['field'] }[];
}

export function localRunTargets(targets: ReturnType<typeof deriveLocalRunPlan>['targets']): LocalTaskRun['tasks'] {
  return targets.map(target => {
    const { id, diameterMm, widthMm, heightMm } = target;
    if (diameterMm !== undefined) return { id, valueMm: diameterMm, field: 'diameter' };
    if (widthMm !== undefined) return { id, valueMm: widthMm, field: 'width' };
    return { id, valueMm: heightMm, field: 'height' };
  });
}

export async function prepareTaskRunHandoff(bytes: Uint8Array) {
  const { doc, offer, sourceSHA256, replaces } = await readTaskRunHandoff(bytes);
  if (replaces && sha256Hex(encodeStudioFile(doc)) !== sourceSHA256)
    throw new Error('Save the exact native model again before starting the replacement.');
  const config = deriveLocalRunPlan(doc, 'handoff:' + sourceSHA256, sourceSHA256, offer.occurrences);
  return { doc, config, offer, replaces, tasks: localRunTargets(config.targets) };
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

export async function dispatchInitialTasks<Task, Outcome>(
  tasks: readonly Task[], concurrent: RunLimits['concurrent'], dispatch: (task: Task) => Promise<Outcome>,
): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  let next = 0, stopped = false;
  const lane = async () => {
    while (!stopped && next < tasks.length) {
      const index = next++;
      try {
        outcomes[index] = await dispatch(tasks[index]);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  };
  // Drain in-flight dispatches before the caller closes the shared host.
  const lanes = await Promise.allSettled(Array.from({ length: concurrent }, lane));
  for (const result of lanes) {
    if (result.status === 'rejected') throw result.reason;
  }
  return outcomes;
}

export async function startLocalTaskRun(directory: string, { doc, config, tasks, replaces }: LocalTaskRun,
  replacement?: TaskRunReplacementProvenance, onAdmitted?: (host: TaskRunHost) => (() => void) | void) {
  if (replaces && !replacement) throw new Error('Start this replacement from the original local Studio run.');
  let revision = 0;
  const evaluate = async (model: StudioDoc) => evaluatePart(model, ++revision);
  const worker = new URL('./taskRunWorker.mjs', import.meta.url);
  const host = await TaskRunHost.create(directory, config.name, doc, config.plan, config.limits, config.budget, evaluate, undefined, replacement);
  let release: (() => void) | void = undefined;
  try {
    release = onAdmitted?.(host);
    const run = ({ id, valueMm, field }: typeof tasks[number]) => host.dispatch('initial:' + id, id, threadWorker(worker, valueMm), field + '-mm:' + valueMm);
    const outcomes = await dispatchInitialTasks(tasks, config.limits.concurrent, run);
    return { ...localRunStatus(host.snapshot), outcomes };
  } finally {
    try { release?.(); } finally { host.close(); }
  }
}
