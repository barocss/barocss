import assert from 'node:assert/strict';
import { createPathBuilder } from '../../packages/barocss-canvas2d/dist/index.js';

const k = 4 * (Math.SQRT2 - 1) / 3;
const b = createPathBuilder().roundRect(10, 20, 80, 40, 10);
const commands = b.build();
assert.deepEqual(commands.map(command => command.kind), ['M', 'L', 'C', 'L', 'C', 'L', 'C', 'L', 'C', 'Z']);
assert.deepEqual(commands[0], { kind: 'M', x: 20, y: 20 });
assert.deepEqual(commands[1], { kind: 'L', x: 80, y: 20 });
assert.deepEqual(commands[2], { kind: 'C', c1x: 80 + 10 * k, c1y: 20,
  c2x: 90, c2y: 30 - 10 * k, x: 90, y: 30 });
assert.deepEqual(commands[4], { kind: 'C', c1x: 90, c1y: 50 + 10 * k,
  c2x: 80 + 10 * k, c2y: 60, x: 80, y: 60 });
assert.deepEqual(commands[6], { kind: 'C', c1x: 20 - 10 * k, c1y: 60,
  c2x: 10, c2y: 50 + 10 * k, x: 10, y: 50 });
assert.deepEqual(commands[8], { kind: 'C', c1x: 10, c1y: 30 - 10 * k,
  c2x: 20 - 10 * k, c2y: 20, x: 20, y: 20 });
commands[0].x = 500;
assert.equal(b.build()[0].x, 20);
assert.deepEqual(createPathBuilder().roundRect(0, 0, 20, 20, 10).build()[1],
  { kind: 'L', x: 10, y: 0 });
const chained = b.circle(120, 40, 5).build();
assert.equal(chained.length, 16);
b.clear().roundRect(0, 0, 10, 10, 2);
assert.equal(b.build().length, 10);

const prior = JSON.stringify(b.build());
const invalid = [
  () => b.roundRect(0, 0, 10, 10, 0),
  () => b.roundRect(0, 0, 10, 10, 6),
  () => b.roundRect(0, 0, -1, 10, 1),
  () => b.roundRect(0, 0, 10, NaN, 1),
  () => b.roundRect(-0, 0, 10, 10, 1),
  () => b.roundRect(0, 0, 10, 10, -0),
  () => b.roundRect(999999, 0, 10, 10, 1),
  () => b.roundRect(0, 999999, 10, 10, 1),
  () => b.roundRect(Infinity, 0, 10, 10, 1),
];
for (const call of invalid) {
  assert.throws(call, error => error.code === 'INVALID_SCENE');
  assert.equal(JSON.stringify(b.build()), prior);
}
const full = createPathBuilder();
for (let i = 0; i < 25; i++) full.roundRect(i * 20, 0, 10, 10, 2);
assert.equal(full.build().length, 250);
assert.throws(() => full.roundRect(500, 0, 10, 10, 2), error => error.code === 'SCENE_LIMIT');
assert.equal(full.build().length, 250);
console.log(JSON.stringify({ result: 'ok', commands: commands.length,
  refusals: invalid.length + 1 }));
