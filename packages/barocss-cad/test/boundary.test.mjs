import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractSurfaceBoundary } from '../dist/core/boundary.js';
import { evaluateCurve, evaluateSurface, validateCurve, validateModel } from '../dist/core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { compileCadModel } from '../dist/index.js';

const edges = ['v-min', 'u-max', 'v-max', 'u-min'];
const fractions = [0, ...Array.from({ length: 17 }, (_, i) => ((i + 1) / 18) ** 1.37), 1];
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
function pointClose(actual, expected, tolerance = 1e-9) {
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
const weighted = {
  ...flat, id: 'weighted_patch',
  controlPoints: [[[0, 0, 0], [1, 7, 3]], [[9, 2, 4], [12, 8, -2]]], weights: [[1, 2], [3, 4]],
};
const cylinder = {
  kind: 'surface', id: 'quarter_cylinder', degreeU: 2, degreeV: 1,
  knotsU: [-3, -3, -3, 11, 11, 11], knotsV: [2, 2, 7, 7],
  controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
  weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
};

// Independent rational bilinear polynomials and their analytic partials.
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

function domains(surface) {
  return { u: [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]], v: [surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]] };
}
function boundaryQuery(surface, edge, t) {
  const { u, v } = domains(surface);
  switch (edge) {
    case 'v-min': return { u: t, v: v[0], direction: 'du', sign: 1, domain: u };
    case 'u-max': return { u: u[1], v: t, direction: 'dv', sign: 1, domain: v };
    case 'v-max': return { u: u[0] + (u[1] - t), v: v[1], direction: 'du', sign: -1, domain: u };
    case 'u-min': return { u: u[0], v: v[0] + (v[1] - t), direction: 'dv', sign: -1, domain: v };
    default: throw new Error('Invalid test edge');
  }
}

function checkAllEdges(surface, oracle) {
  const curves = [];
  let pointMaximumMM = 0;
  let tangentMaximumMMPerParameter = 0;
  for (const edge of edges) {
    const curve = extractSurfaceBoundary(surface, { boundary: edge, id: `${surface.id}_${edge.replace('-', '_')}` });
    validateCurve(curve);
    curves.push(curve);
    const expectedDomain = boundaryQuery(surface, edge, 0).domain;
    assert.deepEqual([curve.knots[curve.degree], curve.knots[curve.controlPoints.length]], expectedDomain);
    const uEdge = edge.startsWith('v-');
    assert.equal(curve.degree, uEdge ? surface.degreeU : surface.degreeV);
    assert.equal(curve.controlPoints.length, uEdge ? surface.controlPoints.length : surface.controlPoints[0].length);
    for (const fraction of fractions) {
      const t = fraction === 1 ? expectedDomain[1] : expectedDomain[0] + fraction * (expectedDomain[1] - expectedDomain[0]);
      const query = boundaryQuery(surface, edge, t);
      const expected = oracle(query.u, query.v);
      const actual = evaluateCurveD1(curve, t);
      pointMaximumMM = Math.max(pointMaximumMM, pointClose(actual.point, expected.point));
      pointClose(actual.point, evaluateSurface(surface, query.u, query.v));
      const tangent = expected[query.direction].map((value) => query.sign * value);
      tangentMaximumMMPerParameter = Math.max(tangentMaximumMMPerParameter, vectorClose(actual.derivative, tangent));
      const native = evaluateSurfaceD1(surface, query.u, query.v);
      vectorClose(actual.derivative, native[query.direction].map((value) => query.sign * value));
    }
  }
  // Endpoint coincidence is a geometry check, not topological wire validation.
  for (let i = 0; i < 4; i++) {
    const current = curves[i];
    const next = curves[(i + 1) % 4];
    pointClose(evaluateCurve(current, current.knots[current.controlPoints.length]), evaluateCurve(next, next.knots[next.degree]));
  }
  console.log(JSON.stringify({ fixture: surface.id, edges: 4, samplesPerEdge: 19, interiorSamplesPerEdge: 17, pointMaximumMM, tangentMaximumMMPerParameter, topologyClaim: false }));
  return curves;
}

