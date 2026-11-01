import { type KernelError } from '../core/barocss-error.js';
export type XY = [number, number];
/**
 * A line from a to b, or an arc about c with radius r from angle t0 through the signed sweep. `tag`
 * (optional) names where the segment came from; pieces of it keep the tag through every Boolean.
 */
export type CurveSegment2 = {
    readonly kind: 'line';
    readonly a: XY;
    readonly b: XY;
    readonly tag?: string;
} | {
    readonly kind: 'arc';
    readonly c: XY;
    readonly r: number;
    readonly t0: number;
    readonly sweep: number;
    readonly tag?: string;
}
/** f over t0 → t1 (either order); `src` (optional) is the same curve in 3D, on the same parameter. */
 | {
    readonly kind: 'curve';
    readonly f: (t: number) => XY;
    readonly t0: number;
    readonly t1: number;
    readonly tag?: string;
    readonly src?: (t: number) => readonly [number, number, number];
};
/** A region: closed rings (material on the left: outer counter-clockwise, holes clockwise). */
export type CurveRegion2 = {
    readonly outer: readonly CurveSegment2[];
    readonly holes: readonly (readonly CurveSegment2[])[];
};
export type CurveBooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
/** This module's refusal (R7.3a batch 2: the CurvedArrangementError class folded, D279): a BarocssError, `details.source` 'curved-arrangement'. */
export declare const curvedArrangementError: (detail: string) => KernelError & {
    readonly code: "CURVED_ARRANGEMENT";
};
/** Whether something thrown is this module's refusal. */
export declare const isCurvedArrangementError: (e: unknown) => e is KernelError & {
    readonly code: "CURVED_ARRANGEMENT";
};
export declare const segStart: (s: CurveSegment2) => XY;
export declare const segEnd: (s: CurveSegment2) => XY;
export declare const segAt: (s: CurveSegment2, u: number) => XY;
/** The same piece traversed the other way. */
export declare const segReverse: (s: CurveSegment2) => CurveSegment2;
/** ∫ g(point, derivative) du over [0, 1] of a segment (16 pieces × 8 points). */
export declare function segIntegral(s: CurveSegment2, g: (p: XY, d: XY) => number): number;
export declare function regionBox(region: CurveRegion2): readonly [number, number, number, number];
/** Area contribution ½∮(x dy − y dx) of a segment. */
export declare function segArea(s: CurveSegment2): number;
export declare const ringArea: (ring: readonly CurveSegment2[]) => number;
export declare const regionArea: (r: CurveRegion2) => number;
/** Points along a ring (arcs every ≤ 5°), end points excluded. */
export declare function sampleRing(ring: readonly CurveSegment2[], step?: number): XY[];
/** Even–odd point in a polygon (sampled rings). */
export declare const pointInPolygon: (p: XY, poly: readonly XY[]) => boolean;
/** Parameter u ∈ [0, 1] of a point known to lie on the segment's carrier (line or circle). */
export declare function paramOf(s: CurveSegment2, p: XY): number;
/** Distance from p to the segment. */
export declare function segDistance(s: CurveSegment2, p: XY): number;
export declare function intersectSegments(s: CurveSegment2, t: CurveSegment2, eps: number, graze?: boolean): XY[];
/**
 * Whether two segments' boxes lie more than 4 eps apart, so that `intersectSegments(s, t, eps)` finds nothing: every point
 * it keeps lies within eps of both (and inside a general curve's box padded by eps). 4 eps rather than 2 leaves room for
 * the rounding of the nearest points it measures to. (K13, D242.)
 */
export declare function segmentsApart(s: CurveSegment2, t: CurveSegment2, eps: number): boolean;
/** The arrangement tolerance for a set of rings. */
export declare function curveTolerance(rings: readonly (readonly CurveSegment2[])[]): number;
/** Every vertex of the arrangement of the rings (crossings, tangencies, touches, ring vertices). */
export declare function curveArrangementVertices(rings: readonly (readonly CurveSegment2[])[], tolerance?: number): XY[];
/**
 * Boolean of two sets of closed rings (material left). Regions come back as outer + holes. `joinEnds`: rings closed to
 * within 10 tolerances, as `curveFaceRegions` leaves them where it joined a cut's loose end (`joinLooseEnds`), are
 * closed there.
 */
export declare function booleanCurveRegions(a: readonly (readonly CurveSegment2[])[], b: readonly (readonly CurveSegment2[])[], operation: CurveBooleanOperation, tolerance?: number, joinEnds?: boolean): CurveRegion2[];
/**
 * Area moments of a region by Green's theorem: [∫dA, ∫x, ∫y, ∫x², ∫y², ∫xy]. Lines are integrated
 * exactly; arcs by Gauss–Legendre on pieces of at most 1/16 turn (error far below binary64 rounding).
 */
export declare function regionMoments(region: CurveRegion2): [number, number, number, number, number, number];
/**
 * A region split by cut segments: the faces of the arrangement of its rings (polygon 0) and the cuts
 * (no winding) that lie inside it, each as outer ring + holes. Cuts outside the region are ignored.
 */
export declare function curveFaceRegions(rings: readonly (readonly CurveSegment2[])[], cuts: readonly CurveSegment2[], tolerance?: number): CurveRegion2[];
/** Whether p is inside the region (boundary points: `boundary`, decided by tolerance). */
export declare function locateInRegion(p: XY, region: CurveRegion2, tolerance: number): 'in' | 'out' | 'boundary';
/**
 * A point strictly inside a region: on a few horizontal lines through it, the exact crossings with
 * its lines and arcs (no sampling, so tangent cusps cannot fold the boundary), and the middle of the
 * widest inside interval.
 */
export declare function regionInteriorPoint(region: CurveRegion2): XY | null;
