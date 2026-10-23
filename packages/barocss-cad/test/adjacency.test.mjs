import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRectangleAdjacency, validateRectangleAdjacency } from '../dist/core/adjacency.js';
import { buildParametricFace, validateFaceBundle } from '../dist/core/face.js';
import { evaluateCurve, evaluateSurface, validateSurface } from '../dist/core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../dist/core/derivatives.js';

const report = { incidenceValid: true, geometryFamily: 'exact-axis-rectangles-v0', sharedEdges: 1, closed: false, solid: false };
const fractions = [0, ...Array.from({ length: 17 }, (_, i) => ((i + 1) / 18) ** 1.37), 1];
const boundaries = ['v-min', 'u-max', 'v-max', 'u-min'];
const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 5], [5, 2]];
const add = (a, b) => a.map((value, axis) => value + b[axis]);
function localIds() { return { faceId: 'face', loopId: 'loop', vertexIds: ['v0', 'v1', 'v2', 'v3'], edgeIds: ['e0', 'e1', 'e2', 'e3'], curveIds: ['c0', 'c1', 'c2', 'c3'] }; }
function globalIds() { return { adjacencyId: 'adjacency', faceIds: ['left_wrapper', 'right_wrapper'], vertexIds: ['g0', 'g1', 'g2', 'g3', 'g4', 'g5'], edgeIds: ['ge0', 'ge1', 'ge2', 'ge3', 'ge4', 'ge5', 'ge6'] }; }
function surface(origin, a, b, id = 'surface') {
  return { kind: 'surface', id, degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[origin, add(origin, b)], [add(origin, a), add(add(origin, a), b)]], weights: [[1, 1], [1, 1]] };
}
function makePair(axisA = 0, axisB = 1, signB = 1, origin = [13, -17, 23], signA = 1) {
  const a = [0, 0, 0]; a[axisA] = 4 * signA;
  const aRight = [0, 0, 0]; aRight[axisA] = 2 * signA;
  const b = [0, 0, 0]; b[axisB] = 3 * signB;
  const left = buildParametricFace(surface([...origin], a, b), localIds());
  const right = buildParametricFace(surface(add(origin, a), aRight, b), localIds());
  left.geometry.name = 'host_left_metadata';
  right.geometry.name = 'host_right_metadata';
  return { left, right, origin, a, aRight, b };
}
function pointClose(actual, expected, tolerance = 1e-9) {
  assert.ok(actual.every(Number.isFinite));
  const error = Math.hypot(...actual.map((value, axis) => value - expected[axis]));
  assert.ok(error <= tolerance, `${actual} differs from ${expected}: ${error}`);
  return error;
}
function exactPoint(actual, expected) {
  assert.equal(actual.length, 3);
  assert.ok(actual.every((value, axis) => value === expected[axis]), 'Exact numeric coincidence is required');
}
function reference(wrapperId, local, index) {
  return { faceId: wrapperId, edgeId: local.topology.edges[index].id, curveId: local.topology.edges[index].curveId };
}
function checkPair(input) {
  const ids = globalIds();
  const result = buildRectangleAdjacency(input.left, input.right, ids);
  assert.deepEqual(validateRectangleAdjacency(result), report);
  assert.equal(result.version, 0);
  assert.equal(result.id, ids.adjacencyId);
  assert.deepEqual(result.faces, [{ id: ids.faceIds[0], bundle: input.left }, { id: ids.faceIds[1], bundle: input.right }]);
  for (const wrapper of result.faces) assert.deepEqual(validateFaceBundle(wrapper.bundle), { incidenceValid: true, geometricValidity: 'not-certified', solid: false });
  for (const [bundle, a] of [[input.left, input.a], [input.right, input.aRight]]) {
    assert.equal(bundle.geometry.objects.length, 5);
    const d1 = evaluateSurfaceD1(bundle.geometry.objects[0], 0.37, 0.819);
    pointClose(d1.du, a);
    pointClose(d1.dv, input.b);
    const actualNormal = [d1.du[1] * d1.dv[2] - d1.du[2] * d1.dv[1], d1.du[2] * d1.dv[0] - d1.du[0] * d1.dv[2], d1.du[0] * d1.dv[1] - d1.du[1] * d1.dv[0]];
    const expectedNormal = [a[1] * input.b[2] - a[2] * input.b[1], a[2] * input.b[0] - a[0] * input.b[2], a[0] * input.b[1] - a[1] * input.b[0]];
    pointClose(actualNormal, expectedNormal);
    assert.ok(Math.hypot(...actualNormal) > 0);
  }
  assert.equal(result.vertices.length, 6);
  assert.equal(result.edges.length, 7);
  assert.equal(new Set([result.id, ...result.faces.map((f) => f.id), ...result.vertices.map((v) => v.id), ...result.edges.map((e) => e.id)]).size, 16);
  const leftCorners = [input.origin, add(input.origin, input.a), add(add(input.origin, input.a), input.b), add(input.origin, input.b)];
  const rightOrigin = add(input.origin, input.a);
  const expectedVertices = [...leftCorners, add(rightOrigin, input.aRight), add(add(rightOrigin, input.aRight), input.b)];
  result.vertices.forEach((vertex, i) => {
    assert.equal(vertex.id, ids.vertexIds[i]);
    exactPoint(vertex.point, expectedVertices[i]);
  });
  let useCount = 0;
  const qualified = new Set();
  for (let i = 0; i < 7; i++) {
    const edge = result.edges[i];
    assert.equal(edge.id, ids.edgeIds[i]);
    assert.deepEqual(edge.vertexIds, pairs[i].map((index) => ids.vertexIds[index]));
    const local = i < 4 ? input.left : input.right;
    const localIndex = i < 4 ? i : i - 4;
    const expected = reference(ids.faceIds[i < 4 ? 0 : 1], local, localIndex);
    assert.deepEqual(edge.canonical, expected);
    assert.deepEqual(edge.uses[0], { ...expected, sense: 'forward' });
    if (i === 1) assert.deepEqual(edge.uses[1], { ...reference(ids.faceIds[1], input.right, 3), sense: 'reverse' });
    assert.equal(edge.uses.length, i === 1 ? 2 : 1);
    for (const use of edge.uses) {
      useCount++;
      const key = JSON.stringify([use.faceId, use.edgeId, use.curveId]);
      assert.ok(!qualified.has(key));
      qualified.add(key);
    }
  }
  assert.equal(useCount, 8);
  assert.equal(qualified.size, 8);
  // Both bundles deliberately use the same local IDs. Only wrapper qualification
  // identifies ownership; names and concatenated local strings cannot decide it.
  assert.equal(input.left.topology.edges[1].curveId, input.right.topology.edges[1].curveId);
  const leftCurve = result.faces[0].bundle.geometry.objects[2];
  const rightCurve = result.faces[1].bundle.geometry.objects[4];
  assert.deepEqual(leftCurve.controlPoints, [...rightCurve.controlPoints].reverse());
  assert.deepEqual(leftCurve.weights, [...rightCurve.weights].reverse());
  assert.deepEqual(leftCurve.knots, rightCurve.knots);
  let pointMaximumMM = 0;
  let derivativeMaximumMMPerParameter = 0;
  for (const t of fractions) {
    const expected = rightOrigin.map((value, axis) => value + t * input.b[axis]);
    const l = evaluateCurveD1(leftCurve, t);
    const r = evaluateCurveD1(rightCurve, 1 - t);
    pointMaximumMM = Math.max(pointMaximumMM, pointClose(l.point, expected), pointClose(r.point, expected));
    derivativeMaximumMMPerParameter = Math.max(derivativeMaximumMMPerParameter, pointClose(l.derivative, input.b), pointClose(r.derivative, input.b.map((value) => -value)));
    pointClose(l.point, evaluateSurface(result.faces[0].bundle.geometry.objects[0], 1, t));
    pointClose(r.point, evaluateSurface(result.faces[1].bundle.geometry.objects[0], 0, t));
    for (const [bundle, index, parameter] of [[input.left, 1, t], [input.right, 3, 1 - t]]) {
      const pcurve = bundle.topology.loop.uses[index].pcurve;
      const uv = pcurve.uv0.map((value, axis) => value + parameter * (pcurve.uv1[axis] - value));
      pointClose(evaluateCurve(bundle.geometry.objects[index + 1], parameter), evaluateSurface(bundle.geometry.objects[0], ...uv));
    }
  }
  console.log(JSON.stringify({ fixture: { a: input.a, b: input.b, origin: input.origin }, commonSamples: fractions.length, pointMaximumMM, derivativeMaximumMMPerParameter, ...report }));
  return result;
}

