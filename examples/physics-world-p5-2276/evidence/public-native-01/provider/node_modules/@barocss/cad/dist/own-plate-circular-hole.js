import { buildAxisRectangleExtrusion } from './planar-solids/axis-rectangle-extrusion.js';
import { buildXYCirclePrismShell } from './xy-circle-prism-shell.js';
import { evaluateCurve, evaluateSurface, curveDomain, validateCurve, validateSurface } from './core/math.js';
import { evaluateSurfaceD1 } from './core/derivatives.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import { same } from './core/structural-equality.js';
const label = 'Own plate circular through-hole';
function check(condition, detail) { if (!condition)
    throw new Error((label + ': ' + detail).slice(0, 1024)); }
function snapshot(input, large = false) {
    let remaining = large ? 131072 : 4096;
    const copy = (v, depth) => {
        check(--remaining >= 0 && depth <= (large ? 24 : 8), 'own-data budget exceeded');
        if (typeof v === 'number') {
            check(Number.isFinite(v), 'finite numeric data required');
            return v;
        }
        if (typeof v === 'string') {
            check(v.length <= (large ? 262144 : 128), 'string bound exceeded');
            return v;
        }
        if (typeof v === 'boolean')
            return v;
        check(v !== null && typeof v === 'object', 'plain data required');
        const array = Array.isArray(v), proto = Object.getPrototypeOf(v), keys = Reflect.ownKeys(v), d = Object.getOwnPropertyDescriptors(v);
        check(array ? proto === Array.prototype : proto === Object.prototype || proto === null, 'foreign prototype');
        check(keys.length <= (array ? 1025 : 32) && keys.every(k => typeof k === 'string' && 'value' in d[k] && (array && k === 'length' || d[k].enumerable)), 'getters/symbols/hidden or excess fields');
        if (array) {
            const n = d.length.value;
            check(Number.isInteger(n) && n >= 0 && n <= 1024 && keys.length === n + 1, 'dense bounded array required');
            return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(d, String(i)), 'sparse array'); return copy(d[String(i)].value, depth + 1); });
        }
        return Object.fromEntries(keys.map(k => [k, copy(d[k].value, depth + 1)]));
    };
    return copy(input, 0);
}
function record(v, keys) { check(v !== null && typeof v === 'object' && !Array.isArray(v), 'record required'); const r = v; check(Object.keys(r).length === keys.length && keys.every(k => Object.hasOwn(r, k)), 'exact fields required: ' + keys.join(',')); return r; }
function id(v, bound = 48) { check(typeof v === 'string' && v.length <= bound && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v), 'bounded ASCII identifier required'); return v; }
function request(input) {
    const r = record(snapshot(input), ['bodyId', 'featureId', 'parameterIds', 'widthMM', 'heightMM', 'thicknessMM', 'centreMM', 'radiusMM']);
    const bodyId = id(r.bodyId, 32), featureId = id(r.featureId), p = record(r.parameterIds, ['width', 'height', 'thickness', 'centerX', 'centerY', 'radius']);
    const parameterIds = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, id(v)]));
    check(new Set([bodyId, featureId, ...Object.values(parameterIds)]).size === 8, 'authored IDs must be distinct');
    check([r.widthMM, r.heightMM, r.thicknessMM].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= 10000), 'safe integer dimensions 1..10000 mm required');
    check(Array.isArray(r.centreMM) && r.centreMM.length === 2 && r.centreMM.every(n => typeof n === 'number' && Math.abs(n) <= 10000), 'finite XY centre required');
    check(typeof r.radiusMM === 'number' && r.radiusMM > 0 && r.radiusMM <= 10000, 'positive finite radius required');
    const result = { bodyId, featureId, parameterIds, widthMM: r.widthMM, heightMM: r.heightMM, thicknessMM: r.thicknessMM, centreMM: r.centreMM, radiusMM: r.radiusMM };
    const [x, y] = result.centreMM, radius = result.radiusMM;
    check(x - radius > 0 && x + radius < result.widthMM && y - radius > 0 && y + radius < result.heightMM && x - radius < x && x + radius > x && y - radius < y && y + radius > y, 'strict represented contained circular hole required; touching/outside/unsafe refuses');
    return result;
}
const dot = (a, b) => a.reduce((n, x, i) => n + x * b[i], 0);
const subtract = (a, b) => a.map((n, i) => n - b[i]);
function uv(surface, point) {
    const o = surface.controlPoints[0][0], a = subtract(surface.controlPoints[1][0], o), b = subtract(surface.controlPoints[0][1], o), d = subtract(point, o);
    check(dot(a, a) > 0 && dot(b, b) > 0 && dot(a, b) === 0, 'represented orthogonal plane axes required');
    const mapped = [dot(d, a) / dot(a, a), dot(d, b) / dot(b, b), 0];
    check(mapped.every(Number.isFinite), 'finite represented UV required');
    return mapped;
}
function pcurve(curve, surface, curveId) { const c = { ...copyCadData(curve), id: curveId, controlPoints: curve.controlPoints.map(p => uv(surface, p)) }; validateCurve(c); return c; }
function sourceModel(face, edges, loops) {
    const ids = new Set(loops.filter(l => l.faceId === face.id).flatMap(l => l.uses.map(u => u.edgeId))), curves = edges.filter(e => ids.has(e.id)).map(e => e.curve);
    const candidate = { name: face.id, version: 0, lengthUnit: 'mm', objects: [face.surface, ...curves] };
    const dec = (n) => curveDecimal(n, label), list = (a) => '[' + a.map(dec).join(',') + ']', poles = (a) => '[' + a.map(list).join(',') + ']';
    const s = face.surface;
    const source = '@model ' + face.id + ' { version:0; length-unit:mm; @surface #' + s.id + ' { type:nurbs; degree-u:' + dec(s.degreeU) + '; degree-v:' + dec(s.degreeV) + '; knots-u:' + list(s.knotsU) + '; knots-v:' + list(s.knotsV) + '; control-points:[' + s.controlPoints.map(poles).join(',') + ']; weights:[' + s.weights.map(list).join(',') + ']; } ' + curves.map(c => '@curve #' + c.id + ' { type:nurbs; degree:' + dec(c.degree) + '; knots:' + list(c.knots) + '; control-points:' + poles(c.controlPoints) + '; weights:' + list(c.weights) + '; }').join(' ') + ' }\n';
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual face source0 compilation required');
    check(same(compiled.model, candidate), 'complete actual face model coefficient/ID/order/-0 adoption required');
    return { faceId: face.id, source, sourceVersion: 0, model: compiled.model };
}
function assemble(r) {
    const box = buildAxisRectangleExtrusion({ bodyId: r.bodyId, profile: { kind: 'rectangle', id: r.bodyId + '_rectangle', origin: [0, 0], width: r.widthMM, height: r.heightMM }, distance: r.thicknessMM });
    const circle = buildXYCirclePrismShell({ kind: 'circle', id: r.bodyId + '_circle', center: r.centreMM, radius: r.radiusMM }, { shellId: r.bodyId + '_hole', heightMM: r.thicknessMM }).bundle;
    const edges = box.shell.edges.map(e => {
        const face = box.shell.faces.find(f => f.id === e.canonical.faceId);
        const curve = face.bundle.geometry.objects.find(o => o.id === e.canonical.curveId);
        return { id: e.id, curve: copyCadData(curve), vertexIds: copyCadData(e.vertexIds), sourceParameterRange: curveDomain(curve) };
    });
    edges.push(...circle.topology.edges.map(e => ({ id: e.id, curve: copyCadData(circle.geometry.objects.find(o => o.id === e.curveId)), vertexIds: copyCadData(e.vertexIds), sourceParameterRange: copyCadData(e.sourceParameterRange) })));
    const faces = [], loops = [];
    for (const [index, f] of box.shell.faces.entries()) {
        const surface = f.bundle.geometry.objects.find(o => o.id === f.bundle.topology.face.surfaceId), loopId = f.bundle.topology.loop.id;
        const uses = f.bundle.topology.loop.uses.map((u, i) => {
            const e = box.shell.edges.find(e => e.uses.some(use => use.faceId === f.id && use.edgeId === u.edgeId)), global = edges.find(x => x.id === e.id), sense = e.uses.find(use => use.faceId === f.id).sense;
            return { id: f.id + '_use_' + i, edgeId: e.id, sense, pcurve: { coordinateSystem: 'uv', domain: global.sourceParameterRange, curve: pcurve(global.curve, surface, f.id + '_uv_' + i) } };
        });
        loops.push({ id: loopId, faceId: f.id, role: 'outer', uses });
        const face = { id: f.id, role: index < 4 ? 'outer-side' : index === 4 ? 'bottom-cap' : 'top-cap', surface: copyCadData(surface), orientation: 'forward', outerLoopId: loopId, innerLoopIds: [] };
        if (index >= 4) {
            const ring = edges[12 + (index === 4 ? 0 : 1)], innerId = f.id + '_inner_loop';
            face.innerLoopIds.push(innerId);
            loops.push({ id: innerId, faceId: f.id, role: 'inner', uses: [{ id: f.id + '_inner_use', edgeId: ring.id, sense: index === 4 ? 'forward' : 'reverse', pcurve: { coordinateSystem: 'uv', domain: ring.sourceParameterRange, curve: pcurve(ring.curve, surface, f.id + '_inner_uv') } }] });
        }
        faces.push(face);
    }
    const wallFace = circle.topology.faces.find(f => f.role === 'wall'), wallLoop = circle.topology.loops.find(l => l.id === wallFace.outerLoopId);
    faces.push({ id: wallFace.id, role: 'hole-wall', surface: copyCadData(circle.geometry.objects.find(o => o.id === wallFace.surfaceId)), orientation: 'reverse', outerLoopId: wallLoop.id, innerLoopIds: [] });
    loops.push({ id: wallLoop.id, faceId: wallFace.id, role: 'outer', uses: wallLoop.uses.slice().reverse().map(u => ({ ...copyCadData(u), sense: u.sense === 'forward' ? 'reverse' : 'forward' })) });
    const topology = { id: box.shell.id, vertices: [...copyCadData(box.shell.vertices), ...copyCadData(circle.topology.vertices)], edges, loops };
    const sourceModels = faces.map(f => sourceModel(f, edges, loops));
    return copyCadData({ request: r, faces, topology, sourceModels });
}
function near(a, b) { check(Math.hypot(...a.map((n, i) => n - b[i])) <= 1e-7, 'actual native edge/pcurve/surface incidence exceeds 1e-7 mm'); }
function observe(bundle) {
    const { request: r, topology: t, faces } = bundle;
    const ids = [...t.vertices.map(v => v.id), ...t.edges.map(e => e.id), ...faces.map(f => f.id), ...faces.map(f => f.surface.id), ...t.loops.flatMap(l => [l.id, ...l.uses.flatMap(u => [u.id, u.pcurve.curve.id])])];
    check(ids.every(x => x.length <= 128) && new Set(ids).size === ids.length, 'derived topology/face/pcurve IDs must be distinct and bounded');
    const edgeIncidence = t.edges.map(e => ({ edgeId: e.id, uses: [] })), loopObservations = [];
    for (const loop of t.loops) {
        const face = faces.find(f => f.id === loop.faceId);
        validateSurface(face.surface);
        const directedUV = [];
        for (const [i, use] of loop.uses.entries()) {
            const e = t.edges.find(e => e.id === use.edgeId);
            validateCurve(e.curve);
            validateCurve(use.pcurve.curve);
            check(same(curveDomain(e.curve), use.pcurve.domain), 'canonical edge/pcurve domains must match');
            const d = e.sourceParameterRange, parameters = d[1] === 4 ? [0, .5, 1, 1.5, 2, 2.5, 3, 3.5, 4] : [d[0], (d[0] + d[1]) / 2, d[1]];
            for (const p of parameters) {
                const mapped = evaluateCurve(use.pcurve.curve, p);
                check(mapped[2] === 0, 'genuine UV pcurve required');
                near(evaluateSurface(face.surface, mapped[0], mapped[1]), evaluateCurve(e.curve, p));
            }
            for (let end = 0; end < 2; end++)
                near(evaluateCurve(e.curve, d[end]), t.vertices.find(v => v.id === e.vertexIds[end]).point);
            const nextUse = loop.uses[(i + 1) % loop.uses.length], next = t.edges.find(e => e.id === nextUse.edgeId);
            check(e.vertexIds[use.sense === 'forward' ? 1 : 0] === next.vertexIds[nextUse.sense === 'forward' ? 0 : 1], 'directed native loop must close by exact vertex IDs');
            const oriented = use.sense === 'forward' ? parameters : parameters.slice().reverse();
            directedUV.push(...oriented.slice(0, -1).map(p => evaluateCurve(use.pcurve.curve, p)));
            edgeIncidence.find(x => x.edgeId === e.id).uses.push({ faceId: face.id, loopId: loop.id, useId: use.id, sense: use.sense });
        }
        const area = directedUV.reduce((a, p, i) => { const q = directedUV[(i + 1) % directedUV.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
        check(Number.isFinite(area) && area !== 0, 'nondegenerate native UV loop observation required');
        if (face.role !== 'hole-wall')
            check(loop.role === 'outer' ? area > 0 : area < 0, 'cap/side outer and inner UV loop directions must oppose');
        loopObservations.push({ loopId: loop.id, directedClosed: true, signedUVAreaObservation: area });
    }
    for (const e of edgeIncidence)
        check(e.uses.length === 2 && e.uses[0].sense !== e.uses[1].sense, 'each shared edge requires two opposite native uses; seam twice on wall');
    const normalObservations = [];
    for (const face of faces) {
        const queries = face.role === 'hole-wall' ? [[.5, .5], [1.5, .5], [2.5, .5], [3.5, .5]] : [[.5, .5]];
        for (const at of queries) {
            const d = evaluateSurfaceD1(face.surface, ...at), cross = [d.du[1] * d.dv[2] - d.du[2] * d.dv[1], d.du[2] * d.dv[0] - d.du[0] * d.dv[2], d.du[0] * d.dv[1] - d.du[1] * d.dv[0]], norm = Math.hypot(...cross);
            check(Number.isFinite(norm) && norm > 0, 'finite actual native Surface normal required');
            const sign = face.orientation === 'forward' ? 1 : -1, normal = cross.map(n => sign * n / norm);
            if (face.role === 'hole-wall')
                check(normal[0] * (d.point[0] - r.centreMM[0]) + normal[1] * (d.point[1] - r.centreMM[1]) < 0, 'hole wall normal must point into cavity');
            if (face.role === 'bottom-cap')
                check(normal[2] < 0, 'bottom normal must point downward');
            if (face.role === 'top-cap')
                check(normal[2] > 0, 'top normal must point upward');
            normalObservations.push({ faceId: face.id, uv: at, pointMM: d.point, normal });
        }
    }
    const [x, y] = r.centreMM, radius = r.radiusMM;
    return { kind: 'own-axis-plate-circular-through-hole-candidate', bodyId: r.bodyId, featureId: r.featureId, lengthUnit: 'mm', boundsMM: { min: [0, 0, 0], max: [r.widthMM, r.heightMM, r.thicknessMM] }, clearanceMM: [x - radius, r.widthMM - x - radius, y - radius, r.heightMM - y - radius],
        faceCount: faces.length, vertexCount: t.vertices.length, edgeCount: t.edges.length, loopCount: t.loops.length, edgeUseCount: t.loops.reduce((n, l) => n + l.uses.length, 0), edgeIncidence, loopObservations, normalObservations,
        referenceVolumeMM3: (r.widthMM * r.heightMM - Math.PI * radius * radius) * r.thicknessMM, referenceCapAreaMM2: r.widthMM * r.heightMM - Math.PI * radius * radius, referenceCavityAreaMM2: 2 * Math.PI * radius * r.thicknessMM,
        referenceSemantics: 'analytic-authored-family-formula-not-certified', incidenceValid: true, candidateClosedShell: true, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { authoredBodyIdCharacters: 32, authoredIdCharacters: 48, dimensionsIntegerMM: [1, 10000], nativeRadiusMM: [.001, 10000], nativeComparisonMM: 1e-7 } };
}
export function buildOwnPlateCircularHole(input) { const bundle = assemble(request(input)); return copyCadData({ bundle, report: observe(bundle) }); }
export function validateOwnPlateCircularHoleBundle(input) {
    const owned = record(snapshot(input, true), ['request', 'faces', 'topology', 'sourceModels']);
    const candidate = assemble(request(owned.request));
    check(same(owned, candidate), 'accepted native bundle must exactly match own authored reconstruction, including source models and signs');
    return copyCadData(observe(candidate));
}
