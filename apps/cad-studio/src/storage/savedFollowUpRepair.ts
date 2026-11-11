import { requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Proposal } from '@barocss/cad-model/engine/schema/proposals';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { canonical } from '@barocss/cad-model/util/revision';
import { approvedRequirementComparison, compareApprovedRequirements } from '@barocss/cad-model/versions/approvedRequirements';
import { exactSavedVersion, isSavedVersionId, type ApprovalCheck } from '@barocss/cad-model/versions/approvalEvidenceReport';
import { ancestorsOf, readVersion, type Version, type VersionLog } from '@barocss/cad-model/versions/log';
import { followUpFindings, followUpRequirements } from '@barocss/cad-model/versions/requirementFollowUp';
import { readSavedFollowUpArtifact, type bindSavedFollowUp } from './savedApprovalEvidence';

type SavedFollowUp = NonNullable<ReturnType<typeof bindSavedFollowUp>>;
type RepairCheck = { proposal: string; version: Version; recoveries: ApprovalCheck['recoveries'] } | { error: string };
const noRepair = { error: 'No matching user-approved repair for this saved regression.' };
const unverified = { error: 'Could not verify the repair on both saved revisions.' };

function readExact(log: VersionLog, version: Version): StudioDoc | null {
  if (exactSavedVersion(log, version.id) !== version) return null;
  try { return readVersion(log, version.id); }
  catch { return null; }
}

function matchesSource(proposal: Proposal, part: string, version: string, sha256: string, ids: readonly string[]) {
  const source = proposal?.follow_up_repair;
  return proposal?.status === 'accepted' && source?.part === part && source.version === version && source.evidence_sha256 === sha256
    && Array.isArray(source.requirements) && source.requirements.length > 0
    && new Set(source.requirements).size === source.requirements.length && source.requirements.every(id => ids.includes(id));
}

/** Reproduce the accepted edit and its unchanged criteria on saved documents in the same lineage. */
export async function checkSavedFollowUpRepair(source: SavedFollowUp, log: VersionLog, id: string, evaluate: Evaluate): Promise<RepairCheck> {
  const { version: pin, review, operation } = source, { part } = review.context;
  if (!isSavedVersionId(id) || id === pin.id) return noRepair;
  const failed = exactSavedVersion(log, pin.id), target = exactSavedVersion(log, id);
  if (!failed || !target || failed.snapshot !== pin.snapshot || failed.revision !== pin.revision) return noRepair;
  const ancestors = ancestorsOf(log, target.id);
  if (!ancestors.has(failed.id)) return noRepair;
  const retained = await readSavedFollowUpArtifact(source);
  if (!retained || 'error' in retained) return { error: 'Saved follow-up evidence does not match this review.' };
  const { followUp } = retained.evidence;
  const regressed = followUp.findings.filter(row => row.status === 'regressed').map(row => row.id);
  const after = readExact(log, target);
  if (!after || !Array.isArray(after.proposals)) return noRepair;
  const revision = requirementEvidenceRevision(after);
  const candidates = after.proposals.filter(p => matchesSource(p, part, pin.id, retained.file.sha256, regressed)
    && p.decided?.evidence_revisions?.after === revision);
  if (candidates.length !== 1) return noRepair;
  const [proposal] = candidates, ids = proposal.follow_up_repair!.requirements;

  const approved = nestedRequirementScope(review.after, part), set = operation.args?.set;
  const parameter = isObj(set) ? Object.keys(set)[0] : undefined;
  const value = parameter && !('error' in approved) ? approved.leaf.doc.parameters[parameter] : undefined;
  if (!Array.isArray(proposal.ops) || proposal.ops.length !== 1) return noRepair;
  const [edit] = proposal.ops;
  if (!parameter || typeof value !== 'number' || !Number.isFinite(value) ||
    edit?.args?.part !== part || canonical(edit.args.set) !== canonical({ [parameter]: value })) return noRepair;

  const baseRevision = proposal.base_evidence_revision;
  if (typeof baseRevision !== 'string') return noRepair;
  const matchingBase = (version: Version) => {
    const doc = readExact(log, version);
    if (!doc || requirementEvidenceRevision(doc) !== baseRevision) return null;
    const comparison = approvedRequirementComparison(doc, after);
    if (!comparison?.nested || comparison.proposal !== proposal.id || comparison.scopes[0].id !== part) return null;
    return 'reason' in followUpRequirements(review.after, doc, operation, part, baseRevision) ? null : comparison;
  };
  // An exact saved failure is the usual approval base. A later saved base must also descend from it.
  let comparison = baseRevision === pin.evidenceRevision ? matchingBase(failed) : null;
  if (!comparison) for (const version of log.versions.slice(log.versions.indexOf(failed) + 1, log.versions.indexOf(target)).reverse()) {
    if (!ancestors.has(version.id)) continue;
    const match = matchingBase(version);
    if (match && ancestorsOf(log, version.id).has(failed.id)) { comparison = match; break; }
  }
  if (!comparison) return noRepair;

  const result = await compareApprovedRequirements(comparison, part, evaluate);
  if ('error' in result || !result.after) return unverified;
  const historical = result.before.revision === pin.evidenceRevision
    ? result.before : await requirementEvidenceOf(source.doc, part, evaluate, pin.evidenceRevision);
  if ('error' in historical) return unverified;
  const matches = (report: typeof historical, status: 'regressed' | 'passing') =>
    followUpFindings(ids, followUp.evidence, report, part, report.revision).every(row => row.status === status);
  if (!matches(historical, 'regressed') || !matches(result.before, 'regressed') || !matches(result.after, 'passing'))
    return unverified;
  const recoveries = result.recoveries.filter(row => ids.includes(row.id));
  return recoveries.length === ids.length ? { proposal: proposal.id, version: target, recoveries } : unverified;
}
