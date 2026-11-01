import test from 'node:test';
import assert from 'node:assert/strict';
import { solveOutline, type P2, type OutlineConstraints } from '../src/sketch/profile';
import { rectilinearConflict } from '../src/sketch/conflict';
import { commitDimension, type Polygon } from '../src/sketch/rules';
import { settleShape } from '../src/sketch/settle';

const close = (pts: P2[]): Polygon => {
  const s = { kind: 'polygon', closed: true, points: pts, bulges: pts.map(() => 0) } as unknown as Polygon;
  return settleShape(s, { ...s, closed: false }).shape as Polygon;
};
const RECT: P2[] = [[0, 0], [60, 0], [60, 30], [0, 30]];
const L_SHAPE: P2[] = [[0, 0], [60, 0], [60, 20], [20, 20], [20, 40], [0, 40]];
const NONCONV = 'did not meet fixed residual tolerances';
const FREE = { h: [], v: [] };
const zeros = (pts: P2[]) => pts.map(() => 0);

function steps(pts: P2[], list: [string, number][]) {
  let s = close(pts), last: ReturnType<typeof commitDimension> | null = null;
  for (const [k, v] of list) { last = commitDimension(s, k, v); if (!last.ok) return last; s = last.shape; }
  return last!;
}

test('rectangle: opposite edge lengths 60 then 50 is a proven conflict', () => {
  const r = steps(RECT, [['len0', 60], ['len2', 50]]);
  assert.ok(!r.ok); assert.match(r.reason, /Conflict:/); assert.doesNotMatch(r.reason, new RegExp(NONCONV));
  const s = solveOutline(RECT, { lengths: { 0: 60, 2: 50 } });
  assert.ok(!s.ok && s.conflict === true && /Conflict:/.test(s.reason));
});

test('L outline: horizontal lengths 60, 40, 30 conflict', () => {
  const r = steps(L_SHAPE, [['len0', 60], ['len2', 40], ['len4', 30]]);
  assert.ok(!r.ok); assert.match(r.reason, /Conflict:/);
  const s = solveOutline(L_SHAPE, { lengths: { 0: 60, 2: 40, 4: 30 } });
  assert.ok(!s.ok && s.conflict === true);
});

test('dx between opposite corners then a conflicting edge length', () => {
  const r = steps(RECT, [['dx0_2', 60], ['len0', 50]]);
  assert.ok(!r.ok); assert.match(r.reason, /Conflict:/);
  const s = solveOutline(RECT, { lengths: { 0: 50 }, rules: [{ kind: 'dx', a: 0, b: 2, value: 60 }] });
  assert.ok(!s.ok && s.conflict === true);
});

test('edge length 30 then a conflicting dy', () => {
  const r = steps(RECT, [['len1', 30], ['dy0_2', 20]]);
  assert.ok(!r.ok); assert.match(r.reason, /Conflict:/);
  const s = solveOutline(RECT, { lengths: { 1: 30 }, rules: [{ kind: 'dy', a: 1, b: 3, value: 20 }] });
  assert.ok(!s.ok && s.conflict === true);
});

test('a consistent redundant length is still the over-define message', () => {
  const r = steps(RECT, [['len0', 60], ['len2', 60]]);
  assert.ok(!r.ok); assert.match(r.reason, /already implied/); assert.doesNotMatch(r.reason, /Conflict:/);
});

test('consistent edits are accepted', () => {
  assert.ok(steps(RECT, [['len0', 60], ['len1', 40]]).ok);
  assert.ok(steps(RECT, [['len0', 70], ['dy0_2', 30]]).ok);
});

test('a non-rectilinear conflict keeps the kernel nonconvergence message', () => {
  const tri: P2[] = [[0, 0], [10, 0], [5, 8]];
  const s = solveOutline(tri, { lengths: { 0: 10, 1: 10, 2: 30 } });
  assert.ok(!s.ok); assert.ok(!('conflict' in s)); assert.match(s.reason, new RegExp(NONCONV));
  assert.deepEqual(rectilinearConflict(tri, { lengths: { 0: 10, 1: 10, 2: 30 } }, [0, 0, 0]), { proven: false, why: 'outside-class' });
});