test('XY/YZ/ZX signed normals, translated unequal rectangles and qualified repeated local IDs', () => {
  for (const [axisA, axisB] of [[0, 1], [1, 2], [2, 0]]) {
    for (const signB of [1, -1]) checkPair(makePair(axisA, axisB, signB));
  }
  checkPair(makePair(0, 1, 1, [-29, 31, -37], -1));
});

test('global and local namespaces are distinct without string concatenation inference', () => {
  const input = makePair();
  const ids = globalIds();
  ids.adjacencyId = input.left.topology.face.id;
  ids.faceIds[0] = input.left.topology.vertices[0].id;
  const descriptor = buildRectangleAdjacency(input.left, input.right, ids);
  assert.deepEqual(validateRectangleAdjacency(descriptor), report);
  const wrongOwner = structuredClone(descriptor);
  wrongOwner.edges[1].canonical.faceId = ids.faceIds[1];
  assert.throws(() => validateRectangleAdjacency(wrongOwner), /Rectangle adjacency references gate/);
  const wrongUseOwner = structuredClone(descriptor);
  wrongUseOwner.edges[1].uses[1].faceId = ids.faceIds[0];
  assert.throws(() => validateRectangleAdjacency(wrongUseOwner));
});

test('owned snapshots preserve immutable input bundles, aliases, signed zeros and all local metadata', () => {
  const input = makePair(0, 1, 1, [-0, 0, 0]);
  for (const bundle of [input.left, input.right]) {
    for (const object of bundle.geometry.objects) {
      const points = object.kind === 'surface' ? object.controlPoints.flat() : object.controlPoints;
      for (const point of points) point[2] = -0;
    }
    // Shared input arrays are legal native data; every output occurrence must own a copy.
    bundle.geometry.objects[0].knotsV = bundle.geometry.objects[0].knotsU;
  }
  const ids = globalIds();
  const before = structuredClone({ left: input.left, right: input.right, ids });
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  freeze(input.left); freeze(input.right); freeze(ids);
  const first = buildRectangleAdjacency(input.left, input.right, ids);
  const second = buildRectangleAdjacency(input.left, input.right, ids);
  assert.deepEqual(first.faces[0].bundle, input.left);
  assert.deepEqual(first.faces[1].bundle, input.right);
  assert.ok(Object.is(first.faces[0].bundle.geometry.objects[0].controlPoints[0][0][0], -0));
  assert.ok(Object.is(first.faces[1].bundle.geometry.objects[0].controlPoints[0][0][2], -0));
  assert.deepEqual(first, second);
  const objects = new Set();
  function own(value) {
    if (value && typeof value === 'object') {
      assert.ok(!objects.has(value), 'Returned nested data must not alias another owned occurrence');
      objects.add(value);
      for (const item of Object.values(value)) own(item);
    }
  }
  own(first);
  first.vertices[1].point[0] += 1e-10;
  assert.throws(() => validateRectangleAdjacency(first), /Rectangle adjacency vertices gate/);
  assert.deepEqual({ left: input.left, right: input.right, ids }, before);
  assert.deepEqual(buildRectangleAdjacency(input.left, input.right, ids), second);
  freeze(second);
  assert.deepEqual(validateRectangleAdjacency(second), report);
});

