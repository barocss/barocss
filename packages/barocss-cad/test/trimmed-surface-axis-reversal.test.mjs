import test from 'node:test';
import assert from 'node:assert/strict';
import { reverseTrimmedSurfaceAxis, reverseSurfaceAxis, TrimmedSurfaceAxisReversalError,
  SurfaceAxisReversalError, evaluateSurface } from '../dist/index.js';

const support = () => ({ kind: 'surface', id: 'support', degreeU: 1, degreeV: 1,
  knotsU: [-2, -2, 6, 6], knotsV: [1, 1, 7, 7],
  controlPoints: [[[10, -6, 3], [10, 24, 3]], [[50, -6, 3], [50, 24, 3]]], weights: [[1, 1], [1, 1]] });
const options = axis => ({ surfaceId: 'reversed', axis, resultIdPrefix: 'rt' });
const rectangle = () => [[-1, 2], [1, 2], [1, 4], [-1, 4]];
const loops = (uv = rectangle(), keep = 'outside') => [{ keep, uv }];
const reverse = (s = support(), uv = rectangle(), axis = 'u', keep = 'outside') => reverseTrimmedSurfaceAxis(s, loops(uv, keep), options(axis));
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

// Independent Fraction oracle. It uses represented binary64 values, no CAD projection,
// evaluation, reversal, polygon, or rational arithmetic helper.
const bytes = new DataView(new ArrayBuffer(8));
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }
function fraction(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function f(value) {
  bytes.setFloat64(0, value); const bits = bytes.getBigUint64(0), exponent = Number((bits >> 52n) & 2047n);
  const mantissa = (bits & 0xfffffffffffffn) + (exponent ? 1n << 52n : 0n), power = exponent ? exponent - 1075 : -1074;
  const signed = bits >> 63n ? -mantissa : mantissa;
  return power < 0 ? fraction(signed, 1n << BigInt(-power)) : fraction(signed << BigInt(power));
}
const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const neg = a => ({ n: -a.n, d: a.d });
const sub = (a, b) => add(a, neg(b));
const mul = (a, b) => fraction(a.n * b.n, a.d * b.d);
const div = (a, b) => fraction(a.n * b.d, a.d * b.n);
const number = a => Number(a.n) / Number(a.d);
function lift(s, uv) {
  const u = div(sub(f(uv[0]), f(s.knotsU[1])), sub(f(s.knotsU[2]), f(s.knotsU[1])));
  const v = div(sub(f(uv[1]), f(s.knotsV[1])), sub(f(s.knotsV[2]), f(s.knotsV[1])));
  return s.controlPoints[0][0].map((origin, i) => add(add(f(origin),
    mul(u, sub(f(s.controlPoints[1][0][i]), f(origin)))), mul(v, sub(f(s.controlPoints[0][1][i]), f(origin)))));
}
function moments(points) {
  let twice = f(0), mx = f(0), my = f(0);
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], cross = sub(mul(a[0], b[1]), mul(b[0], a[1]));
    twice = add(twice, cross); mx = add(mx, mul(add(a[0], b[0]), cross)); my = add(my, mul(add(a[1], b[1]), cross));
  }
  return { area: Math.abs(number(div(twice, f(2)))), centroid: [number(div(mx, mul(f(3), twice))), number(div(my, mul(f(3), twice))), 3] };
}
function material(s, loop) {
  const hole = moments(loop.uv.map(p => lift(s, p)));
  if (loop.keep === 'inside') return hole;
  return { area: 1200 - hole.area, centroid: [(36000 - hole.area * hole.centroid[0]) / (1200 - hole.area),
    (10800 - hole.area * hole.centroid[1]) / (1200 - hole.area), 3] };
}
function contains(points, probe) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i].map(number), b = points[j].map(number);
    if ((a[1] > probe[1]) !== (b[1] > probe[1]) && probe[0] < (b[0] - a[0]) * (probe[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function sampleWorldPolygon(vertices, count = 160) {
  return Array.from({ length: count }, (_, i) => {
    const t = i * vertices.length / count, index = Math.floor(t), alpha = t - index;
    const a = vertices[index], b = vertices[(index + 1) % vertices.length];
    return [(a[0] + alpha * (b[0] - a[0]) - 20) / 5, (a[1] + alpha * (b[1] - a[1]) + 11) / 5];
  });
}
function verifyWorld(result, originalLoop) {
  const original = originalLoop.uv.map(p => lift(result.original, p)), mapped = result.trimLoops[0].uv.map(p => lift(result.surface, p));
  for (let i = 0; i < original.length; i++) {
    const l1 = original[i].reduce((sum, value, j) => sum + Math.abs(number(sub(value, mapped[i][j]))), 0);
    assert.ok(l1 <= result.trimTransport.maximumWorldRoundingBound);
    const native = evaluateSurface(result.surface, ...result.trimLoops[0].uv[i]);
    native.forEach((value, j) => near(value, number(original[i][j]), 1e-7));
  }
  const before = material(result.original, originalLoop), after = material(result.surface, result.trimLoops[0]);
  near(after.area, before.area); after.centroid.forEach((value, i) => near(value, before.centroid[i]));
  for (const probe of [[20, 4], [40, 15], [18, 10], [28, 10]]) assert.equal(contains(mapped, probe), contains(original, probe));
  return after;
}

test('160-point rectangle: both axes and keep flags preserve exact independent world material; parent remains unchanged', () => {
  const uv = sampleWorldPolygon([[15, -1], [25, -1], [25, 9], [15, 9]]);
  for (const axis of ['u', 'v']) for (const keep of ['inside', 'outside']) {
    const s = support(), input = loops(uv, keep), before = structuredClone({ s, input });
    const r = reverseTrimmedSurfaceAxis(s, input, options(axis)), native = reverseSurfaceAxis(s, options(axis));
    assert.deepEqual({ s, input }, before); assert.deepEqual(r.report, native.report); assert.deepEqual(r.provenance, native.provenance);
    assert.equal(r.report.limits.maximumObservations, 128); assert.ok(r.report.observations.length <= 128);
    assert.equal(r.trimTransport.bindingCount, 160); assert.equal(r.trimTransport.pointCount, 160);
    assert.equal(r.trimTransport.limits.maximumBindings, 160); assert.ok(r.trimTransport.work.transport.operations <= 200000);
    assert.equal(r.trimTransport.quality.solidMass, 'not-applicable');
    assert.equal(r.trimLoops[0].keep, keep); assert.equal(r.trimLoops[0].uv.length, uv.length);
    const mat = verifyWorld(r, input[0]); near(mat.area, keep === 'inside' ? 100 : 1100);
    mat.centroid.forEach((value, i) => near(value, (keep === 'inside' ? [20, 4, 3] : [340 / 11, 104 / 11, 3])[i]));
    const other = axis === 'u' ? 1 : 0;
    r.trimLoops[0].uv.forEach((point, i) => assert.ok(Object.is(point[other], uv[i][other])));
    r.trimLoops[0].uv[0][0] = 123; assert.deepEqual(input, before.input);
  }
});

test('160-point concave fractional loop preserves actual stored area130.9590625, separately from ideal design131', () => {
  const uv = sampleWorldPolygon([[15, -1], [30, -1], [30, 4], [22, 4], [22, 12], [15, 12]]);
  const original = loops(uv)[0], actual = moments(uv.map(p => lift(support(), p)));
  near(actual.area, 130.9590625); assert.ok(Math.abs(actual.area - 131) > 0.04);
  for (const axis of ['u', 'v']) {
    const r = reverse(support(), uv, axis), after = verifyWorld(r, original);
    near(after.area, 1200 - actual.area); assert.ok(r.trimTransport.roundedPointCount > 0);
    assert.ok(r.trimTransport.maximumChartRounding > 0); assert.ok(r.trimTransport.maximumWorldRoundingBound <= 1e-7);
    assert.notEqual(r.trimTransport.originalWinding, r.trimTransport.reversedWinding);
  }
});

test('fractional nearest rounding, endpoint copies, nonselected negative-zero bits and clockwise loops', () => {
  const uv = [[0.4, 2], [2, 2], [2, 4.6], [0.4, 4.6]];
  for (const axis of ['u', 'v']) for (const points of [uv, uv.toReversed()]) verifyWorld(reverse(support(), points, axis), loops(points)[0]);
  const boundary = [[-2, 1], [6, 1], [6, 7], [-2, 7]], r = reverse(support(), boundary);
  assert.deepEqual(r.trimLoops[0].uv, [[6, 1], [-2, 1], [-2, 7], [6, 7]]);
  assert.equal(r.trimTransport.maximumWorldRoundingBound, 0);
  const s = support(); s.knotsV = [-1, -1, 7, 7];
  const signed = [[-1, -0], [1, -0], [1, 4], [-1, 4]], signedResult = reverse(s, signed);
  assert.ok(Object.is(signedResult.trimLoops[0].uv[0][1], -0));
});

test('double selected reversals and combined axes preserve world material within original bound', () => {
  const original = loops([[0.4, 2], [2, 2], [2, 4.6], [0.4, 4.6]])[0];
  for (const axes of [['u', 'u'], ['v', 'v'], ['u', 'v']]) {
    const first = reverse(support(), original.uv, axes[0]);
    const second = reverseTrimmedSurfaceAxis(first.surface, first.trimLoops, { surfaceId: 'again', axis: axes[1], resultIdPrefix: 'againp' });
    verifyWorld(second, first.trimLoops[0]);
    const before = material(support(), original), after = material(second.surface, second.trimLoops[0]);
    near(before.area, after.area); before.centroid.forEach((value, i) => near(value, after.centroid[i]));
    assert.equal(second.trimTransport.quality.doubleReversalBitsCertified, false);
  }
});

function refuses(fn, code) { assert.throws(fn, error => error instanceof TrimmedSurfaceAxisReversalError && error.code === code); }
test('native error precedence and unsupported support profiles retain typed refusal and input ownership', () => {
  assert.throws(() => reverse(support(), rectangle(), 'x'), e => e instanceof SurfaceAxisReversalError && e.code === 'AXIS');
  const rational = support(); rational.weights[1][1] = 2;
  const nonAffine = support(); nonAffine.controlPoints[1][1][2] = 4;
  const degenerate = support(); degenerate.controlPoints[1] = structuredClone(degenerate.controlPoints[0]);
  for (const s of [rational, nonAffine, degenerate]) {
    const before = structuredClone(s); refuses(() => reverse(s), 'SUPPORT'); assert.deepEqual(s, before);
  }
});

test('malformed, sparse, multi-loop, oversized, and out-of-domain trims refuse without mutation', () => {
  const dense = loops(), sparse = rectangle(); delete sparse[1];
  const cases = [[], [dense[0], dense[0]], [{ keep: 'bad', uv: rectangle() }], [{ ...dense[0], extra: 1 }],
    loops([[1, 2, 3], [1, 4], [-1, 4]]), loops([[NaN, 2], [1, 4], [-1, 4]]), loops(sparse)];
  for (const value of cases) refuses(() => reverseTrimmedSurfaceAxis(support(), value, options('u')), 'INPUT');
  refuses(() => reverse(support(), Array.from({ length: 161 }, (_, i) => [i / 100, 2])), 'BUDGET');
  refuses(() => reverse(support(), [[-3, 2], [1, 2], [1, 4]]), 'DOMAIN');
  let getterCalls = 0;
  const accessor = { keep: 'outside', get uv() { getterCalls++; return rectangle(); } };
  refuses(() => reverseTrimmedSurfaceAxis(support(), [accessor], options('u')), 'INPUT'); assert.equal(getterCalls, 0);
});

test('exact topology rejects duplicate, zero edge, backtracking, nonadjacent touch, overlap, crossing, and zero area', () => {
  const invalid = [
    [[-1, 2], [1, 2], [1, 2], [-1, 4]],
    [[-1, 2], [1, 2], [0, 2], [1, 4], [-1, 4]],
    [[-1, 2], [1, 4], [-1, 4], [1, 2]],
    [[-1, 2], [1, 2], [1, 4], [0, 2], [-1, 4]],
    [[-1, 2], [1, 2], [1, 4], [-1, 4], [-1, 3], [0, 3], [0, 2]],
    [[-1, 2], [0, 2], [1, 2]],
  ];
  for (const uv of invalid) { const before = structuredClone(uv); refuses(() => reverse(support(), uv), 'TOPOLOGY'); assert.deepEqual(uv, before); }
  // Exact input remains simple; binary64 reflection makes the first two vertices coincide.
  const narrow = [[0, 2], [Number.MIN_VALUE, 2], [1, 3], [0, 4]];
  refuses(() => reverse(support(), narrow), 'TOPOLOGY');
});

test('large chart coordinates use actual domains; original UV tolerance rejects excessive rounding', () => {
  const s = support(); s.knotsU = [100000, 100000, 100008, 100008];
  const uv = [[100001, 2], [100003, 2], [100003, 4], [100001, 4]];
  assert.equal(reverse(s, uv).trimLoops[0].uv[0][0], 100007);
  const far = support(); far.knotsU = [0, 0, 1e12, 1e12];
  refuses(() => reverse(far, [[0.4, 2], [1e11, 2], [1e11, 4], [0.4, 4]]), 'BINDING');
});
