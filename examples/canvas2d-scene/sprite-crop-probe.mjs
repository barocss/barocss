import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('SpriteCrop');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(20, 20),
  imageId: 'Atlas', width: 80, height: 80, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, sourceRect: { x: 0, y: 0, width: 1, height: 1 } });
tree.stage.addChild(team); team.addChild(sprite);
assert.deepEqual(sprite.data.sourceRect, { x: 0, y: 0, width: 1, height: 1 });
const firstData = sprite.data;
firstData.sourceRect.x = 1;
assert.equal(sprite.data.sourceRect.x, 0);
const firstSnapshot = tree.snapshot();
firstSnapshot.nodes[0].children[0].sourceRect.x = 1;
assert.equal(sprite.data.sourceRect.x, 0);

const green = { x: 1, y: 1, width: 1, height: 1 };
sprite.setSourceRect(green);
green.x = 0;
assert.deepEqual(sprite.data.sourceRect, { x: 1, y: 1, width: 1, height: 1 });
const accepted = stringifySceneJSON(tree.snapshot());
const invalid = [
  { x: -1, y: 0, width: 1, height: 1 },
  { x: 0, y: 0, width: 0, height: 1 },
  { x: 0.5, y: 0, width: 1, height: 1 },
  { x: -0, y: 0, width: 1, height: 1 },
  { x: 0, y: 0, width: 1, height: NaN },
  { x: 0, y: 0, width: 1, height: 1, extra: true },
  { x: 0, y: 0, width: 1, get height() { throw new Error('getter ran'); } },
  { x: 0, y: 0, width: 1 },
  undefined,
];
for (const crop of invalid) {
  assert.throws(() => sprite.setSourceRect(crop), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}

sprite.setSourceRect(null);
assert.equal(Object.hasOwn(sprite.data, 'sourceRect'), false);
assert.equal(Object.hasOwn(tree.snapshot().nodes[0].children[0], 'sourceRect'), false);
sprite.setSourceRect({ x: 0, y: 1, width: 1, height: 1 });
const beforeReconstruction = tree.snapshot();
const reconstructed = createDisplayTreeFromScene(beforeReconstruction);
const newSprite = reconstructed.get('Sprite');
assert.equal(newSprite?.kind, 'sprite');
assert.notEqual(newSprite, sprite);
assert.equal(stringifySceneJSON(reconstructed.snapshot()), stringifySceneJSON(beforeReconstruction));
newSprite.setSourceRect({ x: 1, y: 0, width: 1, height: 1 });
assert.deepEqual(newSprite.data.sourceRect, { x: 1, y: 0, width: 1, height: 1 });
assert.equal(sprite.data.sourceRect.y, 1);
assert.equal(newSprite.data.id, 'Sprite');
assert.equal(newSprite.data.imageId, 'Atlas');

console.log(JSON.stringify({ result: 'ok', refusals: invalid.length, copiedData: true,
  clearCrop: true, reconstructedCrop: newSprite.data.sourceRect }));
