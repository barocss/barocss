import { buildCurveInterpolationKernel, snapshotCurveInterpolationKernelData as snapshot, recordCurveInterpolationKernelData as record, sameCurveInterpolationKernelData as same } from './curve-interpolation-kernel-internal.js';
import { KernelError } from '../../core/barocss-error.js';
export const CurveInterpolationDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
    REPRESENTABILITY: 'REPRESENTABILITY', CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' });
export class CurveInterpolationError extends KernelError {
    code;
    constructor(code, detail, cause) {
        super(('Curve interpolation: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
        this.name = 'CurveInterpolationError';
        this.code = code;
    }
}
const CODE = CurveInterpolationDiagnosticCode;
function check(condition, code, detail) { if (!condition)
    throw new CurveInterpolationError(code, detail); }
/** Global polynomial through-point interpolation in caller-supplied native parameter units. */
export function buildInterpolatingCurve(pointsInput, optionsInput) {
    return buildCurveInterpolationKernel(pointsInput, optionsInput);
}
/** Rebuild the native basis, deterministic solve, actual Source0 Curve and complete report bit-for-bit. */
export function validateInterpolatingCurve(input) {
    const owned = record(snapshot(input, true), ['points', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = buildInterpolatingCurve(owned.points, owned.options);
    }
    catch (cause) {
        throw new CurveInterpolationError(CODE.OWNED, 'owned complete native interpolation reconstruction refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'owned through-points/options/basis/solver/source/knots/poles/work/report mismatch');
    return snapshot(expected.report, true);
}
