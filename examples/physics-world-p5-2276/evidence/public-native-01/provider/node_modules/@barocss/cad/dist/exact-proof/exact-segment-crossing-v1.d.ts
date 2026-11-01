import type { AdmittedSegments } from './exact-segment-snapshot-internal.js';
/** Restricted segment *classification*, not a point or trimmed-edge solver. */
export type ExactSegmentCrossingV1 = {
    readonly status: 'classified';
    readonly relation: 'proper-interior-crossing' | 'disjoint' | 'boundary-or-collinear';
    readonly method: 'four-exact-binary64-orientations';
} | {
    readonly status: 'unsupported';
    readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' | 'degenerate-segment';
};
/** Returns exact represented-coordinate proper crossing only. */
export declare function classifyExactSegmentCrossingV1(a: unknown, b: unknown, c: unknown, d: unknown, maxAbsCoordinateMM?: number): ExactSegmentCrossingV1;
/** For sibling exact solvers only; accepts already admitted internal plain points. */
export declare function classifyAdmittedExactSegmentCrossingV1([pa, pb, pc, pd]: AdmittedSegments, maxAbsCoordinateMM: number): ExactSegmentCrossingV1;
