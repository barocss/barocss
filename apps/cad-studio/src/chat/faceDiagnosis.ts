import { missingNamedEntityMessage } from '@barocss/cad-model/chat/names';
import type { RequirementEvidence } from '@barocss/cad-model/chat/requirementEvidence';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import type { Requirement } from '@barocss/cad-model/engine/schema/spec';
import { nestedRequirementScope } from '@barocss/cad-model/team/requirementScope';
import { digestOf, requirementEvidenceRevision } from '@barocss/cad-model/util/digest';
import { isObj } from '@barocss/cad-model/util/guards';

export interface FaceDiagnosisSelection { revision: string; part: string; requirement: string; criterion: string; face: string }
type EvidenceRow = RequirementEvidence['evidence'][number];
const namedFace = (value: unknown): value is string => typeof value === 'string' && value.length <= 256 && /^n\d+\.[^\s+|"\\/]+$/.test(value);
const digest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 512;

export function isFaceDiagnosisSelection(value: unknown): value is FaceDiagnosisSelection {
  return isObj(value) && Object.keys(value).length === 5 && digest(value.revision) && digest(value.criterion)
    && identifier(value.part) && value.part.includes('/') && identifier(value.requirement) && namedFace(value.face);
}

function namedFaces(requirement: Requirement): string[] {
  const query = requirement.check?.query;
  if (query?.fn === 'distance_between') return [query.a, query.b].filter(namedFace);
  return query?.fn === 'radius' || query?.fn === 'hole_diameter' ? [query.face].filter(namedFace) : [];
}

/** Extract the authored face that this exact evaluated row reported missing. */
export function missingFaceDiagnosis(report: RequirementEvidence, row: EvidenceRow): FaceDiagnosisSelection | undefined {
  const { requirement, result, freshness } = row;
  if (!requirement || !report.part.includes('/') || result.kind !== 'requirement' || result.subject !== requirement.id
    || result.part !== report.part || result.run !== report.revision || result.late || freshness.state !== 'current'
    || result.status !== 'unsupported' || result.number !== null || result.verdict !== undefined) return;
  const face = namedFaces(requirement).find(name => result.why === missingNamedEntityMessage(name));
  if (face) return { revision: report.revision, part: report.part, requirement: requirement.id, criterion: digestOf(requirement), face };
}

/** Reject changed revisions and a selection that names a different authored requirement. */
export function faceDiagnosisMatchesDocument(doc: StudioDoc, selection: FaceDiagnosisSelection): boolean {
  try {
    if (requirementEvidenceRevision(doc) !== selection.revision) return false;
    const scope = nestedRequirementScope(doc, selection.part);
    if ('error' in scope) return false;
    const matches = (scope.leaf.doc.requirements ?? []).filter(requirement => requirement?.id === selection.requirement);
    return matches.length === 1 && digestOf(matches[0]) === selection.criterion && namedFaces(matches[0]).includes(selection.face);
  } catch {
    return false;
  }
}
