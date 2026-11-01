import type { Point } from '../types.js';
/** A general seam guide: a polynomial B-spline in the sections' coordinates (z along their common normal). */
export interface LoftNurbsGuideInput {
    readonly kind: 'nurbs';
    readonly degree: number;
    /** Clamped: degree + 1 equal knots at each end, non-decreasing, interior knots at most `degree` deep. */
    readonly knots: readonly number[];
    readonly controlPoints: readonly (readonly [number, number, number])[];
}
/** The guide on one span between two sections: λ in [0, 1] from the lower section to the upper. */
export interface LoftNurbsGuideSpan {
    readonly degree: number;
    /** Knots on [0, 1] (ends exactly 0 and 1). */
    readonly knots: readonly number[];
    /** Where the guide meets the lower and upper sections. */
    readonly start: Point;
    readonly end: Point;
    /** A ruling from lo (on the lower section) to hi (on the upper one): its control points, its ends exactly lo and hi. */
    readonly controls: (lo: Point, hi: Point) => Point[];
    /** The guide's departure from its chord at λ (x, y, z). */
    readonly offset: (l: number) => Point;
    /** The slice's height at λ and its derivative in λ. */
    readonly height: (l: number) => number;
    readonly rise: (l: number) => number;
    /** The knots where the piece's polynomials change (the mass integrates between them). */
    readonly breaks: readonly number[];
}
/**
 * The guide admitted against the sections' heights `z` (strictly increasing) and cut into one piece a span. Its ends
 * must lie at the bottom and top heights (within `tol`); the points where it crosses each section's plane are returned
 * for the loft to find the vertex there.
 */
export declare function admitNurbsGuide(value: unknown, z: readonly number[], tol: number): {
    spans: LoftNurbsGuideSpan[];
    through: Point[];
};