test('four flat boundaries preserve original domain, known orientation and independent coordinates', () => {
  checkAllEdges(flat, (u, v) => bilinearOracle(flat, u, v));
});

test('rational quarter-cylinder boundaries retain non-unit U/V scale and signed analytic tangents', () => {
  checkAllEdges(cylinder, cylinderOracle);
});

test('asymmetric weighted boundaries reject wrong row, reversed sign and parameter-scale controls', () => {
  const curves = checkAllEdges(weighted, (u, v) => bilinearOracle(weighted, u, v));
  const t = 0.731;
  const query = boundaryQuery(weighted, 'v-max', t);
  const expected = bilinearOracle(weighted, query.u, query.v);
  const actual = evaluateCurveD1(curves[2], t);
  assert.throws(() => vectorClose(actual.derivative, expected.du), assert.AssertionError);
  assert.throws(() => vectorClose(actual.derivative, expected.du.map((value) => -5 * value)), assert.AssertionError);
  assert.throws(() => pointClose(actual.point, evaluateCurve(curves[0], t)), assert.AssertionError);
  const wrongWeights = { ...curves[2], weights: Array(curves[2].weights.length).fill(1) };
  assert.throws(() => pointClose(evaluateCurve(wrongWeights, t), expected.point), assert.AssertionError);
});

function lineOracle(curve, u) {
  const segment = u < 3 ? 0 : 1;
  const a = curve.knots[segment + 1];
  const b = curve.knots[segment + 2];
  const fraction = (u - a) / (b - a);
  const w0 = curve.weights[segment];
  const w1 = curve.weights[segment + 1];
  const w = (1 - fraction) * w0 + fraction * w1;
  return {
    point: curve.controlPoints[segment].map((value, axis) => ((1 - fraction) * w0 * value + fraction * w1 * curve.controlPoints[segment + 1][axis]) / w),
    derivative: subtract(curve.controlPoints[segment + 1], curve.controlPoints[segment]).map((value) => value * w0 * w1 / (w * w * (b - a))),
  };
}

test('actual constructed nonuniform boundaries retain C0 rejection at original and reflected knots', () => {
  const source = readFileSync(new URL('../../../examples/cad-nurbs/extruded-asymmetric.css', import.meta.url), 'utf8');
  const result = compileCadModel(source,{sourceVersion:1});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  const input = result.model.objects.find((object) => object.kind === 'curve');
  const surface = result.model.objects.find((object) => object.kind === 'surface');
  const curves = checkAllEdges(surface, (u, v) => {
    const curve = lineOracle(input, u);
    return { point: curve.point.map((value, axis) => value + v * [3, -2, 7][axis]), du: curve.derivative, dv: [3, -2, 7] };
  });
  assert.throws(() => evaluateCurveD1(curves[0], 3));
  assert.throws(() => evaluateCurveD1(curves[2], 6));
  assert.doesNotThrow(() => evaluateCurve(curves[0], 3));
  assert.doesNotThrow(() => evaluateCurve(curves[2], 6));
  for (const [index, parameters] of [[0, [2.937, 3.031]], [2, [5.969, 6.063]]]) {
    for (const t of parameters) {
      const query = boundaryQuery(surface, edges[index], t);
      const expected = lineOracle(input, query.u);
      vectorClose(evaluateCurveD1(curves[index], t).derivative, expected.derivative.map((value) => query.sign * value));
    }
  }
});

function surfaceFromCurve(curve) {
  return { kind: 'surface', id: 'carrier', degreeU: curve.degree, degreeV: 1, knotsU: [...curve.knots], knotsV: [0, 0, 1, 1], controlPoints: curve.controlPoints.map(([x, y, z]) => [[x, y, z], [x, y, z + 1]]), weights: curve.weights.map((weight) => [weight, weight]) };
}

