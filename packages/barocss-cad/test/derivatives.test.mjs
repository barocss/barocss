import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../dist/core/derivatives.js';
import { evaluateCurve, evaluateSurface } from '../dist/core/math.js';
import { compileCadModel } from '../dist/index.js';
import { extrudeCurve } from '../dist/core/extrusion.js';

const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
function vectorClose(actual, expected, relative = 1e-9) {
  assert.equal(actual.length, 3);
  assert.ok(actual.every(Number.isFinite));
  const error = Math.hypot(...subtract(actual, expected));
  const limit = relative * Math.max(1, Math.hypot(...expected));
  assert.ok(error <= limit, `Vector ${actual} differs from ${expected}; error ${error}, limit ${limit}`);
  return error;
}
function choose(n, k) {
  let result = 1;
  for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
  return result;
}
function bernstein(n, i, t) {
  if (i < 0 || i > n) return 0;
  return choose(n, i) * t ** i * (1 - t) ** (n - i);
}

// Independent finite Bernstein polynomial oracle. It uses no CAD basis helper.
function bezierOracle(points, weights, parameter, domain) {
  const degree = points.length - 1;
  const interval = domain[1] - domain[0];
  const t = (parameter - domain[0]) / interval;
  const numerator = [0, 0, 0];
  const gradient = [0, 0, 0];
  let denominator = 0;
  let denominatorGradient = 0;
  for (let i = 0; i <= degree; i++) {
    const value = bernstein(degree, i, t) * weights[i];
    const derivative = degree * (bernstein(degree - 1, i - 1, t) - bernstein(degree - 1, i, t)) * weights[i] / interval;
    denominator += value;
    denominatorGradient += derivative;
    for (let axis = 0; axis < 3; axis++) {
      numerator[axis] += value * points[i][axis];
      gradient[axis] += derivative * points[i][axis];
    }
  }
  const point = numerator.map((value) => value / denominator);
  const derivative = gradient.map((value, axis) => (value * denominator - numerator[axis] * denominatorGradient) / denominator ** 2);
  return { point, derivative };
}

const arc = {
  kind: 'curve', id: 'arc', degree: 2, knots: [0, 0, 0, 1, 1, 1],
  controlPoints: [[10, 0, 0], [10, 10, 0], [0, 10, 0]], weights: [1, Math.SQRT1_2, 1],
};
function curveFixture(degree, domain, rational) {
  return {
    kind: 'curve', id: `degree_${degree}`, degree,
    knots: [...Array(degree + 1).fill(domain[0]), ...Array(degree + 1).fill(domain[1])],
    controlPoints: Array.from({ length: degree + 1 }, (_, i) => [i * i + 2, 3 * i - i * i, (i % 2 ? -1 : 1) * (i + 4)]),
    weights: Array.from({ length: degree + 1 }, (_, i) => rational ? (i + 1) / 3 : 1),
  };
}

test('degree 1..5 polynomial and rational Bernstein derivatives use original-domain units', () => {
  let maximumMMPerParameter = 0;
  let sampleCount = 0;
  for (let degree = 1; degree <= 5; degree++) {
    for (const rational of [false, true]) {
      for (const domain of [[0, 1], [-7, -2], [2, 15]]) {
        const curve = curveFixture(degree, domain, rational);
        for (const t of [0, 0.031, 0.125, 0.37, 0.5, 0.819, 1]) {
          const parameter = domain[0] + t * (domain[1] - domain[0]);
          const expected = bezierOracle(curve.controlPoints, curve.weights, parameter, domain);
          const actual = evaluateCurveD1(curve, parameter);
          vectorClose(actual.point, expected.point);
          vectorClose(actual.point, evaluateCurve(curve, parameter));
          maximumMMPerParameter = Math.max(maximumMMPerParameter, vectorClose(actual.derivative, expected.derivative));
          sampleCount++;
        }
      }
    }
  }
  console.log(JSON.stringify({ fixture: 'degree-1-through-5-Bernstein', sampleCount, maximumMMPerParameter, limit: '1e-9 * max(1, expected derivative norm)' }));
});

