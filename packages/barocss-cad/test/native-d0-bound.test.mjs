import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, evaluateSurface, curveEvaluator, surfaceEvaluator } from '../dist/core/math.js';
import { segmentCurve, extrudedSurface } from '../dist/features/extruded-profile-solid.js';
import { certifyNativeCurveD0, certifyNativeSurfaceD0, certifyNativeD0Family, isNativeD0Error } from '../dist/core/native-d0-bound.js';
import { brepFromPrismatic, prismaticFromProfile } from '../dist/features/prismatic-solid.js';
import { buildCylindricalWrapAssembly } from '../dist/features/cylindrical-wrap-assembly.js';
import { SectionRationalContext } from '../dist/section-rational-internal.js';

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

function adjacentNumber(value, direction) {
  if (value === 0) return direction < 0 ? -Number.MIN_VALUE : Number.MIN_VALUE;
  storage.setFloat64(0, value, false); const bits = storage.getBigUint64(0, false), step = BigInt(value > 0 ? direction : -direction);
  storage.setBigUint64(0, bits + step, false); return storage.getFloat64(0, false);
}
function twoSpanCurve(id = 'two_span', a = 0) {
  return { kind: 'curve', id, degree: 2, knots: [a, a, a, a + 0.5, a + 0.5, a + 1, a + 1, a + 1],
    controlPoints: [[10, 0, -5], [10, 10, -5], [0, 10, -5], [-10, 10, -5], [-10, 0, -5]],
    weights: [1, Math.SQRT1_2, 1, adjacentNumber(Math.SQRT1_2, -1), 1] };
}
function twoSpanSurface(id = 'two_surface', a = 0) {
  const source = twoSpanCurve('basis', a), patch = extrudedSurface(source, -5, 25, id); return patch;
}
function piecewiseCurve(source, t) {
  if (source.degree !== 2 || source.controlPoints.length !== 5) return exactCurve(source, t);
  // This oracle chooses a polynomial Bernstein span directly. It does not call basisInto,
  // a native split helper, a native evaluator or any certificate implementation.
  const middle = source.knots[3], start = t < middle ? 0 : 2, left = start === 0 ? source.knots[2] : middle, right = start === 0 ? middle : source.knots[5];
  const span = { ...source, knots: [left, left, left, right, right, right], controlPoints: source.controlPoints.slice(start, start + 3), weights: source.weights.slice(start, start + 3) };
  return exactCurve(span, t);
}
function piecewiseSurface(source, u, v) {
  if (source.degreeU !== 2 || source.controlPoints.length !== 5) return exactSurface(source, u, v);
  const middle = source.knotsU[3], start = u < middle ? 0 : 2, left = start === 0 ? source.knotsU[2] : middle, right = start === 0 ? middle : source.knotsU[5];
  const span = { ...source, knotsU: [left, left, left, right, right, right], controlPoints: source.controlPoints.slice(start, start + 3), weights: source.weights.slice(start, start + 3) };
  return exactSurface(span, u, v);
}
function familyProof(receipt) {
  assert.equal(receipt.authority, 'existing-native-basis-ordered-sum-projection'); assert.equal(receipt.globalTemplate, 'degree3-by1-count8-no-constant-axis-shortcut');
  assert.deepEqual(receipt.constantAxes, [false, false, false]); assert.equal(receipt.meaning.nativeD0Certified, true);
  for (const key of ['evaluatorReplacement', 'derivatives', 'pcurveBinding', 'topology', 'mass']) assert.equal(receipt.meaning[key], false);
  assert.equal(receipt.counts.totalOperations, receipt.counts.operations + receipt.counts.directOperations);
  assert.ok(receipt.counts.totalOperations <= receipt.limits.operations && receipt.limits.operations <= 200000);
  assert.ok(receipt.counts.work <= 1048576 && receipt.counts.maximumObservedBits <= 8192 && receipt.counts.maximumDirectBits <= 8192);
  assert.ok(receipt.family.structuralWork > 0 && receipt.family.structuralWork <= receipt.counts.work);
  assert.equal(receipt.counts.work, receipt.counts.operations + receipt.counts.gcdSteps + receipt.counts.floatSearchSteps + receipt.counts.directOperations + receipt.family.structuralWork);
  assert.equal(receipt.family.objects, receipt.curves.length + receipt.surfaces.length); assert.ok(receipt.family.objects <= 64 && receipt.family.storedPoles <= 512);
  assert.ok(Object.isFrozen(receipt) && Object.isFrozen(receipt.curves) && Object.isFrozen(receipt.surfaces));
  for (const bound of [...receipt.axes, receipt.l1]) assert.ok(compare(fromReceipt(bound.exact), fromNumber(bound.upper)) <= 0);
  assert.ok(compare(fromReceipt(receipt.l1.exact), fromNumber(receipt.errorBudgetL1)) <= 0);
  for (let i = 0; i < receipt.curves.length; i++) { assert.equal(receipt.curves[i].index, i); assert.ok(Object.isFrozen(receipt.curves[i].source)); }
  for (let i = 0; i < receipt.surfaces.length; i++) { assert.equal(receipt.surfaces[i].index, i); assert.ok(Object.isFrozen(receipt.surfaces[i].source)); }
}
function refusedFamily(input, code, options) { assert.throws(() => certifyNativeD0Family(input, options), error => isNativeD0Error(error) && error.code === code); }
function familyFromBrep(brep) {
  const curves = [], surfaces = [];
  for (const edge of brep.edges) curves.push(edge.curve);
  for (const coedge of brep.coedges) { assert.ok(coedge.pcurve); curves.push(coedge.pcurve); }
  for (const face of brep.faces) surfaces.push(face.surface);
  return { curves, surfaces };
}
function originalCylinder() {
  const solid = prismaticFromProfile({ outer: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }], height: 30, from: -5, tag: 'post' });
  return { solid: { kind: 'upright', solid }, brep: brepFromPrismatic(solid, { id: 'post' }) };
}

