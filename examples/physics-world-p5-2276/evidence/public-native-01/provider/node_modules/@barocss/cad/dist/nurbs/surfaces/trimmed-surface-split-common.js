import { KernelError } from '../../core/barocss-error.js';
export class TrimmedSurfaceParameterSplitError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Trimmed Surface parameter split: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'TrimmedSurfaceParameterSplitError';
        this.code = code;
    }
}
export function splitCheck(condition, code, detail) {
    if (!condition)
        throw new TrimmedSurfaceParameterSplitError(code, detail);
}
