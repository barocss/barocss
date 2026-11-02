import type { CurveD2Result, SurfaceD2Result } from '../../core/second-derivatives.js';
import type { Curve, Surface, Point } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const NativeCurvatureDiagnosticCode: Readonly<{
    readonly DERIVATIVE: "DERIVATIVE";
    readonly REGULARITY: "REGULARITY";
    readonly ARITHMETIC: "ARITHMETIC";
}>;
export type NativeCurvatureDiagnosticCode = typeof NativeCurvatureDiagnosticCode[keyof typeof NativeCurvatureDiagnosticCode];
export declare class NativeCurvatureError extends KernelError {
    readonly code: NativeCurvatureDiagnosticCode;
    constructor(code: NativeCurvatureDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurveCurvatureResult {
    derivatives: CurveD2Result;
    speed: number;
    unitTangent: Point;
    curvaturePer: number;
    curvatureVectorPer: Point;
    radius: number | null;
}
export interface SurfaceCurvatureResult {
    derivatives: SurfaceD2Result;
    unitNormal: Point;
    normalizedMetric: {
        cosineUV: number;
        determinant: number;
        tangentNorms: [number, number];
    };
    normalizedSecondFormPer: {
        uu: number;
        uv: number;
        vv: number;
    };
    meanCurvaturePer: number;
    gaussianCurvaturePer: number;
    principalCurvaturesPer: [number, number];
    umbilicDiscriminant: {
        scalePer: number;
        rawScaled: number;
        roundoffBoundScaled: number;
        clampedToZero: boolean;
    };
}
/** Local geometric curvature in inverse millimetres; a straight regular Curve is valid. */
export declare function evaluateCurveCurvature(curve: Curve, parameter: number): CurveCurvatureResult;
/** Native U/V-oriented local surface curvature with a disclosed discriminant rounding policy. */
export declare function evaluateSurfaceCurvature(surface: Surface, u: number, v: number): SurfaceCurvatureResult;
