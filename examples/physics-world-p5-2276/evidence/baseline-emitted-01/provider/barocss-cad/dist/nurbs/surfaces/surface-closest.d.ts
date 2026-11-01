import { type SurfaceD1Result } from '../../core/derivatives.js';
import { type SurfaceD2Result } from '../../core/second-derivatives.js';
import type { Point, Surface } from '../../types.js';
/** A surface's points on an (n + 1) × (n + 1) grid of its domain, for seeds: build once per surface, pass to every query. */
export interface SurfaceSeedGrid {
    readonly n: number;
    readonly u: readonly [number, number];
    readonly v: readonly [number, number];
    readonly points: Float64Array;
    /** The surface it was built for, and its derivatives validated once (K8, D185): a query on that surface uses them. */
    readonly surface?: Surface;
    readonly evaluators?: SurfaceEvaluators;
}
/** A surface's first derivatives, validated once, and its second, admitted on first use. */
interface SurfaceEvaluators {
    readonly d1: (u: number, v: number) => SurfaceD1Result;
    d2: ((u: number, v: number) => SurfaceD2Result) | null | undefined;
}
export declare function surfaceSeedGrid(surface: Surface, n?: number): SurfaceSeedGrid;
export interface SurfaceClosestPoint {
    readonly u: number;
    readonly v: number;
    /** The surface's point there, and its distance from the query point. */
    readonly point: Point;
    readonly distance: number;
    /** The unit normal du × dv there ([0, 0, 0] where the surface is degenerate, a pole). */
    readonly normal: Point;
    readonly iterations: number;
}
export interface SurfaceClosestOptions {
    /** Where to start; else the nearest node of `grid`. */
    readonly seed?: readonly [number, number];
    /** The seed grid (prebuilt, or its n; default 24) when no seed is given. */
    readonly grid?: SurfaceSeedGrid | number;
    /** At most this many steps (default 30). */
    readonly iterations?: number;
}
/** First derivatives at (u, v); exactly on a C0 knot, just off it inside the domain (the first nudge that evaluates). */
export declare function surfaceD1Near(surface: Surface, u: number, v: number, U: readonly [number, number], V: readonly [number, number]): SurfaceD1Result;
/** The point of `surface` nearest `p`, by Gauss–Newton from a seed (see the options). */
export declare function closestPointOnSurface(surface: Surface, p: ArrayLike<number>, options?: SurfaceClosestOptions): SurfaceClosestPoint;
export {};
