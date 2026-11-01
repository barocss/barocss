import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import { classifyAdmittedExactSegmentCrossingV1 } from './exact-segment-crossing-v1.js';
import { snapshotExactSegments } from './exact-segment-snapshot-internal.js';
/** Classifies only collinear represented binary64 line segments; returned points are original endpoints. */
export function classifyCollinearSegmentOverlapV1(a, b, c, d, maxAbsCoordinateMM = 10000) {
    const snapshot = snapshotExactSegments(a, b, c, d, maxAbsCoordinateMM);
    if (snapshot.reason)
        return { status: 'unsupported', reason: snapshot.reason };
    const admission = classifyAdmittedExactSegmentCrossingV1(snapshot.points, maxAbsCoordinateMM);
    if (admission.status === 'unsupported')
        return { status: 'unsupported', reason: admission.reason };
    const [pa, pb, pc, pd] = snapshot.points;
    const first = orient2dExactBinary64V1(pa, pb, pc, maxAbsCoordinateMM);
    const second = orient2dExactBinary64V1(pa, pb, pd, maxAbsCoordinateMM);
    if (first.status !== 'exact' || second.status !== 'exact')
        return { status: 'unsupported', reason: 'orientation-refused' };
    if (first.sign !== 'zero' || second.sign !== 'zero')
        return { status: 'refused', reason: 'not-collinear' };
    const axis = pa.x !== pb.x ? 'x' : 'y';
    const sortedAB = pa[axis] <= pb[axis] ? [pa, pb] : [pb, pa];
    const sortedCD = pc[axis] <= pd[axis] ? [pc, pd] : [pd, pc];
    const start = sortedAB[0][axis] >= sortedCD[0][axis] ? sortedAB[0] : sortedCD[0];
    const end = sortedAB[1][axis] <= sortedCD[1][axis] ? sortedAB[1] : sortedCD[1];
    if (start[axis] > end[axis])
        return { status: 'exact', relation: 'disjoint', overlapMM: null };
    const copy = (p) => Object.freeze({ x: p.x, y: p.y });
    return { status: 'exact', relation: start[axis] === end[axis] ? 'single-point-touch' : 'positive-length-overlap',
        overlapMM: Object.freeze([copy(start), copy(end)]) };
}
