import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCurve, segmentCurve, extrudedSurface, splitSurfaceAtParameter, extractSurfaceIsoCurve } from '../dist/index.js';
import { buildCylindricalWrapMap, certifyCylindricalWrapCarrier, isCylindricalWrapMapError } from '../dist/features/cylindrical-wrap-map.js';

const quarter = (radius = 8, domain = [0, 1]) => ({ kind: 'curve', id: 'quarter', degree: 2, knots: [domain[0], domain[0], domain[0], domain[1], domain[1], domain[1]], controlPoints: [[radius, 0, 0], [radius, radius, 0], [0, radius, 0]], weights: [1, Math.SQRT1_2, 1] });
const options = (radius = 8, tolerance = 0.05) => ({ radius, tolerance });
const fraction = value => ({ n: BigInt(value.numerator), d: BigInt(value.denominator) });
const compare = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const multiply = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
const divide = (a, b) => ({ n: a.n * b.d, d: a.d * b.n });
const integer = n => ({ n: BigInt(n), d: 1n });
function dyadic(value) {
  if (value === 0) return integer(0);
  const buffer = new ArrayBuffer(8), view = new DataView(buffer); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), exponent = Number(bits >> 52n & 2047n), significand = (exponent ? 1n << 52n : 0n) + (bits & 0xfffffffffffffn), power = (exponent || 1) - 1075;
  let n = bits >> 63n ? -significand : significand, d = 1n;
  if (power >= 0) n <<= BigInt(power); else d <<= BigInt(-power);
  return { n, d };
}
function bernstein(values, share) {
  let row = values.map(fraction); const t = dyadic(share), other = { n: t.d - t.n, d: t.d };
  while (row.length > 1) { const next = []; for (let i = 0; i + 1 < row.length; i++) next.push(add(multiply(other, row[i]), multiply(t, row[i + 1]))); row = next; }
  return row[0];
}
function refused(source, given, code) {
  const before = structuredClone(source), prior = structuredClone(given);
  assert.throws(() => buildCylindricalWrapMap(source, given), error => isCylindricalWrapMapError(error) && (!code || error.code === code));
  assert.deepEqual(source, before); assert.deepEqual(given, prior);
}
// Independent decimal enclosure of pi, not Math.PI, for exact node-oracle comparisons.
const piFloor = 314159265358979323846264338327950288419716939937510n;
const piScale = 10n ** 50n;
function enclosesPi(node, divisor) {
  assert.ok(compare(fraction(node.angle.lower), { n: piFloor, d: piScale * BigInt(divisor) }) <= 0);
  assert.ok(compare(fraction(node.angle.upper), { n: piFloor + 1n, d: piScale * BigInt(divisor) }) >= 0);
}
function invariant(map) {
  assert.equal(map.nodes.length, map.intervals.length + 1);
  assert.ok(map.intervals.length <= 256); assert.equal(map.nodes[0].share, 0); assert.equal(map.nodes.at(-1).share, 1);
  assert.equal(map.nodes[0].u, map.domain[0]); assert.equal(map.nodes.at(-1).u, map.domain[1]);
  assert.deepEqual(map.chartDomain, [map.nodes[0].s, map.nodes.at(-1).s]);
  const tolerance = dyadic(map.options.tolerance), maximum = fraction(map.bounds.nominal.exact), m2 = fraction(map.bounds.secondDerivative.exact), radius = dyadic(map.options.radius);
  assert.ok(compare(maximum, tolerance) <= 0); assert.ok(compare(dyadic(map.bounds.nominal.upper), maximum) >= 0);
  for (let i = 0; i < map.intervals.length; i++) {
    const interval = map.intervals[i], a = map.nodes[i], b = map.nodes[i + 1], width = dyadic(b.share - a.share);
    assert.equal(interval.first, i); assert.equal(interval.last, i + 1);
    assert.ok(Number.isFinite(a.u) && Number.isFinite(a.s) && a.u < b.u && a.s < b.s);
    const interpolated = divide(multiply(multiply(radius, m2), multiply(width, width)), integer(8));
    assert.equal(compare(fraction(interval.interpolation), interpolated), 0, 'Full-span derivative uses deltaShare squared exactly once.');
    const ae = fraction(a.error), be = fraction(b.error), expected = add(compare(ae, be) >= 0 ? ae : be, interpolated);
    assert.equal(compare(fraction(interval.error), expected), 0); assert.ok(compare(expected, tolerance) <= 0);
    // The stored s error includes actual binary64 rounding against both certified angle endpoints.
    for (const endpoint of [a, b]) for (const bound of [endpoint.angle.lower, endpoint.angle.upper]) {
      const target = multiply(radius, fraction(bound)), stored = dyadic(endpoint.s), residual = { n: stored.n * target.d - target.n * stored.d, d: stored.d * target.d };
      if (residual.n < 0n) residual.n = -residual.n;
      assert.ok(compare(residual, fraction(endpoint.error)) <= 0);
    }
  }
  assert.ok(map.counts.rational.operations <= 200000); assert.ok(map.counts.rational.gcdSteps <= 200000);
  assert.ok(map.counts.rational.maximumObservedBits <= 8192); assert.ok(map.counts.integerMaximumBits <= 8192); assert.ok(map.counts.work <= 1048576);
  assert.equal(map.meaning.chart, 'nominal-radius-times-original-carrier-angle');
  for (const key of ['composition', 'surfaceBinding', 'trim', 'solid', 'globalNativeEvaluationError']) assert.equal(map.meaning[key], false);
}

