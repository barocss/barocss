import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateSurface, curveEvaluator, surfaceEvaluator } from '../dist/core/math.js';
import { segmentCurve, extrudedSurface } from '../dist/features/extruded-profile-solid.js';
import { certifyNativeCurveD0, certifyNativeSurfaceD0, isNativeD0Error } from '../dist/core/native-d0-bound.js';

// Independent exact Bernstein oracle. It imports neither the certificate's arithmetic nor
// SectionRationalContext. Finite sample comparisons are regression evidence only; the
// certificate's operation recurrence, including absolute underflow, supplies the global bound.
const storage = new DataView(new ArrayBuffer(8));
function gcd(a, b) { a = a < 0n ? -a : a; while (b !== 0n) { const next = a % b; a = b; b = next; } return a; }
function rational(n, d = 1n) {
  assert.notEqual(d, 0n); if (d < 0n) { n = -n; d = -d; }
  if (n === 0n) return { n: 0n, d: 1n }; const common = gcd(n, d); return { n: n / common, d: d / common };
}
function add(a, b) { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function subtract(a, b) { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function multiply(a, b) { return rational(a.n * b.n, a.d * b.d); }
function divide(a, b) { return rational(a.n * b.d, a.d * b.n); }
function absolute(a) { return a.n < 0n ? { n: -a.n, d: a.d } : a; }
function compare(a, b) { const left = a.n * b.d, right = b.n * a.d; return left < right ? -1 : left > right ? 1 : 0; }
function fromNumber(value) {
  assert.ok(Number.isFinite(value)); storage.setFloat64(0, value, false); const bits = storage.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
  const significand = (bits & 0xfffffffffffffn) + (exponent === 0 ? 0n : 1n << 52n), signed = bits >> 63n ? -significand : significand;
  const power = exponent === 0 ? -1074 : exponent - 1075;
  return power >= 0 ? rational(signed << BigInt(power)) : rational(signed, 1n << BigInt(-power));
}
function fromReceipt(value) { return rational(BigInt(value.numerator), BigInt(value.denominator)); }
function power(a, exponent) { let value = rational(1n); for (let i = 0; i < exponent; i++) value = multiply(value, a); return value; }
function choose(n, k) { let value = 1n; for (let i = 1; i <= k; i++) value = value * BigInt(n - i + 1) / BigInt(i); return value; }
function bernstein(degree, parameter, left, right) {
  const t = divide(subtract(fromNumber(parameter), fromNumber(left)), subtract(fromNumber(right), fromNumber(left))), complement = subtract(rational(1n), t), values = [];
  for (let i = 0; i <= degree; i++) values.push(multiply(rational(choose(degree, i)), multiply(power(t, i), power(complement, degree - i))));
  return values;
}
function exactCurve(source, t) {
  const degree = source.degree, b = bernstein(degree, t, source.knots[degree], source.knots[degree + 1]), numerator = [rational(0n), rational(0n), rational(0n)];
  let denominator = rational(0n);
  for (let i = 0; i <= degree; i++) {
    const factor = multiply(b[i], fromNumber(source.weights[i])); denominator = add(denominator, factor);
    for (let axis = 0; axis < 3; axis++) numerator[axis] = add(numerator[axis], multiply(factor, fromNumber(source.controlPoints[i][axis])));
  }
  return [divide(numerator[0], denominator), divide(numerator[1], denominator), divide(numerator[2], denominator)];
}
function exactSurface(source, u, v) {
  const du = source.degreeU, dv = source.degreeV, bu = bernstein(du, u, source.knotsU[du], source.knotsU[du + 1]), bv = bernstein(dv, v, source.knotsV[dv], source.knotsV[dv + 1]);
  const numerator = [rational(0n), rational(0n), rational(0n)]; let denominator = rational(0n);
  for (let i = 0; i <= du; i++) for (let j = 0; j <= dv; j++) {
    const factor = multiply(multiply(bu[i], bv[j]), fromNumber(source.weights[i][j])); denominator = add(denominator, factor);
    for (let axis = 0; axis < 3; axis++) numerator[axis] = add(numerator[axis], multiply(factor, fromNumber(source.controlPoints[i][j][axis])));
  }
  return [divide(numerator[0], denominator), divide(numerator[1], denominator), divide(numerator[2], denominator)];
}
function knots(degree, left, right) { return [...Array(degree + 1).fill(left), ...Array(degree + 1).fill(right)]; }
function curve(degree = 3, left = 0, right = 1) {
  const controlPoints = [], weights = [];
  for (let i = 0; i <= degree; i++) { controlPoints.push([i % 2 === 0 ? 10000 - i / 8 : -9999 + i / 8, -17 + i * 9.25, 31 - i * 11.3]); weights.push(i % 2 === 0 ? 0.5 : 1); }
  return { kind: 'curve', id: 'bounded_curve', degree, knots: knots(degree, left, right), controlPoints, weights };
}
function surface(degree = 3, left = 0, right = 1) {
  const controlPoints = [], weights = [];
  for (let i = 0; i <= degree; i++) {
    controlPoints.push([[i % 2 === 0 ? 10000 : -9999, i * 13.25 - 20, -9999], [9990 - i * 3.3, -9 - i * 19.75, 10000]]);
    weights.push([i % 2 === 0 ? 0.5 : 1, i % 2 === 0 ? 1 : 0.5]);
  }
  return { kind: 'surface', id: 'bounded_surface', degreeU: degree, degreeV: 1, knotsU: knots(degree, left, right), knotsV: [0, 0, 1, 1], controlPoints, weights };
}
function parameters(left, right) {
  const candidates = [left, right, 0, -Number.MIN_VALUE, Number.MIN_VALUE, -0.75, -0.1, 0.1, 1 / 3, 0.5, 1 - 2 ** -53, 0.5 - 2 ** -54, -1 + 2 ** -53], result = [];
  for (const value of candidates) if (value >= left && value <= right && !result.includes(value)) result.push(value);
  return result;
}
function enclosed(actual, expected, receipt) {
  let total = rational(0n);
  for (let axis = 0; axis < 3; axis++) {
    const error = absolute(subtract(fromNumber(actual[axis]), expected[axis]));
    assert.ok(compare(error, fromReceipt(receipt.axes[axis].exact)) <= 0, `axis ${axis} escaped its global D0 bound`); total = add(total, error);
  }
  assert.ok(compare(total, fromReceipt(receipt.l1.exact)) <= 0, 'L1 escaped its global D0 bound');
}
function proof(receipt) {
  assert.equal(receipt.authority, 'existing-native-basis-ordered-sum-projection'); assert.equal(receipt.fractionBits, 128);
  assert.equal(receipt.meaning.nativeD0Certified, true); assert.equal(receipt.meaning.evaluatorReplacement, false);
  for (const key of ['derivatives', 'pcurveBinding', 'topology', 'mass']) assert.equal(receipt.meaning[key], false);
  assert.equal(receipt.counts.totalOperations, receipt.counts.operations + receipt.counts.directOperations);
  assert.ok(receipt.counts.totalOperations <= receipt.limits.operations && receipt.limits.operations <= 200000);
  assert.ok(receipt.counts.work <= 1048576); assert.ok(receipt.counts.maximumObservedBits <= 8192); assert.ok(receipt.counts.maximumDirectBits <= 8192);
  assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.source) && Object.isFrozen(receipt.source.controlPoints));
  for (const bound of [...receipt.axes, receipt.l1]) { assert.ok(compare(fromReceipt(bound.exact), fromNumber(bound.upper)) <= 0); assert.ok(Number.isFinite(bound.upper) && bound.upper >= 0); }
  assert.ok(compare(fromReceipt(receipt.l1.exact), fromNumber(receipt.errorBudgetL1)) <= 0);
}
function refusedCurve(source, code, options) { assert.throws(() => certifyNativeCurveD0(source, options), error => isNativeD0Error(error) && error.code === code); }
function refusedSurface(source, code, options) { assert.throws(() => certifyNativeSurfaceD0(source, options), error => isNativeD0Error(error) && error.code === code); }

