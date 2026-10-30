import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSurfaceAtParameter } from '../dist/index.js';
import { segmentCurve, extrudedSurface } from '../dist/features/extruded-profile-solid.js';
import { cylindricalWrapMoments, isWrapMomentError } from '../dist/features/cylindrical-wrap-moments.js';

function carrier(curved = false) {
  const middle = curved ? 10 : 5;
  return { kind: 'surface', id: 'source', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 1, 1, 1], knotsV: [0, 0, 1, 1],
    controlPoints: [[[10, 0, 0], [10, 0, 30]], [[middle, 5, 0], [middle, 5, 30]], [[0, 10, 0], [0, 10, 30]]], weights: [[1, 1], [1, 1], [1, 1]] };
}
const full = [{ u: [0, 1], v: [0, 1] }];
function contains(value, numerator, denominator = 1n) {
  const n = BigInt(numerator), d = BigInt(denominator), lo = value.lower, hi = value.upper;
  assert.ok(BigInt(lo.numerator) * d <= n * BigInt(lo.denominator), 'lower bound contains independent exact oracle');
  assert.ok(BigInt(hi.numerator) * d >= n * BigInt(hi.denominator), 'upper bound contains independent exact oracle');
  assert.ok(Number.isFinite(value.estimate) && value.estimateError.upper >= 0);
}
function numeric(value) { return Number(value.numerator) / Number(value.denominator); }
function refused(action, code) { assert.throws(action, error => isWrapMomentError(error) && (code === undefined || error.code === code)); }
function receipt(result) {
  assert.equal(result.method, 'exact-simpson-with-fourth-derivative-bound');
  assert.equal(result.radialScale, 2); assert.equal(result.solidQualified, false); assert.equal(result.fractionBits, 128);
  assert.equal(result.moments.length, 10); assert.ok(result.counts.totalOperations <= 200000);
  assert.ok(result.counts.operations <= 200000 && result.counts.gcdSteps <= 200000 && result.counts.maximumObservedBits <= 8192);
}

test('affine synthetic carrier matches all ten independent triangular-band moments without a cylinder claim', () => {
  const source = carrier(), before = structuredClone(source), result = cylindricalWrapMoments(source, full, { panels: 2 }); receipt(result);
  // x=10(1-t),y=10t,J=100. The band is outer right triangle L20 minus inner L10, extruded H30.
  // Independent polynomial/simplex integration yields the ten integer raw moments below.
  const exact = [4500, 35000, 35000, 67500, 375000, 375000, 1350000, 187500, 525000, 525000];
  for (let i = 0; i < exact.length; i++) { contains(result.moments[i], BigInt(exact[i])); assert.equal(result.moments[i].estimate, exact[i]); assert.equal(result.moments[i].remainderRadius.numerator, '0'); }
  assert.equal(result.positiveAddedVolume, true); assert.deepEqual(source, before);
});

test('non-affine polynomial carrier encloses independent exact degree-six moments and proves fourth-order remainder', () => {
  const source = carrier(true), coarse = cylindricalWrapMoments(source, full, { panels: 2 }), fine = cylindricalWrapMoments(source, full, { panels: 4 }); receipt(coarse); receipt(fine);
  // x=10(1-t^2),y=10t,J=100(1+t^2). Expand each monomial and integrate powers exactly.
  const exact = [[6000n, 1n], [56000n, 1n], [52500n, 1n], [90000n, 1n], [4800000n, 7n], [600000n, 1n], [1800000n, 1n], [375000n, 1n], [840000n, 1n], [787500n, 1n]];
  for (let i = 0; i < exact.length; i++) { contains(coarse.moments[i], ...exact[i]); contains(fine.moments[i], ...exact[i]); }
  const a = numeric(coarse.moments[4].remainderRadius), b = numeric(fine.moments[4].remainderRadius);
  assert.ok(a > 0 && b > 0); assert.ok(Math.abs(a / b - 16) < 1e-10);
  assert.ok(fine.moments[4].estimateError.upper < coarse.moments[4].estimateError.upper);
  refused(() => cylindricalWrapMoments(source, full, { panels: 2, errorBudgets: Array(10).fill(1e-9) }), 'BUDGET');
});

test('disjoint tiles share one request/node cache and keep the independent addition oracle', () => {
  const tiles = [{ u: [0, 0.5], v: [0, 1] }, { u: [0.5, 1], v: [0, 1] }], before = structuredClone(tiles);
  const result = cylindricalWrapMoments(carrier(), tiles, { panels: 2 }); receipt(result);
  contains(result.moments[0], 4500n); contains(result.moments[4], 375000n);
  assert.equal(result.counts.nodes, 5); assert.deepEqual(tiles, before);
});