test('caller mutation after build cannot change the owned global descriptor', () => {
  const input = makePair();
  const ids = globalIds();
  const result = buildRectangleAdjacency(input.left, input.right, ids);
  const before = structuredClone(result);
  input.left.topology.vertices[0].point[0] = 999;
  input.right.geometry.objects[0].controlPoints[0][0][0] = 999;
  ids.faceIds[0] = 'changed';
  assert.deepEqual(result, before);
  assert.deepEqual(validateRectangleAdjacency(result), report);
});

test('unsupported orientation, partial/overlap/corner-only/disjoint geometry and exact perturbations reject', () => {
  const input = makePair(0, 1, 1, [0, 0, 0]);
  const rightSurfaces = [
    surface([4, 3, 0], [2, 0, 0], [0, -3, 0]),
    surface([4, 0, 0], [-2, 0, 0], [0, 3, 0]),
    surface([4, 0, 0], [2, 0, 0], [0, 2, 0]),
    surface([4, 3, 0], [2, 0, 0], [0, 3, 0]),
    surface([5, 0, 0], [2, 0, 0], [0, 3, 0]),
    surface([3, 0, 0], [2, 0, 0], [0, 3, 0]),
    surface([0, 0, 0], [4, 0, 0], [0, 3, 0]),
    surface([4 + 1e-10, 0, 0], [2, 0, 0], [0, 3, 0]),
    surface([4, 0, 0], [0, 2, 0], [0, 0, 3]),
  ];
  for (const rightSurface of rightSurfaces) {
    const right = buildParametricFace(rightSurface, localIds());
    assert.deepEqual(validateFaceBundle(right), { incidenceValid: true, geometricValidity: 'not-certified', solid: false });
    assert.throws(() => buildRectangleAdjacency(input.left, right, globalIds()));
  }
  for (const change of [
    { weights: [[1, 2], [1, 1]] }, { knotsU: [2, 2, 7, 7] },
    { controlPoints: [[[4, 0, 0], [4, 3, 0]], [[6, 0, 0], [6, 3, 1]]] },
    { controlPoints: [[[10001, 0, 0], [10001, 3, 0]], [[10003, 0, 0], [10003, 3, 0]]] },
  ]) assert.throws(() => buildRectangleAdjacency(input.left, buildParametricFace({ ...surface([4, 0, 0], [2, 0, 0], [0, 3, 0]), ...change }, localIds()), globalIds()));
  const folded = { kind: 'surface', id: 'surface', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[4, 0, 0], [4, 3, 0]], [[7, 0, 0], [7, 3, 0]], [[5, 0, 0], [5, 3, 0]]], weights: [[1, 1], [1, 1], [1, 1]] };
  const foldBundle = buildParametricFace(folded, localIds());
  assert.equal(validateFaceBundle(foldBundle).geometricValidity, 'not-certified');
  assert.throws(() => buildRectangleAdjacency(input.left, foldBundle, globalIds()));
  const nearlyLocalVertex = structuredClone(input.right);
  nearlyLocalVertex.topology.vertices[0].point[0] += 1e-10;
  assert.doesNotThrow(() => validateFaceBundle(nearlyLocalVertex));
  assert.throws(() => buildRectangleAdjacency(input.left, nearlyLocalVertex, globalIds()), /Rectangle adjacency vertices gate/);
});

