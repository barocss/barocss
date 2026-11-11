import { missingNamedEntityMessage } from '@barocss/cad-model/chat/names';
import { identifyNestedFaceRepair, isNestedFaceRepairEdit, nestedFaceRepairOp, type NestedFaceRepair } from '@barocss/cad-model/chat/nestedFaceRepair';
import { outputFile } from '@barocss/cad-model/chat/outputFile';
import { isCurrentRequirement, requirementEvidenceOf, type RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import { modelHash } from '@barocss/cad-model/chat/spec';
import { previewProposal, type Evaluate } from '@barocss/cad-model/chat/tools';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { approvalEvidencePin, exactSavedVersion, isSavedVersionId } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { exactRequirementApproval } from '@barocss/cad-model/versions/approvedRequirements';
import { isLinearSavedSequence, readVersion, type VersionLog } from '@barocss/cad-model/versions/log';
import { isBoundSavedRequirementEvidence } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { keepEvidence, readSavedApprovalArtifact, type bindSavedApproval } from './savedApprovalEvidence';

type Review = ReturnType<typeof bindSavedApproval>;
const filename = 'saved-face-repair-evidence.json';
const format = 'barocss-saved-face-repair-evidence';
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const noRepair = { error: 'No matching face repair approval for this saved version.' };
const invalid = { error: 'Saved face repair evidence does not match this review.' };
const unverified = { error: 'Could not verify the saved face repair.' };
const rowOf = (report: RequirementEvidence, id: string) => report.evidence.find(row => row.requirement?.id === id);

function resolvedFace(repair: NestedFaceRepair, original: RequirementEvidence, before: RequirementEvidence, after: RequirementEvidence) {
  const old = rowOf(original, repair.requirement), missing = rowOf(before, repair.requirement), fixed = rowOf(after, repair.requirement);
  if (!old || !missing || !fixed || missing.result.status !== 'unsupported' || missing.result.late ||
    missing.result.why !== missingNamedEntityMessage(repair.from) || missing.result.number !== null || missing.result.verdict !== undefined ||
    !isCurrentRequirement(fixed, repair.part, after.revision) || fixed.result.verdict !== 'pass' ||
    typeof old.result.number !== 'number' || fixed.result.number !== old.result.number) return null;
  const signature = old.result.fingerprint.faces?.[repair.from];
  if (signature?.k !== 'plane' || signature.n || canonical(signature) !== canonical(fixed.result.fingerprint.faces?.[repair.to])) return null;
  return { measured: fixed.result.number, unit: fixed.requirement?.check.unit };
}

/** Review one saved rename and its direct, explicitly approved replacement. */
export async function checkSavedFaceRepair(review: Review, log: VersionLog, baseId: string, targetId: string, requirement: string, evaluate: Evaluate) {
  const { from, to, part } = review.context;
  if (![from.id, to.id, baseId, targetId].every(isSavedVersionId)) return noRepair;
  const first = exactSavedVersion(log, from.id), original = exactSavedVersion(log, to.id);
  const base = exactSavedVersion(log, baseId), target = exactSavedVersion(log, targetId);
  if (!first || !original || !base || !target ||
    canonical(approvalEvidencePin(first, from.evidenceRevision)) !== canonical(from) ||
    canonical(approvalEvidencePin(original, to.evidenceRevision)) !== canonical(to) ||
    !isLinearSavedSequence(log, first, original, base) || !isLinearSavedSequence(log, original, base, target)) return noRepair;

  const before = readVersion(log, base.id), after = readVersion(log, target.id);
  const acceptance = exactRequirementApproval(before, after);
  if (!acceptance) return noRepair;
  const { proposal, revisions } = acceptance;
  if (proposal.by?.agent !== 'user' || proposal.decided?.left_out?.length || proposal.rebased ||
    proposal.decided?.model_hash !== modelHash(after)) return noRepair;
  const recorded = (before.proposals ?? []).filter(p => p?.id === proposal.id);
  const pending = { ...proposal, status: 'open' as const, decided: undefined };
  if (recorded.length && (recorded.length !== 1 || canonical(recorded[0]) !== canonical(pending))) return noRepair;

  const saved = await readSavedApprovalArtifact(review);
  if (!saved || 'error' in saved || !saved.evidence.after) return invalid;
  const approved = saved.evidence.after;
  const source = { version: original.id, evidenceRevision: to.evidenceRevision, sha256: saved.file.sha256 };
  const repair = identifyNestedFaceRepair(review.after, before, approved, requirement, source);
  if (!repair || canonical(proposal.ops) !== canonical([nestedFaceRepairOp(repair)]) || !isNestedFaceRepairEdit(before, after, repair)) return noRepair;

  const context = { approval: review.context, approvalSHA256: source.sha256, base: approvalEvidencePin(base, revisions.before),
    repaired: approvalEvidencePin(target, revisions.after), proposal: proposal.id, repair };
  const path = review.path.replace(/\.json$/, `-face-${target.id}-${digestOf(requirement)}.json`);
  const kept = await review.store.read(path);
  const summary = { proposal: proposal.id, base, target, requirement, from: repair.from, to: repair.to };
  if (kept?.bytes.length) {
    try {
      const file: unknown = JSON.parse(decoder.decode(kept.bytes));
      if (!isObj(file) || typeof file.text !== 'string' || canonical(file) !== canonical(outputFile(filename, 'application/json', file.text))) return invalid;
      const report: unknown = JSON.parse(file.text);
      if (!isObj(report) || report.format !== format || report.version !== 1 || canonical(report.context) !== canonical(context)
        || !isBoundSavedRequirementEvidence(report.before, before, part, revisions.before)
        || !isBoundSavedRequirementEvidence(report.after, after, part, revisions.after)) return invalid;
      const result = resolvedFace(repair, approved, report.before, report.after);
      return result ? { ...summary, ...result, saved: true as const } : invalid;
    } catch {
      return invalid;
    }
  }

  const preview = await previewProposal({ doc: { ...before, proposals: [pending] }, bodies: [] }, proposal.id, evaluate);
  if ('error' in preview || requirementEvidenceRevision(preview.doc) !== revisions.after) return unverified;
  const oldReport = await requirementEvidenceOf(before, part, evaluate, revisions.before);
  if ('error' in oldReport) return unverified;
  const newReport = await requirementEvidenceOf(after, part, evaluate, revisions.after);
  if ('error' in newReport) return unverified;
  const result = resolvedFace(repair, approved, oldReport, newReport);
  if (!result) return unverified;
  const text = JSON.stringify({ format, version: 1, context, before: oldReport, after: newReport }, null, 1) + '\n';
  const bytes = encoder.encode(JSON.stringify(outputFile(filename, 'application/json', text)));
  return { ...summary, ...result, saved: false as const, async saveEvidence() {
    const current = await readSavedApprovalArtifact(review);
    if (!current || 'error' in current || current.file.sha256 !== source.sha256) throw new Error(invalid.error);
    await keepEvidence(review.store, path, bytes);
  } };
}
