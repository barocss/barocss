import { copyCadData } from '../data-copy.js';
import { admit, check, exact, isNumericalError, snapshot, XYCircularNumericalSketchError } from './xy-circular-numerical-sketch-admission-internal.js';
import { solve } from './xy-circular-numerical-sketch-solver-internal.js';
import { native } from './xy-circular-numerical-sketch-native-internal.js';
export { XYCircularNumericalSketchError, XYCircularNumericalSketchDiagnosticCode } from './xy-circular-numerical-sketch-admission-internal.js';
/** Atomic local numerical solve followed by actual native circle/line compilation. */
export function buildXYCircularNumericalSketch(input) {
    try {
        const document = admit(input), { points, radii, report } = solve(document);
        return copyCadData({ ok: true, document, solution: { points, radii, ...native(document, points, radii) }, report });
    }
    catch (cause) {
        if (isNumericalError(cause))
            throw cause;
        throw new XYCircularNumericalSketchError('COMPILATION', 'Native construction refused', '$', cause);
    }
}
export function solveXYCircularNumericalSketch(document) {
    try {
        return buildXYCircularNumericalSketch(document);
    }
    catch (cause) {
        const e = isNumericalError(cause) ? cause : new XYCircularNumericalSketchError('INVALID_DOCUMENT', 'Sketch refused');
        return { ok: false, diagnostics: [{ code: e.code, message: e.message, path: e.path }] };
    }
}
/** Full deterministic reconstruction checks self-consistency, not provenance or authenticity. */
export function validateXYCircularNumericalSketch(input) {
    try {
        const data = snapshot(input, true);
        check(data !== null && typeof data === 'object' && Object.hasOwn(data, 'document'), 'OWNED', 'Complete success result required');
        const rebuilt = buildXYCircularNumericalSketch(data.document);
        check(exact(data, rebuilt), 'OWNED', 'Complete result differs from deterministic native rebuild');
        return copyCadData(rebuilt.report);
    }
    catch (cause) {
        if (isNumericalError(cause) && cause.code === 'OWNED')
            throw cause;
        throw new XYCircularNumericalSketchError('OWNED', 'Complete result reconstruction refused', '$', cause);
    }
}
