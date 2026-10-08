import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('ImageSource');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(5, 5) });
const sprite = tree.createSprite({ id: 'Sprite', layer: 1, transform: pose(20, 20),
  imageId: 'AtlasA', width: 80, height: 40, opacity: 0.75, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5, sourceRect: { x: 0, y: 0, width: 1, height: 1 } });
tree.stage.addChild(team); team.addChild(sprite);
const firstData = sprite.data;
firstData.sourceRect.x = 1;
assert.equal(sprite.data.sourceRect.x, 0);

const crop = { x: 1, y: 1, width: 1, height: 1 };
sprite.setImageSource('AtlasB', crop);
crop.x = 0;
assert.equal(sprite.data.imageId, 'AtlasB');
assert.deepEqual(sprite.data.sourceRect, { x: 1, y: 1, width: 1, height: 1 });
assert.equal(sprite.data.width, 80);
assert.equal(sprite.data.height, 40);
assert.equal(sprite.data.anchorX, 0.5);
assert.equal(sprite.data.opacity, 0.75);
assert.equal(sprite.data.transform.x, 20);
const detachedSnapshot = tree.snapshot();
detachedSnapshot.nodes[0].children[0].sourceRect.y = 0;
assert.equal(sprite.data.sourceRect.y, 1);
const accepted = stringifySceneJSON(tree.snapshot());
const bad = [
  ['', { x: 0, y: 0, width: 1, height: 1 }],
  ['bad id', { x: 0, y: 0, width: 1, height: 1 }],
  ['A'.repeat(65), { x: 0, y: 0, width: 1, height: 1 }],
  [123, null],
  [undefined, null],
  ['AtlasA', { x: -1, y: 0, width: 1, height: 1 }],
  ['AtlasA', { x: 0, y: 0, width: 0, height: 1 }],
  ['AtlasA', { x: -0, y: 0, width: 1, height: 1 }],
  ['AtlasA', { x: 0, y: 0, width: 1, height: NaN }],
  ['AtlasA', { x: 0, y: 0, width: 1, height: 1, extra: true }],
  ['AtlasA', { x: 0, y: 0, width: 1, get height() { throw new Error('getter ran'); } }],
  ['AtlasA', { x: 0, y: 0, width: 1 }],
];
for (const [id, nextCrop] of bad) {
  assert.throws(() => sprite.setImageSource(id, nextCrop), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
  assert.equal(sprite.data.imageId, 'AtlasB');
  assert.deepEqual(sprite.data.sourceRect, { x: 1, y: 1, width: 1, height: 1 });
}

sprite.setImageSource('AtlasA');
assert.equal(sprite.data.imageId, 'AtlasA');
assert.equal(Object.hasOwn(sprite.data, 'sourceRect'), false);
sprite.setImageSource('AtlasB', { x: 1, y: 0, width: 1, height: 1 });
const beforeReconstruction = tree.snapshot();
const restored = createDisplayTreeFromScene(beforeReconstruction);
const nextSprite = restored.get('Sprite');
assert.equal(nextSprite?.kind, 'sprite');
assert.notEqual(nextSprite, sprite);
assert.equal(stringifySceneJSON(restored.snapshot()), stringifySceneJSON(beforeReconstruction));
nextSprite.setImageSource('AtlasA', null);
assert.equal(nextSprite.data.imageId, 'AtlasA');
assert.equal(Object.hasOwn(nextSprite.data, 'sourceRect'), false);
assert.equal(sprite.data.imageId, 'AtlasB');
assert.equal(restored.stage.children[0].children[0], nextSprite);
console.log(JSON.stringify({ result: 'ok', refusals: bad.length,
  switched: sprite.data.imageId, restored: nextSprite.data.imageId, clearedCrop: true }));
