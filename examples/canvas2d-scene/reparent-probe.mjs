import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, rotation = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation });
const tree = createDisplayTree('Reparent');
const a = tree.createContainer({ id: 'A', layer: 0, transform: pose() });
const b = tree.createContainer({ id: 'B', layer: 0, transform: pose(100, 0) });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose(),
  width: 100, height: 100, fill: [0, 0, 0, 0], clip: false });
const rect = id => tree.createRect({ id, layer: 0, transform: pose(10, 10),
  width: 30, height: 30, fill: [1, 0, 0, 1] });
const moving = rect('Moving'), first = rect('First'), last = rect('Last');
tree.stage.addChild(a); tree.stage.addChild(b); tree.stage.addChild(frame);
a.addChild(moving); b.addChild(first); b.addChild(last);
const names = parent => parent.children.map(child => child.id);
const scene = () => stringifySceneJSON(tree.snapshot());
const events = [];
moving.onPointer('pointerdown', () => events.push('Moving'));
a.onPointer('pointerdown', () => events.push('A'));
b.onPointer('pointerdown', () => events.push('B'));
frame.onPointer('pointerdown', () => events.push('Frame'));
tree.stage.onPointer('pointerdown', () => events.push('stage'));
const original = moving;
const local = structuredClone(moving.data.transform);

tree.reparentChild(moving, b, 1);
assert.deepEqual(names(a), []);
assert.deepEqual(names(b), ['First', 'Moving', 'Last']);
assert.equal(tree.get('Moving'), original);
assert.deepEqual(moving.data.transform, local);
let copied = b.children;
copied.reverse();
assert.deepEqual(names(b), ['First', 'Moving', 'Last']);
tree.dispatchPointer({ type: 'pointerdown', pointerId: 1, point: { x: 110, y: 10 },
  hit: { id: 'Moving', kind: 'rect' } });
assert.deepEqual(events, ['Moving', 'B', 'stage']);

tree.reparentChild(moving, frame, 0);
assert.deepEqual(names(frame), ['Moving']);
events.length = 0;
tree.dispatchPointer({ type: 'pointerdown', pointerId: 2, point: { x: 10, y: 10 },
  hit: { id: 'Moving', kind: 'rect' } });
assert.deepEqual(events, ['Moving', 'Frame', 'stage']);
tree.reparentChild(moving, tree.stage, tree.stage.children.length);
assert.deepEqual(names(tree.stage), ['A', 'B', 'Frame', 'Moving']);
assert.deepEqual(names(frame), []);

const expected = scene();
const reject = (child, target, index, codes = ['INVALID_SCENE']) => {
  assert.throws(() => tree.reparentChild(child, target, index), error => codes.includes(error.code));
  assert.equal(scene(), expected);
};
const detached = rect('Detached');
const detachedParent = tree.createContainer({ id: 'DetachedParent', layer: 0, transform: pose() });
const other = createDisplayTree('Other');
const foreign = other.createRect({ id: 'Foreign', layer: 0, transform: pose(),
  width: 10, height: 10, fill: [0, 0, 1, 1] });
reject(moving, tree.stage, 0);
reject(detached, b, 0);
reject(foreign, b, 0);
reject(moving, detachedParent, 0);
reject(moving, other.stage, 0);
reject(moving, first, 0);
for (const index of [-1, -0, 0.5, NaN, Infinity, '0', 3]) reject(moving, b, index);
const nested = tree.createContainer({ id: 'Nested', layer: 0, transform: pose() });
a.addChild(nested);
const expectedWithNested = scene();
assert.throws(() => tree.reparentChild(a, nested, 0), error => error.code === 'INVALID_SCENE');
assert.equal(scene(), expectedWithNested);

const rotated = tree.createContainer({ id: 'Rotated', layer: 0, transform: pose(0, 0, 0.5) });
const clipped = tree.createFrame({ id: 'Clipped', layer: 0, transform: pose(),
  width: 20, height: 20, fill: [0, 0, 0, 0], clip: true });
tree.stage.addChild(rotated); tree.stage.addChild(clipped);
const beforeClip = scene();
assert.throws(() => tree.reparentChild(clipped, rotated, 0), error => error.code === 'INVALID_SCENE');
assert.equal(scene(), beforeClip);
assert.deepEqual(names(tree.stage).slice(-2), ['Rotated', 'Clipped']);

const restored = createDisplayTreeFromScene(tree.snapshot());
assert.equal(stringifySceneJSON(restored.snapshot()), beforeClip);
const restoredMoving = restored.get('Moving');
const restoredB = restored.get('B');
restored.reparentChild(restoredMoving, restoredB, 0);
assert.deepEqual(names(restoredB), ['Moving', 'First', 'Last']);
assert.equal(tree.get('Moving'), original);
console.log(JSON.stringify({ result: 'ok', refusals: 15, stage: names(tree.stage),
  restoredB: names(restoredB), pointer: events }));
