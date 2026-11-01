/**
 * Explicit numerical evidence for a bounded native planar orientation predicate.
 * This module does not modify existing geometry providers or authorize topology
 * decisions from approximate / visually sampled coordinates.
 */
export type OrientationSign = 'positive' | 'negative' | 'zero';
export type PredicateEvidence = {
    readonly status: 'exact';
    readonly sign: OrientationSign;
    readonly method: 'safe-integer-bigint';
} | {
    readonly status: 'qualified';
    readonly sign: Exclude<OrientationSign, 'zero'>;
    readonly method: 'bounded-float-det2';
    readonly absoluteErrorBound: number;
    readonly determinant: number;
} | {
    readonly status: 'indeterminate';
    readonly reason: 'within-error-bound' | 'overflow-risk';
} | {
    readonly status: 'unsupported';
    readonly reason: 'non-finite-coordinate' | 'out-of-range-coordinate' | 'invalid-input';
};
export interface PlanarPoint {
    readonly x: number;
    readonly y: number;
}
export interface OrientationOptions {
    /** The largest accepted absolute coordinate in mm. */
    readonly maxAbsCoordinateMM: number;
    /** Additional caller-provided determinant uncertainty, in mm^2. */
    readonly determinantUncertaintyMM2: number;
}
/**
 * Returns a sign only when an integer determinant is exact or when a
 * conservative floating-point bound excludes zero. Never snaps to zero.
 */
export declare function orient2dQualified(a: unknown, b: unknown, c: unknown, options?: OrientationOptions): PredicateEvidence;
