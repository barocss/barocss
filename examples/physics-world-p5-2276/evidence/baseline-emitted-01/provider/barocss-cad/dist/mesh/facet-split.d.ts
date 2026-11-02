import { type Brep } from '../brep/brep-core.js';
import type { Point } from '../types.js';
export interface FacetSplitOptions {
    /** The plane n·p = offset (n need not be unit); below is n·p < offset. */
    readonly normal: Point | readonly number[];
    readonly offset: number;
    /** The new bodies' id and the cap faces' name stem (`<at>.cut.top`, `<at>.cut.bottom`). */
    readonly at: string;
}
export interface FacetSplitResult {
    /** Each side as a facet B-rep (all its pieces), null when nothing of the body is on that side. */
    readonly below: Brep | null;
    readonly above: Brep | null;
    /** The section: the cap's loops on the plane (closed, counter-clockwise about +n for material, clockwise for holes). */
    readonly loops: readonly (readonly Point[])[];
}
export declare function splitFacetBrep(brep: Brep, options: FacetSplitOptions): FacetSplitResult;
/** Triangles (outward) over positions, each with a group. */
export interface TriangleSoup {
    readonly P: ArrayLike<number>;
    readonly I: ArrayLike<number>;
    readonly G: ArrayLike<number>;
}
export interface SoupSplit {
    /** The positions: the soup's (those within the tie moved onto the plane), then the cut points. */
    readonly P: Float64Array;
    /** Below and above: their triangles (vertex numbers, three each) and groups, the caps asked for included. */
    readonly tris: [number[], number[]];
    readonly groups: [number[], number[]];
    /** The section's loops (the below side's cap's), when it was capped. */
    readonly loops: Point[][];
}
/**
 * A welded triangle soup split by the plane n·p = d (F1's core, D50): each vertex's side once (within twice the
 * weld it is on the plane, moved onto it, counted above; a triangle wholly on it to the side it faces away from),
 * each crossed edge cut once, each side asked for closed by its exact planar cap (in group `capGroup`).
 */
export declare function splitSoup(soup: TriangleSoup, normal: Point | readonly number[], offset: number, options: {
    readonly weld: number;
    readonly cap: 'both' | 'below' | 'above' | 'none';
    readonly capGroup: number;
}): SoupSplit;
/** The soup of a facet body: its faces' triangles (outward), welded, each grouped by its face; and the faces' names. */
export declare function facetSoup(brep: Brep): TriangleSoup & {
    names: string[];
};
