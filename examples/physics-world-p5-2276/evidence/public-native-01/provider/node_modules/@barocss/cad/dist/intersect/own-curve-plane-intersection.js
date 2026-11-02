import { linearToleranceMM, geometryScaleMM } from '../numeric-policy.js';
import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import { EXACT_FIELDS_REQUIRED, OWN_RECORD, hasExactOwnFields, isOwnRecord } from '../core/own-data.js';
const LABEL = 'Own Bezier Curve-plane intersection', WIDTH = 1e-12;
function check(c, detail) { if (!c)
    throw new Error((LABEL + ': ' + detail).slice(0, 1024)); }
function finite(n) { check(Number.isFinite(n), 'finite native homogeneous/Gram arithmetic required'); return n; }
function snapshot(input, results = false) {
    let budget = results ? 131072 : 4096;
    const copy = (v, depth) => { check(--budget >= 0 && depth <= (results ? 24 : 8), 'own-data values/depth bound'); if (v === null && results)
        return null; if (typeof v === 'number') {
        check(Number.isFinite(v), 'finite own numbers');
        return v;
    } if (typeof v === 'string') {
        check(v.length <= (results ? 262144 : 128), 'bounded own string');
        return v;
    } if (typeof v === 'boolean' && results)
        return v; check(v !== null && typeof v === 'object', 'plain own data'); const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v), descriptors = Object.getOwnPropertyDescriptors(v); check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign own-data prototype'); check(keys.length <= (array ? (results ? 1025 : 65) : (results ? 32 : 16)) && keys.every(k => typeof k === 'string' && k.length <= 128 && 'value' in descriptors[k] && (array && k === 'length' || descriptors[k].enumerable === true)), 'getter/symbol/hidden/excess own data'); if (array) {
        const n = descriptors.length.value;
        check(Number.isInteger(n) && n >= 0 && n <= (results ? 1024 : 64) && keys.length === n + 1, 'dense bounded own array');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), 'sparse own array'); return copy(descriptors[String(i)].value, depth + 1); });
    } return Object.fromEntries(keys.map(k => [k, copy(descriptors[k].value, depth + 1)])); };
    return copy(input, 0);
}
function record(v, keys) { check(isOwnRecord(v), OWN_RECORD); check(hasExactOwnFields(v, keys), EXACT_FIELDS_REQUIRED + keys.join(',')); return v; }
function id(v) { check(typeof v === 'string' && v.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v), 'ASCII ID1..48 required'); return v; }
function same(a, b) { if (Array.isArray(a) || Array.isArray(b))
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i])); if (a && b && typeof a === 'object' && typeof b === 'object') {
    const x = a, y = b;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && same(x[k], y[k]));
} return Object.is(a, b); }
function delta(a, b) { return a.map((x, i) => finite(x - b[i])); }
function dot(a, b) { return finite(a.reduce((s, x, i) => { const product = finite(x * b[i]); check(x === 0 || b[i] === 0 || product !== 0, 'nonzero native dot-product term underflowed to zero'); return finite(s + product); }, 0)); }
function cross(a, b) { return [finite(a[1] * b[2] - a[2] * b[1]), finite(a[2] * b[0] - a[0] * b[2]), finite(a[0] * b[1] - a[1] * b[0])]; }
function mapParameter(d, t) { if (t === 0)
    return d[0]; if (t === 1)
    return d[1]; return finite(d[0] + (d[1] - d[0]) * t); }
