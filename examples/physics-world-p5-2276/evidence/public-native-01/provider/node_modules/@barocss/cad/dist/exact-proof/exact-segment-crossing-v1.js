import { orient2dExactBinary64V1 } from './exact-binary64-orientation-v1.js';
import { snapshotExactSegments } from './exact-segment-snapshot-internal.js';
/** Returns exact represented-coordinate proper crossing only. */
export function classifyExactSegmentCrossingV1(a, b, c, d, maxAbsCoordinateMM = 10000) {
    const admitted = snapshotExactSegments(a, b, c, d, maxAbsCoordinateMM);
    if (admitted.reason)
        return { status: 'unsupported', reason: admitted.reason };
    return classifyAdmittedExactSegmentCrossingV1(admitted.points, maxAbsCoordinateMM);
}
/** For sibling exact solvers only; accepts already admitted internal plain points. */
export function classifyAdmittedExactSegmentCrossingV1([pa, pb, pc, pd], maxAbsCoordinateMM) {
    const abC = orient2dExactBinary64V1(pa, pb, pc, maxAbsCoordinateMM), abD = orient2dExactBinary64V1(pa, pb, pd, maxAbsCoordinateMM);
    const cdA = orient2dExactBinary64V1(pc, pd, pa, maxAbsCoordinateMM), cdB = orient2dExactBinary64V1(pc, pd, pb, maxAbsCoordinateMM);
    if ([abC, abD, cdA, cdB].some(x => x.status !== 'exact'))
        return { status: 'unsupported', reason: 'invalid-input' };
    const signs = [abC, abD, cdA, cdB].map(x => x.status === 'exact' ? x.sign : 'zero');
    if (signs.includes('zero'))
        return { status: 'classified', relation: 'boundary-or-collinear', method: 'four-exact-binary64-orientations' };
    const opposite = (x, y) => x !== y;
    return { status: 'classified',
        relation: opposite(signs[0], signs[1]) && opposite(signs[2], signs[3])
            ? 'proper-interior-crossing' : 'disjoint',
        method: 'four-exact-binary64-orientations' };
}