test('degree1..3 native curves are enclosed against independent exact Bernstein values', () => {
  for (const degree of [1, 2, 3]) for (const [left, right] of [[0, 1], [0, 0.5], [-1, 0], [-0.5, 0]]) {
    const source = curve(degree, left, right), receipt = certifyNativeCurveD0(source), fast = curveEvaluator(source); proof(receipt);
    assert.deepEqual(receipt.domain, [left, right]); assert.equal(receipt.template, 'single-clamped-bezier-curve-degree1-to3');
    for (const t of parameters(left, right)) {
      const actual = evaluateCurve(source, t), cached = fast(t); assert.deepEqual(cached, actual); enclosed(actual, exactCurve(source, t), receipt);
    }
  }
});

test('degreeU1..3 by V1 native tensors include cached repeated parameter paths', () => {
  for (const degree of [1, 2, 3]) {
    const source = surface(degree, 0, 0.5), receipt = certifyNativeSurfaceD0(source), fast = surfaceEvaluator(source); proof(receipt);
    assert.deepEqual(receipt.domain, { u: [0, 0.5], v: [0, 1] });
    for (const [u, v] of [[0, 0], [Number.MIN_VALUE, Number.MIN_VALUE], [0.1, 1 / 3], [0.1, 0.5], [0.5, 0.5], [0.5, 1], [0.5, 1]]) {
      const actual = evaluateSurface(source, u, v); assert.deepEqual(fast(u, v), actual); enclosed(actual, exactSurface(source, u, v), receipt);
    }
  }
});

