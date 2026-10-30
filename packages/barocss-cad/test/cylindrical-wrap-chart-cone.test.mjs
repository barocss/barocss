import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartContext, prepareChartCurve, isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';
import { certifyChartCone } from '../dist/features/cylindrical-wrap-chart-cone.js';

function line(id, first, x = 1) {
  return { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[x, first, 0], [x, first + 1, 0], [x, first + 2, 0], [x, first + 3, 0]], weights: [1, 1, 1, 1] };
}
function reversed(curve) {
  const copy = structuredClone(curve); copy.controlPoints.reverse(); copy.weights.reverse(); return copy;
}
function prepared(first = line('a', 1), second = line('b', 4), options) {
  const ctx = new ChartContext(options), a = prepareChartCurve(first, ctx), b = prepareChartCurve(second, ctx);
  return { ctx, a, b };
}
function refused(action, code) { assert.throws(action, error => isCylindricalWrapChartError(error) && (code === undefined || error.code === code)); }
function proof(result, ctx) {
  assert.equal(result.relation, 'projected-images-share-only-prescribed-endpoint');
  assert.equal(result.projectionDegree, 6); assert.equal(result.factoredDegree, 5); assert.equal(result.wholeOriginalIntervals, true);
  assert.equal(result.requiresIndividualProgress, true); assert.equal(result.diagnosticOnly, true);
  for (const key of ['solidQualified', 'sourceBindingCertified', 'cylinderCertified', 'wholeLoopCertified', 'volumeCertified', 'globalEvaluatorErrorCertified']) assert.equal(result[key], false);
  assert.notEqual(result.first.sign, result.second.sign);
  for (const side of [result.first, result.second]) {
    assert.equal(side.projected.length, 7); assert.equal(side.factored.length, 6); assert.equal(side.functional.length, 6);
    for (const value of side.functional) { assert.notEqual(BigInt(value), 0n); assert.equal(BigInt(value) > 0n ? 1 : -1, side.sign); }
  }
  const counts = ctx.counts(); assert.ok(counts.totalOperations <= 200000 && counts.maximumDirectBits <= 8192 && counts.work <= 1048576);
}

test('independent linear projection and endpoint-factor formula gives exact integer cone coefficients', () => {
  const { ctx, a, b } = prepared(), result = certifyChartCone(a, b, 1, 0, ctx, [1, 0]); proof(result, ctx);
  // With X=W=1, Y=1+3t and Z=0, degree-six A=60+30k, B=0, C=60.
  // P=(240,0,60); first F=1800(k-6), second F=1800k. Clearing 60*6/(6-k) or 60*6/k gives +/-648000.
  assert.equal(result.first.sourceDenominator, '1'); assert.equal(result.second.sourceDenominator, '1');
  for (let k = 0; k <= 6; k++) {
    assert.deepEqual(result.first.projected[k], [String(60 + 30 * k), '0', '60']);
    assert.deepEqual(result.second.projected[k], [String(240 + 30 * k), '0', '60']);
  }
  assert.deepEqual(result.projectedVertex, ['240', '0', '60']); assert.deepEqual(result.normal.integers, ['1', '0']);
  assert.deepEqual(result.first.factored, Array(6).fill(['-648000', '0'])); assert.deepEqual(result.second.factored, Array(6).fill(['648000', '0']));
  assert.deepEqual(result.first.functional, Array(6).fill('-648000')); assert.deepEqual(result.second.functional, Array(6).fill('648000'));
  assert.equal(result.first.endpointFactor, 'one-minus-t'); assert.equal(result.second.endpointFactor, 't');
});

test('all explicit endpoint choices preserve canonical curve direction and exact coefficient reversal', () => {
  for (const flipFirst of [false, true]) for (const flipSecond of [false, true]) {
    const first = flipFirst ? reversed(line('a', 1)) : line('a', 1), second = flipSecond ? reversed(line('b', 4)) : line('b', 4);
    const old = structuredClone({ first, second }), { ctx, a, b } = prepared(first, second);
    const result = certifyChartCone(a, b, flipFirst ? 0 : 1, flipSecond ? 1 : 0, ctx); proof(result, ctx);
    assert.deepEqual(result.worldEndpoint, [1, 4, 0]); assert.deepEqual({ first, second }, old);
  }
});

test('opposite represented normal candidates reverse signs without changing the projected relation', () => {
  for (const normal of [[1, 0], [-1, 0], [0.5, 0]]) {
    const { ctx, a, b } = prepared(), result = certifyChartCone(a, b, 1, 0, ctx, normal); proof(result, ctx);
    assert.equal(result.first.sign, normal[0] > 0 ? -1 : 1); assert.equal(result.normal.origin, 'hint');
  }
});

test('equal world endpoints with different weights are compared by exact projected ratios', () => {
  const first = line('a', 1), second = line('b', 4); first.weights = [0.5, 0.5, 0.5, 0.75];
  const { ctx, a, b } = prepared(first, second), result = certifyChartCone(a, b, 1, 0, ctx, [1, 0]); proof(result, ctx);
  assert.deepEqual(result.worldEndpoint, [1, 4, 0]); assert.notDeepEqual(result.first.projected[6], result.second.projected[0]);
});

