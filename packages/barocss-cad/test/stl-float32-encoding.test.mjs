import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError, encodeBinaryStl } from '../dist/index.js';

const indices = [0, 1, 2];
const limit = 2 ** 24;
const bytesOf = (points, options) => encodeBinaryStl(points.flat(), indices, 'STL', options);
const valuesOf = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(bytes.length, 134);
  assert.equal(view.getUint32(80, true), 1);
  return Array.from({ length: 12 }, (_, i) => view.getFloat32(84 + i * 4, true));
};
const rejects = (points, code) => assert.throws(() => bytesOf(points), error =>
  error instanceof BarocssError && error.code === code && error.where === 'export' && /triangle 1/.test(error.message));

test('finite Float32 collapse is rejected for both signs and each world axis', () => {
  for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
    const point = (offset, other) => {
      const p = [0, 0, 0];
      p[axis] = sign * (limit + offset);
      p[(axis + 1) % 3] = other;
      return p;
    };
    rejects([point(0, 0), point(1, 0), point(0, 1)], 'STL_FLOAT32_COLLAPSE');
    const good = [point(-2, 0), point(-1, 0), point(-2, 1)];
    assert.deepEqual(valuesOf(bytesOf(good)).slice(3), good.flat());
  }
});

test('distinct encoded vertices can become collinear; source cross can underflow', () => {
  rejects([[limit, 0, 0], [limit + 0.25, 1, 0], [limit + 0.75, 2, 0]], 'STL_FLOAT32_COLLAPSE');
  rejects([[0, 0, 0], [Number.MIN_VALUE, 0, 0], [0, Number.MIN_VALUE, 0]], 'STL_FLOAT32_COLLAPSE');
});

test('exact area fallback admits nonzero recorded area even when subtraction rounds it to zero', () => {
  const x = 2 ** 100;
  const points = [[x, x, 0], [1 + 2 ** -30, 2, 0], [2, 3, 0]];
  let bytes;
  assert.doesNotThrow(() => { bytes = bytesOf(points); });
  const recorded = valuesOf(bytes).slice(3).map(BigInt);
  const [ax, ay, , bx, by, , cx, cy] = recorded;
  assert.equal((bx - ax) * (cy - ay) - (by - ay) * (cx - ax), -1n);
});

test('exact area fallback refuses collinear encoded points when binary64 subtraction reports a nonzero cross', () => {
  const L = 2 ** 100, x = 5 * 2 ** 44, delta = 2 ** 21;
  const points = [[L, 3 * L, 0], [0, 0, 0], [x, 3 * x + delta, 0]];
  const encoded = points.map(point => point.map(Math.fround));
  assert.deepEqual(encoded, [[L, 3 * L, 0], [0, 0, 0], [x, 3 * x, 0]]);
  const [[ax, ay], [bx, by], [cx, cy]] = encoded;
  assert.equal((bx - ax) * (cy - ay) - (by - ay) * (cx - ax), 2 ** 149);
  const determinant = ([[a, b], [c, d], [e, f]]) => (c - a) * (f - b) - (d - b) * (e - a);
  assert.equal(determinant(encoded.map(point => point.map(BigInt))), 0n);
  assert.equal(determinant(points.map(point => point.map(BigInt))), -(2n ** 121n));
  rejects(points, 'STL_FLOAT32_COLLAPSE');
});

test('legacy degenerate facets are retained and nonfinite Float32 coordinates are refused', () => {
  const points = [[0.1, 0, 0], [0.1, 0, 0], [1, 0, 0]];
  assert.deepEqual(valuesOf(bytesOf(points)).slice(0, 3), [0, 0, 0]);
  const finiteMax = Math.fround((2 - 2 ** -23) * 2 ** 127);
  assert.equal(valuesOf(bytesOf([[finiteMax, 0, 0], [finiteMax, 1, 0], [finiteMax, 0, 1]]))[3], finiteMax);
  const overflowTie = finiteMax + 2 ** 103;
  assert.equal(valuesOf(bytesOf([[overflowTie - 2 ** 75, 0, 0], [0, 1, 0], [0, 0, 1]]))[3], finiteMax);
  for (const value of [NaN, Infinity, -Infinity, overflowTie, -overflowTie, 2 ** 128, -(2 ** 128)]) {
    rejects([[value, 0, 0], [0, 1, 0], [0, 0, 1]], 'STL_FLOAT32_RANGE');
  }
});

test('split STL can retain its rounded-coordinate normal and byte policy', () => {
  const points = [[limit, 0, 0], [limit + 1, 1, 0], [limit, 0, 1]];
  const prior = bytesOf(points.map(point => point.map(Math.fround)));
  const actual = bytesOf(points, { normalsFromEncodedVertices: true });
  assert.deepEqual(actual, prior);
  assert.ok(valuesOf(bytesOf(points))[1] < 0);
  const [nx, ny, nz, ax, ay, az, bx, by, bz, cx, cy, cz] = valuesOf(actual);
  const cross = [
    (by - ay) * (cz - az) - (bz - az) * (cy - ay),
    (bz - az) * (cx - ax) - (bx - ax) * (cz - az),
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
  ];
  assert.ok(nx * cross[0] + ny * cross[1] + nz * cross[2] > 0);
});