test('actual native quarter coefficients and nonzero source Z remain unchanged', () => {
  const arc = segmentCurve({ kind: 'arc', start: [10, 0], end: [0, 10], center: [0, 0], radius: 10, startAngle: 0, sweep: Math.PI / 2, length: 5 * Math.PI }, -31.25, 'native_quarter');
  const wall = extrudedSurface(arc, -31.25, 48.75, 'native_wall'), before = structuredClone({ arc, wall }), a = certifyNativeCurveD0(arc), b = certifyNativeSurfaceD0(wall); proof(a); proof(b);
  for (const t of [0, Number.MIN_VALUE, 0.1, 0.5, 1]) enclosed(evaluateCurve(arc, t), exactCurve(arc, t), a);
  for (const [u, v] of [[0, 0], [0.1, 0.75], [0.5, 0.5], [1, 1]]) enclosed(evaluateSurface(wall, u, v), exactSurface(wall, u, v), b);
  assert.deepEqual({ arc, wall }, before); assert.deepEqual(a.source, arc); assert.deepEqual(b.source, wall);
});

test('reversed stored poles and negative-domain parameters retain the independent bound', () => {
  const source = curve(3, -1, 0); source.controlPoints.reverse(); source.weights.reverse(); const receipt = certifyNativeCurveD0(source); proof(receipt);
  for (const t of parameters(-1, 0)) enclosed(evaluateCurve(source, t), exactCurve(source, t), receipt);
  const patch = surface(2, -1, 0); patch.knotsV = [-0.5, -0.5, 0, 0]; const other = certifyNativeSurfaceD0(patch); proof(other);
  for (const [u, v] of [[-1, -0.5], [-0.1, -Number.MIN_VALUE], [0, 0]]) enclosed(evaluateSurface(patch, u, v), exactSurface(patch, u, v), other);
});

test('authored Object.is constant axes restore exact negative zero; mixed zeros are not classified constant', () => {
  const source = curve(3); for (const point of source.controlPoints) { point[0] = -0; point[1] = 1; }
  const receipt = certifyNativeCurveD0(source); proof(receipt); assert.deepEqual(receipt.constantAxes, [true, true, false]);
  assert.equal(receipt.axes[0].upper, 0); assert.equal(receipt.axes[1].upper, 0);
  for (const t of [0, Number.MIN_VALUE, 1 / 3, 1]) { const point = evaluateCurve(source, t); assert.ok(Object.is(point[0], -0)); assert.equal(point[1], 1); enclosed(point, exactCurve(source, t), receipt); }
  source.controlPoints[0][0] = 0; const mixed = certifyNativeCurveD0(source); assert.equal(mixed.constantAxes[0], false); assert.ok(mixed.axes[0].upper > 0);
  const patch = surface(3); for (const row of patch.controlPoints) for (const point of row) point[2] = -0;
  const surfaceReceipt = certifyNativeSurfaceD0(patch); assert.equal(surfaceReceipt.axes[2].upper, 0); assert.ok(Object.is(evaluateSurface(patch, 0.1, 1 / 3)[2], -0));
});

test('subnormal coordinates and parameters are covered without a relative-only assumption', () => {
  const source = { kind: 'curve', id: 'subnormal', degree: 1, knots: [0, 0, 1, 1], controlPoints: [[Number.MIN_VALUE, -Number.MIN_VALUE, 0], [-Number.MIN_VALUE, Number.MIN_VALUE, 0]], weights: [0.5, 1] };
  const receipt = certifyNativeCurveD0(source); proof(receipt); assert.ok(receipt.axes[0].upper > 0 && receipt.axes[1].upper > 0);
  for (const t of [0, Number.MIN_VALUE, 0.1, 0.5, 1]) enclosed(evaluateCurve(source, t), exactCurve(source, t), receipt);
});

