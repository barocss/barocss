import { BarocssError } from '../core/barocss-error.js';
import { ownRecord } from '../mesh/gpu-data.js';
import { validateMeshGeometry } from '../mesh/mesh-packet.js';
import type { Vec3 } from '../scene/scene-types.js';

export const TriangleGeometryDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', VERSION: 'VERSION', BUDGET: 'BUDGET',
  GEOMETRY: 'GEOMETRY', REPRESENTATION: 'REPRESENTATION',
} as const);
export type TriangleGeometryDiagnosticCode =
  typeof TriangleGeometryDiagnosticCode[keyof typeof TriangleGeometryDiagnosticCode];

export class TriangleGeometryError extends BarocssError {
  readonly code: TriangleGeometryDiagnosticCode;
  constructor(code: TriangleGeometryDiagnosticCode, detail: string, cause?: unknown) {
    super(code, 'Triangle geometry: ' + detail,
      cause === undefined ? { maxLength: 1024 } : { cause, maxLength: 1024 });
    this.name = 'TriangleGeometryError';
    this.code = code;
  }
}

/** Original authored attributes; positions use scene units and UVs are dimensionless. */
export interface TriangleGeometryV0 {
  format: 'barocss-gpu-triangle-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  winding: 'ccw';
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
}

/** Frozen original data and metadata, with separately owned mutable execution buffers. */
export interface PreparedTriangleGeometry {
  readonly geometry: TriangleGeometryV0;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
  readonly indexType: 'uint16' | 'uint32';
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  readonly bufferBytes: number;
}

const CODE = TriangleGeometryDiagnosticCode;
const MAX_VERTICES = 131072;
const MAX_TRIANGLES = 131072;
const MAX_NUMERIC_VALUES = 1441792;
const MAX_BUFFER_BYTES = 5767168;
const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'winding', 'positions', 'normals', 'uvs', 'indices'] as const;

function check(condition: unknown, code: TriangleGeometryDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new TriangleGeometryError(code, detail);
}
function guarded<T>(code: TriangleGeometryDiagnosticCode, detail: string, action: () => T): T {
  try { return action(); }
  catch (cause) {
    if (cause instanceof TriangleGeometryError) throw cause;
    throw new TriangleGeometryError(code, detail, cause);
  }
}

// All four array lengths and the aggregate ceiling are admitted before array
// key enumeration, owned numerical copies, or typed-buffer allocation.
function arrayLength(input: unknown, maximum: number, label: string): number {
  check(Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype,
    CODE.INPUT, label + ' must be a plain array');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  check(descriptor && 'value' in descriptor && Number.isInteger(descriptor.value)
    && descriptor.value >= 0, CODE.INPUT, label + ' requires an own array length');
  const length = descriptor.value as number;
  check(length <= maximum, CODE.BUDGET, label + ' exceeds the source cardinality limit');
  return length;
}
function copyNumbers(input: unknown, length: number, label: string): number[] {
  const source = input as number[], keys = Reflect.ownKeys(source);
  check(keys.length === length + 1, CODE.INPUT,
    label + ' must be dense without additional fields or symbols');
  for (const key of keys) {
    if (key === 'length') continue;
    check(typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)
      && Number(key) < length, CODE.INPUT, label + ' has unsupported array keys');
  }
  const result = new Array<number>(length);
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(source, String(index));
    check(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    CODE.INPUT, label + '[' + index + '] must be finite own numeric data');
    result[index] = descriptor.value;
  }
  return result;
}
function requireFloat32(values: number[], label: string): void {
  for (let index = 0; index < values.length; index++) {
    const value = values[index], converted = Math.fround(value);
    check(Number.isFinite(converted) && (value === 0 || converted !== 0),
      CODE.REPRESENTATION, label + '[' + index + '] loses nonzero finite Float32 representation');
  }
}