test('cylindrical wrap map: synthetic quarter node0/.5/1 has independent 0/pi4/pi2 enclosures and a full secant proof', () => {
  const source = quarter(), before = structuredClone(source), given = options(), prior = structuredClone(given), map = buildCylindricalWrapMap(source, given);
  invariant(map);
  const first = map.nodes[0], middle = map.nodes.find(node => node.share === 0.5), last = map.nodes.at(-1);
  assert.equal(first.s, 0); assert.equal(fraction(first.angle.lower).n, 0n); assert.equal(fraction(first.angle.upper).n, 0n);
  assert.ok(middle); enclosesPi(middle, 4); enclosesPi(last, 2);
  assert.deepEqual(map.source, source); assert.notEqual(map.source, source); assert.deepEqual(source, before); assert.deepEqual(given, prior);
  assert.ok(Object.isFrozen(map) && Object.isFrozen(map.source.controlPoints[1]));
});

test('cylindrical wrap map: multiple radii/tolerances preserve analytic bounds; samples are regression observations only', () => {
  for (const [radius, tolerance] of [[0.5, 0.01], [8, 0.05], [32, 0.1], [100, 0.01]]) {
    const map = buildCylindricalWrapMap(quarter(radius), options(radius, tolerance)); invariant(map);
    for (const interval of map.intervals) {
      const a = map.nodes[interval.first], b = map.nodes[interval.last];
      for (const t of [0.125, 0.375, 0.625, 0.875]) {
        const u = a.u + (b.u - a.u) * t, s = a.s + (b.s - a.s) * t, point = evaluateCurve(map.source, u);
        const observed = Math.abs(radius * Math.atan2(point[1], point[0]) - s);
        // Floating native evaluation/interpolation noise is test observation only, not provider admission.
        assert.ok(observed <= map.bounds.nominal.upper + 128 * Number.EPSILON * Math.max(1, radius));
      }
    }
  }
});

