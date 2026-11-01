import type { CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationReport } from './curve-interpolation.js';
import type { Curve, Model } from '../../types.js';
import { KernelError } from '../../core/barocss-error.js';
export declare const WeightedCurveInterpolationDiagnosticCode: Readonly<{
    readonly INPUT: "INPUT";
    readonly IDENTITY: "IDENTITY";
    readonly BUDGET: "BUDGET";
    readonly NATIVE: "NATIVE";
    readonly REPRESENTABILITY: "REPRESENTABILITY";
    readonly CONDITIONING: "CONDITIONING";
    readonly BINDING: "BINDING";
    readonly OWNED: "OWNED";
}>;
export type WeightedCurveInterpolationDiagnosticCode = typeof WeightedCurveInterpolationDiagnosticCode[keyof typeof WeightedCurveInterpolationDiagnosticCode];
export declare class WeightedCurveInterpolationError extends KernelError {
    readonly code: WeightedCurveInterpolationDiagnosticCode;
    constructor(code: WeightedCurveInterpolationDiagnosticCode, detail: string, cause?: unknown);
}
export type WeightedCurveInterpolationPoint = CurveInterpolationPoint;
export type WeightedCurveInterpolationOptions = CurveInterpolationOptions;
export interface WeightedCurveInterpolationReport extends Omit<CurveInterpolationReport, 'schema' | 'quality' | 'limits'> {
    schema: 'barocss-native-weighted-curve-interpolation';
    weights: number[];
    quality: Omit<CurveInterpolationReport['quality'], 'weights'> & {
        weights: 'supplied-positive-fixed-weights-no-weight-fitting';
        providedWeightBitsPreserved: true;
        weightOptimization: false;
        commonWeightScalingGlobalInvarianceCertified: false;
    };
    limits: CurveInterpolationReport['limits'] & {
        weightRange: [1e-6, 1e6];
    };
}
export interface WeightedCurveInterpolationResult {
    points: WeightedCurveInterpolationPoint[];
    weights: number[];
    options: WeightedCurveInterpolationOptions;
    curve: Curve;
    source: string;
    sourceVersion: 0;
    model: Model;
    report: WeightedCurveInterpolationReport;
}
/** Fixed original positive rational weights, using the sole original native interpolation kernel. */
export declare function buildWeightedInterpolatingCurve(pointsInput: WeightedCurveInterpolationPoint[], weightsInput: number[], optionsInput: WeightedCurveInterpolationOptions): WeightedCurveInterpolationResult;
/** Rebuild fixed weights and every actual basis/solver/Source0/observation datum, not a polynomial projection. */
export declare function validateWeightedInterpolatingCurve(input: WeightedCurveInterpolationResult): WeightedCurveInterpolationReport;
