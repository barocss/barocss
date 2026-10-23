import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParametricFace, validateFaceBundle } from '../dist/core/face.js';
import { evaluateCurve, evaluateSurface } from '../dist/core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../dist/core/derivatives.js';

const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
const fractions = [0, ...Array.from({ length: 17 }, (_, i) => ((i + 1) / 18) ** 1.37), 1];
const verdict = { incidenceValid: true, geometricValidity: 'not-certified', solid: false };
function ids() {
  return { faceId: 'face', loopId: 'loop', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3'] };
}
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
function pointClose(actual, expected, tolerance = 1e-9) {
  assert.equal(actual.length, expected.length);
  assert.ok(actual.every(Number.isFinite));
  const error = Math.hypot(...subtract(actual, expected));
  assert.ok(error <= tolerance, `${actual} differs from ${expected}: ${error}`);
  return error;
}
function vectorClose(actual, expected) {
  return pointClose(actual, expected, 1e-9 * Math.max(1, Math.hypot(...expected)));
}
const flat = {
  kind: 'surface', id: 'flat_patch', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 3, 3], knotsV: [4, 4, 6, 6],
  controlPoints: [[[1, 2, 2], [2, 9, 2]], [[7, 3, 2], [8, 10, 2]]], weights: [[1, 1], [1, 1]],
};
const oblique = { ...flat, id: 'oblique', controlPoints: [[[1, 2, 3], [5, 11, -2]], [[13, -7, 9], [17, 2, 4]]] };
const weighted = { ...flat, id: 'weighted', controlPoints: [[[0, 0, 0], [1, 7, 3]], [[9, 2, 4], [12, 8, -2]]], weights: [[1, 2], [3, 4]] };
const cylinder = {
  kind: 'surface', id: 'quarter_cylinder', degreeU: 2, degreeV: 1,
  knotsU: [-3, -3, -3, 11, 11, 11], knotsV: [2, 2, 7, 7],
  controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
  weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
};