test('native semicircle direct-copy quarter retains source coefficients/native domains as diagnostic authority', () => {
  const startAngle = 0.17, radius = 10, sweep = Math.PI, start = [radius * Math.cos(startAngle), radius * Math.sin(startAngle)], end = [radius * Math.cos(startAngle + sweep), radius * Math.sin(startAngle + sweep)];
  const arc = segmentCurve({ kind: 'arc', start, end, center: [0, 0], radius, startAngle, sweep, length: radius * sweep }, 0, 'arc');
  const half = extrudedSurface(arc, 0, 30, 'half'), split = splitSurfaceAtParameter(half, { axis: 'u', parameter: 0.5, lowerSurfaceId: 'lower', upperSurfaceId: 'upper' }), source = split.lower, before = structuredClone(source);
  assert.equal(split.report.requiredInsertions, 0);
  const tiles = [{ u: [0.1, 0.4], v: [0.2, 0.7] }], coarse = cylindricalWrapMoments(source, tiles, { panels: 2 }), fine = cylindricalWrapMoments(source, tiles, { panels: 8 });
  for (const result of [coarse, fine]) {
    receipt(result); assert.deepEqual(result.source, before); assert.deepEqual(source, before);
    assert.deepEqual(result.source.knotsU, [0, 0, 0, 0.5, 0.5, 0.5]); assert.notEqual(result.source, source);
  }
  assert.equal(coarse.counts.nodes, 3); assert.equal(fine.counts.nodes, 9);
  const wider = coarse.moments[0].remainderRadius, narrower = fine.moments[0].remainderRadius;
  assert.ok(BigInt(narrower.numerator) * BigInt(wider.denominator) < BigInt(wider.numerator) * BigInt(narrower.denominator));
  // No assertion equates stored rational-cylinder mass with ideal pi*R^2*H.
});

test('invalid product source, overlap, malformed cells and unsupported limits refuse atomically', () => {
  for (const mutate of [source => { source.weights[1][1] = 0.8; }, source => { source.controlPoints[1][1][0] = 6; }, source => { source.controlPoints[1][1][2] = 31; }, source => { source.degreeU = 1; }]) {
    const source = carrier(); mutate(source); const before = structuredClone(source);
    refused(() => cylindricalWrapMoments(source, full)); assert.deepEqual(source, before);
  }
  refused(() => cylindricalWrapMoments(carrier(), []), 'INPUT');
  refused(() => cylindricalWrapMoments(carrier(), [{ u: [0, 0.7], v: [0, 1] }, { u: [0.5, 1], v: [0, 1] }]), 'INPUT');
  refused(() => cylindricalWrapMoments(carrier(), [{ u: ['0', 1], v: [0, 1] }]), 'INPUT');
  refused(() => cylindricalWrapMoments(carrier(), [{ u: [0, 1.1], v: [0, 1] }]), 'INPUT');
  for (const options of [{ panels: 3 }, { panels: 34 }, { maxOperations: 200001 }, { errorBudgets: [1] }, { ignored: true }]) refused(() => cylindricalWrapMoments(carrier(), full, options), 'INPUT');
  refused(() => cylindricalWrapMoments(carrier(), full, { maxOperations: 1 }), 'BUDGET');
});

test('output receipt owns snapshots and does not certify B-rep topology or arbitrary ring coverage', () => {
  const source = carrier(), tiles = structuredClone(full), before = structuredClone({ source, tiles });
  const result = cylindricalWrapMoments(source, tiles, { panels: 2 });
  result.source.controlPoints[0][0][0] = 123; result.rectangles[0].u[0] = 0.25;
  assert.deepEqual({ source, tiles }, before); assert.equal(result.solidQualified, false);
  assert.equal(result.authority, 'original-stored-quarter-parameter-rectangles');
});


test('native nonunit U/V domains preserve the partial added-band volume without span multipliers', () => {
  const source = carrier();
  source.knotsU = [2, 2, 2, 6, 6, 6]; source.knotsV = [-1, -1, 3, 3];
  const before = structuredClone(source), tiles = [{ u: [2, 4], v: [0, 2] }];
  const result = cylindricalWrapMoments(source, tiles, { panels: 2 }); receipt(result);
  // Native U[2,4] is t[0,1/2]; native V[0,2] is physical Z[7.5,22.5].
  // J=100, radial factor=3/2, so added-band volume=(1/2)*100*(3/2)*15=1125.
  contains(result.moments[0], 1125n); assert.equal(result.moments[0].estimate, 1125);
  assert.deepEqual(result.source.knotsU, before.knotsU); assert.deepEqual(result.source.knotsV, before.knotsV);
  assert.deepEqual(source, before); assert.equal(result.solidQualified, false);
});

test('negative source Z preserves signed added-band first moments and positive second moments', () => {
  const source = carrier();
  for (const row of source.controlPoints) { row[0][2] = -20; row[1][2] = -10; }
  const before = structuredClone(source), result = cylindricalWrapMoments(source, full, { panels: 2 }); receipt(result);
  // Cross-section area=150 and integral(x dA)=3500/3 for the same triangular band.
  // Over Z[-20,-10], integral(1)=10, integral(z)=-150 and integral(z^2)=7000/3.
  for (const [index, exact] of [[0, 1500n], [3, -22500n], [6, 350000n], [8, -175000n]]) {
    contains(result.moments[index], exact); assert.equal(result.moments[index].estimate, Number(exact));
  }
  assert.equal(result.positiveAddedVolume, true); assert.equal(result.solidQualified, false);
  assert.deepEqual(source, before);
});
