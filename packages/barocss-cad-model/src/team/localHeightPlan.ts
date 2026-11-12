import { holeDiameterRequirementMm, meets } from '../chat/spec';
import type { StudioDoc } from '../engine/doc';
import type { Predicate } from '../engine/schema/spec';
import { compileTaskPlan, taskAxis, taskDimensionEdit, taskTarget, type TaskPlan, type TaskPlanRequest } from './taskPlan';

interface LocalHeightIssue {
  code: string;
  message: string;
  occurrence?: string;
  inputs?: readonly string[];
}

export type LocalTaskTarget = { id: string; requirementId: string; toleranceMm: number } & (
  { currentHeightMm: number; heightMm: number; currentWidthMm?: never; widthMm?: never; currentDepthMm?: never; depthMm?: never; currentDiameterMm?: never; diameterMm?: never } |
  { currentWidthMm: number; widthMm: number; currentHeightMm?: never; heightMm?: never; currentDepthMm?: never; depthMm?: never; currentDiameterMm?: never; diameterMm?: never } |
  { currentDepthMm: number; depthMm: number; currentHeightMm?: never; heightMm?: never; currentWidthMm?: never; widthMm?: never; currentDiameterMm?: never; diameterMm?: never } |
  { currentDiameterMm: number; diameterMm: number; currentHeightMm?: never; heightMm?: never; currentWidthMm?: never; widthMm?: never; currentDepthMm?: never; depthMm?: never }
);
type LocalHeightInspection = { error: LocalHeightIssue }
  | { request: TaskPlanRequest; plan: TaskPlan; targets: LocalTaskTarget[]; issues: LocalHeightIssue[] };

const isDiameter = (check: Predicate) => check?.query?.fn === 'hole_diameter';
const isExtent = (check: Predicate, axis: 'x' | 'y' | 'z' | undefined) => check?.query?.fn === 'bbox' && check.query.axis === axis
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
      const [sketch, extrusion, hole] = part?.nodes ?? [];
      const checks = (part?.requirements ?? []).filter(req => req.hard);
      const rectangleExtent = (coordinate: 0 | 1) => {
        if (sketch?.kind !== 'sketch' || sketch.profile !== 'rectangle') return undefined;
        const min = sketch.min[coordinate], max = sketch.max[coordinate];
        return typeof min === 'number' && typeof max === 'number' ? max - min : undefined;
      };
      const width = rectangleExtent(0), depth = rectangleExtent(1);
      const height = extrusion?.kind === 'extrude' && typeof extrusion.height === 'number' ? extrusion.height : undefined;
      const hasExactChange = (axis: 'x' | 'y' | 'z', value: number | undefined) => value !== undefined &&
        checks.some(req => isExtent(req.check, axis) && req.check.op === '==' && req.check.value !== value);
      const hasFailedCheck = (axis: 'x' | 'y' | 'z', value: number | undefined) =>
        checks.some(req => isExtent(req.check, axis) && (value === undefined || !meets(value, req.check).ok));
      const widthChanges = hasExactChange('x', width), depthChanges = hasExactChange('y', depth);
      const heightFails = hasFailedCheck('z', height);
      const heightChanges = heightFails || hasExactChange('z', height);
      // A failing Y check takes priority over fixed X and Z checks that already pass.
      const depthOnlyFailure = depthChanges && hasFailedCheck('y', depth) && !hasFailedCheck('x', width) && !heightFails;
      const diameter = checks.filter(req => isDiameter(req.check));
      const currentDiameter = hole?.kind === 'hole' && typeof hole.radius === 'number' ? 2 * hole.radius : undefined;
      const useDiameter = diameter.length > 0 && ((!widthChanges && !depthChanges && !heightChanges)
        || diameter.some(req => holeDiameterRequirementMm(req.check)?.diameterMm !== currentDiameter));
      const useWidth = !useDiameter && !depthOnlyFailure && widthChanges && !heightChanges;
      const useDepth = !useDiameter && (depthOnlyFailure || (!useWidth && depthChanges && !heightChanges));
      const feature = useDiameter ? hole : useWidth || useDepth ? sketch : extrusion;
      const capability = useDiameter ? 'hole-diameter' : useWidth ? 'rectangle-width' : useDepth ? 'rectangle-depth' : 'extrusion-height';
      return { id: occurrence, holder: `local-worker-${index + 1}`, occurrence, feature: feature?.id ?? '',
        capability, units: 'mm', frame: useWidth ? 'part-local-x' : useDepth ? 'part-local-y' : 'part-local-z' };
    }),
  };
  const protectedOccurrences = occurrences.length === 1 ? (doc.instances ?? [])
    .filter(instance => instance.id !== occurrences[0] && instance.doc.requirements?.some(req => req.hard))
    .map(instance => instance.id) : [];
  const request: TaskPlanRequest = { ...draft,
    ...(draft.tasks.some(task => task.capability !== 'extrusion-height') && { policyRevision: 'local-dimension-v1' }),
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
    const dimension = task.writes.field;
    const hardAxis = task.checks.filter(req => req.hard && (dimension === 'diameter' ? isDiameter(req.check)
      : isExtent(req.check, taskAxis(dimension))));
    const exact = hardAxis.filter(req => req.check.op === '==');
    const target = exact[0];
    const diameter = dimension === 'diameter' && target ? holeDiameterRequirementMm(target.check) : undefined;
    const value = dimension === 'diameter' ? diameter?.diameterMm : target?.check.value;
    if (exact.length !== 1 || target.basis !== 'stated' || !target.source.trim() || typeof value !== 'number' || value <= 0)
      return blocked('MISSING_REQUIRED_CHECK', `${task.id} needs one stated positive exact ${dimension} requirement in ${dimension === 'diameter' ? 'mm or in' : 'mm'}.`, exact.map(req => req.id));
    if (dimension !== 'diameter' && hardAxis.some(req => !meets(value, req.check).ok))
      return blocked('CONFLICTING_REQUIREMENT', `${task.id}'s stated ${dimension} does not satisfy its other hard ${dimension} checks.`);
    const current = taskTarget(doc, task);
    if ('error' in current) return blocked(current.error.code, current.error.message);
    if (value === current.value) return blocked('TASK_VALUE', `${task.id} is already at its stated ${dimension}.`);
    if (dimension !== 'height') {
      const edit = taskDimensionEdit(doc, task, current, value);
      if ('error' in edit) return blocked(edit.error.code, edit.error.message);
    }
    const id = task.id, requirementId = target.id, toleranceMm = diameter?.toleranceMm ?? target.check.tol ?? 0;
    const base = { id, requirementId, toleranceMm };
    if (dimension === 'diameter') return [{ ...base, currentDiameterMm: current.value, diameterMm: value }];
    if (dimension === 'width') return [{ ...base, currentWidthMm: current.value, widthMm: value }];
    if (dimension === 'depth') return [{ ...base, currentDepthMm: current.value, depthMm: value }];
    return [{ ...base, currentHeightMm: current.value, heightMm: value }];

  });
  return { request, plan, targets, issues };
}
