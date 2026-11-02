import type { FacetPatch, Point } from '../types.js';
export declare function boundsOf(positions: Float64Array): Float64Array;
/** Twice the area of triangle a, b, c (vertex numbers into P). */
export declare function triangleArea2(P: Float64Array, a: number, b: number, c: number): number;
/** Why a patch is not usable (non-finite values, indices out of range, a triangle without area), or null. */
export declare function facetPatchProblem(f: FacetPatch): string | null;
/** The patch's vector area Σ ½ (b − a) × (c − a), along its winding. */
export declare function facetVectorArea(f: FacetPatch): Point;
/** The patch mapped by x' = M·x + t (M row-major); its triangles turned over when det M < 0 is not wanted here (the face's sense is). */
export declare function transformFacetPatch(f: FacetPatch, m: readonly number[], t: readonly number[]): FacetPatch;
/**
 * Adds the patch's part of the ten volume integrals [V, ∫x, ∫y, ∫z, ∫x², ∫y², ∫z², ∫xy, ∫xz, ∫yz] (positions
 * taken about `o`), by tetrahedra from `o` over its triangles (divergence theorem: exact for facets), with the
 * face's sense; and its area at I[10] when I has room.
 */
export declare function facetIntegrals(f: FacetPatch, sign: 1 | -1, o: readonly number[], I: number[]): void;
/** The patch's area. */
export declare function facetArea(f: FacetPatch): number;
/** Whether every triangle of the patch lies in one plane (normals within 1e-12, every vertex within 1e-9 of its size): its plane, or null. */
export declare function facetPlane(f: FacetPatch): {
    origin: Point;
    normal: Point;
} | null;
