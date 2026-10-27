import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildTorusAttributes } from './torus-geometry-build-internal.js';

/** Original scene-unit radii and dimensionless periodic mesh subdivisions. */
export interface TorusGeometrySourceV0 {
  format: 'barocss-gpu-torus-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  majorRadius: number;
  minorRadius: number;
  majorSegments: number;
  minorSegments: number;
}
export interface PreparedTorusGeometry {
  readonly source: TorusGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}
const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'majorRadius', 'minorRadius', 'majorSegments', 'minorSegments'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}
function segmentCount(value: unknown, label: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), 'INPUT', label + ' requires a finite Number');
  requireValue(value <= 128, 'BUDGET', label + ' cannot exceed 128');
  requireValue(Number.isInteger(value) && value >= 3, 'GEOMETRY', label + ' requires an integer from 3 to 128');
  return value;
}

/** Prepare a sampled Y-axis ring with copied periodic seams and outward CCW triangles. */
export function prepareTorusGeometry(input: unknown): PreparedTorusGeometry {
  const data = inspect('Torus requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-torus-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only torus source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Torus id must be an ASCII identifier of 1..64 characters');
  const majorRadius = data.majorRadius, minorRadius = data.minorRadius;
  requireValue(typeof majorRadius === 'number' && Number.isFinite(majorRadius)
    && typeof minorRadius === 'number' && Number.isFinite(minorRadius),
  'INPUT', 'Torus radii require finite Numbers');
  requireValue(minorRadius > 0 && minorRadius < majorRadius && majorRadius + minorRadius <= 1000,
    'GEOMETRY', 'Torus radii require 0 < minor < major and major + minor <= 1000 scene units');
  const majorSegments = segmentCount(data.majorSegments, 'Torus major segments');
  const minorSegments = segmentCount(data.minorSegments, 'Torus minor segments');
  const source: TorusGeometrySourceV0 = {
    format: 'barocss-gpu-torus-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene',
    majorRadius, minorRadius, majorSegments, minorSegments,
  };
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...buildTorusAttributes(majorRadius, minorRadius, majorSegments, minorSegments),
  });
  Object.freeze(source);
  return Object.freeze({ source, prepared });
}
