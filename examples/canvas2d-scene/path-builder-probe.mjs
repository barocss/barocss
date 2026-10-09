import assert from 'node:assert/strict';
import { createPathBuilder, createDisplayTree, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const rect = createPathBuilder().rect(10, 20, 30, 40);
const rectangle = rect.build();
assert.deepEqual(rectangle, [
  { kind: 'M', x: 10, y: 20 }, { kind: 'L', x: 40, y: 20 },
  { kind: 'L', x: 40, y: 60 }, { kind: 'L', x: 10, y: 60 }, { kind: 'Z' },
]);
rectangle[0].x = 999;
assert.equal(rect.build()[0].x, 10);
rect.clear().rect(0, 0, 5, 5);
assert.equal(rect.build()[1].x, 5);

const k = 4 * (Math.SQRT2 - 1) / 3;
const circle = createPathBuilder().circle(50, 60, 20).build();
assert.equal(circle.length, 6);
assert.deepEqual(circle[0], { kind: 'M', x: 70, y: 60 });
assert.deepEqual(circle[1], { kind: 'C', c1x: 70, c1y: 60 + 20 * k,
  c2x: 50 + 20 * k, c2y: 80, x: 50, y: 80 });
assert.deepEqual(circle[4], { kind: 'C', c1x: 50 + 20 * k, c1y: 40,
  c2x: 70, c2y: 60 - 20 * k, x: 70, y: 60 });
assert.deepEqual(circle[5], { kind: 'Z' });
const manual = createPathBuilder().moveTo(0, 0).lineTo(10, 0)
  .quadraticCurveTo(15, 5, 10, 10).bezierCurveTo(5, 15, 0, 15, 0, 10).closePath().build();
assert.deepEqual(manual.map(command => command.kind), ['M', 'L', 'Q', 'C', 'Z']);

const builder = createPathBuilder().rect(0, 0, 20, 20);
const before = JSON.stringify(builder.build());
const invalid = [
  () => builder.rect(0, 0, 0, 10),
  () => builder.rect(1e6, 0, 1, 10),
  () => builder.circle(0, 0, -1),
  () => builder.circle(1e6, 0, 2),
  () => builder.circle(0, 0, Number.NaN),
  () => builder.moveTo(-0, 0),
  () => builder.lineTo(Infinity, 0),
  () => builder.bezierCurveTo(0, 0, 0, 0, 1e6 + 1, 0),
  () => builder.closePath(),
];
for (const edit of invalid) {
  assert.throws(edit, error => error.code === 'INVALID_SCENE');
  assert.equal(JSON.stringify(builder.build()), before);
}
assert.throws(() => createPathBuilder().lineTo(1, 1), error => error.code === 'INVALID_SCENE');
assert.throws(() => createPathBuilder().closePath(), error => error.code === 'INVALID_SCENE');
assert.throws(() => createPathBuilder().build(), error => error.code === 'SCENE_LIMIT');
const empty = createPathBuilder().moveTo(1, 1);
assert.throws(() => empty.moveTo(2, 2), error => error.code === 'INVALID_SCENE');
assert.throws(() => empty.build(), error => error.code === 'SCENE_LIMIT');
const full = createPathBuilder();
for (let i = 0; i < 51; i++) full.rect(i * 10, 0, 5, 5);
assert.equal(full.build().length, 255);
assert.throws(() => full.rect(510, 0, 5, 5), error => error.code === 'SCENE_LIMIT');
assert.equal(full.build().length, 255);

const tree = createDisplayTree('BuiltShapes');
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
tree.stage.addChild(tree.createPath({ id: 'Rectangle', layer: 0, transform: pose,
  commands: rect.build(), fill: { color: [1, 0, 0, 1], rule: 'evenodd' } }));
tree.stage.addChild(tree.createPath({ id: 'Circle', layer: 1, transform: pose,
  commands: circle, fill: { color: [0, 0, 1, 1], rule: 'evenodd' } }));
const snapshot = tree.snapshot();
assert.deepEqual(snapshot.nodes.map(node => node.id), ['Rectangle', 'Circle']);
assert.equal(JSON.parse(stringifySceneJSON(snapshot)).version, 14);
console.log(JSON.stringify({ result: 'ok', rectCommands: rectangle.length,
  circleCommands: circle.length, manualCommands: manual.length, refusals: invalid.length + 6 }));
