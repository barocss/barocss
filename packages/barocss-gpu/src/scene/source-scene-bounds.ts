import { BarocssError } from '../core/barocss-error.js';
import { compileGpu } from '../mesh/gpu-compiler.js';
import { compileAffineSceneSource } from './affine-scene-source.js';
import type { AffineScene2, AffineSceneObject2 } from './affine-scene-source.js';
import { inverseRotation } from '../core/rotation.js';
import { ownRecord, copyGpuData, freezeGpuData } from '../mesh/gpu-data.js';
import type { Scene1, SceneObject1, Vec3 } from './scene-types.js';

export const SourceSceneBoundsDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', SOURCE: 'SOURCE',
  SELECTION: 'SELECTION', NUMERICAL: 'NUMERICAL',
} as const);
export type SourceSceneBoundsDiagnosticCode = typeof SourceSceneBoundsDiagnosticCode[keyof typeof SourceSceneBoundsDiagnosticCode];
export class SourceSceneBoundsError extends BarocssError {
  constructor(readonly code: SourceSceneBoundsDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Source scene bounds: ' + detail, cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
    this.name = 'SourceSceneBoundsError';
  }
}
export interface SourceSceneBoundsRequest {
  sourceVersion: 1 | 2;
  source: string;
  /** Omission selects all. An empty array selects none. */
  objectIds?: string[];
}
export interface SourceSceneBoundsBox { min: Vec3; max: Vec3 }
export interface SourceSceneObjectBounds {
  objectId: string;
  kind: SceneObject1['type'];
  localBounds: SourceSceneBoundsBox;
  worldBounds: SourceSceneBoundsBox;
}
export interface PreparedSourceSceneBounds {
  readonly format: 'barocss-gpu-source-scene-bounds';
  readonly version: 0;
  readonly profile: 'original-number-box-corners-v0';
  readonly coordinateSystem: 'right-handed-y-up';
  readonly positionUnit: 'scene';
  readonly numericPolicy: 'binary64-box-corners-no-padding';
  readonly sourceVersion: 1 | 2;
  readonly source: string;
  readonly scene: Scene1 | AffineScene2;
  readonly selection: string[] | null;
  readonly objects: SourceSceneObjectBounds[];
  readonly bounds: SourceSceneBoundsBox | null;
}
const CODE = SourceSceneBoundsDiagnosticCode;
const ID = /^[A-Za-z_][A-Za-z0-9_-]{0,47}$/;
function check(value: unknown, code: SourceSceneBoundsDiagnosticCode, detail: string): asserts value {
  if (!value) throw new SourceSceneBoundsError(code, detail);
}
function selection(input: unknown): string[] {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    CODE.INPUT, 'objectIds requires a current-realm plain array');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0
    && length.value <= 32, CODE.BUDGET, 'objectIds length must be within 0..32');
  const keys = Reflect.ownKeys(input);
  check(keys.length === length.value + 1 && keys.every(key => key === 'length'
    || typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length.value),
  CODE.INPUT, 'objectIds requires dense data without extra, hidden or symbol fields');
  const ids: string[] = [], seen = new Set<string>();
  for (let i = 0; i < length.value; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    check(descriptor && 'value' in descriptor && descriptor.enumerable,
      CODE.INPUT, 'objectIds refuses accessors, hidden or missing entries');
    check(typeof descriptor.value === 'string' && ID.test(descriptor.value),
      CODE.SELECTION, 'objectIds requires ASCII identifiers of 1..48 characters');
    check(!seen.has(descriptor.value), CODE.SELECTION, 'objectIds contains a duplicate identifier');
    seen.add(descriptor.value); ids.push(descriptor.value);
  }
  return ids;
}
function request(input: unknown): { sourceVersion: 1 | 2; source: string; selection: string[] | null } {
  try {
    const data = ownRecord(input, ['sourceVersion', 'source', 'objectIds'], ['sourceVersion', 'source']);
    check(data.sourceVersion === 1 || data.sourceVersion === 2, CODE.VERSION, 'Only explicit Source1 or Source2 is supported');
    check(typeof data.source === 'string', CODE.INPUT, 'Original source must be text');
    check(data.source.length <= 65536 && new TextEncoder().encode(data.source).length <= 65536,
      CODE.BUDGET, 'Original source exceeds 64 KiB UTF-8 or code units');
    return { sourceVersion: data.sourceVersion, source: data.source,
      selection: Object.hasOwn(data, 'objectIds') ? selection(data.objectIds) : null };
  } catch (cause) {
    if (cause instanceof SourceSceneBoundsError) throw cause;
    throw new SourceSceneBoundsError(CODE.INPUT, 'Own request reflection refused', cause);
  }
}
function scene(source: string, sourceVersion: 1 | 2): Scene1 | AffineScene2 {
  if (sourceVersion === 2) {
    try { return compileAffineSceneSource(source).scene; }
    catch (cause) { throw new SourceSceneBoundsError(CODE.SOURCE, 'Actual Source2 compilation refused', cause); }
  }
  const compiled = compileGpu({ kind: 'scene', source, sourceVersion: 1 });
  if (!compiled.ok) throw new SourceSceneBoundsError(CODE.SOURCE, compiled.diagnostics[0].message,
    freezeGpuData(copyGpuData(compiled.diagnostics)));
  check(compiled.execution.kind === 'sdf' && compiled.execution.scene.version === 1,
    CODE.NUMERICAL, 'Actual Source1 compiler returned an incompatible scene');
  return compiled.execution.scene;
}
function finite(values: readonly number[]): void {
  check(values.every(Number.isFinite), CODE.NUMERICAL, 'Derived box arithmetic is nonfinite');
}
function localBox(object: SceneObject1): SourceSceneBoundsBox {
  let min: Vec3, max: Vec3;
  switch (object.type) {
    case 'sphere': max = [object.radius, object.radius, object.radius]; min = max.map(n => -n) as Vec3; break;
    case 'box': case 'rounded-box': max = object.size.map(n => n / 2) as Vec3; min = max.map(n => -n) as Vec3; break;
    case 'cylinder': max = [object.radius, object.height / 2, object.radius]; min = max.map(n => -n) as Vec3; break;
    case 'capsule':
      min = object.start.map((n, axis) => Math.min(n, object.end[axis]) - object.radius) as Vec3;
      max = object.start.map((n, axis) => Math.max(n, object.end[axis]) + object.radius) as Vec3;
      break;
    case 'torus':
      max = [object.majorRadius + object.minorRadius, object.minorRadius, object.majorRadius + object.minorRadius];
      min = max.map(n => -n) as Vec3; break;
  }
  finite([...min, ...max]);
  check(min.every((n, axis) => n <= max[axis]), CODE.NUMERICAL, 'Local bounds are unordered');
  return { min, max };
}
function worldBox(object: SceneObject1 | AffineSceneObject2, local: SourceSceneBoundsBox): SourceSceneBoundsBox {
  const rotation = inverseRotation(object.rotateDegrees);
  const scale: Vec3 = 'scaleXYZ' in object ? object.scaleXYZ : [1, 1, 1];
  let bounds: SourceSceneBoundsBox | null = null;
  for (let corner = 0; corner < 8; corner++) {
    const point = [0, 1, 2].map(axis => ((corner & (1 << axis)) ? local.max[axis] : local.min[axis]) * scale[axis]);
    finite(point);
    // inverseRotation stores the rows of forward R as columns of inverse R.
    const world = [0, 1, 2].map(axis => {
      const products = point.map((n, component) => rotation[3 * axis + component] * n);
      const first = products[0] + products[1], rotated = first + products[2];
      const translated = object.translate[axis] + rotated;
      finite([...products, first, rotated, translated]);
      return translated;
    }) as Vec3;
    if (bounds === null) bounds = { min: [...world] as Vec3, max: [...world] as Vec3 };
    else for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], world[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], world[axis]);
    }
  }
  check(bounds !== null && bounds.min.every((n, axis) => Number.isFinite(n)
    && Number.isFinite(bounds!.max[axis]) && n <= bounds!.max[axis]),
  CODE.NUMERICAL, 'World bounds are nonfinite or unordered');
  return bounds;
}
/** Original Number-space primitive boxes; no shader, pixel or safe-culling certificate. */
export function prepareSourceSceneBounds(input: unknown): PreparedSourceSceneBounds {
  const admitted = request(input), original = scene(admitted.source, admitted.sourceVersion);
  const known = new Set(original.objects.map(object => object.id));
  if (admitted.selection !== null) for (const id of admitted.selection) {
    check(known.has(id), CODE.SELECTION, 'Unknown original object identifier: ' + id);
  }
  const selected = admitted.selection === null ? null : new Set(admitted.selection);
  const objects: SourceSceneObjectBounds[] = [];
  let bounds: SourceSceneBoundsBox | null = null;
  for (const object of original.objects) if (selected === null || selected.has(object.id)) {
    const localBounds = localBox(object), worldBounds = worldBox(object, localBounds);
    objects.push({ objectId: object.id, kind: object.type, localBounds, worldBounds });
    if (bounds === null) bounds = copyGpuData(worldBounds);
    else for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], worldBounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], worldBounds.max[axis]);
    }
  }
  return freezeGpuData({ format: 'barocss-gpu-source-scene-bounds', version: 0,
    profile: 'original-number-box-corners-v0', coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', numericPolicy: 'binary64-box-corners-no-padding',
    sourceVersion: admitted.sourceVersion, source: admitted.source, scene: copyGpuData(original),
    selection: admitted.selection, objects, bounds });
}
