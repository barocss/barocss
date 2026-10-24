import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { prepareEngineScene, EngineSceneError } from './engine-scene.js';
import type { PreparedEngineScene } from './engine-scene.js';
import type { Vec3 } from '../scene/scene-types.js';

export const EngineRaycastDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET', SCENE: 'SCENE', RAY: 'RAY', NUMERICAL: 'NUMERICAL',
} as const);
export type EngineRaycastDiagnosticCode = typeof EngineRaycastDiagnosticCode[keyof typeof EngineRaycastDiagnosticCode];
export class EngineRaycastError extends BarocssError {
  readonly code: EngineRaycastDiagnosticCode;
  constructor(code: EngineRaycastDiagnosticCode, detail: string, cause?: unknown) {
    super(code, ('Engine raycast: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'EngineRaycastError'; this.code = code;
  }
}

/** Original authored ray. Positions and clip distances use scene units. */
export interface EngineRayV0 {
  format: 'barocss-gpu-engine-ray'; version: 0;
  coordinateSystem: 'right-handed-y-up'; positionUnit: 'scene';
  origin: Vec3; direction: Vec3; near: number; far: number;
}
/** Original Number-space intersection; not a screen/pixel or Float32 query. */
export interface EngineRayHitV0 {
  format: 'barocss-gpu-engine-ray-hit'; version: 0;
  nodeId: string; geometryId: string; materialId: string; triangleIndex: number;
  distance: number; point: Vec3; barycentric: [number, number, number]; uv: [number, number]; normal: Vec3;
  coordinateSystem: 'right-handed-y-up'; positionUnit: 'scene';
}
const CODE = EngineRaycastDiagnosticCode;
function check(value: unknown, code: EngineRaycastDiagnosticCode, detail: string): asserts value {
  if (!value) throw new EngineRaycastError(code, detail);
}
function guard<T>(code: EngineRaycastDiagnosticCode, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof EngineRaycastError) throw cause;
    throw new EngineRaycastError(code, detail, cause);
  }
}
function vector(input: unknown, label: string): Vec3 {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype, CODE.INPUT,
    label + ' must be a plain numeric array');
  const length = Object.getOwnPropertyDescriptor(input, 'length');
  check(length && 'value' in length && length.value === 3, CODE.INPUT, label + ' must contain exactly3 components');
  const keys = Reflect.ownKeys(input);
  check(keys.length === 4 && keys.every(key => key === 'length' || key === '0' || key === '1' || key === '2'),
    CODE.INPUT, label + ' must be dense without hidden, extra or symbol fields');
  const result: number[] = [];
  for (let i = 0; i < 3; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(i));
    check(descriptor && 'value' in descriptor && descriptor.enumerable && typeof descriptor.value === 'number',
      CODE.INPUT, label + ' requires own enumerable numeric data');
    result.push(descriptor.value);
  }
  return result as Vec3;
}
function ray(input: unknown): { original: EngineRayV0; direction: Vec3 } {
  return guard(CODE.INPUT, 'Own ray reflection refused', () => {
    const data = ownRecord(input, ['format', 'version', 'coordinateSystem', 'positionUnit', 'origin', 'direction', 'near', 'far']);
    check(data.format === 'barocss-gpu-engine-ray' && data.version === 0
      && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene', CODE.VERSION,
    'Only engine ray0/right-handed-y-up/scene metadata is supported');
    const origin = vector(data.origin, 'ray.origin'), originalDirection = vector(data.direction, 'ray.direction');
    check(typeof data.near === 'number' && typeof data.far === 'number', CODE.INPUT, 'Ray clips must be numeric data');
    const length = Math.hypot(...originalDirection);
    check(origin.every(n => Number.isFinite(n) && Math.abs(n) <= 1000)
      && originalDirection.every(n => Number.isFinite(n) && Math.abs(n) <= 1)
      && Number.isFinite(length) && Math.abs(length - 1) <= 1e-9
      && Number.isFinite(data.near) && Number.isFinite(data.far)
      && data.near >= 0 && data.near <= data.far && data.far <= 10000, CODE.RAY,
    'Ray requires a bounded origin, a unit direction within1e-9 and clips0<=near<=far<=10000');
    const direction = originalDirection.map(n => n / length) as Vec3;
    Object.freeze(origin); Object.freeze(originalDirection); Object.freeze(direction);
    const original: EngineRayV0 = Object.freeze({ format: 'barocss-gpu-engine-ray', version: 0,
      coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', origin,
      direction: originalDirection, near: data.near, far: data.far });
    return { original, direction };
  });
}
function scene(input: unknown): PreparedEngineScene {
  try { return prepareEngineScene(input); } catch (cause) {
    throw new EngineRaycastError(cause instanceof EngineSceneError && cause.code === 'BUDGET' ? CODE.BUDGET : CODE.SCENE,
      'Original engine scene preparation refused', cause);
  }
}
function finite(values: readonly number[], detail: string): void {
  check(values.every(Number.isFinite), CODE.NUMERICAL, detail);
}
function subtract(a: Vec3, b: Vec3): Vec3 {
  const result = a.map((n, axis) => n - b[axis]) as Vec3; finite(result, 'Triangle/ray subtraction is nonfinite'); return result;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  const result: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  finite(result, 'Triangle/ray cross product is nonfinite'); return result;
}
function dot(a: Vec3, b: Vec3): number {
  const result = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; finite([result], 'Triangle/ray dot product is nonfinite'); return result;
}
function transformed(matrix: ArrayLike<number>, stride: 3 | 4, input: Vec3, translation: boolean): Vec3 {
  const result = [0, 1, 2].map(row => matrix[row] * input[0] + matrix[stride + row] * input[1]
    + matrix[2 * stride + row] * input[2] + (translation ? matrix[3 * stride + row] : 0)) as Vec3;
  finite(result, 'Original world triangle/normal transformation is nonfinite'); return result;
}
function normalized(input: Vec3): Vec3 {
  const length = Math.hypot(...input); check(Number.isFinite(length) && length > 0, CODE.NUMERICAL,
    'Interpolated world normal requires finite nonzero length');
  const result = input.map(n => n / length) as Vec3; finite(result, 'World normal normalization is nonfinite'); return result;
}
function vertex(array: number[], index: number): Vec3 {
  return [array[index * 3], array[index * 3 + 1], array[index * 3 + 2]];
}

