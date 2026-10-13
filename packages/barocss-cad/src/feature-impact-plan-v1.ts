import type { BooleanExtrusionFeatureGraphReport } from './boolean-extrusion-feature-graph.js';

/**
 * Read-only dependency impact analysis for the existing bounded Boolean/extrusion
 * feature report. It does not perform, skip, or certify native recomputation.
 * An authoritative transaction still executes the existing full native path.
 */
export interface FeatureImpactPlanV1 {
  readonly schema: 'barocss-cad-feature-impact-plan';
  readonly version: 1;
  readonly graphId: string;
  readonly revision: number;
  readonly affectedParameterIds: readonly string[];
  readonly affectedFeatureIds: readonly string[];
  readonly unaffectedFeatureIds: readonly string[];
  readonly evaluationMode: 'analysis-only-full-rebuild-required';
}

function unique(values: readonly string[]): boolean {
  return values.every(x => typeof x === 'string' && x.length > 0) &&
    new Set(values).size === values.length;
}

export function planBooleanExtrusionImpactV1(
  report: BooleanExtrusionFeatureGraphReport,
  change: { readonly parameterIds: readonly string[]; readonly featureIds: readonly string[] },
): FeatureImpactPlanV1 {
  if (!report || report.schema !== 'barocss-native-boolean-extrusion-feature-graph-report' ||
      !Number.isSafeInteger(report.revision) ||
      !Array.isArray(report.parameterOrder) || !Array.isArray(report.featureOrder) ||
      !Array.isArray(report.parameterDependencies) || !Array.isArray(report.featureDependencies) ||
      !change || !Array.isArray(change.parameterIds) || !Array.isArray(change.featureIds) ||
      !unique(change.parameterIds) || !unique(change.featureIds) ||
      !unique(report.parameterOrder) || !unique(report.featureOrder))
    throw new TypeError('Complete native dependency report and bounded edit IDs required');

  const parameterSet = new Set(report.parameterOrder), featureSet = new Set(report.featureOrder);
  if (change.parameterIds.some(x => !parameterSet.has(x)) ||
      change.featureIds.some(x => !featureSet.has(x)))
    throw new RangeError('Unknown authored parameter/feature ID');

  const changedParameters = new Set(change.parameterIds);
  const paramEdges = report.parameterDependencies;
  for (const edge of paramEdges) {
    if (!parameterSet.has(edge.parameterId) || !parameterSet.has(edge.dependsOn))
      throw new TypeError('Inconsistent parameter dependency');
  }
  // Propagate dirty parameters, including transitive downstream definitions.
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of paramEdges) {
      if (changedParameters.has(edge.dependsOn) && !changedParameters.has(edge.parameterId)) {
        changedParameters.add(edge.parameterId); changed = true;
      }
    }
  }

  const affected = new Set(change.featureIds);
  const dependencyMap = new Map(report.featureDependencies.map(x => [x.featureId, x.dependencyIds]));
  if (dependencyMap.size !== report.featureOrder.length ||
      report.featureDependencies.length !== report.featureOrder.length)
    throw new TypeError('Incomplete feature dependency inventory');
  for (const id of report.featureOrder) {
    const deps = dependencyMap.get(id);
    if (!Array.isArray(deps) || deps.some(x => !parameterSet.has(x) && !featureSet.has(x)))
      throw new TypeError('Unknown feature dependency');
  }
  // Fixed point prevents dependence on report order; output retains native order.
  changed = true;
  while (changed) {
    changed = false;
    for (const id of report.featureOrder) {
      if (affected.has(id)) continue;
      if (dependencyMap.get(id)!.some(dep => changedParameters.has(dep) || affected.has(dep))) {
        affected.add(id); changed = true;
      }
    }
  }
  return {
    schema: 'barocss-cad-feature-impact-plan',
    version: 1,
    graphId: report.graphId,
    revision: report.revision,
    affectedParameterIds: report.parameterOrder.filter(id => changedParameters.has(id)),
    affectedFeatureIds: report.featureOrder.filter(id => affected.has(id)),
    unaffectedFeatureIds: report.featureOrder.filter(id => !affected.has(id)),
    evaluationMode: 'analysis-only-full-rebuild-required',
  };
}