test('tolerance band: 3e-7 apart is not proven, 1e-5 apart is', () => {
  assert.deepEqual(rectilinearConflict(RECT, { lengths: { 0: 60, 2: 60 + 3e-7 } }, zeros(RECT)), { proven: false, why: 'feasible' });
  const s = solveOutline(RECT, { lengths: { 0: 60, 2: 60 + 3e-7 } });
  assert.ok(s.ok || !s.conflict, 'must not claim a proven conflict inside the relaxed band');
  assert.deepEqual(rectilinearConflict(RECT, { lengths: { 0: 60, 2: 60 + 1e-5 } }, zeros(RECT)), { proven: true });
  const t = solveOutline(RECT, { lengths: { 0: 60, 2: 60 + 1e-5 } });
  assert.ok(!t.ok && t.conflict === true);
});

test('an arc-bearing outline or an unmodelled constraint is outside the class', () => {
  assert.deepEqual(rectilinearConflict(RECT, { lengths: { 0: 60 } }, [0, 0, 0.4, 0]), { proven: false, why: 'outside-class' });
  assert.deepEqual(rectilinearConflict(RECT, { lengths: { 0: 60 }, rules: [{ kind: 'equal', a: 0, b: 2 }] }, zeros(RECT)), { proven: false, why: 'outside-class' });
  assert.deepEqual(rectilinearConflict(RECT, { lengths: { 0: 60 }, hv: { h: [2], v: [] } }, zeros(RECT)), { proven: false, why: 'outside-class' }, 'length on an edge that is not H/V');
});

test('sign search stops at its budget', () => {
  // 21 chained |x(i+1) − x(i)| = 1 with both ends fixed at 0: an odd sum of ±1 never vanishes, but no partial system shows it.
  const k = 21, pts: P2[] = Array.from({ length: k + 1 }, (_, i) => [i, i * i + 1] as P2);
  const rules: NonNullable<OutlineConstraints['rules']> = [{ kind: 'fix', point: 0, at: [0, 1] }, { kind: 'fix', point: k, at: [0, 1] }];
  for (let i = 0; i < k; i++) rules.push({ kind: 'dx', a: i, b: i + 1, value: 1 });
  const t0 = Date.now();
  assert.deepEqual(rectilinearConflict(pts, { hv: FREE, rules }, zeros(pts)), { proven: false, why: 'budget' });
  assert.ok(Date.now() - t0 < 20000);
  // An even count is feasible on the first path.
  const even = pts.slice(0, k);
  const evenRules: NonNullable<OutlineConstraints['rules']> = [{ kind: 'fix', point: 0, at: [0, 1] }, { kind: 'fix', point: k - 1, at: [0, 1] }];
  for (let i = 0; i < k - 1; i++) evenRules.push({ kind: 'dx', a: i, b: i + 1, value: 1 });
  assert.deepEqual(rectilinearConflict(even, { hv: FREE, rules: evenRules }, zeros(even)), { proven: false, why: 'feasible' });
});

test('a pruned search proves the conflict rather than running out of budget', () => {
  const k = 12, pts: P2[] = Array.from({ length: k + 1 }, (_, i) => [i, i * i + 1] as P2);
  const rules: NonNullable<OutlineConstraints['rules']> = [{ kind: 'fix', point: 0, at: [0, 1] }, { kind: 'fix', point: 1, at: [5, 1] }];
  for (let i = 0; i < k; i++) rules.push({ kind: 'dx', a: i, b: i + 1, value: 1 });
  assert.deepEqual(rectilinearConflict(pts, { hv: FREE, rules }, zeros(pts)), { proven: true });
});

test('arithmetic is exact: 0.1 + 0.2 against 0.3 and values just past the band', () => {
  const pts: P2[] = [[0, 0], [1, 5], [2, 7]];
  const mk = (value: number) => rectilinearConflict(pts, { hv: FREE, rules: [{ kind: 'fix', point: 0, at: [0, 0] }, { kind: 'fix', point: 1, at: [0.1 + 0.2, 5] }, { kind: 'dx', a: 0, b: 1, value }] }, zeros(pts));
  assert.deepEqual(mk(0.3), { proven: false, why: 'feasible' });
  // The two fixes and the dx each carry a 4e-7 half-width: up to 1.2e-6 apart is feasible, past it is not.
  assert.deepEqual(mk(0.3 + 1.1e-6), { proven: false, why: 'feasible' });
  assert.deepEqual(mk(0.3 + 1.3e-6), { proven: true });
});