test('fixed graph mappings reject bad owners, curves, use counts, order, senses and exact point changes', () => {
  const input = makePair();
  const original = buildRectangleAdjacency(input.left, input.right, globalIds());
  const mutations = [
    (d) => { d.version = 1; }, (d) => { d.proof = { valid: true }; },
    (d) => { d.vertices[1].point[0] += 1e-10; },
    (d) => { d.edges[1].canonical.faceId = d.faces[1].id; },
    (d) => { d.edges[1].canonical.curveId = 'c0'; },
    (d) => { d.edges[1].uses[1].curveId = 'c1'; },
    (d) => { d.edges[1].uses[1].sense = 'forward'; },
    (d) => { d.edges[1].uses.reverse(); }, (d) => { d.edges[1].uses.pop(); },
    (d) => { d.edges[0].uses.push(structuredClone(d.edges[0].uses[0])); },
    (d) => { d.edges[0].uses[0].faceId = 'missing'; },
    (d) => { d.edges[0].canonical.edgeId = 'missing'; },
    (d) => { d.edges[0].vertexIds.reverse(); },
    (d) => { [d.edges[0], d.edges[1]] = [d.edges[1], d.edges[0]]; },
    (d) => { [d.vertices[0], d.vertices[1]] = [d.vertices[1], d.vertices[0]]; },
    (d) => { d.edges.pop(); }, (d) => { d.vertices.pop(); }, (d) => { d.faces.pop(); },
    (d) => { d.faces[1].id = d.faces[0].id; }, (d) => { d.vertices[0].id = d.id; },
    (d) => { d.faces[0].bundle.topology.loop.uses[1].sense = 'reverse'; },
    (d) => { d.faces[1].bundle.topology.loop.uses[3].pcurve.uv0[1] = 0.5; },
    (d) => { d.faces[0].bundle.geometry.objects[2].controlPoints[0][0] += 1; },
    (d) => { d.faces[0].bundle.topology.vertices[0].point[0] += 1e-10; },
    (d) => { d.faces[0].bundle.geometry.objects[0].weights[0][0] = 0; },
    (d) => { d.faces[0].bundle.geometry.objects[0].controlPoints[0][0][0] = 1e6 + 1; },
    (d) => { d.edges[0].canonical.foreign = 1; },
    (d) => { d.edges[0].uses[0].cachedProof = true; },
    (d) => { d.vertices[0].point[0] = NaN; },
  ];
  for (const [index, mutation] of mutations.entries()) {
    const changed = structuredClone(original);
    mutation(changed);
    assert.throws(() => validateRectangleAdjacency(changed), `Mutation ${index} must reject`);
  }
  assert.deepEqual(validateRectangleAdjacency(original), report);
});

