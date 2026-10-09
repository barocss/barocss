import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0 };
const image = { width: 2, height: 1, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 255, 255,
]) };
const tree = createDisplayTree('SamplingProbe');
const sprite = tree.createSprite({ id: 'Sprite', layer: 2, transform: pose,
  imageId: 'Atlas', width: 40, height: 20, opacity: 1, sampling: 'nearest',
  anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
tree.stage.addChild(sprite);
const sibling = tree.createSprite({ id: 'Sibling', layer: 3, transform: pose,
  imageId: 'Atlas', width: 20, height: 10, opacity: 1, sampling: 'linear',
  anchorX: 0, anchorY: 0, tint: [1, 1, 1] });
tree.stage.addChild(sibling);
assert.equal(sprite.data.sampling, 'nearest');
sprite.setSampling('linear');
assert.equal(sprite.data.sampling, 'linear');
assert.equal(tree.snapshot().nodes[0].sampling, 'linear');
assert.equal(sibling.data.sampling, 'linear');
const copied = sprite.data;
copied.sampling = 'nearest';
assert.equal(sprite.data.sampling, 'linear');
const accepted = stringifySceneJSON(tree.snapshot());
for (const invalid of [null, undefined, 1, 'LINEAR', 'cubic', new String('nearest'),
  { toString() { return 'linear'; } }]) {
  assert.throws(() => sprite.setSampling(invalid), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}
const reopened = createDisplayTreeFromScene(tree.snapshot());
assert.equal(reopened.get('Sprite').data.sampling, 'linear');
assert.deepEqual(reopened.get('Sprite').data.tint, [1, 1, 1]);
const text = await serializeCanvasDocument(tree.snapshot(), id => id === 'Atlas' ? image : null);
const document = await parseCanvasDocument(text);
assert.equal(document.scene.version, 14);
assert.equal(document.scene.nodes[0].sampling, 'linear');
assert.deepEqual([...document.assets.get('Atlas').pixels], [...image.pixels]);
const restored = createDisplayTreeFromScene(document.scene);
restored.get('Sprite').setSampling('nearest');
assert.equal(restored.get('Sprite').data.sampling, 'nearest');
assert.equal(sprite.data.sampling, 'linear');
sprite.setSampling('nearest');
assert.equal(tree.snapshot().nodes[0].sampling, 'nearest');
assert.equal(tree.snapshot().nodes[1].sampling, 'linear');
console.log(JSON.stringify({ result: 'ok', sceneVersion: 14,
  sampling: ['nearest', 'linear', 'nearest'], documentBytes: Buffer.byteLength(text) }));