test('one family covers actual original half-walls, edges, cap pcurves and new cubic sides with their original IDs', () => {
  const part = originalCylinder(), original = structuredClone(part);
  const assembly = buildCylindricalWrapAssembly(part, [{ outer: [[0.125, 0.25], [0.375, 0.25], [0.375, 0.75], [0.125, 0.75]], holes: [] }], { id: 'family_pad', height: 10 });
  const input = familyFromBrep(assembly.brep), before = structuredClone(input), receipt = certifyNativeD0Family(input); familyProof(receipt);
  let halfWalls = 0, halfCurves = 0, capSurfaces = 0, cubicSides = 0, positiveWeight, negativeWeight;
  for (const member of receipt.curves) {
    assert.deepEqual(member.source, input.curves[member.index]);
    if (member.source.degree === 2 && member.source.controlPoints.length === 5) { halfCurves++; assert.equal(member.template, 'quadratic-two-half-spans-five-poles'); }
    const source = member.source, a = member.domain[0], b = member.domain[1], fast = curveEvaluator(source), selected = [a, b, a + (b - a) / 3];
    if (member.spans.length === 2) selected.push(member.spans[0][1], adjacentNumber(member.spans[0][1], -1), adjacentNumber(member.spans[0][1], 1));
    if (a === 0) selected.push(Number.MIN_VALUE);
    for (const t of selected) { const point = evaluateCurve(source, t); assert.deepEqual(fast(t), point); enclosed(point, piecewiseCurve(source, t), receipt); }
  }
  for (const member of receipt.surfaces) {
    assert.deepEqual(member.source, input.surfaces[member.index]); const source = member.source;
    if (source.controlPoints.length === 5) {
      halfWalls++; assert.equal(member.template, 'quadratic-two-half-spans-five-by-two-poles');
      if (source.controlPoints[1][0][1] > 0) positiveWeight = source.weights[1][0]; else negativeWeight = source.weights[1][0];
    }
    if (source.degreeU === 1 && source.degreeV === 1) capSurfaces++;
    if (source.degreeU === 3 && source.degreeV === 1) cubicSides++;
    const u0 = member.domain.u[0], u1 = member.domain.u[1], v0 = member.domain.v[0], v1 = member.domain.v[1], fast = surfaceEvaluator(source);
    const selected = [[u0, v0], [u1, v1], [u0 + (u1 - u0) / 3, v0 + (v1 - v0) / 3]];
    if (member.spansU.length === 2) for (const u of [adjacentNumber(member.spansU[0][1], -1), member.spansU[0][1], adjacentNumber(member.spansU[0][1], 1)]) selected.push([u, 0.5]);
    for (const [u, v] of selected) { const point = evaluateSurface(source, u, v); assert.deepEqual(fast(u, v), point); enclosed(point, piecewiseSurface(source, u, v), receipt); }
  }
  assert.equal(halfWalls, 2); assert.ok(halfCurves >= 4); assert.equal(capSurfaces, 2); assert.equal(cubicSides, 4); assert.notEqual(positiveWeight, negativeWeight);
  assert.deepEqual(part, original); assert.deepEqual(input, before);
  assert.equal(receipt.family.objects, 63); assert.equal(receipt.curves.length, 54); assert.equal(receipt.surfaces.length, 9);
  familyOracleAssert(receipt, input);
  // Reserve the complete actual family cost, including final conversion and serialization.
  const total = receipt.counts.totalOperations, atLimit = certifyNativeD0Family(input, { maxOperations: total });
  familyProof(atLimit); assert.equal(atLimit.counts.totalOperations, total); assert.equal(atLimit.limits.operations, total);
  assert.deepEqual({ ...atLimit, limits: receipt.limits }, receipt);
  refusedFamily(input, 'BUDGET', { maxOperations: total - 1 });
  assert.deepEqual(input, before); assert.deepEqual(part, original);
  // This is a D0 family receipt; the assembly's separate physical/mass qualifications stay false.
  assert.equal(assembly.proof.solidQualified, false);
});

