import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('RectHandles');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const rect = tree.createRect({ id: 'Rect', layer: 0, transform: pose(20, 20),
  width: 80, height: 60, fill: [1, 0, 0, 1] });
tree.stage.addChild(team); team.addChild(rect);
assert.equal(tree.get('Rect'), rect);
const initial = tree.snapshot();
const original = stringifySceneJSON(initial);
const data = rect.data;
data.fill[0] = 0;
assert.deepEqual(rect.data.fill, [1, 0, 0, 1]);
initial.nodes[0].children[0].fill[0] = 0;
assert.equal(stringifySceneJSON(tree.snapshot()), original);
const events = [];
rect.onPointer('pointerdown', event => events.push(`rect:${event.target.id}`));
team.onPointer('pointerdown', event => events.push(`group:${event.currentTarget.id}`));
tree.stage.onPointer('pointerdown', () => events.push('stage'));
const input = { type: 'pointerdown', pointerId: 1, point: { x: 40, y: 40 }, hit: { id: 'Rect', kind: 'rect' } };
tree.dispatchPointer(input);
assert.deepEqual(events, ['rect:Rect', 'group:Team', 'stage']);
events.length = 0;
const refusals = [
  () => rect.setRect({ width: 0, height: 60, fill: [1, 0, 0, 1] }),
  () => rect.setRect({ width: 1000001, height: 60, fill: [1, 0, 0, 1] }),
  () => rect.setRect({ width: 20, height: 60, fill: [2, 0, 0, 1] }),
  () => rect.setRect({ width: 20, height: 60, fill: [1, 0, 0, 1], extra: 1 }),
  () => tree.createRect({ id: 'Bad', layer: 0, transform: pose(), width: -1, height: 10, fill: [1, 1, 1, 1] }),
  () => team.addChild(tree.createRect({ ...rect.data, id: 'Rect' })),
  () => tree.dispatchPointer({ ...input, hit: { id: 'Rect', kind: 'image' } }),
  () => tree.dispatchPointer({ ...input, hit: { id: 'Gone', kind: 'rect' } }),
];
for (const refuse of refusals) {
  assert.throws(refuse, error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), original);
  assert.deepEqual(events, []);
}
team.removeChild(rect);
assert.equal(tree.get('Rect'), null);
assert.throws(() => tree.dispatchPointer(input), error => error.code === 'INVALID_SCENE');
team.addChild(rect);
assert.equal(stringifySceneJSON(tree.snapshot()), original);
rect.setRect({ width: 110, height: 60, fill: [0, 1, 0, 1] });
assert.deepEqual(rect.data.fill, [0, 1, 0, 1]);
assert.equal(rect.data.width, 110);
assert.equal(rect.data.id, 'Rect');
const changed = tree.snapshot();
const restored = createDisplayTreeFromScene(changed);
assert.notEqual(restored.get('Rect'), rect);
assert.equal(restored.get('Rect')?.kind, 'rect');
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(changed));
const old = structuredClone(changed); old.version = 5;
old.nodes[0].children.forEach(node => { delete node.visible; }); delete old.nodes[0].visible;
assert.throws(() => createDisplayTreeFromScene(old), error => error.code === 'UNSUPPORTED_FEATURE');
const unsupported = structuredClone(changed);
unsupported.nodes[0].children.push({ kind: 'line', id: 'Line', layer: 1, transform: pose(),
  x1: 0, y1: 0, x2: 10, y2: 0, width: 1, stroke: [1, 1, 1, 1], visible: true });
assert.equal(createDisplayTreeFromScene(unsupported).get('Line')?.kind, 'line');
console.log(JSON.stringify({ result: 'ok', refusals: refusals.length + 2,
  pointerRoute: ['Rect', 'Team', 'stage'], restoredWidth: restored.get('Rect')?.data.width }));
