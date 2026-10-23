import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildPlaneAttributes } from './plane-geometry-build-internal.js';

/** Original scene-unit dimensions and dimensionless cell counts, separate from execution data. */
export interface PlaneGeometrySourceV0 {
  format: 'barocss-gpu-plane-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  sizeXY: [number, number];
  segmentsXY: [number, number];
}

export interface PreparedPlaneGeometry {
  readonly source: PlaneGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}

const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'sizeXY', 'segmentsXY'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}

function copyPair(input: unknown, label: string): [number, number] {
  requireValue(inspect(label + ' requires a current-realm ordinary array',
    () => Array.isArray(input) && Object.getPrototypeOf(input) === Array.prototype),
  'INPUT', label + ' requires a current-realm ordinary array');
  const length = inspect(label + ' length cannot be read', () => Object.getOwnPropertyDescriptor(input, 'length'));
  requireValue(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0,
    'INPUT', label + ' requires an own array length');
  requireValue(length.value <= 2, 'BUDGET', label + ' exceeds two components');
  requireValue(length.value === 2, 'GEOMETRY', label + ' requires exactly two components');
  const keys = inspect(label + ' keys cannot be read', () => Reflect.ownKeys(input as object));
  requireValue(keys.length === 3 && keys.every(key => key === 'length' || key === '0' || key === '1'),
    'INPUT', label + ' must be dense without extra fields');
  const values: number[] = [];
  for (let index = 0; index < 2; index++) {
    const descriptor = inspect(label + ' component cannot be read',
      () => Object.getOwnPropertyDescriptor(input, String(index)));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    'INPUT', label + ' requires finite own numerical data');
    values.push(descriptor.value);
  }
  return values as [number, number];
}

/** Prepare a bounded origin-centred XY lattice with +Z normals and CCW triangles. */
export function preparePlaneGeometry(input: unknown): PreparedPlaneGeometry {
  const data = inspect('Plane requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-plane-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only plane source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Plane id must be an ASCII identifier of 1..64 characters');
  const sizeXY = copyPair(data.sizeXY, 'Plane sizeXY');
  const segmentsXY = copyPair(data.segmentsXY, 'Plane segmentsXY');
  for (const size of sizeXY) requireValue(size > 0 && size <= 2000,
    'GEOMETRY', 'Plane dimensions must satisfy 0 < size <= 2000 scene units');
  for (const count of segmentsXY) {
    requireValue(count <= 128, 'BUDGET', 'Plane cell counts cannot exceed 128 per axis');
    requireValue(Number.isInteger(count) && count >= 1,
      'GEOMETRY', 'Plane cell counts must be integers from 1 to 128');
  }
  const source: PlaneGeometrySourceV0 = {
    format: 'barocss-gpu-plane-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXY, segmentsXY,
  };
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...buildPlaneAttributes(sizeXY, segmentsXY),
  });
  Object.freeze(sizeXY); Object.freeze(segmentsXY); Object.freeze(source);
  return Object.freeze({ source, prepared });
}
