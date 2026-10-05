import test from 'node:test';
import assert from 'node:assert/strict';
import { extrudeCurve } from '../dist/extrusion.js';
import { evaluateCurve, evaluateSurface, validateSurface } from '../dist/math.js';

const arc = {
  kind: 'curve', id: 'arc', degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controlPoints: [[10, 0, 0], [10, 10, 0], [0, 10, 0]], weights: [1, Math.SQRT1_2, 1],
};
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
function pointClose(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.hypot(...subtract(actual, expected)) <= tolerance, `${actual} differs from ${expected}`);
}
function circlePoint(u) {
  const a = (1 - u) ** 2;
  const b = 2 * Math.SQRT1_2 * u * (1 - u);
  const c = u ** 2;
  return [10 * (a + b) / (a + b + c), 10 * (b + c) / (a + b + c), 0];
}

test('exact tensor-product extrusion structure and 153 independent analytic cylinder samples', () => {
  const surface = extrudeCurve(arc, { id: 'wall', vector: [0, 0, 30] });
  validateSurface(surface);
  assert.deepEqual(surface, {
    kind: 'surface', id: 'wall', degreeU: 2, degreeV: 1,
    knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[10, 0, 0], [10, 0, 30]], [[10, 10, 0], [10, 10, 30]], [[0, 10, 0], [0, 10, 30]]],
    weights: [[1, 1], [Math.SQRT1_2, Math.SQRT1_2], [1, 1]],
  });
  let analyticMaximumMM = 0;
  let identityMaximumMM = 0;
  let sampleCount = 0;
  for (let i = 0; i < 17; i++) {
    const u = i / 16;
    for (let j = 0; j < 9; j++) {
      const v = j / 8;
      const point = evaluateSurface(surface, u, v);
      const analytic = circlePoint(u);
      analytic[2] = v * 30;
      const identity = evaluateCurve(arc, u);
      identity[2] += v * 30;
      pointClose(point, analytic);
      pointClose(point, identity);
      analyticMaximumMM = Math.max(analyticMaximumMM, Math.hypot(...subtract(point, analytic)));
      identityMaximumMM = Math.max(identityMaximumMM, Math.hypot(...subtract(point, identity)));
      sampleCount++;
    }
  }
  assert.equal(sampleCount, 153);
  console.log(JSON.stringify({ fixture: 'extruded-cylinder', sampleCount, analyticMaximumMM, identityMaximumMM }));
});

test('nonuniform rational curve and non-axis vector preserve independent interpolation and endpoints', () => {
  const curve = {
    kind: 'curve', id: 'asymmetric', degree: 1, knots: [-3, -3, -1, 4, 4],
    controlPoints: [[2, 3, -4], [11, -2, 7], [-5, 13, 9]], weights: [1, 3, 0.5],
  };
  const vector = [7, -11, 5];
  const surface = extrudeCurve(curve, { id: 'asymmetric_wall', vector });
  const scaled = extrudeCurve({ ...curve, weights: curve.weights.map((weight) => weight * 37) }, { id: 'scaled', vector });
  let maximumMM = 0;
  let count = 0;
  for (const u of [-3, -2.73, -2, -1.01, -1, -0.57, 0, 1.73, 3.99, 4]) {
    const segment = u < -1 ? 0 : 1;
    const t = segment === 0 ? (u + 3) / 2 : (u + 1) / 5;
    const factors = [(1 - t) * curve.weights[segment], t * curve.weights[segment + 1]];
    const expectedCurve = [0, 1, 2].map((axis) => (factors[0] * curve.controlPoints[segment][axis] + factors[1] * curve.controlPoints[segment + 1][axis]) / (factors[0] + factors[1]));
    for (const v of [0, 0.071, 0.25, 0.5, 0.817, 1]) {
      const expected = expectedCurve.map((value, axis) => value + v * vector[axis]);
      const actual = evaluateSurface(surface, u, v);
      pointClose(actual, expected);
      pointClose(evaluateSurface(scaled, u, v), expected);
      pointClose(actual, evaluateCurve(curve, u).map((value, axis) => value + v * vector[axis]));
      maximumMM = Math.max(maximumMM, Math.hypot(...subtract(actual, expected)));
      count++;
    }
  }
  console.log(JSON.stringify({ fixture: 'extruded-nonuniform-asymmetric', sampleCount: count, maximumMM }));
});

test('unit-weight negative control fails independent rational circle assertion', () => {
  const surface = extrudeCurve({ ...arc, weights: [1, 1, 1] }, { id: 'wrong_wall', vector: [0, 0, 30] });
  const point = evaluateSurface(surface, 0.5, 0.5);
  assert.throws(() => pointClose(point, [Math.sqrt(50), Math.sqrt(50), 15]), assert.AssertionError);
  assert.ok(Math.abs(Math.hypot(point[0], point[1]) - 10) > 0.1);
});

