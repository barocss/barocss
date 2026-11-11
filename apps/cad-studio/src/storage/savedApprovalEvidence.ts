import { BarocssError } from '@barocss/cad/api';
import type { RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { documentRevision } from '@barocss/cad-model/team/bundle';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { digestOf, requirementEvidenceRevision, sha256Hex } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { summarizeApprovalEvidence, type approvedRequirementComparison } from '@barocss/cad-model/versions/approvedRequirements';
import { APPROVAL_EVIDENCE_FORMAT, APPROVAL_EVIDENCE_NAME, approvalEvidenceFile, approvalEvidencePin,
  type ApprovalCheck, type ApprovalEvidenceContext } from '@barocss/cad-model/versions/approvalEvidenceReport';
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

function boundEvidence(value: unknown, root: StudioDoc, part: string, revision: string): value is RequirementEvidence {
  if (!isObj(value) || value.format !== 'barocss-requirement-evidence' || value.version !== 1 || value.checker !== 'checkSpec'
    || value.revision !== revision || value.part !== part || value.documentRevision !== documentRevision(root)) return false;
  const scope = nestedRequirementScope(root, part);
  if ('error' in scope || value.definitionRevision !== requirementEvidenceRevision(scope.leaf.doc)) return false;
  const requirements = scope.leaf.doc.requirements;
  if (!Array.isArray(requirements) || !Array.isArray(value.evidence) || value.evidence.length !== requirements.length + 1) return false;
  return value.evidence.every((row: unknown, index: number) => {
    if (!isObj(row) || !isObj(row.result) || !isObj(row.freshness)) return false;
    const requirement = requirements[index], kind = requirement ? 'requirement' : 'check_spec', subject = requirement?.id ?? 'all';
    const result = row.result, freshness = row.freshness;
    return (requirement ? canonical(row.requirement) === canonical(requirement) : row.requirement === undefined)
      && result.kind === kind && result.subject === subject
      && result.id === `${kind}:${part}/${subject}@${revision}` && result.run === revision && result.part === part
      && (result.status === 'ok' || result.status === 'failed' || result.status === 'unsupported' || result.status === 'non_converged')
      && (result.number === null || (typeof result.number === 'number' && Number.isFinite(result.number)))
      && (result.status === 'ok' || (result.number === null && result.verdict === undefined))
      && (result.verdict === undefined || result.verdict === 'pass' || result.verdict === 'fail' || result.verdict === 'unknown')
      && (result.late === undefined || result.late === true)
      && isObj(result.fingerprint) && isObj(result.fingerprint.inputs)
      && (freshness.state === 'current' || freshness.state === 'stale' || freshness.state === 'unresolved')
      && Array.isArray(freshness.changed) && Array.isArray(freshness.unresolved);
  });
}

function decodeApproval(bytes: Uint8Array, review: SavedApproval): ApprovalCheck | { error: string } {
  try {
    const file: unknown = JSON.parse(decoder.decode(bytes));
    if (!isObj(file) || file.path !== APPROVAL_EVIDENCE_NAME || file.mime !== 'application/json' || file.encoding !== 'utf-8'
      || typeof file.text !== 'string') return invalid;
    const payload = encoder.encode(file.text);
    if (file.bytes !== payload.length || file.sha256 !== sha256Hex(payload)) return invalid;
    const report: unknown = JSON.parse(file.text);
    if (!isObj(report) || report.format !== APPROVAL_EVIDENCE_FORMAT || report.version !== 1 || report.followUp !== undefined) return invalid;
    const { from, to, part, proposal } = review.context;
    if (canonical(report.from) !== canonical(from) || canonical(report.to) !== canonical(to)
      || report.part !== part || report.proposal !== proposal
      || !boundEvidence(report.before, review.before, part, from.evidenceRevision)
      || !boundEvidence(report.after, review.after, part, to.evidenceRevision)) return invalid;
    const { recoveries, changed } = summarizeApprovalEvidence(report.before, report.after);
    if (!recoveries.length || canonical(report.recoveries) !== canonical(recoveries) || canonical(report.changed) !== canonical(changed)) return invalid;
    return { before: report.before, after: report.after, recoveries, changed };
  } catch {
    return invalid;
  }
}

export async function readSavedApprovalEvidence(review: SavedApproval) {
  const file = await review.store.read(review.path);
  // File System Access can leave an empty entry when its first writer has not committed.
  return file?.bytes.length ? decodeApproval(file.bytes, review) : null;
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
