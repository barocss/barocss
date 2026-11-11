import type { Evaluate } from '@barocss/cad-model/chat/tools';
import type { StudioDoc } from '@barocss/cad-model/engine/doc';
import { isObj } from '@barocss/cad-model/util/guards';
import { faceDiagnosisMatchesDocument, missingFaceDiagnosis, type FaceDiagnosisSelection } from '../src/chat/faceDiagnosis';

export const SELECTED_FACE_DIAGNOSIS = 'read_selected_face_diagnosis';
export const selectedFaceDiagnosisTool = {
  name: SELECTED_FACE_DIAGNOSIS,
  description: 'Recheck the current named face diagnosis attached by the user for this occurrence and revision. Reports a missing reference and whether a repair is available.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  outputSchema: {
    type: 'object', additionalProperties: false, required: ['revision', 'definitionRevision', 'part', 'requirement', 'face', 'status', 'reason', 'repair'],
    properties: {
      revision: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      definitionRevision: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      part: { type: 'string' }, requirement: { type: 'object', required: ['id', 'source', 'check'] },
      face: { type: 'string' }, status: { const: 'unresolved' }, reason: { type: 'string' }, repair: { const: 'unsupported' },
    },
  },
};

export async function readSelectedFaceDiagnosis(selection: FaceDiagnosisSelection, doc: StudioDoc, evaluate: Evaluate, args?: unknown) {
  if (args !== undefined && (!isObj(args) || Object.keys(args).length))
    return { error: 'Select the face diagnosis in Studio. This tool takes no arguments.' };
  if (!faceDiagnosisMatchesDocument(doc, selection))
    return { error: 'The selected face diagnosis does not match the current occurrence and revision.' };
  try {
    const { requirementEvidenceOf } = await import('@barocss/cad-model/chat/requirementEvidence');
    const report = await requirementEvidenceOf(doc, selection.part, evaluate, selection.revision);
    if (!('error' in report)) {
      const row = report.evidence.find(item => item.requirement?.id === selection.requirement);
      const found = row && missingFaceDiagnosis(report, row);
      if (row?.requirement && found?.face === selection.face && found.criterion === selection.criterion) return {
        revision: report.revision, definitionRevision: report.definitionRevision, part: report.part, requirement: row.requirement,
        face: found.face, status: 'unresolved', reason: row.result.why, repair: 'unsupported',
      };
    }
  } catch { /* An unavailable evaluation cannot confirm the selected diagnosis. */ }
  return { error: 'The selected missing face could not be confirmed on the current occurrence.' };
}
