import { APPROVAL_EVIDENCE_NAME, approvalEvidencePin, exactSavedVersion, isSavedVersionId } from '@barocss/cad-model/versions/approvalEvidenceReport';
import type { ApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { isLinearSavedSequence, readVersion, type VersionLog } from '@barocss/cad-model/versions/log';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';

export const SELECTED_APPROVAL_EVIDENCE = 'read_selected_approval_evidence';
export const selectedApprovalEvidenceTool = {
  name: SELECTED_APPROVAL_EVIDENCE,
  description: 'Read the historical approval evidence the person attached for this turn. The report can include a direct saved follow-up. It describes the pinned saved versions, independent of the working model.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object', required: ['file'], additionalProperties: false, properties: {
    file: { type: 'object', required: ['path', 'mime', 'encoding', 'bytes', 'sha256', 'text'], additionalProperties: false, properties: {
      path: { const: APPROVAL_EVIDENCE_NAME }, mime: { const: 'application/json' }, encoding: { const: 'utf-8' },
      bytes: { type: 'integer', minimum: 1 }, sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' }, text: { type: 'string' },
    } },
  } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

export async function selectedApprovalForTurn(value: unknown, versions: VersionLog | undefined): Promise<ApprovalEvidenceFile | undefined> {
  if (value === undefined || !versions || !Array.isArray(versions.versions) || !isObj(versions.snapshots)) return;
  try {
    const { matchSavedApprovalEvidence, matchSavedFollowUpEvidence, parseApprovalEvidenceFile } = await import('@barocss/cad-model/versions/savedApprovalEvidence');
    const parsed = parseApprovalEvidenceFile(value);
    if (!parsed) return;
    const { from, to, followUp } = parsed.report;
    if (!isObj(from) || !isObj(to) || !isSavedVersionId(from.id) || !isSavedVersionId(to.id) || from.id === to.id) return;
    const first = exactSavedVersion(versions, from.id), last = exactSavedVersion(versions, to.id);
    if (!first || !last || !Object.hasOwn(versions.snapshots, first.snapshot) || !Object.hasOwn(versions.snapshots, last.snapshot)) return;
    const before = readVersion(versions, first.id), after = readVersion(versions, last.id);
    const { approvedRequirementComparison } = await import('@barocss/cad-model/versions/approvedRequirements');
    const comparison = approvedRequirementComparison(before, after);
    if (!comparison?.nested) return;
    const context = { from: approvalEvidencePin(first, comparison.revisions.before), to: approvalEvidencePin(last, comparison.revisions.after),
      part: comparison.scopes[0].id, proposal: comparison.proposal };
    if (followUp === undefined)
      return matchSavedApprovalEvidence(parsed.report, context, before, after) ? parsed.file : undefined;
    if (!isObj(followUp) || !isObj(followUp.version) || !isSavedVersionId(followUp.version.id)) return;
    const successor = exactSavedVersion(versions, followUp.version.id);
    if (!successor || !isLinearSavedSequence(versions, first, last, successor)
      || !Object.hasOwn(versions.snapshots, successor.snapshot)) return;
    const doc = readVersion(versions, successor.id);
    const source = { doc, operation: comparison.nested.ops[0], version: approvalEvidencePin(successor, requirementEvidenceRevision(doc)) };
    if (matchSavedFollowUpEvidence(parsed.report, context, before, after, source)) return parsed.file;
  } catch { /* An unreadable snapshot or report cannot authorize a tool. */ }
}
