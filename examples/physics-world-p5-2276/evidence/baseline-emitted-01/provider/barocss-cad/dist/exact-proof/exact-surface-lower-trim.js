import { validateSectionExactSurfaceBinding } from '../features/section-exact-surface-binding.js';
import { extractSurfaceBoundary } from '../core/boundary.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { evaluateCurve, evaluateSurface, validateCurve } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
import { DENSE_BOUNDED_ARRAYS_REQUIRED, FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, ownSnapshot } from '../core/own-data.js';
export const ExactSurfaceLowerTrimDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', BINDING: 'BINDING', PARENT: 'PARENT', SUPPORT: 'SUPPORT', EMBEDDING: 'EMBEDDING', REPRESENTABILITY: 'REPRESENTABILITY', NATIVE: 'NATIVE', OWNED: 'OWNED' });
export class ExactSurfaceLowerTrimError extends KernelError {
    code;
    constructor(code, detail, cause) { super(('Exact original Surface lower trim: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'ExactSurfaceLowerTrimError'; this.code = code; }
}
const CODE = ExactSurfaceLowerTrimDiagnosticCode;
function check(condition, code, detail) { if (!condition)
    throw new ExactSurfaceLowerTrimError(code, detail); }
function native(action, detail, code = CODE.NATIVE) { try {
    return action();
}
catch (cause) {
    throw new ExactSurfaceLowerTrimError(code, detail, cause);
} }
function record(input, fields, code = CODE.INPUT) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required');
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
    return data;
}
function id(input) { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
const OWN = { input: CODE.INPUT, owned: CODE.OWNED, budget: CODE.BUDGET, fail: (code, detail) => { throw new ExactSurfaceLowerTrimError(code, detail); }, wrap: (code, detail, cause) => { throw new ExactSurfaceLowerTrimError(code, detail, cause); }, isRefusal: e => e instanceof ExactSurfaceLowerTrimError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };
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
/** Construct a real lower-strip Face with exact binding and a scoped original Surface embedding proof. */
export function buildExactSurfaceLowerTrim(bindingInput, optionsInput) {
    const data = record(snapshot({ binding: bindingInput, options: optionsInput }), ['binding', 'options']), settings = record(data.options, ['evaluationId', 'resultIdPrefix', 'orientation', 'maximumObservations']);
    const options = { evaluationId: id(settings.evaluationId), resultIdPrefix: id(settings.resultIdPrefix), orientation: settings.orientation, maximumObservations: settings.maximumObservations };
    check(options.resultIdPrefix.length <= 12, CODE.IDENTITY, 'ASCII prefix1..12 required');
    check(options.maximumObservations === 40, CODE.BUDGET, 'Complete fixed observation budget40 required before parent work');
    check(options.orientation === 'forward' || options.orientation === 'reverse', CODE.INPUT, 'Face orientation forward or reverse required');
    const binding = data.binding;
    native(() => validateSectionExactSurfaceBinding(binding), 'Actual complete exact Surface binding validation refused', CODE.PARENT);
    const section = binding.section, surface = section.surfaceAsset.surface, cut = section.world.curve, cutUV = binding.pcurve.curve, n = section.report.spanCount, p = surface.degreeU, sd = section.report.surfaceDomains;
    const reserved = contexts(binding), reserve = (value) => { id(value); check(!reserved.has(value), CODE.IDENTITY, 'New identities must differ from all complete original/binding/section/child contexts'); reserved.add(value); return value; };
    reserve(options.evaluationId);
    const prefix = options.resultIdPrefix, bottomId = reserve(prefix + '_bottom'), rightId = reserve(prefix + '_right'), leftId = reserve(prefix + '_left'), bottomUVId = reserve(prefix + '_bottom_uv'), rightUVId = reserve(prefix + '_right_uv'), leftUVId = reserve(prefix + '_left_uv'), vertexIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_v' + i)), edgeIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_e' + i)), useIds = Array.from({ length: 4 }, (_, i) => reserve(prefix + '_use' + i)), loopId = reserve(prefix + '_loop'), faceId = reserve(prefix + '_face');
    const q = new SectionRationalContext((kind, detail) => { throw new ExactSurfaceLowerTrimError(CODE[kind], detail); }), zero = q.integer(0), text = (v) => v.map(x => q.text(x)), read = (v) => q.rat(BigInt(v.numerator), BigInt(v.denominator)), min = (v) => v.reduce((a, b) => q.compare(a, b) <= 0 ? a : b), C = surface.weights[0][0];
    check(C > 0 && surface.weights.every(row => row.every(w => Object.is(w, C))), CODE.SUPPORT, 'Original Surface weights must remain globally identical and positive');
    const z0 = surface.controlPoints[0][0][2], z1 = surface.controlPoints[0][1][2];
    check(surface.controlPoints.every(row => Object.is(row[0][0], row[1][0]) && Object.is(row[0][2], z0) && Object.is(row[1][2], z1)), CODE.EMBEDDING, 'Original X must depend only on U and original Z only on V, with matching represented bits');
    const zr0 = q.from(z0), zr1 = q.from(z1), v0 = q.from(sd.v[0]), v1 = q.from(sd.v[1]), dv = q.sub(v1, v0), zDerivative = q.div(q.sub(zr1, zr0), dv);
    check(q.compare(zDerivative, zero) > 0, CODE.EMBEDDING, 'The exact original native-V Z derivative must be strictly positive');
    const projectionSpans = section.proof.spans.map(span => { const x = span.originalPoleIndices.map(i => q.from(surface.controlPoints[i][0][0])), length = q.sub(q.from(span.domain[1]), q.from(span.domain[0])), derivative = x.slice(0, -1).map((value, i) => q.div(q.mul(q.integer(p), q.sub(x[i + 1], value)), length)); check(derivative.every(value => q.compare(value, zero) > 0), CODE.EMBEDDING, 'All exact original native-U X derivative Bernstein coefficients must be strictly positive'); return { index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, xCoefficients: text(x), xDerivativeDegree: p - 1, xDerivativeCoefficients: text(derivative), minimumXDerivative: q.text(min(derivative)) }; });
    const minimumXDerivative = min(projectionSpans.map(span => read(span.minimumXDerivative))), normalLower = q.mul(minimumXDerivative, zDerivative), gramLower = q.mul(normalLower, normalLower), projection = { spans: projectionSpans, z0: q.text(zr0), z1: q.text(zr1), zDerivative: q.text(zDerivative), minimumXDerivative: q.text(minimumXDerivative), normalYAbsoluteLowerBound: q.text(normalLower), gramDeterminantLowerBound: q.text(gramLower) };
    const lowerDistances = cutUV.controlPoints.map(point => q.sub(q.from(point[1]), v0)), upperDistances = cutUV.controlPoints.map(point => q.sub(v1, q.from(point[1])));
    check([...lowerDistances, ...upperDistances].every(value => q.compare(value, zero) > 0), CODE.BINDING, 'Every actual cut UV control must be strictly inside the original V chart');
    const bottom = native(() => extractSurfaceBoundary(surface, { boundary: 'v-min', id: bottomId }), 'Actual original v-min boundary extraction refused');
    check(bottom.degree === p && same(bottom.knots, surface.knotsU) && same(bottom.controlPoints, surface.controlPoints.map(row => row[0])) && same(bottom.weights, surface.weights.map(row => row[0])), CODE.BINDING, 'Natural boundary must retain exact original degree/U knots/poles/weights');
    const naturalBoundary = { curveId: bottom.id, spans: section.proof.spans.map(span => { const original = span.originalPoleIndices.map(i => surface.controlPoints[i][0].map(v => q.from(v))), stored = span.originalPoleIndices.map(i => bottom.controlPoints[i].map(v => q.from(v))), residuals = stored.map((row, i) => row.map((value, k) => q.sub(value, original[i][k]))); check(residuals.every(row => row.every(value => value.n === 0n)), CODE.REPRESENTABILITY, 'Every stored natural boundary coefficient must equal original V-min restriction exactly'); return { index: span.index, domain: span.domain, originalPoleIndices: span.originalPoleIndices, bottomPoleIndices: span.originalPoleIndices, originalCartesian: original.map(text), storedCartesian: stored.map(text), residuals: residuals.map(text) }; }), wholeGap: q.bound(zero) };
    const bottomUV = { kind: 'curve', id: bottomUVId, degree: 1, knots: [sd.u[0], sd.u[0], sd.u[1], sd.u[1]], controlPoints: [[sd.u[0], sd.v[0], 0], [sd.u[1], sd.v[0], 0]], weights: [1, 1] };
    // This global Line has U(t)=t on its original domain; it does not borrow multi-span World knots.
    check(domain(bottomUV).every((value, i) => Object.is(value, sd.u[i])) && bottomUV.controlPoints.every((point, i) => Object.is(point[0], sd.u[i]) && Object.is(point[1], sd.v[0])), CODE.BINDING, 'Actual global bottom UV must be the original-domain identity Line');
    const worldPoints = [bottom.controlPoints[0], bottom.controlPoints.at(-1), cut.controlPoints.at(-1), cut.controlPoints[0]], uvPoints = [bottomUV.controlPoints[0], bottomUV.controlPoints[1], cutUV.controlPoints.at(-1), cutUV.controlPoints[0]];
    check(worldPoints.every((point, i) => worldPoints.slice(0, i).every(other => point.some((value, k) => value !== other[k]))), CODE.REPRESENTABILITY, 'Four pairwise distinct represented World vertices required');
    const vertices = worldPoints.map((world, i) => ({ id: vertexIds[i], sourceId: section.surfaceAsset.sourceId, surfaceId: surface.id, world, uv: uvPoints[i] })), line = (id, points) => ({ kind: 'curve', id, degree: 1, knots: [0, 0, 1, 1], controlPoints: points, weights: [1, 1] }), right = line(rightId, [worldPoints[1], worldPoints[2]]), left = line(leftId, [worldPoints[3], worldPoints[0]]), rightUV = line(rightUVId, [uvPoints[1], uvPoints[2]]), leftUV = line(leftUVId, [uvPoints[3], uvPoints[0]]);
    for (const curve of [right, left, bottomUV, rightUV, leftUV])
        native(() => validateCurve(curve), 'Actual new World/SurfaceUV Line validation refused');
    const curves = [bottom, right, cut, left], uvCurves = [bottomUV, rightUV, cutUV, leftUV], pairs = [[0, 1], [1, 2], [3, 2], [3, 0]], roles = ['bottom', 'right', 'cut', 'left'];
    const edges = curves.map((curve, i) => ({ id: edgeIds[i], role: roles[i], curve, vertexIds: pairs[i].map(v => vertexIds[v]), pcurve: { coordinateSystem: 'native-surface-uv', lengthUnit: 'dimensionless', curve: uvCurves[i] }, origin: { kind: i === 0 ? 'natural-boundary' : i === 2 ? 'bound-section' : 'connector', sourceId: section.surfaceAsset.sourceId, surfaceId: surface.id } }));
    const connectors = [1, 3].map((i) => {
        const edge = edges[i], originalUIndex = i === 1 ? surface.controlPoints.length - 1 : 0, row = surface.controlPoints[originalUIndex], expectedU = i === 1 ? sd.u[1] : sd.u[0];
        check(edge.pcurve.curve.controlPoints.every(point => Object.is(point[0], expectedU) && Object.is(point[2], 0)), CODE.BINDING, 'Both side UV endpoints must retain the actual fixed original U boundary bits');
        const mapped = edge.pcurve.curve.controlPoints.map(point => { const beta = q.div(q.sub(q.from(point[1]), v0), dv); return row[0].map((value, k) => q.add(q.from(value), q.mul(beta, q.sub(q.from(row[1][k]), q.from(value))))); }), residuals = edge.curve.controlPoints.map((point, j) => point.map((value, k) => q.sub(q.from(value), mapped[j][k]))), errors = residuals.map(row => q.sum(row.map(value => q.abs(value))));
        check(errors.every(value => value.n === 0n), CODE.REPRESENTABILITY, 'Every stored side Line endpoint must match the original affine V restriction exactly');
        return { edgeId: edge.id, originalUIndex, worldEndpoints: edge.curve.controlPoints, uvEndpoints: edge.pcurve.curve.controlPoints, surfaceEndpoints: mapped.map(text), residuals: residuals.map(text), endpointL1Errors: text(errors), wholeGap: q.bound(zero) };
    });
    const forward = edges.map((edge, i) => { const reverse = i === 2, d = domain(edge.curve); return { id: useIds[i], edgeId: edge.id, vertexIds: reverse ? [edge.vertexIds[1], edge.vertexIds[0]] : edge.vertexIds, sense: reverse ? 'reverse' : 'forward', interval: reverse ? [d[1], d[0]] : d, pcurveId: edge.pcurve.curve.id }; });
    const uses = options.orientation === 'forward' ? forward : forward.slice().reverse().map((use) => ({ ...use, vertexIds: [use.vertexIds[1], use.vertexIds[0]], sense: use.sense === 'forward' ? 'reverse' : 'forward', interval: [use.interval[1], use.interval[0]] })), loop = { id: loopId, uses: uses };
    check(uses.every((use, i) => use.vertexIds[1] === uses[(i + 1) % 4].vertexIds[0]) && new Set(uses.map(use => use.vertexIds[0])).size === 4, CODE.BINDING, 'The selected whole oriented loop must close on four distinct vertices');
    for (const edge of edges) {
        const ids = edge.vertexIds.map(value => vertexIds.indexOf(value));
        check(same(edge.curve.controlPoints[0], vertices[ids[0]].world) && same(edge.curve.controlPoints.at(-1), vertices[ids[1]].world) && same(edge.pcurve.curve.controlPoints[0], vertices[ids[0]].uv) && same(edge.pcurve.curve.controlPoints.at(-1), vertices[ids[1]].uv), CODE.BINDING, 'Actual stored World/UV endpoint incidence must agree bitwise');
    }
    const face = { id: faceId, sourceId: section.surfaceAsset.sourceId, surfaceId: surface.id, outerLoopId: loopId, orientation: options.orientation };
    const decimal = (value) => curveDecimal(value, 'Exact Surface lower trim'), list = (values) => '[' + values.map(decimal).join(',') + ']', points = (values) => '[' + values.map(list).join(',') + ']';
    const source = '@model ' + options.evaluationId + ' {version:0;length-unit:mm;@surface #' + surface.id + ' {type:nurbs;degree-u:' + surface.degreeU + ';degree-v:' + surface.degreeV + ';knots-u:' + list(surface.knotsU) + ';knots-v:' + list(surface.knotsV) + ';control-points:[' + surface.controlPoints.map(points).join(',') + '];weights:[' + surface.weights.map(list).join(',') + '];}' + edges.map(edge => '@curve #' + edge.curve.id + ' {type:nurbs;degree:' + edge.curve.degree + ';knots:' + list(edge.curve.knots) + ';control-points:' + points(edge.curve.controlPoints) + ';weights:' + list(edge.curve.weights) + ';}').join('') + '}\n';
    check(source.length <= 262144, CODE.BUDGET, 'Actual Model5 source exceeds the ASCII source cap');
    const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'Actual original-Surface/World Model5 compiler refused');
    if (!compiled.ok)
        throw new ExactSurfaceLowerTrimError(CODE.NATIVE, 'Actual Source0 Model5 compilation failed', compiled);
    check(same(compiled.model, { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [surface, ...curves] }), CODE.BINDING, 'Actual Model5 must retain the complete original Surface and all actual stored World Curve bits');
    const world = { source, sourceVersion: 0, model: compiled.model };
    const edgeBounds = edges.map(edge => ({ edgeId: edge.id, role: edge.role, bound: q.bound(zero) })), faceEmbedding = { schema: 'barocss-exact-projected-vlinear-lower-strip-face', version: 0, authority: 'exact-stored-coefficients-original-projected-surface-and-oriented-loop', sourceId: section.surfaceAsset.sourceId, surfaceId: surface.id, bindingEvaluationId: binding.options.evaluationId, worldCurveId: cut.id, newUVId: cutUV.id, faceId, loopId, worldModelId: world.model.name, edgeIds, orientation: options.orientation, nativeDomains: sd, spanCount: n, wholeWorldSurfaceGap: q.bound(zero), UVminimumVGap: q.text(min(lowerDistances)), UVminimumUpperGap: q.text(min(upperDistances)), closedDiskCertified: true, exactWorldSurfaceAgreement: true }, proof = { projection, naturalBoundary, connectors, edgeBounds, faceEmbedding };
    const derivativeCounts = { world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, surface: { evaluated: 0, refused: 0 } }, d1 = (key, action) => { try {
        const value = action();
        derivativeCounts[key].evaluated++;
        return { status: 'evaluated', value };
    }
    catch (cause) {
        if (!(cause instanceof Error) || !/exact C0 interior knot/.test(cause.message))
            throw new ExactSurfaceLowerTrimError(CODE.NATIVE, 'Actual native D1 refused for ' + key, cause);
        derivativeCounts[key].refused++;
        return { status: 'native-refused', reason: cause.message, nativeErrorName: cause.name };
    } };
    const observations = edges.flatMap((edge, edgeIndex) => { const parameters = edgeIndex === 0 || edgeIndex === 2 ? binding.observations.map(observation => observation.parameter) : [0, .5, 1]; return parameters.map((parameter, index) => { const w = { d0: native(() => evaluateCurve(edge.curve, parameter), 'Actual World edge D0 refused'), d1: d1('world', () => evaluateCurveD1(edge.curve, parameter)) }, uv = { d0: native(() => evaluateCurve(edge.pcurve.curve, parameter), 'Actual SurfaceUV edge D0 refused'), d1: d1('pcurve', () => evaluateCurveD1(edge.pcurve.curve, parameter)) }, s = { d0: native(() => evaluateSurface(surface, uv.d0[0], uv.d0[1]), 'Original Surface D0 refused at actual edge UV'), d1: d1('surface', () => evaluateSurfaceD1(surface, uv.d0[0], uv.d0[1])) }; let chain = null; if (s.d1.status === 'evaluated' && uv.d1.status === 'evaluated') {
        const ds = s.d1.value, dt = uv.d1.value;
        chain = ds.du.map((value, k) => finite(finite(value * dt.derivative[0]) + finite(ds.dv[k] * dt.derivative[1])));
    } const pointGap = (point, state) => state.status === 'evaluated' ? gap(point, state.value.point) : null, residuals = { pointGapMM: gap(w.d0, s.d0), worldD0D1PointGapMM: pointGap(w.d0, w.d1), uvD0D1PointGap: pointGap(uv.d0, uv.d1), surfaceD0D1PointGapMM: pointGap(s.d0, s.d1), relativeChainGap: w.d1.status === 'evaluated' && chain ? finite(gap(w.d1.value.derivative, chain) / Math.max(1, finite(Math.hypot(...w.d1.value.derivative)))) : null }; check(Object.values(residuals).every(value => value === null || value <= 1e-7), CODE.BINDING, 'Actual available native point/chain comparisons exceed limits'); return { edgeId: edge.id, edgeIndex, index, parameter, world: w, pcurve: uv, surface: s, chain, residuals }; }); });
    check(observations.length === 2 * (4 * n + 1) + 6 && observations.length <= options.maximumObservations, CODE.BINDING, 'All actual original-span/side-Line observations must fit40');
    const report = { schema: 'barocss-exact-surface-lower-trim', version: 0, evaluationId: options.evaluationId, surfaceSourceId: section.surfaceAsset.sourceId, surfaceId: surface.id, bindingEvaluationId: binding.options.evaluationId, worldCurveId: cut.id, newUVId: cutUV.id, faceId, orientation: options.orientation, lengthUnit: 'mm', uvLengthUnit: 'dimensionless', sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'original-edge-parameters-and-native-surface-uv', spanCount: n, vertexCount: 4, edgeCount: 4, useCount: 4, loopCount: 1, faceCount: 1, worldObjectCount: 5, maximumWholeEdgeModelGapMM: 0, projection, maximumObservedPointGapMM: Math.max(...observations.map(o => o.residuals.pointGapMM)), maximumObservedRelativeChainGap: Math.max(...observations.map(o => o.residuals.relativeChainGap ?? 0)), derivativeCounts, rationalCounts: q.counts(), directCounts: { bindingValidationCount: 1, boundaryExtractionCount: 1, newWorldCurveValidationCount: 2, newUVValidationCount: 3, worldSourceCompilationCount: 1, observationCount: observations.length, curvePointEvaluationCount: 2 * observations.length, curveDerivativeEvaluationCount: 2 * observations.length, surfacePointEvaluationCount: observations.length, surfaceDerivativeEvaluationCount: observations.length }, quality: { geometricValidity: 'exact-projected-surface-strip-certified', faceEmbeddingCertified: true, wholeModelGapCertified: true, logicalIncidence: true, storedUVSimpleStrip: true, orientedUVCycle: true, parentProofsUnchanged: true, wholeBodyTopologyCertified: false, manifoldCertified: false, solid: false, occupiedVolumeCertified: false, outwardSolidOrientationCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, generalSurfaceRegularityCertified: false, weldingPerformed: false, ownership: 'independent-copied-cpu-data-gc' }, numericPolicy: { authority: 'exact-original-projected-surface-and-stored-edges', positionAdmission: 'all-stored-world-surface-residuals-zero', reversal: 'whole-use-order-and-senses-only', nativeObservations: 'actual-provider-coordinates-c0-unions-no-snap', projectionRegularity: 'per-smooth-patch-and-one-sided-endpoints-no-global-c1-claim', pointComparisonMM: 1e-7, relativeChainComparison: 1e-7 }, limits: { maximumSpans: 4, maximumUDegree: 2, maximumUVDegree: 2, maximumWorldCutDegree: 4, maximumWorldPoles: 17, maximumNaturalPoles: 9, maximumObservations: 40, maximumWorldObjects: 5, prefixCharacters: 12, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000 }, workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded', budgetFailure: 'atomic-no-partial-face' };
    return snapshot({ binding, options, vertices, edges, loop, face, world, proof, observations, report }, true);
}
/** Reconstruct the full binding, real edges/Source0, projection/Face proof and actual native observations. */
export function validateExactSurfaceLowerTrim(input) { const owned = record(snapshot(input, true), ['binding', 'options', 'vertices', 'edges', 'loop', 'face', 'world', 'proof', 'observations', 'report'], CODE.OWNED); let expected; try {
    expected = buildExactSurfaceLowerTrim(owned.binding, owned.options);
}
catch (cause) {
    throw new ExactSurfaceLowerTrimError(CODE.OWNED, 'Whole exact lower-strip Face reconstruction refused', cause);
} check(same(owned, expected), CODE.OWNED, 'Owned original binding/World/UV/incidence/orientation/embedding/source/native observations/counters changed'); return snapshot(expected.report, true); }
