import { updateBooleanExtrusionFeatureGraph } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphResult, BooleanExtrusionFeatureGraphEdits } from './boolean-extrusion-feature-graph.js';
import { planBooleanExtrusionImpactV1 } from './feature-impact-plan-v1.js';
import type { FeatureImpactPlanV1 } from './feature-impact-plan-v1.js';

/** Preparation only: not a persisted commit, selective execution, or new native proof. */
export interface BooleanExtrusionRebuildCandidateV1 {
  readonly schema: 'barocss-cad-boolean-extrusion-rebuild-candidate';
  readonly version: 1;
  readonly priorRevision: number;
  readonly candidateRevision: number;
  readonly impact: FeatureImpactPlanV1;
  readonly evaluationMode: 'complete-native-rebuild-candidate';
  readonly candidate: BooleanExtrusionFeatureGraphResult;
}

/**
 * Reuses the existing authoritative full rebuild and explicit dependency plan.
 * No caller state is changed: consumers commit the candidate under their own
 * revision compare-and-swap only after all validations succeed.
 */
export function prepareBooleanExtrusionRebuildV1(
  previous: BooleanExtrusionFeatureGraphResult,
  edits: BooleanExtrusionFeatureGraphEdits,
): BooleanExtrusionRebuildCandidateV1 {
  // Native prior-state reconstruction and all edit/revision checks happen first.
  // If it throws, no result is returned and prior caller state is untouched.
  const candidate = updateBooleanExtrusionFeatureGraph(previous, edits);
  const impact = planBooleanExtrusionImpactV1(previous.report, {
    parameterIds: edits.parameterEdits.map(edit => edit.parameterId),
    featureIds: [
      ...edits.faceEdits.map(edit => edit.featureId),
      ...edits.booleanEdits.map(edit => edit.featureId),
      ...edits.distanceEdits.map(edit => edit.featureId),
    ],
  });
  if (impact.revision !== edits.expectedRevision ||
      candidate.document.revision !== edits.revision ||
      candidate.document.id !== impact.graphId)
    throw new Error('Transactional rebuild impact/candidate revision or graph identity mismatch');
  return {
    schema: 'barocss-cad-boolean-extrusion-rebuild-candidate',
    version: 1,
    priorRevision: impact.revision,
    candidateRevision: candidate.document.revision,
    impact,
    evaluationMode: 'complete-native-rebuild-candidate',
    candidate,
  };
}
