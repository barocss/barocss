import { requirementEvidenceOf, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { Evaluate } from '@barocss/cad-model/chat/toolKit';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
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
