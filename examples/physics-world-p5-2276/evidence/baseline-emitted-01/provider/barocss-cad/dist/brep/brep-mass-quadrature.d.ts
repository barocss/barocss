import type { Brep, BrepFace } from './brep-core.js';
import type { Point } from '../types.js';
/**
 * The indices of the (at most) four grid points nearest p, nearest first, into `out`; their count. Equal distances
 * keep the grid's order, as a stable sort of all of them by squared distance would (R5.2, D216: the sort it replaces).
 * A distance that is not a number takes that sort's own path.
 */
export declare function nearestGridPoints(grid: readonly {
    readonly p: Point;
}[], p: Point, out: number[]): number;
/**
 * The ten volume integrals over the exact surfaces, or null when a face cannot be integrated so;
 * `meshed`: whether any face was integrated over its tessellation (its result then depends on
 * `segmentsPerQuarter`, and the caller extrapolates): `squared` holds the meshed faces' part whose error falls
 * with the square of the step (surfaces with a pole), `cubed` the rest (within `integrals` too); `dropped` the trims' strips
 * left unintegrated (each such face held to its vector area to 1e-9).
 */
export declare function brepQuadratureIntegrals(brep: Brep, segmentsPerQuarter: number): {
    integrals: number[];
    meshed: boolean;
    squared?: number[];
    cubed?: number[];
    dropped?: number;
} | null;
/**
 * Whether a curved face is its whole patch: one loop, every edge on the patch's domain boundary (sampled
 * at nine points, each within 1e-7 of the surface's size of one of the four boundary iso-curves, or within
 * the edge's own tolerance where it is a tolerant edge — a fitted offset's, D110), and the
 * loop as long as that boundary (to 1e-3, both measured as 64-segment polylines a curve). A closed loop made
 * only of boundary pieces, as long as the boundary, goes round it once: the face is the full domain.
 */
/** A test of whether a face of `brep` is its surface's whole patch, bounded by the four sides of its domain (D151: exact extremes). */
export declare function wholePatchTest(brep: Brep): (face: BrepFace) => boolean;
