import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExactSegmentCrossingV1 as crossing } from '../dist/exact-proof/exact-segment-crossing-v1.js';
import { classifyCollinearSegmentOverlapV1 as overlap } from '../dist/exact-proof/exact-collinear-segment-overlap-v1.js';
import { intersectProperSegmentsExactBinary64V1 as intersection } from '../dist/exact-proof/exact-segment-intersection-point-v1.js';

const p = (x, y) => ({ x, y });
const guard = (point, onGet) => new Proxy(point, { get() { onGet(); throw new Error('caller get forbidden'); } });
const revoked = () => { const pair = Proxy.revocable(p(0, 0), {}); pair.revoke(); return pair.proxy; };

test('all exact segment solvers use admitted descriptor data, never Proxy property getters', () => {
  let reads = 0;
  const proxy = point => guard(point, () => { reads++; });
  const cross = [proxy(p(0, 0)), proxy(p(4, 4)), proxy(p(0, 4)), proxy(p(4, 0))];
  assert.equal(crossing(...cross).relation, 'proper-interior-crossing');
  assert.deepEqual(intersection(...cross).pointMM, {
    x: { numerator: '2', denominator: '1' }, y: { numerator: '2', denominator: '1' },
  });
  const collinear = [proxy(p(0, 0)), proxy(p(4, 0)), proxy(p(2, 0)), proxy(p(6, 0))];
  assert.deepEqual(overlap(...collinear).overlapMM, [p(2, 0), p(4, 0)]);
  assert.equal(reads, 0);
});

test('revoked proxies and hostile reflection fail closed consistently', () => {
  const cases = [
    () => revoked(),
    () => new Proxy(p(0, 0), { ownKeys() { throw new Error('ownKeys'); } }),
    () => new Proxy(p(0, 0), { getOwnPropertyDescriptor() { throw new Error('descriptor'); } }),
    () => new Proxy(p(0, 0), { getPrototypeOf() { throw new Error('prototype'); } }),
  ];
  for (const hostile of cases) {
    for (const solver of [crossing, overlap, intersection]) {
      assert.deepEqual(solver(hostile(), p(4, 4), p(0, 4), p(4, 0)),
        { status: 'unsupported', reason: 'invalid-input' });
    }
  }
});

test('a proxy lying on get cannot alter exact crossing, rational result, or overlap', () => {
  const liar = point => new Proxy(point, { get() { return 9000; } });
  const points = [liar(p(0, 0)), liar(p(.5, .5)), liar(p(0, .5)), liar(p(.5, 0))];
  assert.equal(crossing(...points).relation, 'proper-interior-crossing');
  assert.deepEqual(intersection(...points).pointMM, {
    x: { numerator: '1', denominator: '4' }, y: { numerator: '1', denominator: '4' },
  });
  assert.equal(overlap(liar(p(0, 0)), liar(p(4, 0)), liar(p(2, 0)), liar(p(6, 0))).relation, 'positive-length-overlap');
});
