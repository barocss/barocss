import type { XYNumericalSketchDocumentV0 } from './xy-numerical-sketch.js';
import { KernelError } from '../core/barocss-error.js';
export declare const XYNumericalSketchDiagnosticCode: Readonly<{
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
export type XYNumericalSketchDiagnosticCode = typeof XYNumericalSketchDiagnosticCode[keyof typeof XYNumericalSketchDiagnosticCode];
export declare class XYNumericalSketchError extends KernelError {
    readonly code: XYNumericalSketchDiagnosticCode;
    readonly path: string;
    constructor(code: XYNumericalSketchDiagnosticCode, detail: string, path?: string, cause?: unknown);
}
export declare function isNumericalError(value: unknown): value is XYNumericalSketchError;
export declare function check(condition: boolean, code: XYNumericalSketchDiagnosticCode, detail: string, path?: string): asserts condition;
export declare function snapshot(input: unknown, owned?: boolean): unknown;
export declare function exact(a: unknown, b: unknown): boolean;
export declare function admit(input: unknown): XYNumericalSketchDocumentV0;
