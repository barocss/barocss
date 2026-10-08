import assert from 'node:assert/strict';
import { createDisplayTree, createSpriteAnimation, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('SpriteAnimation');
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose,
  imageId: 'AtlasA', width: 20, height: 20, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0 });
tree.stage.addChild(sprite);
const frames = [
  { imageId: 'AtlasA', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 40 },
  { imageId: 'AtlasB', durationMS: 60 },
  { imageId: 'AtlasB', sourceRect: { x: 1, y: 0, width: 1, height: 1 }, durationMS: 20 },
];
const animation = createSpriteAnimation(sprite, frames);
assert.equal(animation.frameIndex, 0);
assert.equal(animation.playing, false);
assert.deepEqual(sprite.data.sourceRect, frames[0].sourceRect);
const initial = stringifySceneJSON(tree.snapshot());
frames[0].sourceRect.x = 2;
frames[1].imageId = 'Changed';
assert.equal(animation.advance(40), false);
assert.equal(stringifySceneJSON(tree.snapshot()), initial);
animation.play();
assert.equal(animation.advance(39), false);
assert.equal(animation.frameIndex, 0);
assert.equal(animation.advance(1), true);
assert.equal(animation.frameIndex, 1);
assert.equal(sprite.data.imageId, 'AtlasB');
assert.equal(sprite.data.sourceRect, undefined);
assert.equal(animation.advance(80), true);
assert.equal(animation.frameIndex, 0);
assert.deepEqual(sprite.data.sourceRect, { x: 0, y: 0, width: 1, height: 1 });
animation.seek(2);
assert.equal(animation.playing, true);
assert.equal(animation.advance(20), true);
assert.equal(animation.frameIndex, 0);
animation.pause();
assert.equal(animation.advance(1000), false);
assert.equal(animation.frameIndex, 0);
const beforeRefusal = stringifySceneJSON(tree.snapshot());
for (const delta of [-1, -0, NaN, Infinity, 1001, '1']) {
  assert.throws(() => animation.advance(delta), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), beforeRefusal);
  assert.equal(animation.frameIndex, 0);
}
for (const index of [-1, -0, 0.5, 3, NaN, '1']) {
  assert.throws(() => animation.seek(index), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), beforeRefusal);
}

const cases = [
  [], new Array(2), Array.from({ length: 65 }, () => ({ imageId: 'A', durationMS: 1 })),
  [{ imageId: 'Bad id', durationMS: 1 }], [{ imageId: 'A', durationMS: 0 }],
  [{ imageId: 'A', durationMS: 1.5 }], [{ imageId: 'A', durationMS: 60001 }],
  [{ imageId: 'A', durationMS: 1, extra: 1 }],
  [{ imageId: 'A', durationMS: 1, sourceRect: { x: -0, y: 0, width: 1, height: 1 } }],
  [{ imageId: 'A', durationMS: 1, sourceRect: { x: 0, y: 0, width: 0, height: 1 } }],
  [{ imageId: 'A', durationMS: 1, sourceRect: undefined }],
  [{ imageId: 'A', get durationMS() { throw new Error('getter ran'); } }],
];
for (const candidate of cases) {
  assert.throws(() => createSpriteAnimation(sprite, candidate), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), beforeRefusal);
}
for (const options of [{ loop: 1 }, { initialFrameIndex: 3 }, { initialFrameIndex: -0 }, { extra: 1 }]) {
  assert.throws(() => createSpriteAnimation(sprite, [{ imageId: 'A', durationMS: 1 }], options),
    error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), beforeRefusal);
}

const oneShot = createSpriteAnimation(sprite, [
  { imageId: 'AtlasA', durationMS: 40 }, { imageId: 'AtlasB', durationMS: 60 },
  { imageId: 'AtlasB', sourceRect: { x: 1, y: 0, width: 1, height: 1 }, durationMS: 20 },
], { loop: false, initialFrameIndex: 1 });
assert.equal(oneShot.frameIndex, 1);
oneShot.play();
assert.equal(oneShot.advance(60), true);
assert.equal(oneShot.frameIndex, 2);
assert.equal(oneShot.advance(20), false);
assert.equal(oneShot.playing, false);
assert.equal(oneShot.finished, true);
oneShot.play();
assert.equal(oneShot.playing, false);
oneShot.seek(0);
assert.equal(oneShot.finished, false);
oneShot.play();
assert.equal(oneShot.advance(40), true);
assert.equal(oneShot.frameIndex, 1);
oneShot.dispose(); oneShot.dispose();
for (const action of [() => oneShot.play(), () => oneShot.pause(),
  () => oneShot.seek(0), () => oneShot.advance(1)]) {
  assert.throws(action, error => error.code === 'DISPOSED');
}

let selected = 'A';
const fake = { kind: 'sprite', setImageSource(id) {
  if (id === 'B') throw new Error('refused source');
  selected = id;
} };
const refused = createSpriteAnimation(fake, [
  { imageId: 'A', durationMS: 10 }, { imageId: 'B', durationMS: 10 },
]);
refused.play();
assert.throws(() => refused.advance(10), /refused source/);
assert.equal(refused.frameIndex, 0);
assert.equal(refused.playing, true);
assert.equal(selected, 'A');
refused.dispose();
animation.dispose();
console.log(JSON.stringify({ result: 'ok', invalidFrames: cases.length,
  invalidOptions: 4, invalidDeltas: 6, invalidSeeks: 6,
  oneShotFinished: oneShot.finished, sceneVersion: tree.snapshot().version }));