// Independent rational bilinear polynomials; no native basis helper is used.
function bilinearOracle(surface, u, v) {
  const t = (u + 2) / 5;
  const s = (v - 4) / 2;
  const matrices = [
    [[(1 - t) * (1 - s), (1 - t) * s], [t * (1 - s), t * s]],
    [[-(1 - s) / 5, -s / 5], [(1 - s) / 5, s / 5]],
    [[-(1 - t) / 2, (1 - t) / 2], [-t / 2, t / 2]],
  ];
  const sums = matrices.map((matrix) => {
    const point = [0, 0, 0];
    let weight = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const factor = matrix[i][j] * surface.weights[i][j];
      weight += factor;
      for (let axis = 0; axis < 3; axis++) point[axis] += factor * surface.controlPoints[i][j][axis];
    }
    return { point, weight };
  });
  const [value, uSum, vSum] = sums;
  const point = value.point.map((coordinate) => coordinate / value.weight);
  return {
    point,
    du: uSum.point.map((coordinate, axis) => (coordinate - uSum.weight * point[axis]) / value.weight),
    dv: vSum.point.map((coordinate, axis) => (coordinate - vSum.weight * point[axis]) / value.weight),
  };
}
function cylinderOracle(u, v) {
  const t = (u + 3) / 14;
  const a = (1 - t) ** 2;
  const b = 2 * Math.SQRT1_2 * t * (1 - t);
  const c = t ** 2;
  const da = -2 * (1 - t);
  const db = 2 * Math.SQRT1_2 * (1 - 2 * t);
  const dc = 2 * t;
  const w = a + b + c;
  const dw = da + db + dc;
  return {
    point: [10 * (a + b) / w, 10 * (b + c) / w, 6 * (v - 2)],
    du: [10 * ((da + db) * w - (a + b) * dw) / (w * w * 14), 10 * ((db + dc) * w - (b + c) * dw) / (w * w * 14), 0],
    dv: [0, 0, 6],
  };
}
function corners(surface) {
  const u = [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]];
  const v = [surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]];
  return { u, v, uv: [[u[0], v[0]], [u[1], v[0]], [u[1], v[1]], [u[0], v[1]]] };
}
function checkBundle(surface, oracle) {
  const inputIds = ids();
  const bundle = buildParametricFace(surface, inputIds);
  assert.deepEqual(validateFaceBundle(bundle), verdict);
  assert.deepEqual(JSON.parse(JSON.stringify(bundle)), bundle);
  const { geometry, topology } = bundle;
  assert.equal(geometry.name, 'parametric_face');
  assert.equal(geometry.version, 0);
  assert.equal(geometry.lengthUnit, 'mm');
  assert.equal(geometry.objects.length, 5);
  assert.deepEqual(geometry.objects[0], surface);
  assert.equal(topology.version, 0);
  assert.deepEqual(topology.face, { id: inputIds.faceId, surfaceId: surface.id, outerLoopId: inputIds.loopId, orientation: 'forward' });
  assert.equal(topology.loop.id, inputIds.loopId);
  assert.equal(topology.vertices.length, 4);
  assert.equal(topology.edges.length, 4);
  assert.equal(topology.loop.uses.length, 4);
  const actualIds = [surface.id, topology.face.id, topology.loop.id, ...topology.vertices.map((v) => v.id), ...topology.edges.map((e) => e.id), ...geometry.objects.slice(1).map((c) => c.id)];
  assert.equal(new Set(actualIds).size, 15);
  const domain = corners(surface);
  let pointMaximumMM = 0;
  let tangentMaximumMMPerParameter = 0;
  for (let i = 0; i < 4; i++) {
    const curve = geometry.objects[i + 1];
    const vertex = topology.vertices[i];
    const next = topology.vertices[(i + 1) % 4];
    const edge = topology.edges[i];
    const use = topology.loop.uses[i];
    assert.equal(curve.kind, 'curve');
    assert.equal(curve.id, inputIds.curveIds[i]);
    assert.equal(vertex.id, inputIds.vertexIds[i]);
    assert.deepEqual(edge, { id: inputIds.edgeIds[i], curveId: curve.id, vertexIds: [vertex.id, next.id] });
    const expectedDomain = i % 2 === 0 ? domain.u : domain.v;
    assert.deepEqual(use, { edgeId: edge.id, sense: 'forward', boundary: boundaries[i], pcurve: { domain: expectedDomain, uv0: domain.uv[i], uv1: domain.uv[(i + 1) % 4] } });
    pointClose(vertex.point, oracle(...domain.uv[i]).point);
    pointClose(evaluateCurve(curve, expectedDomain[0]), vertex.point);
    pointClose(evaluateCurve(curve, expectedDomain[1]), next.point);
    assert.deepEqual([curve.knots[curve.degree], curve.knots[curve.controlPoints.length]], expectedDomain);
    for (const fraction of fractions) {
      const t = fraction === 1 ? expectedDomain[1] : expectedDomain[0] + fraction * (expectedDomain[1] - expectedDomain[0]);
      const uv = domain.uv[i].map((value, axis) => value + fraction * (domain.uv[(i + 1) % 4][axis] - value));
      const expected = oracle(...uv);
      const actual = evaluateCurveD1(curve, t);
      const direction = domain.uv[i].map((value, axis) => (domain.uv[(i + 1) % 4][axis] - value) / (expectedDomain[1] - expectedDomain[0]));
      const tangent = expected.du.map((value, axis) => direction[0] * value + direction[1] * expected.dv[axis]);
      pointMaximumMM = Math.max(pointMaximumMM, pointClose(actual.point, expected.point));
      tangentMaximumMMPerParameter = Math.max(tangentMaximumMMPerParameter, vectorClose(actual.derivative, tangent));
      pointClose(actual.point, evaluateSurface(surface, ...uv));
      const native = evaluateSurfaceD1(surface, ...uv);
      vectorClose(actual.derivative, native.du.map((value, axis) => direction[0] * value + direction[1] * native.dv[axis]));
    }
  }
  console.log(JSON.stringify({ fixture: surface.id, edges: 4, samplesPerEdge: 19, pointMaximumMM, tangentMaximumMMPerParameter, ...verdict }));
  return bundle;
}