test('snapshots are deeply frozen and do not alias inputs or option data', () => {
  const source = curve(2), options = { maxOperations: 200000, errorBudgetL1: 1e-7 }, before = structuredClone(source), receipt = certifyNativeCurveD0(source, options);
  assert.deepEqual(source, before); assert.notEqual(receipt.source, source); assert.notEqual(receipt.source.controlPoints[0], source.controlPoints[0]);
  source.controlPoints[0][0] = 123; options.maxOperations = 1; assert.deepEqual(receipt.source, before); assert.equal(receipt.limits.operations, 200000);
  assert.throws(() => { receipt.source.controlPoints[0][0] = 0; }, TypeError); assert.throws(() => { receipt.axes[0].exact.numerator = '0'; }, TypeError);
  const patch = surface(1), other = certifyNativeSurfaceD0(patch); assert.notEqual(other.source.weights[0], patch.weights[0]); assert.ok(Object.isFrozen(other.source.weights[0]));
});

test('valid native curves or surfaces outside the narrow arithmetic templates refuse SUPPORT', () => {
  refusedCurve(curve(4), 'SUPPORT'); refusedCurve(curve(3, 0, 0.25), 'SUPPORT'); refusedCurve(curve(2, 4, 5), 'SUPPORT');
  const multiple = curve(2); multiple.controlPoints.push([1, 2, 3]); multiple.weights.push(1); multiple.knots = [0, 0, 0, 0.5, 1, 1, 1]; refusedCurve(multiple, 'SUPPORT');
  const light = curve(1); light.weights[0] = 0.49; refusedCurve(light, 'SUPPORT'); const heavy = curve(1); heavy.weights[1] = 1.0001; refusedCurve(heavy, 'SUPPORT');
  const distant = curve(2); distant.controlPoints[1][0] = 10000.000001; refusedCurve(distant, 'SUPPORT');
  const tall = surface(1); tall.degreeV = 2; tall.knotsV = [0, 0, 0, 1, 1, 1]; for (let i = 0; i < 2; i++) { tall.controlPoints[i].push([1, 2, 3]); tall.weights[i].push(1); } refusedSurface(tall, 'SUPPORT');
  const smallV = surface(1); smallV.knotsV = [0, 0, 0.125, 0.125]; refusedSurface(smallV, 'SUPPORT');
});

test('current own fields, finite native data and nonexecuted getters are enforced', () => {
  const accessor = curve(1); let reads = 0; Object.defineProperty(accessor, 'degree', { enumerable: true, get() { reads++; return 1; } }); refusedCurve(accessor, 'INPUT'); assert.equal(reads, 0);
  const hidden = curve(1); Object.defineProperty(hidden, 'extra', { value: 0 }); refusedCurve(hidden, 'INPUT');
  const symbolic = curve(1); symbolic[Symbol('extra')] = 0; refusedCurve(symbolic, 'INPUT');
  const legacy = curve(1); legacy.version = 0; refusedCurve(legacy, 'INPUT');
  const sparse = curve(1); delete sparse.controlPoints[0]; refusedCurve(sparse, 'INPUT');
  const foreign = curve(1); Object.setPrototypeOf(foreign, { inherited: 1 }); refusedCurve(foreign, 'INPUT');
  const infinite = curve(1); infinite.controlPoints[0][1] = Infinity; refusedCurve(infinite, 'INPUT');
  const invalid = surface(1); invalid.weights[0][0] = 0; refusedSurface(invalid, 'INPUT');
  const optionAccessor = {}; Object.defineProperty(optionAccessor, 'maxOperations', { enumerable: true, get() { reads++; return 1; } }); refusedCurve(curve(1), 'INPUT', optionAccessor); assert.equal(reads, 0);
});

test('one ledger preserves exact/direct limits and requested error budgets without automatic relaxation', () => {
  const source = curve(3), receipt = certifyNativeCurveD0(source); proof(receipt);
  refusedCurve(source, 'BUDGET', { maxOperations: 1 }); refusedCurve(source, 'BUDGET', { maxOperations: receipt.counts.totalOperations - 1 });
  refusedCurve(source, 'INPUT', { maxOperations: 0 }); refusedCurve(source, 'INPUT', { maxOperations: 200001 }); refusedCurve(source, 'INPUT', { maxOperations: null });
  refusedCurve(source, 'INPUT', { errorBudgetL1: 0 }); refusedCurve(source, 'INPUT', { errorBudgetL1: NaN }); refusedCurve(source, 'INPUT', { errorBudgetL1: 1e-6 }); refusedCurve(source, 'INPUT', { errorBudgetL1: null });
  refusedCurve(source, 'SUPPORT', { errorBudgetL1: Number.MIN_VALUE }); refusedSurface(surface(2), 'BUDGET', { maxOperations: 1 });
  const exactConstant = curve(1); exactConstant.controlPoints = [[-0, 2, 3], [-0, 2, 3]];
  const tight = certifyNativeCurveD0(exactConstant, { errorBudgetL1: Number.MIN_VALUE }); proof(tight); assert.equal(tight.l1.upper, 0);
});
