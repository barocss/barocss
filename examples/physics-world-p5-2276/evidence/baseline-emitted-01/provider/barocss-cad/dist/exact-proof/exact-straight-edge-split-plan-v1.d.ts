import type { ExactRationalMMV1 } from './exact-segment-intersection-point-v1.js';
export type ExactSplitPointV1 = {
    readonly x: ExactRationalMMV1;
    readonly y: ExactRationalMMV1;
};
export interface ExactSplitSubedgeV1 {
    readonly parentEdgeId: string;
    readonly startParameter: ExactRationalMMV1;
    readonly endParameter: ExactRationalMMV1;
    readonly startMM: ExactSplitPointV1;
    readonly endMM: ExactSplitPointV1;
}
export type ExactStraightEdgeSplitPlanV1 = {
    readonly status: 'exact';
    readonly intersectionMM: ExactSplitPointV1;
    readonly subedges: readonly [ExactSplitSubedgeV1, ExactSplitSubedgeV1, ExactSplitSubedgeV1, ExactSplitSubedgeV1];
} | {
    readonly status: 'refused';
    readonly reason: string;
} | {
    readonly status: 'unsupported';
    readonly reason: string;
};
/** Pure four-subedge plan; no B-Rep mutation, sewing, snapping, or invented vertex IDs. */
export declare function planExactStraightEdgeCrossingSplitV1(firstId: unknown, a: unknown, b: unknown, secondId: unknown, c: unknown, d: unknown, maxAbsCoordinateMM?: number): ExactStraightEdgeSplitPlanV1;
