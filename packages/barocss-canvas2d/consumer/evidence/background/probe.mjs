import assert from 'node:assert/strict';
import { createCanvas2D } from '../../../dist/index.js';
import { validateColor } from '../../../dist/schema.js';

const input = [0.5, 0.25, 0, 0.5];
const copied = validateColor(input);
input[0] = 1;
assert.deepEqual(copied, [0.5, 0.25, 0, 0.5]);
const accessor = [0, 0, 0, 1];
Object.defineProperty(accessor, '0', { get() { throw new Error('must not invoke'); }, enumerable: true });
const extra = [0, 0, 0, 1]; extra.foo = true;
const invalid = [undefined, null, 'blue', [0, 0, 0], [0, 0, 0, 1, 1],
  [0, , 0, 1], [NaN, 0, 0, 1], [Infinity, 0, 0, 1], [-0, 0, 0, 1],
  [0, 0, 0, -0.1], [1.1, 0, 0, 1], accessor, extra];
let allocations = 0;
const canvas = { width: 17, height: 19, addEventListener() {},
  getContext() { allocations++; throw new Error('GPU must not be touched'); } };
for (const backgroundColor of invalid) {
  assert.throws(() => createCanvas2D(canvas, {
    logicalSize: { width: 80, height: 50 }, dpr: 2, backgroundColor }), error => error?.code === 'INVALID_SCENE');
}
assert.equal(allocations, 0);
assert.deepEqual([canvas.width, canvas.height], [17, 19]);
assert.throws(() => createCanvas2D(canvas, { logicalSize: { width: 80, height: 50 },
  dpr: 2, unexpected: true }), error => error?.code === 'INVALID_SIZE');
console.log(JSON.stringify({ invalidColors: invalid.length, copiedColor: true,
  invalidBeforeAllocation: true, unchangedCanvasSize: true, unknownOption: true }));
