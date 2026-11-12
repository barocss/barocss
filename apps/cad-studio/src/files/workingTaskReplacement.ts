import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { holeDiameterRequirementMm } from '@barocss/cad-model/chat/spec';
import { taskAxis } from '@barocss/cad-model/team/taskPlan';
import { inspectLocalHeightPlan } from '@barocss/cad-model/team/localHeightPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import type { TaskRunOffer, TaskRunReplanPin } from '../chat/taskRunOffer';

function criterion(req: Requirement, { field, feature }: TaskRunReplanPin): boolean {
  const { check } = req;
  if (!req.hard || req.basis !== 'stated' || check.op !== '==') return false;
  if (field === 'diameter') {
    if (check.query.fn !== 'hole_diameter' || !holeDiameterRequirementMm(check)) return false;
    const { face } = check.query;
    return face === feature + '.side0' || (isObj(face) && face.feature === feature && face.role === 'side0');
  }
  return check.unit === 'mm' && check.query.fn === 'bbox' && check.query.body === undefined
    && (field === 'footprint' ? check.query.axis === 'x' || check.query.axis === 'y' : check.query.axis === taskAxis(field));
}

/** Preserve the accepted geometry and history while replanning the selected occurrence's edited requirements. */
export function planWorkingTaskReplacement(baseline: StudioDoc, working: StudioDoc, pin: TaskRunReplanPin): TaskRunOffer {
  const strip = (doc: StudioDoc) => ({
    ...doc, history: undefined, proposals: undefined,
    instances: doc.instances?.map(part => part.id === pin.occurrence
      ? { ...part, doc: { ...part.doc, history: undefined, proposals: undefined, requirements: undefined } } : part),
  });
  const extendsHistory = (before: StudioDoc, after: StudioDoc) =>
    canonical((after.history ?? []).slice(0, before.history?.length ?? 0)) === canonical(before.history ?? [])
    && canonical((after.proposals ?? []).slice(0, before.proposals?.length ?? 0)) === canonical(before.proposals ?? []);
  const original = baseline.instances?.find(part => part.id === pin.occurrence);
  const current = working.instances?.find(part => part.id === pin.occurrence);
  if (!original || !current || canonical(strip(baseline)) !== canonical(strip(working))
      || !extendsHistory(baseline, working) || !extendsHistory(original.doc, current.doc))
    throw new Error('The working model does not retain the accepted run geometry and history.');

  const criteria = (doc: StudioDoc) => (doc.requirements ?? []).filter(req => criterion(req, pin));
  const order = (checks: Requirement[]) => {
    if (pin.field !== 'footprint') return checks.length === 1 ? checks : [];
    const x = checks.find(req => req.check.query.fn === 'bbox' && req.check.query.axis === 'x');
    const y = checks.find(req => req.check.query.fn === 'bbox' && req.check.query.axis === 'y');
    return checks.length === 2 && x && y ? [x, y] : [];
  };
  const previous = order(criteria(original.doc)), revised = order(criteria(current.doc));
  const normalize = (req: Requirement) => pin.field === 'diameter' ? holeDiameterRequirementMm(req.check) : req.check;
  if (!previous.length || !revised.length || canonical(previous.map(normalize)) === canonical(revised.map(normalize)))
    throw new Error('Save a changed stated dimension for this occurrence before replanning.');

  const occurrences = [pin.occurrence];
  const inspection = inspectLocalHeightPlan(working, occurrences, { projectId: 'studio', documentId: 'working-model' });
  if ('error' in inspection) throw new Error(inspection.error.message);
  if (inspection.issues.length) throw new Error(inspection.issues[0].message);
  const { targets } = inspection, [task] = inspection.plan.tasks, [target] = targets;
  const ids = target?.footprintMm ? [target.widthRequirementId, target.depthRequirementId] : [target?.requirementId];
  if (targets.length !== 1 || canonical(ids) !== canonical(revised.map(req => req.id)) ||
      task.writes.feature !== pin.feature || task.writes.field !== pin.field)
    throw new Error('The revised requirement does not match the selected task scope.');
  return { occurrences, targets, revision: digestOf(working) };
}
