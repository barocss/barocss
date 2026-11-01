import { KernelError } from '../../core/barocss-error.js';
export type TrimmedSurfaceParameterSplitDiagnosticCode = 'INPUT' | 'SUPPORT' | 'DOMAIN' | 'TOPOLOGY' | 'REPRESENTABILITY' | 'BUDGET' | 'BINDING' | 'NATIVE';
export declare class TrimmedSurfaceParameterSplitError extends KernelError {
    readonly code: TrimmedSurfaceParameterSplitDiagnosticCode;
    constructor(code: TrimmedSurfaceParameterSplitDiagnosticCode, detail: string, cause?: unknown);
}
export declare function splitCheck(condition: boolean, code: TrimmedSurfaceParameterSplitDiagnosticCode, detail: string): asserts condition;
