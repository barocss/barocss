import { KernelError } from '../../core/barocss-error.js';

export type TrimmedSurfaceParameterSplitDiagnosticCode = 'INPUT' | 'SUPPORT' | 'DOMAIN' | 'TOPOLOGY' | 'REPRESENTABILITY' | 'BUDGET' | 'BINDING' | 'NATIVE';
export class TrimmedSurfaceParameterSplitError extends KernelError {
  readonly code: TrimmedSurfaceParameterSplitDiagnosticCode;
  constructor(code: TrimmedSurfaceParameterSplitDiagnosticCode, detail: string, cause?: unknown) {
    super(('Trimmed Surface parameter split: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'TrimmedSurfaceParameterSplitError'; this.code = code;
  }
}
export function splitCheck(condition: boolean, code: TrimmedSurfaceParameterSplitDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new TrimmedSurfaceParameterSplitError(code, detail);
}
