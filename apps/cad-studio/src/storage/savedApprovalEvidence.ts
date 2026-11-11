import { BarocssError } from '@barocss/cad/api';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import type { approvedRequirementComparison } from '@barocss/cad-model/versions/approvedRequirements';
import { approvalEvidenceFile, approvalEvidencePin, exactSavedVersion, isSavedVersionId,
  type ApprovalCheck, type ApprovalEvidenceContext, type CheckedApprovalFollowUp } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { matchSavedApprovalEvidence, matchSavedFollowUpEvidence, parseApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import { isLinearSavedSequence, readVersion, type Version, type VersionLog } from '@barocss/cad-model/versions/log';
import type { SavedFaceRepairSource } from './checkSavedFaceRepair';
import { META } from './project';
import { refusal, type ProjectStore } from './store';

type Comparison = NonNullable<ReturnType<typeof approvedRequirementComparison>>;
export type SavedApprovalPair = { store: ProjectStore; document: string; from: Version; to: Version };
type SavedApproval = { store: ProjectStore; path: string; context: ApprovalEvidenceContext; before: StudioDoc; after: StudioDoc };
type SavedFollowUp = { review: SavedApproval; path: string; doc: StudioDoc; version: CheckedApprovalFollowUp['version']; operation: Proposal['ops'][number] };
export type SavedApprovalSource = SavedApproval | SavedFollowUp | SavedFaceRepairSource;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const invalid = { error: 'Saved approval evidence does not match this review.' };
const invalidFollowUp = { error: 'Saved follow-up evidence does not match this review.' };

export function bindSavedApproval(pair: SavedApprovalPair, comparison: Comparison, part: string): SavedApproval {
  const context = {
    from: approvalEvidencePin(pair.from, comparison.revisions.before),
    to: approvalEvidencePin(pair.to, comparison.revisions.after), part, proposal: comparison.proposal,
  };
  const key = digestOf([pair.document, pair.from.id, pair.to.id, part]);
  return { store: pair.store, path: `${META}/approval-evidence/${key}.json`, context, before: comparison.before, after: comparison.after };
}

export function bindSavedFollowUp(review: SavedApproval, log: VersionLog, successor: Version, operation: Proposal['ops'][number]): SavedFollowUp | null {
  const { from, to } = review.context;
  const first = exactSavedVersion(log, from.id), approved = exactSavedVersion(log, to.id);
  if (!first || first.snapshot !== from.snapshot || first.revision !== from.revision
    || !approved || approved.snapshot !== to.snapshot || approved.revision !== to.revision
    || !isSavedVersionId(successor.id) || exactSavedVersion(log, successor.id) !== successor
    || !isLinearSavedSequence(log, first, approved, successor)) return null;
  try {
    const doc = readVersion(log, successor.id);
    const version = approvalEvidencePin(successor, requirementEvidenceRevision(doc));
    return { review, doc, version, operation, path: review.path.replace(/\.json$/, `-${version.id}.json`) };
  } catch {
    return null;
  }
}

function decodeApproval(bytes: Uint8Array, review: SavedApproval) {
  try {
    const payload = parseApprovalEvidenceFile(JSON.parse(decoder.decode(bytes)));
    const evidence = payload && matchSavedApprovalEvidence(payload.report, review.context, review.before, review.after);
    return payload && evidence ? { file: payload.file, evidence } : invalid;
  } catch {
    return invalid;
  }
}

function decodeFollowUp(bytes: Uint8Array, source: SavedFollowUp) {
  try {
    const payload = parseApprovalEvidenceFile(JSON.parse(decoder.decode(bytes)));
    const { context, before, after } = source.review;
    const evidence = payload && matchSavedFollowUpEvidence(payload.report, context, before, after, source);
    return payload && evidence ? { file: payload.file, evidence } : invalidFollowUp;
  } catch {
    return invalidFollowUp;
  }
}

export async function readSavedApprovalArtifact(review: SavedApproval) {
  const file = await review.store.read(review.path);
  // File System Access can leave an empty entry when its first writer has not committed.
  return file?.bytes.length ? decodeApproval(file.bytes, review) : null;
}

export async function readSavedApprovalEvidence(review: SavedApproval) {
  const saved = await readSavedApprovalArtifact(review);
  return saved && 'evidence' in saved ? saved.evidence : saved;
}

export async function readSavedFollowUpArtifact(source: SavedFollowUp) {
  const file = await source.review.store.read(source.path);
  return file?.bytes.length ? decodeFollowUp(file.bytes, source) : null;
}

export async function readSavedFollowUpEvidence(source: SavedFollowUp) {
  const saved = await readSavedFollowUpArtifact(source);
  return saved && 'evidence' in saved ? saved.evidence : saved;
}

export async function saveApprovalEvidence(review: SavedApproval, evidence: ApprovalCheck): Promise<void> {
  const text = JSON.stringify(approvalEvidenceFile(review.context, evidence));
  const bytes = encoder.encode(text);
  if ('error' in decodeApproval(bytes, review)) throw new Error(invalid.error);
  await keepEvidence(review.store, review.path, bytes);
}

export async function saveFollowUpEvidence(source: SavedFollowUp, approval: ApprovalCheck, followUp: Omit<CheckedApprovalFollowUp, 'version'>): Promise<void> {
  const file = approvalEvidenceFile(source.review.context, approval, { version: source.version, ...followUp });
  const bytes = encoder.encode(JSON.stringify(file));
  if ('error' in decodeFollowUp(bytes, source)) throw new Error(invalidFollowUp.error);
  await keepEvidence(source.review.store, source.path, bytes);
}

export async function keepEvidence(store: ProjectStore, path: string, bytes: Uint8Array): Promise<void> {
  const same = (other: Uint8Array) => other.length === bytes.length && other.every((byte, index) => byte === bytes[index]);
  const keep = async () => {
    const prior = await store.read(path);
    if (prior?.bytes.length) {
      if (same(prior.bytes)) return;
      throw refusal('STORAGE_CHANGED', 'Different evidence already exists for these versions.');
    }
    try {
      await store.write(path, bytes, { expect: prior?.tag ?? null });
    } catch (error) {
      if (!(error instanceof BarocssError) || error.code !== 'STORAGE_CHANGED') throw error;
      const stored = await store.read(path);
      if (!stored || !same(stored.bytes)) throw error;
    }
  };
  // A project can be open through two store adapters in the same browser origin.
  const locks = globalThis.navigator?.locks;
  if (locks) await locks.request(`barocss:${path}`, keep);
  else await keep();
}
