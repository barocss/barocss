import assert from 'node:assert/strict';
import { createDisplayTree, createDisplayTreeFromScene, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';
import { anchorScene, anchorAsset } from './anchor-scene.mjs';

const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const tree = createDisplayTree('TintProbe');
const sprite = tree.createSprite({ id: 'Sprite', layer: 0, transform: pose,
  imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(sprite);
assert.deepEqual(sprite.data.tint, [1, 1, 1]);
for (const bad of [null, undefined, [1, 1], [1, NaN, 1]]) {
  assert.throws(() => tree.createSprite({ id: 'Bad', layer: 0, transform: pose,
    imageId: 'Atlas', width: 10, height: 10, opacity: 1, sampling: 'nearest',
    anchorX: 0, anchorY: 0, tint: bad }), error => error.code === 'INVALID_SCENE');
}
assert.equal(tree.snapshot().version, 17);
const tint = [0, 1, 1]; sprite.setTint(tint); tint[0] = 1;
assert.deepEqual(sprite.data.tint, [0, 1, 1]);
const data = sprite.data; data.tint[1] = 0;
assert.deepEqual(sprite.data.tint, [0, 1, 1]);
const before = stringifySceneJSON(tree.snapshot());
for (const invalid of [[], [1, 1], [1, 1, 1, 1], [1, -0, 1], [1, -0.1, 1], [1, 1.1, 1],
  [1, NaN, 1], [1, Infinity, 1], new Array(3),
  Object.assign([1, 1, 1], { extra: 1 }), { 0: 1, 1: 1, 2: 1, length: 3 }]) {
  assert.throws(() => sprite.setTint(invalid), error => error.code === 'INVALID_SCENE');
  assert.equal(stringifySceneJSON(tree.snapshot()), before);
}
assert.throws(() => sprite.setTint([1, 1, { valueOf() { throw new Error('coercion'); } }]),
  error => error.code === 'INVALID_SCENE');
const getter = [1, 1, 1]; Object.defineProperty(getter, 1, { get() { throw new Error('getter'); } });
assert.throws(() => sprite.setTint(getter), error => error.code === 'INVALID_SCENE');
assert.equal(stringifySceneJSON(tree.snapshot()), before);
const restored = createDisplayTreeFromScene(parseSceneJSON(before));
assert.deepEqual(restored.get('Sprite').data.tint, [0, 1, 1]);
restored.get('Sprite').setTint([0, 0, 0]);
assert.deepEqual(restored.get('Sprite').data.tint, [0, 0, 0]);
for (const version of [0, 1, 2, 3, 4, 5, 6]) {
  const scene = version >= 5 ? anchorScene(version) : { version, unit: 'logical-px', contextId: 'Legacy', nodes: [] };
  assert.equal(parseSceneJSON(stringifySceneJSON(scene)).version, version);
}
const legacy = anchorScene(6);
const legacyImage = legacy.nodes[0].children[0];
legacyImage.tint = [1, 0, 0];
assert.throws(() => stringifySceneJSON(legacy), error => error.code === 'INVALID_SCENE');
delete legacyImage.tint;
const upgraded = createDisplayTreeFromScene(legacy);
assert.equal(upgraded.snapshot().version, 17);
assert.deepEqual(upgraded.get(legacyImage.id).data.tint, [1, 1, 1]);
const missing = structuredClone(tree.snapshot()); delete missing.nodes[0].tint;
assert.throws(() => stringifySceneJSON(missing), error => error.code === 'INVALID_SCENE');
const documentText = await serializeCanvasDocument(tree.snapshot(), id => id === 'Atlas'
  ? { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) } : null);
const parsed = await parseCanvasDocument(documentText);
assert.equal(parsed.scene.version, 17);
assert.deepEqual(parsed.scene.nodes[0].tint, [0, 1, 1]);
const oldDocument = await serializeCanvasDocument(anchorScene(6), id => id === 'Anchor2' ? anchorAsset : null);
assert.equal((await parseCanvasDocument(oldDocument)).scene.version, 6);
console.log(JSON.stringify({ result: 'ok', sceneVersion: 17, legacyDocumentVersion: 6,
  tintedDocumentBytes: Buffer.byteLength(documentText) }));
