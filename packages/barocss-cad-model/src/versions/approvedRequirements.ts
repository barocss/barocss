import { nestedParameterOps } from '../chat/nestedParameterProposal';
import { isCurrentRequirement, requirementEvidenceOf, type RequirementEvidence } from '../chat/requirementEvidence';
import { expectedOf, modelHash } from '../chat/spec';
import type { Evaluate } from '../chat/tools';
import type { PartInstance, StudioDoc } from '../engine/doc';
import type { AcceptanceEvidence, Proposal } from '../engine/schema/proposals';
import type { Requirement } from '../engine/schema/spec';
import { nestedRequirementScope } from '../team/requirementScope';
import { requirementEvidenceRevision } from '../util/digest';
import { canonical } from '../util/revision';

type Scope = { id: string; label: string };
type Comparison = { before: StudioDoc; after: StudioDoc; revisions: AcceptanceEvidence; proposal: string; scopes: Scope[]; nested?: Proposal };
type Recovery = { id: string; from: number | null; to: number | null; unit?: string };
type RequirementChange = {
  id: string;
  kind: 'changed' | 'withdrawn';
  priorFailure?: { measured: number | null; unit?: string; expected: string };
  criterion?: string;
};
const samePair = (a: AcceptanceEvidence | undefined, b: AcceptanceEvidence) => a?.before === b.before && a?.after === b.after;
const sameDefinition = (before: PartInstance, after: PartInstance) =>
  before.part?.id === after.part?.id && before.part?.source === after.part?.source;
const pendingProposal = (proposal: Proposal): Proposal => ({ ...proposal, status: 'open', decided: undefined });

function nestedComparison(before: StudioDoc, after: StudioDoc, revisions: AcceptanceEvidence, proposal: Proposal, part: string): Comparison | null {
  if (proposal.ops.length !== 1 || proposal.rebased || proposal.decided?.left_out?.length) return null;
  const old = nestedRequirementScope(before, part), next = nestedRequirementScope(after, part);
  if ('error' in old || 'error' in next || !old.leaf.doc.requirements?.length) return null;
  const was = [...old.ancestors, old.leaf], now = [...next.ancestors, next.leaf];
  if (!was.every((instance, i) => sameDefinition(instance, now[i]))) return null;
  if (before.proposals !== undefined && !Array.isArray(before.proposals)) return null;
  const recorded = (before.proposals ?? []).filter(item => item?.id === proposal.id);
  if (recorded.length && (recorded.length !== 1 || canonical(recorded[0]) !== canonical(pendingProposal(proposal)))) return null;
  return { before, after, revisions, proposal: proposal.id, nested: proposal, scopes: [{ id: part, label: was.map(i => i.name).join(' › ') }] };
}

// Occurrence IDs can be reused after deletion. Scripts can also change membership indirectly.
const mayReplaceOccurrence = new Set(['delete_part', 'edit_pattern', 'delete_pattern', 'run_script']);

/** Exact, unambiguous Studio approval spanning the saved and working snapshots. */
export function approvedRequirementComparison(before: StudioDoc, after: StudioDoc): Comparison | null {
  if (!Array.isArray(after.history) || !Array.isArray(after.proposals)) return null;
  const accepts = after.history.filter(entry => entry?.kind === 'accept' && entry.by?.agent === 'user' && entry.evidence_revisions);
  if (!accepts.length) return null;
  const revisions = { before: requirementEvidenceRevision(before), after: requirementEvidenceRevision(after) };
  if (revisions.before === revisions.after) return null;
  const entries = accepts.filter(entry => samePair(entry.evidence_revisions, revisions));
  if (entries.length !== 1 || !entries[0].proposal) return null;
  const entry = entries[0], proposals = after.proposals.filter(p => p?.id === entry.proposal);
  if (proposals.length !== 1) return null;
  const [proposal] = proposals, decision = proposal.decided;
  if (proposal.status !== 'accepted' || proposal.base_evidence_revision !== revisions.before ||
      decision?.by !== 'user' || decision.at !== entry.at || !decision.model_hash || decision.model_hash !== entry.model_hash ||
      entry.proposed_by?.agent !== proposal.by?.agent || entry.proposed_by?.model !== proposal.by?.model || !samePair(decision.evidence_revisions, revisions)) return null;

  if (!Array.isArray(proposal.ops) || proposal.ops.some(op => !op || typeof op.tool !== 'string')) return null;
  const nested = nestedParameterOps(proposal.ops);
  if (nested !== undefined) return decision.model_hash === modelHash(after)
    ? nestedComparison(before, after, revisions, proposal, nested) : null;

  const scopes: Scope[] = [];
  const a = before.instances ?? [], b = after.instances ?? [];
  if (!a.some(i => i.id === 'base') && !b.some(i => i.id === 'base') &&
      before.requirements?.length) scopes.push({ id: 'base', label: 'Base part' });
  const index = new Map(a.map(i => [i.id, i]));
  const unique = (instances: typeof a) => new Set(instances.map(i => i.id)).size === instances.length;
  if (!proposal.ops.some(op => mayReplaceOccurrence.has(op.tool)) && unique(a) && unique(b)) {
    for (const next of b) {
      const old = index.get(next.id);
      if (next.id !== 'base' && old?.doc.requirements?.length &&
          sameDefinition(old, next)) scopes.push({ id: next.id, label: next.name });
    }
  }
  return scopes.length ? { before, after, revisions, proposal: proposal.id, scopes } : null;
}

