import assert from 'node:assert/strict';
import { parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';
import { anchorAsset, anchorScene } from './anchor-scene.mjs';

const center = anchorScene();
const text = stringifySceneJSON(center);
assert.equal(parseSceneJSON(text).version, 6);
assert.equal(parseSceneJSON(text).nodes[0].children[0].anchorX, 0.5);
assert.equal(parseSceneJSON(text).nodes[0].children[0].anchorY, 0.5);
assert.equal(stringifySceneJSON(anchorScene(6, 0, 0)).includes('"anchorX":0,"anchorY":0'), true);
const cropped = anchorScene();
cropped.nodes[0].children[0].sourceRect = { x: 1, y: 0, width: 1, height: 2 };
assert.deepEqual(parseSceneJSON(stringifySceneJSON(cropped)).nodes[0].children[0].sourceRect,
  { x: 1, y: 0, width: 1, height: 2 });

const legacy = anchorScene(5);
const legacyText = stringifySceneJSON(legacy);
assert.equal(parseSceneJSON(legacyText).version, 5);
assert.equal(legacyText.includes('anchorX'), false);
const oldWithAnchor = structuredClone(legacy);
oldWithAnchor.nodes[0].children[0].anchorX = 0;
assert.throws(() => stringifySceneJSON(oldWithAnchor), error => error.code === 'INVALID_SCENE');

for (const key of ['anchorX', 'anchorY']) {
  const missing = structuredClone(center);
  delete missing.nodes[0].children[0][key];
  assert.throws(() => stringifySceneJSON(missing), error => error.code === 'INVALID_SCENE');
  for (const value of [-0, -0.1, 1.1, NaN, Infinity]) {
    const invalid = structuredClone(center);
    invalid.nodes[0].children[0][key] = value;
    assert.throws(() => stringifySceneJSON(invalid), error => error.code === 'INVALID_SCENE');
  }
}

const winding = anchorScene();
winding.nodes[0].children.push({ kind: 'path', id: 'Winding', layer: 2,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  commands: [{ kind: 'M', x: 180, y: 20 }, { kind: 'L', x: 200, y: 20 },
    { kind: 'L', x: 200, y: 40 }, { kind: 'L', x: 180, y: 40 }, { kind: 'Z' }],
  fill: { color: [0, 0, 0, 1], rule: 'nonzero' } });
assert.equal(parseSceneJSON(stringifySceneJSON(winding)).nodes[0].children[1].fill.rule, 'nonzero');

const documentText = await serializeCanvasDocument(center, id => id === 'Anchor2' ? anchorAsset : null);
const parsed = await parseCanvasDocument(documentText);
assert.equal(parsed.scene.version, 6);
assert.deepEqual([...parsed.assets.get('Anchor2').pixels], [...anchorAsset.pixels]);
console.log(JSON.stringify({ result: 'ok', sceneVersion: 6, legacyVersion: 5,
  invalidAnchors: 12, documentBytes: Buffer.byteLength(documentText), assetBytes: anchorAsset.pixels.byteLength }));
