import assert from 'node:assert/strict';
import { createPathBuilder } from '../../packages/barocss-canvas2d/dist/index.js';

const vertices = [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 60 },
  { x: 40, y: 60 }, { x: 40, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 60 }, { x: 10, y: 60 }];
const builder = createPathBuilder().polygon(vertices);
const commands = builder.build();
assert.equal(commands.length, vertices.length + 1);
assert.deepEqual(commands[0], { kind: 'M', x: 10, y: 10 });
assert.deepEqual(commands[1], { kind: 'L', x: 60, y: 10 });
assert.deepEqual(commands.at(-1), { kind: 'Z' });
vertices[0].x = 999; vertices.pop();
assert.equal(builder.build()[0].x, 10);
commands[1].x = 999;
assert.equal(builder.build()[1].x, 60);
const frozen = Object.freeze([Object.freeze({ x: 0, y: 0 }), Object.freeze({ x: 3, y: 0 }),
  Object.freeze({ x: 0, y: 3 })]);
assert.equal(createPathBuilder().polygon(frozen).build().length, 4);
const previous = JSON.stringify(builder.build());
const sparse = [{ x: 0, y: 0 }, , { x: 0, y: 1 }];
const extra = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]; extra.extra = true;
const symbol = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]; symbol[Symbol('extra')] = true;
const getter = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
Object.defineProperty(getter, '1', { enumerable: true, get() { throw new Error('getter ran'); } });
const foreign = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
Object.setPrototypeOf(foreign, Object.create(Array.prototype));
const invalid = [
  sparse, extra, symbol, getter, foreign,
  [], [{ x: 0, y: 0 }, { x: 1, y: 0 }],
  Array.from({ length: 129 }, (_, i) => ({ x: i, y: 0 })),
  [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 0 }],
  [{ x: -0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0, z: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: NaN, y: 0 }, { x: 0, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1e6 + 1, y: 0 }, { x: 0, y: 1 }],
];
for (const points of invalid) {
  assert.throws(() => builder.polygon(points), error => error.code === 'INVALID_SCENE');
  assert.equal(JSON.stringify(builder.build()), previous);
}
const full = createPathBuilder();
for (let i = 0; i < 64; i++) full.polygon([{ x: i * 10, y: 0 }, { x: i * 10 + 2, y: 0 }, { x: i * 10, y: 2 }]);
assert.equal(full.build().length, 256);
assert.throws(() => full.polygon(frozen), error => error.code === 'SCENE_LIMIT');
assert.equal(full.build().length, 256);
console.log(JSON.stringify({ result: 'ok', polygonCommands: commands.length, refusals: invalid.length + 1 }));