test('C1 repeated knots accept signed boundary derivatives at the exact original/reflected knot', () => {
  const knots = [-2, -2, -2, -2, 0.25, 0.25, 3, 3, 3, 3];
  const curve = {
    kind: 'curve', id: 'C1', degree: 3, knots, weights: Array(6).fill(1),
    controlPoints: Array.from({ length: 6 }, (_, i) => {
      const [a, b, c] = knots.slice(i + 1, i + 4);
      return [(a + b + c) / 3, (a * b + a * c + b * c) / 3, a * b * c];
    }),
  };
  const surface = surfaceFromCurve(curve);
  for (const [edge, t, sign] of [['v-min', 0.25, 1], ['v-max', 0.75, -1]]) {
    const boundary = extractSurfaceBoundary(surface, { boundary: edge, id: 'C1_edge' });
    const result = evaluateCurveD1(boundary, t);
    vectorClose(result.derivative, [1, 0.5, 3 * 0.25 ** 2].map((value) => value * sign));
  }
});

test('degree 1..5 and maximum 16 directional poles retain native extraction bounds', () => {
  for (let degree = 1; degree <= 5; degree++) {
    const curve = {
      kind: 'curve', id: 'polynomial_line', degree,
      knots: [...Array(degree + 1).fill(-7), ...Array(degree + 1).fill(13)],
      controlPoints: Array.from({ length: degree + 1 }, (_, i) => [1 + 20 * i / degree, 2 + 40 * i / degree, 3 - 20 * i / degree]),
      weights: Array(degree + 1).fill(1),
    };
    const surface = surfaceFromCurve(curve);
    for (const edge of ['v-min', 'v-max']) {
      const boundary = extractSurfaceBoundary(surface, { boundary: edge, id: 'degree_edge' });
      assert.equal(boundary.degree, degree);
      for (const t of [-7, -1.37, 13]) {
        const reversed = edge === 'v-max';
        const u = reversed ? 6 - t : t;
        const result = evaluateCurveD1(boundary, t);
        pointClose(result.point, [u + 8, 2 * u + 16, -u - 4 + (reversed ? 1 : 0)]);
        vectorClose(result.derivative, reversed ? [-1, -2, 1] : [1, 2, -1]);
      }
    }
  }
  const maximum = { kind: 'curve', id: 'maximum', degree: 1, knots: [0, 0, ...Array.from({ length: 14 }, (_, i) => i + 1), 15, 15], controlPoints: Array.from({ length: 16 }, (_, i) => [i, i * 2, -i]), weights: Array(16).fill(1) };
  for (const edge of ['v-min', 'v-max']) {
    const boundary = extractSurfaceBoundary(surfaceFromCurve(maximum), { boundary: edge, id: 'maximum_edge' });
    assert.equal(boundary.controlPoints.length, 16);
    validateCurve(boundary);
  }
});

test('reversing twice recovers native arrays within selected floating criteria and reverses geometry', () => {
  const original = {
    kind: 'curve', id: 'nonuniform', degree: 2, knots: [-4, -4, -4, -1.3, 0.37, 2.75, 2.75, 2.75],
    controlPoints: [[1, 2, 3], [4, -3, 7], [11, 9, -2], [-5, 3, 4], [8, 1, 2]], weights: [1, 0.7, 2, 1.3, 0.9],
  };
  // Use a constant V direction to isolate parameter reversal without a Z shift.
  const carrier = (curve) => ({ ...surfaceFromCurve(curve), controlPoints: curve.controlPoints.map((point) => [[...point], [...point]]) });
  const reversed = extractSurfaceBoundary(carrier(original), { boundary: 'v-max', id: 'reversed' });
  const twice = extractSurfaceBoundary(carrier(reversed), { boundary: 'v-max', id: 'twice' });
  assert.equal(twice.degree, original.degree);
  assert.deepEqual(twice.controlPoints, original.controlPoints);
  assert.deepEqual(twice.weights, original.weights);
  original.knots.forEach((knot, i) => assert.ok(Math.abs(twice.knots[i] - knot) <= 1e-12));
  for (const fraction of fractions) {
    const t = -4 + fraction * 6.75;
    const reflected = -4 + (2.75 - t);
    pointClose(evaluateCurve(reversed, t), evaluateCurve(original, reflected));
    vectorClose(evaluateCurveD1(reversed, t).derivative, evaluateCurveD1(original, reflected).derivative.map((value) => -value));
    pointClose(evaluateCurve(twice, t), evaluateCurve(original, t));
  }
});

