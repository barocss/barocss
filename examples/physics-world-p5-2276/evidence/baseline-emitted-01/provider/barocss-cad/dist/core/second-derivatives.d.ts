import type { Curve, Surface, Point } from '../types.js';
import { KernelError } from './barocss-error.js';
export declare const NativeSecondDerivativeDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly CONTINUITY: "CONTINUITY";
    readonly ARITHMETIC: "ARITHMETIC";
    readonly NATIVE: "NATIVE";
}>;
export type NativeSecondDerivativeDiagnosticCode = typeof NativeSecondDerivativeDiagnosticCode[keyof typeof NativeSecondDerivativeDiagnosticCode];
export declare class NativeSecondDerivativeError extends KernelError {
    readonly code: NativeSecondDerivativeDiagnosticCode;
    constructor(code: NativeSecondDerivativeDiagnosticCode, detail: string, cause?: unknown);
}
export interface CurveD2Result {
    point: Point;
    derivative: Point;
    secondDerivative: Point;
}
export interface SurfaceD2Result {
    point: Point;
    du: Point;
    dv: Point;
    duu: Point;
    duv: Point;
    dvv: Point;
}
/** Analytic second derivative in original knot units. Endpoints use the interior span. */
export declare function evaluateCurveD2(curveInput: Curve, parameter: number): CurveD2Result;
/** Analytic tensor partials in original U/V knot units. Zero tangents remain valid. */
export declare function evaluateSurfaceD2(surfaceInput: Surface, u: number, v: number): SurfaceD2Result;
/**
 * `evaluateSurfaceD2` for one surface, admitted once (its snapshot and validation): each call admits only its
 * parameters, the same arithmetic bit for bit (K8, D185: a point's foot asks for second derivatives some 12 times).
 */
export declare function surfaceD2Evaluator(surfaceInput: Surface): (u: number, v: number) => SurfaceD2Result;
