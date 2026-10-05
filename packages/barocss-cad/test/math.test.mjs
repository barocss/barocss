import test from 'node:test';
import assert from 'node:assert/strict';
import {
  curveDomain, evaluateCurve, evaluateSurface, sampleCurve, sampleSurface,
  surfaceDomain, validateCurve, validateModel, validateSurface,
} from '../dist/math.js';

const circle = {
  kind: 'curve', id: 'circle', degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controlPoints: [[10, 0, 0], [10, 10, 0], [0, 10, 0]], weights: [1, Math.SQRT1_2, 1],
};
const cylinder = {
  kind: 'surface', id: 'cylinder', degreeU: 2, degreeV: 1,
  knotsU: [...circle.knots], knotsV: [0, 0, 1, 1],
  controlPoints: circle.controlPoints.map(([x, y]) => [[x, y, 0], [x, y, 30]]),
  weights: circle.weights.map((weight) => [weight, weight]),
};
function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}
function pointClose(actual, expected) {
  actual.forEach((coordinate, axis) => close(coordinate, expected[axis]));
}

test('rational quarter circle, endpoints, radius and uniform weight scaling', () => {
  assert.deepEqual(curveDomain(circle), [0, 1]);
  pointClose(evaluateCurve(circle, 0), [10, 0, 0]);
  pointClose(evaluateCurve(circle, 1), [0, 10, 0]);
  pointClose(evaluateCurve(circle, 0.5), [Math.sqrt(50), Math.sqrt(50), 0]);
  const scaled = { ...circle, weights: circle.weights.map((weight) => weight * 123) };
  let maximumRadiusError = 0;
  for (const { parameter, point } of sampleCurve(circle, 129)) {
    maximumRadiusError = Math.max(maximumRadiusError, Math.abs(Math.hypot(point[0], point[1]) - 10));
    pointClose(evaluateCurve(scaled, parameter), point);
  }
  assert.ok(maximumRadiusError <= 1e-9);
  console.log(`analytic circle: 129 samples, maximum radius deviation ${maximumRadiusError} mm`);
  const nonrational = evaluateCurve({ ...circle, weights: [1, 1, 1] }, 0.5);
  assert.ok(Math.abs(Math.hypot(nonrational[0], nonrational[1]) - 10) > 0.1);
});

test('quarter cylinder uses U rows and V columns', () => {
  assert.deepEqual(surfaceDomain(cylinder), { u: [0, 1], v: [0, 1] });
  pointClose(evaluateSurface(cylinder, 0.5, 0.5), [Math.sqrt(50), Math.sqrt(50), 15]);
  let maximumError = 0;
  for (const row of sampleSurface(cylinder, 17, 19)) {
    for (const { u, v, point } of row) {
      const expected = evaluateCurve(circle, u);
      pointClose(point, [expected[0], expected[1], 30 * v]);
      maximumError = Math.max(maximumError, Math.abs(Math.hypot(point[0], point[1]) - 10), Math.abs(point[2] - 30 * v));
    }
  }
  assert.ok(maximumError <= 1e-9);
  console.log(`analytic cylinder: 323 samples, maximum deviation ${maximumError} mm`);
});

test('asymmetric bilinear patch has independent analytic interpolation', () => {
  const patch = {
    kind: 'surface', id: 'patch', degreeU: 1, degreeV: 1,
    knotsU: [-2, -2, 3, 3], knotsV: [4, 4, 6, 6],
    controlPoints: [[[1, 2, 3], [5, 11, -2]], [[13, -7, 9], [-3, 17, 21]]],
    weights: [[1, 1], [1, 1]],
  };
  let maximumError = 0;
  for (const row of sampleSurface(patch, 9, 9)) {
    for (const { u, v, point } of row) {
      const a = (u + 2) / 5;
      const b = (v - 4) / 2;
      const expected = [0, 1, 2].map((axis) =>
        (1 - a) * (1 - b) * patch.controlPoints[0][0][axis]
        + (1 - a) * b * patch.controlPoints[0][1][axis]
        + a * (1 - b) * patch.controlPoints[1][0][axis]
        + a * b * patch.controlPoints[1][1][axis]);
      pointClose(point, expected);
      maximumError = Math.max(maximumError, Math.hypot(...point.map((value, axis) => value - expected[axis])));
    }
  }
  console.log(`analytic asymmetric patch: 81 samples, maximum point deviation ${maximumError} mm`);
});

