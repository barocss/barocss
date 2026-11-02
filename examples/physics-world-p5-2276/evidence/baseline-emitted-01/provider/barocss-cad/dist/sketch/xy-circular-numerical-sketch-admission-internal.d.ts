import type { XYCircularNumericalSketchDocumentV0 } from './xy-circular-numerical-sketch.js';
import { KernelError } from '../core/barocss-error.js';
export declare const XYCircularNumericalSketchDiagnosticCode: Readonly<{
    readonly INVALID_DOCUMENT: "INVALID_DOCUMENT";
    readonly UNSUPPORTED: "UNSUPPORTED";
    readonly LIMIT: "LIMIT";
    readonly REFERENCE: "REFERENCE";
    readonly NONCONVERGENCE: "NONCONVERGENCE";
    readonly NUMERICAL: "NUMERICAL";
    readonly BUDGET: "BUDGET";
    readonly BRANCH: "BRANCH";
    readonly DEGENERATE_GEOMETRY: "DEGENERATE_GEOMETRY";
    readonly COMPILATION: "COMPILATION";
    readonly OWNED: "OWNED";
}>;
export type XYCircularNumericalSketchDiagnosticCode = typeof XYCircularNumericalSketchDiagnosticCode[keyof typeof XYCircularNumericalSketchDiagnosticCode];
export declare class XYCircularNumericalSketchError extends KernelError {
    readonly code: XYCircularNumericalSketchDiagnosticCode;
    readonly path: string;
    constructor(code: XYCircularNumericalSketchDiagnosticCode, detail: string, path?: string, cause?: unknown);
}
export declare function isNumericalError(value: unknown): value is XYCircularNumericalSketchError;
export declare function check(condition: boolean, code: XYCircularNumericalSketchDiagnosticCode, detail: string, path?: string): asserts condition;
export declare function snapshot(input: unknown, owned?: boolean): unknown;
export declare function exact(a: unknown, b: unknown): boolean;
export declare function admit(input: unknown): XYCircularNumericalSketchDocumentV0;
