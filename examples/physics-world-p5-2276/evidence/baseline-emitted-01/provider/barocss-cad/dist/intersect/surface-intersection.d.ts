import type { Point } from '../types.js';
import { KernelError } from '../core/barocss-error.js';
type XY = [number, number];
export interface Patch {
    readonly at: (p: XY) => Point;
    readonly box: readonly [XY, XY];
}
export interface IntersectionChain {
    readonly points: readonly Point[];
    readonly tangents: readonly Point[];
    readonly closed: boolean;
    /** Each point's coordinates on the two patches. */
    readonly uvA: readonly XY[];
    readonly uvB: readonly XY[];
    /** Points the march went through where the surfaces touch (n₁ × n₂ turned its sign, D238): the curve crosses itself there. */
    readonly touches?: readonly Point[];
}
export declare class SurfaceIntersectionError extends KernelError {
    constructor(detail: string);
}
export declare function intersectPatches(A: Patch, B: Patch, options: {
    readonly step: number;
    readonly tolerance: number;
    readonly grid?: number;
    /** Seeds to leave out (points of an intersection the caller already has). */
    readonly skip?: (x: Point) => boolean;
    /** Whether x lies within r of that intersection: facet crossings that close are not refined at all. */
    readonly skipNear?: (x: Point, r: number) => boolean;
    /** At most this many marching steps in all (default 200 000), so a degenerate pair fails, not hangs. */
    readonly budget?: number;
    /**
     * Points known to be on the intersection (where a curve found on a neighbouring patch crosses into
     * these): traced first, so a short piece by a patch's edge is not missed between grid seeds.
     */
    readonly seeds?: readonly Point[];
}): IntersectionChain[];
/**
 * A chain as a C¹ curve on t ∈ [0, 1] (cubic Hermite between consecutive points, by chord length).
 * With the two patches, every chain step is first subdivided in four by points corrected onto both
 * surfaces (in the plane normal to the curve), with their tangents: the interpolant then deviates
 * from the intersection by about (step / 4)⁴ κ³ / 384, far below tolerance, at no cost per evaluation.
 */
export declare function chainCurve(chain: IntersectionChain, on?: {
    readonly A: Patch;
    readonly B: Patch;
}): (t: number) => Point;
export {};
