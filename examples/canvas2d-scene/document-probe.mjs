import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseCanvasDocument, serializeCanvasDocument } from '../../packages/barocss-canvas2d/dist/document.js';
import { initialSceneV4 } from './scene.mjs';
import { imageAssets } from './image-assets.mjs';

const assets = new Map(imageAssets);
const text = await serializeCanvasDocument(initialSceneV4, id => assets.get(id) ?? null);
const parsed = await parseCanvasDocument(text);
assert.equal(parsed.scene.version, 4);
assert.equal(parsed.scene.contextId, 'DesignBoard');
assert.deepEqual([...parsed.assets.keys()], ['Checker8', 'GlyphHI', 'RGBA2']);
for (const [id, original] of assets) assert.deepEqual(parsed.assets.get(id).pixels, original.pixels);
parsed.assets.get('GlyphHI').pixels[0] ^= 255;
assert.notEqual(parsed.assets.get('GlyphHI').pixels[0], assets.get('GlyphHI').pixels[0]);

const corrupt = JSON.parse(text);
corrupt.assets[1].sha256 = '0'.repeat(64);
await assert.rejects(parseCanvasDocument(JSON.stringify(corrupt)), error => error.code === 'INVALID_ASSET');
const missing = JSON.parse(text);
missing.assets.splice(1, 1);
await assert.rejects(parseCanvasDocument(JSON.stringify(missing)), error => error.code === 'INVALID_ASSET');
const unknown = JSON.parse(text);
unknown.version = 2;
await assert.rejects(parseCanvasDocument(JSON.stringify(unknown)), error => error.code === 'SERIALIZATION');
const extra = JSON.parse(text);
extra.assets[0].unexpected = true;
await assert.rejects(parseCanvasDocument(JSON.stringify(extra)), error => error.code === 'SERIALIZATION');
const swapped = JSON.parse(text);
[swapped.assets[0], swapped.assets[1]] = [swapped.assets[1], swapped.assets[0]];
await assert.rejects(parseCanvasDocument(JSON.stringify(swapped)), error => error.code === 'INVALID_ASSET');
const duplicate = JSON.parse(text);
duplicate.assets[1].id = duplicate.assets[0].id;
await assert.rejects(parseCanvasDocument(JSON.stringify(duplicate)), error => error.code === 'INVALID_ASSET');
const truncated = JSON.parse(text);
truncated.assets[0].pixelsBase64 = truncated.assets[0].pixelsBase64.slice(0, -4);
await assert.rejects(parseCanvasDocument(JSON.stringify(truncated)), error => error.code === 'INVALID_ASSET');
const unsupportedScene = JSON.parse(text);
unsupportedScene.scene = unsupportedScene.scene.replace('"version":4', '"version":99');
await assert.rejects(parseCanvasDocument(JSON.stringify(unsupportedScene)), error => error.code === 'INVALID_SCENE');

const evidence = fileURLToPath(new URL('./evidence/document-v1/', import.meta.url));
await mkdir(evidence, { recursive: true });
await Promise.all([
  writeFile(new URL('./evidence/document-v1/scene-and-assets.json', import.meta.url), text),
  writeFile(new URL('./evidence/document-v1/corrupt-digest.json', import.meta.url), JSON.stringify(corrupt)),
  writeFile(new URL('./evidence/document-v1/missing-atlas.json', import.meta.url), JSON.stringify(missing)),
]);
console.log(JSON.stringify({ result: 'ok', bytes: new TextEncoder().encode(text).length,
  assetIds: [...assets.keys()].sort(), refusals: ['digest', 'missing-atlas', 'version',
    'extra-field', 'asset-order', 'duplicate-id', 'truncated-base64', 'scene-version'] }));
