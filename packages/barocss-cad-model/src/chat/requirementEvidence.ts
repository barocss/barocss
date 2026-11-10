import type { StudioDoc } from '../engine/doc';
import { bodyKeyFor } from '../engine/ids';
import type { Requirement } from '../engine/schema/spec';
import { documentRevision } from '../team/bundle';
import { nestedRequirementScope } from '../team/requirementScope';
import { freshnessOf, requirementResults, type Freshness, type Result } from '../team/freshness';
import { requirementEvidenceRevision } from '../util/digest';
import { checkRequirement } from './spec';
import type { Evaluate } from './tools';

interface RequirementEvidenceRow { requirement?: Requirement; result: Result; freshness: Freshness }
interface RequirementEvidence {
  format: 'barocss-requirement-evidence'; version: 1; checker: 'checkSpec';
  revision: string; documentRevision: string; part: string; definitionRevision: string; evidence: RequirementEvidenceRow[];
}
const bad = (message: string) => ({ error: `[OUTPUT_INPUT] ${message}` });

/** One part's authored requirements and evidence on this exact document revision. */
export async function requirementEvidenceOf(doc: StudioDoc, part: string, evaluate: Evaluate, expectedRevision?: string): Promise<RequirementEvidence | { error: string }> {
  const revision = requirementEvidenceRevision(doc);
  if (expectedRevision !== undefined && expectedRevision !== revision)
    return { error: `[OUTPUT_STALE] Expected document revision ${expectedRevision}, current ${revision}.` };
  const nested = part.includes('/');
  let source: StudioDoc;
  if (nested) {
    const scope = nestedRequirementScope(doc, part);
    if ('error' in scope) return bad(scope.error);
    source = scope.leaf.doc;
  } else {
    const occurrences = (doc.instances ?? []).filter(instance => instance.id === part);
    if (part === 'base' && occurrences.length) return bad('Ambiguous part base.');
    if (part !== 'base' && occurrences.length !== 1) return bad(occurrences.length ? `Ambiguous part ${part}.` : `No part ${part}.`);
    source = part === 'base' ? doc : occurrences[0].doc;
  }
  const requirements = source.requirements ?? [];
  if (!Array.isArray(requirements) || !requirements.length) return bad(`Part ${part} has no requirements list.`);
  for (const requirement of requirements) {
    const reason = checkRequirement(requirement);
    if (reason) return bad(`Part ${part}: ${reason}.`);
  }
  const byId = new Map(requirements.map(requirement => [requirement.id, requirement]));
  if (byId.size !== requirements.length) return bad(`Part ${part} has duplicate requirement IDs.`);
  const definitionRevision = requirementEvidenceRevision(source);
  let evaluatedTarget = false, failedProbe = false, missingPhysicalVolume = false;
  const physical = nested ? requirements.map(r => r.check.query).filter(q => q.fn === 'mass' || q.fn === 'volume') : [];
  const checkedEvaluate: Evaluate = async input => {
    const result = await evaluate(input);
    if (!evaluatedTarget) {
      evaluatedTarget = true;
      missingPhysicalVolume = !!result?.ok && physical.some(query => result.bodies.some(body =>
        (query.body === undefined || query.body === body.key) && body.volume === null && body.massRef === undefined));
      // Give this report its own body-array key for the printability cache.
      return result?.ok ? { ...result, bodies: [...result.bodies] } : result;
    }
    // Some checks treat a failed auxiliary probe as zero.
    const index = input.nodes.length - 1;
    if (!result?.ok || (input.nodes[index]?.kind === 'intersect' &&
        result.bodies.some(body => body.key === bodyKeyFor(input.nodes, index) && (typeof body.volume !== 'number' || !Number.isFinite(body.volume))))) failedProbe = true;
    return result;
  };
  const results = await requirementResults(doc, checkedEvaluate, revision, part === 'base' ? undefined : part);
  if (missingPhysicalVolume) return { error: '[OUTPUT_EVALUATION] A nested requirement needs an available closed-body volume.' };
  if (failedProbe) return { error: '[OUTPUT_EVALUATION] A requirement probe did not evaluate successfully.' };
  const evidence: RequirementEvidenceRow[] = [];
  for (const result of results) {
    const freshness = await freshnessOf(result, doc, evaluate);
    evidence.push(result.kind === 'requirement' ? { requirement: byId.get(result.subject), result, freshness } : { result, freshness });
  }
  if (nested && requirementEvidenceRevision(doc) !== revision) return { error: '[OUTPUT_STALE] The document changed during the requirement evidence read.' };
  return { format: 'barocss-requirement-evidence', version: 1, checker: 'checkSpec', revision, documentRevision: documentRevision(doc), part, definitionRevision, evidence };
}
