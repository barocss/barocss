import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartContext, prepareChartCurve, isCylindricalWrapChartError } from '../dist/features/cylindrical-wrap-chart.js';
import { certifyCylindricalWrapChartSeparation } from '../dist/features/cylindrical-wrap-chart-separation.js';

function curve(id, heights = [0, 0, 1, 1], slopes = [1, 1.25, 1.75, 2], weights = [1, 1, 1, 1]) {
  const controlPoints = [];
  for (let i = 0; i < 4; i++) controlPoints.push([1, slopes[i], heights[i]]);
  return { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints, weights: [...weights] };
}
function translatedPair() {
  // Both cubics have the same strictly increasing Y(t) and X=W=1. B's Z(t)=A's Z(t)+1/4.
  // Equality of projected slope forces the same t, so this is a global analytic disjointness oracle.
  return [curve('first'), curve('second', [0.25, 0.25, 1.25, 1.25])];
}
function prepare(first, second, contextOptions) {
  const ctx = new ChartContext(contextOptions), a = prepareChartCurve(first, ctx), b = prepareChartCurve(second, ctx);
  return { ctx, a, b };
}
function refused(first, second, options, code, contextOptions) {
  const originalA = structuredClone(first), originalB = structuredClone(second), oldOptions = structuredClone(options);
  const { ctx, a, b } = prepare(first, second, contextOptions);
  assert.throws(() => certifyCylindricalWrapChartSeparation(a, b, ctx, options), error => isCylindricalWrapChartError(error) && error.code === code);
  assert.deepEqual(first, originalA); assert.deepEqual(second, originalB); assert.deepEqual(options, oldOptions);
}
function completeCover(result) {
  assert.equal(result.cover.complete, true); assert.ok(result.cover.leaves > 0);
  assert.equal(result.cover.leaves, result.cover.splits + 1); assert.equal(result.cover.visits, 2 * result.cover.splits + 1);
  assert.deepEqual(result.cover.domain, [[0, 1], [0, 1]]);
  assert.equal(result.cover.witnessesRecorded, true); assert.equal(result.witnesses.length, result.cover.leaves);
  assert.ok(result.witnesses.length <= 256); assert.ok(result.cover.visits <= result.limits.pairs);
  const gridSize = 2 ** result.limits.depth, coverage = new Uint8Array(gridSize * gridSize);
  for (const witness of result.witnesses) {
    assert.ok(witness.axis === 'slope' || witness.axis === 'height'); assert.ok(witness.before === 'first' || witness.before === 'second');
    const upper = witness.upper, lower = witness.lower;
    assert.ok(BigInt(upper.denominator) > 0n); assert.ok(BigInt(lower.denominator) > 0n);
    assert.ok(BigInt(upper.numerator) * BigInt(lower.denominator) < BigInt(lower.numerator) * BigInt(upper.denominator));
    const a = witness.first, b = witness.second, da = 2 ** a.depth, db = 2 ** b.depth;
    assert.deepEqual(a.range, [a.index / da, (a.index + 1) / da]); assert.deepEqual(b.range, [b.index / db, (b.index + 1) / db]);
    const ax = a.index * gridSize / da, az = (a.index + 1) * gridSize / da, bx = b.index * gridSize / db, bz = (b.index + 1) * gridSize / db;
    assert.ok(Number.isInteger(ax) && Number.isInteger(az) && ax >= 0 && az <= gridSize && ax < az);
    assert.ok(Number.isInteger(bx) && Number.isInteger(bz) && bx >= 0 && bz <= gridSize && bx < bz);
    for (let x = ax; x < az; x++) for (let y = bx; y < bz; y++) coverage[x * gridSize + y]++;
  }
  // Every unit dyadic cell is covered once. This checks a full partition, not just an area sum.
  for (const count of coverage) assert.equal(count, 1);
}
function reversed(input, id) {
  const out = structuredClone(input); out.id = id; out.controlPoints.reverse(); out.weights.reverse(); return out;
}

test('two actual curved cubics separate after exact subdivision although both initial ratio boxes overlap', () => {
  const [first, second] = translatedPair(), beforeA = structuredClone(first), beforeB = structuredClone(second), { ctx, a, b } = prepare(first, second);
  const result = certifyCylindricalWrapChartSeparation(a, b, ctx, { witnesses: true });
  assert.equal(result.relation, 'strict-disjoint-projected-images'); assert.deepEqual(result.curves, ['first', 'second']);
  assert.ok(result.cover.splits > 0); assert.ok(result.cover.visits > 1); completeCover(result);
  assert.equal(result.parameterFrame, 'original-normalized-bezier-t'); assert.deepEqual(result.axisUnits, { slope: 'dimensionless-y-over-x', height: 'mm' });
  assert.equal(result.meaning.storedProjectedPairOnly, true); assert.equal(result.meaning.individualProgressFromOwnedCharts, true);
  for (const key of ['sourceCertified', 'carrierCertified', 'loopCertified', 'solidQualified', 'volumeCertified', 'globalEvaluatorErrorCertified']) assert.equal(result.meaning[key], false);
  assert.ok(result.counts.totalOperations <= 200000); assert.ok(result.counts.work <= 1048576);
  assert.deepEqual(first, beforeA); assert.deepEqual(second, beforeB);
});