test('geometrically equivalent higher-degree/non-unit-weight data remain unsupported without changing old APIs', () => {
  const input = makePair(0, 1, 1, [0, 0, 0]);
  const quadratic = { kind: 'surface', id: 'surface', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[4, 0, 0], [4, 3, 0]], [[5, 0, 0], [5, 3, 0]], [[6, 0, 0], [6, 3, 0]]], weights: [[1, 1], [1, 1], [1, 1]] };
  const uniformWeights = { ...surface([4, 0, 0], [2, 0, 0], [0, 3, 0]), weights: [[2, 2], [2, 2]] };
  for (const native of [quadratic, uniformWeights]) {
    pointClose(evaluateSurface(native, 0.37, 0.819), [4 + 2 * 0.37, 3 * 0.819, 0]);
    const bundle = buildParametricFace(native, localIds());
    assert.equal(validateFaceBundle(bundle).geometricValidity, 'not-certified');
    assert.throws(() => buildRectangleAdjacency(input.left, bundle, globalIds()));
  }
  const oversizedSide = buildParametricFace(surface([-10000, 0, 0], [20000, 0, 0], [0, 3, 0]), localIds());
  assert.equal(validateFaceBundle(oversizedSide).incidenceValid, true);
  assert.throws(() => buildRectangleAdjacency(oversizedSide, input.right, globalIds()));
  const collapsed = surface([4, 0, 0], [0, 0, 0], [0, 3, 0]);
  const C0 = { ...quadratic, degreeU: 1, knotsU: [0, 0, 0.5, 1, 1] };
  for (const native of [collapsed, C0]) {
    assert.doesNotThrow(() => validateSurface(native));
    assert.doesNotThrow(() => evaluateSurface(native, 0.37, 0.819));
    const invalidBundle = structuredClone(input.right);
    invalidBundle.geometry.objects[0] = native;
    assert.throws(() => buildRectangleAdjacency(input.left, invalidBundle, globalIds()));
  }
});

