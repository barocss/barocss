import { tessellateCoplanarFaceBooleanExtrusion, validateBooleanExtrusionFeatureGraph,
  validateCoplanarFaceBooleanExtrusionMesh } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphReport, BooleanExtrusionFeatureGraphResult,
  CoplanarFaceBooleanExtrusionMeshOptions, CoplanarFaceBooleanExtrusionMeshResult } from '@barocss/cad';

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

function ownSelection(input: BaroCadBooleanExtrusionFeatureSelection): BaroCadBooleanExtrusionFeatureSelection {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
    throw new TypeError('A plain qualified extrusion selection is required');
  }
  const keys = Reflect.ownKeys(input);
  const fields = Object.getOwnPropertyDescriptors(input);
  const names = ['graphId', 'revision', 'featureId', 'outputSlotId'];
  const graphId: unknown = fields.graphId?.value;
  const revision: unknown = fields.revision?.value;
  const featureId: unknown = fields.featureId?.value;
  const outputSlotId: unknown = fields.outputSlotId?.value;
  if (keys.length !== names.length || !keys.every(key => typeof key === 'string' &&
      names.includes(key) && fields[key].enumerable && 'value' in fields[key]) ||
      typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
      typeof graphId !== 'string' || graphId.length === 0 ||
      typeof featureId !== 'string' || featureId.length === 0 ||
      typeof outputSlotId !== 'string' || outputSlotId.length === 0) {
    throw new TypeError('An exact graph/revision/feature/output-slot selection is required');
  }
  return { graphId, revision, featureId, outputSlotId };
}

/** Derive display-only filled Shell data from one exact evaluated native graph output. */
export function deriveBaroCadBooleanExtrusionFeatureMesh(
  graph: BooleanExtrusionFeatureGraphResult,
  selection: BaroCadBooleanExtrusionFeatureSelection,
  meshOptions: CoplanarFaceBooleanExtrusionMeshOptions,
): BaroCadBooleanExtrusionFeatureMesh {
  const selected = ownSelection(selection);
  const report = validateBooleanExtrusionFeatureGraph(graph);
  if (selected.graphId !== report.graphId || selected.revision !== report.revision) {
    throw new RangeError('The selected graph or revision is stale');
  }
  const binding = report.qualifiedBindings.find(row => row.graphId === selected.graphId &&
    row.revision === selected.revision && row.featureId === selected.featureId &&
    row.outputSlotId === selected.outputSlotId);
  const feature = graph.features.find(row => row.featureId === selected.featureId &&
    row.outputSlotId === selected.outputSlotId);
  if (binding?.kind !== 'normal-extrusion' || feature?.kind !== 'normal-extrusion') {
    throw new RangeError('The selected feature slot must be a current evaluated extrusion');
  }
  const nativeMesh = tessellateCoplanarFaceBooleanExtrusion(feature.evaluation, meshOptions);
  validateCoplanarFaceBooleanExtrusionMesh(nativeMesh);
  return Object.freeze({ binding, nativeMesh });
}
