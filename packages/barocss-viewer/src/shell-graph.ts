import { validateBooleanExtrusionFeatureGraph } from '@barocss/cad';
import type { BooleanExtrusionFeatureGraphResult, CoplanarFaceBooleanExtrusionMeshOptions } from '@barocss/cad';
import { deriveBaroCadBooleanExtrusionFeatureMesh } from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import { prepareBooleanShellBuffers } from '@barocss/gpu';
import type { BooleanShellLeafRef, BooleanShellSceneEntry, BooleanShellSceneInputV0 } from '@barocss/gpu';

type RGB = [number, number, number];
export interface ViewerShellEntry {
  ref: BooleanShellLeafRef;
  mesh: CoplanarFaceBooleanExtrusionMeshOptions;
  color: RGB;
  edges: { color: RGB } | null;
}
export interface ViewerShellLoadOptions {
  basis: 'authored-xyz-matches-rhyup';
  entries: ViewerShellEntry[];
}
export interface ViewerShellState {
  graph: BooleanExtrusionFeatureGraphResult;
  scene: BooleanShellSceneInputV0;
  boundsScene: { min: RGB; max: RGB } | null;
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new RangeError('Viewer Shell: ' + message);
}
function record(input: unknown, fields: string[], label: string): Record<string, unknown> {
  check(input !== null && typeof input === 'object'
    && Object.getPrototypeOf(input) === Object.prototype, label + ' must be plain own data');
  const keys = Reflect.ownKeys(input);
  check(keys.length === fields.length
    && keys.every(key => typeof key === 'string' && fields.includes(key)), label + ' has missing or extra fields');
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    check(descriptor && descriptor.enumerable && 'value' in descriptor, label + '.' + key + ' must be own data');
    result[key] = descriptor.value;
  }
  return result;
}
function dense(input: unknown, maximum: number, label: string): unknown[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    label + ' must be an ordinary dense array');
  const size = Object.getOwnPropertyDescriptor(input, 'length');
  check(size && 'value' in size && Number.isInteger(size.value)
    && size.value >= 0 && size.value <= maximum
    && Reflect.ownKeys(input).length === size.value + 1, label + ' exceeds bounds or has extra fields');
  return Array.from({ length: size.value }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && descriptor.enumerable && 'value' in descriptor, label + '[' + index + '] must be own data');
    return descriptor.value;
  });
}
function rgb(input: unknown, label: string): RGB {
  const values = dense(input, 3, label);
  check(values.length === 3 && values.every(value => typeof value === 'number'
    && Number.isFinite(value) && value >= 0 && value <= 1), label + ' requires finite RGB0..1');
  return values as RGB;
}
function reference(input: unknown): BooleanShellLeafRef {
  const data = record(input, ['graphId', 'graphRevision', 'featureId', 'outputSlotId'], 'Shell ref');
  for (const key of ['graphId', 'featureId', 'outputSlotId']) {
    check(typeof data[key] === 'string' && /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(data[key] as string),
      'Shell ref.' + key + ' requires an ASCII ID1..64');
  }
  check(typeof data.graphRevision === 'number' && Number.isSafeInteger(data.graphRevision)
    && data.graphRevision >= 0, 'Shell ref.graphRevision must be a nonnegative safe integer');
  return data as unknown as BooleanShellLeafRef;
}

/** Derive only explicitly selected current native leaves. No renderer or Viewer state is changed. */
export function prepareViewerShellGraph(input: BooleanExtrusionFeatureGraphResult,
  options: ViewerShellLoadOptions, mmToSceneUnit: number): ViewerShellState {
  validateBooleanExtrusionFeatureGraph(input);
  const graph = structuredClone(input);
  const request = record(options, ['basis', 'entries'], 'Shell options');
  check(request.basis === 'authored-xyz-matches-rhyup', 'authored XYZ/mm basis must explicitly match Viewer Y-up');
  check(typeof mmToSceneUnit === 'number' && Number.isFinite(mmToSceneUnit)
    && mmToSceneUnit > 0, 'mmToSceneUnit must be finite and positive');
  const seen = new Set<string>();
  const entries: BooleanShellSceneEntry[] = [];
  const occupied: { min: RGB; max: RGB }[] = [];
  for (const raw of dense(request.entries, 4, 'Shell entries')) {
    const entry = record(raw, ['ref', 'mesh', 'color', 'edges'], 'Shell entry');
    const ref = reference(entry.ref);
    const key = JSON.stringify([ref.graphId, ref.graphRevision, ref.featureId, ref.outputSlotId]);
    check(!seen.has(key), 'duplicate qualified Shell leaf');
    seen.add(key);
    const color = rgb(entry.color, 'Shell color');
    const edges = entry.edges === null ? null
      : { color: rgb(record(entry.edges, ['color'], 'Shell edges').color, 'Shell edge color') };
    // Read and copy all five own mesh fields before delegating native option bounds/brands.
    const mesh = record(entry.mesh, ['meshId', 'maximumVertices', 'maximumTriangles',
      'maximumEdgePaths', 'maximumNativeSamples'], 'Shell mesh options') as unknown as CoplanarFaceBooleanExtrusionMeshOptions;
    const derived = deriveBaroCadBooleanExtrusionFeatureMesh(graph, {
      graphId: ref.graphId, revision: ref.graphRevision,
      featureId: ref.featureId, outputSlotId: ref.outputSlotId }, mesh);
    const buffers = prepareBooleanShellBuffers(derived.nativeMesh, {
      mmToSceneUnit, translate: [0, 0, 0] });
    entries.push({ ref, native: buffers.native, color, edges });
    if (buffers.bounds) occupied.push({ min: [...buffers.bounds.min], max: [...buffers.bounds.max] });
  }
  const boundsScene = occupied.length ? {
    min: [0, 1, 2].map(axis => Math.min(...occupied.map(bounds => bounds.min[axis]))) as RGB,
    max: [0, 1, 2].map(axis => Math.max(...occupied.map(bounds => bounds.max[axis]))) as RGB,
  } : null;
  return { graph, scene: { schema: 'barocss-gpu-boolean-shell-scene', version: 0, entries }, boundsScene };
}