/** Pure, bounded generic geometry preparation. No native CAD identity or WebGL state. */
export function prepareTriangleGeometry(input: unknown): PreparedTriangleGeometry {
  const data = guarded(CODE.INPUT, 'Exact plain authored data fields are required',
    () => ownRecord(input, FIELDS));
  check(data.format === 'barocss-gpu-triangle-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene'
    && data.winding === 'ccw', CODE.VERSION,
  'Only triangle geometry0/right-handed-y-up/scene/ccw metadata is supported');
  check(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    CODE.INPUT, 'id must be an ASCII identifier of 1..64 characters');

  const lengths = guarded(CODE.INPUT, 'Bounded plain attribute arrays are required', () => ({
    positions: arrayLength(data.positions, MAX_VERTICES * 3, 'positions'),
    normals: arrayLength(data.normals, MAX_VERTICES * 3, 'normals'),
    uvs: arrayLength(data.uvs, MAX_VERTICES * 2, 'uvs'),
    indices: arrayLength(data.indices, MAX_TRIANGLES * 3, 'indices'),
  }));
  const numericValues = lengths.positions + lengths.normals + lengths.uvs + lengths.indices;
  check(numericValues <= MAX_NUMERIC_VALUES, CODE.BUDGET, 'Aggregate numeric source limit exceeded');
  check(lengths.positions >= 9 && lengths.positions % 3 === 0,
    CODE.GEOMETRY, 'positions require 3..131072 complete XYZ vertices');
  const vertexCount = lengths.positions / 3;
  check(lengths.normals === lengths.positions && lengths.uvs === vertexCount * 2,
    CODE.GEOMETRY, 'Normals and UV counts must match all positions');
  check(lengths.indices >= 3 && lengths.indices % 3 === 0,
    CODE.GEOMETRY, 'indices require 1..131072 complete triangles');
  const triangleCount = lengths.indices / 3;

  const arrays = guarded(CODE.INPUT, 'Dense finite own numerical attributes are required', () => ({
    positions: copyNumbers(data.positions, lengths.positions, 'positions'),
    normals: copyNumbers(data.normals, lengths.normals, 'normals'),
    uvs: copyNumbers(data.uvs, lengths.uvs, 'uvs'),
    indices: copyNumbers(data.indices, lengths.indices, 'indices'),
  }));
  check(arrays.positions.every(n => Math.abs(n) <= 1000), CODE.GEOMETRY,
    'Original positions must remain within 1000 scene units');
  check(arrays.uvs.every(n => Math.abs(n) <= 1000), CODE.GEOMETRY,
    'Original UV values must remain within 1000');
  for (let index = 0; index < lengths.normals; index += 3) {
    const length = Math.hypot(arrays.normals[index], arrays.normals[index + 1], arrays.normals[index + 2]);
    check(Number.isFinite(length) && Math.abs(length - 1) <= 1e-6,
      CODE.GEOMETRY, 'Original normals must have unit length within 1e-6');
  }
  let maximumIndex = 0;
  for (const index of arrays.indices) {
    check(Number.isInteger(index) && index >= 0 && index < vertexCount,
      CODE.GEOMETRY, 'Original indices must address an existing vertex');
    maximumIndex = Math.max(maximumIndex, index);
  }
  guarded(CODE.GEOMETRY, 'Original triangle geometry refused',
    () => validateMeshGeometry(arrays.positions, arrays.normals, arrays.indices, 'Original triangle geometry'));
  requireFloat32(arrays.positions, 'positions');
  requireFloat32(arrays.normals, 'normals');
  requireFloat32(arrays.uvs, 'uvs');
  const indexType = maximumIndex <= 65535 ? 'uint16' : 'uint32';
  const bufferBytes = (lengths.positions + lengths.normals + lengths.uvs) * 4
    + lengths.indices * (indexType === 'uint16' ? 2 : 4);
  check(bufferBytes <= MAX_BUFFER_BYTES, CODE.BUDGET, 'Derived buffer byte limit exceeded');

  const minimum: [number, number, number] = [Infinity, Infinity, Infinity], maximum: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < lengths.positions; index++) {
    const axis = index % 3, value = arrays.positions[index];
    minimum[axis] = Math.min(minimum[axis], value);
    maximum[axis] = Math.max(maximum[axis], value);
  }
  const positions = Float32Array.from(arrays.positions), normals = Float32Array.from(arrays.normals);
  const uvs = Float32Array.from(arrays.uvs);
  const indices = indexType === 'uint16' ? Uint16Array.from(arrays.indices) : Uint32Array.from(arrays.indices);
  guarded(CODE.REPRESENTATION, 'Derived Float32 triangle geometry refused',
    () => validateMeshGeometry(positions, normals, indices, 'Float32 triangle geometry'));

  for (const array of Object.values(arrays)) Object.freeze(array);
  const geometry: TriangleGeometryV0 = Object.freeze({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw', ...arrays,
  });
  Object.freeze(minimum); Object.freeze(maximum);
  const bounds = Object.freeze({ min: minimum, max: maximum });
  // Do not recursively freeze typed arrays: their elements are caller-owned mutable data.
  return Object.freeze({ geometry, positions, normals, uvs, indices, indexType,
    vertexCount, triangleCount, bounds, bufferBytes });
}
