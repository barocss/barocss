import { isCurrentRequirement, requirementEvidenceOf, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { Evaluate } from '@barocss/cad-model/chat/toolKit';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { inspectLocalHeightPlan } from '@barocss/cad-model/team/localHeightPlan';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import type { TaskRunOffer } from '../chat/taskRunOffer';
import { canonical } from '@barocss/cad-model/util/revision';
import type { CheckpointReview } from './taskCheckpoint';

export type WorkingApprovalChecks = RequirementEvidence | { error: string };

export async function readWorkingApprovalChecks(doc: StudioDoc, review: CheckpointReview, evaluate: Evaluate): Promise<WorkingApprovalChecks> {
  const { approved, before, occurrence, proposalId } = review;
  const matches = (doc.instances ?? []).filter(instance => instance.id === approved.part);
  const [instance] = matches;
  const decision = doc.history?.filter(entry => entry.kind === 'accept' && entry.by.agent === 'user' &&
    entry.proposal === proposalId && entry.at === occurrence.approvalAt &&
    entry.evidence_revisions?.before === before.revision && entry.evidence_revisions.after === approved.revision);
  if (decision?.length !== 1 || matches.length !== 1 || instance.part?.id !== occurrence.definition?.id ||
      instance.part?.source !== occurrence.definition?.source || canonical(instance.pattern) !== canonical(occurrence.pattern) ||
      instance.doc.nodes.filter(node => node.id === occurrence.feature && node.kind === occurrence.kind).length !== 1) {
    return { error: 'The approved occurrence is unavailable in the working model.' };
  }
  if (!instance.doc.requirements?.length) return { error: 'The approved requirements are unavailable in the working model.' };
  return requirementEvidenceOf(doc, approved.part, evaluate);
}

/** Only a verified failure of an unchanged stated dimension can seed a repair. */
export function hasWorkingRepairFailure(review: CheckpointReview, report: RequirementEvidence, requirementId?: string): boolean {
  if (report.part !== review.approved.part) return false;
  return report.evidence.some(row => {
    const req = row.requirement;
    if (!req?.hard || req.basis !== 'stated' || (requirementId !== undefined && req.id !== requirementId) ||
        req.check.op !== '==' || req.check.query.fn !== 'bbox' || req.check.query.body !== undefined || req.check.unit !== 'mm' ||
        (req.check.query.axis !== 'x' && req.check.query.axis !== 'y' && req.check.query.axis !== 'z') || row.result.verdict !== 'fail' ||
        row.result.number === null || !isCurrentRequirement(row, report.part, report.revision)) return false;
    const prior = review.approved.evidence.find(before => before.requirement?.id === req.id);
    return !!prior && canonical(prior.requirement) === canonical(req)
      && isCurrentRequirement(prior, review.approved.part, review.approved.revision) && prior.result.verdict === 'pass';
  });
}

export function planWorkingApprovalRepair(doc: StudioDoc, review: CheckpointReview, report: RequirementEvidence): TaskRunOffer {
  if (report.revision !== requirementEvidenceRevision(doc)) throw new Error('The working model changed. Check it again.');
  if (!hasWorkingRepairFailure(review, report)) throw new Error('The working check has no unchanged dimension to repair.');
  const occurrences = [review.approved.part];
  const inspection = inspectLocalHeightPlan(doc, occurrences, { projectId: 'studio', documentId: 'working-model' });
  if ('error' in inspection) throw new Error(inspection.error.message);
  if (inspection.issues.length) throw new Error(inspection.issues[0].message);
  const { targets } = inspection;
  if (targets.length !== 1) throw new Error('The repair target does not match the verified failure.');
  const [target] = targets;
  const requirementIds = target.footprintMm ? [target.widthRequirementId, target.depthRequirementId] : [target.requirementId];
  if (!requirementIds.every(id => hasWorkingRepairFailure(review, report, id)))
    throw new Error('The repair target does not match the verified failure.');
  return { occurrences, targets, revision: digestOf(doc) };
}
