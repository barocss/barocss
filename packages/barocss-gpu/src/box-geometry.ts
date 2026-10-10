import { ownRecord } from './gpu-data.js';
import { prepareTriangleGeometry, TriangleGeometryError } from './triangle-geometry.js';
import type { PreparedTriangleGeometry, TriangleGeometryDiagnosticCode } from './triangle-geometry.js';
import { buildBoxAttributes } from './box-geometry-build-internal.js';

/** Original generic Box dimensions. These are scene units, not native CAD data. */
export interface BoxGeometrySourceV0 {
  format: 'barocss-gpu-box-geometry';
  version: 0;
  id: string;
  coordinateSystem: 'right-handed-y-up';
  positionUnit: 'scene';
  sizeXYZ: [number, number, number];
}

/** Original parameter authority and separately prepared flat-face execution geometry. */
export interface PreparedBoxGeometry {
  readonly source: BoxGeometrySourceV0;
  readonly prepared: PreparedTriangleGeometry;
}

const FIELDS = ['format', 'version', 'id', 'coordinateSystem', 'positionUnit', 'sizeXYZ'] as const;
function requireValue(value: unknown, code: TriangleGeometryDiagnosticCode, message: string): asserts value {
  if (!value) throw new TriangleGeometryError(code, message);
}
function inspect<T>(label: string, read: () => T): T {
  try { return read(); }
  catch (cause) { throw new TriangleGeometryError('INPUT', label, cause); }
}

/** Generate an origin-centred indexed Box with six flat faces and separate UV seams. */
export function prepareBoxGeometry(input: unknown): PreparedBoxGeometry {
  const data = inspect('Box requires exact own plain parameter fields', () => ownRecord(input, FIELDS));
  requireValue(data.format === 'barocss-gpu-box-geometry' && data.version === 0
    && data.coordinateSystem === 'right-handed-y-up' && data.positionUnit === 'scene',
  'VERSION', 'Only box source0/right-handed-y-up/scene metadata is supported');
  requireValue(typeof data.id === 'string' && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(data.id),
    'INPUT', 'Box id must be an ASCII identifier of 1..64 characters');
  const size = data.sizeXYZ;
  requireValue(inspect('Box sizeXYZ requires a current-realm ordinary array',
    () => Array.isArray(size) && Object.getPrototypeOf(size) === Array.prototype),
  'INPUT', 'Box sizeXYZ requires a current-realm ordinary array');
  const length = inspect('Box sizeXYZ length cannot be read', () => Object.getOwnPropertyDescriptor(size, 'length'));
  requireValue(length && 'value' in length && Number.isInteger(length.value) && length.value >= 0,
    'INPUT', 'Box sizeXYZ requires an own array length');
  requireValue(length.value <= 3, 'BUDGET', 'Box sizeXYZ exceeds three dimensions');
  requireValue(length.value === 3, 'GEOMETRY', 'Box sizeXYZ requires exactly three dimensions');
  const keys = inspect('Box sizeXYZ keys cannot be read', () => Reflect.ownKeys(size as object));
  requireValue(keys.length === 4 && keys.every(key => key === 'length' || key === '0' || key === '1' || key === '2'),
    'INPUT', 'Box sizeXYZ must be dense without extra keys');
  const dimensions: number[] = [];
  for (let index = 0; index < 3; index++) {
    const descriptor = inspect('Box sizeXYZ dimension cannot be read',
      () => Object.getOwnPropertyDescriptor(size, String(index)));
    requireValue(descriptor && 'value' in descriptor && descriptor.enumerable
      && typeof descriptor.value === 'number' && Number.isFinite(descriptor.value),
    'INPUT', 'Box dimensions require finite own numerical data');
    requireValue(descriptor.value > 0 && descriptor.value <= 2000,
      'GEOMETRY', 'Box dimensions must satisfy 0 < size <= 2000 scene units');
    dimensions.push(descriptor.value);
  }
  const sizeXYZ = dimensions as [number, number, number];
  const source: BoxGeometrySourceV0 = {
    format: 'barocss-gpu-box-geometry', version: 0, id: data.id,
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', sizeXYZ,
  };
  // The existing public geometry preparer retains all original/F32 validation and diagnostics.
  const prepared = prepareTriangleGeometry({
    format: 'barocss-gpu-triangle-geometry', version: 0, id: source.id,
    coordinateSystem: source.coordinateSystem, positionUnit: source.positionUnit, winding: 'ccw',
    ...buildBoxAttributes(sizeXYZ),
  });
  Object.freeze(sizeXYZ); Object.freeze(source);
  return Object.freeze({ source, prepared });
}
