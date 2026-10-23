import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildCapsuleAttributes } from './capsule-geometry-build-internal.js';

/** Original positive-radius/positive-middle generic Y Capsule parameters. */
export interface CapsuleGeometrySourceV0 {
  format: 'barocss-gpu-capsule-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  radius: number;
  halfLength: number;
  radialSegments: number;
  bodySegments: number;
  capSegments: number;
}
export interface PreparedCapsuleGeometry {
  readonly source: CapsuleGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}
const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'radius', 'halfLength', 'radialSegments', 'bodySegments', 'capSegments'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', 'Capsule requires exact own plain parameter fields', cause); }
}
function segments(value: unknown, minimum: number, maximum: number, label: string): number {
  requireValue(typeof value === 'number' && Number.isFinite(value), 'INPUT', label + ' requires a finite Number');
  requireValue(value <= maximum, 'BUDGET', label + ' cannot exceed ' + maximum);
  requireValue(Number.isInteger(value) && value >= minimum, 'GEOMETRY', label + ' requires an integer from ' + minimum + ' to ' + maximum);
  return value;
}

/** Stage fixed sampled rings/poles, then use one existing generic geometry admission. */
export function prepareCapsuleGeometry(input: unknown): PreparedCapsuleGeometry {
  const data = inspect(() => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-capsule-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only Capsule source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Capsule id must be an ASCII identifier of 1..64 characters');
  const radius = data.radius, halfLength = data.halfLength;
  requireValue(typeof radius === 'number' && Number.isFinite(radius)
    && typeof halfLength === 'number' && Number.isFinite(halfLength),
  'INPUT', 'Capsule dimensions require finite Numbers');
  requireValue(radius > 0 && halfLength > 0 && radius + halfLength <= 1000
    && radius + halfLength > halfLength,
  'GEOMETRY', 'Capsule requires positive radius/middle with resolved original cap extent and radius+halfLength <= 1000');
  const radialSegments = segments(data.radialSegments, 3, 128, 'Capsule radial segments');
  const bodySegments = segments(data.bodySegments, 1, 128, 'Capsule body segments');
  const capSegments = segments(data.capSegments, 2, 64, 'Capsule cap segments');
  const source: CapsuleGeometrySourceV0 = {
    format: 'barocss-gpu-capsule-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', radius, halfLength,
    radialSegments, bodySegments, capSegments,
  };
  let attributes: ReturnType<typeof buildCapsuleAttributes>;
  try { attributes = buildCapsuleAttributes(radius, halfLength, radialSegments, bodySegments, capSegments); }
  catch (cause) { throw new TriangleGeometryError('GEOMETRY', 'Capsule original axial levels cannot be retained', cause); }
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...attributes,
  });
  const ringCount = bodySegments + 2 * capSegments - 1, stride = radialSegments + 1;
  const bottomPole = ringCount * stride, topPole = bottomPole + radialSegments;
  let previousY = prepared.positions[bottomPole * 3 + 1];
  for (let ring = 0; ring <= ringCount; ring++) {
    const nextY = prepared.positions[(ring < ringCount ? ring * stride : topPole) * 3 + 1];
    requireValue(nextY > previousY, 'REPRESENTATION', 'Capsule Float32 axial levels must remain strictly increasing');
    previousY = nextY;
  }
  Object.freeze(source);
  return Object.freeze({ source, prepared });
}
