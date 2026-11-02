import type { Curve, Point, Surface } from '../types.js';
export interface CurveD1Result {
    point: Point;
    derivative: Point;
}
export interface SurfaceD1Result {
    point: Point;
    du: Point;
    dv: Point;
}
/** Endpoints use the interior span; exact C0 knots reject. Zero tangents are valid. */
export declare function evaluateCurveD1(curve: Curve, parameter: number): CurveD1Result;
/** `evaluateCurveD1` for one curve, validated once: the same arithmetic, bit for bit. */
export declare function curveD1Evaluator(curve: Curve): (parameter: number) => CurveD1Result;
/** Original U/V partials, without normalization or a surface regularity claim. */
export declare function evaluateSurfaceD1(surface: Surface, u: number, v: number): SurfaceD1Result;
/** `evaluateSurfaceD1` for one surface, validated once: the same arithmetic, bit for bit (K8, D185). */
export declare function surfaceD1Evaluator(surface: Surface): (u: number, v: number) => SurfaceD1Result;
