import { editNestedDefinition } from '../chat/nestedParameterProposal';
import { isCurrentRequirement, requirementEvidenceOf, type RequirementEvidence } from '../chat/requirementEvidence';
import { checkRequirement } from '../chat/spec';
import type { Evaluate } from '../chat/toolKit';
import type { StudioDoc } from '../engine/doc';
import type { Proposal } from '../engine/schema/proposals';
import type { Requirement } from '../engine/schema/spec';
import { nestedRequirementScope } from '../team/requirementScope';
import { requirementEvidenceRevision } from '../util/digest';
import { isObj } from '../util/guards';
import { canonical } from '../util/revision';

type Finding = {
  id: string;
  status: 'regressed' | 'passing' | 'requirement-changed' | 'requirement-withdrawn' | 'unresolved';
};
type FollowUp = { status: 'checked'; findings: Finding[]; evidence: RequirementEvidence | null } |
  { status: 'unresolved'; reason: string; findings: Finding[] };

/** Admit only the approved parameter and leaf requirements as changes in the exact later snapshot. */
export function followUpRequirements(approved: StudioDoc, later: StudioDoc, operation: Proposal['ops'][number],
  part: string, revision: string): { requirements: readonly Requirement[] | undefined } | { reason: string } {
  const old = nestedRequirementScope(approved, part), next = nestedRequirementScope(later, part);
  if ('error' in old || 'error' in next) return { reason: 'error' in next ? next.error : 'The approved occurrence is unavailable.' };
  const name = isObj(operation.args) && isObj(operation.args.set) ? Object.keys(operation.args.set)[0] : undefined;
  const value = name === undefined ? undefined : next.leaf.doc.parameters[name];
  if (name === undefined || !Object.hasOwn(old.leaf.doc.parameters, name) || !Object.hasOwn(next.leaf.doc.parameters, name) ||
      typeof value !== 'number' || !Number.isFinite(value)) return { reason: 'The approved parameter is unavailable in the later version.' };
  const requirements = next.leaf.doc.requirements;
  if (requirements !== undefined && (!Array.isArray(requirements) || requirements.some(checkRequirement) ||
      new Set(requirements.map(requirement => requirement.id)).size !== requirements.length))
    return { reason: 'The later requirements are invalid or ambiguous.' };

  // Only admit the same parameter and leaf requirements as changes. Exact replay also checks the
  // enclosing definition revisions and prevents a different placement or sibling from being used.
  const updated = editNestedDefinition(approved, old, { ...old.leaf.doc,
    parameters: { ...old.leaf.doc.parameters, [name]: value }, requirements });
  if ('error' in updated || requirementEvidenceRevision(updated.doc) !== revision)
    return { reason: 'The later version does not match an edit of the approved parameter or leaf requirements.' };
  return { requirements };
}

export function followUpFindings(recovered: readonly string[], previous: RequirementEvidence | null, evidence: RequirementEvidence | null,
  part: string, revision: string): Finding[] {
  const rows = new Map(evidence?.evidence.map(row => [row.requirement?.id, row]));
  const before = new Map(previous?.evidence.map(row => [row.requirement?.id, row.requirement]));
  return recovered.map((id): Finding => {
    const row = rows.get(id);
    if (!row) return { id, status: 'requirement-withdrawn' };
    if (canonical(row.requirement) !== canonical(before.get(id))) return { id, status: 'requirement-changed' };
    const verdict = isCurrentRequirement(row, part, revision) ? row.result.verdict : undefined;
    if (verdict === 'fail') return { id, status: 'regressed' };
    if (verdict === 'pass') return { id, status: 'passing' };
    return { id, status: 'unresolved' };
  });
}

/** Compare a direct saved successor with a verified approval. The caller checks version lineage. */
export async function requirementFollowUp(approved: StudioDoc, later: StudioDoc, operation: Proposal['ops'][number],
  part: string, recovered: readonly string[], previous: RequirementEvidence | null, revision: string, evaluate: Evaluate): Promise<FollowUp> {
  const unresolved = (reason: string): FollowUp => ({ status: 'unresolved', reason,
    findings: recovered.map(id => ({ id, status: 'unresolved' })) });
  const scope = followUpRequirements(approved, later, operation, part, revision);
  if ('reason' in scope) return unresolved(scope.reason);
  let evidence;
  try {
    evidence = scope.requirements?.length ? await requirementEvidenceOf(later, part, evaluate, revision) : null;
  } catch {
    return unresolved('The later requirement evaluation failed.');
  }
  if (evidence && 'error' in evidence) return unresolved(evidence.error);
  return { status: 'checked', findings: followUpFindings(recovered, previous, evidence, part, revision), evidence };
}