/** Select the nearest eligible original-world front triangle in authored draw/triangle order. */
export function raycastEngineScene(sceneInput: unknown, rayInput: unknown): EngineRayHitV0 | null {
  // Every query re-admits the original source. Caller-mutated prepared execution
  // buffers are neither trusted nor reused.
  const prepared = scene(sceneInput), admitted = ray(rayInput), { origin, near, far } = admitted.original;
  const direction = admitted.direction;
  const triangleWork = prepared.draws.reduce((sum, draw) => sum + draw.geometry.triangleCount, 0);
  check(triangleWork <= 262144, CODE.BUDGET, 'Visible mesh-instance triangle work exceeds262144');
  let nearest: EngineRayHitV0 | null = null;
  for (const draw of prepared.draws) {
    const geometry = draw.geometry.geometry;
    for (let offset = 0; offset < geometry.indices.length; offset += 3) {
      const indices = [geometry.indices[offset], geometry.indices[offset + 1], geometry.indices[offset + 2]];
      const points = indices.map(index => transformed(draw.node.worldMatrix, 4, vertex(geometry.positions, index), true));
      const [a, b, c] = points, edge1 = subtract(b, a), edge2 = subtract(c, a);
      const areaLength = Math.hypot(...cross(edge1, edge2));
      check(Number.isFinite(areaLength) && areaLength > 0, CODE.NUMERICAL, 'Original world triangle area is nonfinite or zero');
      const p = cross(direction, edge2), determinant = dot(edge1, p), facing = determinant / areaLength;
      finite([facing], 'Front triangle angular ratio is nonfinite');
      if (facing <= 1e-8) continue;
      const inverse = 1 / determinant; finite([inverse], 'Triangle determinant reciprocal is nonfinite');
      const fromA = subtract(origin, a), u = dot(fromA, p) * inverse;
      const q = cross(fromA, edge1), v = dot(direction, q) * inverse, distance = dot(edge2, q) * inverse;
      finite([u, v, distance, u + v], 'Computed triangle barycentrics or distance are nonfinite');
      if (u < 0 || v < 0 || u + v > 1 || distance < near || distance > far) continue;
      // Strict comparison preserves the first draw and triangle for exact ties.
      if (nearest !== null && distance >= nearest.distance) continue;
      const barycentric: [number, number, number] = [1 - u - v, u, v];
      const point = origin.map((n, axis) => n + distance * direction[axis]) as Vec3;
      finite([...barycentric, ...point], 'World hit point or barycentrics are nonfinite');
      check(point.every(n => Math.abs(n) <= 1000), CODE.NUMERICAL, 'World hit point exceeds1000 scene bounds');
      const reconstructed = [0, 1, 2].map(axis => barycentric[0] * a[axis] + barycentric[1] * b[axis] + barycentric[2] * c[axis]);
      finite(reconstructed, 'Barycentric world reconstruction is nonfinite');
      check(point.every((n, axis) => Math.abs(n - reconstructed[axis]) <= 1e-7), CODE.NUMERICAL,
        'Ray/world barycentric reconstruction differs by more than1e-7 per component');
      const uv = [0, 1].map(axis => indices.reduce((sum, index, corner) => sum + barycentric[corner] * geometry.uvs[index * 2 + axis], 0)) as [number, number];
      finite(uv, 'Original UV interpolation is nonfinite');
      const vertexNormals = indices.map(index => normalized(transformed(draw.node.normalMatrix, 3, vertex(geometry.normals, index), false)));
      const blended = [0, 1, 2].map(axis => barycentric[0] * vertexNormals[0][axis]
        + barycentric[1] * vertexNormals[1][axis] + barycentric[2] * vertexNormals[2][axis]) as Vec3;
      finite(blended, 'World vertex normal interpolation is nonfinite'); const normal = normalized(blended);
      for (const array of [point, barycentric, uv, normal]) Object.freeze(array);
      nearest = Object.freeze({ format: 'barocss-gpu-engine-ray-hit', version: 0,
        nodeId: draw.id, geometryId: draw.geometryId, materialId: draw.materialId, triangleIndex: offset / 3,
        distance, point, barycentric, uv, normal, coordinateSystem: 'right-handed-y-up', positionUnit: 'scene' });
    }
  }
  return nearest;
}
