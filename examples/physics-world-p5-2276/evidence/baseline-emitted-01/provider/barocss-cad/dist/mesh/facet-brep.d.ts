import { type Brep } from '../brep/brep-core.js';
import { type MeshBrepOptions } from './mesh-brep.js';
export interface FacetBrepOptions extends MeshBrepOptions {
    /** Neighbouring triangles whose normals turn by less than this (degrees) are one region; default 30. */
    readonly crease?: number;
    /** At most this many regions (a noisy scan is smoothed, then merged, to stay under it); default 1000. */
    readonly maximumRegions?: number;
    /**
     * Take an open mesh (edges with one triangle) as a sheet body (not a solid: no volume), its open edges the sheet's
     * boundary — said by the caller, never assumed (M3: what repair could not close). Default: refused.
     */
    readonly open?: boolean;
    /**
     * Per input triangle, a group (≥ 0) its region keeps to — a repair's fill patch k, so the patch is a face of its own,
     * named `<prefix>.fill<k>.region<f>` — or −1.
     */
    readonly groups?: ArrayLike<number>;
    /**
     * Group g's face names, in place of `fill<g>.region<f>`: a STEP file's triangulated faces keep their own names
     * (AP242, R3.5) — the first face of a group named so, any further one `#n`.
     */
    readonly groupName?: (group: number) => string;
}
/** The mesh (x, y, z per vertex; three vertex indices per triangle, or every three vertices one) as a B-rep of facet faces; refused when it is in more than one piece. */
export declare function facetBrepFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options?: FacetBrepOptions): Brep;
/**
 * Each closed, connected piece of the mesh as a B-rep of its own (a kit, a figure with separate eyes, a scan
 * with floaters), in order of each piece's first triangle in the file. One piece: named as by
 * facetBrepFromTriangles; more: its body `<id>_part<j>` and faces `<id>.part<j>.region<k>`. Each piece turned
 * outward on its own (a cavity's shell comes in as a solid of its own: repair, R3.4, tells them apart).
 */
export declare function facetBrepsFromTriangles(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options?: FacetBrepOptions): Brep[];
/** How many closed pieces the mesh is in, and each one's triangle count and enclosed volume (|V|), in file order. */
export declare function facetPieces(positions: ArrayLike<number>, indices: ArrayLike<number> | null, options?: FacetBrepOptions): {
    triangles: number;
    volume: number;
}[];
/**
 * Corners on one grid cell of the weld size are one vertex: a hash of the integer cell, checked, no strings. A corner
 * whose own cell is empty joins one within the weld in a neighbouring cell (those across its nearer side on each
 * axis: a corner is within half a cell of them), so that two corners a hair apart either side of a cell's boundary
 * are one too.
 */
export declare function weldVertices(positions: ArrayLike<number>, n: number, weld: number): {
    P: Float64Array;
    remap: Uint32Array;
};
