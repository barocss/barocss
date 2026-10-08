import assert from 'node:assert/strict';
import { createPathBuilder } from '../../packages/barocss-canvas2d/dist/index.js';

const k = 4 * (Math.SQRT2 - 1) / 3;
const builder = createPathBuilder().ellipse(60, 45, 40, 20);
const commands = builder.build();
assert.deepEqual(commands, [
  { kind: 'M', x: 100, y: 45 },
  { kind: 'C', c1x: 100, c1y: 45 + 20 * k, c2x: 60 + 40 * k, c2y: 65, x: 60, y: 65 },
  { kind: 'C', c1x: 60 - 40 * k, c1y: 65, c2x: 20, c2y: 45 + 20 * k, x: 20, y: 45 },
  { kind: 'C', c1x: 20, c1y: 45 - 20 * k, c2x: 60 - 40 * k, c2y: 25, x: 60, y: 25 },
  { kind: 'C', c1x: 60 + 40 * k, c1y: 25, c2x: 100, c2y: 45 - 20 * k, x: 100, y: 45 },
  { kind: 'Z' },
]);
assert.deepEqual(createPathBuilder().ellipse(5, 10, 3, 3).build(),
  createPathBuilder().circle(5, 10, 3).build());
commands[0].x = 999;
assert.equal(builder.build()[0].x, 100);
assert.equal(builder.roundRect(0, 0, 10, 10, 2).build().length, 16);
builder.clear().ellipse(0, 0, 5, 2);
assert.equal(builder.build().length, 6);

const prior = JSON.stringify(builder.build());
const invalid = [
  () => builder.ellipse(0, 0, 0, 1),
  () => builder.ellipse(0, 0, 1, 0),
  () => builder.ellipse(0, 0, -1, 1),
  () => builder.ellipse(0, 0, 1, NaN),
  () => builder.ellipse(-0, 0, 1, 1),
  () => builder.ellipse(0, 0, 1, -0),
  () => builder.ellipse(1e6, 0, 1, 1),
  () => builder.ellipse(0, -1e6, 1, 1),
  () => builder.ellipse(Infinity, 0, 1, 1),
];
for (const call of invalid) {
  assert.throws(call, error => error.code === 'INVALID_SCENE');
  assert.equal(JSON.stringify(builder.build()), prior);
}
const full = createPathBuilder();
for (let i = 0; i < 42; i++) full.ellipse(i * 10, 0, 2, 1);
assert.equal(full.build().length, 252);
assert.throws(() => full.ellipse(420, 0, 2, 1), error => error.code === 'SCENE_LIMIT');
assert.equal(full.build().length, 252);
console.log(JSON.stringify({ result: 'ok', commands: commands.length, refusals: invalid.length + 1 }));