test('flat, oblique, weighted and rational cylinder graph/pcurve mappings match independent analytics', () => {
  for (const surface of [flat, oblique, weighted]) checkBundle(surface, (u, v) => bilinearOracle(surface, u, v));
  checkBundle(cylinder, cylinderOracle);
});

test('nonuniform C1 double cubic knot remains supported in original/reflected boundary domains', () => {
  const knots = [-2, -2, -2, -2, 0.25, 0.25, 3, 3, 3, 3];
  const points = Array.from({ length: 6 }, (_, i) => {
    const [a, b, c] = knots.slice(i + 1, i + 4);
    return [(a + b + c) / 3, (a * b + a * c + b * c) / 3, a * b * c];
  });
  const surface = { kind: 'surface', id: 'C1_patch', degreeU: 3, degreeV: 1, knotsU: knots, knotsV: [0, 0, 1, 1], controlPoints: points.map(([x, y, z]) => [[x, y, z], [x, y, z + 1]]), weights: points.map(() => [1, 1]) };
  const bundle = checkBundle(surface, (u, v) => ({ point: [u, u * u, u ** 3 + v], du: [1, 2 * u, 3 * u * u], dv: [0, 0, 1] }));
  vectorClose(evaluateCurveD1(bundle.geometry.objects[1], 0.25).derivative, [1, 0.5, 3 * 0.25 ** 2]);
  vectorClose(evaluateCurveD1(bundle.geometry.objects[3], 0.75).derivative, [-1, -0.5, -3 * 0.25 ** 2]);
});

test('smooth folded counterexample has valid incidence without a geometric or solid certificate', () => {
  const folded = { kind: 'surface', id: 'folded', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[0, 0, 0], [0, 1, 0]], [[3, 0, 0], [3, 1, 0]], [[1, 0, 0], [1, 1, 0]]], weights: [[1, 1], [1, 1], [1, 1]] };
  pointClose(evaluateSurface(folded, 0.4, 0.5), [1.6, 0.5, 0]);
  pointClose(evaluateSurface(folded, 0.8, 0.5), [1.6, 0.5, 0]);
  vectorClose(evaluateSurfaceD1(folded, 0.6, 0.5).du, [0, 0, 0]);
  const bundle = buildParametricFace(folded, ids());
  assert.deepEqual(validateFaceBundle(bundle), verdict);
  assert.equal(validateFaceBundle(bundle).geometricValidity, 'not-certified');
  assert.equal(validateFaceBundle(bundle).solid, false);
});

test('exact C0 knots in either direction, seams and collapsed corners reject the new subset', () => {
  const C0 = { kind: 'surface', id: 'C0', degreeU: 1, degreeV: 1, knotsU: [2, 2, 3, 7, 7], knotsV: [0, 0, 1, 1], controlPoints: [[[1, 2, 3], [4, 0, 10]], [[5, 7, -1], [8, 5, 6]], [[12, 3, 4], [15, 1, 11]]], weights: [[1, 1], [2, 2], [0.5, 0.5]] };
  assert.throws(() => buildParametricFace(C0, ids()));
  const transposed = { ...C0, degreeU: C0.degreeV, degreeV: C0.degreeU, knotsU: [...C0.knotsV], knotsV: [...C0.knotsU], controlPoints: [0, 1].map((j) => C0.controlPoints.map((row) => row[j])), weights: [0, 1].map((j) => C0.weights.map((row) => row[j])) };
  assert.throws(() => buildParametricFace(transposed, ids()));
  const seam = { ...flat, controlPoints: [[[1, 2, 3], [4, 5, 6]], [[1, 2, 3], [4, 5, 6]]] };
  assert.throws(() => buildParametricFace(seam, ids()));
  const constantEdge = { ...flat, controlPoints: [[[1, 2, 3], [1, 2, 3]], [[7, 3, 2], [8, 10, 2]]] };
  assert.throws(() => buildParametricFace(constantEdge, ids()));
  const small = { ...flat, controlPoints: [[[0, 0, 0], [0, 5e-7, 0]], [[1, 0, 0], [1, 5e-7, 0]]] };
  assert.throws(() => buildParametricFace(small, ids()));
  const threshold = { ...small, controlPoints: [[[0, 0, 0], [0, 1e-6, 0]], [[1, 0, 0], [1, 1e-6, 0]]] };
  assert.doesNotThrow(() => buildParametricFace(threshold, ids()));
});

