import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';

const pose = (x = 0, y = 0, scaleX = 1) => ({ x, y, scaleX, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('HitAreaProbe');
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(20, 20, -1),
  pivot: { x: 2, y: 0 }, imageId: 'Atlas', width: 4, height: 4, opacity: 1,
  sampling: 'nearest', anchorX: 0.5, anchorY: 0.5 });
tree.stage.addChild(sprite);
assert.equal(tree.snapshot().version, 16);
assert.equal(sprite.data.hitArea, undefined);
const area = { x: -4, y: -4, width: 8, height: 8 };
sprite.setHitArea(area); area.x = 100;
assert.deepEqual(sprite.data.hitArea, { x: -4, y: -4, width: 8, height: 8 });
const copy = sprite.data; copy.hitArea.x = 100;
assert.equal(sprite.data.hitArea.x, -4);
assert.deepEqual(sprite.toWorld({ x: -4, y: -4 }), { x: 26, y: 16 });
assert.deepEqual(sprite.toLocal({ x: 26, y: 16 }), { x: -4, y: -4 });
sprite.setSourceRect({ x: 0, y: 0, width: 2, height: 2 });
assert.deepEqual(sprite.data.hitArea, { x: -4, y: -4, width: 8, height: 8 });
sprite.setTile({ width: 2, height: 2, offsetX: 0, offsetY: 0 });
assert.deepEqual(sprite.data.hitArea, { x: -4, y: -4, width: 8, height: 8 });
const accepted = stringifySceneJSON(tree.snapshot());
for (const bad of [null, {}, { x: 0, y: 0, width: 0, height: 1 },
  { x: 0, y: 0, width: -0, height: 1 }, { x: -0, y: 0, width: 1, height: 1 },
  { x: 0, y: 0, width: 1, height: Infinity }, { x: 0, y: 0, width: 1, height: 1000001 },
  { x: 0, y: 0, width: 1, height: 1, extra: true }]) {
  if (bad === null) continue;
  assert.throws(() => sprite.setHitArea(bad), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}
const restored = createDisplayTreeFromScene(parseSceneJSON(accepted));
assert.equal(restored.snapshot().version, 16);
assert.equal(stringifySceneJSON(restored.snapshot()), accepted);
restored.get('Sprite').setHitArea(null);
assert.equal(restored.get('Sprite').data.hitArea, undefined);
const old = structuredClone(tree.snapshot()); old.version = 15;
assert.throws(() => stringifySceneJSON(old), error => error.code === 'INVALID_SCENE');
delete old.nodes[0].hitArea;
assert.equal(parseSceneJSON(JSON.stringify(old)).version, 15);
assert.equal(createDisplayTreeFromScene(old).snapshot().version, 16);
const nonimage = structuredClone(tree.snapshot());
nonimage.nodes[0].kind = 'rect'; nonimage.nodes[0].fill = [1, 0, 0, 1];
assert.throws(() => stringifySceneJSON(nonimage), error => error.code === 'INVALID_SCENE');
for (const version of Array.from({ length: 17 }, (_, index) => index)) {
  assert.equal(parseSceneJSON(JSON.stringify({ version, unit: 'logical-px', contextId: 'Empty', nodes: [] })).version, version);
}
console.log(JSON.stringify({ result: 'ok', sceneVersion: 16, oldVersions: 16,
  hitArea: sprite.data.hitArea, restoredHitArea: restored.get('Sprite').data.hitArea ?? null }));
