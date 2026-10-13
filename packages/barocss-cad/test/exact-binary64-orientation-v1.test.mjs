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

test('independent exact integer determinant oracle across bounded point triples', () => {
  const points = [];
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) points.push(p(x, y));
  let checked = 0;
  for (const a of points) for (const b of points) for (const c of points) {
    const det = (BigInt(b.x) - BigInt(a.x)) * (BigInt(c.y) - BigInt(a.y))
      - (BigInt(b.y) - BigInt(a.y)) * (BigInt(c.x) - BigInt(a.x));
    const expected = det > 0n ? 'positive' : det < 0n ? 'negative' : 'zero';
    assert.equal(sign(a, b, c), expected);
    checked++;
  }
  assert.equal(checked, 15625);
});

test('exact determinant uses captured own descriptors without Proxy get traps', () => {
  let propertyReads = 0;
  const guard = value => new Proxy(value, {
    get() {
      propertyReads++;
      throw new Error('unexpected host point property read');
    },
  });
  const a = guard(p(0, 0)), b = guard(p(0.1, 0)), c = guard(p(0, Number.MIN_VALUE));
  assert.deepEqual(orient(a, b, c), {
    status: 'exact', sign: 'positive', method: 'binary64-dyadic-bigint',
  });
  assert.equal(propertyReads, 0, 'binary64 determinant must use only previously admitted descriptor values');

  // Even if a Proxy would lie on get(), the descriptor-provided input wins.
  let forgedReads = 0;
  const forged = new Proxy(p(0, -1), {
    get() { forgedReads++; return 10000; },
  });
  assert.equal(orient(p(0, 0), p(1, 0), forged).sign, 'negative');
  assert.equal(forgedReads, 0);
});

test('hostile point reflection traps fail closed as unsupported input', () => {
  const blockedKeys = new Proxy(p(0, 0), {
    ownKeys() { throw new Error('hostile enumeration'); },
  });
  const blockedDescriptors = new Proxy(p(0, 0), {
    getOwnPropertyDescriptor() { throw new Error('hostile descriptor'); },
  });
  const blockedPrototype = new Proxy(p(0, 0), {
    getPrototypeOf() { throw new Error('hostile prototype'); },
  });
  for (const hostile of [blockedKeys, blockedDescriptors, blockedPrototype]) {
    assert.deepEqual(orient(hostile, p(1, 0), p(0, 1)), {
      status: 'unsupported', reason: 'invalid-input',
    });
  }
});
