import type { CurveInterpolationDiagnosticCode, CurveInterpolationPoint, CurveInterpolationOptions, CurveInterpolationResult } from './curve-interpolation.js';
export declare function snapshotCurveInterpolationKernelData(input: unknown, owned?: boolean): unknown;
export declare function recordCurveInterpolationKernelData(input: unknown, fields: string[], code?: CurveInterpolationDiagnosticCode): Record<string, unknown>;
export declare function sameCurveInterpolationKernelData(a: unknown, b: unknown): boolean;
/** INTERNAL actual943 arithmetic/order, with optional admitted fixed positive weights. */
export declare function buildCurveInterpolationKernel(pointsInput: CurveInterpolationPoint[], optionsInput: CurveInterpolationOptions, weightsInput?: number[]): CurveInterpolationResult;
