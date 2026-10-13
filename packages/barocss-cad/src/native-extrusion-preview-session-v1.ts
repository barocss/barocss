import { evaluateBooleanExtrusionFeatureGraph } from './boolean-extrusion-feature-graph.js';
import type { BooleanExtrusionFeatureGraphV0, BooleanExtrusionFeatureGraphOptions } from './boolean-extrusion-feature-graph.js';
import { extrudeCoplanarFaceBoolean } from './coplanar-face-boolean-extrusion.js';
import type { CoplanarFaceBooleanExtrusionResult } from './coplanar-face-boolean-extrusion.js';
import { copyCadData } from './data-copy.js';

/**
 * Experimental, private-frame preview only. No selective graph update,
 * native geometry certification, persistence, cache import, or commit.
 */
export interface NativeExtrusionPreviewSessionV1 {
  readonly schema: 'barocss-cad-native-extrusion-preview-session';
  readonly version: 1;
  readonly graphId: string;
  readonly acceptedRevision: number;
  readonly featureId: string;
  readonly executionMode: 'one-native-extrusion-per-preview-after-initial-full-evaluation';
  /** Each call returns freshly owned geometry, never a reference to the saved region. */
  previewDistanceMM(distanceMM: number): CoplanarFaceBooleanExtrusionResult;
}

/**
 * One initial authoritative FULL native evaluation owns the Boolean region.
 * Subsequent numeric distance previews re-execute only its native extrusion
 * leaf. Caller intent cannot inject a stored proof or mutate the private frame.
 */
export function createNativeExtrusionPreviewSessionV1(
  document: BooleanExtrusionFeatureGraphV0,
  options: BooleanExtrusionFeatureGraphOptions,
  featureId: string,
): NativeExtrusionPreviewSessionV1 {
  if (typeof featureId !== 'string' || featureId.length === 0 || featureId.length > 48)
    throw new TypeError('Existing bounded native extrusion feature ID required');
  // The native graph evaluator first snapshots and validates ALL authored data.
  const accepted = evaluateBooleanExtrusionFeatureGraph(document, options);
  const leaf = accepted.document.features.find(feature => feature.id === featureId);
  if (!leaf || leaf.kind !== 'normal-extrusion')
    throw new RangeError('Existing native extrusion leaf required');
  const region = accepted.features.find(row => row.featureId === leaf.regionFeatureId);
  if (!region || region.kind !== 'coplanar-boolean')
    throw new TypeError('Previously evaluated owned Boolean region required');

  // Both region and feature options come from the accepted private full result;
  // never expose them or accept a region cache from the caller.
  const ownedRegion = region.evaluation;
  const nativeOptions = { ...leaf.options };
  return Object.freeze({
    schema: 'barocss-cad-native-extrusion-preview-session' as const,
    version: 1 as const,
    graphId: accepted.document.id,
    acceptedRevision: accepted.document.revision,
    featureId,
    executionMode: 'one-native-extrusion-per-preview-after-initial-full-evaluation' as const,
    previewDistanceMM(distanceMM: number): CoplanarFaceBooleanExtrusionResult {
      if (typeof distanceMM !== 'number' || !Number.isFinite(distanceMM) ||
          distanceMM <= 0 || distanceMM > 10000)
        throw new RangeError('Finite native extrusion preview distance in (0,10000] mm required');
      // This actual native provider still performs its own restricted admission.
      const native = extrudeCoplanarFaceBoolean(ownedRegion, { ...nativeOptions, distanceMM });
      return copyCadData(native);
    },
  });
}
