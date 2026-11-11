import { BarocssError } from '@barocss/cad/api';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { digestOf } from '@barocss/cad-model/util/digest';
import type { approvedRequirementComparison } from '@barocss/cad-model/versions/approvedRequirements';
import { approvalEvidenceFile, approvalEvidencePin,
  type ApprovalCheck, type ApprovalEvidenceContext } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { matchSavedApprovalEvidence, parseApprovalEvidenceFile } from '@barocss/cad-model/versions/savedApprovalEvidence';
import type { Version } from '@barocss/cad-model/versions/log';
import { META } from './project';
import { refusal, type ProjectStore } from './store';

type Comparison = NonNullable<ReturnType<typeof approvedRequirementComparison>>;
export type SavedApprovalPair = { store: ProjectStore; document: string; from: Version; to: Version };
type SavedApproval = { store: ProjectStore; path: string; context: ApprovalEvidenceContext; before: StudioDoc; after: StudioDoc };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const invalid = { error: 'Saved approval evidence does not match this review.' };

export function bindSavedApproval(pair: SavedApprovalPair, comparison: Comparison, part: string): SavedApproval {
  const context = {
    from: approvalEvidencePin(pair.from, comparison.revisions.before),
    to: approvalEvidencePin(pair.to, comparison.revisions.after), part, proposal: comparison.proposal,
  };
  const key = digestOf([pair.document, pair.from.id, pair.to.id, part]);
  return { store: pair.store, path: `${META}/approval-evidence/${key}.json`, context, before: comparison.before, after: comparison.after };
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

export async function readSavedApprovalArtifact(review: SavedApproval) {
  const file = await review.store.read(review.path);
  // File System Access can leave an empty entry when its first writer has not committed.
  return file?.bytes.length ? decodeApproval(file.bytes, review) : null;
}

export async function readSavedApprovalEvidence(review: SavedApproval) {
  const saved = await readSavedApprovalArtifact(review);
  return saved && 'evidence' in saved ? saved.evidence : saved;
}

export async function saveApprovalEvidence(review: SavedApproval, evidence: ApprovalCheck): Promise<void> {
  const text = JSON.stringify(approvalEvidenceFile(review.context, evidence));
  const bytes = encoder.encode(text);
  if ('error' in decodeApproval(bytes, review)) throw new Error(invalid.error);
  const same = (other: Uint8Array) => other.length === bytes.length && other.every((byte, index) => byte === bytes[index]);
  const keep = async () => {
    const prior = await review.store.read(review.path);
    if (prior?.bytes.length) {
      if (same(prior.bytes)) return;
      throw refusal('STORAGE_CHANGED', 'Different approval evidence already exists.');
    }
    try {
      await review.store.write(review.path, bytes, { expect: prior?.tag ?? null });
    } catch (error) {
      if (!(error instanceof BarocssError) || error.code !== 'STORAGE_CHANGED') throw error;
      const stored = await review.store.read(review.path);
      if (!stored || !same(stored.bytes)) throw error;
    }
  };
  // A project can be open through two store adapters in the same browser origin.
  const locks = globalThis.navigator?.locks;
  if (locks) await locks.request(`barocss:${review.path}`, keep);
  else await keep();
}
