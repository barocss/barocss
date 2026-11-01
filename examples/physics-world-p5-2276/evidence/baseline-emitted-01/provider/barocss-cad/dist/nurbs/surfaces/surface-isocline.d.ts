import type { Surface } from '../../types.js';
/** One isocline in the surface's domain: points on n·d = 0 in order, `closed` when it returns to its start. */
export interface SurfaceIsocline {
    readonly closed: boolean;
    readonly uv: readonly (readonly [number, number])[];
}
export interface SurfaceIsoclineOptions {
    /** Grid cells along each domain side (default 32, 4 … 256). */
    readonly grid?: number;
    /** The largest distance (mm) of the Catmull–Rom curve through the points from the isocline (default 1e-7). */
    readonly tolerance?: number;
    /** At most this many points in all (default 20 000). */
    readonly maxPoints?: number;
}
type UV = [number, number];
/** The uniform Catmull–Rom point between p1 and p2 at s ∈ [0, 1]. */
export declare function catmullRom(p0: readonly number[], p1: readonly number[], p2: readonly number[], p3: readonly number[], s: number): UV;
/** The neighbours of interval i of a point chain (an open one's ends mirrored). */
export declare function chainNeighbours(P: readonly (readonly number[])[], i: number, closed: boolean): [readonly number[], readonly number[], readonly number[], readonly number[]];
/** The isoclines n·d = 0 of `surface` for the pull `pull` (any length), in its domain. */
export declare function surfaceIsoclines(surface: Surface, pull: readonly number[], options?: SurfaceIsoclineOptions): SurfaceIsocline[];
export {};
