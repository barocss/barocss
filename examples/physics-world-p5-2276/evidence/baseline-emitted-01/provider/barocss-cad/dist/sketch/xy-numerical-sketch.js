import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import { admit, check, exact, isNumericalError, snapshot, XYNumericalSketchError } from './xy-numerical-sketch-admission-internal.js';
import { solve } from './xy-numerical-sketch-solver-internal.js';
export { XYNumericalSketchError, XYNumericalSketchDiagnosticCode } from './xy-numerical-sketch-admission-internal.js';
/** Atomic native construction after independently re-evaluating final solved coefficients. */
export function buildXYNumericalSketch(input) {
    try {
        const document = admit(input), { points, report } = solve(document), positions = new Map(points.map(p => [p.id, p.position]));
        const curves = document.segments.map(s => ({ kind: 'curve', id: s.id, degree: 1, knots: [0, 0, 1, 1],
            controlPoints: [positions.get(s.startPointId), positions.get(s.endPointId)].map(p => [p[0], p[1], 0]), weights: [1, 1] }));
        const decimal = (n) => curveDecimal(n, 'XY numerical sketch');
        const source = '@model ' + document.id + ' { version:0; length-unit:mm; ' + curves.map(c => '@curve #' + c.id + ' { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:['
            + c.controlPoints.map(p => '[' + p.map(decimal).join(',') + ']').join(',') + ']; weights:[1,1]; }').join(' ') + ' }\n';
        check(source.length <= 262144, 'LIMIT', 'Native source exceeds bounded text');
        const compiled = compileCadModel(source, { sourceVersion: 0 });
        check(compiled.ok, 'COMPILATION', 'Native line source must compile');
        check(compiled.ir.schemaVersion === 1 && exact(compiled.model.objects, curves), 'COMPILATION', 'Native IDs and coefficients differ from independently verified solution');
        return copyCadData({ ok: true, document, solution: { points, source, sourceVersion: 0, model: compiled.model, ir: compiled.ir }, report });
    }
    catch (cause) {
        if (isNumericalError(cause))
            throw cause;
        throw new XYNumericalSketchError('COMPILATION', 'Native construction refused', '$', cause);
    }
}
export function solveXYNumericalSketch(document) {
    try {
        return buildXYNumericalSketch(document);
    }
    catch (cause) {
        const e = isNumericalError(cause) ? cause : new XYNumericalSketchError('INVALID_DOCUMENT', 'Sketch refused');
        return { ok: false, diagnostics: [{ code: e.code, message: e.message, path: e.path }] };
    }
}
export function solveXYNumericalSketchPoints(document) {
    try {
        const admitted = admit(document), { points, report } = solve(admitted);
        return copyCadData({ ok: true, document: admitted, solution: { points }, report });
    }
    catch (cause) {
        const e = isNumericalError(cause) ? cause : new XYNumericalSketchError('INVALID_DOCUMENT', 'Sketch refused');
        return { ok: false, diagnostics: [{ code: e.code, message: e.message, path: e.path }] };
    }
}
/** Complete deterministic reconstruction proves self-consistency only, never provenance/authenticity. */
export function validateXYNumericalSketch(input) {
    try {
        const data = snapshot(input, true);
        check(data !== null && typeof data === 'object' && Object.hasOwn(data, 'document'), 'OWNED', 'Complete success result required');
        const rebuilt = buildXYNumericalSketch(data.document);
        check(exact(data, rebuilt), 'OWNED', 'Complete result differs from deterministic native rebuild');
        return copyCadData(rebuilt.report);
    }
    catch (cause) {
        if (isNumericalError(cause) && cause.code === 'OWNED')
            throw cause;
        throw new XYNumericalSketchError('OWNED', 'Complete result reconstruction refused', '$', cause);
    }
}
