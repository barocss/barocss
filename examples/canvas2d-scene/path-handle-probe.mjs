import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const ring = (left, top, right, bottom) => [
  { kind: 'M', x: left, y: top }, { kind: 'L', x: right, y: top },
  { kind: 'L', x: right, y: bottom }, { kind: 'L', x: left, y: bottom }, { kind: 'Z' },
];
const filledCommands = [...ring(0, 0, 80, 80), ...ring(20, 20, 60, 60)];
const tree = createDisplayTree('PathHandles');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const filled = tree.createPath({ id: 'Filled', layer: 0, transform: pose(20, 20),
  commands: filledCommands, fill: { color: [1, 0, 0, 1], rule: 'evenodd' } });
const curve = tree.createPath({ id: 'Curve', layer: 1, transform: pose(110, 20),
  commands: [{ kind: 'M', x: 0, y: 30 }, { kind: 'C', c1x: 20, c1y: 0,
    c2x: 40, c2y: 60, x: 60, y: 30 }], stroke: { color: [0, 0, 1, 1], width: 6 } });
tree.stage.addChild(team); team.addChild(filled); team.addChild(curve);
const first = tree.snapshot();
assert.equal(first.version, 7);
assert.deepEqual(first.nodes[0].children.map(node => node.id), ['Filled', 'Curve']);
assert.equal(tree.get('Filled'), filled);
assert.equal(tree.get('Curve'), curve);
assert.notEqual(filled.data.commands, filledCommands);

const events = [];
filled.onPointer('pointerdown', event => events.push(`path:${event.target.id}`));
team.onPointer('pointerdown', event => events.push(`group:${event.currentTarget.id}`));
tree.stage.onPointer('pointerdown', () => events.push('stage'));
tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 50, y: 50 },
  hit: { id: 'Filled', kind: 'path' } });
assert.deepEqual(events, ['path:Filled', 'group:Team', 'stage']);
events.length = 0;
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 1,
  point: { x: 50, y: 50 }, hit: { id: 'Filled', kind: 'image' } }), error => error.code === 'INVALID_SCENE');
assert.deepEqual(events, []);

const original = stringifySceneJSON(first);
const refuse = [
  () => filled.setPath({ commands: filledCommands }),
  () => filled.setPath({ commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 10, y: 0 }],
    fill: { color: [1, 0, 0, 1], rule: 'evenodd' } }),
  () => filled.setPath({ commands: filledCommands, fill: { color: [1, 0, 0, 1], rule: 'evenodd' }, extra: 1 }),
  () => tree.createPath({ id: 'NoPaint', layer: 0, transform: pose(), commands: ring(0, 0, 10, 10) }),
  () => team.addChild(tree.createPath({ ...filled.data, id: 'Curve' })),
];
for (const edit of refuse) {
  assert.throws(edit, error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), original);
}
const crossing = [
  { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 80, y: 80 },
  { kind: 'L', x: 0, y: 80 }, { kind: 'L', x: 80, y: 0 }, { kind: 'Z' },
];
assert.throws(() => filled.setPath({ commands: crossing,
  fill: { color: [1, 0, 0, 1], rule: 'nonzero' } }), error => error.code === 'UNSUPPORTED_FEATURE');
assert.equal(stringifySceneJSON(tree.snapshot()), original);

filled.setPath({ commands: ring(0, 0, 40, 40), fill: { color: [0, 1, 0, 1], rule: 'evenodd' },
  stroke: { color: [0, 0, 1, 1], width: 2 } });
assert.deepEqual(filled.data.fill.color, [0, 1, 0, 1]);
assert.equal(filled.data.stroke.width, 2);
assert.equal(filled.data.id, 'Filled');
const changed = tree.snapshot();
const restored = createDisplayTreeFromScene(changed);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(changed));
assert.equal(restored.get('Filled')?.kind, 'path');
assert.equal(restored.get('Curve')?.kind, 'path');
assert.notEqual(restored.get('Filled'), filled);
assert.equal(stringifySceneJSON(first), original);

team.removeChild(curve);
assert.equal(tree.get('Curve'), null);
team.addChild(curve);
assert.equal(tree.get('Curve'), curve);
const oldScene = structuredClone(changed);
oldScene.version = 5;
for (const child of oldScene.nodes[0].children) {
  if (child.kind === 'image') { delete child.anchorX; delete child.anchorY; }
}
assert.throws(() => createDisplayTreeFromScene(oldScene), error => error.code === 'UNSUPPORTED_FEATURE');
const rectScene = structuredClone(changed);
rectScene.nodes[0].children.push({ kind: 'rect', id: 'Rect', layer: 2,
  transform: pose(), width: 10, height: 10, fill: [1, 1, 1, 1] });
assert.equal(createDisplayTreeFromScene(rectScene).get('Rect')?.kind, 'rect');

console.log(JSON.stringify({ result: 'ok', initialIds: first.nodes[0].children.map(node => node.id),
  restoredIds: restored.snapshot().nodes[0].children.map(node => node.id),
  refusals: refuse.length + 3, pointerRoute: ['Filled', 'Team', 'stage'] }));
