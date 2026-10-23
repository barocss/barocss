import test from 'node:test';
import assert from 'node:assert/strict';
import { createHomogeneousBernsteinEquation, solveHomogeneousBernsteinEquation } from '../dist/intersect/own-homogeneous-bernstein-roots.js';

const value = ([a, b, c], t) => a * (1 - t) ** 2 + 2 * b * t * (1 - t) + c * t * t;
const solve = v => solveHomogeneousBernsteinEquation(createHomogeneousBernsteinEquation(v));

test('C1: a crossing just inside t = 1 or t = 0 is found, not dropped', () => {
  // Review reproduction: the closed-form estimate rounded past 1 and the root was filtered away.
  const near1 = solve([2.6e8, 34.3, -4.2e-8]), near0 = solve([-4.2e-8, 34.3, 2.6e8]);
  assert.equal(near1.length, 1); assert.ok(near1[0].t > 0.999999999 && near1[0].t < 1);
  assert.equal(near0.length, 1); assert.ok(near0[0].t > 0 && near0[0].t < 1e-9);
});

test('every sign change between t = 0 and t = 1 yields a bracketed root (random scales)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let checked = 0;
  for (let i = 0; i < 4000; i++) {
    const scale = () => (rnd() - 0.5) * 10 ** Math.floor(rnd() * 18 - 9);
    const v = [scale(), scale(), scale()];
    let roots; try { roots = solve(v); } catch (e) { assert.match(e.message, /tangent|ambiguity/); continue; }
    if (Math.sign(v[0]) !== Math.sign(v[2]) && v[0] !== 0 && v[2] !== 0) { assert.equal(roots.length % 2, 1, JSON.stringify(v)); checked++; }
    for (const r of roots) {
      if (r.t === 0 || r.t === 1) continue;
      const [lo, hi] = r.bracket, fl = value(v, lo), fh = value(v, hi);
      assert.ok(hi - lo <= 1e-12 && lo >= 0 && hi <= 1, JSON.stringify({ v, r }));
      assert.ok(fl === 0 || fh === 0 || Math.sign(fl) !== Math.sign(fh), JSON.stringify({ v, r, fl, fh }));
    }
  }
  assert.ok(checked > 1000);
});

test('unchanged results for ordinary, endpoint and tangent-at-end inputs', () => {
  assert.deepEqual(solve([1, -3, 1]).map(r => r.t), [0.1464466094071213, 0.8535533905928787]);
  assert.deepEqual(solve([0, 1, -1]).map(r => r.t), [0, 0.6666666666663635]);
  assert.deepEqual(solve([0, 0, 1]).map(r => [r.t, r.touch]), [[0, true]]);
  assert.deepEqual(solve([1, 0, 1]), []);
  assert.throws(() => solve([1, -1, 1]), /tangent/);
});
