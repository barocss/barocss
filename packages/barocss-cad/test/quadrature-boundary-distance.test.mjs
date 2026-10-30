import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Test the private production predicate without adding a public API or pinning source checksums.
const modulePath = new URL('../dist/brep/brep-mass-quadrature.js', import.meta.url);
const source = readFileSync(modulePath, 'utf8').replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, modulePath).href}'`);
const { nearBoundary } = await import(`data:text/javascript;base64,${Buffer.from(`${source}\nexport { nearBoundary };`).toString('base64')}`);

// The pre-optimization full-distance scan. Keep the original strict tie rule and refinement order.
function reference(at, U, V, sides, p, near) {
  let side = 0, best = 0, bestD = Infinity;
  for (let k = 0; k < 4; k++) for (let i = 0; i <= 64; i++) {
    const s = sides[k], d = Math.hypot(s[3 * i] - p[0], s[3 * i + 1] - p[1], s[3 * i + 2] - p[2]);
    if (d <= near) return true;
    if (d < bestD) { bestD = d; side = k; best = i; }
  }
  if (bestD <= near) return true;
  let a = Math.max(0, best - 1) / 64, b = Math.min(64, best + 1) / 64;
  const g = (Math.sqrt(5) - 1) / 2;
  const distance = t => {
    const q = side < 2 ? at(U[side], V[0] + (V[1] - V[0]) * t) : at(U[0] + (U[1] - U[0]) * t, V[side - 2]);
    return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
  };
  let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = distance(x1), f2 = distance(x2);
  for (let it = 0; it < 60 && b - a > 1e-15; it++) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = distance(x1); }
    else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = distance(x2); }
  }
  return Math.min(bestD, f1, f2) <= near;
}
function samples(points) {
  return Array.from({ length: 4 }, (_, k) => Float64Array.from(Array.from({ length: 65 }, (_, i) => points(k, i)).flat()));
}
const bits = n => { const b = Buffer.alloc(8); b.writeDoubleBE(n); return b.toString('hex'); };
function compare(sides, p, near, evaluator = (u, v) => [u, v, 0]) {
  const traces = [], results = [];
  for (const predicate of [reference, nearBoundary]) {
    const trace = []; traces.push(trace);
    const at = (u, v) => { trace.push([bits(u), bits(v)]); return evaluator(u, v); };
    try { results.push({ returned: predicate(at, [-0, 1], [0, 1], sides, p, near) }); }
    catch (e) { results.push({ threw: { name: e.name, message: e.message } }); }
  }
  assert.deepEqual(results[1], results[0]); assert.deepEqual(traces[1], traces[0]);
  return traces[1];
}
function next(value, direction) {
  const b = Buffer.alloc(8); b.writeDoubleBE(value); b.writeBigUInt64BE(b.readBigUInt64BE() + BigInt(direction)); return b.readDoubleBE();
}

test('boundary scan preserves exact threshold, adjacent floats and signed-zero early hits', () => {
  const sides = samples((k, i) => k === 0 && i === 0 ? [3, 4, 0] : [100 + i, 100 + k, 100]);
  for (const near of [next(5, -1), 5, next(5, 1)]) compare(sides, [0, 0, 0], near);
  const zeros = samples(() => [-0, 0, -0]);
  for (const near of [-0, 0, Number.MIN_VALUE]) assert.equal(compare(zeros, [0, -0, 0], near).length, 0);
});

test('boundary scan retains nearest-sample ties, no-hit refinement and evaluator failures', () => {
  const ties = samples((k, i) => k === 0 && i === 17 ? [1, 0, 0] : k === 1 && i === 3 ? [-1, 0, 0] : [10 + k, 10 + i, 0]);
  assert.ok(compare(ties, [0, 0, 0], 0, (u, v) => [u + 5, v + 5, 0]).length > 0);
  compare(ties, [0, 0, 0], 0, () => { throw new Error('surface refused'); });
});

test('boundary scan preserves nonfinite, overflow, subnormal and negative-threshold outcomes', () => {
  for (const value of [NaN, Infinity, -Infinity, Number.MAX_VALUE, -Number.MAX_VALUE, Number.MIN_VALUE, -Number.MIN_VALUE, -0]) {
    const sides = samples((k, i) => k === 0 && i === 0 ? [1, 0, 0] : [value, i, k]);
    for (const near of [NaN, Infinity, -Infinity, -1, 0, Number.MIN_VALUE, 1]) compare(sides, [0, 0, 0], near);
    compare(sides, [-Number.MAX_VALUE, value, 0], 1);
  }
});

test('finite component filtering agrees with the full scan over varied cached grids', () => {
  let state = 71;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
  for (let t = 0; t < 120; t++) {
    const p = [random() - 0.5, random() - 0.5, random() - 0.5], sides = samples(() => [random() * 100, random() * 100, random() * 100]);
    const slot = t % 65, row = t % 4;
    if (t % 3 === 0) for (let axis = 0; axis < 3; axis++) sides[row][3 * slot + axis] = p[axis];
    compare(sides, p, t % 3 === 0 ? 0 : 1e-8);
  }
});

test('the current Math.hypot implementation never returns less than a finite component', () => {
  const values = [-0, 0, Number.MIN_VALUE, 2 ** -1022, 1, 1 + Number.EPSILON, 2 ** 500, Number.MAX_VALUE, Infinity];
  for (const x of values) for (const y of values) for (const z of values) assert.ok(Math.hypot(x, y, z) >= Math.max(Math.abs(x), Math.abs(y), Math.abs(z)));
  let state = 123n;
  const nextNumber = () => { state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n); const b = Buffer.alloc(8); b.writeBigUInt64BE(state & 0x7fefffffffffffffn); return b.readDoubleBE(); };
  for (let i = 0; i < 10000; i++) { const x = nextNumber(), y = nextNumber(), z = nextNumber(); assert.ok(Math.hypot(x, y, z) >= Math.max(x, y, z)); }
});
