import { validateSectionExactSurfaceBinding } from '../features/section-exact-surface-binding.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { evaluateCurve, evaluateSurface, validateCurve } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
import { DENSE_BOUNDED_ARRAYS_REQUIRED, FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, ownSnapshot } from '../core/own-data.js';
export const ExactSurfaceBandTrimDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', PARENT: 'PARENT', PAIR: 'PAIR', SUPPORT: 'SUPPORT', BAND: 'BAND', EMBEDDING: 'EMBEDDING', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED' });
export class ExactSurfaceBandTrimError extends KernelError {
    code;
    constructor(code, detail, cause) { super(('Exact original Surface band trim: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ExactSurfaceBandTrimError'; this.code = code; }
}
const CODE = ExactSurfaceBandTrimDiagnosticCode;
function check(condition, code, detail) { if (!condition)
    throw new ExactSurfaceBandTrimError(code, detail); }
function native(action, detail, code = CODE.NATIVE) { try {
    return action();
}
catch (cause) {
    throw new ExactSurfaceBandTrimError(code, detail, cause);
} }
function record(input, fields, code = CODE.INPUT) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required');
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
    return data;
}
function id(input) { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
const OWN = { input: CODE.INPUT, owned: CODE.OWNED, budget: CODE.BUDGET, fail: (code, detail) => { throw new ExactSurfaceBandTrimError(code, detail); }, wrap: (code, detail, cause) => { throw new ExactSurfaceBandTrimError(code, detail, cause); }, isRefusal: e => e instanceof ExactSurfaceBandTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };
function snapshot(input, owned = false) { return ownSnapshot(input, owned, OWN); }
/** Collect complete copied source/model/topology/child identity contexts, including split helper receipts. */
function contexts(input) {
    const result = new Set();
    const visit = (value, key = '') => {
        if (typeof value === 'string') {
            if (key === 'id' || key === 'name' || /Ids?$/.test(key) || key === 'resultIdPrefix')
                result.add(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(item => visit(item, key));
            return;
        }
        if (value && typeof value === 'object')
            for (const [field, item] of Object.entries(value))
                visit(item, field);
    };
    visit(input);
    return result;
}
function domain(curve) { return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]]; }
function finite(value) { check(Number.isFinite(value), CODE.BINDING, 'Native comparison arithmetic must be finite'); return value; }
function gap(a, b) { return finite(Math.hypot(...a.map((v, i) => finite(v - b[i])))); }
/** Measure exact native JSON size, including its final newline and original negative zero. */
function fileSize(input) {
    let utf16 = 0, utf8 = 0;
    const encoder = new TextEncoder();
    const append = (text) => { utf16 += text.length; utf8 += encoder.encode(text).length; check(utf16 <= 2097152 && utf8 <= 2097152, CODE.BUDGET, 'Complete band JSON exceeds2097152UTF16/UTF8 units'); };
    const visit = (value) => { if (value === null || typeof value === 'boolean' || typeof value === 'string') {
        append(JSON.stringify(value));
        return;
    } if (typeof value === 'number') {
        check(Number.isFinite(value), CODE.INPUT, 'Finite JSON numbers required');
        append(Object.is(value, -0) ? '-0' : JSON.stringify(value));
        return;
    } if (Array.isArray(value)) {
        append('[');
        value.forEach((item, i) => { if (i)
            append(','); visit(item); });
        append(']');
        return;
    } check(value !== null && typeof value === 'object', CODE.INPUT, 'Complete own JSON data required'); append('{'); Object.entries(value).forEach(([key, item], i) => { if (i)
        append(','); append(JSON.stringify(key)); append(':'); visit(item); }); append('}'); };
    visit(input);
    append('\n');
    return { utf16, utf8 };
}
/** Construct a real band Face on the exact shared original Surface, retaining both full cut bindings. */
export function buildExactSurfaceBandTrim(lowerInput, upperInput, optionsInput) {
    const data = record(snapshot({ lower: lowerInput, upper: upperInput, options: optionsInput }), ['lower', 'upper', 'options']), settings = record(data.options, ['evaluationId', 'resultIdPrefix', 'orientation', 'maximumParents', 'maximumObservations']);
    const options = { evaluationId: id(settings.evaluationId), resultIdPrefix: id(settings.resultIdPrefix), orientation: settings.orientation, maximumParents: settings.maximumParents, maximumObservations: settings.maximumObservations };
    check(options.resultIdPrefix.length <= 12, CODE.IDENTITY, 'ASCII prefix1..12 required');
    check(options.maximumParents === 2 && options.maximumObservations === 40, CODE.BUDGET, 'Complete fixed budgets2/40 required before parent work');
    check(options.orientation === 'forward' || options.orientation === 'reverse', CODE.INPUT, 'Face orientation forward/reverse required');
    const requestSize = fileSize(data);
    const lower = data.lower, upper = data.upper;
    native(() => validateSectionExactSurfaceBinding(lower), 'Actual complete lower cut binding refused', CODE.PARENT);
    native(() => validateSectionExactSurfaceBinding(upper), 'Actual complete upper cut binding refused', CODE.PARENT);
    const ls = lower.section, us = upper.section, surface = ls.surfaceAsset.surface, sd = ls.report.surfaceDomains, p = surface.degreeU, n = ls.report.spanCount, lowerWorld = ls.world.curve, upperWorld = us.world.curve, lowerUV = lower.pcurve.curve, upperUV = upper.pcurve.curve;
    check(same(ls.surfaceAsset, us.surfaceAsset) && same(ls.originalModels[0], us.originalModels[0]), CODE.PAIR, 'Both bindings must retain the SAME complete original Surface source/DTO/Model');
    check(same(sd, us.report.surfaceDomains) && same(ls.proof.spans.map(span => ({ index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices })), us.proof.spans.map(span => ({ index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices }))), CODE.PAIR, 'Original native domains/spans/local pole indices must match');
    check(p >= 1 && p <= 2 && surface.degreeV === 1 && n >= 1 && n <= 4, CODE.SUPPORT, 'Original projected V-linear Surface degree/spans unchanged');
    check(lowerUV.degree === 2 && upperUV.degree === 2 && same(lowerUV.knots, upperUV.knots) && same(domain(lowerUV), sd.u) && same(domain(upperUV), sd.u) && same(domain(lowerWorld), sd.u) && same(domain(upperWorld), sd.u) && lowerUV.weights.every(value => Object.is(value, 1)) && upperUV.weights.every(value => Object.is(value, 1)), CODE.PAIR, 'Actual new SurfaceUV bases/unit weights/original domains must match');
    check(lower.proof.spans.length === n && upper.proof.spans.length === n && same(lower.proof.spans.map(span => ({ index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, pcurvePoleIndices: span.pcurvePoleIndices })), upper.proof.spans.map(span => ({ index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, pcurvePoleIndices: span.pcurvePoleIndices }))), CODE.PAIR, 'New UV local span restriction indices must match');
    const originals = new Set([ls, us].flatMap(section => [section.surfaceAsset.sourceId, section.planeAsset.sourceId, ...section.originalModels.flatMap(model => [model.name, ...model.objects.map(object => object.id)])])), borrowed = [lowerWorld.id, upperWorld.id, lowerUV.id, upperUV.id];
    check(new Set(borrowed).size === 4 && borrowed.every(value => !originals.has(value)), CODE.IDENTITY, 'Four borrowed World/UV Curve IDs must be distinct from both whole original contexts');
    const reserved = contexts({ lower, upper }), reserve = (value) => { id(value); check(!reserved.has(value), CODE.IDENTITY, 'New identity collides with complete parent/source/model/child context'); reserved.add(value); return value; };
    reserve(options.evaluationId);
    const prefix = options.resultIdPrefix, rightId = reserve(prefix + '_right'), leftId = reserve(prefix + '_left'), rightUVId = reserve(prefix + '_right_uv'), leftUVId = reserve(prefix + '_left_uv'), vertexIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_v' + i)), edgeIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_e' + i)), useIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_use' + i)), loopId = reserve(prefix + '_loop'), faceId = reserve(prefix + '_face');
    const q = new SectionRationalContext((kind, detail) => { throw new ExactSurfaceBandTrimError(CODE[kind], detail); }), zero = q.integer(0), text = (values) => values.map(value => q.text(value)), read = (value) => q.rat(BigInt(value.numerator), BigInt(value.denominator)), min = (values) => values.reduce((a, b) => q.compare(a, b) <= 0 ? a : b), eq = (a, b) => q.compare(a, b) === 0, zeroBound = () => ({ exact: q.text(zero), upper: 0 });
    const C = surface.weights[0][0];
    check(C > 0 && surface.weights.every(row => row.every(weight => Object.is(weight, C))), CODE.SUPPORT, 'Original Surface weights must be globally identical positive bits');
    const z0 = surface.controlPoints[0][0][2], z1 = surface.controlPoints[0][1][2];
    check(surface.controlPoints.every(row => Object.is(row[0][0], row[1][0]) && Object.is(row[0][2], z0) && Object.is(row[1][2], z1)), CODE.EMBEDDING, 'Original X must depend only on U and Z only on V');
    const zr0 = q.from(z0), zr1 = q.from(z1), v0 = q.from(sd.v[0]), v1 = q.from(sd.v[1]), dv = q.sub(v1, v0), zDerivative = q.div(q.sub(zr1, zr0), dv);
    check(q.compare(zDerivative, zero) > 0, CODE.EMBEDDING, 'Original native V Z derivative must be strictly positive');
    const projectionSpans = ls.proof.spans.map(span => { const x = span.originalPoleIndices.map(index => q.from(surface.controlPoints[index][0][0])), length = q.sub(q.from(span.domain[1]), q.from(span.domain[0])), derivative = x.slice(0, -1).map((value, i) => q.div(q.mul(q.integer(p), q.sub(x[i + 1], value)), length)); check(derivative.every(value => q.compare(value, zero) > 0), CODE.EMBEDDING, 'All exact original X derivative coefficients must be strictly positive'); return { index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, xCoefficients: text(x), xDerivativeDegree: p - 1, xDerivativeCoefficients: text(derivative), minimumXDerivative: q.text(min(derivative)) }; });
    const minimumXDerivative = min(projectionSpans.map(span => read(span.minimumXDerivative))), normalLower = q.mul(minimumXDerivative, zDerivative), gramLower = q.mul(normalLower, normalLower), projection = { spans: projectionSpans, z0: q.text(zr0), z1: q.text(zr1), zDerivative: q.text(zDerivative), minimumXDerivative: q.text(minimumXDerivative), normalYAbsoluteLowerBound: q.text(normalLower), gramDeterminantLowerBound: q.text(gramLower) };
    const bandSpans = lower.proof.spans.map((span, i) => {
        const high = upper.proof.spans[i], loPoints = span.pcurvePoleIndices.map(index => lowerUV.controlPoints[index]), hiPoints = high.pcurvePoleIndices.map(index => upperUV.controlPoints[index]), start = q.from(span.domain[0]), length = q.sub(q.from(span.domain[1]), start);
        check(loPoints.length === 3 && hiPoints.length === 3, CODE.PAIR, 'Each actual new UV span must have three degree2 poles');
        const u = loPoints.map(point => q.from(point[0])), lv = loPoints.map(point => q.from(point[1])), hv = hiPoints.map(point => q.from(point[1]));
        for (let k = 0; k < 3; k++) {
            const expected = q.add(start, q.mul(length, q.div(q.integer(k), q.integer(2))));
            check(eq(u[k], expected) && eq(q.from(hiPoints[k][0]), expected) && Object.is(loPoints[k][2], 0) && Object.is(hiPoints[k][2], 0), CODE.BINDING, 'Stored UV coefficients must be exact U identity and positive-zero Z');
            check(eq(u[k], read(span.uCoefficients[k])) && eq(q.from(hiPoints[k][0]), read(high.uCoefficients[k])) && eq(lv[k], read(span.vCoefficients[k])) && eq(hv[k], read(high.vCoefficients[k])), CODE.BINDING, 'Actual stored UV coefficients must bind each complete parent proof');
        }
        const lowGap = lv.map(value => q.sub(value, v0)), highGap = hv.map(value => q.sub(v1, value)), gap = hv.map((value, k) => q.sub(value, lv[k]));
        check(lowGap.every(value => q.compare(value, zero) >= 0) && highGap.every(value => q.compare(value, zero) >= 0) && gap.every(value => q.compare(value, zero) > 0), CODE.BAND, 'Whole Bernstein chart/gap hulls must certify a strictly positive band');
        return { index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, lowerPcurvePoleIndices: span.pcurvePoleIndices, upperPcurvePoleIndices: high.pcurvePoleIndices, uCoefficients: text(u), lowerV: text(lv), upperV: text(hv), lowerChartGaps: text(lowGap), upperChartGaps: text(highGap), gapCoefficients: text(gap), minimumLowerChartGap: q.text(min(lowGap)), minimumUpperChartGap: q.text(min(highGap)), minimumBandGap: q.text(min(gap)) };
    });
    const band = { spans: bandSpans, minimumLowerChartGap: q.text(min(bandSpans.map(span => read(span.minimumLowerChartGap)))), minimumUpperChartGap: q.text(min(bandSpans.map(span => read(span.minimumUpperChartGap)))), minimumBandGap: q.text(min(bandSpans.map(span => read(span.minimumBandGap)))) };
    const worldPoints = [lowerWorld.controlPoints[0], lowerWorld.controlPoints.at(-1), upperWorld.controlPoints.at(-1), upperWorld.controlPoints[0]], uvPoints = [lowerUV.controlPoints[0], lowerUV.controlPoints.at(-1), upperUV.controlPoints.at(-1), upperUV.controlPoints[0]];
    check(worldPoints.every((point, i) => worldPoints.slice(0, i).every(other => point.some((value, k) => value !== other[k]))), CODE.REPRESENTABILITY, 'Four pairwise distinct World positions required');
    const vertices = worldPoints.map((world, i) => ({ id: vertexIds[i], sourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, world, uv: uvPoints[i] })), line = (curveId, points) => ({ kind: 'curve', id: curveId, degree: 1, knots: [0, 0, 1, 1], controlPoints: points, weights: [1, 1] }), right = line(rightId, [worldPoints[1], worldPoints[2]]), left = line(leftId, [worldPoints[0], worldPoints[3]]), rightUV = line(rightUVId, [uvPoints[1], uvPoints[2]]), leftUV = line(leftUVId, [uvPoints[0], uvPoints[3]]);
    for (const curve of [right, left, rightUV, leftUV])
        native(() => validateCurve(curve), 'Actual new World/SurfaceUV side Line validation refused');
    const curves = [lowerWorld, right, upperWorld, left], uvCurves = [lowerUV, rightUV, upperUV, leftUV], pairs = [[0, 1], [1, 2], [3, 2], [0, 3]], roles = ['lower', 'right', 'upper', 'left'];
    const edges = curves.map((curve, i) => ({ id: edgeIds[i], role: roles[i], curve, vertexIds: pairs[i].map(index => vertexIds[index]), pcurve: { coordinateSystem: 'native-surface-uv', lengthUnit: 'dimensionless', curve: uvCurves[i] }, origin: { kind: i === 0 || i === 2 ? 'bound-section' : 'connector', sourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, bindingEvaluationId: i === 0 ? lower.options.evaluationId : i === 2 ? upper.options.evaluationId : null } }));
    const connectors = [1, 3].map((index) => {
        const edge = edges[index], originalUIndex = index === 1 ? surface.controlPoints.length - 1 : 0, expectedU = q.from(index === 1 ? sd.u[1] : sd.u[0]), row = surface.controlPoints[originalUIndex];
        check(edge.pcurve.curve.controlPoints.every(point => eq(q.from(point[0]), expectedU) && Object.is(point[2], 0)), CODE.BINDING, 'Side UV endpoints must equal fixed original U as exact fractions without changing bits');
        const mapped = edge.pcurve.curve.controlPoints.map(point => { const beta = q.div(q.sub(q.from(point[1]), v0), dv); return row[0].map((value, k) => q.add(q.from(value), q.mul(beta, q.sub(q.from(row[1][k]), q.from(value))))); }), residuals = edge.curve.controlPoints.map((point, j) => point.map((value, k) => q.sub(q.from(value), mapped[j][k]))), errors = residuals.map(row => q.sum(row.map(value => q.abs(value))));
        check(errors.every(value => value.n === 0n), CODE.REPRESENTABILITY, 'Every side Line coefficient must equal the exact original fixed-U V restriction');
        return { edgeId: edge.id, role: index === 1 ? 'right' : 'left', originalUIndex, worldEndpoints: edge.curve.controlPoints, uvEndpoints: edge.pcurve.curve.controlPoints, surfaceEndpoints: mapped.map(text), residuals: residuals.map(text), endpointL1Errors: text(errors), wholeGap: zeroBound() };
    });
    for (const edge of edges) {
        const indices = edge.vertexIds.map(value => vertexIds.indexOf(value));
        check(same(edge.curve.controlPoints[0], vertices[indices[0]].world) && same(edge.curve.controlPoints.at(-1), vertices[indices[1]].world) && same(edge.pcurve.curve.controlPoints[0], vertices[indices[0]].uv) && same(edge.pcurve.curve.controlPoints.at(-1), vertices[indices[1]].uv), CODE.BINDING, 'Stored World/UV endpoint incidence must retain actual bits');
    }
    const canonical = ['forward', 'forward', 'reverse', 'reverse'], forward = edges.map((edge, i) => { const reverse = canonical[i] === 'reverse', d = domain(edge.curve); return { id: useIds[i], edgeId: edge.id, vertexIds: reverse ? [edge.vertexIds[1], edge.vertexIds[0]] : edge.vertexIds, sense: canonical[i], interval: reverse ? [d[1], d[0]] : d, pcurveId: edge.pcurve.curve.id }; }), uses = options.orientation === 'forward' ? forward : forward.slice().reverse().map((use) => ({ ...use, vertexIds: [use.vertexIds[1], use.vertexIds[0]], sense: use.sense === 'forward' ? 'reverse' : 'forward', interval: [use.interval[1], use.interval[0]] }));
    check(uses.every((use, i) => use.vertexIds[1] === uses[(i + 1) % 4].vertexIds[0]) && new Set(uses.map(use => use.vertexIds[0])).size === 4, CODE.BINDING, 'Actual whole-oriented loop must close on four distinct vertices');
    const loop = { id: loopId, uses: uses }, face = { id: faceId, sourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, outerLoopId: loopId, orientation: options.orientation };
    const decimal = (value) => curveDecimal(value, 'Exact Surface band trim'), list = (values) => '[' + values.map(decimal).join(',') + ']', points = (values) => '[' + values.map(list).join(',') + ']';
    const source = '@model ' + options.evaluationId + ' {version:0;length-unit:mm;@surface #' + surface.id + ' {type:nurbs;degree-u:' + surface.degreeU + ';degree-v:' + surface.degreeV + ';knots-u:' + list(surface.knotsU) + ';knots-v:' + list(surface.knotsV) + ';control-points:[' + surface.controlPoints.map(points).join(',') + '];weights:[' + surface.weights.map(list).join(',') + '];}' + curves.map(curve => '@curve #' + curve.id + ' {type:nurbs;degree:' + curve.degree + ';knots:' + list(curve.knots) + ';control-points:' + points(curve.controlPoints) + ';weights:' + list(curve.weights) + ';}').join('') + '}\n';
    check(source.length <= 262144 && new TextEncoder().encode(source).length <= 262144, CODE.BUDGET, 'Actual Model5 source exceeds unchanged UTF16/UTF8 source cap');
    const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'Actual band Source0 Model5 compilation refused');
    if (!compiled.ok)
        throw new ExactSurfaceBandTrimError(CODE.NATIVE, 'Actual band Model5 compiler refused', compiled);
    check(same(compiled.model, { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [surface, ...curves] }), CODE.BINDING, 'Actual compiled Model5 must retain original Surface and all stored World Curve bits/order/IDs');
    const world = { source, sourceVersion: 0, model: compiled.model };
    const cutBindings = [lower, upper].map((binding, i) => { const edge = edges[i === 0 ? 0 : 2], bound = binding.proof.certificate.wholeCoefficientModelGap; check(read(bound.exact).n === 0n && Object.is(bound.upper, 0), CODE.BINDING, 'Whole reconstructed exact cut coefficient certificate must have zero model gap'); return { edgeId: edge.id, role: i === 0 ? 'lower' : 'upper', bindingEvaluationId: binding.options.evaluationId, worldCurveId: edge.curve.id, pcurveId: edge.pcurve.curve.id, sourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, certificate: binding.proof.certificate, spans: binding.proof.spans, wholeGap: zeroBound() }; });
    const edgeBounds = edges.map(edge => ({ edgeId: edge.id, role: edge.role, bound: zeroBound() })), faceEmbedding = { schema: 'barocss-exact-projected-vlinear-surface-band-face', version: 0, authority: 'validated-exact-cut-bindings-original-projection-and-stored-side-coefficients', sourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, lowerBindingEvaluationId: lower.options.evaluationId, upperBindingEvaluationId: upper.options.evaluationId, lowerWorldCurveId: lowerWorld.id, upperWorldCurveId: upperWorld.id, lowerPcurveId: lowerUV.id, upperPcurveId: upperUV.id, faceId, loopId, worldModelId: world.model.name, edgeIds, orientation: options.orientation, nativeDomains: sd, spanCount: n, minimumBandGap: band.minimumBandGap, normalYAbsoluteLowerBound: projection.normalYAbsoluteLowerBound, gramDeterminantLowerBound: projection.gramDeterminantLowerBound, orientedNormalYSign: options.orientation === 'forward' ? -1 : 1, wholeCoefficientModelGap: zeroBound(), closedDiskCertified: true, exactWorldSurfaceAgreement: true }, proof = { projection, band, cutBindings, connectors, edgeBounds, faceEmbedding };
    const lowerParameters = lower.observations.map(observation => observation.parameter), upperParameters = upper.observations.map(observation => observation.parameter);
    check(lowerParameters.length === 4 * n + 1 && same(lowerParameters, upperParameters), CODE.PAIR, 'Both actual original-span quartile parameter sequences must match');
    const derivativeCounts = { world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, surface: { evaluated: 0, refused: 0 } }, d1 = (key, action) => { try {
        const value = action();
        derivativeCounts[key].evaluated++;
        return { status: 'evaluated', value };
    }
    catch (cause) {
        if (!(cause instanceof Error) || !/exact C0 interior knot/.test(cause.message))
            throw new ExactSurfaceBandTrimError(CODE.NATIVE, 'Actual native D1 refused for ' + key, cause);
        derivativeCounts[key].refused++;
        return { status: 'native-refused', reason: cause.message, nativeErrorName: cause.name };
    } };
    const observations = edges.flatMap((edge, edgeIndex) => {
        const parameters = edgeIndex === 0 ? lowerParameters : edgeIndex === 2 ? upperParameters : [0, .5, 1];
        return parameters.map((parameter, index) => {
            const w = { d0: native(() => evaluateCurve(edge.curve, parameter), 'Actual World edge D0 refused'), d1: d1('world', () => evaluateCurveD1(edge.curve, parameter)) }, uv = { d0: native(() => evaluateCurve(edge.pcurve.curve, parameter), 'Actual SurfaceUV edge D0 refused'), d1: d1('pcurve', () => evaluateCurveD1(edge.pcurve.curve, parameter)) }, s = { d0: native(() => evaluateSurface(surface, uv.d0[0], uv.d0[1]), 'Original Surface D0 refused at actual band UV'), d1: d1('surface', () => evaluateSurfaceD1(surface, uv.d0[0], uv.d0[1])) };
            let chain = null;
            if (s.d1.status === 'evaluated' && uv.d1.status === 'evaluated') {
                const ds = s.d1.value, dt = uv.d1.value;
                chain = ds.du.map((value, k) => finite(finite(value * dt.derivative[0]) + finite(ds.dv[k] * dt.derivative[1])));
            }
            const pointGap = (point, state) => state.status === 'evaluated' ? gap(point, state.value.point) : null, residuals = { pointGapMM: gap(w.d0, s.d0), worldD0D1PointGapMM: pointGap(w.d0, w.d1), uvD0D1PointGap: pointGap(uv.d0, uv.d1), surfaceD0D1PointGapMM: pointGap(s.d0, s.d1), relativeChainGap: w.d1.status === 'evaluated' && chain ? finite(gap(w.d1.value.derivative, chain) / Math.max(1, finite(Math.hypot(...w.d1.value.derivative)))) : null };
            check(Object.values(residuals).every(value => value === null || value <= 1e-7), CODE.BINDING, 'Actual available native point/chain comparisons exceed band limits');
            return { edgeId: edge.id, edgeIndex, index, parameter, world: w, pcurve: uv, surface: s, chain, residuals };
        });
    });
    check(observations.length === 8 * n + 8 && observations.length <= 40 && q.counts().floatConversions === 0, CODE.BINDING, 'Complete band slots must fit40 with no root proof float conversions');
    const report = { schema: 'barocss-exact-surface-band-trim', version: 0, evaluationId: options.evaluationId, surfaceSourceId: ls.surfaceAsset.sourceId, surfaceId: surface.id, lowerBindingEvaluationId: lower.options.evaluationId, upperBindingEvaluationId: upper.options.evaluationId, lowerWorldCurveId: lowerWorld.id, upperWorldCurveId: upperWorld.id, lowerPcurveId: lowerUV.id, upperPcurveId: upperUV.id, faceId, orientation: options.orientation, lengthUnit: 'mm', uvLengthUnit: 'dimensionless', sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'original-boundary-u-and-fixed-u-side-parameters', spanCount: n, vertexCount: 4, edgeCount: 4, useCount: 4, loopCount: 1, faceCount: 1, worldObjectCount: 5, maximumWholeEdgeModelGapMM: 0, minimumBandGap: band.minimumBandGap, projection, maximumObservedPointGapMM: Math.max(...observations.map(observation => observation.residuals.pointGapMM)), maximumObservedRelativeChainGap: Math.max(...observations.map(observation => observation.residuals.relativeChainGap ?? 0)), derivativeCounts, rationalCounts: q.counts(), directCounts: { bindingValidationCount: 2, newWorldCurveValidationCount: 2, newUVValidationCount: 2, worldSourceCompilationCount: 1, observationCount: observations.length, curvePointEvaluationCount: 2 * observations.length, curveDerivativeEvaluationCount: 2 * observations.length, surfacePointEvaluationCount: observations.length, surfaceDerivativeEvaluationCount: observations.length, boundaryExtractionCount: 0 }, fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, numericPolicy: { authority: 'validated-original-surface-cut-bindings-and-stored-band-coefficients', positionAdmission: 'all-stored-world-surface-residuals-zero', ordering: 'whole-degree2-bernstein-gap-and-chart-hulls', reversal: 'whole-use-order-and-senses-only', nativeObservations: 'actual-provider-coordinates-c0-unions-no-snap', projectionRegularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1-claim', pointComparisonMM: 1e-7, relativeChainComparison: 1e-7 }, quality: { geometricValidity: 'exact-projected-surface-band-certified', faceEmbeddingCertified: true, wholeModelGapCertified: true, logicalIncidence: true, storedUVSimpleBand: true, orientedUVCycle: true, parentProofsUnchanged: true, wholeBodyTopologyCertified: false, manifoldCertified: false, solid: false, occupiedVolumeCertified: false, outwardSolidOrientationCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, generalSurfaceRegularityCertified: false, weldingPerformed: false, publication: false, ownership: 'independent-copied-cpu-data-gc' }, limits: { maximumParents: 2, maximumSpans: 4, maximumUDegree: 2, maximumUVDegree: 2, maximumWorldCutDegree: 4, maximumWorldPoles: 17, maximumObservations: 40, maximumWorldObjects: 5, prefixCharacters: 12, idCharacters: 48, maximumFileUTF16: 2097152, maximumFileUTF8: 2097152, sourceStringCharacters: 262144, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, keyCharacters: 128, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, maximumFinalFloatConversions: 0 }, workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded', budgetFailure: 'atomic-no-partial-band-face' };
    const result = { lower, upper, options, vertices, edges, loop, face, world, proof, observations, report };
    let stable = false;
    for (let step = 0; step < 8; step++) {
        const size = fileSize(result);
        if (same(size, report.fileSizes.result)) {
            stable = true;
            break;
        }
        report.fileSizes.result = size;
    }
    check(stable, CODE.BUDGET, 'Complete band JSON size metadata must reach an exact fixed point');
    return snapshot(result, true);
}
/** Fully reconstruct exact parents, stored band geometry/source/proofs and all actual native states. */
export function validateExactSurfaceBandTrim(input) {
    const owned = record(snapshot(input, true), ['lower', 'upper', 'options', 'vertices', 'edges', 'loop', 'face', 'world', 'proof', 'observations', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = buildExactSurfaceBandTrim(owned.lower, owned.upper, owned.options);
    }
    catch (cause) {
        throw new ExactSurfaceBandTrimError(CODE.OWNED, 'Whole exact Surface band reconstruction refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'Owned original bindings/World/UV/incidence/orientation/band/projection/source/native observations/counters changed');
    return snapshot(expected.report, true);
}
