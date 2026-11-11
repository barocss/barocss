import { missingNamedEntityMessage } from '@barocss/cad-model/chat/names';
import { identifyNestedFaceRepair, isNestedFaceRepairEdit, nestedFaceRepairOp, type NestedFaceRepair } from '@barocss/cad-model/chat/nestedFaceRepair';
import { outputFile } from '@barocss/cad-model/chat/outputFile';
import { isCurrentRequirement, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { modelHash } from '@barocss/cad-model/chat/spec';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { approvalEvidencePin, exactSavedVersion, isSavedVersionId, type ApprovalCheck, type ApprovalEvidenceContext } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { exactRequirementApproval } from '@barocss/cad-model/versions/approvedRequirements';
import { isLinearSavedSequence, readVersion, type VersionLog } from '@barocss/cad-model/versions/log';
import { isBoundSavedRequirementEvidence, type ApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';

export const FACE_REPAIR_EVIDENCE_NAME = 'saved-face-repair-evidence.json';
const format = 'barocss-saved-face-repair-evidence';
type FaceRepairEvidenceFile = Omit<ApprovalEvidenceFile, 'path'> & { path: typeof FACE_REPAIR_EVIDENCE_NAME };
export type SelectedFaceRepairEvidence = { kind: 'face-repair'; approval: ApprovalEvidenceFile; file: FaceRepairEvidenceFile };
export type ApprovalAttachmentPayload = ApprovalEvidenceFile | SelectedFaceRepairEvidence;
type Original = { context: ApprovalEvidenceContext; after: StudioDoc; proof: { file: ApprovalEvidenceFile; evidence: ApprovalCheck } };
const rowOf = (report: RequirementEvidence, id: string) => report.evidence.find(row => row.requirement?.id === id);

/** Derive the exact saved edit from both snapshots and the original approval. */
export function bindFaceRepairEvidence(log: VersionLog, { context: approval, after: originalDoc, proof }: Original,
  baseId: string, targetId: string, requirement: string) {
  const { from, to } = approval;
  if (!proof.evidence.after || ![from.id, to.id, baseId, targetId].every(isSavedVersionId)) return null;
  const first = exactSavedVersion(log, from.id), original = exactSavedVersion(log, to.id);
  const base = exactSavedVersion(log, baseId), target = exactSavedVersion(log, targetId);
  if (!first || !original || !base || !target ||
    canonical(approvalEvidencePin(first, from.evidenceRevision)) !== canonical(from) ||
    canonical(approvalEvidencePin(original, to.evidenceRevision)) !== canonical(to) ||
    !isLinearSavedSequence(log, first, original, base) || !isLinearSavedSequence(log, original, base, target)) return null;

  const before = readVersion(log, base.id), after = readVersion(log, target.id);
  const acceptance = exactRequirementApproval(before, after);
  if (!acceptance) return null;
  const { proposal, revisions } = acceptance;
  if (proposal.by?.agent !== 'user' || proposal.decided?.left_out?.length || proposal.rebased ||
    proposal.decided?.model_hash !== modelHash(after)) return null;
  const recorded = (before.proposals ?? []).filter(p => p?.id === proposal.id);
  const pending = { ...proposal, status: 'open' as const, decided: undefined };
  if (recorded.length && (recorded.length !== 1 || canonical(recorded[0]) !== canonical(pending))) return null;

  const approved = proof.evidence.after;
  const source = { version: original.id, evidenceRevision: to.evidenceRevision, sha256: proof.file.sha256 };
  const repair = identifyNestedFaceRepair(originalDoc, before, approved, requirement, source);
  if (!repair || canonical(proposal.ops) !== canonical([nestedFaceRepairOp(repair)]) || !isNestedFaceRepairEdit(before, after, repair)) return null;

  const context = { approval, approvalSHA256: source.sha256, base: approvalEvidencePin(base, revisions.before),
    repaired: approvalEvidencePin(target, revisions.after), proposal: proposal.id, repair };
  return { context, approved, before, after, pending, base, target };
}

type Binding = NonNullable<ReturnType<typeof bindFaceRepairEvidence>>;
export function resolvedFace(repair: NestedFaceRepair, original: RequirementEvidence, before: RequirementEvidence, after: RequirementEvidence) {
  const old = rowOf(original, repair.requirement), missing = rowOf(before, repair.requirement), fixed = rowOf(after, repair.requirement);
  if (!old || !missing || !fixed || missing.result.status !== 'unsupported' || missing.result.late ||
    missing.result.why !== missingNamedEntityMessage(repair.from) || missing.result.number !== null || missing.result.verdict !== undefined ||
    !isCurrentRequirement(fixed, repair.part, after.revision) || fixed.result.verdict !== 'pass' ||
    typeof old.result.number !== 'number' || fixed.result.number !== old.result.number) return null;
  const signature = old.result.fingerprint.faces?.[repair.from];
  if (signature?.k !== 'plane' || signature.n || canonical(signature) !== canonical(fixed.result.fingerprint.faces?.[repair.to])) return null;
  return { measured: fixed.result.number, unit: fixed.requirement?.check.unit };
}

export function parseFaceRepairEvidenceFile(value: unknown) {
  try {
    if (!isObj(value) || typeof value.text !== 'string') return null;
    const { bytes, sha256 } = outputFile(FACE_REPAIR_EVIDENCE_NAME, 'application/json', value.text);
    const file: FaceRepairEvidenceFile = { path: FACE_REPAIR_EVIDENCE_NAME, mime: 'application/json', encoding: 'utf-8', bytes, sha256, text: value.text };
    if (canonical(value) !== canonical(file)) return null;
    const report: unknown = JSON.parse(file.text);
    if (!isObj(report) || report.format !== format || report.version !== 1 || !isObj(report.context) ||
      !Object.hasOwn(report, 'before') || !Object.hasOwn(report, 'after') || Object.keys(report).length !== 5) return null;
    return { file, report, context: report.context };
  } catch {
    return null;
  }
}

export function matchFaceRepairEvidence(parsed: NonNullable<ReturnType<typeof parseFaceRepairEvidenceFile>>, bound: Binding) {
  const { report } = parsed, { context, approved, before, after } = bound, { part } = context.approval;
  if (canonical(parsed.context) !== canonical(context)
    || !isBoundSavedRequirementEvidence(report.before, before, part, context.base.evidenceRevision)
    || !isBoundSavedRequirementEvidence(report.after, after, part, context.repaired.evidenceRevision)) return null;
  return resolvedFace(context.repair, approved, report.before, report.after);
}

export function faceRepairEvidenceFile(context: Binding['context'], before: RequirementEvidence, after: RequirementEvidence) {
  const text = JSON.stringify({ format, version: 1, context, before, after }, null, 1) + '\n';
  return outputFile(FACE_REPAIR_EVIDENCE_NAME, 'application/json', text);
}
