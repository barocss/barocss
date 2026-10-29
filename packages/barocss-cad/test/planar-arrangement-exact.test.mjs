import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arrangementRegions, arrangementRegionsExact, exactPoint2, exactPoint2FromXY,
  exactSame2, isPlanarArrangementError,
} from '../dist/brep/planar-arrangement.js';

const points = ring => ring.map(exactPoint2FromXY);
const square = (lo, hi) => [[lo, lo], [hi, lo], [hi, hi], [lo, hi]];
const ring = (polygon, xy) => ({ polygon, ring: points(xy) });
const windingKey = region => region.winding.join(',');
const side = (region, y) => {
  const positions = [...region.outer, ...region.holes.flat()].map(p => p.y * y.w - y.y * p.w);
  assert.ok(positions.every(v => v <= 0n) || positions.every(v => v >= 0n), 'a bounded face cannot straddle the cut');
  return positions.some(v => v < 0n) ? 'lower' : 'upper';
};

test('exact route agrees with the existing route on ordinary crossing and coincident cuts', () => {
  const domain = ring(0, square(0, 10));
  const trim = ring(1, [[2, 0], [8, 0], [8, 8], [5, 5], [2, 8]]);
  for (const cut of [[[0, 5], [10, 5]], [[0, 0], [10, 0]], [[0, 8], [10, 8]]]) {
    const cuts = [points(cut)], result = arrangementRegionsExact([domain, trim], cuts, 2);
    assert.deepEqual(result.regions, arrangementRegions([domain, trim], cuts, 2));
    assert.equal(result.counts.pairTests, result.counts.segments * (result.counts.segments - 1) / 2);
    assert.equal(result.counts.halfEdges, 2 * result.counts.edges);
    assert.ok(result.counts.boundaryOccurrences <= result.counts.halfEdges);
    assert.equal(result.counts.rational.floatConversions, 0);
  }
});

test('160-point concave U profile retains all inside and outside components', () => {
  const corners = [[1, 1], [9, 1], [9, 9], [7, 9], [7, 4], [3, 4], [3, 9], [1, 9]];
  // Twenty stored binary64 points per authored edge; this is the maximum input profile.
  const sampled = corners.flatMap((a, i) => Array.from({ length: 20 }, (_, k) => {
    const b = corners[(i + 1) % corners.length];
    return [a[0] + (b[0] - a[0]) * k / 20, a[1] + (b[1] - a[1]) * k / 20];
  }));
  const cut = points([[0, 5.5], [10, 5.5]]);
  for (const stored of [sampled, [...sampled].reverse()]) {
    const { regions, counts } = arrangementRegionsExact([ring(0, square(0, 10)), ring(1, stored)], [cut], 2);
    const inside = regions.filter(r => r.winding[0] !== 0 && r.winding[1] !== 0);
    const outside = regions.filter(r => r.winding[0] !== 0 && r.winding[1] === 0);
    const countSides = selected => selected.reduce((out, r) => { out[side(r, cut[0])]++; return out; }, { lower: 0, upper: 0 });
    assert.deepEqual(countSides(inside), { lower: 1, upper: 2 });
    assert.deepEqual(countSides(outside), { lower: 2, upper: 1 });
    assert.equal(counts.segments, 165);
    assert.equal(counts.pairTests, 13530);
    assert.ok(counts.vertices <= 326);
    assert.ok(counts.edges <= 651);
    assert.ok(counts.boundaryOccurrences <= 1302);
    assert.ok(regions.length <= 434);
    assert.ok(counts.rational.operations <= 200000);
    assert.ok(counts.rational.maximumObservedBits <= 8192);
  }
});

test('exact area orders nested components when Number ratios and areas are unavailable', () => {
  const denominator = 1n << 1100n;
  const nested = (polygon, lo, hi) => ({ polygon, ring: square(lo, hi).map(([x, y]) =>
    exactPoint2(denominator + BigInt(x), denominator, denominator + BigInt(y), denominator)) });
  const inputs = [nested(0, 0, 12), nested(1, 2, 10), nested(2, 4, 8)];
  const { regions, counts } = arrangementRegionsExact(inputs, [], 3);
  assert.deepEqual(regions.map(r => [windingKey(r), r.holes.length]).sort(), [
    ['1,0,0', 1], ['1,1,0', 1], ['1,1,1', 0],
  ]);
  const annulus = regions.find(r => windingKey(r) === '1,1,0');
  assert.ok(annulus.holes[0].every(p => inputs[2].ring.some(q => exactSame2(p, q))));
  assert.equal(counts.rational.floatConversions, 0);
  assert.ok(counts.rational.maximumObservedBits > 1024);
});

test('exact zero-area cut spurs are not invented bounded material', () => {
  const cuts = [points([[0, 0], [1, 0]]), points([[1, 0], [2, 0]])];
  const result = arrangementRegionsExact([], cuts, 0);
  assert.deepEqual(result.regions, []);
  assert.equal(result.counts.cycles, 1);
  assert.equal(result.counts.boundaryOccurrences, 0);
});

test('bounded exact entry refuses excess work and invalid homogeneous inputs', () => {
  const a = exactPoint2FromXY([0, 0]), b = exactPoint2FromXY([1, 1]);
  assert.throws(() => arrangementRegionsExact([], Array.from({ length: 166 }, () => [a, b]), 0), isPlanarArrangementError);
  assert.throws(() => arrangementRegionsExact([{ polygon: 0, ring: [a, b] }], [], 0), isPlanarArrangementError);
  assert.throws(() => arrangementRegionsExact([], [[a, { x: 1n, y: 2n, w: 0n }]], 0), isPlanarArrangementError);
  assert.throws(() => arrangementRegionsExact([], [[a, { x: 1n << 8192n, y: 0n, w: 1n }]], 0), isPlanarArrangementError);
});
