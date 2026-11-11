import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { inspectLocalHeightPlan } from '@barocss/cad-model/team/localHeightPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import type { RunLimits } from './store';

const FORMAT = 'barocss-local-height-plan';
const DIMENSION_FORMAT = 'barocss-local-dimension-plan';

export function deriveLocalRunPlan(doc: StudioDoc, source: string, sourceSHA256: string, occurrences: readonly string[]) {
  const inspection = inspectLocalHeightPlan(doc, occurrences, { projectId: 'local-native', documentId: digestOf(source) });
  if ('error' in inspection) throw new Error(inspection.error.message);
  const { request, plan, targets, issues } = inspection;
  if (issues.length) throw new Error(issues[0].message);
  const limits: RunLimits = { concurrent: targets.length === 1 ? 1 : 2, attemptsPerTask: 3, reservation: 2, leaseTicks: 5, timeoutMs: 10000 };
  const hasOtherDimension = targets.some(target => target.heightMm === undefined);
  return { format: hasOtherDimension ? DIMENSION_FORMAT : FORMAT, version: 1, name: hasOtherDimension ? 'local-dimension' : 'local-height', source, sourceSHA256, modelDigest: plan.baselineDigest,
    specRevision: plan.specRevision, plan: request, targets, limits, budget: targets.length * 4 };
}

/** Read just the selectors needed to rederive and check the whole plan. */
export function localRunPlanInputs(value: unknown) {
  if (!isObj(value) || (value.format !== FORMAT && value.format !== DIMENSION_FORMAT) || value.version !== 1 || typeof value.source !== 'string'
    || typeof value.sourceSHA256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceSHA256)
    || !isObj(value.plan) || !Array.isArray(value.plan.tasks)) throw new Error('Expected a version 1 local task plan.');
  const occurrences = value.plan.tasks.map(task => {
    if (!isObj(task) || typeof task.occurrence !== 'string') throw new Error('Expected the plan occurrence IDs.');
    return task.occurrence;
  });
  return { source: value.source, sourceSHA256: value.sourceSHA256, occurrences };
}