function inRectangle(uv, axes) { return uv[2] === 0 && uv[0] >= axes.domains.u[0] && uv[0] <= axes.domains.u[1] && uv[1] >= axes.domains.v[0] && uv[1] <= axes.domains.v[1]; }
function uvOf(point, axes) {
    const d = delta(point, axes.originMM), du = dot(d, axes.uDirectionMM), dv = dot(d, axes.vDirectionMM), g = axes.gram;
    const u = finite(finite(du * g.vv - dv * g.uv) / g.determinant), v = finite(finite(dv * g.uu - du * g.uv) / g.determinant);
    return [mapParameter(axes.domains.u, u), mapParameter(axes.domains.v, v), 0];
}
function d1(curve, t) { try {
    return { status: 'evaluated', value: evaluateCurveD1(curve, t) };
}
catch (e) {
    return { status: 'native-refused', reason: (e instanceof Error ? e.message : 'original native D1 refused').slice(0, 1024) };
} }
function adopt(curve, plane, evaluationId) {
    const dec = (n) => curveDecimal(n, LABEL), list = (a) => '[' + a.map(dec).join(',') + ']', poles = (a) => '[' + a.map(list).join(',') + ']';
    const source = '@model ' + evaluationId + ' { version:0; length-unit:mm; @curve #' + curve.id + ' { type:nurbs; degree:' + dec(curve.degree) + '; knots:' + list(curve.knots) + '; control-points:' + poles(curve.controlPoints) + '; weights:' + list(curve.weights) + '; } @surface #' + plane.id + ' { type:nurbs; degree-u:1; degree-v:1; knots-u:' + list(plane.knotsU) + '; knots-v:' + list(plane.knotsV) + '; control-points:[' + plane.controlPoints.map(poles).join(',') + ']; weights:[' + plane.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'actual geometry source bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual original Curve/Plane source0 compilation required');
    const expected = { name: evaluationId, version: 0, lengthUnit: 'mm', objects: [curve, plane] };
    check(same(compiled.model, expected), 'actual full source0 Model original geometry/order/ID/domain/coefficient/sign adoption');
    return { source, model: compiled.model };
}
/** Trusted shared original affine-plane admission and axes; caller snapshots exact fields first. */
export function prepareCurvePlaneAxesTrusted(p) {
    check(p.kind === 'surface' && p.degreeU === 1 && p.degreeV === 1, 'original degree1x1 affine Plane Surface required');
    id(p.id);
    validateSurface(p);
    check(p.controlPoints.length === 2 && p.controlPoints.every(row => row.length === 2) && p.weights.every(row => row.every(w => Object.is(w, p.weights[0][0]))), 'four-pole equal represented-weight original plane required');
    const domains = surfaceDomain(p);
    check(Number.isFinite(domains.u[1] - domains.u[0]) && domains.u[1] > domains.u[0] && Number.isFinite(domains.v[1] - domains.v[0]) && domains.v[1] > domains.v[0], 'positive represented native Plane parameter spans');
    const O = p.controlPoints[0][0], A = delta(p.controlPoints[1][0], O), B = delta(p.controlPoints[0][1], O), affine = O.map((x, i) => finite(finite(x + A[i]) + B[i]));
    check(p.controlPoints[1][1].every((x, i) => x === affine[i]), 'non-affine bilinear patch unsupported');
    const uu = dot(A, A), vv = dot(B, B), uv = dot(A, B), product = finite(uu * vv), squared = finite(uv * uv), determinant = finite(product - squared), unsafeThreshold = finite(64 * Number.EPSILON * (Math.abs(product) + Math.abs(squared))), N = cross(A, B), magnitude = finite(Math.hypot(...N));
    check(uu > 0 && vv > 0 && magnitude > 0 && determinant > unsafeThreshold, 'independent safely represented original plane axes required');
    const axes = { originMM: O, uDirectionMM: A, vDirectionMM: B, unitNormal: N.map(x => finite(x / magnitude)), gram: { uu, uv, vv, determinant, unsafeThreshold }, domains };
    return axes;
}
/** Trusted original homogeneous plane projection; weights and coordinates are never normalized. */
export function curvePlaneCoefficientsTrusted(c, axes) {
    const O = axes.originMM;
    const values = c.controlPoints.map((point, i) => { const distance = dot(axes.unitNormal, delta(point, O)), coefficient = finite(distance * c.weights[i]); check(distance === 0 || coefficient !== 0, 'nonzero native signed-distance/weight coefficient underflowed to zero'); return coefficient; });
    return values;
}
/** Trusted shared binding of numerical roots to original native points/UV and unchanged bracket policy. */
export function bindCurvePlaneRootsTrusted(c, p, domain, axes, roots, pointEventIds) {
    // CadNumericPolicy: the 1e-7 mm floor, scaled with the geometry beyond the modeling range.
    const tol = linearToleranceMM(geometryScaleMM(c.controlPoints, p.controlPoints.flat()));
    const { domains, originMM: O } = axes;
    const events = roots.map((root, index) => {
        const parameter = mapParameter(domain, root.t), bracket = [mapParameter(domain, root.bracket[0]), mapParameter(domain, root.bracket[1])];
        check(root.t === 0 || root.t === 1 || parameter > domain[0] && parameter < domain[1], 'interior root cannot round to an original endpoint');
        check(root.bracket[0] === root.bracket[1] || bracket[0] < bracket[1], 'original root bracket is not represented');
        check(bracket[1] - bracket[0] <= WIDTH, 'original-domain root bracket width unresolved');
        const point = evaluateCurve(c, parameter), planeUV = uvOf(point, axes), signed = dot(axes.unitNormal, delta(point, O)), residualMM = Math.abs(signed);
        check(residualMM <= tol, 'actual original Curve support residual exceeds local policy');
        const samples = [...new Set([bracket[0], parameter, bracket[1]])].map(t => ({ parameter: t, point: evaluateCurve(c, t), uv: uvOf(evaluateCurve(c, t), axes) }));
        const inside = samples.every(sample => inRectangle(sample.uv, axes)), outside = samples.every(sample => sample.uv[0] < domains.u[0]) || samples.every(sample => sample.uv[0] > domains.u[1]) || samples.every(sample => sample.uv[1] < domains.v[0]) || samples.every(sample => sample.uv[1] > domains.v[1]);
        check(inside || outside, 'finite UV boundary classification unresolved across original root bracket');
        const planePointMM = inside ? evaluateSurface(p, planeUV[0], planeUV[1]) : null;
        if (planePointMM !== null)
            check(finite(Math.hypot(...delta(point, planePointMM))) <= tol, 'actual original Surface UV binding residual exceeds local policy');
        return { eventId: pointEventIds[index], parameter, normalizedParameter: root.t, bracket, normalizedBracket: root.bracket, iterations: root.iterations, kind: root.t === 0 || root.t === 1 ? 'endpoint' : root.touch ? 'touch' : 'crossing', rootTouch: root.touch, pointMM: point, planeUV, planePointMM, residualMM, classification: inside ? 'finite-domain-admitted' : 'outside-domain', finiteDomainAdmitted: inside, sideObservations: samples.map(sample => ({ parameter: sample.parameter, signedDistanceMM: dot(axes.unitNormal, delta(sample.point, O)) })), curveD1: d1(c, parameter), semantics: 'original-curve-point-at-numerical-root-not-projected-or-sewn' };
    });
    for (let i = 1; i < events.length; i++)
        check(events[i - 1].parameter < events[i].parameter && events[i - 1].bracket[1] < events[i].bracket[0], 'distinct close native roots/order must not be merged');
    return events;
}
/** Trusted shared support/finite-containment classification; no coincident clipping is inferred. */
export function classifyCurvePlaneSupportTrusted(c, axes, coincident, events) {
    const controlPoleUV = c.controlPoints.map(point => uvOf(point, axes)), contained = coincident && controlPoleUV.every(point => inRectangle(point, axes)), finiteCount = events.filter(e => e.finiteDomainAdmitted).length, kind = coincident ? 'coincident-support' : events.length === 0 ? 'support-disjoint' : finiteCount ? 'isolated' : 'finite-disjoint';
    return { controlPoleUV, contained, finiteCount, kind };
}
/** Own homogeneous support roots; original Curve points are never projected/clamped. */
export function intersectBezierCurveWithAffinePlaneSurface(curveInput, planeInput, inputOptions) {
    const curveData = snapshot(curveInput), planeData = snapshot(planeInput), optionData = snapshot(inputOptions), c = record(curveData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), p = record(planeData, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    check(c.kind === 'curve' && (c.degree === 1 || c.degree === 2), 'original degree1/2 Curve required');
    id(c.id);
    validateCurve(c);
    check(c.controlPoints.length === c.degree + 1 && c.knots.length === 2 * (c.degree + 1), 'original single clamped Bezier span required');
    const domain = curveDomain(c), span = finite(domain[1] - domain[0]);
    check(span > 0, 'positive represented original Curve span');
    const axes = prepareCurvePlaneAxesTrusted(p);
    const opts = record(optionData, ['evaluationId', 'pointEventIds']);
    const evaluationId = id(opts.evaluationId);
    check(Array.isArray(opts.pointEventIds) && opts.pointEventIds.length >= 1 && opts.pointEventIds.length <= 4, '1..4 explicit point-event IDs required');
    const pointEventIds = opts.pointEventIds.map(id);
    check(new Set([c.id, p.id, evaluationId, ...pointEventIds]).size === 3 + pointEventIds.length, 'original/evaluation/event identities must be distinct');
    const options = { evaluationId, pointEventIds };
    const values = curvePlaneCoefficientsTrusted(c, axes), equation = createHomogeneousBernsteinEquation(values, LABEL), normalizedTarget = Math.min(WIDTH, WIDTH / span);
    check(Number.isFinite(normalizedTarget) && normalizedTarget > 0, 'normalized root target not representable');
    const roots = solveHomogeneousBernsteinEquation(equation, { parameterWidthTarget: normalizedTarget, label: LABEL });
    check(roots.length <= 4 && roots.length <= pointEventIds.length, 'explicit isolated event capacity exceeded');
    const events = bindCurvePlaneRootsTrusted(c, p, domain, axes, roots, pointEventIds);
    const coincident = equation.degree === 'zero', { controlPoleUV, contained, finiteCount, kind } = classifyCurvePlaneSupportTrusted(c, axes, coincident, events), file = adopt(c, p, evaluationId);
    return copyCadData({ kind, curve: file.model.objects[0], plane: file.model.objects[1], options, ...file, sourceVersion: 0, events, report: { family: 'own-bezier-curve-affine-plane-surface', kind, evaluationId, curveId: c.id, planeId: p.id, curveDomain: domain, curveDegree: c.degree, planeAxes: axes, equation, supportEventCount: events.length, finiteEventCount: finiteCount, outsideEventCount: events.length - finiteCount, coincident: { support: coincident, finiteContainment: coincident ? contained ? 'control-hull-contained' : 'not-proven' : 'not-applicable', controlPoleUV }, numericPolicy: { parameterWidthTarget: WIDTH, normalizedParameterWidthTarget: normalizedTarget, maximumRootSteps: 64, pointBindingComparisonMM: linearToleranceMM(geometryScaleMM(c.controlPoints, p.controlPoints.flat())), uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp', gramPolicy: '64-epsilon-scaled-determinant-refusal', exactParameterDedupOnly: true }, geometricValidity: 'not-certified', topologyCertified: false, solid: false, limits: { maximumEvents: 4, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 16, authoredIdCharacters: 48 } } });
}
/** Original geometry/options rebuild; altered event/UV/bracket/source data refuses. */
export function validateBezierCurveAffinePlaneIntersection(input) {
    const owned = snapshot(input, true);
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'owned Curve-plane result required');
    const expected = intersectBezierCurveWithAffinePlaneSurface(owned.curve, owned.plane, owned.options);
    check(same(owned, expected), 'owned original geometry/events/UV/bracket/context/source/report mismatch');
    return copyCadData(expected.report);
}
