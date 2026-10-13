/**
 * Explicit numerical evidence for a bounded native planar orientation predicate.
 * This module does not modify existing geometry providers or authorize topology
 * decisions from approximate / visually sampled coordinates.
 */
export type OrientationSign = 'positive' | 'negative' | 'zero';
export type PredicateEvidence =
  | { readonly status: 'exact'; readonly sign: OrientationSign; readonly method: 'safe-integer-bigint' }
  | { readonly status: 'qualified'; readonly sign: Exclude<OrientationSign, 'zero'>; readonly method: 'bounded-float-det2'; readonly absoluteErrorBound: number; readonly determinant: number }
  | { readonly status: 'indeterminate'; readonly reason: 'within-error-bound' | 'overflow-risk' }
  | { readonly status: 'unsupported'; readonly reason: 'non-finite-coordinate' | 'out-of-range-coordinate' | 'invalid-input' };

export interface PlanarPoint { readonly x: number; readonly y: number }
export interface OrientationOptions {
  /** The largest accepted absolute coordinate in mm. */
  readonly maxAbsCoordinateMM: number;
  /** Additional caller-provided determinant uncertainty, in mm^2. */
  readonly determinantUncertaintyMM2: number;
}

const sign = (v: number | bigint): OrientationSign => v > 0 ? 'positive' : v < 0 ? 'negative' : 'zero';
const point = (v: unknown): v is PlanarPoint => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return false;
  const fields = Object.getOwnPropertyDescriptors(v);
  return Reflect.ownKeys(v).length === 2 &&
    Object.keys(fields).length === 2 &&
    ['x', 'y'].every(k => Object.hasOwn(fields, k) &&
      'value' in fields[k] && fields[k].enumerable &&
      typeof fields[k].value === 'number');
};

const admittedOptions = (v: unknown): OrientationOptions | null => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(v);
  const fields = ['maxAbsCoordinateMM', 'determinantUncertaintyMM2'];
  if (Reflect.ownKeys(v).length !== 2 || Object.keys(descriptors).length !== 2 ||
      !fields.every(k => Object.hasOwn(descriptors, k) &&
        'value' in descriptors[k] && descriptors[k].enumerable &&
        typeof descriptors[k].value === 'number')) return null;
  const maxAbsCoordinateMM = descriptors.maxAbsCoordinateMM.value as number;
  const determinantUncertaintyMM2 = descriptors.determinantUncertaintyMM2.value as number;
  if (!Number.isFinite(maxAbsCoordinateMM) || maxAbsCoordinateMM <= 0 ||
      !Number.isFinite(determinantUncertaintyMM2) || determinantUncertaintyMM2 < 0) return null;
  return { maxAbsCoordinateMM, determinantUncertaintyMM2 };
};

/**
 * Returns a sign only when an integer determinant is exact or when a
 * conservative floating-point bound excludes zero. Never snaps to zero.
 */
export function orient2dQualified(
  a: unknown, b: unknown, c: unknown,
  options: OrientationOptions = { maxAbsCoordinateMM: 10000, determinantUncertaintyMM2: 0 },
): PredicateEvidence {
  if (!point(a) || !point(b) || !point(c))
    return { status: 'unsupported', reason: 'invalid-input' };
  const admitted = admittedOptions(options);
  if (!admitted) return { status: 'unsupported', reason: 'invalid-input' };
  const v = [a.x, a.y, b.x, b.y, c.x, c.y];
  if (!v.every(Number.isFinite)) return { status: 'unsupported', reason: 'non-finite-coordinate' };
  if (v.some(x => Math.abs(x) > admitted.maxAbsCoordinateMM))
    return { status: 'unsupported', reason: 'out-of-range-coordinate' };

  if (v.every(Number.isSafeInteger)) {
    const ax = BigInt(a.x), ay = BigInt(a.y), bx = BigInt(b.x), by = BigInt(b.y), cx = BigInt(c.x), cy = BigInt(c.y);
    const det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    // Exact arithmetic does not eliminate uncertainty declared by the caller.
    // This threshold is an input uncertainty bound in mm², not rounding error.
    if (admitted.determinantUncertaintyMM2 > 0) {
      const threshold = admitted.determinantUncertaintyMM2;
      if (Math.abs(Number(det)) <= threshold)
        return { status: 'indeterminate', reason: 'within-error-bound' };
    }
    return { status: 'exact', sign: sign(det), method: 'safe-integer-bigint' };
  }

  const x1 = b.x - a.x, y1 = b.y - a.y, x2 = c.x - a.x, y2 = c.y - a.y;
  const p = x1 * y2, q = y1 * x2, det = p - q;
  if (![x1, y1, x2, y2, p, q, det].every(Number.isFinite))
    return { status: 'indeterminate', reason: 'overflow-risk' };
  // A deliberately conservative bound for two subtractions, two products,
  // determinant subtraction and cancellation. Not an exact-arithmetic proof.
  const epsilon = Number.EPSILON;
  const magnitude = Math.abs(p) + Math.abs(q) +
    (Math.abs(x1) + Math.abs(y1) + Math.abs(x2) + Math.abs(y2)) * epsilon;
  const bound = 32 * epsilon * magnitude + admitted.determinantUncertaintyMM2;
  if (!Number.isFinite(bound)) return { status: 'indeterminate', reason: 'overflow-risk' };
  if (Math.abs(det) <= bound) return { status: 'indeterminate', reason: 'within-error-bound' };
  return { status: 'qualified', sign: sign(det) as Exclude<OrientationSign, 'zero'>,
    method: 'bounded-float-det2', absoluteErrorBound: bound, determinant: det };
}
