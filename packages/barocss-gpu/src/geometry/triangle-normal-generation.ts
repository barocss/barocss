import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';

/** Original indexed source without supplied normals. UV values are dimensionless. */
export interface TriangleNormalSourceV0 {
  format: 'barocss-gpu-triangle-normal-source';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  winding: 'ccw';
  positions: number[];
  uvs: number[];
  indices: number[];
}

/** Source authority, generated Number normals and separate mutable execution buffers. */
export interface PreparedTriangleGeometryWithNormals {
  readonly source: TriangleNormalSourceV0;
  readonly normalMethod: 'area-weighted-original-triangle';
  readonly prepared: PreparedTriangleGeometry;
}

const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'winding', 'positions', 'uvs', 'indices'] as const;
const MAX_VERTICES = 131072;
const MAX_TRIANGLES = 131072;
const MAX_SOURCE_VALUES = 1048576;

function check(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function guard<T>(message: string, action: () => T): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof TriangleGeometryError) throw cause;
    throw new TriangleGeometryError('INPUT', message, cause);
  }
}
function lengthOf(input: unknown, maximum: number, label: string): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    'INPUT', label + ' must be a plain array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value)
    && descriptor.value >= 0, 'INPUT', label + ' requires an own array length');
  check(descriptor.value <= maximum, 'BUDGET', label + ' exceeds the source cardinality limit');
  return descriptor.value as number;
}
function copyNumbers(input: unknown, length: number, label: string): number[] {
  const keys = Reflect.ownKeys(input as number[]);
  check(keys.length === length + 1, 'INPUT', label + ' must be dense without extra fields');
  for (const key of keys) if (key !== 'length') {
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < length,
      'INPUT', label + ' has unsupported array keys');
  }
  const result = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    'INPUT', label + '[' + index + '] must be finite own numerical data');
    result[index] = descriptor.value;
  }
  return result;
}

/** Pure original-coordinate normal generation; no welding, fallback normals or native CAD identity. */
export function prepareTriangleGeometryWithNormals(input: unknown): PreparedTriangleGeometryWithNormals {
  const data = guard('Exact original normal-source fields are required', () => ownRecord(input, FIELDS));
  check(data.format === 'barocss-gpu-triangle-normal-source' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene'
    && data.winding === 'ccw', 'VERSION', 'Only normal source0/right-handed-y-up/scene/ccw is supported');
  check(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'id must be an ASCII identifier of 1..64 characters');

  // All cardinalities are admitted before attribute enumeration or allocation.
  const lengths = guard('Bounded plain original attributes are required', () => ({
    positions: lengthOf(data.positions, MAX_VERTICES * 3, 'positions'),
    uvs: lengthOf(data.uvs, MAX_VERTICES * 2, 'uvs'),
    indices: lengthOf(data.indices, MAX_TRIANGLES * 3, 'indices'),
  }));
  check(lengths.positions + lengths.uvs + lengths.indices <= MAX_SOURCE_VALUES,
    'BUDGET', 'Aggregate original numeric source limit exceeded');
  check(lengths.positions >= 9 && lengths.positions % 3 === 0,
    'GEOMETRY', 'positions require 3..131072 complete XYZ vertices');
  const vertexCount = lengths.positions / 3;
  check(lengths.uvs === vertexCount * 2, 'GEOMETRY', 'UV count must match all positions');
  check(lengths.indices >= 3 && lengths.indices % 3 === 0,
    'GEOMETRY', 'indices require 1..131072 complete triangles');

  const arrays = guard('Dense finite original numerical data is required', () => ({
    positions: copyNumbers(data.positions, lengths.positions, 'positions'),
    uvs: copyNumbers(data.uvs, lengths.uvs, 'uvs'),
    indices: copyNumbers(data.indices, lengths.indices, 'indices'),
  }));
  check(arrays.positions.every(n => Math.abs(n) <= 1000), 'GEOMETRY',
    'Original positions must remain within 1000 scene units');
  check(arrays.uvs.every(n => Math.abs(n) <= 1000), 'GEOMETRY',
    'Original UV values must remain within 1000');
  for (const index of arrays.indices) {
    check(Number.isInteger(index) && index >= 0 && index < vertexCount,
      'GEOMETRY', 'Original indices must address an existing vertex');
  }

  const normals = new Array<number>(lengths.positions).fill(0);
  const referenced = new Uint8Array(vertexCount);
  for (let offset = 0; offset < lengths.indices; offset += 3) {
    const a = arrays.indices[offset] * 3, b = arrays.indices[offset + 1] * 3;
    const c = arrays.indices[offset + 2] * 3;
    check(a !== b && b !== c && a !== c, 'GEOMETRY', 'Original triangle repeats an index');
    const ux = arrays.positions[b] - arrays.positions[a];
    const uy = arrays.positions[b + 1] - arrays.positions[a + 1];
    const uz = arrays.positions[b + 2] - arrays.positions[a + 2];
    const vx = arrays.positions[c] - arrays.positions[a];
    const vy = arrays.positions[c + 1] - arrays.positions[a + 1];
    const vz = arrays.positions[c + 2] - arrays.positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    check(Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)
      && Math.hypot(nx, ny, nz) > 0, 'GEOMETRY', 'Original triangle has zero area or unsafe geometry');
    for (const vertex of [a, b, c]) {
      referenced[vertex / 3] = 1;
      normals[vertex] += nx; normals[vertex + 1] += ny; normals[vertex + 2] += nz;
    }
  }
  for (let offset = 0; offset < normals.length; offset += 3) {
    check(referenced[offset / 3] === 1, 'GEOMETRY', 'Normal generation requires every vertex to be referenced');
    const length = Math.hypot(normals[offset], normals[offset + 1], normals[offset + 2]);
    check(Number.isFinite(length) && length > 0, 'GEOMETRY', 'Incident normal sum is zero, cancelling or nonfinite');
    for (let axis = 0; axis < 3; axis++) normals[offset + axis] = normals[offset + axis] / length || 0;
  }

  // One real provider checks original face agreement and derived Float32 admission.
  // It owns independent numerical copies and preserves its actual diagnostic causes.
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
    ...arrays, normals,
  });
  for (const array of Object.values(arrays)) Object.freeze(array);
  const source: TriangleNormalSourceV0 = Object.freeze({
    format: 'barocss-gpu-triangle-normal-source', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', ...arrays,
  });
  return Object.freeze({ source, normalMethod: 'area-weighted-original-triangle', prepared });
}
