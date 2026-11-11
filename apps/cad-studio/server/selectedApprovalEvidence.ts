import { APPROVAL_EVIDENCE_NAME, approvalEvidencePin, exactSavedVersion, isSavedVersionId, type CheckedApprovalFollowUp } from '@barocss/cad-model/versions/approvalEvidenceReport';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Op } from '@barocss/cad-model/engine/schema/proposals';
import { matchSavedApprovalEvidence, matchSavedFollowUpEvidence, parseApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { approvedRequirementComparison } from '@barocss/cad-model/versions/approvedRequirements';
import { isLinearSavedSequence, readVersion, type VersionLog } from '@barocss/cad-model/versions/log';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { bindFaceRepairEvidence, FACE_REPAIR_EVIDENCE_NAME, matchFaceRepairEvidence, parseFaceRepairEvidenceFile,
  type ApprovalAttachmentPayload, type SelectedFaceRepairEvidence } from '../src/storage/faceRepairEvidence';

export const SELECTED_APPROVAL_EVIDENCE = 'read_selected_approval_evidence';
export const SELECTED_FOLLOW_UP_REPAIR = 'propose_selected_follow_up_repair';
export const selectedFollowUpRepairTool = {
  name: SELECTED_FOLLOW_UP_REPAIR,
  description: 'Check the attached saved regression on the exact current working revision. If the approved nested parameter value repairs it, prepare one proposal for the user to preview and approve.',
  inputSchema: { type: 'object', additionalProperties: false, required: ['working_revision'],
    properties: { working_revision: { type: 'string', pattern: '^[0-9a-f]{64}$' } } },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

export interface SelectedFollowUpRepair {
  approved: StudioDoc;
  later: StudioDoc;
  operation: Op;
  part: string;
  evidenceSHA256: string;
  followUp: CheckedApprovalFollowUp;
}
export const selectedApprovalEvidenceTool = {
  name: SELECTED_APPROVAL_EVIDENCE,
  description: 'Read the historical approval evidence the person attached for this turn. The report can include a direct saved follow-up or an approved face replacement. It describes the pinned saved versions, independent of the working model.',
  inputSchema: { type: 'object', additionalProperties: false },
  outputSchema: { type: 'object', required: ['file'], additionalProperties: false, properties: {
    file: { type: 'object', required: ['path', 'mime', 'encoding', 'bytes', 'sha256', 'text'], additionalProperties: false, properties: {
      path: { enum: [APPROVAL_EVIDENCE_NAME, FACE_REPAIR_EVIDENCE_NAME] }, mime: { const: 'application/json' }, encoding: { const: 'utf-8' },
      bytes: { type: 'integer', minimum: 1 }, sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' }, text: { type: 'string' },
    } },
  } },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

function selectedApprovalPair(value: unknown, versions: VersionLog) {
  const parsed = parseApprovalEvidenceFile(value);
  if (!parsed) return;
  const { from, to } = parsed.report;
  if (!isObj(from) || !isObj(to) || !isSavedVersionId(from.id) || !isSavedVersionId(to.id) || from.id === to.id) return;
  const first = exactSavedVersion(versions, from.id), last = exactSavedVersion(versions, to.id);
  if (!first || !last || !Object.hasOwn(versions.snapshots, first.snapshot) || !Object.hasOwn(versions.snapshots, last.snapshot)) return;
  const before = readVersion(versions, first.id), after = readVersion(versions, last.id);
  const comparison = approvedRequirementComparison(before, after);
  if (!comparison?.nested) return;
  const context = { from: approvalEvidencePin(first, comparison.revisions.before), to: approvalEvidencePin(last, comparison.revisions.after),
    part: comparison.scopes[0].id, proposal: comparison.proposal };
  return { parsed, context, first, last, before, after, operation: comparison.nested.ops[0] };
}

function selectedFaceRepair(value: Record<string, unknown>, versions: VersionLog): SelectedFaceRepairEvidence | undefined {
  const original = selectedApprovalPair(value.approval, versions);
  const saved = parseFaceRepairEvidenceFile(value.file);
  if (!original || !saved || original.parsed.report.followUp !== undefined) return;
  const { base, repaired, repair } = saved.context;
  if (!isObj(base) || !isSavedVersionId(base.id) || !isObj(repaired) || !isSavedVersionId(repaired.id) ||
    !isObj(repair) || typeof repair.requirement !== 'string') return;
  const { parsed, context, before, after } = original;
  const evidence = matchSavedApprovalEvidence(parsed.report, context, before, after);
  if (!evidence) return;
  const bound = bindFaceRepairEvidence(versions, { context, after, proof: { file: parsed.file, evidence } }, base.id, repaired.id, repair.requirement);
  if (!bound || !matchFaceRepairEvidence(saved, bound)) return;
  return { kind: 'face-repair', approval: parsed.file, file: saved.file };
}

export async function readSelectedApprovalForTurn(value: unknown, versions: VersionLog | undefined): Promise<{
  file: SelectedFaceRepairEvidence['file'] | SelectedFaceRepairEvidence['approval']; payload: ApprovalAttachmentPayload; repair?: SelectedFollowUpRepair;
} | undefined> {
  if (value === undefined || !versions || !Array.isArray(versions.versions) || !isObj(versions.snapshots)) return;
  try {
    if (isObj(value) && value.kind === 'face-repair') {
      const selected = selectedFaceRepair(value, versions);
      return selected && { file: selected.file, payload: selected };
    }
    const pair = selectedApprovalPair(value, versions);
    if (!pair) return;
    const { parsed, first, last, context, before, after, operation } = pair, { followUp } = parsed.report;
    if (followUp === undefined)
      return matchSavedApprovalEvidence(parsed.report, context, before, after) ? { file: parsed.file, payload: parsed.file } : undefined;
    if (!isObj(followUp) || !isObj(followUp.version) || !isSavedVersionId(followUp.version.id)) return;
    const successor = exactSavedVersion(versions, followUp.version.id);
    if (!successor || !isLinearSavedSequence(versions, first, last, successor)
      || !Object.hasOwn(versions.snapshots, successor.snapshot)) return;
    const doc = readVersion(versions, successor.id);
    const source = { doc, operation, version: approvalEvidencePin(successor, requirementEvidenceRevision(doc)) };
    const matched = matchSavedFollowUpEvidence(parsed.report, context, before, after, source);
    if (!matched) return;
    const { followUp: checked } = matched;
    const repair = checked.findings.some(finding => finding.status === 'regressed')
      ? { approved: after, later: doc, operation, part: context.part, evidenceSHA256: parsed.file.sha256, followUp: checked }
      : undefined;
    return { file: parsed.file, payload: parsed.file, ...(repair ? { repair } : {}) };
  } catch { /* An unreadable snapshot or report cannot authorize a tool. */ }
}

export async function selectedApprovalForTurn(value: unknown, versions: VersionLog | undefined) {
  const selected = await readSelectedApprovalForTurn(value, versions);
  return selected && !('kind' in selected.payload) ? selected.payload : undefined;
}
