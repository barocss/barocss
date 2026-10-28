import test from 'node:test';
import assert from 'node:assert/strict';
import { intersectPatches } from '../dist/index.js';

// Constructed counterexample to the seed/bracket admission mismatch, not an observed spring UV.
// Reuse the existing crossing-plane regression's step, tolerance and grid unchanged.
test('surface intersection: a slightly exterior supplied seed cannot lose the connected boundary crossing', () => {
  const A = { at: ([u, v]) => [u, v, 0], box: [[-1, -1], [1, 1]] };
  const B = { at: ([u, v]) => [u, 0, v], box: [[-1, -1], [1, 1]] };
  const options = { step: 0.1, tolerance: 1e-6, grid: 2, seeds: [[-1 - 5e-10, 0, 0]] };
  const before = structuredClone(options), chains = intersectPatches(A, B, options);
  assert.equal(chains.length, 1, 'the independent intersection is one connected line segment');
  const chain = chains[0]; assert.equal(chain.closed, false); assert.ok(chain.points.length >= 2);
  assert.equal(chain.uvA.length, chain.points.length); assert.equal(chain.uvB.length, chain.points.length);
  for (let k = 0; k < chain.points.length; k++) {
    const x = chain.points[k], a = chain.uvA[k], b = chain.uvB[k];
    assert.ok(x.every(Number.isFinite) && a.every(Number.isFinite) && b.every(Number.isFinite));
    for (const uv of [a, b]) assert.ok(uv.every(value => value >= -1 && value <= 1), 'returned UV must be in the authored domain, without slack');
    const xa = A.at(a), xb = B.at(b), distance = (p, q) => Math.hypot(...p.map((v, i) => v - q[i]));
    assert.ok(distance(x, xa) <= options.tolerance && distance(x, xb) <= options.tolerance && distance(xa, xb) <= options.tolerance);
  }
  const ends = [chain.points[0], chain.points.at(-1)].sort((a, b) => a[0] - b[0]);
  assert.ok(Math.hypot(ends[0][0] + 1, ends[0][1], ends[0][2]) <= options.tolerance);
  assert.ok(Math.hypot(ends[1][0] - 1, ends[1][1], ends[1][2]) <= options.tolerance);
  assert.ok(ends[1][0] - ends[0][0] >= 2 - 2 * options.tolerance, 'no clipped-away or empty success');
  assert.deepEqual(options, before);
});
