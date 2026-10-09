import assert from 'node:assert/strict';
import { createPathBuilder } from '../../packages/barocss-canvas2d/dist/index.js';

const quarter = createPathBuilder().arc(50, 40, 20, 0, Math.PI / 2);
const commands = quarter.build();
assert.equal(commands.length, 2);
assert.deepEqual(commands[0], { kind: 'M', x: 70, y: 40 });
assert.equal(commands[1].kind, 'C');
assert.ok(Math.abs(commands[1].x - 50) < 1e-12);
assert.equal(commands[1].y, 60);
assert.ok(commands[1].c1y > 40 && commands[1].c2x > 50);
const reverse = createPathBuilder().arc(50, 40, 20, 0, -Math.PI / 2).build();
assert.equal(reverse.length, 2);
assert.ok(reverse[1].y < 40 && reverse[1].c1y < 40);
assert.equal(createPathBuilder().arc(0, 0, 10, 0, 2 * Math.PI).build().length, 5);
assert.equal(createPathBuilder().arc(0, 0, 10, 0, -2 * Math.PI).build().length, 5);
assert.equal(createPathBuilder().arc(0, 0, 10, 0, Math.PI / 2).lineTo(0, 0).closePath().build().length, 4);
const first = JSON.stringify(quarter.build());
commands[0].x = 999;
assert.equal(JSON.stringify(quarter.build()), first);
for (const call of [
  () => quarter.arc(0, 0, 0, 0, 1),
  () => quarter.arc(0, 0, -1, 0, 1),
  () => quarter.arc(-0, 0, 1, 0, 1),
  () => quarter.arc(0, 0, 1, -0, 1),
  () => quarter.arc(0, 0, 1, 0, -0),
  () => quarter.arc(0, 0, 1, 0, 0),
  () => quarter.arc(0, 0, 1, 2 * Math.PI + 0.01, 1),
  () => quarter.arc(0, 0, 1, 0, 2 * Math.PI + 0.01),
  () => quarter.arc(1e6, 0, 1, 0, 1),
  () => quarter.arc(0, 0, 1, NaN, 1),
  () => quarter.arc(0, 0, 1, 0, Infinity),
]) {
  assert.throws(call, error => error.code === 'INVALID_SCENE');
  assert.equal(JSON.stringify(quarter.build()), first);
}
const full = createPathBuilder();
for (let i = 0; i < 51; i++) full.arc(10 * i, 0, 2, 0, 2 * Math.PI);
assert.equal(full.build().length, 255);
assert.throws(() => full.arc(520, 0, 2, 0, 2 * Math.PI), error => error.code === 'SCENE_LIMIT');
assert.equal(full.build().length, 255);
console.log(JSON.stringify({ result: 'ok', quarterCommands: 2, refusals: 12 }));
