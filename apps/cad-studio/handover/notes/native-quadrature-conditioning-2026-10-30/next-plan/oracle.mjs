// Source-only D345 design oracle. NOT_RUN. No CAD imports.
// Integer reference-point membership; exact rational stock-minus-disjoint-prism moments.
import assert from 'node:assert/strict';
const outer = [[4, 4], [52, 4], [52, 36], [4, 36]];
const holes = [[[20, 16], [34, 16], [34, 30], [20, 30]], [[42, 6], [46, 6], [44, 10]]];
function classify(ring, input) {
  const [x, y] = input.map(BigInt); let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i].map(BigInt), [bx, by] = ring[(i + 1) % ring.length].map(BigInt);
    const side = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (side === 0n && x >= (ax < bx ? ax : bx) && x <= (ax > bx ? ax : bx) && y >= (ay < by ? ay : by) && y <= (ay > by ? ay : by)) return 'boundary';
    if ((ay > y) !== (by > y) && (by > ay ? side > 0n : side < 0n)) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
function cells(sy, masked = holes) {
  const result = [[0, 0]]; // Original CUT is unconditional, including when its reference is inside a hole.
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    if (i === 0 && j === 0) continue;
    const p = [8 + 12 * i, 8 + sy * j];
    if (classify(outer, p) !== 'outside' && masked.every(hole => classify(hole, p) === 'outside')) result.push([i, j]);
  }
  return result;
}
function fraction(n, d) {
  let a = n < 0n ? -n : n, b = d;
  while (b) { const next = a % b; a = b; b = next; }
  return { n: String(n / a), d: String(d / a) };
}
function material(accepted, sy) {
  const volume = 24000n - 150n * BigInt(accepted.length); let twiceX = 0n, twiceY = 0n;
  for (const [i, j] of accepted) { twiceX += 17n + 24n * BigInt(i); twiceY += 17n + 2n * BigInt(sy * j); }
  return { volume: String(volume), centroid: [fraction(1440000n - 150n * twiceX, 2n * volume), fraction(960000n - 150n * twiceY, 2n * volume), fraction(5n, 1n)],
    suffixes: accepted.map(([i, j]) => i === 0 && j === 0 ? '' : `@${i},${j}`) };
}
const initial = cells(10), spaced = cells(12);
assert.deepEqual(initial, [[0, 0], [1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [3, 2]]);
assert.deepEqual(spaced, [[0, 0], [1, 0], [2, 0], [0, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]]);
assert.equal(classify(holes[0], [20, 18]), 'boundary'); assert.equal(classify(holes[0], [32, 18]), 'inside'); assert.equal(classify(holes[1], [44, 8]), 'inside');
assert.deepEqual(material(initial, 10).centroid, [{ n: '9265', d: '306' }, { n: '6161', d: '306' }, { n: '5', d: '1' }]);
assert.deepEqual(material(spaced, 12).centroid, [{ n: '9159', d: '302' }, { n: '6007', d: '302' }, { n: '5', d: '1' }]);
const seedHole = [[6, 6], [10, 6], [10, 10], [6, 10]];
assert.equal(classify(seedHole, [8, 8]), 'inside'); assert.deepEqual(cells(10, [...holes, seedHole]), initial);
console.log(JSON.stringify({ status: 'DESIGN_ORACLE', initial: { cells: initial, ...material(initial, 10) }, spaced: { cells: spaced, ...material(spaced, 12) } }, null, 2));
