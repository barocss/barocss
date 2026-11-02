export type PlainPoint = [number, number, number];
export interface PlainFitCurve {
    degree: number;
    knots: number[];
    points: PlainPoint[];
    weights: number[];
}
export interface PlainFitSurface {
    degreeU: number;
    degreeV: number;
    knotsU: number[];
    knotsV: number[];
    points: PlainPoint[][];
    weights: number[][];
}
/** The B-spline basis functions N_{span−p..span, p}(u) (Cox–de Boor). */
export declare function plainBasis(span: number, u: number, p: number, U: readonly number[]): number[];
/** The knot span holding u (n + 1 poles, degree p). */
export declare function plainFindSpan(n: number, p: number, u: number, U: readonly number[]): number;
/** Chord-length parameters of points in [0, 1] (equal spacing when they all coincide). */
export declare function chordParameters(points: readonly (readonly number[])[]): number[];
/** Knots by averaging the parameters (clamped, degree p). */
export declare function averagedKnots(params: readonly number[], p: number): number[];
/** The curve of degree p (lowered to n for n + 1 points) through every point, at the given parameters, else chord-length ones. */
export declare function interpolateCurvePlain(points: readonly PlainPoint[], p?: number, params?: readonly number[], knots?: readonly number[]): PlainFitCurve;
/**
 * The curve of degree p with `count` poles nearest (least squares) to the points, its ends on the first and last point
 * (The NURBS Book A9.7); fewer poles than points smooth them; as many is the interpolation.
 */
export declare function approximateCurvePlain(points: readonly PlainPoint[], count: number, p?: number): PlainFitCurve;
/** The surface through a grid of points (rows along u: grid[i][j] at u_i, v_j), degree p and q (lowered to the counts). */
export declare function interpolateSurfacePlain(grid: readonly (readonly PlainPoint[])[], p?: number, q?: number): PlainFitSurface;
/**
 * The curve with one interior knot taken out (The NURBS Book A5.8), when the curve it leaves stays within `tol` mm of
 * the original; null when it does not (the knot carries shape). The knot is the one nearest `u`.
 */
export declare function removeCurveKnotPlain(c: PlainFitCurve, u: number, tol: number): PlainFitCurve | null;
