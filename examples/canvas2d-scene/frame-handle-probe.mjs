import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, rotation = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation });
const tree = createDisplayTree('FrameProbe');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose() });
const frame = tree.createFrame({ id: 'Window', layer: 0, transform: pose(20, 20),
  width: 60, height: 60, fill: [1, 0, 0, 1], clip: true });
const overhang = tree.createRect({ id: 'Overhang', layer: 1, transform: pose(40, 20),
  width: 40, height: 40, fill: [0, 0, 1, 1] });
const inner = tree.createContainer({ id: 'Inner', layer: 2, transform: pose(5, 5) });
const dot = tree.createRect({ id: 'Dot', layer: 0, transform: pose(),
  width: 5, height: 5, fill: [0, 1, 0, 1] });
tree.stage.addChild(team); team.addChild(frame); frame.addChild(overhang); frame.addChild(inner); inner.addChild(dot);
assert.deepEqual(frame.children.map(handle => handle.id), ['Overhang', 'Inner']);
const first = stringifySceneJSON(tree.snapshot());
const copy = frame.data;
copy.fill[0] = 0;
assert.equal(stringifySceneJSON(tree.snapshot()), first);
for (const bad of [
  { width: 0, height: 60, fill: [1, 0, 0, 1], clip: true },
  { width: 60, height: 60, fill: [1, 0, 0, 1], clip: 'true' },
  { width: 60, height: 60, fill: [1, 0, 0, 1], clip: true, extra: 1 },
]) {
  assert.throws(() => frame.setFrame(bad), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), first);
}
assert.throws(() => frame.setTransform(pose(20, 20, 0.2)), error => error.code === 'INVALID_SCENE');
assert.throws(() => team.setTransform(pose(0, 0, 0.2)), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), first);
const duplicate = tree.createRect({ ...dot.data, id: 'Overhang' });
assert.throws(() => frame.addChild(duplicate), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), first);
const route = [];
frame.onPointer('pointerdown', event => route.push(`frame:${event.target.id}`));
team.onPointer('pointerdown', () => route.push('team'));
tree.stage.onPointer('pointerdown', () => route.push('stage'));
tree.dispatchPointer({ type: 'pointerdown', pointerId: 2, point: { x: 30, y: 30 },
  hit: { id: 'Window', kind: 'frame' } });
assert.deepEqual(route, ['frame:Window', 'team', 'stage']);
const stale = tree.createFrame({ ...frame.data, id: 'Stale' });
team.addChild(stale); team.removeChild(stale);
assert.throws(() => tree.dispatchPointer({ type: 'pointerdown', pointerId: 2, point: { x: 30, y: 30 },
  hit: { id: 'Stale', kind: 'frame' } }), error => error.code === 'INVALID_SCENE');
assert.equal(route.length, 3);
const restored = createDisplayTreeFromScene(tree.snapshot());
const restoredFrame = restored.get('Window');
assert.equal(restoredFrame.kind, 'frame');
assert.deepEqual(restoredFrame.children.map(handle => handle.id), ['Overhang', 'Inner']);
assert.equal(stringifySceneJSON(restored.snapshot()), first);
restoredFrame.setFrame({ width: 80, height: 60, fill: [1, 0, 0, 1], clip: false });
restoredFrame.setTransform(pose(20, 20, 0.2));
const rotatedUnclipped = stringifySceneJSON(restored.snapshot());
assert.throws(() => restoredFrame.setFrame({ width: 80, height: 60, fill: [1, 0, 0, 1], clip: true }),
  error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(restored.snapshot()), rotatedUnclipped);
assert.equal(restoredFrame.data.clip, false);
assert.equal(frame.data.clip, true);
console.log('frame-handle-probe: nested order, copied data, atomic refusal, pointer route and reconstruction passed');
