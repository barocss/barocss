import type { RequirementEvidence } from '../chat/requirementEvidence';
import type { StudioDoc } from '../engine/doc';
import type { Proposal } from '../engine/schema/proposals';
import { documentRevision } from '../team/bundle';
import { nestedRequirementScope } from '../team/requirementScope';
import { requirementEvidenceRevision, sha256Hex } from '../util/digest';
import { isObj } from '../util/guards';
import { canonical } from '../util/revision';
import { summarizeApprovalEvidence } from './approvedRequirements';
import { APPROVAL_EVIDENCE_FORMAT, APPROVAL_EVIDENCE_NAME, type ApprovalCheck, type ApprovalEvidenceContext,
  type CheckedApprovalFollowUp } from './approvalEvidenceReport';
import { followUpFindings, followUpRequirements } from './requirementFollowUp';

export type ApprovalEvidenceFile = { path: typeof APPROVAL_EVIDENCE_NAME; mime: 'application/json'; encoding: 'utf-8'; bytes: number; sha256: string; text: string };
const encoder = new TextEncoder();

export function parseApprovalEvidenceFile(value: unknown): { file: ApprovalEvidenceFile; report: Record<string, unknown> } | null {
  if (!isObj(value) || value.path !== APPROVAL_EVIDENCE_NAME || value.mime !== 'application/json' || value.encoding !== 'utf-8'
    || typeof value.text !== 'string') return null;
  const bytes = encoder.encode(value.text), sha256 = sha256Hex(bytes);
  if (value.bytes !== bytes.length || value.sha256 !== sha256) return null;
  try {
    const report: unknown = JSON.parse(value.text);
    if (!isObj(report) || report.format !== APPROVAL_EVIDENCE_FORMAT || report.version !== 1) return null;
    return { file: { path: APPROVAL_EVIDENCE_NAME, mime: 'application/json', encoding: 'utf-8', bytes: bytes.length, sha256, text: value.text }, report };
  } catch {
    return null;
  }
}

/** Validate the saved nested report against its exact root, occurrence and authored criteria without evaluating it. */
export function isBoundSavedRequirementEvidence(value: unknown, root: StudioDoc, part: string, revision: string): value is RequirementEvidence {
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

function matchApprovalPair(report: Record<string, unknown>, context: ApprovalEvidenceContext,
  before: StudioDoc, after: StudioDoc): ApprovalCheck | null {
  const { from, to, part, proposal } = context;
  if (canonical(report.from) !== canonical(from) || canonical(report.to) !== canonical(to)
    || report.part !== part || report.proposal !== proposal
    || !isBoundSavedRequirementEvidence(report.before, before, part, from.evidenceRevision)
    || !isBoundSavedRequirementEvidence(report.after, after, part, to.evidenceRevision)) return null;
  const { recoveries, changed } = summarizeApprovalEvidence(report.before, report.after);
  if (!recoveries.length || canonical(report.recoveries) !== canonical(recoveries) || canonical(report.changed) !== canonical(changed)) return null;
  return { before: report.before, after: report.after, recoveries, changed };
}

export function matchSavedApprovalEvidence(report: Record<string, unknown>, context: ApprovalEvidenceContext,
  before: StudioDoc, after: StudioDoc): ApprovalCheck | null {
  return report.followUp === undefined ? matchApprovalPair(report, context, before, after) : null;
}

export function matchSavedFollowUpEvidence(report: Record<string, unknown>, context: ApprovalEvidenceContext,
  before: StudioDoc, after: StudioDoc, source: {
    version: CheckedApprovalFollowUp['version']; doc: StudioDoc; operation: Proposal['ops'][number];
  }): { approval: ApprovalCheck; followUp: CheckedApprovalFollowUp } | null {
  const approval = matchApprovalPair(report, context, before, after);
  const saved = report.followUp, { part } = context, { version, doc, operation } = source;
  if (!approval || !isObj(saved) || saved.status !== 'checked' || canonical(saved.version) !== canonical(version)) return null;
  const scope = followUpRequirements(after, doc, operation, part, version.evidenceRevision);
  if ('reason' in scope) return null;
  let evidence: RequirementEvidence | null = null;
  if (scope.requirements?.length) {
    if (!isBoundSavedRequirementEvidence(saved.evidence, doc, part, version.evidenceRevision)) return null;
    evidence = saved.evidence;
  } else if (saved.evidence !== null) return null;
  const findings = followUpFindings(approval.recoveries.map(row => row.id), approval.after, evidence, part, version.evidenceRevision);
  if (canonical(saved.findings) !== canonical(findings)) return null;
  return { approval, followUp: { version, status: 'checked', findings, evidence } };
}
