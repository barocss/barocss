import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import { snapshotExactSegmentPointsV1 } from './exact-segment-points-v1.js';

/** Restricted segment *classification*, not a point or trimmed-edge solver. */
export type ExactSegmentCrossingV1 =
  | { readonly status: 'classified'; readonly relation: 'proper-interior-crossing' | 'disjoint' | 'boundary-or-collinear'; readonly method: 'four-exact-binary64-orientations' }
  | { readonly status: 'unsupported'; readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' | 'degenerate-segment' };

/** Returns exact represented-coordinate proper crossing only. */
export function classifyExactSegmentCrossingV1(
  a: unknown, b: unknown, c: unknown, d: unknown,
  maxAbsCoordinateMM = 10000,
): ExactSegmentCrossingV1 {
  const admission = snapshotExactSegmentPointsV1(a, b, c, d, maxAbsCoordinateMM);
  if (admission.status === 'unsupported') return admission;
  const [pa, pb, pc, pd] = admission.points;

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