test('two half-spans cover the repeated-knot right branch, endpoints and neighboring binary64 parameters', () => {
  const curves = [twoSpanCurve('positive'), twoSpanCurve('negative', -1), twoSpanCurve('zero_middle', -0.5)], surfaces = [twoSpanSurface('wall'), twoSpanSurface('other_wall', -0.5)];
  const input = { curves, surfaces }, receipt = certifyNativeD0Family(input); familyProof(receipt); familyOracleAssert(receipt, input);
  for (const member of receipt.curves) {
    const middle = member.spans[0][1], fast = curveEvaluator(member.source);
    for (const t of [member.domain[0], adjacentNumber(middle, -1), middle, adjacentNumber(middle, 1), member.domain[1]]) enclosed(fast(t), piecewiseCurve(member.source, t), receipt);
    // Standalone admission deliberately remains narrow.
    refusedCurve(member.source, 'SUPPORT');
  }
  for (const member of receipt.surfaces) {
    const middle = member.spansU[0][1], fast = surfaceEvaluator(member.source);
    for (const u of [member.domain.u[0], adjacentNumber(middle, -1), middle, adjacentNumber(middle, 1), member.domain.u[1]]) enclosed(fast(u, 1 / 3), piecewiseSurface(member.source, u, 1 / 3), receipt);
    refusedSurface(member.source, 'SUPPORT');
  }
});

test('global envelopes come only from actual slots and conservatively cover lower-degree standalone errors', () => {
  const a = curve(1), b = curve(3), patch = surface(2); a.id = b.id = patch.id = 'repeated';
  const input = { curves: [a, b], surfaces: [patch] }, receipt = certifyNativeD0Family(input); familyProof(receipt);
  assert.deepEqual(receipt.envelope, { minimumWeight: 0.5, maximumWeight: 1, coordinateAbs: [10000, 48.5, 10000] });
  assert.deepEqual(receipt.curves[0].source, a); assert.deepEqual(receipt.curves[1].source, b); assert.deepEqual(receipt.surfaces[0].source, patch);
  assert.equal(receipt.curves[0].source.id, receipt.curves[1].source.id); assert.notDeepEqual(receipt.curves[0].source.controlPoints, receipt.curves[1].source.controlPoints);
  for (const member of receipt.curves) for (const t of [0, Number.MIN_VALUE, 0.1, 0.5, 1]) enclosed(evaluateCurve(member.source, t), exactCurve(member.source, t), receipt);
  const standalone = certifyNativeCurveD0(a); for (let axis = 0; axis < 3; axis++) assert.ok(compare(fromReceipt(standalone.axes[axis].exact), fromReceipt(receipt.axes[axis].exact)) <= 0);
  const constant = curve(1); constant.controlPoints = [[-0, 1, 2], [-0, 1, 2]];
  const constantFamily = certifyNativeD0Family({ curves: [constant], surfaces: [] }); assert.deepEqual(constantFamily.constantAxes, [false, false, false]); assert.ok(constantFamily.l1.upper > 0);
});