test('ID tuples enforce length, ASCII, global uniqueness and exact own-data structure', () => {
  const maximum = ids();
  maximum.faceId = 'f'.repeat(128);
  assert.doesNotThrow(() => buildParametricFace(flat, maximum));
  assert.throws(() => buildParametricFace({ ...flat, id: 's'.repeat(129) }, ids()));
  for (const invalid of [null, {}, [], { ...ids(), foreign: 1 }, { ...ids(), [Symbol('foreign')]: 1 }, Object.create(ids()), Object.assign(Object.create({ foreign: 1 }), ids())]) assert.throws(() => buildParametricFace(flat, invalid));
  for (const id of ['', '#face', 'bad id', '9face', '한글', 'f'.repeat(129), Symbol('face'), flat.id]) assert.throws(() => buildParametricFace(flat, { ...ids(), faceId: id }));
  for (const key of ['vertexIds', 'edgeIds', 'curveIds']) {
    for (const value of [[], ['one', 'two', 'three'], ['one', 'two', 'three', 'four', 'five'], Array(4), ['one', 'one', 'three', 'four']]) assert.throws(() => buildParametricFace(flat, { ...ids(), [key]: value }));
  }
  const duplicate = ids();
  duplicate.curveIds[0] = duplicate.edgeIds[0];
  assert.throws(() => buildParametricFace(flat, duplicate));
  const aliases = ids();
  aliases.edgeIds = aliases.vertexIds;
  assert.throws(() => buildParametricFace(flat, aliases));
  let getterCalls = 0;
  const accessor = Object.defineProperty(ids(), 'faceId', { get() { getterCalls++; return 'face'; } });
  assert.throws(() => buildParametricFace(flat, accessor));
  const tupleAccessor = ids();
  Object.defineProperty(tupleAccessor.vertexIds, '0', { get() { getterCalls++; return 'v0'; } });
  assert.throws(() => buildParametricFace(flat, tupleAccessor));
  const nativeAccessor = structuredClone(flat);
  Object.defineProperty(nativeAccessor, 'id', { get() { getterCalls++; return 'surface'; } });
  assert.throws(() => buildParametricFace(nativeAccessor, ids()));
  assert.equal(getterCalls, 0);
});

test('immutable inputs and IDs retain ownership across all native/topology outputs', () => {
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  const surface = structuredClone(weighted);
  const inputIds = ids();
  const before = JSON.stringify({ surface, inputIds });
  freeze(surface);
  freeze(inputIds);
  const first = buildParametricFace(surface, inputIds);
  const second = buildParametricFace(surface, inputIds);
  assert.deepEqual(first, second);
  const seen = new Set();
  function checkUniqueObjects(value) {
    if (value && typeof value === 'object') {
      assert.ok(!seen.has(value), 'Returned nested objects must not alias');
      seen.add(value);
      for (const item of Object.values(value)) checkUniqueObjects(item);
    }
  }
  checkUniqueObjects(first);
  const point = first.geometry.objects[0].controlPoints[0][0];
  assert.notEqual(point, surface.controlPoints[0][0]);
  point[0] = 999;
  first.geometry.objects[1].weights[0] = 999;
  first.topology.vertices[0].point[0] = 999;
  first.topology.edges[0].vertexIds[0] = 'changed';
  first.topology.loop.uses[0].pcurve.uv0[0] = 999;
  assert.equal(JSON.stringify({ surface, inputIds }), before);
  assert.deepEqual(buildParametricFace(surface, inputIds), second);
  assert.deepEqual(validateFaceBundle(second), verdict);
  freeze(second);
  assert.deepEqual(validateFaceBundle(second), verdict);
});