test('rational quarter circle, weight scaling and non-unit reparameterization have analytic derivatives', () => {
  const domain = [-3, 11];
  const reparameterized = { ...arc, id: 'scaled_domain', knots: [-3, -3, -3, 11, 11, 11] };
  const weightScaled = { ...reparameterized, weights: arc.weights.map((weight) => weight * 73) };
  let maximumMMPerParameter = 0;
  for (let i = 0; i < 17; i++) {
    const t = i / 16;
    const u = domain[0] + t * 14;
    const expected = bezierOracle(arc.controlPoints, arc.weights, t, [0, 1]);
    const actual = evaluateCurveD1(arc, t);
    maximumMMPerParameter = Math.max(maximumMMPerParameter, vectorClose(actual.derivative, expected.derivative));
    const domainDerivative = expected.derivative.map((value) => value / 14);
    vectorClose(evaluateCurveD1(reparameterized, u).derivative, domainDerivative);
    vectorClose(evaluateCurveD1(weightScaled, u).derivative, domainDerivative);
    assert.ok(Math.abs(actual.point[0] * actual.derivative[0] + actual.point[1] * actual.derivative[1]) < 1e-9);
  }
  const midpoint = evaluateCurveD1(reparameterized, 4);
  assert.throws(() => vectorClose(midpoint.derivative, evaluateCurveD1(arc, 0.5).derivative), assert.AssertionError);
  const wrongWeights = evaluateCurveD1({ ...arc, weights: [1, 1, 1] }, 0.5);
  assert.throws(() => vectorClose(wrongWeights.derivative, bezierOracle(arc.controlPoints, arc.weights, 0.5, [0, 1]).derivative), assert.AssertionError);
  console.log(JSON.stringify({ fixture: 'rational-quarter-circle', sampleCount: 17, maximumMMPerParameter }));
});

// Closed form for an independently weighted degree-one span.
function lineSpanOracle(curve, u) {
  const index = u < curve.knots[2] ? 0 : 1;
  const left = curve.knots[index + 1];
  const right = curve.knots[index + 2];
  const t = (u - left) / (right - left);
  const w0 = curve.weights[index];
  const w1 = curve.weights[index + 1];
  const denominator = (1 - t) * w0 + t * w1;
  return {
    point: curve.controlPoints[index].map((value, axis) => ((1 - t) * w0 * value + t * w1 * curve.controlPoints[index + 1][axis]) / denominator),
    derivative: subtract(curve.controlPoints[index + 1], curve.controlPoints[index]).map((value) => value * w0 * w1 / (denominator ** 2 * (right - left))),
  };
}

test('actual asymmetric extrusion rejects exact C0 knot but accepts both spans and endpoints', () => {
  const source = readFileSync(new URL('../../../examples/cad-nurbs/extruded-asymmetric.css', import.meta.url), 'utf8');
  const result = compileCadModel(source,{sourceVersion:1});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  const curve = result.model.objects.find((object) => object.kind === 'curve');
  const surface = result.model.objects.find((object) => object.kind === 'surface');
  assert.deepEqual(curve.knots, [2, 2, 3, 7, 7]);
  assert.throws(() => evaluateCurveD1(curve, 3));
  assert.doesNotThrow(() => evaluateCurve(curve, 3));
  for (const v of [0, 0.173, 1]) assert.throws(() => evaluateSurfaceD1(surface, 3, v));
  let maximumMMPerParameter = 0;
  for (const u of [2, 2.137, 2.5, 2.937, 3.031, 3.713, 5, 6.827, 7]) {
    const expected = lineSpanOracle(curve, u);
    const actual = evaluateCurveD1(curve, u);
    vectorClose(actual.point, expected.point);
    maximumMMPerParameter = Math.max(maximumMMPerParameter, vectorClose(actual.derivative, expected.derivative));
    for (const v of [0, 0.071, 0.5, 0.819, 1]) {
      const evaluated = evaluateSurfaceD1(surface, u, v);
      vectorClose(evaluated.du, expected.derivative);
      vectorClose(evaluated.dv, [3, -2, 7]);
      vectorClose(evaluated.point, expected.point.map((value, axis) => value + v * [3, -2, 7][axis]));
      vectorClose(evaluated.point, evaluateSurface(surface, u, v));
    }
  }
  // Exact endpoint expressions of the two separate spans have different limits.
  const leftLimit = subtract(curve.controlPoints[1], curve.controlPoints[0]).map((value) => value * curve.weights[0] / curve.weights[1]);
  const rightLimit = subtract(curve.controlPoints[2], curve.controlPoints[1]).map((value) => value * curve.weights[2] / curve.weights[1] / 4);
  assert.ok(Math.hypot(...subtract(leftLimit, rightLimit)) > 1);
  const leftDerivative = evaluateCurveD1(curve, 2.937).derivative;
  const rightDerivative = evaluateCurveD1(curve, 3.031).derivative;
  const crossZ = leftDerivative[0] * rightDerivative[1] - leftDerivative[1] * rightDerivative[0];
  assert.ok(Math.abs(crossZ) > 1);
  const transposed = {
    ...surface, degreeU: surface.degreeV, degreeV: surface.degreeU,
    knotsU: [...surface.knotsV], knotsV: [...surface.knotsU],
    controlPoints: [0, 1].map((j) => surface.controlPoints.map((row) => row[j])),
    weights: [0, 1].map((j) => surface.weights.map((row) => row[j])),
  };
  assert.throws(() => evaluateSurfaceD1(transposed, 0.5, 3));
  assert.doesNotThrow(() => evaluateSurfaceD1(transposed, 0.5, 2.937));
  console.log(JSON.stringify({ fixture: 'actual-asymmetric-C0-extrusion', curveSamples: 9, surfaceSamples: 45, maximumMMPerParameter, leftLimit, rightLimit }));
});

