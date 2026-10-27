import { ownRecord } from '../mesh/gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildRoundedBoxAttributes } from './rounded-box-geometry-build-internal.js';

/** Original generic dimensions/radius in scene units; no native CAD fillet claim. */
export interface RoundedBoxGeometrySourceV0 {
  format: 'barocss-gpu-rounded-box-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  sizeXYZ: [number, number, number];
  cornerRadius: number;
  segments: number;
}

/** Retained original parameters and independent sampled Number/F32/UV/U16 geometry. */
export interface PreparedRoundedBoxGeometry {
  readonly source: RoundedBoxGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}

const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit',
  'sizeXYZ', 'cornerRadius', 'segments'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}

/** Sample six faces, twelve quarter-cylinder edges and eight spherical octants. */
export function prepareRoundedBoxGeometry(input: unknown): PreparedRoundedBoxGeometry {
  const data = inspect('RoundedBox requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-rounded-box-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only RoundedBox source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'RoundedBox id must be an ASCII identifier of 1..64 characters');
  const size = data.sizeXYZ;
  requireValue(inspect('RoundedBox sizeXYZ requires a current-realm ordinary array',
    () => Array.isArray(size) && Object.getPrototypeOf(size) === Array.prototype),
  'INPUT', 'RoundedBox sizeXYZ requires a current-realm ordinary array');
  const length = inspect('RoundedBox sizeXYZ length cannot be read',
    () => Object.getOwnPropertyDescriptor(size, 'length'));
  requireValue(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0,
    'INPUT', 'RoundedBox sizeXYZ requires an own array length');
  requireValue(length.value <= 3, 'BUDGET', 'RoundedBox sizeXYZ exceeds three dimensions');
  requireValue(length.value === 3, 'GEOMETRY', 'RoundedBox sizeXYZ requires exactly three dimensions');
  const keys = inspect('RoundedBox sizeXYZ keys cannot be read', () => Reflect.ownKeys(size as object));
  requireValue(keys.length === 4 && keys.every(key => key === 'length' || key === '0' || key === '1' || key === '2'),
    'INPUT', 'RoundedBox sizeXYZ must be dense without extra keys');
  const dimensions: number[] = [];
  for (let index = 0; index < 3; index++) {
    const descriptor = inspect('RoundedBox sizeXYZ dimension cannot be read',
      () => Object.getOwnPropertyDescriptor(size, String(index)));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    'INPUT', 'RoundedBox dimensions require finite own numerical data');
    requireValue(descriptor.value > 0 && descriptor.value <= 2000,
      'GEOMETRY', 'RoundedBox dimensions must satisfy 0 < size <= 2000 scene units');
    dimensions.push(descriptor.value);
  }
  requireValue(typeof data.cornerRadius === 'number' && Number.isFinite(data.cornerRadius),
    'INPUT', 'RoundedBox cornerRadius requires a finite number');
  const cornerRadius = data.cornerRadius;
  const half = dimensions.map(value => value * .5);
  requireValue(half.every(value => value > 0) && cornerRadius > 0
    && cornerRadius < Math.min(...half),
  'GEOMETRY', 'RoundedBox requires positive represented half dimensions and 0 < radius < min half dimension');
  requireValue(half.every(value => {
    const core = value - cornerRadius;
    return core > 0 && core < value;
  }), 'GEOMETRY', 'RoundedBox original positive core and rounding extent must remain distinct on every axis');
  requireValue(typeof data.segments === 'number' && Number.isFinite(data.segments) && Number.isInteger(data.segments),
    'INPUT', 'RoundedBox segments requires a finite integer');
  requireValue(data.segments <= 64, 'BUDGET', 'RoundedBox segments exceeds 64');
  requireValue(data.segments >= 2, 'GEOMETRY', 'RoundedBox segments requires at least 2');
  const sizeXYZ = dimensions as [number, number, number];
  const source: RoundedBoxGeometrySourceV0 = {
    format: 'barocss-gpu-rounded-box-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXYZ,
    cornerRadius, segments: data.segments,
  };
  let attributes: ReturnType<typeof buildRoundedBoxAttributes>;
  try { attributes = buildRoundedBoxAttributes(sizeXYZ, source.cornerRadius, source.segments); }
  catch (cause) { throw new TriangleGeometryError('GEOMETRY', 'RoundedBox original sampled construction refused', cause); }
  // ONE public admission retains existing original and Float32 guards and causes.
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...attributes,
  });
  Object.freeze(sizeXYZ); Object.freeze(source);
  return Object.freeze({ source, prepared });
}