test('cylindrical wrap map: original knot domain is retained and derivative proof is not scaled twice', () => {
  const source = quarter(8, [2, 4]), map = buildCylindricalWrapMap(source, options()); invariant(map);
  assert.deepEqual(map.domain, [2, 4]);
  for (const node of map.nodes) assert.equal(node.u, 2 + 2 * node.share);
  assert.deepEqual(map.source.knots, source.knots);
  const signed = quarter(8, [-0, 1]), retained = buildCylindricalWrapMap(signed, options());
  assert.ok(Object.is(retained.nodes[0].u, -0)); assert.ok(Object.is(retained.source.knots[0], -0));
});

test('cylindrical wrap map: stored native weight defect, angular positivity and arclength drift are separate exact quantities', () => {
  const map = buildCylindricalWrapMap(quarter(), options()), w = dyadic(Math.SQRT1_2), radius = integer(8), epsilon = add(multiply(integer(2), multiply(w, w)), integer(-1));
  assert.ok(epsilon.n > 0n, 'The original binary64 weight lies above exact1/sqrt2.');
  const r2 = multiply(radius, radius), expectedQ = divide(multiply(r2, epsilon), integer(8));
  const expectedResidual = [integer(0), integer(0), divide(multiply(r2, epsilon), integer(3)), integer(0), integer(0)];
  const expectedSquared = [r2, multiply(r2, w), divide(multiply(integer(4), multiply(r2, multiply(w, w))), integer(3)), multiply(r2, w), r2];
  const kEnd = multiply(integer(2), multiply(r2, w)), kInner = divide(multiply(integer(2), multiply(r2, add(integer(1), w))), integer(3));
  const expectedAngular = [kEnd, kInner, kInner, kEnd];
  for (let i = 0; i < 5; i++) { assert.equal(compare(fraction(map.proof.circleResidual[i]), expectedResidual[i]), 0); assert.equal(compare(fraction(map.proof.squaredRadiusNumerator[i]), expectedSquared[i]), 0); }
  for (let i = 0; i < 4; i++) assert.equal(compare(fraction(map.proof.angularNumerator[i]), expectedAngular[i]), 0);
  assert.equal(compare(bernstein(map.proof.circleResidual, 0.5), expectedQ), 0);
  assert.equal(bernstein(map.proof.circleResidual, 0).n, 0n); assert.equal(bernstein(map.proof.circleResidual, 1).n, 0n);
  const expectedK = multiply(r2, add(w, { n: 1n, d: 2n }));
  assert.equal(compare(bernstein(map.proof.angularNumerator, 0.5), expectedK), 0);
  assert.ok(fraction(map.proof.angularMinimum).n > 0n); assert.ok(map.bounds.radial.upper > 0); assert.ok(map.bounds.arclengthDrift.upper > 0);
  assert.equal(compare(fraction(map.bounds.basePosition.exact), add(fraction(map.bounds.nominal.exact), fraction(map.bounds.radial.exact))), 0);
  assert.equal(compare(fraction(map.bounds.actualLengthResidual.exact), add(fraction(map.bounds.nominal.exact), fraction(map.bounds.arclengthDrift.exact))), 0);
});

test('cylindrical wrap map: actual native half-to-quarter direct-copy extraction retains near-cardinal source coefficients', () => {
  const radius = 8;
  const half = segmentCurve({ kind: 'arc', start: [radius, 0], end: [-radius, 0], center: [0, 0], radius, startAngle: 0, sweep: Math.PI, length: radius * Math.PI }, 0, 'native_half');
  const surface = extrudedSurface(half, 7, 17, 'native_surface');
  const split = splitSurfaceAtParameter(surface, { axis: 'u', parameter: 0.5, lowerSurfaceId: 'quarter_lower', upperSurfaceId: 'quarter_upper' });
  assert.equal(split.provenance.refinement.kind, 'direct-copy'); assert.equal(split.provenance.refinement.insertions, 0);
  const source = extractSurfaceIsoCurve(split.lower, { fixedAxis: 'v', parameter: 0, curveId: 'native_quarter' }).curve, prior = structuredClone(source);
  assert.notEqual(source.controlPoints[2][0], 0, 'The native near-cardinal end must not be replaced by a synthetic zero.');
  const map = buildCylindricalWrapMap(source, options()); invariant(map);
  assert.deepEqual(map.source, source); assert.deepEqual(source, prior); assert.equal(map.nodes.at(-1).u, 0.5);
  for (const point of map.source.controlPoints) assert.equal(point[2], 7);
});