test('C1 double interior cubic knot reproduces global polynomial derivatives exactly at knot', () => {
  const knots = [-2, -2, -2, -2, 0.5, 0.5, 3, 3, 3, 3];
  const curve = {
    kind: 'curve', id: 'C1_repeated', degree: 3, knots,
    controlPoints: Array.from({ length: 6 }, (_, i) => {
      const [a, b, c] = knots.slice(i + 1, i + 4);
      return [(a + b + c) / 3, (a * b + a * c + b * c) / 3, a * b * c];
    }), weights: Array(6).fill(1),
  };
  for (const u of [-2, -1.37, 0, 0.5, 0.937, 2.83, 3]) {
    const actual = evaluateCurveD1(curve, u);
    vectorClose(actual.point, [u, u * u, u ** 3]);
    vectorClose(actual.derivative, [1, 2 * u, 3 * u * u]);
    const surface = extrudeCurve(curve, { id: 'C1_wall', vector: [0, 0, 7] });
    const evaluated = evaluateSurfaceD1(surface, u, 0.37);
    vectorClose(evaluated.du, [1, 2 * u, 3 * u * u]);
    vectorClose(evaluated.dv, [0, 0, 7]);
  }
});

test('conservative C0 rejection also applies when poles happen to cancel the kink', () => {
  const straight = { kind: 'curve', id: 'straight_C0', degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [1, 2, 3], [2, 4, 6]], weights: [1, 1, 1] };
  assert.throws(() => evaluateCurveD1(straight, 1));
  vectorClose(evaluateCurveD1(straight, 0.5).derivative, [1, 2, 3]);
  vectorClose(evaluateCurveD1(straight, 1.5).derivative, [1, 2, 3]);
});

test('maximum 64-pole curve remains bounded and evaluates non-knot spans', () => {
  const curve = {
    kind: 'curve', id: 'maximum_curve', degree: 1,
    knots: [0, 0, ...Array.from({ length: 62 }, (_, i) => i + 1), 63, 63],
    controlPoints: Array.from({ length: 64 }, (_, i) => [i, 2 * i, -i]), weights: Array(64).fill(1),
  };
  for (const u of [0, 0.5, 31.173, 62.937, 63]) {
    const actual = evaluateCurveD1(curve, u);
    vectorClose(actual.point, [u, 2 * u, -u]);
    vectorClose(actual.derivative, [1, 2, -1]);
  }
});

test('huge finite knot interval restores original scale without overflowing interval subtraction', () => {
  const curve = { kind: 'curve', id: 'huge_domain', degree: 1, knots: [-1e308, -1e308, 1e308, 1e308], controlPoints: [[0, 0, 0], [10, 0, 0]], weights: [1, 1] };
  for (const u of [-1e308, 0, 1e308]) {
    const actual = evaluateCurveD1(curve, u);
    assert.ok(actual.derivative.every(Number.isFinite));
    assert.ok(Math.abs(actual.derivative[0] / 5e-308 - 1) <= 1e-12);
    assert.equal(actual.derivative[1], 0);
    assert.equal(actual.derivative[2], 0);
  }
});

