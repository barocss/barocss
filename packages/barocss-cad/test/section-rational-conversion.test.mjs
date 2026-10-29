import test from 'node:test';
import assert from 'node:assert/strict';
import { SectionRationalContext } from '../dist/section-rational-internal.js';

function failure(code, message) { throw Object.assign(new Error(message), { code }); }
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a; }
function rational(n, d = 1n) { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; }
function add(a, b) { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
function multiply(a, b) { return rational(a.n * b.n, a.d * b.d); }
function compare(a, b) { const n = a.n * b.d - b.n * a.d; return n < 0n ? -1 : n > 0n ? 1 : 0; }
function at(bits) { const b = Buffer.alloc(8); b.writeBigUInt64BE(bits); return b.readDoubleBE(); }
function fromBits(bits) {
  const e = Number(bits >> 52n), f = bits & 0xfffffffffffffn, n = e ? (1n << 52n) + f : f, shift = e ? e - 1075 : -1074;
  return shift < 0 ? rational(n, 1n << BigInt(-shift)) : rational(n << BigInt(shift));
}
const MAX = 0x7fefffffffffffffn;
// Independent monotone binary search; production uses a guarded floating estimate first.
function oracle(value) {
  if (value.n === 0n) return { nearest: 0, upward: 0 };
  const x = rational(value.n < 0n ? -value.n : value.n, value.d); assert.ok(compare(x, fromBits(MAX)) <= 0);
  let lo = 0n, hi = MAX;
  while (lo < hi) { const m = (lo + hi + 1n) / 2n; if (compare(fromBits(m), x) <= 0) lo = m; else hi = m - 1n; }
  const exact = compare(fromBits(lo), x) === 0;
  let nearest = lo;
  if (!exact) {
    const midpoint = multiply(add(fromBits(lo), fromBits(lo + 1n)), rational(1n, 2n)), c = compare(x, midpoint);
    if (c > 0 || c === 0 && lo % 2n === 1n) nearest++;
  }
  return { nearest: value.n < 0n ? -at(nearest) : at(nearest), upward: at(exact ? lo : lo + 1n) };
}
function checkConversion(value) {
  const q = new SectionRationalContext(failure), expected = oracle(value);
  assert.ok(Object.is(q.nearest(value), expected.nearest), `nearest ${value.n}/${value.d}`);
  if (value.n >= 0n) assert.ok(Object.is(q.upward(value), expected.upward));
}

test('exact normalization matches generic Euclid for signed dyadic and mixed denominators', () => {
  for (const exponent of [0, 1, 2, 3, 52, 53, 127, 128, 255, 1023, 1074, 4095, 8191]) {
    const d = 1n << BigInt(exponent), q = new SectionRationalContext(failure);
    for (const n of [0n, 1n, -1n, 3n, -12n, d - 1n, d, -d]) for (const sign of [1n, -1n]) assert.deepEqual(q.rat(n, sign * d), rational(n, sign * d));
  }
  let state = 71n;
  for (let i = 0; i < 400; i++) {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 128n) - 1n);
    const q = new SectionRationalContext(failure), n = state - (1n << 127n), d = ((state >> 19n) | 1n) << BigInt(i % 137);
    assert.deepEqual(q.rat(n, d), rational(n, d));
    const a = rational(n, d), b = rational(3n * n + 1n, 1n << BigInt(i % 129));
    assert.deepEqual(q.add(a, b), add(a, b)); assert.deepEqual(q.mul(a, b), multiply(a, b));
    if (b.n !== 0n) assert.deepEqual(q.div(a, b), rational(a.n * b.d, a.d * b.n));
  }
});

test('nearest and upward preserve exact boundaries and both signs of ties across binary64 ranges', () => {
  const codes = [0n, 1n, 2n, 3n, 0xffffffffffffen, 0xfffffffffffffn, 0x10000000000000n,
    0x3fefffffffffffffn, 0x3ff0000000000000n, 0x3ff0000000000001n, 0x4000000000000000n, MAX - 2n, MAX - 1n];
  for (const code of codes) {
    const low = fromBits(code), high = fromBits(code + 1n), gap = add(high, rational(-low.n, low.d));
    for (const fraction of [rational(0n), rational(1n, 4n), rational(1n, 2n), rational(3n, 4n), rational(1n)]) {
      const x = add(low, multiply(gap, fraction)); checkConversion(x); checkConversion({ n: -x.n, d: x.d });
    }
  }
  checkConversion(fromBits(MAX));
});

test('non-dyadic and unreduced conversions match an independent whole-code search', () => {
  let state = 123n;
  for (let i = 0; i < 160; i++) {
    state = (state * 2862933555777941757n + 3037000493n) & ((1n << 64n) - 1n);
    const shift = BigInt(i % 1100), n = (state | 1n) * 15n, d = ((state >> 17n) | 1n) * 15n << shift;
    checkConversion({ n, d }); checkConversion({ n: -n, d });
  }
});

test('a finite estimate two codes above the floor is corrected by exact comparisons', () => {
  const value = { n: 13969600914137299502930086594630243982n, d: 2909274610578963826657092002074082001n };
  const expected = oracle(value), b = Buffer.alloc(8);
  b.writeDoubleBE(Number(value.n) / Number(value.d)); const estimateCode = b.readBigUInt64BE();
  b.writeDoubleBE(expected.upward); assert.equal(estimateCode - b.readBigUInt64BE(), 1n);
  const q = new SectionRationalContext(failure);
  assert.ok(Object.is(q.nearest(value), expected.nearest)); assert.ok(Object.is(q.upward(value), expected.upward));
  assert.equal(q.counts().floatSearchSteps, 0);
});

test('overflowing Number operands use the exact fallback without trusting an estimate', () => {
  for (const value of [{ n: (1n << 1500n) + 7n, d: 1n << 1500n }, { n: 1n, d: 1n << 1074n }, { n: 1n, d: 1n << 2000n }]) {
    const q = new SectionRationalContext(failure), expected = oracle(value);
    assert.ok(Object.is(q.nearest(value), expected.nearest)); assert.ok(q.counts().floatSearchSteps > 0);
    assert.ok(Object.is(q.upward(value), expected.upward));
  }
  const q = new SectionRationalContext(failure); assert.equal(q.nearest(q.rat(1n, 3n)), oracle(rational(1n, 3n)).nearest); assert.equal(q.counts().floatSearchSteps, 0);
});

test('zero, denominator, finite range, integer size and total operation guards stay active', () => {
  const q = new SectionRationalContext(failure);
  assert.equal(q.nearest(q.rat(0n, -3n)), 0);
  assert.throws(() => q.rat(1n, 0n), e => e.code === 'REPRESENTABILITY');
  assert.throws(() => q.rat(1n, 1n << 8192n), e => e.code === 'BUDGET');
  assert.throws(() => q.upward(q.rat(-1n)), e => e.code === 'REPRESENTABILITY');
  assert.throws(() => q.nearest({ n: 1n << 1024n, d: 1n }), e => e.code === 'REPRESENTABILITY');
  const limited = new SectionRationalContext(failure);
  assert.throws(() => { for (let i = 0; i < 200001; i++) limited.rat(3n, 8n); }, e => e.code === 'BUDGET');
  assert.equal(limited.counts().operations, 200001);
});
