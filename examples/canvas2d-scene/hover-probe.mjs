import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('HoverProbe');
const group = tree.createContainer({ id: 'Group', layer: 0, transform: pose });
const frame = tree.createFrame({ id: 'Frame', layer: 0, transform: pose,
  width: 20, height: 20, fill: [0, 0, 0, 0], clip: true });
const blue = tree.createRect({ id: 'Blue', layer: 1, transform: pose,
  width: 10, height: 10, fill: [0, 0, 1, 1] });
const red = tree.createRect({ id: 'Red', layer: 0, transform: pose,
  width: 10, height: 10, fill: [1, 0, 0, 1] });
tree.stage.addChild(group); group.addChild(frame); frame.addChild(blue); frame.addChild(red);
const point = { x: 4, y: 4 };
const hit = handle => ({ id: handle.id, kind: 'rect' });
const input = (pointerId, handle) => ({ pointerId, point, hit: handle ? hit(handle) : null });
const calls = [];
for (const handle of [group, frame, blue, red]) {
  for (const type of ['pointerenter', 'pointerleave']) {
    handle.onHover(type, event => {
      assert(Object.isFrozen(event));
      assert(Object.isFrozen(event.point));
      assert.equal(event.target, handle);
      assert.equal(event.currentTarget, handle);
      assert.equal('stopPropagation' in event, false);
      calls.push(`${event.pointerId}:${type}:${handle.id}`);
    });
  }
}
assert.equal('onHover' in tree.stage, false);
const before = stringifySceneJSON(tree.snapshot());
tree.dispatchHover(input(1, blue));
assert.deepEqual(calls, ['1:pointerenter:Group', '1:pointerenter:Frame', '1:pointerenter:Blue']);
tree.dispatchHover(input(1, blue));
assert.equal(calls.length, 3);
tree.dispatchHover(input(1, red));
assert.deepEqual(calls.slice(3), ['1:pointerleave:Blue', '1:pointerenter:Red']);
tree.dispatchHover(input(1, null));
assert.deepEqual(calls.slice(5), ['1:pointerleave:Red', '1:pointerleave:Frame', '1:pointerleave:Group']);
tree.dispatchHover(input(400, null));
assert.equal(calls.length, 8);
assert.equal(stringifySceneJSON(tree.snapshot()), before);

for (let pointerId = 0; pointerId < 16; pointerId++) tree.dispatchHover(input(pointerId, blue));
const count = calls.length;
assert.throws(() => tree.dispatchHover(input(16, blue)), error => error.code === 'SCENE_LIMIT');
assert.equal(calls.length, count);
tree.dispatchHover(input(0, null));
tree.dispatchHover(input(16, blue));

for (const bad of [null, {}, { ...input(17, blue), extra: true },
  { ...input(17, blue), pointerId: -0 }, { ...input(17, blue), pointerId: 1.5 },
  { ...input(17, blue), pointerId: Number.MAX_SAFE_INTEGER + 1 },
  { ...input(17, blue), point: { x: NaN, y: 4 } },
  { ...input(17, blue), hit: { id: 'Missing', kind: 'rect' } },
  { ...input(17, blue), hit: { id: 'Blue', kind: 'line' } }]) {
  assert.throws(() => tree.dispatchHover(bad), error => error.code === 'INVALID_SCENE');
}
assert.throws(() => blue.onHover('pointermove', () => {}), error => error.code === 'INVALID_SCENE');
assert.throws(() => blue.onHover('pointerenter', null), error => error.code === 'INVALID_SCENE');
const limited = tree.createRect({ id: 'Limited', layer: 0, transform: pose,
  width: 1, height: 1, fill: [0, 0, 0, 1] });
const removers = Array.from({ length: 32 }, () => limited.onHover('pointerenter', () => {}));
assert.throws(() => limited.onHover('pointerenter', () => {}), error => error.code === 'SCENE_LIMIT');
removers[0](); limited.onHover('pointerenter', () => {});
for (let pointerId = 0; pointerId <= 16; pointerId++) tree.dispatchHover(input(pointerId, null));

blue.setHitMode('none');
assert.throws(() => tree.dispatchHover(input(1, blue)), error => error.code === 'INVALID_SCENE');
blue.setHitMode('auto');
frame.setAlpha(0);
assert.throws(() => tree.dispatchHover(input(1, blue)), error => error.code === 'INVALID_SCENE');
frame.setAlpha(1);
group.setVisible(false);
assert.throws(() => tree.dispatchHover(input(1, blue)), error => error.code === 'INVALID_SCENE');
group.setVisible(true);

const unsub = blue.onHover('pointerenter', () => calls.push('unsubscribed'));
unsub(); unsub();
tree.dispatchHover(input(1, blue));
assert(!calls.includes('unsubscribed'));
frame.removeChild(blue);
assert.throws(() => tree.dispatchHover(input(1, blue)), error => error.code === 'INVALID_SCENE');
const cleared = calls.length;
tree.dispatchHover(input(1, null));
assert.equal(calls.length, cleared);
frame.addChild(blue);
tree.dispatchHover(input(1, blue));
assert.deepEqual(calls.slice(cleared), ['1:pointerenter:Group', '1:pointerenter:Frame', '1:pointerenter:Blue']);
const other = tree.createContainer({ id: 'Other', layer: 2, transform: pose });
tree.stage.addChild(other);
other.onHover('pointerenter', event => calls.push(`${event.pointerId}:pointerenter:Other`));
tree.reparentChild(blue, other, 0);
const moved = calls.length;
tree.dispatchHover(input(1, blue));
assert.deepEqual(calls.slice(moved), ['1:pointerenter:Other', '1:pointerenter:Blue']);

tree.dispatchHover(input(1, null));
const callbacks = [];
const off = blue.onHover('pointerenter', () => { callbacks.push('first'); off(); });
blue.onHover('pointerenter', () => callbacks.push('second'));
tree.dispatchHover(input(1, blue));
assert.deepEqual(callbacks, ['first', 'second']);
tree.dispatchHover(input(1, null));
tree.dispatchHover(input(1, blue));
assert.deepEqual(callbacks, ['first', 'second', 'second']);
tree.dispatchHover(input(1, null));
const changing = blue.onHover('pointerenter', () => tree.dispatchHover(input(2, red)));
tree.dispatchHover(input(1, blue));
assert(calls.includes('2:pointerenter:Red'));
changing();
tree.dispatchHover(input(1, null));
tree.dispatchHover(input(2, null));
const boom = blue.onHover('pointerenter', () => { throw new Error('boom'); });
assert.throws(() => tree.dispatchHover(input(1, blue)), /boom/);
boom();
const committed = calls.length;
tree.dispatchHover(input(1, blue));
assert.equal(calls.length, committed);
tree.dispatchHover(input(1, null));

const saved = tree.snapshot();
const restored = createDisplayTreeFromScene(saved);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(saved));
const oldCalls = calls.length;
restored.dispatchHover({ pointerId: 1, point, hit: hit(blue) });
assert.equal(calls.length, oldCalls);
console.log(JSON.stringify({ result: 'ok', sceneVersion: 11, routeCases: 16,
  calls: calls.length }));
