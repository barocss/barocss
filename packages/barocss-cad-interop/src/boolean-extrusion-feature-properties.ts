import { measureCoplanarFaceBooleanExtrusion,
  validateCoplanarFaceBooleanExtrusionProperties } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphReport, BooleanExtrusionFeatureGraphResult,
  CoplanarFaceBooleanExtrusionPropertiesOptions,
  CoplanarFaceBooleanExtrusionPropertiesResult } from '@barocss/cad';
import type { BaroCadBooleanExtrusionFeatureSelection } from './boolean-extrusion-feature-mesh.js';
import { selectBaroCadBooleanExtrusionFeature } from './boolean-extrusion-feature-selection.js';

export interface BaroCadBooleanExtrusionFeatureProperties {
  readonly binding: BooleanExtrusionFeatureGraphReport['qualifiedBindings'][number];
  readonly nativeProperties: CoplanarFaceBooleanExtrusionPropertiesResult;
}

/** Measure one exact current native extrusion output without using its display mesh. */
export function deriveBaroCadBooleanExtrusionFeatureProperties(
  graph: BooleanExtrusionFeatureGraphResult,
  selection: BaroCadBooleanExtrusionFeatureSelection,
  options: CoplanarFaceBooleanExtrusionPropertiesOptions,
): BaroCadBooleanExtrusionFeatureProperties {
  const { binding, feature } = selectBaroCadBooleanExtrusionFeature(graph, selection);
  const nativeProperties = measureCoplanarFaceBooleanExtrusion(feature.evaluation, options);
  validateCoplanarFaceBooleanExtrusionProperties(nativeProperties);
  return Object.freeze({ binding, nativeProperties });
}
