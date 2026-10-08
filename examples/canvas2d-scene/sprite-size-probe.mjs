import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('SpriteSize');
const team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(10, 10) });
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(40, 40),
  imageId: 'Atlas', width: 40, height: 40, opacity: 0.75, sampling: 'nearest',
  anchorX: 0.5, anchorY: 0.5, sourceRect: { x: 0, y: 0, width: 2, height: 2 } });
tree.stage.addChild(team); team.addChild(sprite);
const original = sprite.data;
original.width = 1;
assert.equal(sprite.data.width, 40);
const snapshot = tree.snapshot();
snapshot.nodes[0].children[0].height = 1;
assert.equal(sprite.data.height, 40);

sprite.setSize(80.5, 20.25);
assert.equal(sprite.data.width, 80.5);
assert.equal(sprite.data.height, 20.25);
assert.equal(sprite.data.id, 'Sprite');
assert.equal(sprite.data.imageId, 'Atlas');
assert.deepEqual(sprite.data.sourceRect, { x: 0, y: 0, width: 2, height: 2 });
assert.equal(sprite.data.anchorX, 0.5);
assert.equal(sprite.data.opacity, 0.75);
assert.equal(sprite.data.sampling, 'nearest');
assert.equal(sprite.data.transform.x, 40);
const accepted = stringifySceneJSON(tree.snapshot());
const invalid = [
  [0, 20], [-0, 20], [-1, 20], [NaN, 20], [Infinity, 20], [1_000_001, 20],
  ['80', 20], [20, 0], [20, -0], [20, -1], [20, NaN], [20, Infinity],
  [20, 1_000_001], [20, '20'], [20, undefined],
];
for (const [width, height] of invalid) {
  assert.throws(() => sprite.setSize(width, height), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
  assert.equal(sprite.data.width, 80.5);
  assert.equal(sprite.data.height, 20.25);
}

const restored = createDisplayTreeFromScene(tree.snapshot());
const newSprite = restored.get('Sprite');
assert.equal(newSprite?.kind, 'sprite');
assert.notEqual(newSprite, sprite);
assert.equal(stringifySceneJSON(restored.snapshot()), accepted);
newSprite.setSize(32, 64);
assert.equal(newSprite.data.width, 32);
assert.equal(newSprite.data.height, 64);
assert.equal(sprite.data.width, 80.5);
assert.equal(restored.stage.children[0].children[0], newSprite);
console.log(JSON.stringify({ result: 'ok', refusals: invalid.length,
  fractional: [sprite.data.width, sprite.data.height], reconstructed: [newSprite.data.width, newSprite.data.height] }));
