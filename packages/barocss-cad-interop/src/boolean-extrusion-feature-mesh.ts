import { tessellateCoplanarFaceBooleanExtrusion, validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphReport, BooleanExtrusionFeatureGraphResult,
  CoplanarFaceBooleanExtrusionMeshOptions, CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';
import { selectBaroCadBooleanExtrusionFeature } from './boolean-extrusion-feature-selection.js';

export interface BaroCadBooleanExtrusionFeatureSelection {
  readonly graphId: string;
  readonly revision: number;
  readonly featureId: string;
  readonly outputSlotId: string;
}

export interface BaroCadBooleanExtrusionFeatureMesh {
  readonly binding: BooleanExtrusionFeatureGraphReport['qualifiedBindings'][number];
  readonly nativeMesh: CoplanarFaceBooleanExtrusionMeshResult;
}

/** Derive display-only filled Shell data from one exact evaluated native graph output. */
export function deriveBaroCadBooleanExtrusionFeatureMesh(
  graph: BooleanExtrusionFeatureGraphResult,
  selection: BaroCadBooleanExtrusionFeatureSelection,
  meshOptions: CoplanarFaceBooleanExtrusionMeshOptions,
): BaroCadBooleanExtrusionFeatureMesh {
  const { binding, feature } = selectBaroCadBooleanExtrusionFeature(graph, selection);
  const nativeMesh = tessellateCoplanarFaceBooleanExtrusion(feature.evaluation, meshOptions);
  validateCoplanarFaceBooleanExtrusionMesh(nativeMesh);
  return Object.freeze({ binding, nativeMesh });
}
