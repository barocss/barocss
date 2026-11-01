import type { Curve, CurveSample, Model, Point, Surface, SurfaceSample } from '../types.js';
export declare const MAX_SAMPLES = 4096;
export declare function validateCurve(curve: Curve): void;
export declare function validateSurface(surface: Surface): void;
export declare function validateModel(model: Model): void;
export declare function curveDomain(curve: Curve): [number, number];
export declare function surfaceDomain(surface: Surface): {
    u: [number, number];
    v: [number, number];
};
/** Compute the local nonzero basis functions. The right endpoint uses the last span. */
export declare function basis(knots: number[], degree: number, count: number, parameter: number): {
    start: number;
    values: number[];
};
export declare function evaluateCurve(curve: Curve, parameter: number): Point;
export declare function evaluateSurface(surface: Surface, u: number, v: number): Point;
/** An evaluator for one curve, validated once (the same points as evaluateCurve). */
export declare function curveEvaluator(curve: Curve): (t: number) => Point;
/** An evaluator for one surface, validated once (for callers that evaluate it many times). */
export declare function surfaceEvaluator(surface: Surface): (u: number, v: number) => Point;
/** Uniform parameter samples include both domain boundaries. */
export declare function sampleCurve(curve: Curve, count: number): CurveSample[];
/** Rows follow U and columns follow V. The product of counts is at most 4096. */
export declare function sampleSurface(surface: Surface, countU: number, countV: number): SurfaceSample[][];
