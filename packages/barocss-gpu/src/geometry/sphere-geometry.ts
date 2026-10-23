import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildSphereAttributes } from './sphere-geometry-build-internal.js';

/** Original radius and sampling parameters for a generic Y-polar scene mesh. */
export interface SphereGeometrySourceV0 {
  format: 'barocss-gpu-sphere-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  radius: number;
  longitudeSegments: number;
  latitudeSegments: number;
}
export interface PreparedSphereGeometry {
  readonly source: SphereGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}
const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'radius', 'longitudeSegments', 'latitudeSegments'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}
function segmentCount(value: unknown, minimum: number, label: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), 'INPUT', label + ' requires a finite Number');
  requireValue(value <= 128, 'BUDGET', label + ' cannot exceed 128');
  requireValue(Number.isInteger(value) && value >= minimum,
    'GEOMETRY', label + ' requires an integer from ' + minimum + ' to 128');
  return value;
}

/** Sample a bounded sphere mesh with copied longitude seams and sector pole UVs. */
export function prepareSphereGeometry(input: unknown): PreparedSphereGeometry {
  const data = inspect('Sphere requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-sphere-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only sphere source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Sphere id must be an ASCII identifier of 1..64 characters');
  requireValue(typeof data.radius === 'number' && Number.isFinite(data.radius), 'INPUT', 'Sphere radius requires a finite Number');
  requireValue(data.radius > 0 && data.radius <= 1000, 'GEOMETRY', 'Sphere radius must satisfy 0 < radius <= 1000 scene units');
  const longitudeSegments = segmentCount(data.longitudeSegments, 3, 'Sphere longitude segments');
  const latitudeSegments = segmentCount(data.latitudeSegments, 2, 'Sphere latitude segments');
  const source: SphereGeometrySourceV0 = {
    format: 'barocss-gpu-sphere-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', radius: data.radius,
    longitudeSegments, latitudeSegments,
  };
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...buildSphereAttributes(source.radius, longitudeSegments, latitudeSegments),
  });
  Object.freeze(source);
  return Object.freeze({ source, prepared });
}
