import { validateBooleanExtrusionFeatureGraph } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphResult } from './boolean-extrusion-feature-graph.js';
import { extrudeCoplanarFaceBoolean } from './coplanar-face-boolean-extrusion.js';
import { same } from './structural-equality.js';

/**
 * Experimental single-leaf native re-execution witness.
 * Both complete graph inputs are independently revalidated by the ordinary
 * full-rebuild path. This is NOT an optimized user transaction.
 */
export type NativeExtrusionLeafProbeV1 =
  | {
      readonly status: 'matched-full-rebuild';
      readonly schema: 'barocss-cad-native-extrusion-leaf-probe';
      readonly graphId: string;
      readonly priorRevision: number;
      readonly candidateRevision: number;
      readonly featureId: string;
      /** Exactly one native extrusion builder in the experimental pass only. */
      readonly probeExtrusionCalls: 1;
      readonly completeGraphValidationExecuted: true;
      readonly selectiveProductExecution: false;
    }
  | { readonly status: 'refused'; readonly reason: 'invalid-native-graph' | 'revision-or-identity' |
      'changed-region' | 'unsupported-feature' | 'native-refusal' | 'output-mismatch' };


/**
 * Prove that one extrusion can be re-executed from an unchanged earlier Native
 * Boolean region and match the independently FULL rebuilt next candidate.
 * Never produces a publishable graph result or authoritative reuse frame.
 */
export function probeNativeExtrusionLeafV1(
  previous: BooleanExtrusionFeatureGraphResult,
  next: BooleanExtrusionFeatureGraphResult,
  featureId: string,
): NativeExtrusionLeafProbeV1 {
  try {
    validateBooleanExtrusionFeatureGraph(previous);
    validateBooleanExtrusionFeatureGraph(next);
  } catch {
    return { status: 'refused', reason: 'invalid-native-graph' };
  }
  if (previous.document.id !== next.document.id ||
      next.document.revision !== previous.document.revision + 1)
    return { status: 'refused', reason: 'revision-or-identity' };

  const oldRegion = previous.features.find(row => row.kind === 'coplanar-boolean');
  const nextRegion = next.features.find(row => row.kind === 'coplanar-boolean');
  if (!oldRegion || !nextRegion || oldRegion.kind !== 'coplanar-boolean' ||
      nextRegion.kind !== 'coplanar-boolean' || !same(oldRegion.evaluation, nextRegion.evaluation))
    return { status: 'refused', reason: 'changed-region' };

  const authored = next.document.features.find(feature => feature.id === featureId);
  const output = next.features.find(row => row.featureId === featureId);
  const distance = next.report.distances.find(item => item.featureId === featureId);
  if (!authored || authored.kind !== 'normal-extrusion' ||
      !output || output.kind !== 'normal-extrusion' || !distance ||
      !Number.isFinite(distance.valueMM) || authored.regionFeatureId !== nextRegion.featureId)
    return { status: 'refused', reason: 'unsupported-feature' };

  let rebuilt: typeof output.evaluation;
  try {
    rebuilt = extrudeCoplanarFaceBoolean(oldRegion.evaluation, {
      ...authored.options,
      distanceMM: distance.valueMM,
    });
  } catch {
    return { status: 'refused', reason: 'native-refusal' };
  }
  if (!same(rebuilt, output.evaluation))
    return { status: 'refused', reason: 'output-mismatch' };
  return {
    status: 'matched-full-rebuild',
    schema: 'barocss-cad-native-extrusion-leaf-probe',
    graphId: previous.document.id,
    priorRevision: previous.document.revision,
    candidateRevision: next.document.revision,
    featureId,
    probeExtrusionCalls: 1,
    completeGraphValidationExecuted: true,
    selectiveProductExecution: false,
  };
}
