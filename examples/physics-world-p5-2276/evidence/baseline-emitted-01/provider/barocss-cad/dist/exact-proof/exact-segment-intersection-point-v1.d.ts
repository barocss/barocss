/** Rational coordinates in millimetres; decimal strings contain exact integers. */
export interface ExactRationalMMV1 {
    readonly numerator: string;
    readonly denominator: string;
}
export type ExactProperSegmentIntersectionV1 = {
    readonly status: 'exact';
    readonly relation: 'proper-interior-crossing';
    readonly pointMM: {
        readonly x: ExactRationalMMV1;
        readonly y: ExactRationalMMV1;
    };
    readonly parameterAB: ExactRationalMMV1;
    readonly parameterCD: ExactRationalMMV1;
    readonly method: 'binary64-dyadic-cramer-bigint';
} | {
    readonly status: 'refused';
    readonly reason: 'not-proper-interior-crossing';
} | {
    readonly status: 'unsupported';
    readonly reason: string;
};
/** Only proper crossings; no endpoint, overlap, tolerance snapping or topology changes. */
export declare function intersectProperSegmentsExactBinary64V1(a: unknown, b: unknown, c: unknown, d: unknown, maxAbsCoordinateMM?: number): ExactProperSegmentIntersectionV1;