/** Re-run the same report producer for one scope. Only unchanged, current checks can prove recovery. */
export async function compareApprovedRequirements(comparison: Comparison, part: string, evaluate: Evaluate): Promise<{ recoveries: Recovery[]; changed: RequirementChange[]; before: RequirementEvidence; after: RequirementEvidence | null } | { error: string }> {
  if (!comparison.scopes.some(scope => scope.id === part)) return { error: 'The occurrence cannot be matched across versions.' };
  let afterDoc: StudioDoc | undefined;
  if (comparison.nested) {
    const { before, after, revisions, nested } = comparison;
    const scope = nestedRequirementScope(after, part);
    if ('error' in scope || nestedParameterOps(nested.ops) !== part) return { error: 'The occurrence cannot be matched across versions.' };
    if (requirementEvidenceRevision(before) !== revisions.before || requirementEvidenceRevision(after) !== revisions.after)
      return { error: 'The approval revision changed.' };
    // The saved failure may predate the proposal. Replay the recorded operation on a private copy.
    const { previewProposal } = await import('../chat/tools');
    const replay = await previewProposal({ doc: { ...before, proposals: [pendingProposal(nested)] }, bodies: [] }, nested.id, evaluate);
    if ('error' in replay || requirementEvidenceRevision(replay.doc) !== revisions.after)
      return { error: 'The approved nested operation does not reproduce the saved revision.' };
    afterDoc = scope.leaf.doc;
  } else {
    afterDoc = part === 'base' ? comparison.after : comparison.after.instances?.find(instance => instance.id === part)?.doc;
  }
  const before = await requirementEvidenceOf(comparison.before, part, evaluate, comparison.revisions.before);
  if ('error' in before) return before;
  if (!afterDoc) return { error: 'The occurrence cannot be matched across versions.' };
  const requirements = afterDoc.requirements;
  const empty = requirements === undefined || (Array.isArray(requirements) && requirements.length === 0);
  if (empty && requirementEvidenceRevision(comparison.after) !== comparison.revisions.after) return { error: 'The approval revision changed.' };
  const after = empty ? null : await requirementEvidenceOf(comparison.after, part, evaluate, comparison.revisions.after);
  if (after && 'error' in after) return after;
  return { ...summarizeApprovalEvidence(before, after), before, after };
}

/** Derive the visible approval findings from reports pinned by the caller. */
export function summarizeApprovalEvidence(before: RequirementEvidence, after: RequirementEvidence | null) {
  const recoveries: Recovery[] = [], changed: RequirementChange[] = [];
  const noteChange = (old: typeof before.evidence[number], requirement?: Requirement) => {
    const previous = old.requirement!;
    const change: RequirementChange = { id: previous.id, kind: requirement ? 'changed' : 'withdrawn' };
    if (isCurrentRequirement(old, before.part, before.revision) && old.result.verdict === 'fail') {
      change.priorFailure = { measured: old.result.number, unit: previous.check.unit, expected: expectedOf(previous.check) };
    }
    if (requirement) change.criterion = expectedOf(requirement.check);
    changed.push(change);
  };
  const oldRows = new Map(before.evidence.filter(row => row.requirement).map(row => [row.requirement!.id, row]));
  for (const next of after?.evidence ?? []) {
    const requirement = next.requirement;
    if (!requirement) continue;
    const old = oldRows.get(requirement.id);
    if (!old) continue;
    oldRows.delete(requirement.id);
    if (canonical(old.requirement) !== canonical(requirement)) { noteChange(old, requirement); continue; }
    if (after && isCurrentRequirement(old, before.part, before.revision) && isCurrentRequirement(next, after.part, after.revision) &&
        old.result.verdict === 'fail' && next.result.verdict === 'pass') {
      recoveries.push({ id: requirement.id, from: old.result.number, to: next.result.number, unit: requirement.check.unit });
    }
  }
  for (const old of oldRows.values()) noteChange(old);
  return { recoveries, changed };
}
