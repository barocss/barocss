import assert from 'node:assert/strict';
import { Canvas2DError, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0, initialSceneV2, initialSceneV3 } from './scene.mjs';
import { imageAssets } from './image-assets.mjs';

const versions = [initialSceneV0, initialScene, initialSceneV2, initialSceneV3].map(scene => {
  const saved = stringifySceneJSON(scene);
  assert.equal(stringifySceneJSON(parseSceneJSON(saved)), saved);
  assert.equal(saved.includes('pixels'), false);
  return parseSceneJSON(saved).version;
});
assert.deepEqual(versions, [0, 1, 2, 3]);
assert.deepEqual(imageAssets.map(([id, asset]) => [id, asset.pixels.byteLength]),
  [['RGBA2', 16], ['Checker8', 256]]);
const image = initialSceneV3.nodes[0].children.at(-1);
assert.equal(image.kind, 'image');
assert.deepEqual(image.sourceRect, { x: 2, y: 1, width: 4, height: 5 });

function refuse(scene, code) {
  assert.throws(() => stringifySceneJSON(scene), error =>
    error instanceof Canvas2DError && error.code === code);
}
const oldVersion = structuredClone(initialSceneV3);
oldVersion.version = 2;
refuse(oldVersion, 'INVALID_SCENE');
const badCrop = structuredClone(initialSceneV3);
badCrop.nodes[0].children.at(-1).sourceRect.width = 1.5;
refuse(badCrop, 'INVALID_SCENE');
const hiddenField = structuredClone(initialSceneV3);
hiddenField.nodes[1].children.at(-1).url = 'https://example.invalid/image.png';
refuse(hiddenField, 'INVALID_SCENE');

console.log(JSON.stringify({ result: 'ok', versions, assets: imageAssets.length,
  refusals: ['old-version', 'fractional-crop', 'unknown-url-field'] }));
