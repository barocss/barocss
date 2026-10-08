import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON,
  stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const image = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 128]) };
const tree = createDisplayTree('BlendProbe');
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose,
  imageId: 'Atlas', width: 20, height: 20, opacity: 1,
  sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(sprite);
assert.equal(tree.snapshot().version, 11);
assert.equal(sprite.data.blendMode, 'normal');
sprite.setBlendMode('add');
assert.equal(sprite.data.blendMode, 'add');
const copy = sprite.data; copy.blendMode = 'normal';
assert.equal(sprite.data.blendMode, 'add');
const accepted = stringifySceneJSON(tree.snapshot());
for (const invalid of [null, undefined, 1, 'ADD', 'multiply', new String('normal'),
  { toString() { return 'add'; } }]) {
  assert.throws(() => sprite.setBlendMode(invalid), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), accepted);
}
for (const bad of [null, undefined, 'screen']) {
  assert.throws(() => tree.createSprite({ id: 'Invalid', layer: 1, transform: pose,
    imageId: 'Atlas', width: 20, height: 20, opacity: 1, sampling: 'nearest',
    anchorX: 0, anchorY: 0, blendMode: bad }), error => error.code === 'INVALID_SCENE');
}
const missing = structuredClone(tree.snapshot()); delete missing.nodes[0].blendMode;
assert.throws(() => stringifySceneJSON(missing), error => error.code === 'INVALID_SCENE');
const extra = structuredClone(tree.snapshot()); extra.nodes[0].extra = 1;
assert.throws(() => stringifySceneJSON(extra), error => error.code === 'INVALID_SCENE');
const restored = createDisplayTreeFromScene(parseSceneJSON(accepted));
assert.equal(restored.get('Sprite').data.blendMode, 'add');
restored.get('Sprite').setBlendMode('normal');
assert.equal(restored.get('Sprite').data.blendMode, 'normal');
assert.equal(sprite.data.blendMode, 'add');
const v7 = structuredClone(tree.snapshot()); v7.version = 7;
delete v7.nodes[0].blendMode; delete v7.nodes[0].visible; delete v7.nodes[0].alpha; delete v7.nodes[0].hitMode;
assert.equal(parseSceneJSON(stringifySceneJSON(v7)).version, 7);
assert.equal(createDisplayTreeFromScene(v7).get('Sprite').data.blendMode, 'normal');
const v6 = structuredClone(v7); v6.version = 6; delete v6.nodes[0].tint;
assert.equal(parseSceneJSON(stringifySceneJSON(v6)).version, 6);
const upgraded = createDisplayTreeFromScene(v6).get('Sprite');
assert.equal(upgraded.data.blendMode, 'normal');
assert.deepEqual(upgraded.data.tint, [1, 1, 1]);
for (const version of [0, 1, 2, 3, 4, 5]) {
  const old = { version, unit: 'logical-px', contextId: 'Old', nodes: [] };
  assert.equal(parseSceneJSON(stringifySceneJSON(old)).version, version);
}
const text = await serializeCanvasDocument(tree.snapshot(), id => id === 'Atlas' ? image : null);
const parsed = await parseCanvasDocument(text);
assert.equal(parsed.scene.version, 11);
assert.equal(parsed.scene.nodes[0].blendMode, 'add');
assert.deepEqual([...parsed.assets.get('Atlas').pixels], [...image.pixels]);
sprite.setBlendMode('normal');
assert.equal(sprite.data.blendMode, 'normal');
console.log(JSON.stringify({ result: 'ok', sceneVersion: 11, documentBytes: Buffer.byteLength(text) }));
