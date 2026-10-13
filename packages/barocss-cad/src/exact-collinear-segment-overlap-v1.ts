import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import { classifyExactSegmentCrossingV1 } from './exact-segment-crossing-v1.js';
import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';
type Relation = 'disjoint' | 'single-point-touch' | 'positive-length-overlap';
export type ExactCollinearSegmentOverlapV1 =
  | { readonly status: 'exact'; readonly relation: Relation; readonly overlapMM: readonly [Binary64PointV1, Binary64PointV1] | null }
  | { readonly status: 'refused'; readonly reason: 'not-collinear' }
  | { readonly status: 'unsupported'; readonly reason: string };

/** Classifies only collinear represented binary64 line segments; returned points are original endpoints. */
export function classifyCollinearSegmentOverlapV1(a: unknown, b: unknown, c: unknown, d: unknown, maxAbsCoordinateMM = 10000): ExactCollinearSegmentOverlapV1 {
  const admission = classifyExactSegmentCrossingV1(a, b, c, d, maxAbsCoordinateMM);
  if (admission.status === 'unsupported') return { status: 'unsupported', reason: admission.reason };
  const [pa, pb, pc, pd] = [a, b, c, d] as Binary64PointV1[];
  const first = orient2dExactBinary64V1(pa, pb, pc, maxAbsCoordinateMM);
  const second = orient2dExactBinary64V1(pa, pb, pd, maxAbsCoordinateMM);
  if (first.status !== 'exact' || second.status !== 'exact')
    return { status: 'unsupported', reason: 'orientation-refused' };
  if (first.sign !== 'zero' || second.sign !== 'zero')
    return { status: 'refused', reason: 'not-collinear' };
  const axis: 'x' | 'y' = pa.x !== pb.x ? 'x' : 'y';
  const sortedAB = pa[axis] <= pb[axis] ? [pa, pb] : [pb, pa];
  const sortedCD = pc[axis] <= pd[axis] ? [pc, pd] : [pd, pc];
  const start = sortedAB[0][axis] >= sortedCD[0][axis] ? sortedAB[0] : sortedCD[0];
  const end = sortedAB[1][axis] <= sortedCD[1][axis] ? sortedAB[1] : sortedCD[1];
  if (start[axis] > end[axis]) return { status: 'exact', relation: 'disjoint', overlapMM: null };
  const copy = (p: Binary64PointV1) => Object.freeze({ x: p.x, y: p.y });
  return { status: 'exact', relation: start[axis] === end[axis] ? 'single-point-touch' : 'positive-length-overlap',
    overlapMM: Object.freeze([copy(start), copy(end)]) };
}