test('an initial strict ratio gap needs one complete leaf and omits optional witnesses by default', () => {
  const first = curve('near'), second = curve('far', [0, 0, 1, 1], [4, 4.25, 4.75, 5]), { ctx, a, b } = prepare(first, second);
  const result = certifyCylindricalWrapChartSeparation(a, b, ctx);
  assert.deepEqual(result.cover, { domain: [[0, 1], [0, 1]], complete: true, leaves: 1, visits: 1, splits: 0, witnessesRecorded: false });
  assert.deepEqual(result.witnesses, []); assert.deepEqual(result.limits, { depth: 8, pairs: 512, witnessLeaves: 256 });
  const tight = prepare(first, second, { maxDepth: 0 });
  const one = certifyCylindricalWrapChartSeparation(tight.a, tight.b, tight.ctx, { maxDepth: 0, maxPairs: 1, witnesses: true }); completeCover(one);
});

test('crossing, exact interior tangency, endpoint contact and full overlap never produce a partial certificate', () => {
  const first = curve('first');
  // At t=1/2 both crossing cubics have projected point (3/2,1/2).
  refused(first, curve('crossing', [1, 1, 0, 0]), {}, 'UNRESOLVED');
  // 3*(2t-1)^2 has degree3 Bernstein coefficients [3,-1,-1,3] and touches Z=0 at t=1/2.
  refused(curve('flat', [0, 0, 0, 0]), curve('tangent', [3, -1, -1, 3]), {}, 'UNRESOLVED');
  refused(first, curve('endpoint', [1, 1, 2, 2], [2, 2.25, 2.75, 3]), {}, 'UNRESOLVED');
  refused(first, curve('coincident'), {}, 'UNRESOLVED');
  const { ctx, a } = prepare(first, curve('unused'));
  assert.throws(() => certifyCylindricalWrapChartSeparation(a, a, ctx), error => isCylindricalWrapChartError(error) && error.code === 'UNRESOLVED');
});

test('curve reversal preserves disjointness and exact original normalized interval coverage', () => {
  const [first, second] = translatedPair(), aReverse = reversed(first, 'reverse_a'), bReverse = reversed(second, 'reverse_b');
  for (const pair of [[aReverse, second], [first, bReverse], [aReverse, bReverse]]) {
    const { ctx, a, b } = prepare(pair[0], pair[1]), result = certifyCylindricalWrapChartSeparation(a, b, ctx, { witnesses: true }); completeCover(result);
    assert.equal(result.cover.complete, true);
  }
});

test('depth uncertainty and resource exhaustion retain different typed refusal codes', () => {
  const [first, second] = translatedPair();
  refused(first, second, { maxDepth: 0 }, 'UNRESOLVED');
  refused(first, second, {}, 'UNRESOLVED', { maxDepth: 0 });
  refused(first, second, { maxPairs: 1 }, 'BUDGET');
  refused(first, second, { maxPairs: 2 }, 'BUDGET');
  assert.throws(() => {
    const { ctx, a, b } = prepare(first, second, { maxOperations: 1 }); certifyCylindricalWrapChartSeparation(a, b, ctx);
  }, error => isCylindricalWrapChartError(error) && error.code === 'BUDGET');
});

test('only tighter own options are accepted without running getters or changing source curves', () => {
  const [first, second] = translatedPair();
  for (const options of [{ maxDepth: 9 }, { maxDepth: -1 }, { maxDepth: 0.5 }, { maxPairs: 0 }, { maxPairs: 513 }, { maxPairs: NaN }, { witnesses: 1 }, { unexpected: true }]) refused(first, second, options, 'INPUT');
  refused(first, second, { maxDepth: 2 }, 'INPUT', { maxDepth: 1 });
  const { ctx, a, b } = prepare(first, second); let calls = 0;
  const options = {}; Object.defineProperty(options, 'maxDepth', { enumerable: true, get() { calls++; throw new Error('getter ran'); } });
  assert.throws(() => certifyCylindricalWrapChartSeparation(a, b, ctx, options), error => isCylindricalWrapChartError(error) && error.code === 'INPUT'); assert.equal(calls, 0);
});

test('foreign or forged chart graphs refuse before access and certificates do not alias caller data', () => {
  const [first, second] = translatedPair(), { ctx, a, b } = prepare(first, second), foreign = new ChartContext();
  assert.throws(() => certifyCylindricalWrapChartSeparation(a, b, foreign), error => isCylindricalWrapChartError(error) && error.code === 'INPUT');
  const forged = Object.freeze({ ...a, root: Object.freeze({ ...a.root }) });
  assert.throws(() => certifyCylindricalWrapChartSeparation(forged, b, ctx), error => isCylindricalWrapChartError(error) && error.code === 'INPUT');
  let reads = 0; const getterGraph = {};
  Object.defineProperty(getterGraph, 'root', { enumerable: true, get() { reads++; throw new Error('foreign graph getter ran'); } });
  assert.throws(() => certifyCylindricalWrapChartSeparation(getterGraph, b, ctx), error => isCylindricalWrapChartError(error) && error.code === 'INPUT'); assert.equal(reads, 0);
  const result = certifyCylindricalWrapChartSeparation(a, b, ctx, { witnesses: true });
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.witnesses)); assert.ok(Object.isFrozen(result.witnesses[0]));
  assert.ok(Object.isFrozen(result.witnesses[0].first.range)); assert.ok(Object.isFrozen(result.witnesses[0].upper));
  assert.ok(Object.isFrozen(result.counts)); assert.ok(Object.isFrozen(result.counts.rational));
  first.controlPoints[0][1] = 999; second.controlPoints[0][2] = 999;
  assert.deepEqual(result.curves, ['first', 'second']); assert.equal(a.source.controlPoints[0][1], 1); assert.equal(b.source.controlPoints[0][2], 0.25);
});