const patch = {
  kind: 'surface', id: 'weighted_patch', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 3, 3], knotsV: [4, 4, 6, 6],
  controlPoints: [[[0, 0, 0], [1, 7, 3]], [[9, 2, 4], [12, 8, -2]]],
  weights: [[1, 2], [3, 4]],
};
function bilinearOracle(surface, u, v) {
  const t = (u + 2) / 5;
  const s = (v - 4) / 2;
  const coefficients = [[(1 - t) * (1 - s), (1 - t) * s], [t * (1 - s), t * s]];
  const uCoefficients = [[-(1 - s) / 5, -s / 5], [(1 - s) / 5, s / 5]];
  const vCoefficients = [[-(1 - t) / 2, (1 - t) / 2], [-t / 2, t / 2]];
  const sums = [coefficients, uCoefficients, vCoefficients].map((matrix) => {
    const point = [0, 0, 0];
    let weight = 0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const coefficient = matrix[i][j] * surface.weights[i][j];
      weight += coefficient;
      for (let axis = 0; axis < 3; axis++) point[axis] += coefficient * surface.controlPoints[i][j][axis];
    }
    return { point, weight };
  });
  const [value, uSum, vSum] = sums;
  return {
    point: value.point.map((coordinate) => coordinate / value.weight),
    du: uSum.point.map((coordinate, axis) => (coordinate * value.weight - value.point[axis] * uSum.weight) / value.weight ** 2),
    dv: vSum.point.map((coordinate, axis) => (coordinate * value.weight - value.point[axis] * vSum.weight) / value.weight ** 2),
  };
}

test('weighted nonplanar surface checks both rational partials and swapped/negated controls', () => {
  let maximumMMPerParameter = 0;
  for (const u of [-2, -1.827, -0.25, 0.5, 2.731, 3]) {
    for (const v of [4, 4.071, 4.5, 5.731, 6]) {
      const expected = bilinearOracle(patch, u, v);
      const actual = evaluateSurfaceD1(patch, u, v);
      vectorClose(actual.point, expected.point);
      vectorClose(actual.point, evaluateSurface(patch, u, v));
      maximumMMPerParameter = Math.max(maximumMMPerParameter, vectorClose(actual.du, expected.du), vectorClose(actual.dv, expected.dv));
      const scaled = evaluateSurfaceD1({ ...patch, weights: patch.weights.map((row) => row.map((weight) => weight * 37)) }, u, v);
      vectorClose(scaled.du, expected.du);
      vectorClose(scaled.dv, expected.dv);
    }
  }
  const actual = evaluateSurfaceD1(patch, 0.5, 5);
  const expected = bilinearOracle(patch, 0.5, 5);
  assert.throws(() => vectorClose(actual.du, expected.dv), assert.AssertionError);
  assert.throws(() => vectorClose(actual.dv, expected.du), assert.AssertionError);
  assert.throws(() => vectorClose(actual.du, expected.du.map((value) => -value)), assert.AssertionError);
  const unweighted = evaluateSurfaceD1({ ...patch, weights: [[1, 1], [1, 1]] }, 0.5, 5);
  assert.throws(() => vectorClose(unweighted.du, expected.du), assert.AssertionError);
  assert.throws(() => vectorClose(unweighted.dv, expected.dv), assert.AssertionError);
  console.log(JSON.stringify({ fixture: 'weighted-nonplanar-both-partials', sampleCount: 30, maximumMMPerParameter }));
});

test('asymmetric flat tangents retain exact domain scale and known U cross V orientation', () => {
  const flat = { ...patch, id: 'flat_patch', controlPoints: [[[1, 2, 2], [2, 9, 2]], [[7, 3, 2], [8, 10, 2]]], weights: [[1, 1], [1, 1]] };
  for (const u of [-2, 0.173, 3]) for (const v of [4, 4.819, 6]) {
    const { du, dv } = evaluateSurfaceD1(flat, u, v);
    vectorClose(du, [6 / 5, 1 / 5, 0]);
    vectorClose(dv, [1 / 2, 7 / 2, 0]);
    vectorClose([du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]], [0, 0, 4.1]);
  }
});

test('actual quarter-circle extrusion has du = curve derivative and dv = construction vector', () => {
  const source = readFileSync(new URL('../../../examples/cad-nurbs/extruded-cylinder.css', import.meta.url), 'utf8');
  const result = compileCadModel(source,{sourceVersion:1});assert.equal(result.ok,true,JSON.stringify(result.diagnostics));
  const curve = result.model.objects.find((object) => object.kind === 'curve');
  const surface = result.model.objects.find((object) => object.kind === 'surface');
  for (let i = 0; i < 17; i++) for (let j = 0; j < 9; j++) {
    const u = i / 16;
    const v = j / 8;
    const actual = evaluateSurfaceD1(surface, u, v);
    const expected = bezierOracle(curve.controlPoints, curve.weights, u, [0, 1]);
    vectorClose(actual.du, expected.derivative);
    vectorClose(actual.du, evaluateCurveD1(curve, u).derivative);
    vectorClose(actual.dv, [0, 0, 30]);
    vectorClose(actual.point, expected.point.map((value, axis) => value + v * [0, 0, 30][axis]));
  }
});

