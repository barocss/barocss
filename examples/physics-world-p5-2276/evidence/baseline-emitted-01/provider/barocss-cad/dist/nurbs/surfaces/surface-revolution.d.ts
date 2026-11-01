import type { Point, Surface } from '../../types.js';
type XY = [number, number];
/** About the axis through c along a (frame e1, e2): the meridian profile in (ρ, h), h along a from c. */
export interface Revolution {
    readonly c: Point;
    readonly a: Point;
    readonly e1: Point;
    readonly e2: Point;
    readonly profile: {
        readonly kind: 'line';
        readonly p: XY;
        readonly q: XY;
    } | {
        readonly kind: 'arc';
        readonly c: XY;
        readonly r: number;
    };
    /** The patch: angles th0 → th0 + span about the axis; along the profile s0 → s1 (a line's share p → q, an arc's angle). */
    readonly patch?: {
        readonly th0: number;
        readonly span: number;
        readonly s0: number;
        readonly s1: number;
    };
}
/** A point's place on a surface of revolution: its angle about the axis and its profile coordinate. */
export declare function revolutionCoords(R: Revolution, x: Point): [number, number];
/** Whether a point's coordinates lie on the patch (with a margin in angle and profile). */
export declare function onPatch(R: Revolution, x: Point, margin?: number): boolean;
/**
 * How far a point lies inside the patch (> 0) or outside it (< 0): the nearer of its angle's distance from the patch's
 * ends and its profile coordinate's (each in its own units; the sign is what counts, and it is continuous across them).
 */
export declare function patchMargin(R: Revolution, x: Point): number;
export declare function revolutionOf(S: Surface, size: number): Revolution | null;
/** Where two meridian profiles cross, (ρ, h) — lines extended, circles whole; ρ ≥ 0 only. */
export declare function profileCrossings(A: Revolution['profile'], B: Revolution['profile'], tol: number): XY[];
export {};
