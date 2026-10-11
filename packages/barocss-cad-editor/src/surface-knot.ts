import { insertSourceSurfaceKnot, validateSourceSurfaceKnotInsertion } from '@barocss/cad';
import type { SourceSurfaceKnotInsertionResult, Surface } from '@barocss/cad';

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

/** Refine the complete native Source0 asset; no standalone Surface or editor coefficient arithmetic. */
export function insertSurfaceKnotSource(source: string, original: Surface,
  axis: 'u' | 'v', knot: number): SourceSurfaceKnotInsertionResult {
  const result = insertSourceSurfaceKnot({ source, sourceVersion: 0, surfaceId: original.id,
    axis, knot, maximumObservations: 1024 });
  validateSourceSurfaceKnotInsertion(result);
  if (!sameBits(result.originalSurface, original))
    throw new RangeError('The source knot original Surface differs from the accepted native body.');
  return result;
}
