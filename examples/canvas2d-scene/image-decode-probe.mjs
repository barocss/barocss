import assert from 'node:assert/strict';
import { decodeImageBlob } from '../../packages/barocss-canvas2d/dist/index.js';

const png = new Blob([new Uint8Array([1])], { type: 'image/png' });
const reject = async (source, code) => assert.rejects(decodeImageBlob(source), error => error.code === code);
await reject(null, 'INVALID_ASSET');
await reject(new Blob([], { type: 'image/png' }), 'INVALID_ASSET');
await reject(new Blob([1], { type: 'image/svg+xml' }), 'UNSUPPORTED_FEATURE');
await reject(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/png' }), 'ASSET_LIMIT');
await reject(png, 'UNSUPPORTED_FEATURE');

const oldBitmap = globalThis.createImageBitmap;
const oldDocument = globalThis.document;
let closes = 0;
const bytes = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255]);
try {
  globalThis.document = { createElement() { return {
    width: 0, height: 0,
    getContext() { return { drawImage() {}, getImageData() { return { data: bytes }; } }; },
  }; } };
  globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() { closes++; } });
  const asset = await decodeImageBlob(png);
  assert.deepEqual([asset.width, asset.height], [2, 2]);
  assert.deepEqual([...asset.pixels], [...bytes]);
  bytes[0] = 0;
  assert.equal(asset.pixels[0], 255);
  assert.equal(closes, 1);

  globalThis.createImageBitmap = async () => ({ width: 4097, height: 1, close() { closes++; } });
  await reject(png, 'ASSET_LIMIT');
  assert.equal(closes, 2);
  globalThis.createImageBitmap = async () => ({ width: 4096, height: 2049, close() { closes++; } });
  await reject(png, 'ASSET_LIMIT');
  assert.equal(closes, 3);
  globalThis.createImageBitmap = async () => { throw new Error('bad PNG'); };
  await reject(png, 'INVALID_ASSET');
  assert.equal(closes, 3);
} finally {
  if (oldBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = oldBitmap;
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}
console.log(JSON.stringify({ result: 'ok', refusals: 8, bitmapCloses: closes,
  copiedRGBABytes: 16 }));
