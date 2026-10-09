import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('CaptureProbe');
const parent = tree.createContainer({ id: 'Parent', layer: 1, transform: pose });
const target = tree.createRect({ id: 'Target', layer: 1, transform: pose,
  width: 10, height: 10, fill: [1, 0, 0, 1] });
const other = tree.createRect({ id: 'Other', layer: 0, transform: pose,
  width: 10, height: 10, fill: [0, 0, 1, 1] });
tree.stage.addChild(parent); parent.addChild(target); tree.stage.addChild(other);
const hit = handle => ({ id: handle.id, kind: 'rect' });
const input = (type, pointerId, handle) => ({ type, pointerId,
  point: { x: 2, y: 2 }, hit: handle ? hit(handle) : null });
const calls = [];
for (const [name, handle] of [['Target', target], ['Parent', parent], ['Other', other], ['stage', tree.stage]]) {
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    handle.onPointer(type, event => calls.push(`${event.pointerId}:${event.type}:${event.target?.id ?? 'stage'}:${name}`));
  }
}
const scene = stringifySceneJSON(tree.snapshot());

tree.dispatchPointer(input('pointerdown', 1, target));
assert.deepEqual(calls, ['1:pointerdown:Target:Target', '1:pointerdown:Target:Parent', '1:pointerdown:Target:stage']);
tree.capturePointer(1, target);
assert.equal(tree.getPointerCapture(1), target);
tree.dispatchPointer(input('pointermove', 1, other));
tree.dispatchPointer(input('pointermove', 1, null));
assert.deepEqual(calls.slice(3), [
  '1:pointermove:Target:Target', '1:pointermove:Target:Parent', '1:pointermove:Target:stage',
  '1:pointermove:Target:Target', '1:pointermove:Target:Parent', '1:pointermove:Target:stage']);
tree.dispatchPointer(input('pointerup', 1, null));
assert.equal(tree.getPointerCapture(1), null);
tree.dispatchPointer(input('pointermove', 1, other));
assert.deepEqual(calls.slice(-2), ['1:pointermove:Other:Other', '1:pointermove:Other:stage']);

tree.capturePointer(2, target);
tree.capturePointer(3, other);
tree.dispatchPointer(input('pointercancel', 2, null));
assert.equal(tree.getPointerCapture(2), null);
assert.equal(tree.getPointerCapture(3), other);
tree.releasePointer(3); tree.releasePointer(3);
assert.equal(tree.getPointerCapture(3), null);

tree.capturePointer(4, target);
const newParent = tree.createContainer({ id: 'NewParent', layer: 2, transform: pose });
tree.stage.addChild(newParent);
newParent.onPointer('pointermove', event => calls.push(`${event.pointerId}:new-parent:${event.target?.id}`));
tree.reparentChild(target, newParent, 0);
tree.dispatchPointer(input('pointermove', 4, null));
assert(calls.includes('4:new-parent:Target'));
newParent.removeChild(target);
assert.equal(tree.getPointerCapture(4), null);
tree.stage.addChild(target);
tree.stage.removeChild(target);
parent.addChild(target);
tree.capturePointer(5, target);
tree.stage.removeChild(parent);
assert.equal(tree.getPointerCapture(5), null);
tree.stage.addChild(parent);

for (let id = 0; id < 16; id++) tree.capturePointer(id, target);
assert.throws(() => tree.capturePointer(16, target), error => error.code === 'SCENE_LIMIT');
tree.capturePointer(0, other);
assert.equal(tree.getPointerCapture(0), other);
tree.releasePointer(0);
tree.capturePointer(16, target);
for (let id = 1; id <= 16; id++) tree.releasePointer(id);

const foreign = createDisplayTree('Foreign').createRect({ id: 'Foreign', layer: 0, transform: pose,
  width: 1, height: 1, fill: [0, 0, 0, 1] });
const detached = tree.createRect({ id: 'Detached', layer: 0, transform: pose,
  width: 1, height: 1, fill: [0, 0, 0, 1] });
for (const handle of [foreign, detached, tree.stage]) {
  assert.throws(() => tree.capturePointer(20, handle), error => error.code === 'INVALID_SCENE');
}
for (const id of [-0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
  for (const method of ['capturePointer', 'releasePointer', 'getPointerCapture']) {
    assert.throws(() => method === 'capturePointer' ? tree.capturePointer(id, target) : tree[method](id),
      error => error.code === 'INVALID_SCENE');
  }
}
tree.capturePointer(21, target);
const count = calls.length;
assert.throws(() => tree.dispatchPointer(input('pointermove', 21, foreign)), error => error.code === 'INVALID_SCENE');
assert.equal(calls.length, count);
assert.equal(tree.getPointerCapture(21), target);
tree.releasePointer(21);

target.setVisible(false);
target.setAlpha(0);
target.setHitMode('none');
tree.capturePointer(22, target);
tree.dispatchPointer(input('pointermove', 22, null));
assert.equal(calls.at(-3), '22:pointermove:Target:Target');
tree.releasePointer(22);
target.setVisible(true); target.setAlpha(1); target.setHitMode('auto');

const boom = target.onPointer('pointerup', () => { throw new Error('listener failure'); });
tree.capturePointer(23, target);
assert.throws(() => tree.dispatchPointer(input('pointerup', 23, null)), /listener failure/);
assert.equal(tree.getPointerCapture(23), null);
boom();
const oldTreeCapture = target;
tree.capturePointer(24, oldTreeCapture);
const restored = createDisplayTreeFromScene(tree.snapshot());
assert.equal(restored.getPointerCapture(24), null);
assert.equal(stringifySceneJSON(tree.snapshot()), stringifySceneJSON(restored.snapshot()));
assert.notEqual(stringifySceneJSON(tree.snapshot()), scene);

console.log(JSON.stringify({ result: 'ok', sceneVersion: tree.snapshot().version,
  captureCases: 16, callbacks: calls.length }));