test('repeated pcurve IDs with different geometry preserve kind and original slot mapping without aliasing', () => {
  const a = curve(1), b = curve(2), patch = surface(1); a.id = b.id = patch.id = 'pcurve';
  const input = { curves: [a, b], surfaces: [patch] }, before = structuredClone(input), receipt = certifyNativeD0Family(input); familyProof(receipt);
  assert.deepEqual(receipt.curves[0].source, before.curves[0]); assert.deepEqual(receipt.curves[1].source, before.curves[1]); assert.deepEqual(receipt.surfaces[0].source, before.surfaces[0]);
  assert.notEqual(receipt.curves[0].source, receipt.curves[1].source); assert.notEqual(receipt.curves[0].source.controlPoints, a.controlPoints);
  a.controlPoints[0][0] = 123; b.weights[0] = 0.75; patch.controlPoints[0][0][0] = -123;
  assert.deepEqual(receipt.curves[0].source, before.curves[0]); assert.deepEqual(receipt.curves[1].source, before.curves[1]); assert.deepEqual(receipt.surfaces[0].source, before.surfaces[0]);
  assert.throws(() => { receipt.curves[1].source.weights[0] = 1; }, TypeError); assert.throws(() => { receipt.curves[1].index = 0; }, TypeError);
  const json = JSON.parse(JSON.stringify(receipt)); assert.deepEqual(json.curves[1].source, before.curves[1]); assert.deepEqual(json.counts, receipt.counts); assert.equal(json.curves[1].index, 1);
});

test('family caps count every slot and every stored pole even when geometry and IDs repeat', () => {
  const sixtyFour = [];
  for (let i = 0; i < 64; i++) sixtyFour.push(curve(1));
  const boundary = certifyNativeD0Family({ curves: sixtyFour, surfaces: [] }); familyProof(boundary); assert.equal(boundary.family.objects, 64); assert.equal(boundary.family.storedPoles, 128);
  sixtyFour.push(curve(1)); refusedFamily({ curves: sixtyFour, surfaces: [] }, 'BUDGET');
  const patches = []; for (let i = 0; i < 51; i++) patches.push(twoSpanSurface());
  const atPoles = certifyNativeD0Family({ curves: [curve(1)], surfaces: patches }); familyProof(atPoles); assert.equal(atPoles.family.storedPoles, 512);
  patches.push(twoSpanSurface()); refusedFamily({ curves: [], surfaces: patches }, 'BUDGET');
});