test('cylindrical wrap map: degenerate, foreign, reversed, wrong-plane and non-native quarter inputs refuse with typed errors', () => {
  const invalid = [
    { ...quarter(), degree: 1 },
    { ...quarter(), controlPoints: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] },
    { ...quarter(), weights: [1, -1, 1] },
    { ...quarter(), weights: [1, 0.75, 1] },
    { ...quarter(), knots: [0, 0, 0, 0, 0, 0] },
    { ...quarter(), controlPoints: [...quarter().controlPoints].reverse() },
    { ...quarter(), controlPoints: [[8, 0, 0], [8, 8, 1], [0, 8, 0]] },
    { ...quarter(), controlPoints: [[8, 1e-8, 0], [8, 8, 0], [0, 8, 0]] },
    { ...quarter(), controlPoints: [[8, 0, 0], [-8, 8, 0], [0, 8, 0]] },
    { ...quarter(), extra: 1 },
    { ...quarter(), weights: new Float64Array([1, Math.SQRT1_2, 1]) },
    { ...quarter(), weights: Array(8193).fill(1) },
  ];
  for (const source of invalid) refused(source, options());
  const inherited = Object.assign(Object.create({}), quarter());
  assert.throws(() => buildCylindricalWrapMap(inherited, options()), error => isCylindricalWrapMapError(error) && error.code === 'INPUT');
  const getter = quarter(); let calls = 0;
  Object.defineProperty(getter, 'degree', { get() { calls++; return 2; }, enumerable: true });
  assert.throws(() => buildCylindricalWrapMap(getter, options()), error => isCylindricalWrapMapError(error) && error.code === 'INPUT'); assert.equal(calls, 0);
  const sparse = quarter(); delete sparse.controlPoints[1]; refused(sparse, options(), 'INPUT');
});

test('cylindrical wrap map: invalid/huge values, unattainable fixed-grid accuracy and collapsed native domains refuse atomically', () => {
  for (const radius of [0, -1, 0.001, 10001, NaN, Infinity, '8']) refused(quarter(), { radius, tolerance: 0.05 }, 'INPUT');
  for (const tolerance of [0, -1, 10001, NaN, Infinity, '0.05']) refused(quarter(), { radius: 8, tolerance }, 'INPUT');
  refused(quarter(10001), options(10001), 'INPUT');
  refused(quarter(8, [-Number.MAX_VALUE, Number.MAX_VALUE]), options(), 'REPRESENTABILITY');
  refused(quarter(), options(8, 1e-20), 'BUDGET');
  const collapsed = quarter(8, [1, 1 + Number.EPSILON]);
  refused(collapsed, options(8, 0.05), 'REPRESENTABILITY');
});


test('cylindrical wrap map: arclength output is a length residual, not an actual-arclength-domain or offset certificate', () => {
  const source = quarter(), before = structuredClone(source);
  for (const point of source.controlPoints) { point[0] *= 1 - 1e-10; point[1] *= 1 - 1e-10; }
  const map = buildCylindricalWrapMap(source, options()); invariant(map);
  assert.equal(map.meaning.family, 'quantified-near-quarter-caller-retains-native-provenance');
  assert.equal(map.meaning.evaluation, 'exact-affine-certificate-no-number-interpolation-bound');
  assert.ok(map.bounds.arclengthDrift.upper > 0); assert.ok(map.bounds.actualLengthResidual.upper > map.bounds.nominal.upper);
  assert.equal(map.meaning.solid, false); assert.deepEqual(before.weights, map.source.weights);
  // A slightly shrunken source's actual total length can be below the nominal sEnd. No such inverse is returned.
  assert.equal('evaluate' in map, false); assert.equal('actualArclengthDomain' in map, false);
});