test('constant collapsed boundaries remain native geometry with finite zero tangents', () => {
  const collapsed = { ...weighted, controlPoints: [[[3, -2, 7], [3, -2, 7]], [[3, -2, 7], [3, -2, 7]]] };
  const curves = checkAllEdges(collapsed, () => ({ point: [3, -2, 7], du: [0, 0, 0], dv: [0, 0, 0] }));
  assert.equal(curves.length, 4);
});

test('frozen inputs and options remain byte-equivalent with independently owned nested output arrays', () => {
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  const surface = structuredClone(weighted);
  const before = JSON.stringify(surface);
  const options = { boundary: 'v-max', id: 'owned' };
  freeze(surface);
  freeze(options);
  const first = extractSurfaceBoundary(surface, options);
  const second = extractSurfaceBoundary(surface, options);
  assert.deepEqual(first, second);
  assert.notEqual(first.knots, second.knots);
  assert.notEqual(first.weights, second.weights);
  assert.notEqual(first.controlPoints, second.controlPoints);
  first.controlPoints.forEach((point, i) => {
    assert.notEqual(point, second.controlPoints[i]);
    for (const row of surface.controlPoints) for (const sourcePoint of row) assert.notEqual(point, sourcePoint);
  });
  first.knots[0] = 999;
  first.weights[0] = 999;
  first.controlPoints[0][0] = 999;
  assert.equal(JSON.stringify(surface), before);
  assert.deepEqual(extractSurfaceBoundary(surface, options), second);
  const all = edges.map((boundary) => extractSurfaceBoundary(surface, { boundary, id: 'separate' }));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    assert.notEqual(all[i].knots, all[j].knots);
    assert.notEqual(all[i].weights, all[j].weights);
    for (const point of all[i].controlPoints) for (const other of all[j].controlPoints) assert.notEqual(point, other);
  }
});

test('aliased input rows, poles and weights never become aliased output poles', () => {
  const point = [1, 2, 3];
  const row = [point, point];
  const weights = [1, 2];
  const aliased = { ...flat, controlPoints: [row, row], weights: [weights, weights] };
  const before = JSON.stringify(aliased);
  for (const boundary of edges) {
    const curve = extractSurfaceBoundary(aliased, { boundary, id: 'alias_edge' });
    assert.notEqual(curve.controlPoints[0], curve.controlPoints[1]);
    assert.notEqual(curve.controlPoints[0], point);
    curve.controlPoints[0][0] = 999;
    curve.weights[0] = 999;
    assert.equal(JSON.stringify(aliased), before);
  }
});

test('plain exact own-data options reject foreign keys, symbols, accessors and inherited required fields', () => {
  const valid = { boundary: 'v-min', id: 'edge' };
  const nullPrototype = Object.assign(Object.create(null), valid);
  assert.doesNotThrow(() => extractSurfaceBoundary(flat, nullPrototype));
  let getterCalls = 0;
  const getter = Object.defineProperty({ id: 'edge' }, 'boundary', { enumerable: true, get() { getterCalls++; return 'v-min'; } });
  const hiddenGetter = Object.defineProperty({ ...valid }, 'foreign', { get() { getterCalls++; return 1; } });
  const options = [null, undefined, [], 'v-min', {}, { boundary: 'v-min' }, { id: 'edge' }, { ...valid, foreign: 1 }, { ...valid, [Symbol('foreign')]: 1 }, getter, hiddenGetter, Object.create(valid), Object.assign(Object.create({ foreign: 1 }), valid)];
  for (const option of options) assert.throws(() => extractSurfaceBoundary(flat, option));
  assert.equal(getterCalls, 0);
  for (const boundary of ['v-middle', 'u-min ', 'V-MIN', 0, null, Symbol('v-min')]) assert.throws(() => extractSurfaceBoundary(flat, { boundary, id: 'edge' }));
  for (const id of ['', '#edge', 'bad id', '9edge', '한글', null, Symbol('edge')]) assert.throws(() => extractSurfaceBoundary(flat, { boundary: 'v-min', id }));
  const sameID = extractSurfaceBoundary(flat, { boundary: 'v-min', id: flat.id });
  assert.equal(sameID.id, flat.id);
  assert.throws(() => validateModel({ name: 'duplicates', version: 0, lengthUnit: 'mm', objects: [flat, sameID] }));
});

