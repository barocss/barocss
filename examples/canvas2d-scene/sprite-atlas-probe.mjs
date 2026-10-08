import assert from 'node:assert/strict';
import { createSpriteAtlas, createSpriteAnimation, createDisplayTree, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const imageSize = { width: 3, height: 1 };
const entries = [
  { name: 'Red', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 40 },
  { name: 'Blue', sourceRect: { x: 1, y: 0, width: 1, height: 1 }, durationMS: 60 },
  { name: 'Clear', sourceRect: { x: 2, y: 0, width: 1, height: 1 }, durationMS: 20 },
];
const atlas = createSpriteAtlas('Atlas', imageSize, entries);
imageSize.width = 1; entries[0].sourceRect.x = 2;
assert.deepEqual(atlas.frame('Red'), { imageId: 'Atlas', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 40 });
const frame = atlas.frame('Red'); frame.sourceRect.x = 2;
assert.equal(atlas.frame('Red').sourceRect.x, 0);
const names = ['Blue', 'Red', 'Blue'];
const sequence = atlas.sequence(names); names[0] = 'Clear'; sequence[0].sourceRect.x = 2;
assert.deepEqual(atlas.sequence(['Blue', 'Red', 'Blue']).map(item => item.sourceRect.x), [1, 0, 1]);
for (const request of [[], new Array(1), ['Missing'], ['Bad name'], Array.from({ length: 65 }, () => 'Red')]) {
  assert.throws(() => atlas.sequence(request), error => error.code === 'INVALID_SCENE');
  assert.equal(atlas.frame('Red').sourceRect.x, 0);
}
assert.throws(() => atlas.frame('Missing'), error => error.code === 'INVALID_SCENE');
const cases = [
  ['Bad name', { width: 3, height: 1 }, entries],
  ['Atlas', { width: 0, height: 1 }, entries],
  ['Atlas', { width: 3, height: 1, extra: 1 }, entries],
  ['Atlas', { width: 3, get height() { throw new Error('getter ran'); } }, entries],
  ['Atlas', { width: 3, height: 1 }, []],
  ['Atlas', { width: 3, height: 1 }, new Array(1)],
  ['Atlas', { width: 3, height: 1 }, Array.from({ length: 65 }, (_, i) => ({ name: `F${i}`, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 1 }))],
  ['Atlas', { width: 3, height: 1 }, [entries[1], entries[1]]],
  ['Atlas', { width: 3, height: 1 }, [{ name: 'Bad name', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 1 }]],
  ['Atlas', { width: 3, height: 1 }, [{ name: 'Red', sourceRect: { x: 3, y: 0, width: 1, height: 1 }, durationMS: 1 }]],
  ['Atlas', { width: 3, height: 1 }, [{ name: 'Red', sourceRect: { x: -0, y: 0, width: 1, height: 1 }, durationMS: 1 }]],
  ['Atlas', { width: 3, height: 1 }, [{ name: 'Red', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 0 }]],
  ['Atlas', { width: 3, height: 1 }, [{ name: 'Red', sourceRect: { x: 0, y: 0, width: 1, height: 1 }, durationMS: 1, extra: 1 }]],
];
for (const args of cases) {
  assert.throws(() => createSpriteAtlas(...args), error => error.code === 'INVALID_ASSET');
  assert.equal(atlas.frame('Blue').sourceRect.x, 1);
}
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('AtlasProbe');
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose, imageId: 'Atlas', width: 20, height: 20,
  opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(sprite);
const animation = createSpriteAnimation(sprite, atlas.sequence(['Red', 'Blue', 'Clear']));
const before = stringifySceneJSON(tree.snapshot());
assert.throws(() => atlas.sequence(['Red', 'Unknown']), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), before);
animation.play(); assert.equal(animation.advance(40), true);
assert.deepEqual(sprite.data.sourceRect, { x: 1, y: 0, width: 1, height: 1 });
console.log('sprite atlas probe passed');
