import { outputFile } from '../chat/outputFile';
import type { compareApprovedRequirements } from './approvedRequirements';
import type { Version } from './log';
import type { requirementFollowUp } from './requirementFollowUp';

export const APPROVAL_EVIDENCE_NAME = 'approved-requirement-evidence.json';
export const APPROVAL_EVIDENCE_FORMAT = 'barocss-approved-requirement-evidence';
export type ApprovalCheck = Exclude<Awaited<ReturnType<typeof compareApprovedRequirements>>, { error: string }>;

export function approvalEvidencePin(version: Version, evidenceRevision: string) {
  return { id: version.id, snapshot: version.snapshot, revision: version.revision, evidenceRevision };
}

type EvidencePin = ReturnType<typeof approvalEvidencePin>;
export type ApprovalEvidenceContext = { from: EvidencePin; to: EvidencePin; part: string; proposal: string };
type FollowUp = Awaited<ReturnType<typeof requirementFollowUp>> & { version: EvidencePin };

export function approvalEvidenceFile(context: ApprovalEvidenceContext, evidence: ApprovalCheck, followUp?: FollowUp) {
  const report = { format: APPROVAL_EVIDENCE_FORMAT, version: 1, ...context, ...evidence, ...(followUp ? { followUp } : {}) };
  return outputFile(APPROVAL_EVIDENCE_NAME, 'application/json', JSON.stringify(report, null, 1) + '\n');
}
