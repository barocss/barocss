import { snapshotCurveRequest, requireCurveValue, curveDecimal } from '../nurbs/curves/curve-source.js';
import { buildXYProfile } from '../sketch/xy-profile.js';
import { compileCadModel } from '../model-compiler.js';
import { validateModel, evaluateCurve } from '../core/math.js';
import { evaluateCurveD1 } from '../core/derivatives.js';
import { buildParametricFace } from '../core/face.js';
import { buildAxisBoxShell, validateAxisBoxShell } from '../core/box-shell.js';
import { validateAxisBoxSolid } from '../core/box-solid.js';
import { copyCadData } from '../data-copy.js';
const faceNames = ['x_min', 'x_max', 'y_min', 'y_max', 'z_min', 'z_max'];
const faceCorners = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
const parameterIds = { originX: '_rect_ox', originY: '_rect_oy', width: '_rect_w', height: '_rect_h', distance: '_rect_d' };
function check(condition, detail) { requireCurveValue(condition, detail, 'Axis rectangle extrusion'); }
function record(value, fields) {
    check(value !== null && typeof value === 'object' && !Array.isArray(value), 'plain request/profile record required');
    const result = value;
    check(Object.keys(result).length === fields.length && fields.every(key => Object.hasOwn(result, key)), 'exact request/profile fields required');
    return result;
}
function identifier(value, bound) {
    check(typeof value === 'string' && value.length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'supported bounded ASCII ID required');
    return value;
}
function exact(actual, expected) {
    if (Array.isArray(actual) && Array.isArray(expected))
        return actual.length === expected.length && actual.every((x, i) => exact(x, expected[i]));
    if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
        const a = actual, b = expected;
        return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && exact(a[key], b[key]));
    }
    return Object.is(actual, expected);
}
function near(actual, expected, derivative = false) {
    const error = Math.hypot(...actual.map((x, i) => x - expected[i]));
    check(Number.isFinite(error) && error <= 1e-9 * (derivative ? Math.max(1, Math.hypot(...expected)) : 1), 'profile/global edge parameter correspondence failed');
}
/** One supported filled family, rebuilt from actual parameter-bound source. */
export function buildAxisRectangleExtrusion(request) {
    const data = record(snapshotCurveRequest(request, 'Axis rectangle extrusion'), ['bodyId', 'profile', 'distance']);
    const input = record(data.profile, ['kind', 'id', 'origin', 'width', 'height']);
    check(input.kind === 'rectangle', 'only a canonical XY rectangle profile is supported');
    const bodyId = identifier(data.bodyId, 80), profileId = identifier(input.id, 128);
    check(Array.isArray(input.origin) && input.origin.length === 2 && input.origin.every(n => typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 10000), 'integer XY origin within 10000 mm required');
    const [x, y] = input.origin, width = input.width, height = input.height, distance = data.distance;
    check([width, height, distance].every(n => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 10000), 'integer width/height/distance in 1..10000 mm required');
    const sides = [width, height, distance], origin = [x, y, 0];
    const corners = Array.from({ length: 8 }, (_, i) => origin.map((value, axis) => ((i >> axis) & 1) ? value + sides[axis] : value));
    check(corners.every(p => p.every(n => Number.isSafeInteger(n) && Math.abs(n) <= 10000)), 'all represented box corners must be within 10000 mm');
    const surfaceIds = faceNames.map(name => bodyId + '_' + name + '_surface');
    const faceIds = faceNames.map(name => ({
        faceId: bodyId + '_' + name + '_local_face', loopId: bodyId + '_' + name + '_loop',
        vertexIds: [0, 1, 2, 3].map(i => bodyId + '_' + name + '_v' + i),
        edgeIds: [0, 1, 2, 3].map(i => bodyId + '_' + name + '_e' + i),
        curveIds: [0, 1, 2, 3].map(i => bodyId + '_' + name + '_c' + i),
    }));
    const shellIds = {
        shellId: bodyId + '_shell', faceIds: faceNames.map(name => bodyId + '_face_' + name),
        vertexIds: Array.from({ length: 8 }, (_, i) => bodyId + '_v' + i),
        edgeIds: Array.from({ length: 12 }, (_, i) => bodyId + '_e' + i),
    };
    const allIds = [bodyId, profileId, ...Object.values(parameterIds), ...surfaceIds, shellIds.shellId, ...shellIds.faceIds, ...shellIds.vertexIds, ...shellIds.edgeIds,
        ...faceIds.flatMap(ids => [ids.faceId, ids.loopId, ...ids.vertexIds, ...ids.edgeIds, ...ids.curveIds])];
    check(allIds.every(id => id.length <= 128) && new Set(allIds).size === allIds.length, 'body/profile/reserved/derived IDs must be bounded and distinct');
    const profile = buildXYProfile({ kind: 'rectangle', id: profileId, origin: [x, y], width: sides[0], height: sides[1] });
    const expectedCurve = { kind: 'curve', id: profileId, degree: 1, knots: [0, 0, 1, 2, 3, 4, 4],
        controlPoints: [corners[0], corners[1], corners[3], corners[2], corners[0]].map(p => [...p]), weights: [1, 1, 1, 1, 1] };
    check(exact(profile.curve, expectedCurve) && profile.report.endpointClosed && !profile.report.regionCertified && !profile.report.solid, 'actual profile must retain canonical native rectangle geometry');
    const decimal = (n) => curveDecimal(n, 'Axis rectangle extrusion');
    const parameters = [parameterIds.originX, parameterIds.originY, parameterIds.width, parameterIds.height, parameterIds.distance];
    const values = [x, y, ...sides];
    const pointExpression = (i) => '[' + [(i & 1) ? '$_rect_ox+$_rect_w' : '$_rect_ox', (i & 2) ? '$_rect_oy+$_rect_h' : '$_rect_oy', (i & 4) ? '$_rect_d' : '0'].join(',') + ']';
    const curveSource = '@curve #' + profileId + ' { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[' + [0, 1, 3, 2, 0].map(pointExpression).join(',') + ']; weights:[1,1,1,1,1]; }';
    const surfacesSource = faceCorners.map((c, i) => '@surface #' + surfaceIds[i] + ' { type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[' + pointExpression(c[0]) + ',' + pointExpression(c[3]) + '],[' + pointExpression(c[1]) + ',' + pointExpression(c[2]) + ']]; weights:[[1,1],[1,1]]; }');
    const source = '@model rectangle_part { version:2; length-unit:mm; ' + parameters.map((id, i) => '@parameter #' + id + ' { type:length; value:' + decimal(values[i]) + 'mm; }').join(' ') + ' ' + curveSource + ' ' + surfacesSource.join(' ') + ' }\n';
    check(source.length <= 262144, 'fixed generated source exceeds compiler budget');
    const compiled = compileCadModel(source, { sourceVersion: 2 });
    check(compiled.ok && compiled.ir.schemaVersion === 2 && compiled.ir.parameters.length === 5 && compiled.model.objects.length === 7, 'actual complete source2 model and parameter IR required');
    validateModel(compiled.model);
    check(exact(compiled.model.objects[0], profile.curve), 'compiled input curve must retain actual source0 profile');
    const faces = faceCorners.map((c, i) => {
        const expected = { kind: 'surface', id: surfaceIds[i], degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1],
            controlPoints: [[corners[c[0]], corners[c[3]]], [corners[c[1]], corners[c[2]]]].map(row => row.map(p => [...p])), weights: [[1, 1], [1, 1]] };
        const actual = compiled.model.objects[i + 1];
        check(actual.kind === 'surface' && exact(actual, expected), 'compiled surface coefficients/identity/order must match exact outward box');
        return buildParametricFace(actual, faceIds[i]);
    });
    const shell = buildAxisBoxShell(origin, sides, faces, shellIds);
    const shellReport = validateAxisBoxShell(shell);
    check(shellReport.closed && !shellReport.solid && !shellReport.solidProductImplemented, 'original shell-only report remains distinct');
    const solidReport = validateAxisBoxSolid(shell);
    const footprintRanges = [0, 3, 5, 1].map((edgeIndex, i) => ({ inputRange: [i, i + 1], edgeId: shell.edges[edgeIndex].id, sense: i < 2 ? 'forward' : 'reverse' }));
    for (const range of footprintRanges) {
        const edge = shell.edges.find(e => e.id === range.edgeId);
        const p0 = shell.vertices.find(v => v.id === edge.vertexIds[0]).point, p1 = shell.vertices.find(v => v.id === edge.vertexIds[1]).point;
        const direction = p1.map((n, axis) => n - p0[axis]);
        for (const t of [0, .17, .5, .83, 1]) {
            const u = range.inputRange[0] + t, fraction = range.sense === 'forward' ? t : 1 - t;
            const expected = p0.map((n, axis) => n + fraction * direction[axis]);
            near(evaluateCurve(profile.curve, u), expected);
            if (t > 0 && t < 1)
                near(evaluateCurveD1(profile.curve, u).derivative, direction.map(n => range.sense === 'forward' ? n : -n), true);
        }
    }
    const construction = { operation: 'axis-rectangle-extrude', inputCurveId: profileId, outputBodyId: bodyId,
        direction: [0, 0, 1], distanceMM: sides[2], parameterIds: { ...parameterIds }, footprintRanges };
    return { source, sourceVersion: 2, model: copyCadData(compiled.model), ir: copyCadData(compiled.ir), profile: copyCadData(profile),
        faces: copyCadData(faces), shell: copyCadData(shell), solidReport: copyCadData(solidReport), construction: copyCadData(construction) };
}
