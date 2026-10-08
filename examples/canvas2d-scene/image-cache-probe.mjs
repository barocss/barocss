import assert from 'node:assert/strict';
import { createImageAssetCache } from '../../packages/barocss-canvas2d/dist/index.js';

const oldBitmap = globalThis.createImageBitmap;
const oldDocument = globalThis.document;
const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255]);
globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() {} });
globalThis.document = { createElement(name) {
  assert.equal(name, 'canvas');
  return { getContext(kind) {
    assert.equal(kind, '2d');
    return { drawImage() {}, getImageData() { return { data: pixels }; } };
  } };
} };

const root = 'https://example.test/';
const response = () => new Response(new ReadableStream({ start(controller) {
  controller.enqueue(new Uint8Array([1, 2, 3, 4])); controller.close();
} }), { headers: { 'content-type': 'image/png' } });
const expectCode = (work, code) => assert.throws(work, error => error.code === code);
const expectAsyncCode = (work, code) => assert.rejects(work, error => error.code === code);
const expectAbort = work => assert.rejects(work, error => error.name === 'AbortError');
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

try {
  const requests = [];
  const cache = createImageAssetCache({ maxEntries: 2, maxBytes: 32, fetcher: async (url, init) => {
    requests.push(url);
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    return response();
  } });
  const first = cache.load(`${root}a.png#one`);
  const second = cache.load(`${root}a.png#two`);
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(requests, [`${root}a.png`]);
  assert.notEqual(a.pixels, b.pixels);
  a.pixels[0] = 0;
  assert.equal(b.pixels[0], 255);
  assert.equal(cache.get(`${root}a.png`)?.pixels[0], 255);
  assert.equal(cache.size, 1);
  assert.equal(cache.byteLength, 16);
  await cache.load(`${root}a.png`);
  assert.equal(requests.length, 1);
  await cache.load(`${root}b.png?size=2`);
  cache.get(`${root}a.png`);
  await cache.load(`${root}c.png`);
  assert.equal(cache.get(`${root}b.png?size=2`), null);
  assert.equal(cache.size, 2);
  assert.equal(cache.byteLength, 32);
  assert.equal(cache.delete(`${root}a.png`), true);
  assert.equal(cache.delete(`${root}a.png`), false);
  assert.equal(cache.byteLength, 16);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.byteLength, 0);
  await cache.load(`${root}a.png?size=2`);
  assert.equal(requests.at(-1), `${root}a.png?size=2`);
  cache.clear();
  cache.dispose(); cache.dispose();
  expectCode(() => cache.get(`${root}a.png`), 'DISPOSED');
  expectCode(() => cache.size, 'DISPOSED');
  await expectAsyncCode(cache.load(`${root}a.png`), 'DISPOSED');

  expectCode(() => createImageAssetCache({ maxEntries: 0 }), 'INVALID_ASSET');
  expectCode(() => createImageAssetCache({ maxBytes: 32 * 1024 * 1024 + 1 }), 'INVALID_ASSET');
  expectCode(() => createImageAssetCache({ fetcher: 1 }), 'INVALID_ASSET');
  expectCode(() => createImageAssetCache({ extra: true }), 'INVALID_ASSET');
  expectCode(() => createImageAssetCache({ get maxEntries() { throw new Error('getter ran'); } }), 'INVALID_ASSET');
  const small = createImageAssetCache({ maxBytes: 15, fetcher: async () => response() });
  await expectAsyncCode(small.load(`${root}a.png`), 'ASSET_LIMIT');
  assert.equal(small.size, 0);
  await expectAsyncCode(small.load('/relative.png'), 'INVALID_ASSET');
  await expectAsyncCode(small.load('https://user:password@example.test/a.png'), 'INVALID_ASSET');
  small.dispose();

  let failB = false;
  const retained = createImageAssetCache({ maxEntries: 1, fetcher: async url => {
    if (url.endsWith('b.png') && failB) throw new Error('offline');
    return response();
  } });
  await retained.load(`${root}a.png`);
  failB = true;
  await expectAsyncCode(retained.load(`${root}b.png`), 'INVALID_ASSET');
  assert.equal(retained.get(`${root}a.png`)?.pixels[0], 255);
  assert.equal(retained.size, 1);
  retained.dispose();

  for (const action of ['delete', 'clear', 'dispose']) {
    const gate = deferred();
    let calls = 0;
    const pendingCache = createImageAssetCache({ fetcher: async () => { calls++; await gate.promise; return response(); } });
    const inFlight = pendingCache.load(`${root}slow.png`);
    await Promise.resolve();
    assert.equal(calls, 1);
    if (action === 'delete') assert.equal(pendingCache.delete(`${root}slow.png`), true);
    else pendingCache[action]();
    await expectAbort(inFlight);
    gate.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    if (action !== 'dispose') {
      assert.equal(pendingCache.size, 0);
      pendingCache.dispose();
    }
  }

  const capacityGate = deferred();
  const pendingLimit = createImageAssetCache({ maxEntries: 1, fetcher: async () => {
    await capacityGate.promise; return response();
  } });
  const occupying = pendingLimit.load(`${root}first.png`);
  await expectAsyncCode(pendingLimit.load(`${root}second.png`), 'ASSET_LIMIT');
  pendingLimit.clear();
  await expectAbort(occupying);
  capacityGate.resolve();
  pendingLimit.dispose();

  console.log(JSON.stringify({ result: 'ok', requests, copiedBytes: pixels.length,
    residentAndConcurrentDedupe: true, lruAndByteLimits: true, cancelledLateResults: 3,
    concurrentDistinctLimit: true }));
} finally {
  if (oldBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = oldBitmap;
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}
