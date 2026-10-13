import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';

/** Restricted segment *classification*, not a point or trimmed-edge solver. */
export type ExactSegmentCrossingV1 =
  | { readonly status: 'classified'; readonly relation: 'proper-interior-crossing' | 'disjoint' | 'boundary-or-collinear'; readonly method: 'four-exact-binary64-orientations' }
  | { readonly status: 'unsupported'; readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' | 'degenerate-segment' };

function ownPoint(value: unknown): value is Binary64PointV1 {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const keys = Reflect.ownKeys(value), d = Object.getOwnPropertyDescriptors(value);
  return keys.length === 2 && ['x', 'y'].every(k => Object.hasOwn(d, k) &&
    'value' in d[k] && d[k].enumerable && typeof d[k].value === 'number');
}

/** Returns exact represented-coordinate proper crossing only. */
export function classifyExactSegmentCrossingV1(
  a: unknown, b: unknown, c: unknown, d: unknown,
  maxAbsCoordinateMM = 10000,
): ExactSegmentCrossingV1 {
  if (![a, b, c, d].every(ownPoint) ||
      typeof maxAbsCoordinateMM !== 'number' || !Number.isFinite(maxAbsCoordinateMM) ||
      maxAbsCoordinateMM <= 0 || maxAbsCoordinateMM > 10000)
    return { status: 'unsupported', reason: 'invalid-input' };
  const points = [a, b, c, d] as Binary64PointV1[];
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return { status: 'unsupported', reason: 'non-finite-coordinate' };
  if (points.some(p => Math.abs(p.x) > maxAbsCoordinateMM || Math.abs(p.y) > maxAbsCoordinateMM))
    return { status: 'unsupported', reason: 'out-of-range-coordinate' };
  const [pa, pb, pc, pd] = points;
  if (pa.x === pb.x && pa.y === pb.y ||
      pc.x === pd.x && pc.y === pd.y)
    return { status: 'unsupported', reason: 'degenerate-segment' };

  const abC = orient2dExactBinary64V1(pa, pb, pc), abD = orient2dExactBinary64V1(pa, pb, pd);
  const cdA = orient2dExactBinary64V1(pc, pd, pa), cdB = orient2dExactBinary64V1(pc, pd, pb);
  if ([abC, abD, cdA, cdB].some(x => x.status !== 'exact'))
    return { status: 'unsupported', reason: 'invalid-input' };
  const signs = [abC, abD, cdA, cdB].map(x => x.status === 'exact' ? x.sign : 'zero');
  if (signs.includes('zero'))
    return { status: 'classified', relation: 'boundary-or-collinear', method: 'four-exact-binary64-orientations' };
  const opposite = (x: string, y: string) => x !== y;
  return { status: 'classified',
    relation: opposite(signs[0], signs[1]) && opposite(signs[2], signs[3])
      ? 'proper-interior-crossing' : 'disjoint',
    method: 'four-exact-binary64-orientations' };
}