test('constructor owns every output array and preserves frozen input and options', () => {
  const curve = structuredClone(arc);
  const options = { id: 'wall', vector: [3, -5, 30] };
  const before = structuredClone({ curve, options });
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  freeze(curve);
  freeze(options);
  const first = extrudeCurve(curve, options);
  const second = extrudeCurve(curve, options);
  assert.deepEqual(first, second);
  assert.notEqual(first.knotsU, curve.knots);
  assert.notEqual(first.knotsV, second.knotsV);
  for (let index = 0; index < curve.controlPoints.length; index++) {
    assert.notEqual(first.controlPoints[index][0], curve.controlPoints[index]);
    assert.notEqual(first.controlPoints[index][0], first.controlPoints[index][1]);
    assert.notEqual(first.controlPoints[index], second.controlPoints[index]);
    assert.notEqual(first.weights[index], second.weights[index]);
  }
  first.knotsU[0] = 99;
  first.knotsV[0] = 99;
  first.controlPoints[0][0][0] = 99;
  first.controlPoints[0][1][0] = 99;
  first.weights[0][0] = 99;
  assert.deepEqual({ curve, options }, before);
  assert.deepEqual(extrudeCurve(curve, options), second);
});

function polyline(count) {
  return {
    kind: 'curve', id: 'polyline', degree: 1,
    knots: [0, 0, ...Array.from({ length: count - 2 }, (_, index) => index + 1), count - 1, count - 1],
    controlPoints: Array.from({ length: count }, (_, index) => [index, index % 2, 0]), weights: Array(count).fill(1),
  };
}

test('16 poles and coordinate boundaries pass; 17 poles and translated overflow reject', () => {
  const surface = extrudeCurve(polyline(16), { id: 'limit', vector: [0, 0, 1] });
  assert.equal(surface.controlPoints.length, 16);
  validateSurface(surface);
  assert.throws(() => extrudeCurve(polyline(17), { id: 'over', vector: [0, 0, 1] }), /16/);
  const boundary = { ...arc, controlPoints: [[1e6, 0, 0], [1e6, 10, 0], [1e6 - 10, 10, 0]] };
  assert.doesNotThrow(() => extrudeCurve(boundary, { id: 'boundary', vector: [0, 0, -1e6] }));
  assert.throws(() => extrudeCurve(boundary, { id: 'overflow', vector: [1, 0, 1] }), /coordinates/);
  assert.throws(() => extrudeCurve(arc, { id: 'overflow', vector: [Number.MAX_VALUE, 0, 1] }), /coordinates/);
});

test('bad curve, output IDs, dimensions, finite/nonzero vector and sparse arrays reject', () => {
  for (const id of [arc.id, '', '#wall', 'bad id', '9wall', '한글', null]) {
    assert.throws(() => extrudeCurve(arc, { id, vector: [0, 0, 30] }));
  }
  for (const vector of [null, [], [1, 2], [1, 2, 3, 4], [0, -0, 0], [NaN, 0, 1], [0, Infinity, 1], ['1', 0, 1], Array(3)]) {
    assert.throws(() => extrudeCurve(arc, { id: 'wall', vector }));
  }
  assert.throws(() => extrudeCurve(arc, null));
  assert.throws(() => extrudeCurve(null, { id: 'wall', vector: [0, 0, 1] }));
  for (const change of [{ degree: 0 }, { degree: 6 }, { knots: [0, 0, 1] }, { weights: [1, 0, 1] }, { weights: [1, Infinity, 1] }, { controlPoints: [[1e6 + 1, 0, 0], [10, 10, 0], [0, 10, 0]] }]) {
    assert.throws(() => extrudeCurve({ ...arc, ...change }, { id: 'wall', vector: [0, 0, 1] }));
  }
});

test('wholly collapsed collinear and constant curves reject without a hidden epsilon', () => {
  const line = { kind: 'curve', id: 'line', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[1, 2, 3], [3, 5, 7]], weights: [1, 2] };
  for (const vector of [[2, 3, 4], [-4, -6, -8], [1, 1.5, 2]]) {
    assert.throws(() => extrudeCurve(line, { id: 'collapsed', vector }), /collinear/);
  }
  const constant = { ...line, controlPoints: [[1, 2, 3], [1, 2, 3]] };
  assert.throws(() => extrudeCurve(constant, { id: 'collapsed', vector: [0, 0, 1] }), /collinear/);
  const nearly = { ...line, controlPoints: [[0, 0, 0], [1, 0, 0]] };
  assert.doesNotThrow(() => extrudeCurve(nearly, { id: 'narrow', vector: [1, Number.MIN_VALUE, 0] }));
  const tiny = { ...line, controlPoints: [[0, 0, 0], [Number.MIN_VALUE, 0, 0]] };
  assert.doesNotThrow(() => extrudeCurve(tiny, { id: 'tiny', vector: [0, Number.MIN_VALUE, 0] }));
  assert.throws(() => extrudeCurve(tiny, { id: 'collapsed', vector: [Number.MIN_VALUE, 0, 0] }), /collinear/);
  assert.throws(() => extrudeCurve(line, { id: 'lost', vector: [0, 0, Number.MIN_VALUE] }), /representable/);
});