test('family rejects unsupported knots and any malformed slot without accepting a partial family', () => {
  refusedFamily({ curves: [], surfaces: [] }, 'INPUT'); refusedFamily({ curves: [curve(1)], surfaces: [], template: 'trusted' }, 'INPUT');
  const uneven = twoSpanCurve(); uneven.knots[3] = uneven.knots[4] = 0.25; refusedFamily({ curves: [curve(1), uneven], surfaces: [] }, 'SUPPORT');
  const simpleKnot = curve(2); simpleKnot.controlPoints.push([1, 2, 3]); simpleKnot.weights.push(1); simpleKnot.knots = [0, 0, 0, 0.5, 1, 1, 1]; refusedFamily({ curves: [simpleKnot], surfaces: [] }, 'SUPPORT');
  const shifted = twoSpanSurface('shifted', 1); refusedFamily({ curves: [], surfaces: [shifted] }, 'SUPPORT');
  const extra = curve(1); extra.version = 1; refusedFamily({ curves: [curve(1), extra], surfaces: [] }, 'INPUT');
  const invalid = surface(1); invalid.weights[1][0] = 0; refusedFamily({ curves: [curve(1)], surfaces: [invalid] }, 'INPUT');
  const light = curve(1); light.weights[0] = 0.49; refusedFamily({ curves: [light], surfaces: [] }, 'SUPPORT');
  const longId = curve(1); longId.id = 'x'.repeat(210000); refusedFamily({ curves: [longId, longId, longId, longId, longId], surfaces: [] }, 'BUDGET');
  let reads = 0; const accessor = curve(1); Object.defineProperty(accessor, 'weights', { enumerable: true, get() { reads++; return [1, 1]; } }); refusedFamily({ curves: [accessor], surfaces: [] }, 'INPUT'); assert.equal(reads, 0);
  const sparse = { curves: [curve(1)], surfaces: [] }; delete sparse.curves[0]; refusedFamily(sparse, 'INPUT');
});

test('one global family ledger tightens budget and leaves standalone serialized results and counts unchanged', () => {
  const source = curve(2), patch = surface(2), curveBefore = certifyNativeCurveD0(source), surfaceBefore = certifyNativeSurfaceD0(patch), input = { curves: [source, twoSpanCurve()], surfaces: [patch, twoSpanSurface()] };
  const receipt = certifyNativeD0Family(input); familyProof(receipt);
  refusedFamily(input, 'BUDGET', { maxOperations: receipt.counts.totalOperations - 1 }); refusedFamily(input, 'BUDGET', { maxOperations: 1 });
  refusedFamily(input, 'SUPPORT', { errorBudgetL1: Number.MIN_VALUE }); refusedFamily(input, 'INPUT', { maxOperations: 200001 });
  assert.deepEqual(certifyNativeCurveD0(source), curveBefore); assert.deepEqual(certifyNativeSurfaceD0(patch), surfaceBefore);
  assert.equal(JSON.stringify(certifyNativeCurveD0(source)), JSON.stringify(curveBefore)); assert.equal(JSON.stringify(certifyNativeSurfaceD0(patch)), JSON.stringify(surfaceBefore));
});

function referenceFailure(code, detail) { assert.fail(`${code}: ${detail}`); }
function leastUpper(bound) {
  const value = fromReceipt(bound.exact), reference = new SectionRationalContext(referenceFailure), generic = reference.bound(reference.rat(value.n, value.d));
  assert.deepEqual(bound.exact, generic.exact); assert.ok(Object.is(bound.upper, generic.upper));
  assert.ok(compare(value, fromNumber(bound.upper)) <= 0);
  if (bound.upper === 0) { assert.equal(value.n, 0n); return; }
  storage.setFloat64(0, bound.upper, false); const bits = storage.getBigUint64(0, false); storage.setBigUint64(0, bits - 1n, false);
  assert.ok(compare(fromNumber(storage.getFloat64(0, false)), value) < 0, 'the preceding binary64 must be strictly below the exact value');
}
test('family fixed128 output matches generic bound and the independent positive predecessor criterion', () => {
  for (const scale of [0, 1e-100, 0.01, 1, 20, 9999]) {
    const source = curve(3);
    for (const point of source.controlPoints) for (let axis = 0; axis < 3; axis++) point[axis] *= scale / 10000;
    const receipt = certifyNativeD0Family({ curves: [source], surfaces: [] }); familyProof(receipt);
    for (const bound of [...receipt.axes, receipt.l1]) leastUpper(bound);
    assert.equal(receipt.counts.floatSearchSteps, 0); assert.equal(receipt.counts.floatConversions, 0);
  }
  // External before/after D303 receipts remain mandatory; this same-build reference
  // check is regression evidence and does not establish performance or integration.
});