test('nonuniform linear spans and quadratic repeated knots', () => {
  const curve = { kind: 'curve', id: 'linear', degree: 1, knots: [2, 2, 3, 7, 7], controlPoints: [[0, 0, 0], [2, 4, 0], [10, 0, 0]], weights: [1, 1, 1] };
  pointClose(evaluateCurve(curve, 2.5), [1, 2, 0]);
  pointClose(evaluateCurve(curve, 3), [2, 4, 0]);
  pointClose(evaluateCurve(curve, 5), [6, 2, 0]);
  pointClose(evaluateCurve(curve, 7), [10, 0, 0]);
  const repeated = {
    kind: 'curve', id: 'repeat', degree: 2, knots: [0, 0, 0, 0.5, 0.5, 1, 1, 1],
    controlPoints: [[0, 0, 0], [1, 2, 0], [3, 4, 0], [5, 6, 0], [8, 0, 0]], weights: [1, 1, 1, 1, 1],
  };
  pointClose(evaluateCurve(repeated, 0.5), [3, 4, 0]);
  pointClose(evaluateCurve(repeated, 1), [8, 0, 0]);
  for (const t of [0.25, 0.75]) {
    const a = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const offset = t < 0.5 ? 0 : 2;
    const expected = [0, 1, 2].map((axis) =>
      (1 - a) ** 2 * repeated.controlPoints[offset][axis]
      + 2 * a * (1 - a) * repeated.controlPoints[offset + 1][axis]
      + a ** 2 * repeated.controlPoints[offset + 2][axis]);
    pointClose(evaluateCurve(repeated, t), expected);
  }
});

test('curve bounds and malformed geometry reject before evaluation', () => {
  const bad = [
    { degree: 0 }, { degree: 6 }, { degree: 3 }, { id: 'bad id' },
    { knots: [] }, { knots: [0, 0, 0, 0, 0, 0] },
    { knots: [0, 0, 0, 1, 0.5, 1] }, { knots: [0, 0, 0, 1, 1, Infinity] },
    { knots: [-1, 0, 0, 1, 1, 1] }, { weights: [1, 1] },
    { weights: [1, 0, 1] }, { weights: [1, 1e-7, 1] }, { weights: [1, 1e7, 1] },
    { weights: [1, NaN, 1] }, { controlPoints: [[10, 0], [1, 2, 3], [0, 10, 0]] },
    { controlPoints: [[Infinity, 0, 0], [1, 2, 3], [0, 10, 0]] },
    { controlPoints: [[1e6 + 1, 0, 0], [1, 2, 3], [0, 10, 0]] },
    { controlPoints: Array(65).fill([0, 0, 0]) },
    { controlPoints: Array(3) }, { weights: Array(3) },
    { controlPoints: [Array(3), [1, 2, 3], [0, 10, 0]] },
  ];
  for (const change of bad) assert.throws(() => validateCurve({ ...circle, ...change }));
  for (const parameter of [-0.001, 1.001, NaN, Infinity]) assert.throws(() => evaluateCurve(circle, parameter));
  const tooRepeated = { ...circle, degree: 1, controlPoints: Array(4).fill([0, 0, 0]), weights: Array(4).fill(1), knots: [0, 0, 0.5, 0.5, 1, 1] };
  assert.throws(() => validateCurve(tooRepeated));
});

test('finite tiny and large knot domains avoid intermediate overflow', () => {
  const line = { kind: 'curve', id: 'line', degree: 1, controlPoints: [[0, 0, 0], [10, 0, 0]], weights: [1, 1] };
  pointClose(evaluateCurve({ ...line, knots: [0, 0, 1e-320, 1e-320] }, 5e-321), [5, 0, 0]);
  pointClose(evaluateCurve({ ...line, knots: [-1e308, -1e308, 1e308, 1e308] }, 0), [5, 0, 0]);
});

test('surface, model and sample bounds reject invalid data', () => {
  for (const change of [
    { controlPoints: [] }, { controlPoints: Array(17).fill([[0, 0, 0], [0, 0, 0]]) },
    { controlPoints: [cylinder.controlPoints[0], []] },
    { weights: [[1, 1], [1, 1]] }, { weights: [[1], [1], [1]] },
    { degreeV: 2 }, { knotsV: [0, 0, 0, 0] },
  ]) assert.throws(() => validateSurface({ ...cylinder, ...change }));
  assert.throws(() => evaluateSurface(cylinder, 1.1, 0));
  assert.throws(() => evaluateSurface(cylinder, 0, -1));
  const model = { name: 'test', version: 0, lengthUnit: 'mm', objects: [circle, cylinder] };
  validateModel(model);
  for (const change of [{ version: 1 }, { lengthUnit: 'cm' }, { objects: [] }, { objects: [circle, circle] }, { objects: Array(17).fill(circle) }]) {
    assert.throws(() => validateModel({ ...model, ...change }));
  }
  for (const count of [0, 1, 1.5, 4097, NaN]) assert.throws(() => sampleCurve(circle, count));
  assert.throws(() => sampleSurface(cylinder, 65, 65));
  assert.equal(sampleCurve(circle, 4096).length, 4096);
  assert.equal(sampleSurface(cylinder, 64, 64).flat().length, 4096);
  assert.deepEqual(sampleCurve(circle, 17), sampleCurve(circle, 17));
});
