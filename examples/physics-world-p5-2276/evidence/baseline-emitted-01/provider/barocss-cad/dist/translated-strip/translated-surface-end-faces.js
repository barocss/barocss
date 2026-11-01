import { validateExactSurfaceLowerTrim } from '../exact-proof/exact-surface-lower-trim.js';
import { validatePairedSectionPlaneCap } from '../paired/paired-section-plane-cap.js';
import { evaluateCurve, evaluateSurface, validateCurve, validateSurface } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import { compileCadModel } from '../model-compiler.js';
import { curveDecimal } from '../nurbs/curves/curve-source.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';
import { DENSE_BOUNDED_ARRAYS_REQUIRED, FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, ownSnapshot } from '../core/own-data.js';
export const TranslatedSurfaceEndFacesDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', PARENT: 'PARENT', PAIR: 'PAIR', SUPPORT: 'SUPPORT', TRANSLATION: 'TRANSLATION', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED' });
export class TranslatedSurfaceEndFacesError extends KernelError {
    code;
    constructor(code, detail, cause) { super(('Translated Surface end Faces: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'TranslatedSurfaceEndFacesError'; this.code = code; }
}
const CODE = TranslatedSurfaceEndFacesDiagnosticCode;
function check(condition, code, detail) { if (!condition)
    throw new TranslatedSurfaceEndFacesError(code, detail); }
function native(action, detail, code = CODE.NATIVE) { try {
    return action();
}
catch (cause) {
    throw new TranslatedSurfaceEndFacesError(code, detail, cause);
} }
function record(input, fields, code = CODE.INPUT) {
    check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required');
    const data = input;
    check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
    return data;
}
function id(input) { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
const OWN = { input: CODE.INPUT, owned: CODE.OWNED, budget: CODE.BUDGET, fail: (code, detail) => { throw new TranslatedSurfaceEndFacesError(code, detail); }, wrap: (code, detail, cause) => { throw new TranslatedSurfaceEndFacesError(code, detail, cause); }, isRefusal: e => e instanceof TranslatedSurfaceEndFacesError, finite: FINITE_REPRESENTED_OWN_NUMBERS_REQUIRED, dense: DENSE_BOUNDED_ARRAYS_REQUIRED };
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
/** Build two real affine U-end Supports and their exact oriented trimmed Faces. */
export function buildTranslatedSurfaceEndFaces(lowerInput, upperInput, capInput, optionsInput) {
    const data = record(snapshot({ lowerWall: lowerInput, upperWall: upperInput, cap: capInput, options: optionsInput }), ['lowerWall', 'upperWall', 'cap', 'options']), s = record(data.options, ['evaluationId', 'resultIdPrefix', 'baseLeftCurveId', 'baseRightCurveId', 'maximumParents', 'maximumObservations']);
    const options = { evaluationId: id(s.evaluationId), resultIdPrefix: id(s.resultIdPrefix), baseLeftCurveId: id(s.baseLeftCurveId), baseRightCurveId: id(s.baseRightCurveId), maximumParents: s.maximumParents, maximumObservations: s.maximumObservations };
    check(options.resultIdPrefix.length <= 12, CODE.IDENTITY, 'ASCII prefix1..12 is required');
    check(options.maximumParents === 3 && options.maximumObservations === 24, CODE.BUDGET, 'Complete fixed parent/observation budgets3/24 required before parent work');
    const lowerWall = data.lowerWall, upperWall = data.upperWall, cap = data.cap;
    native(() => validateExactSurfaceLowerTrim(lowerWall), 'Actual lower whole wall validation refused', CODE.PARENT);
    native(() => validateExactSurfaceLowerTrim(upperWall), 'Actual upper whole wall validation refused', CODE.PARENT);
    native(() => validatePairedSectionPlaneCap(cap), 'Actual whole cap validation refused', CODE.PARENT);
    check(lowerWall.face.orientation === 'forward' && upperWall.face.orientation === 'reverse' && cap.face.orientation === 'forward', CODE.PAIR, 'Lower wall forward, upper wall reverse and cap forward are required');
    const low = lowerWall.binding.section, high = upperWall.binding.section, a = low.surfaceAsset.surface, b = high.surfaceAsset.surface, sd = low.report.surfaceDomains;
    check(same(cap.lower, low) && same(cap.upper, high), CODE.PAIR, 'The complete original cap sections must equal the actual wall sections');
    check(low.surfaceAsset.sourceId !== high.surfaceAsset.sourceId && a.id !== b.id, CODE.PAIR, 'Original Surface source and selected IDs must differ');
    check(a.degreeU === b.degreeU && a.degreeV === b.degreeV && same(a.knotsU, b.knotsU) && same(a.knotsV, b.knotsV) && same(a.weights, b.weights) && same(sd, high.report.surfaceDomains) && a.controlPoints.length === b.controlPoints.length && a.controlPoints.every((row, i) => row.length === b.controlPoints[i].length), CODE.SUPPORT, 'Original degrees/knots/domains/global weight bits and grids must match');
    const uvGeometry = (curve) => ({ kind: curve.kind, degree: curve.degree, knots: curve.knots, controlPoints: curve.controlPoints, weights: curve.weights });
    check(same(low.planeAsset, high.planeAsset) && same(low.originalModels[1], high.originalModels[1]), CODE.PAIR, 'The common complete original Plane source/Surface/Model context must match');
    const reserved = contexts({ lowerWall, upperWall, cap }), reserve = (value) => { id(value); check(!reserved.has(value), CODE.IDENTITY, 'Generated IDs must avoid every complete parent/model/child identity'); reserved.add(value); return value; };
    reserve(options.evaluationId);
    reserve(options.baseLeftCurveId);
    reserve(options.baseRightCurveId);
    const prefix = options.resultIdPrefix, roles = ['u-min', 'u-max'], surfaceIds = roles.map((_, i) => reserve(prefix + '_s' + i)), faceIds = roles.map((_, i) => reserve(prefix + '_f' + i)), loopIds = roles.map((_, i) => reserve(prefix + '_l' + i));
    const vertexIds = roles.map((_, i) => Array.from({ length: 4 }, (_, j) => reserve(prefix + '_f' + i + '_v' + j))), edgeIds = roles.map((_, i) => Array.from({ length: 4 }, (_, j) => reserve(prefix + '_f' + i + '_e' + j))), useIds = roles.map((_, i) => Array.from({ length: 4 }, (_, j) => reserve(prefix + '_f' + i + '_use' + j))), uvIds = roles.map((_, i) => Array.from({ length: 4 }, (_, j) => reserve(prefix + '_f' + i + '_uv' + j)));
    const q = new SectionRationalContext((kind, detail) => { throw new TranslatedSurfaceEndFacesError(CODE[kind], detail); }), zero = q.integer(0), one = q.integer(1), text = (values) => values.map(value => q.text(value)), read = (value) => q.rat(BigInt(value.numerator), BigInt(value.denominator)), v0 = q.from(sd.v[0]), vSpan = q.sub(q.from(sd.v[1]), v0);
    const rawNormal = low.proof.plane.rawNormal.map(read);
    check(rawNormal[1].n === 0n && q.compare(rawNormal[2], zero) > 0, CODE.SUPPORT, 'The exact original Plane requires raw NY0 and positive NZ');
    const height = q.sub(q.from(b.controlPoints[0][0][1]), q.from(a.controlPoints[0][0][1]));
    check(q.compare(height, zero) > 0, CODE.TRANSLATION, 'Strict positive original Y translation is required');
    const vector = [zero, height, zero], poles = [];
    for (let u = 0; u < a.controlPoints.length; u++)
        for (let v = 0; v < a.controlPoints[u].length; v++) {
            const first = a.controlPoints[u][v], second = b.controlPoints[u][v], differences = first.map((value, k) => q.sub(q.from(second[k]), q.from(value))), residuals = differences.map((value, k) => q.sub(value, vector[k]));
            check(residuals.every(value => value.n === 0n), CODE.TRANSLATION, 'Every original stored pole must have EXACT translation[0,h,0]');
            poles.push({ uIndex: u, vIndex: v, lower: first, upper: second, differences: text(differences), residuals: text(residuals) });
        }
    check(same(uvGeometry(lowerWall.binding.pcurve.curve), uvGeometry(upperWall.binding.pcurve.curve)), CODE.PAIR, 'The exact new original SurfaceUV geometry must match apart from IDs');
    const translation = { lowerSourceId: low.surfaceAsset.sourceId, upperSourceId: high.surfaceAsset.sourceId, lowerSurfaceId: a.id, upperSurfaceId: b.id, height: q.text(height), vector: text(vector), originalBasis: { degreeU: a.degreeU, degreeV: a.degreeV, knotsU: a.knotsU, knotsV: a.knotsV, weights: a.weights, domains: sd }, poles, commonPlane: { sourceId: low.planeAsset.sourceId, planeId: low.planeAsset.surface.id, rawNormal: text(rawNormal) }, matchedUV: { lowerId: lowerWall.binding.pcurve.curve.id, upperId: upperWall.binding.pcurve.curve.id, geometry: uvGeometry(lowerWall.binding.pcurve.curve) }, parentPair: { lowerWallFaceId: lowerWall.face.id, upperWallFaceId: upperWall.face.id, capFaceId: cap.face.id, lowerSectionEvaluationId: low.options.evaluationId, upperSectionEvaluationId: high.options.evaluationId, completeSectionIdentity: true } };
    const line = (curveId, points) => ({ kind: 'curve', id: curveId, degree: 1, knots: [0, 0, 1, 1], controlPoints: points, weights: [1, 1] });
    const baseLeft = line(options.baseLeftCurveId, [lowerWall.vertices[0].world, upperWall.vertices[0].world]), baseRight = line(options.baseRightCurveId, [lowerWall.vertices[1].world, upperWall.vertices[1].world]);
    for (const curve of [baseLeft, baseRight])
        native(() => validateCurve(curve), 'Actual new base cross-Y Line validation refused');
    const curves = [lowerWall.edges[3].curve, cap.edges[3].curve, upperWall.edges[3].curve, baseLeft, lowerWall.edges[1].curve, cap.edges[1].curve, upperWall.edges[1].curve, baseRight];
    check(new Set(curves.map(curve => curve.id)).size === 8, CODE.IDENTITY, 'All eight actual Model10 Curve IDs must be distinct');
    check(curves.every(curve => curve.degree === 1 && same(curve.knots, [0, 0, 1, 1]) && same(curve.weights, [1, 1]) && curve.controlPoints.length === 2), CODE.SUPPORT, 'Every end boundary must be its actual unit-weight native0..1 Line');
    const surfaces = [], supportProofs = [], faces = [];
    const zDerivative = q.div(q.sub(q.from(a.controlPoints[0][1][2]), q.from(a.controlPoints[0][0][2])), vSpan);
    check(q.compare(zDerivative, zero) > 0, CODE.SUPPORT, 'Inherited exact native-V Z derivative must be positive');
    const originParents = ['lowerWall', 'cap', 'upperWall', 'new'];
    for (let f = 0; f < 2; f++) {
        const isMin = f === 0, index = isMin ? 0 : a.controlPoints.length - 1, wallVertexBottom = isMin ? 0 : 1, wallVertexCut = isMin ? 3 : 2, cutV = lowerWall.binding.pcurve.curve.controlPoints[isMin ? 0 : lowerWall.binding.pcurve.curve.controlPoints.length - 1][1], cutU = q.from(cutV);
        check(q.compare(cutU, v0) > 0, CODE.REPRESENTABILITY, 'Derived native end domain must have positive represented length');
        const points = [lowerWall.vertices[wallVertexBottom].world, lowerWall.vertices[wallVertexCut].world, upperWall.vertices[wallVertexCut].world, upperWall.vertices[wallVertexBottom].world], grid = [[points[0], points[3]], [points[1], points[2]]], domainU = [sd.v[0], cutV], surface = { kind: 'surface', id: surfaceIds[f], degreeU: 1, degreeV: 1, knotsU: [domainU[0], domainU[0], domainU[1], domainU[1]], knotsV: [0, 0, 1, 1], controlPoints: grid, weights: [[1, 1], [1, 1]] };
        check(points.every((point, i) => points.slice(0, i).every(other => point.some((value, k) => value !== other[k]))), CODE.REPRESENTABILITY, 'Each end requires four distinct represented World corners');
        native(() => validateSurface(surface), 'Actual derived end Surface validation refused');
        const originalRow = a.controlPoints[index], mapOriginal = (v, w) => { const beta = q.div(q.sub(v, v0), vSpan); return originalRow[0].map((value, k) => q.add(q.add(q.from(value), q.mul(beta, q.sub(q.from(originalRow[1][k]), q.from(value)))), q.mul(w, vector[k]))); };
        const ideal = [[mapOriginal(v0, zero), mapOriginal(v0, one)], [mapOriginal(cutU, zero), mapOriginal(cutU, one)]], residuals = grid.map((row, i) => row.map((point, j) => point.map((value, k) => q.sub(q.from(value), ideal[i][j][k]))));
        check(residuals.every(row => row.every(point => point.every(value => value.n === 0n))), CODE.REPRESENTABILITY, 'All actual end Support corners must equal the original V restriction and exact translation');
        const mixed = grid[0][0].map((value, k) => q.add(q.sub(q.sub(q.from(grid[1][1][k]), q.from(grid[1][0][k])), q.from(grid[0][1][k])), q.from(value)));
        check(mixed.every(value => value.n === 0n), CODE.REPRESENTABILITY, 'Exact zero mixed bilinear coefficient is required');
        surfaces.push(surface);
        supportProofs.push({ role: roles[f], surfaceId: surface.id, originalUIndex: index, nativeDomains: { u: domainU, v: [0, 1] }, actualGrid: grid, idealGrid: ideal.map(row => row.map(text)), weights: surface.weights, residuals: residuals.map(row => row.map(text)), mixedCoefficient: text(mixed), originalZDerivative: q.text(zDerivative) });
        const uv = [[domainU[0], 0, 0], [domainU[1], 0, 0], [domainU[1], 1, 0], [domainU[0], 1, 0]], vertices = points.map((world, j) => ({ id: vertexIds[f][j], world, uv: uv[j] })), pairs = isMin ? [[1, 0], [2, 1], [2, 3], [0, 3]] : [[0, 1], [1, 2], [3, 2], [0, 3]];
        const parentEdges = [isMin ? lowerWall.edges[3] : lowerWall.edges[1], isMin ? cap.edges[3] : cap.edges[1], isMin ? upperWall.edges[3] : upperWall.edges[1], null];
        const edges = pairs.map((pair, j) => { const curve = curves[4 * f + j], pcurve = line(uvIds[f][j], pair.map(v => uv[v])), parent = originParents[j], parentEdge = parentEdges[j]; native(() => validateCurve(pcurve), 'Actual derived Support UV Line validation refused'); check(same(curve.controlPoints[0], points[pair[0]]) && same(curve.controlPoints[1], points[pair[1]]), CODE.BINDING, 'Unchanged borrowed World direction/endpoints must match actual end corners'); return { id: edgeIds[f][j], curve, vertexIds: [vertexIds[f][pair[0]], vertexIds[f][pair[1]]], pcurve: { coordinateSystem: 'native-surface-uv', lengthUnit: 'dimensionless', curve: pcurve }, origin: { parent, parentEdgeId: parentEdge?.id ?? null, sourceId: parent === 'cap' ? cap.lower.planeAsset.sourceId : parent === 'lowerWall' ? low.surfaceAsset.sourceId : parent === 'upperWall' ? high.surfaceAsset.sourceId : options.evaluationId, surfaceId: parent === 'cap' ? cap.lower.planeAsset.surface.id : parent === 'lowerWall' ? a.id : parent === 'upperWall' ? b.id : surface.id } }; });
        const canonical = isMin ? ['reverse', 'reverse', 'forward', 'reverse'] : ['forward', 'forward', 'reverse', 'reverse'];
        const forward = edges.map((edge, j) => { const sense = canonical[j], d = domain(edge.curve), reverse = sense === 'reverse'; return { id: useIds[f][j], edgeId: edge.id, vertexIds: reverse ? [edge.vertexIds[1], edge.vertexIds[0]] : edge.vertexIds, sense, interval: reverse ? [d[1], d[0]] : d, pcurveId: edge.pcurve.curve.id }; }), uses = isMin ? forward : forward.slice().reverse().map((use) => ({ ...use, vertexIds: [use.vertexIds[1], use.vertexIds[0]], sense: use.sense === 'forward' ? 'reverse' : 'forward', interval: [use.interval[1], use.interval[0]] }));
        check(uses.every((use, j) => use.vertexIds[1] === uses[(j + 1) % 4].vertexIds[0]) && new Set(uses.map(use => use.vertexIds[0])).size === 4, CODE.BINDING, 'Each actual oriented end loop must be a closed distinct four-cycle');
        faces.push({ role: roles[f], id: faceIds[f], surfaceId: surface.id, orientation: isMin ? 'forward' : 'reverse', vertices, edges, loop: { id: loopIds[f], uses } });
    }
    const decimal = (value) => curveDecimal(value, 'Translated Surface end Faces'), list = (values) => '[' + values.map(decimal).join(',') + ']', points = (values) => '[' + values.map(list).join(',') + ']';
    const surfaceSource = (surface) => '@surface #' + surface.id + ' {type:nurbs;degree-u:1;degree-v:1;knots-u:' + list(surface.knotsU) + ';knots-v:' + list(surface.knotsV) + ';control-points:[' + surface.controlPoints.map(points).join(',') + '];weights:[' + surface.weights.map(list).join(',') + '];}';
    const curveSource = (curve) => '@curve #' + curve.id + ' {type:nurbs;degree:1;knots:' + list(curve.knots) + ';control-points:' + points(curve.controlPoints) + ';weights:' + list(curve.weights) + ';}';
    const source = '@model ' + options.evaluationId + ' {version:0;length-unit:mm;' + surfaces.map(surfaceSource).join('') + curves.map(curveSource).join('') + '}\n';
    check(source.length <= 262144, CODE.BUDGET, 'Actual Model10 ASCII source exceeds its cap');
    const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'Actual derived Model10 source compiler refused');
    if (!compiled.ok)
        throw new TranslatedSurfaceEndFacesError(CODE.NATIVE, 'Actual derived Model10 compilation failed', compiled);
    check(same(compiled.model, { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [...surfaces, ...curves] }), CODE.BINDING, 'Actual Model10 must retain all copied Support/Curve bits');
    const world = { source, sourceVersion: 0, model: compiled.model };
    const boundaries = [], faceEmbeddings = [], borrowed = [], normalLower = q.mul(zDerivative, height), gramLower = q.mul(normalLower, normalLower);
    for (let f = 0; f < 2; f++) {
        const face = faces[f], surface = surfaces[f], sdEnd = supportProofs[f].nativeDomains, o = surface.controlPoints[0][0].map(value => q.from(value)), axisU = surface.controlPoints[1][0].map((value, k) => q.sub(q.from(value), o[k])), axisV = surface.controlPoints[0][1].map((value, k) => q.sub(q.from(value), o[k])), spanU = q.sub(q.from(sdEnd.u[1]), q.from(sdEnd.u[0]));
        for (const edge of face.edges) {
            const mapped = edge.pcurve.curve.controlPoints.map(point => { const u = q.div(q.sub(q.from(point[0]), q.from(sdEnd.u[0])), spanU), v = q.from(point[1]); return o.map((value, k) => q.add(q.add(value, q.mul(axisU[k], u)), q.mul(axisV[k], v))); }), residuals = edge.curve.controlPoints.map((point, j) => point.map((value, k) => q.sub(q.from(value), mapped[j][k]))), errors = residuals.map(row => q.sum(row.map(value => q.abs(value))));
            check(errors.every(value => value.n === 0n), CODE.REPRESENTABILITY, 'Every borrowed/stored boundary endpoint must equal its actual affine Support exactly');
            boundaries.push({ faceId: face.id, edgeId: edge.id, curveId: edge.curve.id, pcurveId: edge.pcurve.curve.id, worldEndpoints: edge.curve.controlPoints, uvEndpoints: edge.pcurve.curve.controlPoints, supportEndpoints: mapped.map(text), residuals: residuals.map(text), endpointL1Errors: text(errors), wholeGap: q.bound(zero) });
            const use = face.loop.uses.find(item => item.edgeId === edge.id);
            if (edge.origin.parent !== 'new') {
                const parent = edge.origin.parent === 'lowerWall' ? lowerWall : edge.origin.parent === 'upperWall' ? upperWall : cap, parentEdge = parent.edges.find(item => item.id === edge.origin.parentEdgeId);
                const parentUse = parent.loop.uses.find(item => item.edgeId === parentEdge.id);
                check(same(edge.curve, parentEdge.curve) && use.sense !== parentUse.sense, CODE.BINDING, 'All six actual parent Curve uses must have unchanged geometry and opposite senses');
                check(edge.id !== parentEdge.id, CODE.IDENTITY, 'Generated end Edges must remain distinct from parent Edges');
                borrowed.push({ faceId: face.id, edgeId: edge.id, curveId: edge.curve.id, parent: edge.origin.parent, parentSourceId: edge.origin.sourceId, parentSurfaceId: edge.origin.surfaceId, parentFaceId: parent.face.id, parentEdgeId: parentEdge.id, parentUseId: parentUse.id, useId: use.id, parentSense: parentUse.sense, sense: use.sense, exactCurveGeometry: true, oppositeUse: true, sharedSewnBRepEdge: false });
            }
        }
        faceEmbeddings.push({ schema: 'barocss-exact-translated-surface-end-face', version: 0, authority: 'exact-stored-coefficients-translated-original-surface-and-oriented-loop', role: face.role, faceId: face.id, surfaceId: surface.id, worldModelId: world.model.name, loopId: face.loop.id, edgeIds: face.edges.map(edge => edge.id), curveIds: face.edges.map(edge => edge.curve.id), pcurveIds: face.edges.map(edge => edge.pcurve.curve.id), nativeDomains: sdEnd, orientation: face.orientation, height: q.text(height), zDerivative: q.text(zDerivative), normalXAbsoluteLowerBound: q.text(normalLower), gramDeterminantLowerBound: q.text(gramLower), orientedNormalXSign: f === 0 ? -1 : 1, wholeCoefficientModelGap: q.bound(zero), closedDiskCertified: true, exactWorldSurfaceAgreement: true });
    }
    const correspondence = { borrowed, baseLines: [{ role: 'left', curveId: baseLeft.id, curve: baseLeft, direction: 'lower-to-upper', parameterDomain: [0, 1], sharedSewnBRepEdge: false }, { role: 'right', curveId: baseRight.id, curve: baseRight, direction: 'lower-to-upper', parameterDomain: [0, 1], sharedSewnBRepEdge: false }] }, proof = { translation, supports: supportProofs, boundaries, faceEmbeddings, correspondence };
    const derivativeCounts = { world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, surface: { evaluated: 0, refused: 0 } }, d1 = (key, action) => { try {
        const value = action();
        derivativeCounts[key].evaluated++;
        return { status: 'evaluated', value };
    }
    catch (cause) {
        if (!(cause instanceof Error) || !/exact C0 interior knot/.test(cause.message))
            throw new TranslatedSurfaceEndFacesError(CODE.NATIVE, 'Actual native D1 refused for ' + key, cause);
        derivativeCounts[key].refused++;
        return { status: 'native-refused', reason: cause.message, nativeErrorName: cause.name };
    } };
    const observations = faces.flatMap((face, faceIndex) => face.edges.flatMap((edge, edgeIndex) => [0, .5, 1].map((parameter, index) => { const w = { d0: native(() => evaluateCurve(edge.curve, parameter), 'Actual World Line D0 refused'), d1: d1('world', () => evaluateCurveD1(edge.curve, parameter)) }, uv = { d0: native(() => evaluateCurve(edge.pcurve.curve, parameter), 'Actual end UV Line D0 refused'), d1: d1('pcurve', () => evaluateCurveD1(edge.pcurve.curve, parameter)) }, s = { d0: native(() => evaluateSurface(surfaces[faceIndex], uv.d0[0], uv.d0[1]), 'Actual end Support D0 refused'), d1: d1('surface', () => evaluateSurfaceD1(surfaces[faceIndex], uv.d0[0], uv.d0[1])) }; let chain = null; if (s.d1.status === 'evaluated' && uv.d1.status === 'evaluated') {
        const ds = s.d1.value, dt = uv.d1.value;
        chain = ds.du.map((value, k) => finite(finite(value * dt.derivative[0]) + finite(ds.dv[k] * dt.derivative[1])));
    } const pointGap = (point, state) => state.status === 'evaluated' ? gap(point, state.value.point) : null, residuals = { pointGapMM: gap(w.d0, s.d0), worldD0D1PointGapMM: pointGap(w.d0, w.d1), uvD0D1PointGap: pointGap(uv.d0, uv.d1), surfaceD0D1PointGapMM: pointGap(s.d0, s.d1), relativeChainGap: w.d1.status === 'evaluated' && chain ? finite(gap(w.d1.value.derivative, chain) / Math.max(1, finite(Math.hypot(...w.d1.value.derivative)))) : null }; check(Object.values(residuals).every(value => value === null || value <= 1e-7), CODE.BINDING, 'Actual available end Line/Support point and chain observations exceed limits'); return { faceId: face.id, faceIndex, edgeId: edge.id, edgeIndex, index, parameter, world: w, pcurve: uv, surface: s, chain, residuals }; })));
    check(observations.length === 24, CODE.BINDING, 'All eight end edges require exactly24 native slots');
    const report = { schema: 'barocss-translated-surface-end-faces', version: 0, evaluationId: options.evaluationId, height: q.text(height), surfaceCount: 2, faceCount: 2, edgeCount: 8, useCount: 8, vertexCount: 8, uniqueWorldCurveCount: 8, worldObjectCount: 10, maximumWholeModelGapMM: 0, maximumObservedPointGapMM: Math.max(...observations.map(item => item.residuals.pointGapMM)), maximumObservedRelativeChainGap: Math.max(...observations.map(item => item.residuals.relativeChainGap ?? 0)), lengthUnit: 'mm', uvLengthUnit: 'dimensionless', sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'original-native-v-and-unit-extrusion-uv-lines', derivativeCounts, rationalCounts: q.counts(), directCounts: { wallValidationCount: 2, capValidationCount: 1, newEndSurfaceValidationCount: 2, newWorldCurveValidationCount: 2, newUVValidationCount: 8, worldSourceCompilationCount: 1, observationCount: 24, curvePointEvaluationCount: 48, curveDerivativeEvaluationCount: 48, surfacePointEvaluationCount: 24, surfaceDerivativeEvaluationCount: 24 }, quality: { individualFacesEmbedded: true, exactTranslation: true, wholeModelGapCertified: true, logicalFaceIncidence: true, orientedLoops: true, parentProofsUnchanged: true, sharedBodyTopologyCertified: false, manifoldCertified: false, solid: false, occupiedVolumeCertified: false, outwardSolidOrientationCertified: false, generalSurfaceRegularityCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, weldingPerformed: false, ownership: 'independent-copied-cpu-data-gc' }, limits: { maximumSupports: 2, maximumWorldCurves: 8, maximumWorldObjects: 10, maximumObservations: 24, prefixCharacters: 12, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000 }, workScope: 'direct-root-calls-and-arithmetic-parent-internal-work-retained-and-excluded', budgetFailure: 'atomic-no-partial-end-faces' };
    return snapshot({ lowerWall, upperWall, cap, options, surfaces, curves, faces, world, proof, observations, report }, true);
}
/** Rebuild complete parents, actual Supports/Lines/source/proofs/native observations before whole owned comparison. */
export function validateTranslatedSurfaceEndFaces(input) {
    const owned = record(snapshot(input, true), ['lowerWall', 'upperWall', 'cap', 'options', 'surfaces', 'curves', 'faces', 'world', 'proof', 'observations', 'report'], CODE.OWNED);
    let expected;
    try {
        expected = buildTranslatedSurfaceEndFaces(owned.lowerWall, owned.upperWall, owned.cap, owned.options);
    }
    catch (cause) {
        throw new TranslatedSurfaceEndFacesError(CODE.OWNED, 'Whole translated Surface end Face reconstruction refused', cause);
    }
    check(same(owned, expected), CODE.OWNED, 'Owned parents/Supports/Lines/UV/loops/source/proofs/correspondence/observations/counts changed');
    return snapshot(expected.report, true);
}