test('valid aliased source arrays are copied into independently owned output data', () => {
  const knots = [0, 0, 1, 1];
  const weights = [1, 1];
  const source = { ...flat, knotsU: knots, knotsV: knots, weights: [weights, weights] };
  const before = JSON.stringify(source);
  const bundle = buildParametricFace(source, ids());
  assert.deepEqual(validateFaceBundle(bundle), verdict);
  const copied = bundle.geometry.objects[0];
  assert.notEqual(copied.knotsU, copied.knotsV);
  assert.notEqual(copied.weights[0], copied.weights[1]);
  assert.notEqual(copied.knotsU, knots);
  copied.weights[0][0] = 999;
  copied.knotsU[0] = 999;
  assert.equal(JSON.stringify(source), before);
});

test('native bound violations and unrepresentable boundary reflection reject before incidence claims', () => {
  for (const change of [{ kind: 'curve' }, { degreeU: 0 }, { degreeV: 6 }, { knotsU: [] }, { weights: [[1, 0], [1, 1]] }, { weights: [[1, Infinity], [1, 1]] }, { controlPoints: Array(17).fill([[0, 0, 0], [1, 1, 1]]) }, { controlPoints: [[[1e6 + 1, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]] }]) {
    assert.throws(() => buildParametricFace({ ...flat, ...change }, ids()));
  }
  const reflectionCollapse = { kind: 'surface', id: 'reflection_collapse', degreeU: 2, degreeV: 1, knotsU: [-1e308, -1e308, -1e308, 0, 1, 8e307, 8e307, 8e307], knotsV: [0, 0, 1, 1], controlPoints: Array.from({ length: 5 }, (_, i) => [[i, 0, 0], [i, 1, 0]]), weights: Array.from({ length: 5 }, () => [1, 1]) };
  assert.throws(() => buildParametricFace(reflectionCollapse, ids()));
  const knots = [0, 0, 0, ...Array.from({ length: 13 }, (_, i) => (i + 1) / 14), 1, 1, 1];
  const maximum = { kind: 'surface', id: 'maximum_C1', degreeU: 2, degreeV: 1, knotsU: knots, knotsV: [0, 0, 1, 1], controlPoints: Array.from({ length: 16 }, (_, i) => {
    const u = (knots[i + 1] + knots[i + 2]) / 2;
    return [[u, 0, 0], [u, 1, 0]];
  }), weights: Array.from({ length: 16 }, () => [1, 1]) };
  const maximumBundle = buildParametricFace(maximum, ids());
  assert.equal(maximumBundle.geometry.objects[1].controlPoints.length, 16);
  assert.deepEqual(validateFaceBundle(maximumBundle), verdict);
});

test('validator rejects wrong references, order, pcurves, native geometry and unsupported fields', () => {
  const original = buildParametricFace(weighted, ids());
  assert.throws(() => validateFaceBundle(null));
  assert.throws(() => validateFaceBundle({}));
  const mutations = [
    (b) => { b.foreign = 1; }, (b) => { b.geometry.name = 'bad name'; },
    (b) => { b.geometry.version = 1; }, (b) => { b.geometry.lengthUnit = 'cm'; },
    (b) => { b.topology.version = 1; }, (b) => { b.topology.face.orientation = 'reverse'; },
    (b) => { b.topology.face.surfaceId = 'missing'; }, (b) => { b.topology.face.outerLoopId = 'missing'; },
    (b) => { b.topology.face.id = b.topology.loop.id; }, (b) => { b.topology.face.id = 'x'.repeat(129); },
    (b) => { b.topology.vertices.pop(); }, (b) => { b.topology.edges.pop(); }, (b) => { b.topology.loop.uses.pop(); },
    (b) => { b.geometry.objects.pop(); }, (b) => { b.geometry.objects.push(structuredClone(b.geometry.objects[1])); },
    (b) => { b.topology.vertices[1].id = b.topology.vertices[0].id; },
    (b) => { b.topology.edges[0].vertexIds[0] = 'missing'; },
    (b) => { b.topology.edges[0].vertexIds.reverse(); },
    (b) => { b.topology.edges[0].curveId = b.topology.edges[1].curveId; },
    (b) => { b.topology.edges[0].curveId = b.geometry.objects[0].id; },
    (b) => { b.topology.loop.uses[0].edgeId = 'missing'; },
    (b) => { b.topology.loop.uses[0].sense = 'reverse'; },
    (b) => { b.topology.loop.uses[0].boundary = 'u-min'; },
    (b) => { [b.topology.loop.uses[0], b.topology.loop.uses[1]] = [b.topology.loop.uses[1], b.topology.loop.uses[0]]; },
    (b) => { [b.topology.vertices[0], b.topology.vertices[1]] = [b.topology.vertices[1], b.topology.vertices[0]]; },
    (b) => { [b.topology.edges[0], b.topology.edges[1]] = [b.topology.edges[1], b.topology.edges[0]]; },
    (b) => { [b.geometry.objects[1], b.geometry.objects[2]] = [b.geometry.objects[2], b.geometry.objects[1]]; },
    (b) => { b.topology.loop.uses[0].pcurve.domain = [0, 1]; },
    (b) => { b.topology.loop.uses[0].pcurve.domain.reverse(); },
    (b) => { b.topology.loop.uses[0].pcurve.uv0[0] += 1; },
    (b) => { b.topology.loop.uses[0].pcurve.uv1[1] += 1; },
    (b) => { b.topology.loop.uses[0].pcurve.uv0 = [0]; },
    (b) => { b.topology.vertices[0].point[0] += 1; },
    (b) => { b.geometry.objects[1].controlPoints[0][0] += 1; },
    (b) => { b.geometry.objects[1].weights[0] *= 2; },
    (b) => { b.geometry.objects[0].weights[0][0] = 0; },
    (b) => { b.geometry.objects[0].controlPoints[0][0][0] = 1e6 + 1; },
    (b) => { b.geometry.objects[1].knots[0] = Infinity; },
    (b) => { b.topology.vertices[0].point[0] = NaN; },
    (b) => { delete b.topology.vertices[0].point[0]; },
    (b) => { b.topology.loop.uses[0].foreign = 1; },
    (b) => { b.topology.loop.uses[0].pcurve.foreign = 1; },
    (b) => { b.geometry.objects[0].foreign = 1; },
    (b) => { b.topology.vertices[1].point = b.topology.vertices[0].point; },
    (b) => { b.topology.loop.uses[1].pcurve.domain = b.topology.loop.uses[0].pcurve.domain; },
    (b) => { b[Symbol('foreign')] = 1; },
  ];
  for (const [index, mutation] of mutations.entries()) {
    const bundle = structuredClone(original);
    mutation(bundle);
    assert.throws(() => validateFaceBundle(bundle), `Mutation ${index} must reject`);
  }
  const before = JSON.stringify(original);
  assert.deepEqual(validateFaceBundle(original), verdict);
  assert.equal(JSON.stringify(original), before);
  const renamed = structuredClone(original);
  renamed.geometry.name = 'host_selected_metadata';
  assert.deepEqual(validateFaceBundle(renamed), verdict);
});

test('untrusted bundle accessors, sparse data and inherited schema never execute getters', () => {
  const original = buildParametricFace(flat, ids());
  let getterCalls = 0;
  const accessors = [
    (b) => Object.defineProperty(b, 'geometry', { get() { getterCalls++; return original.geometry; } }),
    (b) => Object.defineProperty(b.topology.face, 'id', { get() { getterCalls++; return 'face'; } }),
    (b) => Object.defineProperty(b.geometry.objects[0].controlPoints[0][0], '0', { get() { getterCalls++; return 1; } }),
    (b) => Object.defineProperty(b.topology.loop.uses[0].pcurve.domain, '0', { get() { getterCalls++; return -2; } }),
    (b) => Object.defineProperty(b.topology.edges, '0', { get() { getterCalls++; return original.topology.edges[0]; } }),
  ];
  for (const mutate of accessors) {
    const bundle = structuredClone(original);
    mutate(bundle);
    assert.throws(() => validateFaceBundle(bundle));
  }
  assert.equal(getterCalls, 0);
  const inherited = Object.create(original);
  assert.throws(() => validateFaceBundle(inherited));
  const sparse = structuredClone(original);
  delete sparse.geometry.objects[0].weights[0][0];
  assert.throws(() => validateFaceBundle(sparse));
  const cycle = structuredClone(original);
  cycle.foreign = cycle;
  assert.throws(() => validateFaceBundle(cycle));
});
