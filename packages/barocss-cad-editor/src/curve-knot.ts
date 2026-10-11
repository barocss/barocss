import { insertSourceCurveKnot, validateSourceCurveKnotInsertion } from '@barocss/cad';
import type { SourceCurveKnotInsertionResult, Curve } from '@barocss/cad';

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

/** Refine the complete native Source0 asset; no standalone Curve or editor coefficient arithmetic. */
export function insertCurveKnotSource(source: string, original: Curve, knot: number): SourceCurveKnotInsertionResult {
  const result = insertSourceCurveKnot({ source, sourceVersion: 0, curveId: original.id,
    knot, maximumObservations: 128 });
  validateSourceCurveKnotInsertion(result);
  if (!sameBits(result.originalCurve, original))
    throw new RangeError('The source knot original Curve differs from the accepted native body.');
  return result;
}