test('zero curve and surface derivatives are finite valid results without regularity claims', () => {
  const constant = { ...arc, controlPoints: [[3, -2, 7], [3, -2, 7], [3, -2, 7]], weights: [1, 2, 3] };
  for (const u of [0, 0.173, 0.5, 1]) vectorClose(evaluateCurveD1(constant, u).derivative, [0, 0, 0]);
  const constantSurface = { ...patch, controlPoints: [[[3, -2, 7], [3, -2, 7]], [[3, -2, 7], [3, -2, 7]]] };
  for (const [u, v] of [[-2, 4], [0.37, 5.173], [3, 6]]) {
    const result = evaluateSurfaceD1(constantSurface, u, v);
    vectorClose(result.du, [0, 0, 0]);
    vectorClose(result.dv, [0, 0, 0]);
  }
});

test('invalid geometry, parameters and unrepresentable derivative arithmetic reject', () => {
  for (const u of [-1, 2, NaN, Infinity, -Infinity, '0.5', null]) assert.throws(() => evaluateCurveD1(arc, u));
  for (const [u, v] of [[-3, 5], [4, 5], [0, 3], [0, 7], [NaN, 5], [0, Infinity]]) assert.throws(() => evaluateSurfaceD1(patch, u, v));
  for (const change of [{ degree: 0 }, { degree: 6 }, { knots: [] }, { weights: [1, 0, 1] }, { weights: [1, Infinity, 1] }, { controlPoints: Array(65).fill([0, 0, 0]) }]) {
    assert.throws(() => evaluateCurveD1({ ...arc, ...change }, 0.5));
  }
  for (const change of [{ degreeV: 0 }, { knotsU: [] }, { weights: [[1, 0], [1, 1]] }, { controlPoints: [[], []] }]) {
    assert.throws(() => evaluateSurfaceD1({ ...patch, ...change }, 0.5, 5));
  }
  const overflow = { kind: 'curve', id: 'overflow', degree: 1, knots: [0, 0, 1e-320, 1e-320], controlPoints: [[0, 0, 0], [1, 0, 0]], weights: [1, 1] };
  assert.doesNotThrow(() => evaluateCurve(overflow, 5e-321));
  assert.throws(() => evaluateCurveD1(overflow, 5e-321));
  const overflowSurface = { kind: 'surface', id: 'overflow_surface', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1e-320, 1e-320], controlPoints: [[[0, 0, 0], [0, 1, 0]], [[1, 0, 0], [1, 1, 0]]], weights: [[1, 1], [1, 1]] };
  assert.throws(() => evaluateSurfaceD1(overflowSurface, 0.5, 5e-321));
});

test('frozen input and result arrays have independent defensive ownership', () => {
  function freeze(value) {
    if (value && typeof value === 'object') {
      for (const item of Object.values(value)) freeze(item);
      Object.freeze(value);
    }
  }
  const curve = structuredClone(arc);
  const surface = structuredClone(patch);
  const before = structuredClone({ curve, surface });
  freeze(curve);
  freeze(surface);
  const curveResult = evaluateCurveD1(curve, 0.37);
  const surfaceResult = evaluateSurfaceD1(surface, 0.37, 5.173);
  const secondCurve = evaluateCurveD1(curve, 0.37);
  const secondSurface = evaluateSurfaceD1(surface, 0.37, 5.173);
  assert.deepEqual(curveResult, secondCurve);
  assert.deepEqual(surfaceResult, secondSurface);
  assert.notEqual(curveResult.point, curveResult.derivative);
  assert.notEqual(curveResult.point, secondCurve.point);
  assert.notEqual(curveResult.derivative, secondCurve.derivative);
  for (const key of ['point', 'du', 'dv']) {
    assert.notEqual(surfaceResult[key], secondSurface[key]);
    surfaceResult[key][0] = 999;
  }
  assert.notEqual(surfaceResult.point, surfaceResult.du);
  assert.notEqual(surfaceResult.du, surfaceResult.dv);
  curveResult.point[0] = 999;
  curveResult.derivative[0] = 999;
  assert.deepEqual({ curve, surface }, before);
  assert.deepEqual(evaluateCurveD1(curve, 0.37), secondCurve);
  assert.deepEqual(evaluateSurfaceD1(surface, 0.37, 5.173), secondSurface);
});
