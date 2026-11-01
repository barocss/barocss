/**
 * Exact orientation of the six REPRESENTED IEEE-754 binary64 input values.
 * No tolerance, no approximation, no statement about measurement error,
 * true design intent, non-planar topology or B-Rep material validity.
 */
export type ExactBinary64OrientationV1 = {
    readonly status: 'exact';
    readonly sign: 'positive' | 'negative' | 'zero';
    readonly method: 'binary64-dyadic-bigint';
} | {
    readonly status: 'unsupported';
    readonly reason: 'invalid-input' | 'non-finite-coordinate' | 'out-of-range-coordinate';
};
export interface Binary64PointV1 {
    readonly x: number;
    readonly y: number;
}
/**
 * Integer-scaled exact determinant. At the bounded input magnitude <=10000,
 * only a few thousand BigInt bits are required even for the smallest subnormal.
 */
export declare function orient2dExactBinary64V1(a: unknown, b: unknown, c: unknown, maxAbsCoordinateMM?: number): ExactBinary64OrientationV1;
