import { CadNumericPolicy } from '../numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import { splitCurveAtParameter } from '../nurbs/curves/curve-parameter-split.js';
import { validateCurveAffinePlaneIntersection } from './own-multispan-curve-plane.js';
import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from './own-homogeneous-bernstein-roots.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { copyCadData } from '../data-copy.js';
import { EXACT_FIELDS_REQUIRED, OWN_RECORD, hasExactOwnFields, isOwnRecord } from '../core/own-data.js';
const LABEL = 'Own coincident Curve-plane interval clip', TOL = CadNumericPolicy.linearTolerance, WIDTH = 1e-12;
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
const BOUNDARIES = ['u-min', 'u-max', 'v-min', 'v-max'];
function coordinate(boundary) { return boundary.startsWith('u') ? 0 : 1; }
function limit(boundary, axes) { return axes.domains[boundary.startsWith('u') ? 'u' : 'v'][boundary.endsWith('min') ? 0 : 1]; }
function boundaryResidual(uv, boundary, axes) { return Math.abs(finite(uv[coordinate(boundary)] - limit(boundary, axes))); }
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
/** Clip actual coincident spans; UV coefficients remain dimensionless binding artifacts. */
export function clipCurvePlaneCoincidentIntervals(parentInput, inputOptions) {
    const parentData = snapshot(parentInput, true), optionData = snapshot(inputOptions), parent = parentData;
    validateCurveAffinePlaneIntersection(parent); // Original640 rebuild checks all coefficients, extraction, sources and events.
    const original = parent.curve, plane = parent.plane, axes = parent.report.planeAxes, coincident = parent.spans.filter(span => span.intersection.report.coincident.support);
    const o = record(optionData, ['evaluationId', 'pieceIds', 'contactIds', 'spanBindingIds', 'pieceBindingIds']);
    check(Array.isArray(o.pieceIds) && o.pieceIds.length >= 1 && o.pieceIds.length <= 32, '1..32 explicit piece IDs required');
    check(Array.isArray(o.contactIds) && o.contactIds.length >= 1 && o.contactIds.length <= 64, '1..64 explicit contact IDs required');
    check(Array.isArray(o.spanBindingIds) && o.spanBindingIds.length === coincident.length, 'one explicit UV binding ID per coincident span required');
    check(Array.isArray(o.pieceBindingIds) && o.pieceBindingIds.length === o.pieceIds.length, 'one explicit UV binding ID per piece capacity required');
    const options = { evaluationId: id(o.evaluationId), pieceIds: o.pieceIds.map(id), contactIds: o.contactIds.map(id), spanBindingIds: o.spanBindingIds.map(id), pieceBindingIds: o.pieceBindingIds.map(id) };
    const requested = [options.evaluationId, ...options.pieceIds, ...options.contactIds, ...options.spanBindingIds, ...options.pieceBindingIds], reserved = new Set();
    const identities = (v) => { if (Array.isArray(v)) {
        v.forEach(identities);
        return;
    } if (v !== null && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
            if (typeof x === 'string' && (k === 'id' || k === 'eventId' || k === 'spanId' || k === 'evaluationId' || k === 'name' || k.endsWith('CurveId')))
                reserved.add(x);
            else if (k === 'derivedSpanIds' || k === 'pointEventIds')
                x.forEach(value => reserved.add(value));
            else
                identities(x);
        } };
    identities(parent);
    check(new Set(requested).size === requested.length && requested.every(value => !reserved.has(value)), 'explicit clip identities collide with each other or parent identities');
    requested.forEach(value => reserved.add(value));
    let serial = 0;
    const temporary = () => { let value; do {
        check(++serial <= 1024, 'bounded temporary identity allocation');
        value = '__coincident_clip_tmp_' + serial;
    } while (reserved.has(value)); reserved.add(value); return value; };
    const spans = [], pieces = [], contactGroups = [];
    let boundaryContributionCount = 0;
    for (const [spanIndex, span] of coincident.entries()) {
        const uvCurve = { kind: 'curve', id: options.spanBindingIds[spanIndex], degree: span.curve.degree, knots: copyCadData(span.curve.knots), controlPoints: span.curve.controlPoints.map(point => uvOf(point, axes)), weights: copyCadData(span.curve.weights) };
        validateCurve(uvCurve);
        const domain = span.domain, width = finite(domain[1] - domain[0]), target = Math.min(WIDTH, WIDTH / width);
        check(target > 0 && Number.isFinite(target), 'normalized boundary-root target not represented');
        const equations = [], overlapBoundaries = [], roots = [];
        for (const boundary of BOUNDARIES) {
            const values = uvCurve.controlPoints.map((point, i) => { const distance = finite(point[coordinate(boundary)] - limit(boundary, axes)), coefficient = finite(distance * uvCurve.weights[i]); check(distance === 0 || coefficient !== 0, 'nonzero dimensionless boundary/weight coefficient underflowed to zero'); return coefficient; });
            const equation = createHomogeneousBernsteinEquation(values, LABEL);
            equations.push({ boundary, equation });
            if (equation.degree === 'zero') {
                overlapBoundaries.push(boundary);
                continue;
            }
            for (const root of solveHomogeneousBernsteinEquation(equation, { parameterWidthTarget: target, label: LABEL })) {
                check(++boundaryContributionCount <= 64, 'boundary contribution capacity exceeded');
                const parameter = mapParameter(domain, root.t), bracket = [mapParameter(domain, root.bracket[0]), mapParameter(domain, root.bracket[1])];
                check(root.t === 0 || root.t === 1 || parameter > domain[0] && parameter < domain[1], 'boundary root rounded to a span endpoint');
                check(root.bracket[0] === root.bracket[1] || bracket[0] < bracket[1], 'boundary root bracket not represented');
                check(bracket[1] - bracket[0] <= WIDTH, 'original boundary-root bracket unresolved');
                const uv = evaluateCurve(uvCurve, parameter), residual = boundaryResidual(uv, boundary, axes);
                check(residual <= TOL, 'dimensionless boundary-root residual exceeds local policy');
                const spanPointMM = evaluateCurve(span.curve, parameter), originalPointMM = evaluateCurve(original, parameter), originalPlaneUV = uvOf(originalPointMM, axes), originalSpanDifferenceMM = finite(Math.hypot(...delta(originalPointMM, spanPointMM))), dimensionlessBindingDifference = finite(Math.hypot(...delta(originalPlaneUV, uv)));
                check(originalSpanDifferenceMM <= TOL && dimensionlessBindingDifference <= TOL, 'actual original/span boundary contact binding exceeds local policy');
                const contribution = { spanId: span.spanId, boundary, parameter, normalizedParameter: root.t, bracket, normalizedBracket: root.bracket, iterations: root.iterations, touch: root.touch, dimensionlessBoundaryResidual: residual, spanPointMM, originalPointMM, originalSpanDifferenceMM, spanPlaneUV: uv, originalPlaneUV, dimensionlessBindingDifference, spanCurveD1: d1(span.curve, parameter) };
                roots.push(contribution);
                let contact = contactGroups.find(item => item.parameter === parameter);
                if (!contact) {
                    contact = { parameter, contributions: [] };
                    contactGroups.push(contact);
                }
                contact.contributions.push(contribution);
            }
        }
        const partitions = [{ parameter: domain[0], contributions: [] }, { parameter: domain[1], contributions: [] }];
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
            const left = partitions[i - 1], right = partitions[i];
            check(left.parameter < right.parameter, 'distinct boundary partition order unresolved');
            const leftUpper = Math.max(left.parameter, ...left.contributions.map(c => c.bracket[1])), rightLower = Math.min(right.parameter, ...right.contributions.map(c => c.bracket[0]));
            check(leftUpper < rightLower, 'different nearby boundary roots/brackets cannot be merged');
        }
        const outsideIntervals = [], spanRecord = { spanId: span.spanId, domain, uvCurve, coordinateSystem: 'uv', equations, overlapBoundaries, outsideIntervals };
        spans.push(spanRecord);
        for (let i = 1; i < partitions.length; i++) {
            const left = partitions[i - 1], right = partitions[i], mid = finite(left.parameter + finite(right.parameter - left.parameter) / 2);
            check(mid > left.parameter && mid < right.parameter, 'native partition midpoint not represented');
            const originalMid = evaluateCurve(original, mid), midUV = uvOf(originalMid, axes), boundMid = evaluateCurve(uvCurve, mid);
            check(finite(Math.hypot(...delta(midUV, boundMid))) <= TOL, 'original/dimensionless UV span binding difference exceeds local policy');
            if (!inRectangle(midUV, axes)) {
                outsideIntervals.push([left.parameter, right.parameter]);
                continue;
            }
            const low = left.contributions.length ? Math.max(...left.contributions.map(c => c.bracket[1])) : left.parameter;
            const high = right.contributions.length ? Math.min(...right.contributions.map(c => c.bracket[0])) : right.parameter;
            check(low < mid && mid < high, 'inward boundary-root endpoints leave no represented accepted interval');
            for (const t of [low, high])
                check(inRectangle(uvOf(evaluateCurve(original, t), axes), axes) && inRectangle(evaluateCurve(uvCurve, t), axes), 'inward native endpoint is not admitted by the finite Plane domain');
            check(pieces.length < 32 && pieces.length < options.pieceIds.length, 'explicit piece capacity exceeded');
            const index = pieces.length, pieceDomain = [low, high];
            const xyz = restrict(span.curve, pieceDomain, options.pieceIds[index], temporary), uv = restrict(uvCurve, pieceDomain, options.pieceBindingIds[index], temporary);
            const approximation = (part, t) => part.contributions.length ? { parameter: t, rootEstimate: part.parameter, parameterOffset: finite(t - part.parameter), bracket: [Math.min(...part.contributions.map(c => c.bracket[0])), Math.max(...part.contributions.map(c => c.bracket[1]))], policy: 'represented-inward-root-bracket-endpoint', dimensionlessBoundaryResiduals: part.contributions.map(c => ({ boundary: c.boundary, residual: boundaryResidual(evaluateCurve(uvCurve, t), c.boundary, axes) })) } : null;
            const bindings = [low, mid, high].map(t => {
                const originalPointMM = evaluateCurve(original, t), piecePointMM = evaluateCurve(xyz.curve, t), planeUV = evaluateCurve(uv.curve, t), originalPlaneUV = uvOf(originalPointMM, axes);
                check(inRectangle(planeUV, axes) && inRectangle(originalPlaneUV, axes), 'actual restricted UV binding outside finite native Plane domain');
                const planePointMM = evaluateSurface(plane, planeUV[0], planeUV[1]);
                const originalPieceDifferenceMM = finite(Math.hypot(...delta(originalPointMM, piecePointMM))), surfaceBindingDifferenceMM = finite(Math.hypot(...delta(originalPointMM, planePointMM))), dimensionlessBindingDifference = finite(Math.hypot(...delta(originalPlaneUV, planeUV)));
                check(originalPieceDifferenceMM <= TOL && surfaceBindingDifferenceMM <= TOL && dimensionlessBindingDifference <= TOL, 'actual original/restricted Curve/Plane UV binding exceeds local policy');
                return { parameter: t, originalPointMM, piecePointMM, planeUV, planePointMM, originalPieceDifferenceMM, surfaceBindingDifferenceMM, originalPlaneUV, dimensionlessBindingDifference, originalCurveD1: d1(original, t), pieceCurveD1: d1(xyz.curve, t) };
            });
            const file = adopt(xyz.curve, plane, temporary());
            pieces.push({ pieceId: xyz.curve.id, spanId: span.spanId, domain: pieceDomain, curve: file.model.objects[0], uvCurve: uv.curve, coordinateSystem: 'uv', bindings, endpointApproximations: [approximation(left, low), approximation(right, high)], provenance: { xyz: xyz.provenance, uv: uvProvenance(uv.provenance) }, overlapBoundaries: copyCadData(overlapBoundaries), ...file, sourceVersion: 0 });
        }
    }
    contactGroups.sort((a, b) => a.parameter < b.parameter ? -1 : a.parameter > b.parameter ? 1 : 0);
    check(contactGroups.length <= options.contactIds.length, 'explicit contact capacity exceeded');
    const contacts = contactGroups.map((group, index) => {
        const pointMM = evaluateCurve(original, group.parameter), planeUV = uvOf(pointMM, axes), finiteDomainAdmitted = inRectangle(planeUV, axes), planePointMM = finiteDomainAdmitted ? evaluateSurface(plane, planeUV[0], planeUV[1]) : null;
        if (planePointMM !== null)
            check(finite(Math.hypot(...delta(pointMM, planePointMM))) <= TOL, 'actual original contact/Plane binding exceeds local policy');
        const supportResidualMM = Math.abs(dot(axes.unitNormal, delta(pointMM, axes.originMM)));
        check(supportResidualMM <= TOL, 'actual original contact support residual exceeds local policy');
        return { contactId: options.contactIds[index], parameter: group.parameter, pointMM, planeUV, finiteDomainAdmitted, planePointMM, originalCurveD1: d1(original, group.parameter), supportResidualMM, contributions: group.contributions };
    });
    const isolatedContactIds = contacts.filter(contact => contact.finiteDomainAdmitted && !pieces.some(piece => contact.contributions.some(c => c.spanId === piece.spanId) && contact.parameter >= Math.min(piece.domain[0], ...(piece.endpointApproximations[0] ? [piece.endpointApproximations[0].rootEstimate] : [])) && contact.parameter <= Math.max(piece.domain[1], ...(piece.endpointApproximations[1] ? [piece.endpointApproximations[1].rootEstimate] : [])))).map(contact => contact.contactId);
    const overlap = pieces.some(piece => piece.overlapBoundaries.length > 0), outsideIntervalCount = spans.reduce((n, span) => n + span.outsideIntervals.length, 0), kind = !coincident.length ? 'no-coincident-spans' : pieces.length ? outsideIntervalCount || isolatedContactIds.length ? 'mixed' : overlap ? 'overlap-boundary' : 'pieces' : isolatedContactIds.length ? 'isolated-contacts' : 'finite-disjoint';
    const file = adopt(original, plane, options.evaluationId);
    const result = copyCadData({ kind, parent, options, ...file, sourceVersion: 0, spans, contacts, pieces, referencedEvents: parent.events, report: { family: 'own-coincident-curve-finite-affine-plane-clip', kind, evaluationId: options.evaluationId, originalCurveId: original.id, planeId: plane.id, parentEvaluationId: parent.options.evaluationId, coincidentSpanCount: spans.length, pieceCount: pieces.length, contactCount: contacts.length, boundaryContributionCount, isolatedContactIds, referencedEventIds: parent.events.map(event => event.eventId), outsideIntervalCount, authority: 'original-complete-curve-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false, numericPolicy: { parameterWidthTarget: WIDTH, maximumRootSteps: 64, pointBindingComparisonMM: TOL, exactParameterDedupOnly: true, intervalClassification: 'all-native-boundary-roots-and-original-midpoint', uvBindingUnits: 'dimensionless-not-mm-source', uvNumericBounds: 'inherited-native-curve-coefficient-split-bounds' }, limits: { maximumPieces: 32, maximumBoundaryContributions: 64, maximumSpans: 8, maximumTemporaryPoles: 16, snapshotValues: 131072, snapshotDepth: 24, resultRecordFields: 32 } } });
    return snapshot(result, true);
}
/** Rebuild the actual parent and every accepted interval/UV/contact/source binding. */
export function validateCurvePlaneCoincidentClip(input) {
    const owned = snapshot(input, true);
    check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'owned coincident clip result required');
    const expected = clipCurvePlaneCoincidentIntervals(owned.parent, owned.options);
    check(same(owned, expected), 'owned parent/interval/UV/root/lineage/source/report mismatch');
    return copyCadData(expected.report);
}
