import { updateBooleanExtrusionFeatureGraph } from '../features/boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphResult, BooleanExtrusionFeatureGraphEdits } from '../features/boolean-extrusion-feature-graph.js';
import { planBooleanExtrusionImpactV1 } from './feature-impact-plan-v1.js';
import type { FeatureImpactPlanV1 } from './feature-impact-plan-v1.js';


/** Capture each own data field once, without invoking host accessors. */
function safeEditSnapshot<T>(input: T): T {
  let budget = 16384;
  const ancestors = new Set<object>();
  const visit = (value: unknown, depth: number): unknown => {
    if (--budget < 0 || depth > 12) throw new TypeError('Bounded edit snapshot required');
    if (value === null || typeof value !== 'object') return value;
    if (ancestors.has(value)) throw new TypeError('Cyclic edit snapshot refused');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
      throw new TypeError('Plain edit data required');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length > (array ? 65 : 16) || keys.some(k => typeof k !== 'string' ||
      !('value' in descriptors[k]) || (k !== 'length' && !descriptors[k].enumerable)))
      throw new TypeError('Own edit values required');
    ancestors.add(value);
    try {
      if (array) {
        if (value.length > 64 || keys.length !== value.length + 1) throw new TypeError('Dense bounded edit array required');
        return Array.from({ length: value.length }, (_, i) => {
          const entry = descriptors[String(i)];
          if (!entry || !('value' in entry)) throw new TypeError('Sparse edit array refused');
          return visit(entry.value, depth + 1);
        });
      }
      return Object.fromEntries(keys.map(k => [k, visit(descriptors[k as string].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  };
  return visit(input, 0) as T;
}

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
  const ownedEdits = safeEditSnapshot(edits);
  const candidate = updateBooleanExtrusionFeatureGraph(previous, ownedEdits);
  const impact = planBooleanExtrusionImpactV1(previous.report, {
    parameterIds: ownedEdits.parameterEdits.map(edit => edit.parameterId),
    featureIds: [
      ...ownedEdits.faceEdits.map(edit => edit.featureId),
      ...ownedEdits.booleanEdits.map(edit => edit.featureId),
      ...ownedEdits.distanceEdits.map(edit => edit.featureId),
    ],
  });
  if (impact.revision !== ownedEdits.expectedRevision ||
      candidate.document.revision !== ownedEdits.revision ||
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