test('invalid native geometry and curve query bounds retain existing strict rejection', () => {
  for (const surface of [null, {}, { ...flat, kind: 'curve' }, { ...flat, degreeU: 0 }, { ...flat, degreeV: 6 }, { ...flat, knotsU: [] }, { ...flat, weights: [[1, 0], [1, 1]] }, { ...flat, weights: [[1], [1]] }, { ...flat, controlPoints: Array(17).fill([[0, 0, 0], [1, 1, 1]]) }, { ...flat, controlPoints: [[[1e6 + 1, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0]]] }, { ...flat, controlPoints: [[[Infinity, 0, 0], [0, 0, 0]], [[0, 0, 0], [0, 0, 0]]] }]) {
    assert.throws(() => extractSurfaceBoundary(surface, { boundary: 'v-min', id: 'edge' }));
  }
  const curve = extractSurfaceBoundary(flat, { boundary: 'v-max', id: 'edge' });
  for (const t of [-3, 4, Infinity, NaN]) {
    assert.throws(() => evaluateCurve(curve, t));
    assert.throws(() => evaluateCurveD1(curve, t));
  }
});

test('huge finite domain reversal avoids sum overflow and rejects unrepresentable knot collapse', () => {
  const huge = { kind: 'curve', id: 'huge', degree: 1, knots: [-1e308, -1e308, 1e308, 1e308], controlPoints: [[0, 0, 0], [10, 1, 2]], weights: [1, 2] };
  const reversed = extractSurfaceBoundary(surfaceFromCurve(huge), { boundary: 'v-max', id: 'huge_reversed' });
  assert.deepEqual(reversed.knots, huge.knots);
  pointClose(evaluateCurve(reversed, -1e308), [10, 1, 3]);
  pointClose(evaluateCurve(reversed, 1e308), [0, 0, 1]);
  const positive = { ...huge, knots: [1e308, 1e308, 1.2e308, 1.6e308, 1.6e308], controlPoints: [[0, 0, 0], [5, 1, 2], [10, 2, 4]], weights: [1, 2, 3] };
  const stable = extractSurfaceBoundary(surfaceFromCurve(positive), { boundary: 'v-max', id: 'stable' });
  assert.equal(stable.knots[0], 1e308);
  assert.equal(stable.knots.at(-1), 1.6e308);
  assert.ok(Math.abs(stable.knots[2] / 1.4e308 - 1) < 1e-14);
  const collapsed = { ...huge, knots: [0, 0, 1e-20, 1e6, 1e6], controlPoints: [[0, 0, 0], [5, 1, 2], [10, 2, 4]], weights: [1, 2, 3] };
  assert.doesNotThrow(() => extractSurfaceBoundary(surfaceFromCurve(collapsed), { boundary: 'v-min', id: 'forward' }));
  assert.throws(() => extractSurfaceBoundary(surfaceFromCurve(collapsed), { boundary: 'v-max', id: 'collapsed' }));
  const mergedInterior = { ...huge, knots: [-1e308, -1e308, 0, 1, 8e307, 8e307], controlPoints: [[0, 0, 0], [3, 1, 2], [7, 2, 3], [10, 3, 4]], weights: [1, 2, 3, 4] };
  assert.throws(() => extractSurfaceBoundary(surfaceFromCurve(mergedInterior), { boundary: 'v-max', id: 'collapsed' }));
  // The merged pair would still satisfy degree-two multiplicity bounds. It must
  // reject because distinct source knots lost their separation, not just because
  // the ordinary native validator sometimes catches invalid multiplicity.
  const otherwiseValidMerge = { ...huge, degree: 2, knots: [-1e308, -1e308, -1e308, 0, 1, 8e307, 8e307, 8e307], controlPoints: [[0, 0, 0], [2, 1, 2], [4, 2, 3], [7, 3, 4], [10, 4, 5]], weights: [1, 2, 3, 4, 5] };
  assert.throws(() => extractSurfaceBoundary(surfaceFromCurve(otherwiseValidMerge), { boundary: 'v-max', id: 'collapsed' }));
});
