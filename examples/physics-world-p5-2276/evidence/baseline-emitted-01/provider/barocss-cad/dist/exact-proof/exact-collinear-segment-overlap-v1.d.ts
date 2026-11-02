import type { Binary64PointV1 } from './exact-binary64-orientation-v1.js';
type Relation = 'disjoint' | 'single-point-touch' | 'positive-length-overlap';
export type ExactCollinearSegmentOverlapV1 = {
    readonly status: 'exact';
    readonly relation: Relation;
    readonly overlapMM: readonly [Binary64PointV1, Binary64PointV1] | null;
} | {
    readonly status: 'refused';
    readonly reason: 'not-collinear';
} | {
    readonly status: 'unsupported';
    readonly reason: string;
};
/** Classifies only collinear represented binary64 line segments; returned points are original endpoints. */
export declare function classifyCollinearSegmentOverlapV1(a: unknown, b: unknown, c: unknown, d: unknown, maxAbsCoordinateMM?: number): ExactCollinearSegmentOverlapV1;
export {};