test('curved whole-edge sectors with varying Z remain strictly in opposite projected half-planes', () => {
  const first = line('a', 1), second = line('b', 1);
  first.controlPoints = [[2, 4, 1], [2, 3, 2], [2, 2, 5], [2, 1, 9]];
  second.controlPoints = [[2, 4, 1], [2, 5, 0], [2, 7, -1], [2, 10, -4]];
  const { ctx, a, b } = prepared(first, second), result = certifyChartCone(a, b, 0, 0, ctx, [1, 0]); proof(result, ctx);
  assert.equal(result.first.sign, -1); assert.equal(result.second.sign, 1);
  assert.notEqual(result.first.factored[0][1], result.first.factored[5][1]);
});

test('large exact coefficient integers use a finite bounded tangent hint instead of overflowing Number ratios', () => {
  const x = 2 ** -1000, { ctx, a, b } = prepared(line('a', 1, x), line('b', 4, x));
  const result = certifyChartCone(a, b, 1, 0, ctx); proof(result, ctx);
  assert.equal(result.normal.origin, 'outgoing-tangents'); assert.ok(result.normal.candidate.every(Number.isFinite));
  assert.ok(ctx.counts().maximumDirectBits > 1024); assert.deepEqual(result.worldEndpoint, [x, 4, 0]);
});

test('equal projections at different radial points and nearly equal endpoints cannot be sewn', () => {
  const radial = prepared(line('a', 1), { ...line('b', 8, 2), controlPoints: [[2, 8, 0], [2, 10, 0], [2, 12, 0], [2, 14, 0]] });
  refused(() => certifyChartCone(radial.a, radial.b, 1, 0, radial.ctx, [1, 0]), 'UNRESOLVED');
  const second = line('b', 4); second.controlPoints[0][1] += 4 * Number.EPSILON;
  const near = prepared(line('a', 1), second); refused(() => certifyChartCone(near.a, near.b, 1, 0, near.ctx, [1, 0]), 'UNRESOLVED');
  const signed = line('b', 4); signed.controlPoints[0][2] = -0;
  const zero = prepared(line('a', 1), signed); refused(() => certifyChartCone(zero.a, zero.b, 1, 0, zero.ctx, [1, 0]), 'UNRESOLVED');
});

test('same outgoing ray, zero normal and zero functional coefficients remain unresolved', () => {
  const same = prepared(line('a', 4), line('b', 4)); refused(() => certifyChartCone(same.a, same.b, 0, 0, same.ctx), 'UNRESOLVED');
  for (const hint of [[1, 0], [0, 0], [0, 1]]) {
    const pair = hint[0] === 1 ? prepared(line('a', 4), line('b', 4)) : prepared();
    refused(() => certifyChartCone(pair.a, pair.b, hint[0] === 1 ? 0 : 1, 0, pair.ctx, hint), 'UNRESOLVED');
  }
});

test('malformed hints, endpoint indices and foreign context curves have typed refusals', () => {
  for (const hint of [[Infinity, 0], [1], [1, 0, 2], new Float64Array([1, 0])]) {
    const { ctx, a, b } = prepared(); refused(() => certifyChartCone(a, b, 1, 0, ctx, hint), 'INPUT');
  }
  const hint = [1, 0]; let calls = 0; Object.defineProperty(hint, 0, { enumerable: true, get() { calls++; throw new Error('getter ran'); } });
  const getter = prepared(); refused(() => certifyChartCone(getter.a, getter.b, 1, 0, getter.ctx, hint), 'INPUT'); assert.equal(calls, 0);
  const endpoint = prepared(); refused(() => certifyChartCone(endpoint.a, endpoint.b, 2, 0, endpoint.ctx, [1, 0]), 'INPUT');
  const foreign = prepared(); refused(() => certifyChartCone(foreign.a, foreign.b, 1, 0, new ChartContext(), [1, 0]));
});

test('the one shared exact/direct request budget can only tighten and bounds cone work', () => {
  const baseline = prepared(), used = baseline.ctx.counts().totalOperations;
  const tight = prepared(line('a', 1), line('b', 4), { maxOperations: used + 10 });
  refused(() => certifyChartCone(tight.a, tight.b, 1, 0, tight.ctx, [1, 0]), 'BUDGET');
  refused(() => new ChartContext({ maxOperations: 200001 }), 'INPUT');
});

test('owned frozen certificates cannot alias or change caller geometry and normal arrays', () => {
  const first = line('a', 1), second = line('b', 4), normal = [1, 0], before = structuredClone({ first, second, normal }), { ctx, a, b } = prepared(first, second);
  const result = certifyChartCone(a, b, 1, 0, ctx, normal); proof(result, ctx);
  assert.deepEqual({ first, second, normal }, before); assert.notEqual(result.worldEndpoint, first.controlPoints[3]); assert.notEqual(result.normal.candidate, normal);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.first.projected) && Object.isFrozen(result.first.projected[0]));
  assert.throws(() => { result.worldEndpoint[0] = 123; }, TypeError);
  assert.throws(() => { result.first.functional[0] = '0'; }, TypeError);
  assert.deepEqual({ first, second, normal }, before);
});