test('strict identifiers, tuples, own records and bounded snapshots reject executable or oversized data', () => {
  const input = makePair();
  const validIds = globalIds();
  const maximum = { ...validIds, adjacencyId: 'a'.repeat(128) };
  assert.doesNotThrow(() => buildRectangleAdjacency(input.left, input.right, maximum));
  for (const value of ['', '#a', 'bad id', '9id', '한글', Symbol('id'), 'a'.repeat(129)]) assert.throws(() => buildRectangleAdjacency(input.left, input.right, { ...validIds, adjacencyId: value }));
  for (const key of ['faceIds', 'vertexIds', 'edgeIds']) {
    const shortened = { ...validIds, [key]: validIds[key].slice(1) };
    assert.throws(() => buildRectangleAdjacency(input.left, input.right, shortened));
    const sparse = { ...validIds, [key]: Array(validIds[key].length) };
    assert.throws(() => buildRectangleAdjacency(input.left, input.right, sparse));
  }
  const duplicate = globalIds(); duplicate.edgeIds[0] = duplicate.vertexIds[0];
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, duplicate));
  let getterCalls = 0;
  const getterIds = Object.defineProperty(globalIds(), 'adjacencyId', { get() { getterCalls++; return 'adjacency'; } });
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, getterIds));
  const tupleGetter = globalIds();
  Object.defineProperty(tupleGetter.vertexIds, '0', { get() { getterCalls++; return 'g0'; } });
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, tupleGetter));
  const hiddenIds = Object.defineProperty(globalIds(), 'foreign', { value: 1, enumerable: false });
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, hiddenIds));
  const descriptor = buildRectangleAdjacency(input.left, input.right, validIds);
  const variants = [
    (d) => Object.defineProperty(d, 'faces', { get() { getterCalls++; return descriptor.faces; } }),
    (d) => Object.defineProperty(d.faces[0].bundle.geometry.objects[0].controlPoints[0][0], '0', { get() { getterCalls++; return 13; } }),
    (d) => Object.defineProperty(d.edges[1].uses[1], 'sense', { get() { getterCalls++; return 'reverse'; } }),
    (d) => Object.defineProperty(d, 'hidden', { value: 1, enumerable: false }),
    (d) => Object.defineProperty(d.edges[0], 'id', { value: d.edges[0].id, enumerable: false }),
    (d) => { d[Symbol('foreign')] = 1; },
    (d) => { delete d.vertices[0].point[0]; },
    (d) => { d.vertices[0].point.foreign = 1; },
    (d) => { d.cycle = d; },
    (d) => { d.faces = Array(129).fill(d.faces[0]); },
    (d) => { for (let i = 0; i < 17; i++) d[`foreign_${i}`] = i; },
  ];
  for (const mutate of variants) {
    const changed = structuredClone(descriptor);
    mutate(changed);
    assert.throws(() => validateRectangleAdjacency(changed));
  }
  assert.throws(() => validateRectangleAdjacency(Object.create(descriptor)));
  assert.throws(() => validateRectangleAdjacency(null));
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, { ...validIds, foreign: 1 }));
  assert.throws(() => buildRectangleAdjacency(input.left, input.right, Object.create(validIds)));
  assert.throws(() => buildRectangleAdjacency(null, input.right, validIds));
  assert.throws(() => buildRectangleAdjacency(input.left, null, validIds));
  const deep = structuredClone(descriptor);
  let nested = deep;
  for (let i = 0; i < 20; i++) nested = nested.foreign = {};
  assert.throws(() => validateRectangleAdjacency(deep), /Rectangle adjacency data gate: bounded structure exceeded/);
  const tooManyValues = structuredClone(descriptor);
  tooManyValues.payload = Array.from({ length: 128 }, () => Array.from({ length: 128 }, () => [0, 0, 0]));
  assert.throws(() => validateRectangleAdjacency(tooManyValues), /Rectangle adjacency data gate: bounded structure exceeded/);
  assert.equal(getterCalls, 0);
});