// Independent old-recurrence oracle: expanded generic fractions and a separate
// ceil128 operation. It neither imports familyErrors nor shares its common/axis caches.
// This checks semantic preservation, not a new global-bound or performance claim.
function familyOracleUpper(value) {
  assert.ok(value.n >= 0n && value.d > 0n);
  const scale = 1n << 128n, numerator = value.n * scale;
  return rational((numerator + value.d - 1n) / value.d, scale);
}
function familyOracleAdd(a, b) { return familyOracleUpper(add(a, b)); }
function familyOracleMul(a, b) { return familyOracleUpper(multiply(a, b)); }
function familyOracleDiv(a, b) { assert.ok(b.n > 0n); return familyOracleUpper(divide(a, b)); }
function familyOracleRho(value) {
  return familyOracleAdd(familyOracleMul(rational(1n, 1n << 53n), value), rational(1n, 1n << 1074n));
}
function familyOracleFraction() {
  const one = rational(1n), two = rational(2n), ed = familyOracleRho(one), twice = familyOracleMul(two, ed);
  const sum = familyOracleAdd(twice, familyOracleRho(familyOracleAdd(one, twice)));
  const lower = subtract(rational(1n, 2n), sum); assert.ok(lower.n > 0n);
  return familyOracleAdd(familyOracleDiv(familyOracleAdd(ed, sum), lower), familyOracleRho(familyOracleDiv(familyOracleAdd(one, ed), lower)));
}
function familyOracleBasis(degree, fraction) {
  let error = rational(0n);
  for (let level = 0; level < degree; level++) {
    const oneError = familyOracleAdd(rational(1n), error), oneFraction = familyOracleAdd(rational(1n), fraction);
    const product = familyOracleAdd(familyOracleAdd(error, familyOracleMul(fraction, oneError)), familyOracleRho(familyOracleMul(oneFraction, oneError)));
    const twice = familyOracleMul(rational(2n), product);
    error = familyOracleAdd(twice, familyOracleRho(familyOracleAdd(rational(2n), twice)));
  }
  return error;
}
function familyOracleTensor(a, b) {
  return familyOracleAdd(familyOracleAdd(familyOracleAdd(a, b), familyOracleMul(a, b)),
    familyOracleRho(familyOracleMul(familyOracleAdd(rational(1n), a), familyOracleAdd(rational(1n), b))));
}
function familyOracleAccumulated(count, term, magnitude) {
  let error = rational(0n);
  for (let i = 0; i < count; i++) {
    const input = familyOracleAdd(error, term);
    error = familyOracleAdd(input, familyOracleRho(familyOracleAdd(magnitude, input)));
  }
  return error;
}
function familyOracleAxis(basis, a, minimum, maximum) {
  // Deliberately recompute every common term for every axis, as the former path did.
  const factor = familyOracleAdd(familyOracleMul(maximum, basis), familyOracleRho(familyOracleMul(maximum, familyOracleAdd(rational(1n), basis))));
  const denominatorError = familyOracleAccumulated(8, factor, maximum);
  assert.ok(compare(denominatorError, divide(minimum, rational(2n))) <= 0);
  const lower = subtract(minimum, denominatorError); assert.ok(lower.n > 0n);
  const term = familyOracleAdd(familyOracleMul(a, factor), familyOracleRho(familyOracleMul(a, familyOracleAdd(maximum, factor))));
  const numeratorError = familyOracleAccumulated(8, term, familyOracleMul(a, maximum));
  const residual = familyOracleDiv(familyOracleAdd(numeratorError, familyOracleMul(a, denominatorError)), lower);
  const projection = familyOracleRho(familyOracleDiv(familyOracleAdd(familyOracleMul(a, maximum), numeratorError), lower));
  return familyOracleAdd(residual, projection);
}
function familyOraclePole(point, weight, envelope) {
  envelope.minimumWeight = Math.min(envelope.minimumWeight, weight);
  envelope.maximumWeight = Math.max(envelope.maximumWeight, weight);
  for (let axis = 0; axis < 3; axis++) envelope.coordinateAbs[axis] = Math.max(envelope.coordinateAbs[axis], Math.abs(point[axis]));
}
function familyOracleEnvelope(input) {
  const result = { minimumWeight: 1, maximumWeight: 0, coordinateAbs: [0, 0, 0] };
  for (const item of input.curves) for (let i = 0; i < item.controlPoints.length; i++) familyOraclePole(item.controlPoints[i], item.weights[i], result);
  for (const item of input.surfaces) for (let i = 0; i < item.controlPoints.length; i++) for (let j = 0; j < item.controlPoints[i].length; j++) familyOraclePole(item.controlPoints[i][j], item.weights[i][j], result);
  return result;
}
function familyOracleExactText(value) { return { numerator: value.n.toString(), denominator: value.d.toString() }; }
function familyOracleAssert(receipt, input) {
  const envelope = familyOracleEnvelope(input), fraction = familyOracleFraction();
  const basis = familyOracleTensor(familyOracleBasis(3, fraction), familyOracleBasis(1, fraction)), errors = [];
  for (let axis = 0; axis < 3; axis++) errors.push(familyOracleAxis(basis, fromNumber(envelope.coordinateAbs[axis]), fromNumber(envelope.minimumWeight), fromNumber(envelope.maximumWeight)));
  const l1 = familyOracleAdd(familyOracleAdd(errors[0], errors[1]), errors[2]);
  assert.deepEqual(receipt.envelope, envelope);
  for (let axis = 0; axis < 3; axis++) {
    assert.deepEqual(receipt.axes[axis].exact, familyOracleExactText(errors[axis]));
    leastUpper(receipt.axes[axis]);
  }
  assert.deepEqual(receipt.l1.exact, familyOracleExactText(l1)); leastUpper(receipt.l1);
}
function familyEnvelopeFixture(axes) {
  const [a, b, c] = axes, source = { kind: 'curve', id: 'envelope_curve', degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1],
    controlPoints: [[a, b, c], [-a, -b, -c], [0, 0, 0], [a, -b, c]], weights: [0.5, 1, Math.SQRT1_2, 1] };
  const controlPoints = [], weights = [];
  for (const point of source.controlPoints) {
    controlPoints.push([[...point], [-point[0], point[1], -point[2]]]); weights.push([0.5, 1]);
  }
  const patch = { kind: 'surface', id: 'envelope_surface', degreeU: 3, degreeV: 1, knotsU: [0, 0, 0, 0, 1, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints, weights };
  return { curves: [source], surfaces: [patch] };
}

