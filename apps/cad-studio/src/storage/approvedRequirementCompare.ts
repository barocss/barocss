import { requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import { expectedOf } from '@barocss/cad-model/chat/spec';
import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { AcceptanceEvidence } from '@barocss/cad-model/engine/schema/proposals';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { canonical } from '@barocss/cad-model/util/revision';

type Scope = { id: string; label: string };
type Comparison = { before: StudioDoc; after: StudioDoc; revisions: AcceptanceEvidence; proposal: string; scopes: Scope[] };
type Recovery = { id: string; from: number | null; to: number | null; unit?: string };
type RequirementChange = {
  id: string;
  kind: 'changed' | 'withdrawn';
  priorFailure?: { measured: number | null; unit?: string; expected: string };
  criterion?: string;
};
const samePair = (a: AcceptanceEvidence | undefined, b: AcceptanceEvidence) => a?.before === b.before && a?.after === b.after;
// Occurrence IDs can be reused after deletion. Scripts can also change membership indirectly.
const mayReplaceOccurrence = new Set(['delete_part', 'edit_pattern', 'delete_pattern', 'run_script']);

/** Exact, unambiguous Studio approval spanning the saved and working snapshots. */
export function approvedRequirementComparison(before: StudioDoc, after: StudioDoc): Comparison | null {
  const accepts = (after.history ?? []).filter(entry => entry.kind === 'accept' && entry.by?.agent === 'user' && entry.evidence_revisions);
  if (!accepts.length) return null;
  const revisions = { before: requirementEvidenceRevision(before), after: requirementEvidenceRevision(after) };
  if (revisions.before === revisions.after) return null;
  const entries = accepts.filter(entry => samePair(entry.evidence_revisions, revisions));
  if (entries.length !== 1 || !entries[0].proposal) return null;
  const entry = entries[0], proposals = (after.proposals ?? []).filter(p => p.id === entry.proposal);
  if (proposals.length !== 1) return null;
  const [proposal] = proposals, decision = proposal.decided;
  if (proposal.status !== 'accepted' || proposal.base_evidence_revision !== revisions.before ||
      decision?.by !== 'user' || decision.at !== entry.at || !decision.model_hash || decision.model_hash !== entry.model_hash ||
      entry.proposed_by?.agent !== proposal.by?.agent || entry.proposed_by?.model !== proposal.by?.model || !samePair(decision.evidence_revisions, revisions)) return null;

  const scopes: Scope[] = [];
  const a = before.instances ?? [], b = after.instances ?? [];
  if (!a.some(i => i.id === 'base') && !b.some(i => i.id === 'base') &&
      before.requirements?.length) scopes.push({ id: 'base', label: 'Base part' });
  const index = new Map(a.map(i => [i.id, i]));
  const unique = (instances: typeof a) => new Set(instances.map(i => i.id)).size === instances.length;
  if (Array.isArray(proposal.ops) && !proposal.ops.some(op => mayReplaceOccurrence.has(op.tool)) && unique(a) && unique(b)) {
    for (const next of b) {
      const old = index.get(next.id);
      if (next.id !== 'base' && old?.doc.requirements?.length &&
          old.part?.id === next.part?.id && old.part?.source === next.part?.source) scopes.push({ id: next.id, label: next.name });
    }
  }
  return scopes.length ? { before, after, revisions, proposal: proposal.id, scopes } : null;
}

/** Re-run the same report producer for one scope. Only unchanged, current checks can prove recovery. */
export async function compareApprovedRequirements(comparison: Comparison, part: string, evaluate: Evaluate): Promise<{ recoveries: Recovery[]; changed: RequirementChange[] } | { error: string }> {
  if (!comparison.scopes.some(scope => scope.id === part)) return { error: 'The occurrence cannot be matched across versions.' };
  const before = await requirementEvidenceOf(comparison.before, part, evaluate, comparison.revisions.before);
  if ('error' in before) return before;
  const afterDoc = part === 'base' ? comparison.after : comparison.after.instances?.find(instance => instance.id === part)?.doc;
  if (!afterDoc) return { error: 'The occurrence cannot be matched across versions.' };
  const requirements = afterDoc.requirements;
  const empty = requirements === undefined || (Array.isArray(requirements) && requirements.length === 0);
  if (empty && requirementEvidenceRevision(comparison.after) !== comparison.revisions.after) return { error: 'The approval revision changed.' };
  const after = empty ? null : await requirementEvidenceOf(comparison.after, part, evaluate, comparison.revisions.after);
  if (after && 'error' in after) return after;
  const current = (row: typeof before.evidence[number], revision: string) => row.result.kind === 'requirement' &&
    (row.result.part ?? 'base') === part && row.result.run === revision && row.result.subject === row.requirement?.id &&
    !row.result.late && row.result.status === 'ok' && row.freshness.state === 'current' &&
    (row.result.number === null || Number.isFinite(row.result.number));
  const recoveries: Recovery[] = [], changed: RequirementChange[] = [];
  const noteChange = (old: typeof before.evidence[number], requirement?: Requirement) => {
    const previous = old.requirement!;
    const change: RequirementChange = { id: previous.id, kind: requirement ? 'changed' : 'withdrawn' };
    if (current(old, comparison.revisions.before) && old.result.verdict === 'fail') {
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
    if (current(old, comparison.revisions.before) && current(next, comparison.revisions.after) &&
        old.result.verdict === 'fail' && next.result.verdict === 'pass') {
      recoveries.push({ id: requirement.id, from: old.result.number, to: next.result.number, unit: requirement.check.unit });
    }
  }
  for (const old of oldRows.values()) noteChange(old);
  return { recoveries, changed };
}
