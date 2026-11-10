import { meets } from '../chat/spec';
import type { StudioDoc } from '../engine/doc';
import type { Predicate } from '../engine/schema/spec';
import { compileTaskPlan, taskDimensionEdit, taskTarget, type TaskPlan, type TaskPlanRequest } from './taskPlan';

interface LocalHeightIssue {
  code: string;
  message: string;
  occurrence?: string;
  inputs?: readonly string[];
}

export type LocalTaskTarget = { id: string; requirementId: string; toleranceMm: number } & (
  { currentHeightMm: number; heightMm: number; currentWidthMm?: never; widthMm?: never } |
  { currentWidthMm: number; widthMm: number; currentHeightMm?: never; heightMm?: never }
);
type LocalHeightInspection = { error: LocalHeightIssue }
  | { request: TaskPlanRequest; plan: TaskPlan; targets: LocalTaskTarget[]; issues: LocalHeightIssue[] };

const isExtent = (check: Predicate, axis: 'x' | 'z') => check?.query?.fn === 'bbox' && check.query.axis === axis
  && check.query.body === undefined && check.unit === 'mm';

export const isLocalTaskCount = (count: number) => count === 1 || count === 2 || count === 3;

/** Inspect the bounded local profile without evaluating, dispatching, or changing the model. */
export function inspectLocalHeightPlan(doc: StudioDoc, occurrences: readonly string[], identity: TaskPlanRequest['identity']): LocalHeightInspection {
  if (!isLocalTaskCount(occurrences.length) || new Set(occurrences).size !== occurrences.length)
    return { error: { code: 'BAD_PLAN', message: 'Select one to three distinct occurrence IDs.' } };
  const draft: TaskPlanRequest = {
    identity, policyRevision: 'local-height-v1', maxTasks: occurrences.length, throughSequence: 30,
    tasks: occurrences.map((occurrence, index) => {
      const part = doc.instances?.find(part => part.id === occurrence)?.doc;
      const [sketch, extrusion] = part?.nodes ?? [];
      const checks = (part?.requirements ?? []).filter(req => req.hard);
      const width = checks.some(req => isExtent(req.check, 'x') && req.check.op === '=='
        && sketch?.kind === 'sketch' && sketch.profile === 'rectangle'
        && typeof sketch.max[0] === 'number' && typeof sketch.min[0] === 'number'
        && req.check.value !== sketch.max[0] - sketch.min[0]);
      const height = checks.some(req => isExtent(req.check, 'z')
        && (extrusion?.kind !== 'extrude' || typeof extrusion.height !== 'number'
          || !meets(extrusion.height, req.check).ok
          || (req.check.op === '==' && req.check.value !== extrusion.height)));
      const useWidth = width && !height;
      return { id: occurrence, holder: `local-worker-${index + 1}`, occurrence, feature: (useWidth ? sketch : extrusion)?.id ?? '',
        capability: useWidth ? 'rectangle-width' : 'extrusion-height', units: 'mm', frame: useWidth ? 'part-local-x' : 'part-local-z' };
    }),
  };
  const protectedOccurrences = occurrences.length === 1 ? (doc.instances ?? [])
    .filter(instance => instance.id !== occurrences[0] && instance.doc.requirements?.some(req => req.hard))
    .map(instance => instance.id) : [];
  const request: TaskPlanRequest = { ...draft,
    ...(draft.tasks.some(task => task.capability === 'rectangle-width') && { policyRevision: 'local-dimension-v1' }),
    ...(protectedOccurrences.length && { protectedOccurrences }),
  };
  const plan = compileTaskPlan(doc, request);
  if ('error' in plan) return { error: { ...plan.error, message: `${plan.error.code}: ${plan.error.message}` } };
  const issues: LocalHeightIssue[] = [];
  const targets = plan.tasks.flatMap<LocalTaskTarget>(task => {
    const occurrence = task.occurrence;
    const blocked = (code: string, message: string, inputs?: readonly string[]) => {
      issues.push({ code, message, occurrence, ...(inputs ? { inputs } : {}) });
      return [];
    };
    if (task.blockers.length) return blocked('TASK_REQUIRED_UNKNOWN', `${task.id} has unresolved design inputs: ${task.blockers.join(', ')}.`, task.blockers);
    const width = task.writes.field === 'width', dimension = task.writes.field;
    const hardAxis = task.checks.filter(req => req.hard && isExtent(req.check, width ? 'x' : 'z'));
    const exact = hardAxis.filter(req => req.check.op === '==');
    const target = exact[0], value = target?.check.value;
    if (exact.length !== 1 || target.basis !== 'stated' || !target.source.trim() || typeof value !== 'number' || value <= 0)
      return blocked('MISSING_REQUIRED_CHECK', `${task.id} needs one stated positive exact ${dimension} requirement in mm.`, exact.map(req => req.id));
    if (hardAxis.some(req => !meets(value, req.check).ok))
      return blocked('CONFLICTING_REQUIREMENT', `${task.id}'s stated ${dimension} does not satisfy its other hard ${dimension} checks.`);
    const current = taskTarget(doc, task);
    if ('error' in current) return blocked(current.error.code, current.error.message);
    if (value === current.value) return blocked('TASK_VALUE', `${task.id} is already at its stated ${dimension}.`);
    if (width) {
      const edit = taskDimensionEdit(doc, task, current, value);
      if ('error' in edit) return blocked(edit.error.code, edit.error.message);
    }
    const id = task.id, requirementId = target.id, toleranceMm = target.check.tol ?? 0;
    return [width ? { id, requirementId, currentWidthMm: current.value, widthMm: value, toleranceMm }
      : { id, requirementId, currentHeightMm: current.value, heightMm: value, toleranceMm }];

  });
  return { request, plan, targets, issues };
}
