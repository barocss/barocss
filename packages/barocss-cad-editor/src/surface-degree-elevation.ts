import { elevateSourceSurfaceAxisDegree, validateSourceSurfaceAxisDegreeElevation } from '@barocss/cad';
import type { SourceSurfaceDegreeElevationResult, Surface } from '@barocss/cad';
import type { CadEditorSurfaceDegreeElevationAxis } from './types.js';

function sameBits(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((value, index) => sameBits(value, right[index]));
  if (left !== null && right !== null && typeof left === 'object' && typeof right === 'object') {
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    return Object.keys(a).length === Object.keys(b).length
      && Object.keys(a).every(key => Object.hasOwn(b, key) && sameBits(a[key], b[key]));
  }
  return Object.is(left, right);
}

/** The native full-source result is authority for the same original asset. */
export function elevateSurfaceDegreeSource(source: string, original: Surface,
  axis: CadEditorSurfaceDegreeElevationAxis): SourceSurfaceDegreeElevationResult {
  const targetDegree = (axis === 'u' ? original.degreeU : original.degreeV) + 1;
  // The public request type lists supported targets2..5. Pass the computed value
  // through its runtime gate so degree5→6 retains the actual native TARGET cause.
  const result: SourceSurfaceDegreeElevationResult = Reflect.apply(elevateSourceSurfaceAxisDegree, undefined,
    [{ source, sourceVersion: 0, surfaceId: original.id, axis, targetDegree, maximumObservations: 1024 }]);
  validateSourceSurfaceAxisDegreeElevation(result);
  if (!sameBits(result.originalSurface, original))
    throw new RangeError('The source degree-elevation original Surface differs from the accepted native body.');
  return result;
}