// Exact value of a double as an integer multiple of 2^-200 (all values used here are far above 2^-200).
const f64 = new Float64Array(1), u64 = new BigUint64Array(f64.buffer);
function scaled200(v: number): bigint {
  f64[0] = v; const bits = u64[0], exp = Number((bits >> 52n) & 0x7ffn), frac = bits & 0xfffffffffffffn;
  const m = exp === 0 ? frac : frac | (1n << 52n), e = (exp === 0 ? -1074 : exp - 1075) + 200;
  return e >= 0 ? m << BigInt(e) : m >> BigInt(-e);
}
function stepUlp(x: number, d: 1n | -1n): number { f64[0] = x; u64[0] += d; return f64[0]; }

test('one-ulp boundary of a dx chain: largest double within the bound is feasible, the next is proven', () => {
  // x1−x0, x2−x1, x3−x2 ∈ 0.1 ± s and |x3−x0| ∈ target ± s (positive sign) give target ≤ 3·0.1 + 3s + s; the anchor and
  // the fix both tie ground→x0 only and do not enter the difference, so B = 3·d(0.1) + 4·d(s) with s = 4 × 1e-7.
  const B = 3n * scaled200(0.1) + 4n * scaled200(4 * 1e-7);
  let lo = Number(B) / 2 ** 200, g = 0;
  while (scaled200(lo) > B && g++ < 64) lo = stepUlp(lo, -1n);
  while (scaled200(stepUlp(lo, 1n)) <= B && g++ < 128) lo = stepUlp(lo, 1n);
  const hi = stepUlp(lo, 1n);
  assert.ok(scaled200(lo) <= B && scaled200(hi) > B && g < 64, 'lo/hi bracket B');
  const four: P2[] = [[0, 0], [1, 3], [2, 6], [3, 9]];
  const chain = (target: number) => rectilinearConflict(four, { hv: FREE, rules: [{ kind: 'fix', point: 0, at: [0, 0] }, { kind: 'dx', a: 0, b: 1, value: 0.1 }, { kind: 'dx', a: 1, b: 2, value: 0.1 }, { kind: 'dx', a: 2, b: 3, value: 0.1 }, { kind: 'dx', a: 0, b: 3, value: target }] }, zeros(four));
  assert.deepEqual(chain(0.3), { proven: false, why: 'feasible' });
  assert.deepEqual(chain(lo), { proven: false, why: 'feasible' });
  assert.deepEqual(chain(hi), { proven: true });
  assert.deepEqual(chain(0.3 + 1e-5), { proven: true });
});

test('a conflict that depends only on the anchor (no fix on point 0)', () => {
  // Point 0 is pinned at its drawn x = 0; point 1 is fixed at x = 10, so dx 0→1 must be 10, not 3.
  const pts: P2[] = [[0, 0], [1, 5], [2, 7]];
  const mk = (value: number) => rectilinearConflict(pts, { hv: FREE, rules: [{ kind: 'fix', point: 1, at: [10, 5] }, { kind: 'dx', a: 0, b: 1, value }] }, zeros(pts));
  assert.deepEqual(mk(3), { proven: true });
  assert.deepEqual(mk(10), { proven: false, why: 'feasible' });
});

test('malformed indices are outside the class and do not throw', () => {
  for (const key of ['-0', '0x2', '2e0', '2.0', '-1', '1.5'])
    assert.deepEqual(rectilinearConflict(RECT, { lengths: { [key]: 60 } }, zeros(RECT)), { proven: false, why: 'outside-class' }, `lengths key ${key}`);
  assert.deepEqual(rectilinearConflict(RECT, { hv: FREE, rules: [{ kind: 'fix', point: 1.5, at: [0, 0] }] }, zeros(RECT)), { proven: false, why: 'outside-class' });
  assert.deepEqual(rectilinearConflict(RECT, { hv: FREE, rules: [{ kind: 'dx', a: 0.5, b: 1, value: 1 }] }, zeros(RECT)), { proven: false, why: 'outside-class' });
  assert.deepEqual(rectilinearConflict(RECT, { hv: FREE, rules: [{ kind: 'dy', a: 0, b: 1.5, value: 1 }] }, zeros(RECT)), { proven: false, why: 'outside-class' });
});