test('carrier-only certification keeps the same exact source coefficients, original domain and radial bound without an inverse', () => {
  for (const domain of [[0, 0.5], [2, 4], [-0, 1]]) {
    const source = quarter(8, domain), before = structuredClone(source), given = { radius: 8 };
    const certificate = certifyCylindricalWrapCarrier(source, given), map = buildCylindricalWrapMap(source, options());
    assert.deepEqual(certificate.source, source); assert.notEqual(certificate.source, source); assert.deepEqual(source, before);
    assert.deepEqual(certificate.domain, map.domain); assert.deepEqual(certificate.bounds.radial, map.bounds.radial);
    for (const key of ['denominator', 'squaredRadiusNumerator', 'angularNumerator', 'circleResidual', 'denominatorMinimum', 'squaredRadiusMinimum', 'angularMinimum']) assert.deepEqual(certificate.proof[key], map.proof[key]);
    for (const key of ['secondNumerator', 'radialDerivative', 'piHalf']) {
      assert.equal(Object.hasOwn(certificate.proof, key), false);
      assert.equal(Object.hasOwn(map.proof, key), true);
    }
    for (const key of ['secondDerivative', 'arclengthDrift', 'actualLengthResidual']) assert.equal(Object.hasOwn(certificate.bounds, key), false);
    assert.equal(certificate.meaning.guarantee, 'analytic-original-carrier-coefficients-only');
    assert.equal(certificate.meaning.parameter, 'original-native-domain-no-inverse-map');
    for (const key of ['chart', 'inverse', 'nodes', 'composition', 'surfaceBinding', 'trim', 'solid', 'globalNativeEvaluationError']) assert.equal(certificate.meaning[key], false);
    for (const key of ['nodes', 'intervals', 'chartDomain', 'evaluate']) assert.equal(Object.hasOwn(certificate, key), false);
    assert.deepEqual(Object.keys(certificate.bounds), ['radial']); assert.deepEqual(certificate.options, { radius: 8 });
    assert.ok(certificate.counts.rational.operations <= map.counts.rational.operations);
    assert.equal(certificate.limits.rationalOperations, 200000); assert.equal(certificate.limits.rationalGcdSteps, 200000);
    assert.equal(certificate.limits.rationalIntegerBits, 8192); assert.equal(certificate.limits.work, 1048576);
    assert.ok(Object.isFrozen(certificate) && Object.isFrozen(certificate.source.controlPoints[1]));
    assert.deepEqual(given, { radius: 8 });
  }
});

test('carrier-only certification neither accepts a chart tolerance nor changes an unattainable full-map refusal', () => {
  const source = quarter(), before = structuredClone(source), tight = options(8, 1e-20);
  refused(source, tight, 'BUDGET');
  const certificate = certifyCylindricalWrapCarrier(source, { radius: 8 });
  assert.equal(certificate.meaning.inverse, false); assert.equal(certificate.meaning.chart, false);
  assert.equal(Object.hasOwn(certificate.options, 'tolerance'), false);
  assert.throws(() => certifyCylindricalWrapCarrier(source, tight), error => isCylindricalWrapMapError(error) && error.code === 'INPUT');
  refused(source, tight, 'BUDGET');
  assert.deepEqual(source, before); assert.deepEqual(tight, options(8, 1e-20));
  const wrong = quarter(); wrong.controlPoints[0][1] = 1e-8;
  assert.throws(() => certifyCylindricalWrapCarrier(wrong, { radius: 8 }), error => isCylindricalWrapMapError(error) && error.code === 'SUPPORT');
  assert.throws(() => certifyCylindricalWrapCarrier(source, { radius: 0 }), error => isCylindricalWrapMapError(error) && error.code === 'INPUT');
});
