import { extractSourceCurveInterval, validateSourceCurveIntervalExtraction } from '@barocss/cad';
import type { Curve, SourceCurveIntervalExtractionResult } from '@barocss/cad';

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

/** Complete-source native restriction; never emit or splice a standalone Curve in the editor. */
export function extractCurveIntervalSource(source: string, original: Curve,
  interval: [number, number]): SourceCurveIntervalExtractionResult {
  const result = extractSourceCurveInterval({ source, sourceVersion: 0, curveId: original.id,
    interval, maximumObservations: 256 });
  validateSourceCurveIntervalExtraction(result);
  if (!sameBits(result.originalCurve, original))
    throw new RangeError('The source interval original Curve differs from the accepted native body.');
  return result;
}
