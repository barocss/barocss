import { CadNumericPolicy, linearToleranceMM, geometryScaleMM } from '../numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import { splitCurveAtParameter } from '../nurbs/curves/curve-parameter-split.js';
import { intersectCurveWithAffinePlaneSurface } from './own-multispan-curve-plane.js';
import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import { EXACT_FIELDS_REQUIRED, OWN_RECORD, hasExactOwnFields, isOwnRecord } from '../core/own-data.js';
const LABEL = 'Own coplanar Curve-line intersection', WIDTH = 1e-12;
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
function restrict(curve, domain, outputId, temporary) {
    let current = copyCadData(curve);
    const provenance = [];
    if (domain[0] > curveDomain(current)[0]) {
        const split = splitCurveAtParameter(current, { parameter: domain[0], lowerCurveId: temporary(), upperCurveId: temporary() });
        check(split.refined.controlPoints.length <= 16, 'inherited temporary pole bound');
        provenance.push(split.provenance);
        current = split.upper;
    }
    if (domain[1] < curveDomain(current)[1]) {
        const split = splitCurveAtParameter(current, { parameter: domain[1], lowerCurveId: temporary(), upperCurveId: temporary() });
        check(split.refined.controlPoints.length <= 16, 'inherited temporary pole bound');
        provenance.push(split.provenance);
        current = split.lower;
    }
    current.id = outputId;
    check(same(curveDomain(current), domain), 'actual restriction must retain the represented interval bits');
    validateCurve(current);
    return { curve: current, provenance };
}
function uvProvenance(provenance) {
    // Retain coefficient maps only. The inherited splitter's temporary mm source/report is not UV authority.
    return provenance.map(p => ({ sourceCurveId: p.sourceCurveId, parameter: p.parameter, firstRefinedKnotIndex: p.firstRefinedKnotIndex,
        refinement: { kind: p.refinement.kind, insertions: p.refinement.insertions }, lower: p.lower, upper: p.upper,
        shared: { refinedPoleIndex: p.shared.refinedPoleIndex, lowerPoleIndex: p.shared.lowerPoleIndex, upperPoleIndex: p.shared.upperPoleIndex, pointUV: p.shared.point, weight: p.shared.weight } }));
}
function multiply(a, b) { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, 'nonzero homogeneous product underflowed to zero'); return value; }
function adopt(curve, line, plane, evaluationId) {
    const dec = (n) => curveDecimal(n, LABEL), list = (a) => '[' + a.map(dec).join(',') + ']', poles = (a) => '[' + a.map(list).join(',') + ']';
    const curveSource = (c) => '@curve #' + c.id + ' { type:nurbs; degree:' + dec(c.degree) + '; knots:' + list(c.knots) + '; control-points:' + poles(c.controlPoints) + '; weights:' + list(c.weights) + '; } ';
    const source = '@model ' + evaluationId + ' { version:0; length-unit:mm; ' + curveSource(curve) + curveSource(line) + '@surface #' + plane.id + ' { type:nurbs; degree-u:1; degree-v:1; knots-u:' + list(plane.knotsU) + '; knots-v:' + list(plane.knotsV) + '; control-points:[' + plane.controlPoints.map(poles).join(',') + ']; weights:[' + plane.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'actual geometry source bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual original Curve/Line/Plane source0 compilation required');
    check(same(compiled.model, { name: evaluationId, version: 0, lengthUnit: 'mm', objects: [curve, line, plane] }), 'full native source0 coefficient/ID/domain/sign adoption');
    return { source, model: compiled.model };
}
/** Actual coplanar rational spans against an original finite native Line Curve. */
export function intersectCoplanarCurveWithLineSegment(curveInput, lineInput, planeInput, inputOptions) {
    const curveData = snapshot(curveInput), lineData = snapshot(lineInput), planeData = snapshot(planeInput), optionData = snapshot(inputOptions);
    const c = record(curveData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), l = record(lineData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), p = record(planeData, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    id(c.id);
    id(l.id);
    id(p.id);
    validateCurve(c);
    validateCurve(l);
    check(c.kind === 'curve' && (c.degree === 1 || c.degree === 2) && c.controlPoints.length <= 12, 'original degree1/2 Curve with at most12 poles required');
    check(l.kind === 'curve' && l.degree === 1 && l.controlPoints.length === 2 && l.knots.length === 4 && Object.is(l.weights[0], l.weights[1]), 'actual equal-weight degree1 two-pole Line required');
    check(l.controlPoints[0].some((value, i) => value !== l.controlPoints[1][i]), 'nondegenerate native Line required');
    // CadNumericPolicy: mm bindings use the scaled linear tolerance; dimensionless UV bindings keep their own.
    const tol = linearToleranceMM(geometryScaleMM(c.controlPoints, l.controlPoints, p.controlPoints.flat())), uvTol = CadNumericPolicy.uvBindingTolerance;
    const domain = curveDomain(c), lineDomain = curveDomain(l), breaks = [domain[0]];
    for (const knot of c.knots)
        if (knot > domain[0] && knot < domain[1] && !breaks.some(value => value === knot))
            breaks.push(knot);
    breaks.push(domain[1]);
    check(breaks.length <= 9, 'at most8 nonzero original spans required');
    check(Number.isFinite(lineDomain[1] - lineDomain[0]) && lineDomain[1] > lineDomain[0], 'positive represented original Line domain required');
    const o = record(optionData, ['evaluationId', 'derivedSpanIds', 'pointEventIds', 'overlapIds', 'spanBindingIds', 'overlapBindingIds', 'boundaryContactIds']);
    const ids = (value, min, max) => { check(Array.isArray(value) && value.length >= min && value.length <= max, 'bounded explicit ID array required'); return value.map(id); };
    const options = { evaluationId: id(o.evaluationId), derivedSpanIds: ids(o.derivedSpanIds, breaks.length - 1, breaks.length - 1), spanBindingIds: ids(o.spanBindingIds, breaks.length - 1, breaks.length - 1), pointEventIds: ids(o.pointEventIds, 1, 16), overlapIds: ids(o.overlapIds, 1, 32), overlapBindingIds: ids(o.overlapBindingIds, 1, 32), boundaryContactIds: ids(o.boundaryContactIds, 1, 64) };
    check(options.overlapBindingIds.length === options.overlapIds.length, 'one explicit UV binding ID per overlap capacity required');
    const all = [c.id, l.id, p.id, options.evaluationId, ...options.derivedSpanIds, ...options.spanBindingIds, ...options.pointEventIds, ...options.overlapIds, ...options.overlapBindingIds, ...options.boundaryContactIds], reserved = new Set(all);
    check(reserved.size === all.length, 'original/evaluation/span/event/overlap/binding identities must be distinct');
    let serial = 0;
    const temporary = () => { let value; do {
        check(++serial <= 2048, 'bounded internal identity allocation');
        value = '__curve_line_tmp_' + serial;
    } while (reserved.has(value)); reserved.add(value); return value; };
    const parent = intersectCurveWithAffinePlaneSurface(c, p, { evaluationId: temporary(), derivedSpanIds: options.derivedSpanIds, pointEventIds: Array.from({ length: 16 }, temporary) }), axes = parent.report.planeAxes;
    for (const curve of [c, l])
        for (const [i, point] of curve.controlPoints.entries()) {
            const signed = dot(axes.unitNormal, delta(point, axes.originMM)), coefficient = multiply(signed, curve.weights[i]);
            check(coefficient === 0, 'original homogeneous Curve/Line coplanarity is not proven');
        }
    check(parent.spans.every(span => span.intersection.report.coincident.support), 'every actual extracted span must have proven original Plane support coincidence');
    const lineStart = uvOf(l.controlPoints[0], axes), lineEnd = uvOf(l.controlPoints[1], axes), lineDirection = delta(lineEnd, lineStart);
    check(inRectangle(lineStart, axes) && inRectangle(lineEnd, axes), 'original Line endpoints must lie inside the finite native Plane domain');
    const dominantAxis = Math.abs(lineDirection[0]) >= Math.abs(lineDirection[1]) ? 0 : 1;
    check(lineDirection[dominantAxis] !== 0, 'native Line dominant UV axis not represented');
    const coordinate = (uv) => { const difference = finite(uv[dominantAxis] - lineStart[dominantAxis]), value = finite(difference / lineDirection[dominantAxis]); check(difference === 0 || value !== 0, 'nonzero native dominant-axis coordinate underflowed to zero'); return value; };
    const signedLine = (uv) => finite(multiply(finite(uv[0] - lineStart[0]), lineDirection[1]) - multiply(finite(uv[1] - lineStart[1]), lineDirection[0]));
    const binding = (parameter) => {
        const pointMM = evaluateCurve(c, parameter), planeUV = uvOf(pointMM, axes), lineCoordinate = coordinate(planeUV), lineParameter = mapParameter(lineDomain, lineCoordinate), segmentDomainAdmitted = lineCoordinate >= 0 && lineCoordinate <= 1, planeDomainAdmitted = inRectangle(planeUV, axes);
        check(lineCoordinate === 0 || lineCoordinate === 1 || lineCoordinate > 0 && lineCoordinate < 1 ? lineCoordinate === 0 || lineCoordinate === 1 || lineParameter > lineDomain[0] && lineParameter < lineDomain[1] : lineCoordinate < 0 ? lineParameter < lineDomain[0] : lineParameter > lineDomain[1], 'original Line parameter mapping rounded across an endpoint');
        const linePointMM = segmentDomainAdmitted ? evaluateCurve(l, lineParameter) : null, planePointMM = planeDomainAdmitted ? evaluateSurface(p, planeUV[0], planeUV[1]) : null;
        const lineBindingDifferenceMM = linePointMM === null ? null : finite(Math.hypot(...delta(pointMM, linePointMM))), surfaceBindingDifferenceMM = planePointMM === null ? null : finite(Math.hypot(...delta(pointMM, planePointMM))), dimensionlessSupportResidual = Math.abs(signedLine(planeUV));
        check(dimensionlessSupportResidual <= uvTol, 'actual original Curve signed-line residual exceeds local policy');
        check(lineBindingDifferenceMM === null || lineBindingDifferenceMM <= tol, 'actual original Curve/Line binding exceeds local policy');
        check(surfaceBindingDifferenceMM === null || surfaceBindingDifferenceMM <= tol, 'actual original Curve/Plane binding exceeds local policy');
        check(!segmentDomainAdmitted || planeDomainAdmitted, 'finite Line hit has unresolved finite Plane UV admission');
        return { parameter, pointMM, planeUV, lineCoordinate, lineParameter, segmentDomainAdmitted, planeDomainAdmitted, linePointMM, planePointMM, lineBindingDifferenceMM, surfaceBindingDifferenceMM, dimensionlessSupportResidual, originalCurveD1: d1(c, parameter), lineD1: segmentDomainAdmitted ? d1(l, lineParameter) : null };
    };
    const contribution = (span, root) => {
        const parameter = mapParameter(span.domain, root.t), bracket = [mapParameter(span.domain, root.bracket[0]), mapParameter(span.domain, root.bracket[1])];
        check(root.t === 0 || root.t === 1 || parameter > span.domain[0] && parameter < span.domain[1], 'interior root rounded to original span endpoint');
        check(root.bracket[0] === root.bracket[1] || bracket[0] < bracket[1], 'native root bracket not represented');
        check(bracket[1] - bracket[0] <= WIDTH, 'original native root bracket width unresolved');
        const spanPointMM = evaluateCurve(span.curve, parameter), originalPointMM = evaluateCurve(c, parameter), pointDifferenceMM = finite(Math.hypot(...delta(spanPointMM, originalPointMM)));
        check(pointDifferenceMM <= tol, 'actual original/extracted Curve root binding exceeds local policy');
        return { spanId: span.spanId, parameter, bracket, normalizedParameter: root.t, normalizedBracket: root.bracket, iterations: root.iterations, touch: root.touch, spanPointMM, originalPointMM, pointDifferenceMM, spanCurveD1: d1(span.curve, parameter), originalCurveD1: d1(c, parameter) };
    };
    const spans = [], overlaps = [], pointGroups = [], boundaryGroups = [];
    let boundaryContributionCount = 0;
    for (const [index, span] of parent.spans.entries()) {
        const uvCurve = { kind: 'curve', id: options.spanBindingIds[index], degree: span.curve.degree, knots: copyCadData(span.curve.knots), controlPoints: span.curve.controlPoints.map(point => uvOf(point, axes)), weights: copyCadData(span.curve.weights) };
        validateCurve(uvCurve);
        const equation = createHomogeneousBernsteinEquation(uvCurve.controlPoints.map((uv, i) => { const weightedU = multiply(finite(uv[0] - lineStart[0]), uvCurve.weights[i]), weightedV = multiply(finite(uv[1] - lineStart[1]), uvCurve.weights[i]), coefficient = finite(multiply(weightedU, lineDirection[1]) - multiply(weightedV, lineDirection[0])), signed = signedLine(uv); multiply(signed, uvCurve.weights[i]); check(signed === 0 || coefficient !== 0, 'nonzero native signed-line/weight coefficient rounded to zero'); return coefficient; }), LABEL), target = Math.min(WIDTH, WIDTH / finite(span.domain[1] - span.domain[0]));
        check(Number.isFinite(target) && target > 0, 'normalized root-width target not represented');
        const recordSpan = { spanId: span.spanId, domain: span.domain, uvCurve, coordinateSystem: 'uv', equation, collinearSupport: equation.degree === 'zero', boundaryEquations: [], monotonicity: null, outsideIntervals: [] };
        spans.push(recordSpan);
        if (equation.degree !== 'zero') {
            for (const root of solveHomogeneousBernsteinEquation(equation, { parameterWidthTarget: target, label: LABEL })) {
                const evidence = contribution(span, root);
                let group = pointGroups.find(item => item.parameter === evidence.parameter);
                if (!group) {
                    group = { parameter: evidence.parameter, contributions: [] };
                    pointGroups.push(group);
                }
                group.contributions.push(evidence);
            }
            continue;
        }
        const q = uvCurve.controlPoints.map(coordinate), w = uvCurve.weights;
        const numerator = span.curve.degree === 1 ? [multiply(multiply(w[0], w[1]), finite(q[1] - q[0]))] : [
            multiply(2, multiply(multiply(w[0], w[1]), finite(q[1] - q[0]))), multiply(multiply(w[0], w[2]), finite(q[2] - q[0])), multiply(2, multiply(multiply(w[1], w[2]), finite(q[2] - q[1])))
        ];
        const forward = numerator.every(value => value >= 0) && numerator.some(value => value > 0), reverse = numerator.every(value => value <= 0) && numerator.some(value => value < 0);
        check(forward || reverse, 'collinear span monotonicity/constant/turning coordinate is not proven');
        recordSpan.monotonicity = { orientation: forward ? 'forward' : 'reverse', derivativeNumeratorBernstein: numerator };
        const roots = [];
        for (const boundary of ['line-start', 'line-end']) {
            const value = boundary === 'line-start' ? 0 : 1, e = createHomogeneousBernsteinEquation(q.map((qi, i) => multiply(finite(qi - value), w[i])), LABEL);
            recordSpan.boundaryEquations.push({ boundary, equation: e });
            check(e.degree !== 'zero', 'constant collinear boundary support has no proven oriented interval');
            for (const root of solveHomogeneousBernsteinEquation(e, { parameterWidthTarget: target, label: LABEL })) {
                check(++boundaryContributionCount <= 64, 'overlap boundary contribution capacity exceeded');
                const base = contribution(span, root), residual = Math.abs(finite(coordinate(evaluateCurve(uvCurve, base.parameter)) - value));
                check(residual <= uvTol, 'dimensionless line boundary-root residual exceeds local policy');
                const evidence = { ...base, boundary, dimensionlessBoundaryResidual: residual };
                roots.push(evidence);
                let group = boundaryGroups.find(item => item.parameter === evidence.parameter);
                if (!group) {
                    group = { parameter: evidence.parameter, contributions: [] };
                    boundaryGroups.push(group);
                }
                group.contributions.push(evidence);
            }
        }
        const partitions = [{ parameter: span.domain[0], contributions: [] }, { parameter: span.domain[1], contributions: [] }];
        for (const root of roots) {
            let part = partitions.find(item => item.parameter === root.parameter);
            if (!part) {
                part = { parameter: root.parameter, contributions: [] };
                partitions.push(part);
            }
            part.contributions.push(root);
        }
        partitions.sort((a, b) => a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0);
        for (let i = 1; i < partitions.length; i++) {
            const left = partitions[i - 1], right = partitions[i], low = left.contributions.length ? Math.max(...left.contributions.map(c => c.bracket[1])) : left.parameter, high = right.contributions.length ? Math.min(...right.contributions.map(c => c.bracket[0])) : right.parameter;
            check(low < high, 'distinct overlap boundary roots/brackets cannot be merged');
            const mid = finite(left.parameter + finite(right.parameter - left.parameter) / 2);
            check(mid > left.parameter && mid < right.parameter, 'overlap partition midpoint not represented');
            const middle = coordinate(uvOf(evaluateCurve(c, mid), axes));
            if (middle < 0 || middle > 1) {
                recordSpan.outsideIntervals.push([left.parameter, right.parameter]);
                continue;
            }
            check(low < mid && mid < high, 'inward root endpoints leave no represented overlap interval');
            const ends = [binding(low), binding(high)];
            check(ends.every(value => value.segmentDomainAdmitted && value.planeDomainAdmitted), 'inward original overlap endpoint not admitted by native Line/Plane domains');
            check(overlaps.length < 32 && overlaps.length < options.overlapIds.length, 'explicit overlap capacity exceeded');
            const pieceIndex = overlaps.length, pieceDomain = [low, high], xyz = restrict(span.curve, pieceDomain, options.overlapIds[pieceIndex], temporary), uv = restrict(uvCurve, pieceDomain, options.overlapBindingIds[pieceIndex], temporary);
            const bindings = [low, mid, high].map(parameter => {
                const original = binding(parameter), piecePointMM = evaluateCurve(xyz.curve, parameter), piecePlaneUV = evaluateCurve(uv.curve, parameter), originalPieceDifferenceMM = finite(Math.hypot(...delta(original.pointMM, piecePointMM))), dimensionlessBindingDifference = finite(Math.hypot(...delta(original.planeUV, piecePlaneUV)));
                check(original.segmentDomainAdmitted && original.planeDomainAdmitted && inRectangle(piecePlaneUV, axes) && coordinate(piecePlaneUV) >= 0 && coordinate(piecePlaneUV) <= 1, 'actual overlap UV/native Line domain binding not admitted');
                check(originalPieceDifferenceMM <= tol && dimensionlessBindingDifference <= uvTol, 'actual original/overlap XYZ/UV binding exceeds local policy');
                return { ...original, piecePointMM, pieceCurveD1: d1(xyz.curve, parameter), originalPieceDifferenceMM, piecePlaneUV, dimensionlessBindingDifference };
            });
            const approximation = (part, t) => part.contributions.length ? { parameter: t, rootEstimate: part.parameter, parameterOffset: finite(t - part.parameter), bracket: [Math.min(...part.contributions.map(c => c.bracket[0])), Math.max(...part.contributions.map(c => c.bracket[1]))], dimensionlessBoundaryResiduals: part.contributions.map(c => Math.abs(finite(coordinate(evaluateCurve(uvCurve, t)) - (c.boundary === 'line-start' ? 0 : 1)))), policy: 'represented-inward-root-bracket-endpoint' } : null;
            const lineRange = [ends[0].lineParameter, ends[1].lineParameter], lineCoordinateRange = [ends[0].lineCoordinate, ends[1].lineCoordinate];
            check(forward ? lineRange[0] < lineRange[1] : lineRange[0] > lineRange[1], 'proven overlap orientation is not represented in original Line domain');
            const file = adopt(xyz.curve, l, p, temporary());
            overlaps.push({ overlapId: xyz.curve.id, spanId: span.spanId, domain: pieceDomain, curve: file.model.objects[0], uvCurve: uv.curve, coordinateSystem: 'uv', lineRange, lineCoordinateRange, orientation: forward ? 'forward' : 'reverse', bindings, endpointApproximations: [approximation(left, low), approximation(right, high)], provenance: { xyz: xyz.provenance, uv: uvProvenance(uv.provenance) }, ...file, sourceVersion: 0 });
        }
    }
    pointGroups.sort((a, b) => a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0);
    check(pointGroups.length <= 16 && pointGroups.length <= options.pointEventIds.length, 'explicit isolated point-event capacity exceeded');
    const events = pointGroups.map((group, index) => {
        const actual = binding(group.parameter), parameters = [group.parameter];
        for (const evidence of group.contributions)
            for (const t of evidence.bracket)
                if (!parameters.some(value => value === t))
                    parameters.push(t);
        const coordinates = parameters.map(t => coordinate(uvOf(evaluateCurve(c, t), axes))), inside = coordinates.every(value => value >= 0 && value <= 1), outside = coordinates.every(value => value < 0) || coordinates.every(value => value > 1);
        check(inside || outside, 'original finite Line boundary classification unresolved across root brackets');
        const sideObservations = [];
        for (const span of parent.spans) {
            if (group.parameter < span.domain[0] || group.parameter > span.domain[1])
                continue;
            for (const side of ['lower', 'upper']) {
                if (side === 'lower' && group.parameter === span.domain[0] || side === 'upper' && group.parameter === span.domain[1])
                    continue;
                const neighborRoots = pointGroups.filter(item => item.contributions.some(evidence => evidence.spanId === span.spanId)).map(item => item.parameter), boundary = side === 'lower' ? Math.max(span.domain[0], ...neighborRoots.filter(t => t < group.parameter)) : Math.min(span.domain[1], ...neighborRoots.filter(t => t > group.parameter));
                const low = Math.min(boundary, group.parameter), high = Math.max(boundary, group.parameter), t = finite(low + finite(high - low) / 2);
                check(t > low && t < high, 'one-sided native interval midpoint not represented');
                const pointMM = evaluateCurve(c, t);
                sideObservations.push({ spanId: span.spanId, side, parameter: t, signedLineValue: signedLine(uvOf(pointMM, axes)), pointMM, originalCurveD1: d1(c, t), spanCurveD1: d1(span.curve, t) });
            }
        }
        const internal = breaks.slice(1, -1).some(value => value === group.parameter);
        return { ...actual, eventId: options.pointEventIds[index], kind: internal ? 'knot-event' : group.parameter === domain[0] || group.parameter === domain[1] ? 'endpoint' : 'span-root', contributions: group.contributions, sideObservations };
    });
    boundaryGroups.sort((a, b) => a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0);
    check(boundaryGroups.length <= options.boundaryContactIds.length, 'explicit overlap contact capacity exceeded');
    const overlapContacts = boundaryGroups.map((group, index) => ({ ...binding(group.parameter), contactId: options.boundaryContactIds[index], contributions: group.contributions }));
    const isolatedOverlapContactIds = overlapContacts.filter(contact => contact.segmentDomainAdmitted && contact.planeDomainAdmitted && !overlaps.some(piece => contact.contributions.some(c => c.spanId === piece.spanId) && contact.parameter >= Math.min(piece.domain[0], ...(piece.endpointApproximations[0] ? [piece.endpointApproximations[0].rootEstimate] : [])) && contact.parameter <= Math.max(piece.domain[1], ...(piece.endpointApproximations[1] ? [piece.endpointApproximations[1].rootEstimate] : [])))).map(contact => contact.contactId);
    const finitePointEventCount = events.filter(event => event.segmentDomainAdmitted && event.planeDomainAdmitted).length, kind = overlaps.length ? events.length || isolatedOverlapContactIds.length ? 'mixed' : 'overlaps' : finitePointEventCount ? 'points' : isolatedOverlapContactIds.length ? 'isolated-contacts' : events.length ? 'outside-segment' : 'finite-disjoint', file = adopt(c, l, p, options.evaluationId);
    const result = copyCadData({ kind, curve: file.model.objects[0], line: file.model.objects[1], plane: file.model.objects[2], options, parent, ...file, sourceVersion: 0, spans, events, overlaps, overlapContacts, report: { family: 'own-coplanar-curve-finite-line-intersection', kind, evaluationId: options.evaluationId, curveId: c.id, lineId: l.id, planeId: p.id, curveDomain: domain, lineDomain, planeAxes: axes, lineUV: { start: lineStart, end: lineEnd, direction: lineDirection, dominantAxis }, spanCount: spans.length, pointEventCount: events.length, finitePointEventCount, outsidePointEventCount: events.length - finitePointEventCount, overlapCount: overlaps.length, boundaryContributionCount, overlapContactCount: overlapContacts.length, isolatedOverlapContactIds, authority: 'original-complete-curve-and-line-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false, numericPolicy: { parameterWidthTarget: WIDTH, maximumRootSteps: 64, pointBindingComparisonMM: tol, exactParameterDedupOnly: true, uvBindingUnits: 'dimensionless-not-mm-source', orientationProof: 'positive-weight-rational-derivative-numerator-Bernstein-sign' }, limits: { maximumSpans: 8, maximumPointEvents: 16, maximumOverlaps: 32, maximumBoundaryContributions: 64, maximumTemporaryPoles: 16, snapshotValues: 131072, snapshotDepth: 24, resultRecordFields: 32 } } });
    return snapshot(result, true);
}
/** Original coefficient/options rebuild; no supplied UV, line parameter or overlap cache adoption. */
export function validateCoplanarCurveLineIntersection(input) {
    const owned = snapshot(input, true);
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'owned Curve-line result required');
    const expected = intersectCoplanarCurveWithLineSegment(owned.curve, owned.line, owned.plane, owned.options);
    check(same(owned, expected), 'owned original geometry/root/UV/line-parameter/overlap/lineage/source/report mismatch');
    return copyCadData(expected.report);
}
