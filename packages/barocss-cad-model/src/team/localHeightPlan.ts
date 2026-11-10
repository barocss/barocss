import { meets } from '../chat/spec';
import type { StudioDoc } from '../engine/doc';
import type { Predicate } from '../engine/schema/spec';
import { compileTaskPlan, type TaskPlan, type TaskPlanRequest } from './taskPlan';

interface LocalHeightIssue {
  code: string;
  message: string;
  occurrence?: string;
  inputs?: readonly string[];
}

interface LocalHeightTarget {
  id: string;
  requirementId: string;
  currentHeightMm: number;
  heightMm: number;
  toleranceMm: number;
}
type LocalHeightInspection = { error: LocalHeightIssue }
  | { request: TaskPlanRequest; plan: TaskPlan; targets: LocalHeightTarget[]; issues: LocalHeightIssue[] };

const isHeight = (check: Predicate) => check.query.fn === 'bbox' && check.query.axis === 'z'
  && check.query.body === undefined && check.unit === 'mm';

/** Inspect the two-task local profile without evaluating, dispatching, or changing the model. */
export function inspectLocalHeightPlan(doc: StudioDoc, occurrences: readonly string[], identity: TaskPlanRequest['identity']): LocalHeightInspection {
  if (occurrences.length !== 2 || new Set(occurrences).size !== 2)
    return { error: { code: 'BAD_PLAN', message: 'Select two distinct occurrence IDs.' } };
  const selected = new Map(occurrences.map(occurrence => [occurrence, doc.instances?.find(part => part.id === occurrence)?.doc.nodes[1]]));
  const request: TaskPlanRequest = {
    identity, policyRevision: 'local-height-v1', maxTasks: 2, throughSequence: 30,
    tasks: occurrences.map((occurrence, index) => ({
      id: occurrence, holder: `local-worker-${index + 1}`, occurrence, feature: selected.get(occurrence)?.id ?? '',
      capability: 'extrusion-height', units: 'mm', frame: 'part-local-z',
    })),
  };
  const plan = compileTaskPlan(doc, request);
  if ('error' in plan) return { error: { ...plan.error, message: `${plan.error.code}: ${plan.error.message}` } };
  const issues: LocalHeightIssue[] = [];
  const targets = plan.tasks.flatMap(task => {
    const occurrence = task.occurrence;
    const blocked = (code: string, message: string, inputs?: readonly string[]) => {
      issues.push({ code, message, occurrence, ...(inputs ? { inputs } : {}) });
      return [];
    };
    if (task.blockers.length) return blocked('TASK_REQUIRED_UNKNOWN', `${task.id} has unresolved design inputs: ${task.blockers.join(', ')}.`, task.blockers);
    const hardHeight = task.checks.filter(req => req.hard && isHeight(req.check));
    const exact = hardHeight.filter(req => req.check.op === '==');
    const target = exact[0], height = target?.check.value;
    if (exact.length !== 1 || target.basis !== 'stated' || !target.source.trim() || typeof height !== 'number' || height <= 0)
      return blocked('MISSING_REQUIRED_CHECK', `${task.id} needs one stated positive exact height requirement in mm.`, exact.map(req => req.id));
    if (hardHeight.some(req => !meets(height, req.check).ok))
      return blocked('CONFLICTING_REQUIREMENT', `${task.id}'s stated height does not satisfy its other hard height checks.`);
    const feature = selected.get(occurrence);
    if (feature?.kind !== 'extrude' || typeof feature.height !== 'number')
      return blocked('WRONG_TARGET', `${task.id} must have a literal extrusion height.`);
    if (height === feature.height) return blocked('TASK_VALUE', `${task.id} is already at its stated height.`);
    return [{ id: task.id, requirementId: target.id, currentHeightMm: feature.height, heightMm: height, toleranceMm: target.check.tol ?? 0 }];
  });
  return { request, plan, targets, issues };
}
