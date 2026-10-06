import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAxisBoxShell, validateAxisBoxShell } from '../dist/box-shell.js';
import { buildParametricFace, validateFaceBundle } from '../dist/face.js';
import { buildRectangleAdjacency, validateRectangleAdjacency } from '../dist/adjacency.js';
import { buildOrthogonalRectangleAdjacency } from '../dist/orthogonal-adjacency.js';
import { validateSurface, evaluateSurface } from '../dist/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../dist/derivatives.js';

const table = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];
const segments = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
const normals = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
const fractions = [0, .03, .07, .11, .17, .23, .29, .37, .43, .5, .57, .63, .71, .77, .83, .89, .93, .97, 1];
const pinned = [[[0, 0, 0], [1, 1, 1]], [[0, 0, 0], [2, 3, 5]], [[-7, 11, -13], [4, 6, 9]], [[9998, -10000, 0], [2, 3, 1]]];
const report = { incidenceValid: true, geometryFamily: 'exact-axis-box-shell-v0', closed: true, solid: false, solidProductImplemented: false };
const sub = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
function near(actual, expected, derivative = false) {
  const error = Math.hypot(...sub(actual, expected));
  assert.ok(Number.isFinite(error) && error <= 1e-9 * (derivative ? Math.max(1, Math.hypot(...expected)) : 1), `${actual} differs from ${expected}`);
  return error;
}
function localIds() { return { faceId: 'local_face', loopId: 'local_loop', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3'] }; }
function globalIds() { return { shellId: 'shell', faceIds: ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'], vertexIds: Array.from({ length: 8 }, (_, i) => `g${i}`), edgeIds: Array.from({ length: 12 }, (_, i) => `ge${i}`) }; }
function makeBox(origin = [0, 0, 0], sides = [2, 3, 5]) {
  const points = Array.from({ length: 8 }, (_, i) => origin.map((value, axis) => value + ((i >> axis) & 1) * sides[axis]));
  const bundles = table.map((face) => buildParametricFace({ kind: 'surface', id: 'local_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], weights: [[1, 1], [1, 1]], controlPoints: [[points[face[0]], points[face[3]]], [points[face[1]], points[face[2]]]] }, localIds()));
  return { origin: [...origin], sides: [...sides], points, bundles, ids: globalIds() };
}
function build(input) { return buildAxisBoxShell(input.origin, input.sides, input.bundles, input.ids); }
function ref(shell, face, edge) { const local = shell.faces[face].bundle.topology.edges[edge]; return { faceId: shell.faces[face].id, edgeId: local.id, curveId: local.curveId }; }
function curve(shell, use) { return shell.faces.find((face) => face.id === use.faceId).bundle.geometry.objects.find((object) => object.id === use.curveId); }
function connected(neighbors) { const seen = new Set([0]), queue = [0]; while (queue.length) for (const next of neighbors[queue.shift()]) if (!seen.has(next)) { seen.add(next); queue.push(next); } return seen.size; }

test('four original product boxes independently establish outward faces, fixed qualified closure and selected flux evidence', () => {
  let commonQueries = 0, boundaryQueries = 0, maxPointMM = 0;
  for (const [origin, sides] of pinned) {
    const input = makeBox(origin, sides), shell = build(input);
    assert.deepEqual(validateAxisBoxShell(shell), report);
    assert.deepEqual(shell.origin, origin); assert.deepEqual(shell.sides, sides);
    assert.equal(shell.version, 0); assert.equal(shell.id, input.ids.shellId);
    assert.equal(shell.faces.length, 6); assert.equal(shell.vertices.length, 8); assert.equal(shell.edges.length, 12);
    assert.equal(new Set([shell.id, ...shell.faces.map((f) => f.id), ...shell.vertices.map((v) => v.id), ...shell.edges.map((e) => e.id)]).size, 27);
    shell.vertices.forEach((v, i) => { assert.equal(v.id, input.ids.vertexIds[i]); assert.deepEqual(v.point, input.points[i]); });
    let area = 0, flux = 0;
    const faceAdjacency = Array.from({ length: 6 }, () => new Set()), vertexAdjacency = Array.from({ length: 8 }, () => new Set()), reached = new Set();
    for (let i = 0; i < 6; i++) {
      assert.deepEqual(shell.faces[i], { id: input.ids.faceIds[i], bundle: input.bundles[i] });
      const bundle = shell.faces[i].bundle;
      assert.equal(bundle.geometry.objects.length, 5);
      assert.deepEqual(validateFaceBundle(bundle), { incidenceValid: true, geometricValidity: 'not-certified', solid: false });
      const p = table[i].map((v) => input.points[v]), a = sub(p[1], p[0]), b = sub(p[3], p[0]), analyticCross = cross(a, b);
      assert.deepEqual(analyticCross.map((value) => value === 0 ? 0 : Math.sign(value)), normals[i]);
      const d1 = evaluateSurfaceD1(bundle.geometry.objects[0], .5, .5);
      near(d1.du, a, true); near(d1.dv, b, true);
      const centroid = p[0].map((value, axis) => value + .5 * (a[axis] + b[axis])); near(d1.point, centroid);
      const measuredCross = cross(d1.du, d1.dv); near(measuredCross, analyticCross, true);
      area += Math.hypot(...measuredCross); flux += dot(d1.point, measuredCross) / 3;
      for (let edge = 0; edge < 4; edge++) for (const t of fractions) {
        const uv = edge === 0 ? [t, 0] : edge === 1 ? [1, t] : edge === 2 ? [1 - t, 1] : [0, 1 - t];
        const expected = p[0].map((value, axis) => value + uv[0] * a[axis] + uv[1] * b[axis]);
        const expectedDerivative = (edge % 2 === 0 ? a : b).map((value) => edge >= 2 ? -value : value);
        const actual = evaluateCurveD1(bundle.geometry.objects[edge + 1], t);
        maxPointMM = Math.max(maxPointMM, near(actual.point, expected)); near(actual.derivative, expectedDerivative, true);
        const pcurve = bundle.topology.loop.uses[edge].pcurve;
        assert.deepEqual(pcurve.domain, [0, 1]); near(pcurve.uv0.map((value, axis) => value + t * (pcurve.uv1[axis] - value)), uv);
        near(actual.point, evaluateSurface(bundle.geometry.objects[0], ...uv)); boundaryQueries++;
      }
    }
    for (let i = 0; i < 12; i++) {
      const [start, end] = segments[i], edge = shell.edges[i], expectedUses = [];
      assert.equal(edge.id, input.ids.edgeIds[i]); assert.deepEqual(edge.vertexIds, [input.ids.vertexIds[start], input.ids.vertexIds[end]]);
      for (let face = 0; face < 6; face++) for (let local = 0; local < 4; local++) {
        const a = table[face][local], b = table[face][(local + 1) % 4];
        if (a === start && b === end) expectedUses.unshift({ ...ref(shell, face, local), sense: 'forward' });
        if (a === end && b === start) expectedUses.push({ ...ref(shell, face, local), sense: 'reverse' });
      }
      assert.equal(expectedUses.length, 2); assert.deepEqual(edge.uses, expectedUses);
      const { sense, ...canonical } = expectedUses[0]; assert.equal(sense, 'forward'); assert.deepEqual(edge.canonical, canonical);
      const owners = [];
      for (const use of edge.uses) {
        const key = JSON.stringify([use.faceId, use.edgeId, use.curveId]); assert.ok(!reached.has(key)); reached.add(key);
        owners.push(shell.faces.findIndex((face) => face.id === use.faceId));
      }
      assert.notEqual(owners[0], owners[1]); faceAdjacency[owners[0]].add(owners[1]); faceAdjacency[owners[1]].add(owners[0]); vertexAdjacency[start].add(end); vertexAdjacency[end].add(start);
      const forward = curve(shell, edge.uses[0]), reverse = curve(shell, edge.uses[1]);
      assert.deepEqual(forward.controlPoints, [input.points[start], input.points[end]]); assert.deepEqual(forward.controlPoints, [...reverse.controlPoints].reverse());
      assert.deepEqual(forward.weights, [1, 1]); assert.deepEqual(reverse.weights, [1, 1]); assert.deepEqual(forward.knots, [0, 0, 1, 1]);
      const direction = sub(input.points[end], input.points[start]);
      for (const t of fractions) {
        const f = evaluateCurveD1(forward, t), r = evaluateCurveD1(reverse, 1 - t), expected = input.points[start].map((x, axis) => x + t * direction[axis]);
        maxPointMM = Math.max(maxPointMM, near(f.point, expected), near(r.point, expected)); near(f.derivative, direction, true); near(r.derivative, direction.map((value) => -value), true); commonQueries++;
      }
    }
    assert.equal(reached.size, 24); assert.equal(connected(faceAdjacency), 6); assert.equal(connected(vertexAdjacency), 8);
    const [x, y, z] = sides, expectedArea = 2 * (x * y + y * z + z * x), expectedVolume = x * y * z;
    assert.ok(Math.abs(area - expectedArea) <= 1e-7 * Math.max(1, expectedArea)); assert.ok(Math.abs(flux - expectedVolume) <= 1e-7 * Math.max(1, expectedVolume));
    assert.deepEqual(Object.keys(validateAxisBoxShell(shell)).sort(), Object.keys(report).sort());
    console.log(JSON.stringify({ origin, sides, areaMM2: area, signedFluxVolumeMM3: flux, expectedVolumeMM3: expectedVolume, evidenceOnly: true }));
  }
  assert.equal(commonQueries, 912); assert.equal(boundaryQueries, 1824);
  console.log(JSON.stringify({ commonQueries, boundaryQueries, maxPointMM }));
});

test('existing two-face APIs preserve acceptance/report and directly reuse only three immutable outward box edges', () => {
  const input = makeBox(), shell = build(input), before = structuredClone(input.bundles), accepted = [];
  const pairIds = { adjacencyId: 'pair', faceIds: ['left', 'right'], vertexIds: Array.from({ length: 6 }, (_, i) => `pv${i}`), edgeIds: Array.from({ length: 7 }, (_, i) => `pe${i}`) };
  for (let i = 0; i < 12; i++) {
    const owners = shell.edges[i].uses.map((use) => shell.faces.find((f) => f.id === use.faceId).bundle);
    let succeeds = false;
    for (const order of [[0, 1], [1, 0]]) try { buildOrthogonalRectangleAdjacency(owners[order[0]], owners[order[1]], pairIds); succeeds = true; } catch {}
    if (succeeds) accepted.push(i);
  }
  assert.deepEqual(accepted, [4, 5, 9]); assert.deepEqual(input.bundles, before);
  const plane = (offset, width) => buildParametricFace({ kind: 'surface', id: 'surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], weights: [[1, 1], [1, 1]], controlPoints: [[[offset, 0, 0], [offset, 3, 0]], [[offset + width, 0, 0], [offset + width, 3, 0]]] }, localIds());
  const old = buildRectangleAdjacency(plane(0, 4), plane(4, 2), pairIds);
  assert.deepEqual(validateRectangleAdjacency(old), { incidenceValid: true, geometryFamily: 'exact-axis-rectangles-v0', sharedEdges: 1, closed: false, solid: false });
  assert.throws(() => validateAxisBoxShell(old));
});

test('twelve named global failures reject even when inward/near/partial local faces remain valid', () => {
  const original = build(makeBox());
  function faceChange(d, kind) {
    const native = structuredClone(d.faces[0].bundle.geometry.objects[0]);
    if (kind === 'inward') { native.controlPoints.reverse(); native.weights.reverse(); }
    if (kind === 'near') for (const row of native.controlPoints) for (const p of row) p[0] += 1e-10;
    if (kind === 'partial') for (let u = 0; u < 2; u++) native.controlPoints[u][1] = native.controlPoints[u][0].map((value, axis) => (value + native.controlPoints[u][1][axis]) / 2);
    d.faces[0].bundle = buildParametricFace(native, localIds()); assert.equal(validateFaceBundle(d.faces[0].bundle).incidenceValid, true);
  }
  const mutations = {
    missingFace: (d) => d.faces.pop(), duplicateFace: (d) => { d.faces[1].bundle = structuredClone(d.faces[0].bundle); }, inwardFace: (d) => faceChange(d, 'inward'),
    reversedUse: (d) => { d.edges[0].uses[1].sense = 'forward'; }, missingUse: (d) => d.edges[0].uses.pop(), duplicateUse: (d) => d.edges[0].uses.push(structuredClone(d.edges[0].uses[0])),
    wrongOwner: (d) => { d.edges[0].canonical.faceId = d.faces[0].id; }, wrongVertex: (d) => d.edges[0].vertexIds.reverse(), minutePoint: (d) => { d.vertices[0].point[0] += 1e-10; },
    nearFace: (d) => faceChange(d, 'near'), partialFace: (d) => faceChange(d, 'partial'), zeroSide: (d) => { d.sides[0] = 0; },
  };
  for (const [name, mutate] of Object.entries(mutations)) { const d = structuredClone(original); mutate(d); assert.throws(() => validateAxisBoxShell(d), name); }
  assert.equal(original.faces.length - original.edges.length + original.vertices.length, 2);
  const inward = structuredClone(original); faceChange(inward, 'inward');
  assert.equal(inward.faces.length - inward.edges.length + inward.vertices.length, 2); assert.throws(() => validateAxisBoxShell(inward));
});

test('non-axis/weighted/folded/collapsed native geometry is distinct from malformed native input', () => {
  const input = makeBox(), original = build(input);
  const native = structuredClone(input.bundles[0].geometry.objects[0]);
  const nonAxis = structuredClone(native); nonAxis.controlPoints[1][0][0] += 1; nonAxis.controlPoints[1][1][0] += 1;
  const weighted = { ...native, weights: [[1, 2], [3, 4]] };
  const folded = { ...native, degreeU: 2, knotsU: [0, 0, 0, 1, 1, 1], controlPoints: [[[0, 0, 0], [0, 1, 0]], [[3, 0, 0], [3, 1, 0]], [[1, 0, 0], [1, 1, 0]]], weights: [[1, 1], [1, 1], [1, 1]] };
  for (const surface of [nonAxis, weighted, folded]) {
    validateSurface(surface); const d = structuredClone(original); d.faces[0].bundle = buildParametricFace(surface, localIds());
    assert.equal(validateFaceBundle(d.faces[0].bundle).geometricValidity, 'not-certified'); assert.throws(() => validateAxisBoxShell(d));
  }
  const collapsed = { ...native, controlPoints: [[[0, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0]]] };
  validateSurface(collapsed); assert.doesNotThrow(() => evaluateSurface(collapsed, .37, .61)); assert.throws(() => buildParametricFace(collapsed, localIds()));
  const invalid = structuredClone(original); invalid.faces[0].bundle.geometry.objects[0].controlPoints[0][0][0] = null; assert.throws(() => validateAxisBoxShell(invalid));
});

test('strict origin/sides/27 IDs and exact tuple schemas enforce bounds without inferred IDs', () => {
  const input = makeBox();
  for (const origin of [[0, 0], [0, 0, 0, 0], [0.1, 0, 0], [NaN, 0, 0], [-10001, 0, 0], [9999, 0, 0], Array(3)]) assert.throws(() => buildAxisBoxShell(origin, input.sides, input.bundles, input.ids));
  for (const sides of [[0, 1, 1], [-1, 1, 1], [.5, 1, 1], [10001, 1, 1], [Infinity, 1, 1], [1, 1]]) assert.throws(() => buildAxisBoxShell(input.origin, sides, input.bundles, input.ids));
  const maximum = { ...input.ids, shellId: 's'.repeat(128) }; assert.doesNotThrow(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, maximum));
  for (const shellId of ['', '#s', 'bad id', '9s', '한글', 's'.repeat(129), Symbol('s')]) assert.throws(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, { ...input.ids, shellId }));
  const duplicate = globalIds(); duplicate.faceIds[0] = duplicate.vertexIds[0]; assert.throws(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, duplicate));
  for (const key of ['faceIds', 'vertexIds', 'edgeIds']) for (const value of [input.ids[key].slice(1), Array(input.ids[key].length)]) assert.throws(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, { ...input.ids, [key]: value }));
  const localCollision = { ...input.ids, shellId: input.bundles[0].topology.face.id }; assert.doesNotThrow(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, localCollision));
  assert.deepEqual(validateAxisBoxShell(build(makeBox([-10000, -10000, -10000], [10000, 10000, 10000]))), report);
});

test('frozen aliased inputs and signed zeros retain local bytes with fully owned output data', () => {
  const input = makeBox();
  for (const bundle of input.bundles) {
    bundle.geometry.objects[0].knotsV = bundle.geometry.objects[0].knotsU;
    for (const object of bundle.geometry.objects) for (const point of object.kind === 'surface' ? object.controlPoints.flat() : object.controlPoints) for (let k = 0; k < 3; k++) if (point[k] === 0) point[k] = -0;
  }
  function freeze(value) { if (value && typeof value === 'object') { for (const item of Object.values(value)) freeze(item); Object.freeze(value); } }
  const before = structuredClone(input); freeze(input);
  const first = build(input), second = build(input); assert.deepEqual(first, second);
  for (let i = 0; i < 6; i++) assert.deepEqual(first.faces[i].bundle, input.bundles[i]);
  assert.ok(Object.is(first.faces[0].bundle.geometry.objects[0].controlPoints[0][0][0], -0));
  const seen = new Set();
  function own(value) { if (value && typeof value === 'object') { assert.ok(!seen.has(value), 'No returned object aliases another occurrence'); seen.add(value); for (const item of Object.values(value)) own(item); } }
  own(first); first.vertices[0].point[0] += 1e-10; assert.throws(() => validateAxisBoxShell(first));
  assert.deepEqual(input, before); assert.deepEqual(build(input), second); freeze(second); assert.deepEqual(validateAxisBoxShell(second), report);
  const mutable = makeBox(), owned = build(mutable), saved = structuredClone(owned); mutable.bundles[0].topology.vertices[0].point[0] = 999; mutable.ids.faceIds[0] = 'changed'; assert.deepEqual(owned, saved);
});

test('getters, foreign/cached/symbol/nonenumerable/sparse/cyclic data and all snapshot budgets reject', () => {
  const input = makeBox(), original = build(input); let getters = 0;
  const accessor = Object.defineProperty(globalIds(), 'shellId', { get() { getters++; return 'shell'; } }); assert.throws(() => buildAxisBoxShell(input.origin, input.sides, input.bundles, accessor));
  const changes = [
    (d) => Object.defineProperty(d, 'origin', { get() { getters++; return [0, 0, 0]; } }),
    (d) => Object.defineProperty(d.faces[0].bundle.geometry.objects[0].controlPoints[0][0], '0', { get() { getters++; return 0; } }),
    (d) => { d.version = 1; }, (d) => { d.volumeMM3 = 30; }, (d) => { d.proof = { valid: true }; }, (d) => { d[Symbol('x')] = 1; },
    (d) => Object.defineProperty(d, 'hidden', { value: 1, enumerable: false }), (d) => { delete d.vertices[0].point[0]; },
    (d) => { d.edges[0].uses[0].foreign = 1; }, (d) => { d.edges[0].canonical.curveId = 'c3'; }, (d) => { d.vertices[0].id = d.id; },
    (d) => { d.vertices[0].point = { 0: d.vertices[0].point[0], 1: d.vertices[0].point[1], 2: d.vertices[0].point[2] }; },
    (d) => { d.edges[0].vertexIds = { 0: d.edges[0].vertexIds[0], 1: d.edges[0].vertexIds[1] }; },
    (d) => { d.origin = { 0: 0, 1: 0, 2: 0 }; }, (d) => { d.sides = { 0: 2, 1: 3, 2: 5 }; },
    (d) => { d.cycle = d; }, (d) => { d.faces = Array(129).fill(d.faces[0]); }, (d) => { for (let i = 0; i < 17; i++) d[`field${i}`] = 0; },
    (d) => { let nested = d; for (let i = 0; i < 20; i++) nested = nested.foreign = {}; },
    (d) => { d.payload = Array.from({ length: 128 }, () => Array.from({ length: 128 }, () => [0, 0, 0])); },
  ];
  for (const change of changes) { const d = structuredClone(original); change(d); assert.throws(() => validateAxisBoxShell(d)); }
  assert.throws(() => validateAxisBoxShell(Object.create(original))); assert.throws(() => validateAxisBoxShell(null));
  assert.equal(getters, 0); assert.deepEqual(validateAxisBoxShell(original), report);
});
