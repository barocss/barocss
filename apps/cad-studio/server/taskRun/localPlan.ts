import { meets } from '@barocss/cad-model/chat/spec';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Predicate } from '@barocss/cad-model/engine/schema/spec';
import { compileTaskPlan, type TaskPlanRequest } from '@barocss/cad-model/team/taskPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import type { RunLimits } from './store';

const FORMAT = 'barocss-local-height-plan';
const isHeight = (check: Predicate) => check.query.fn === 'bbox' && check.query.axis === 'z'
  && check.query.body === undefined && check.unit === 'mm';

export function deriveLocalRunPlan(doc: StudioDoc, source: string, sourceSHA256: string, occurrences: readonly string[]) {
  if (occurrences.length !== 2 || new Set(occurrences).size !== 2) throw new Error('Select two distinct occurrence IDs.');
  const selected = new Map(occurrences.map(occurrence => [occurrence, doc.instances?.find(part => part.id === occurrence)?.doc.nodes[1]]));
  const request: TaskPlanRequest = {
    identity: { projectId: 'local-native', documentId: digestOf(source) },
    policyRevision: 'local-height-v1',
    maxTasks: 2,
    throughSequence: 30,
    tasks: occurrences.map((occurrence, index) => ({
      id: occurrence, holder: `local-worker-${index + 1}`, occurrence,
      feature: selected.get(occurrence)?.id ?? '',
      capability: 'extrusion-height', units: 'mm', frame: 'part-local-z',
    })),
  };
  const plan = compileTaskPlan(doc, request);
  if ('error' in plan) throw new Error(`${plan.error.code}: ${plan.error.message}`);
  const targets = plan.tasks.map(task => {
    if (task.blockers.length) throw new Error(`${task.id} has unresolved design inputs: ${task.blockers.join(', ')}.`);
    const hardHeight = task.checks.filter(req => req.hard && isHeight(req.check));
    const exact = hardHeight.filter(req => req.check.op === '==');
    const target = exact[0], height = target?.check.value;
    if (exact.length !== 1 || target.basis !== 'stated' || !target.source.trim() || typeof height !== 'number' || height <= 0)
      throw new Error(`${task.id} needs one stated positive exact height requirement in mm.`);
    if (hardHeight.some(req => !meets(height, req.check).ok))
      throw new Error(`${task.id}'s stated height does not satisfy its other hard height checks.`);
    const feature = selected.get(task.occurrence);
    if (feature?.kind !== 'extrude' || typeof feature.height !== 'number')
      throw new Error(`${task.id} must have a literal extrusion height.`);
    if (height === feature.height) throw new Error(`${task.id} is already at its stated height.`);
    return { id: task.id, requirementId: target.id, currentHeightMm: feature.height, heightMm: height, toleranceMm: target.check.tol ?? 0 };
  });
  const limits: RunLimits = { concurrent: 2, attemptsPerTask: 3, reservation: 2, leaseTicks: 5, timeoutMs: 10000 };
  return { format: FORMAT, version: 1, name: 'local-height', source, sourceSHA256, modelDigest: plan.baselineDigest,
    specRevision: plan.specRevision, plan: request, targets, limits, budget: 8 };
}

/** Read just the selectors needed to rederive and check the whole plan. */
export function localRunPlanInputs(value: unknown) {
  if (!isObj(value) || value.format !== FORMAT || value.version !== 1 || typeof value.source !== 'string'
    || typeof value.sourceSHA256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSHA256)
    || !isObj(value.plan) || !Array.isArray(value.plan.tasks)) throw new Error('Expected a version 1 local height plan.');
  const occurrences = value.plan.tasks.map(task => {
    if (!isObj(task) || typeof task.occurrence !== 'string') throw new Error('Expected the plan occurrence IDs.');
    return task.occurrence;
  });
  return { source: value.source, sourceSHA256: value.sourceSHA256, occurrences };
}
