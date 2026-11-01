import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';
export type SegmentInputFailure = 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate' | 'degenerate-segment';
export type AdmittedSegments = readonly [Binary64PointV1, Binary64PointV1, Binary64PointV1, Binary64PointV1];
export type SegmentAdmission = {
    readonly points: AdmittedSegments;
    readonly reason?: never;
} | {
    readonly points?: never;
    readonly reason: SegmentInputFailure;
};
/** Internal, descriptor-only snapshot. External point property gets are never performed. */
export declare function snapshotExactSegments(a: unknown, b: unknown, c: unknown, d: unknown, maxAbsCoordinateMM: number): SegmentAdmission;
