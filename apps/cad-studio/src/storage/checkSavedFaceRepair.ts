import { requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import { previewProposal, type Evaluate } from '@barocss/cad-model/chat/tools';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import type { VersionLog } from '@barocss/cad-model/versions/log';
import { bindFaceRepairEvidence, faceRepairEvidenceFile, matchFaceRepairEvidence, parseFaceRepairEvidenceFile, resolvedFace,
  type SelectedFaceRepairEvidence } from './faceRepairEvidence';
import { keepEvidence, readSavedApprovalArtifact, type bindSavedApproval } from './savedApprovalEvidence';

type Review = ReturnType<typeof bindSavedApproval>;
export type SavedFaceRepairSource = { kind: 'face-repair'; review: Review; log: VersionLog; baseId: string; targetId: string; requirement: string };
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const noRepair = { error: 'No matching face repair approval for this saved version.' };
const invalid = { error: 'Saved face repair evidence does not match this review.' };
const unverified = { error: 'Could not verify the saved face repair.' };

async function loadFaceRepair({ review, log, baseId, targetId, requirement }: SavedFaceRepairSource) {
  const proof = await readSavedApprovalArtifact(review);
  if (!proof || 'error' in proof || !proof.evidence.after) return invalid;
  const bound = bindFaceRepairEvidence(log, { context: review.context, after: review.after, proof }, baseId, targetId, requirement);
  if (!bound) return noRepair;
  const path = review.path.replace(/\.json$/, `-face-${bound.target.id}-${digestOf(requirement)}.json`);
  const kept = await review.store.read(path);
  if (!kept?.bytes.length) return { proof, bound, path };
  try {
    const parsed = parseFaceRepairEvidenceFile(JSON.parse(decoder.decode(kept.bytes)));
    if (!parsed) return invalid;
    const result = matchFaceRepairEvidence(parsed, bound);
    return result ? { proof, bound, path, kept: { file: parsed.file, result } } : invalid;
  } catch {
    return invalid;
  }
}

/** Read the exact retained bytes for a single user-selected turn. */
export async function readSavedFaceRepairAttachment(source: SavedFaceRepairSource) {
  const loaded = await loadFaceRepair(source);
  if ('error' in loaded || !loaded.kept) return null;
  const { approval, base, repaired } = loaded.bound.context;
  const payload: SelectedFaceRepairEvidence = { kind: 'face-repair', approval: loaded.proof.file, file: loaded.kept.file };
  return { payload, part: approval.part, pins: [approval.from, approval.to, base, repaired] };
}

/** Review one saved rename and its direct, explicitly approved replacement. */
export async function checkSavedFaceRepair(review: Review, log: VersionLog, baseId: string, targetId: string, requirement: string, evaluate: Evaluate) {
  const loaded = await loadFaceRepair({ kind: 'face-repair', review, log, baseId, targetId, requirement });
  if ('error' in loaded) return loaded;
  const { bound, path, kept } = loaded, { approved, before, after, pending, base, target, context } = bound;
  const { repair, proposal } = context, { part } = repair;
  const summary = { proposal, base, target, requirement, from: repair.from, to: repair.to };
  if (kept) return { ...summary, ...kept.result, saved: true as const };

  const preview = await previewProposal({ doc: { ...before, proposals: [pending] }, bodies: [] }, proposal, evaluate);
  if ('error' in preview || requirementEvidenceRevision(preview.doc) !== context.repaired.evidenceRevision) return unverified;
  const oldReport = await requirementEvidenceOf(before, part, evaluate, context.base.evidenceRevision);
  if ('error' in oldReport) return unverified;
  const newReport = await requirementEvidenceOf(after, part, evaluate, context.repaired.evidenceRevision);
  if ('error' in newReport) return unverified;
  const result = resolvedFace(repair, approved, oldReport, newReport);
  if (!result) return unverified;
  const bytes = encoder.encode(JSON.stringify(faceRepairEvidenceFile(context, oldReport, newReport)));
  return { ...summary, ...result, saved: false as const, async saveEvidence() {
    const current = await readSavedApprovalArtifact(review);
    if (!current || 'error' in current || current.file.sha256 !== context.approvalSHA256) throw new Error(invalid.error);
    await keepEvidence(review.store, path, bytes);
  } };
}
