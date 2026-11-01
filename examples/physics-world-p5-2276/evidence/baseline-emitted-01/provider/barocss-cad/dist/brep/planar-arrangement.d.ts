import { type KernelError } from '../core/barocss-error.js';
import { SectionRationalContext } from '../section-rational-internal.js';
export type XY = [number, number];
export interface PolygonWithHoles {
    readonly outer: readonly XY[];
    readonly holes: readonly (readonly XY[])[];
}
export type PlanarBooleanOperation = 'union' | 'intersection' | 'difference' | 'xor';
/** This module's refusal (R7.3a batch 2: the PlanarArrangementError class folded, D279): a BarocssError, `details.source` 'planar-arrangement'. */
export declare const planarArrangementError: (detail: string) => KernelError & {
    readonly code: "PLANAR_ARRANGEMENT";
};
/** Whether something thrown is this module's refusal. */
export declare const isPlanarArrangementError: (e: unknown) => e is KernelError & {
    readonly code: "PLANAR_ARRANGEMENT";
};
type H = {
    x: bigint;
    y: bigint;
    w: bigint;
};
declare function fromXY([x, y]: XY): H;
/** Sign of the orientation of (a, b, c): > 0 counter-clockwise. */
declare function orient(a: H, b: H, c: H): number;
/** Boolean of two sets of polygons with holes. The result's outer rings are counter-clockwise, holes clockwise. */
export declare function booleanPolygons(a: readonly PolygonWithHoles[], b: readonly PolygonWithHoles[], operation: PlanarBooleanOperation): PolygonWithHoles[];
/** Arrangement statistics (vertices, edges, bounded faces) for diagnostics and tests. */
export declare function planarArrangementCounts(polygons: readonly PolygonWithHoles[]): {
    vertices: number;
    edges: number;
    boundedFaces: number;
};
export type ExactPoint2 = H;
/** An exact rational point (xn / xd, yn / yd), denominators nonzero. */
export declare function exactPoint2(xn: bigint, xd: bigint, yn: bigint, yd: bigint): ExactPoint2;
export declare const exactPoint2FromXY: typeof fromXY;
export declare const exactOrient2: typeof orient;
export declare const exactSame2: (a: H, b: H) => boolean;
export declare const exactToXY: (p: H) => XY;
export interface ExactRegion {
    readonly outer: readonly ExactPoint2[];
    readonly holes: readonly (readonly ExactPoint2[])[];
    readonly winding: readonly number[];
}
/**
 * Bounded faces of the arrangement of exact rings (each tagged with a polygon index; outer rings
 * counter-clockwise, holes clockwise) and extra cut segments, with every polygon's winding.
 */
export declare function arrangementRegions(rings: readonly {
    readonly polygon: number;
    readonly ring: readonly ExactPoint2[];
}[], cuts: readonly (readonly [ExactPoint2, ExactPoint2])[], polygonCount: number): ExactRegion[];
export interface ExactArrangementCounts {
    readonly segments: number;
    readonly pairTests: number;
    readonly vertices: number;
    readonly edges: number;
    readonly halfEdges: number;
    readonly cycles: number;
    readonly boundaryOccurrences: number;
    /** One request-local context for coordinate admission, cycle area and nesting comparisons. */
    readonly rational: ReturnType<SectionRationalContext['counts']>;
}
/**
 * Internal bounded entry for material splitting. It shares the segment and half-edge engine above,
 * but never uses floating coordinates or floating area for a topology decision. The caller admits
 * its geometric profile and checks its tighter derived vertex, edge and output bounds.
 */
export declare function arrangementRegionsExact(rings: readonly {
    readonly polygon: number;
    readonly ring: readonly ExactPoint2[];
}[], cuts: readonly (readonly [ExactPoint2, ExactPoint2])[], polygonCount: number): {
    regions: ExactRegion[];
    counts: ExactArrangementCounts;
};
export {};
