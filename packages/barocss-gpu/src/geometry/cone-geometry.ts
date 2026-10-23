import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildConeAttributes } from './cone-geometry-build-internal.js';

/** Original dimensions and cell counts for an always-closed generic Y-axis cone. */
export interface ConeGeometrySourceV0 {
  format: 'barocss-gpu-cone-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  radius: number;
  height: number;
  radialSegments: number;
  heightSegments: number;
}
export interface PreparedConeGeometry {
  readonly source: ConeGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}
const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'radius', 'height', 'radialSegments', 'heightSegments'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}
function segments(value: unknown, minimum: number, label: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), 'INPUT', label + ' requires a finite Number');
  requireValue(value <= 128, 'BUDGET', label + ' cannot exceed 128');
  requireValue(Number.isInteger(value) && value >= minimum,
    'GEOMETRY', label + ' requires an integer from ' + minimum + ' to 128');
  return value;
}

/** Prepare tapered sides, split apex and flat bottom cap through the existing geometry admission. */
export function prepareConeGeometry(input: unknown): PreparedConeGeometry {
  const data = inspect('Cone requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-cone-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only cone source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Cone id must be an ASCII identifier of 1..64 characters');
  const radius = data.radius, height = data.height;
  requireValue(typeof radius === 'number' && Number.isFinite(radius)
    && typeof height === 'number' && Number.isFinite(height),
  'INPUT', 'Cone dimensions require finite Numbers');
  requireValue(radius > 0 && radius <= 1000 && height > 0 && height <= 2000,
    'GEOMETRY', 'Cone requires 0 < radius <= 1000 and 0 < height <= 2000 scene units');
  const length = Math.hypot(height, radius);
  requireValue(height * 0.5 > 0 && height / length > 0 && radius / length > 0,
    'GEOMETRY', 'Cone original half-height and slope components must remain positive');
  const radialSegments = segments(data.radialSegments, 3, 'Cone radial segments');
  const heightSegments = segments(data.heightSegments, 1, 'Cone height segments');
  const source: ConeGeometrySourceV0 = {
    format: 'barocss-gpu-cone-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', radius, height, radialSegments, heightSegments,
  };
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...buildConeAttributes(radius, height, radialSegments, heightSegments),
  });
  Object.freeze(source);
  return Object.freeze({ source, prepared });
}
