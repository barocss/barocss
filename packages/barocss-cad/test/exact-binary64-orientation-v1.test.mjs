import assert from 'node:assert/strict';
import test from 'node:test';
import { orient2dExactBinary64V1 as orient } from '../dist/exact-binary64-orientation-v1.js';

const p = (x, y) => ({ x, y });
const sign = (a, b, c) => orient(a, b, c).sign;

test('binary64 dyadic exact orientation on genuine represented decimals', () => {
  const a = p(0, 0), b = p(0.1, 0), c = p(0, 0.1);
  assert.deepEqual(orient(a, b, c), {
    status: 'exact', sign: 'positive', method: 'binary64-dyadic-bigint',
  });
  assert.equal(sign(a, c, b), 'negative');
  assert.equal(sign(a, p(0.1, 0), p(0.2, 0)), 'zero');
  assert.equal(sign(p(0, 0), p(1, 1), p(2, 2)), 'zero');
  assert.equal(sign(p(-0, 0), p(+0, 0), p(0, -0)), 'zero');
});

test('binary64 exact sign distinguishes a subnormal departure from collinearity', () => {
  assert.equal(sign(p(0, 0), p(1, 0), p(0, Number.MIN_VALUE)), 'positive');
  assert.equal(sign(p(0, 0), p(1, 0), p(0, -Number.MIN_VALUE)), 'negative');
  assert.equal(sign(p(0, 0), p(1, 0), p(0, 0)), 'zero');
  // Decimal-only subtraction would erase this significant input offset.
  const a = p(10000, 10000), b = p(10000 - Number.EPSILON, 10000);
  assert.equal(sign(a, b, p(0, 0)), 'zero', 'rounded inputs are judged, not intended operands');
});

test('exact sign is antisymmetric and translation invariant for representable integer offsets', () => {
  for (const offset of [-9000, -17, 0, 17, 9000]) {
    const a = p(offset, offset), b = p(offset + 3, offset + 1),
      c = p(offset + 1, offset + 4);
    assert.equal(sign(a, b, c), 'positive');
    assert.equal(sign(b, a, c), 'negative');
    assert.equal(sign(b, c, a), 'positive');
  }
});

test('rejects invalid coordinates, foreign records and getter inputs without invocation', () => {
  assert.deepEqual(orient(null, p(0, 0), p(1, 1)), { status: 'unsupported', reason: 'invalid-input' });
  assert.deepEqual(orient(p(Infinity, 0), p(0, 0), p(1, 1)), { status: 'unsupported', reason: 'non-finite-coordinate' });
  assert.deepEqual(orient(p(10001, 0), p(0, 0), p(1, 1)), { status: 'unsupported', reason: 'out-of-range-coordinate' });
  assert.equal(orient(p(0, 0), p(1, 0), p(0, 1), 0).status, 'unsupported');
  assert.equal(orient(p(0, 0), p(1, 0), p(0, 1), 10001).status, 'unsupported');
  let reads = 0;
  const hostile = { y: 0 };
  Object.defineProperty(hostile, 'x', { enumerable: true, get() { reads++; return 0; } });
  assert.equal(orient(hostile, p(0, 0), p(1, 1)).status, 'unsupported');
  assert.equal(reads, 0);
  assert.equal(orient(Object.assign(Object.create({ inherited: true }), { x: 0, y: 0 }), p(1, 0), p(0, 1)).status, 'unsupported');
  assert.equal(orient({ x: 0, y: 0, [Symbol('extra')]: true }, p(1, 0), p(0, 1)).status, 'unsupported');
});
