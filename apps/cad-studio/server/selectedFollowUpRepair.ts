import { isCurrentRequirement, requirementEvidenceOf } from '@barocss/cad-model/chat/requirementEvidence';
import { fail, type ChatState, type Evaluate, type ToolOutcome } from '@barocss/cad-model/chat/toolKit';
import { proposeFollowUpRepair } from '@barocss/cad-model/chat/tools';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';
import { followUpFindings, followUpRequirements } from '@barocss/cad-model/versions/requirementFollowUp';
import type { SelectedFollowUpRepair } from './selectedApprovalEvidence';

export async function prepareSelectedFollowUpRepair(state: ChatState, input: unknown,
  selected: SelectedFollowUpRepair, evaluate: Evaluate): Promise<ToolOutcome> {
  if (!isObj(input) || Object.keys(input).length !== 1 || typeof input.working_revision !== 'string' || !/^[0-9a-f]{64}$/.test(input.working_revision))
    return fail(state, 'Supply only working_revision from a current requirements.evidence result.');
  const revision = input.working_revision;
  if (requirementEvidenceRevision(state.doc) !== revision)
    return fail(state, 'The working revision moved. Read current requirement evidence before proposing a repair.', { code: 'REPAIR_STALE' });
  const { approved, later, operation, part, evidenceSHA256, followUp } = selected;
  const ids = followUp.findings.filter(finding => finding.status === 'regressed').map(finding => finding.id);
  const current = await requirementEvidenceOf(state.doc, part, evaluate, revision);
  if ('error' in current) return fail(state, current.error);
  const findings = followUpFindings(ids, followUp.evidence, current, part, revision);
  if (findings.some(finding => finding.status !== 'passing' && finding.status !== 'regressed'))
    return fail(state, 'The selected criteria changed or cannot be checked on the working revision.', { code: 'REPAIR_UNVERIFIED' });
  const failures = findings.filter(finding => finding.status === 'regressed').map(finding => finding.id);
  if (!failures.length)
    return fail(state, 'The selected requirements already pass on the working revision.', { code: 'REPAIR_ALREADY_PASSING' });

  const scope = followUpRequirements(approved, state.doc, operation, part, revision);
  if ('reason' in scope) return fail(state, scope.reason, { code: 'REPAIR_SCOPE_CHANGED' });
  const savedRevision = followUp.version.evidenceRevision;
  const saved = revision === savedRevision ? current : await requirementEvidenceOf(later, part, evaluate, savedRevision);
  if ('error' in saved || followUpFindings(ids, followUp.evidence, saved, part, savedRevision).some(row => row.status !== 'regressed'))
    return fail(state, 'The saved regression could not be reproduced on its pinned version.', { code: 'REPAIR_UNVERIFIED' });

  const old = nestedRequirementScope(approved, part);
  const set = operation.args?.set;
  const name = isObj(set) ? Object.keys(set)[0] : undefined;
  const value = name && !('error' in old) ? old.leaf.doc.parameters[name] : undefined;
  if (!name || typeof value !== 'number' || !Number.isFinite(value))
    return fail(state, 'The approved parameter value is unavailable.', { code: 'REPAIR_UNVERIFIED' });

  const mustPass = [...new Set([...ids, ...current.evidence.flatMap(row =>
    row.requirement?.hard && isCurrentRequirement(row, part, revision) && row.result.verdict === 'pass' ? [row.requirement.id] : [])])];
  return proposeFollowUpRepair(state, {
    title: `Repair saved regression in ${part}`,
    plan: `Restore ${name} to the approved value from the comparison with saved follow-up ${followUp.version.id}. Rechecked ${failures.join(', ')} on the working revision.`,
    ops: [{ tool: 'set_parameters', args: { part, set: { [name]: value } } }],
  }, evaluate, {
    source: { evidence_sha256: evidenceSHA256, version: followUp.version.id, part, requirements: failures },
    async check(candidate, risk, checks) {
      const evidence = await requirementEvidenceOf(candidate, part, evaluate);
      if ('error' in evidence) return evidence.error;
      if (followUpFindings(mustPass, current, evidence, part, evidence.revision).some(row => row.status !== 'passing'))
        return 'The approved value does not resolve the current failure and preserve the passing hard checks on this occurrence.';
      const changedRoot = state.doc.requirements?.some(row => row.hard && risk.hard_requirements_changed.includes(row.id) &&
        !checks?.newly_passing.includes(row.id));
      if (changedRoot) return 'The repair would leave a changed hard assembly check without a passing result.';
    },
  });
}