test('family common-term and equal-axis reuse preserve the full generic recurrence for actual envelope tuples', () => {
  for (const magnitude of [0, 1e-100, Number.MIN_VALUE, adjacentNumber(10000, -1), 10000]) {
    // Include all-unique, every equal-pair location and all-equal axes.
    // Store the requested magnitude directly: multiplying MIN_VALUE by a scale ratio would erase it.
    const tuples = [[magnitude, magnitude / 2, 0], [0, magnitude / 2, magnitude],
      [magnitude, magnitude, 0], [magnitude, 0, magnitude], [0, magnitude, magnitude], [magnitude, magnitude, magnitude]];
    for (const axes of tuples) {
      const input = familyEnvelopeFixture(axes), before = structuredClone(input), receipt = certifyNativeD0Family(input);
      familyProof(receipt); familyOracleAssert(receipt, input);
      assert.deepEqual(receipt.envelope.coordinateAbs, axes);
      assert.deepEqual(receipt.curves[0].source, before.curves[0]); assert.deepEqual(receipt.surfaces[0].source, before.surfaces[0]);
      assert.deepEqual(input, before); assert.deepEqual(receipt.constantAxes, [false, false, false]);
      assert.ok(receipt.l1.upper > 0, 'absolute underflow allowance remains even for an all-zero envelope');
      if (magnitude === Number.MIN_VALUE && axes[0] === magnitude) assert.equal(receipt.curves[0].source.controlPoints[0][0], Number.MIN_VALUE);
      for (let axis = 0; axis < 3; axis++) for (let other = axis + 1; other < 3; other++) {
        if (axes[axis] === axes[other]) {
          assert.deepEqual(receipt.axes[axis].exact, receipt.axes[other].exact);
          assert.ok(Object.is(receipt.axes[axis].upper, receipt.axes[other].upper));
        }
      }
    }
  }
});
