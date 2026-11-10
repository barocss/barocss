import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { inspectLocalHeightPlan } from '@barocss/cad-model/team/localHeightPlan';
import { digestOf } from '@barocss/cad-model/util/digest';
import { canonical } from '@barocss/cad-model/util/revision';
import type { TaskRunOffer, TaskRunReplanPin } from '../chat/taskRunOffer';

function criterion(req: Requirement, field: TaskRunReplanPin['field']): boolean {
  const { check } = req;
  return req.hard && req.basis === 'stated' && check.op === '==' && check.query.fn === 'bbox'
    && check.query.axis === (field === 'width' ? 'x' : 'z') && check.query.body === undefined && check.unit === 'mm';
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

  const previous = original.doc.requirements?.filter(req => criterion(req, pin.field)) ?? [];
  const revised = current.doc.requirements?.filter(req => criterion(req, pin.field)) ?? [];
  if (previous.length !== 1 || revised.length !== 1 || canonical(previous[0].check) === canonical(revised[0].check))
    throw new Error('Save a changed stated dimension for this occurrence before replanning.');

  const occurrences = [pin.occurrence];
  const inspection = inspectLocalHeightPlan(working, occurrences, { projectId: 'studio', documentId: 'working-model' });
  if ('error' in inspection) throw new Error(inspection.error.message);
  if (inspection.issues.length) throw new Error(inspection.issues[0].message);
  const { targets } = inspection, [task] = inspection.plan.tasks;
  if (targets.length !== 1 || targets[0].requirementId !== revised[0].id ||
      task.writes.feature !== pin.feature || task.writes.field !== pin.field)
    throw new Error('The revised requirement does not match the selected task scope.');
  return { occurrences, targets, revision: digestOf(working) };
}
