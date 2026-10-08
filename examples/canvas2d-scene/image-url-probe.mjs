import assert from 'node:assert/strict';
import { loadImageURL } from '../../packages/barocss-canvas2d/dist/index.js';

const oldBitmap = globalThis.createImageBitmap;
const oldDocument = globalThis.document;
const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255]);
let closes = 0;
globalThis.createImageBitmap = async () => ({ width: 2, height: 2, close() { closes++; } });
globalThis.document = { createElement(name) {
  assert.equal(name, 'canvas');
  return { getContext(kind) {
    assert.equal(kind, '2d');
    return { drawImage() {}, getImageData() { return { data: rgba }; } };
  } };
} };

const url = 'https://example.test/rgba2.png';
const bytes = new Uint8Array([1, 2, 3, 4]);
const headers = { 'content-type': 'image/png; charset=binary' };
function streamed(chunks = [bytes], status = 200, extra = {}) {
  return new Response(new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(chunk);
    controller.close();
  } }), { status, headers: { ...headers, ...extra } });
}
async function code(promise, expected) {
  await assert.rejects(promise, error => error.code === expected);
}
async function abort(promise) {
  await assert.rejects(promise, error => error.name === 'AbortError');
}

try {
  let called = 0;
  const asset = await loadImageURL(url, { fetcher: async (requested, init) => {
    called++;
    assert.equal(requested, url);
    assert.deepEqual({ method: init.method, mode: init.mode, credentials: init.credentials,
      cache: init.cache, redirect: init.redirect },
      { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    return streamed([bytes.subarray(0, 2), bytes.subarray(2)], 200, { 'content-length': '4' });
  } });
  assert.equal(called, 1);
  assert.deepEqual([asset.width, asset.height, ...asset.pixels], [2, 2, ...rgba]);
  asset.pixels[0] = 0;
  assert.equal(rgba[0], 255);
  await loadImageURL(url, { fetcher: async () => streamed() });
  const acceptedCloses = closes;

  let refusals = 0;
  const refuse = async (promise, expected) => { await code(promise, expected); refusals++; assert.equal(closes, acceptedCloses); };
  await refuse(loadImageURL('/relative.png', { fetcher: async () => streamed() }), 'INVALID_ASSET');
  await refuse(loadImageURL('ftp://example.test/a.png', { fetcher: async () => streamed() }), 'INVALID_ASSET');
  await refuse(loadImageURL('https://user:pass@example.test/a.png', { fetcher: async () => streamed() }), 'INVALID_ASSET');
  await refuse(loadImageURL(url, { fetcher: async () => streamed(), extra: 1 }), 'INVALID_ASSET');
  await refuse(loadImageURL(url, { fetcher: async () => streamed([], 404) }), 'INVALID_ASSET');
  await refuse(loadImageURL(url, { fetcher: async () => streamed([bytes], 200, { 'content-type': 'text/html' }) }), 'UNSUPPORTED_FEATURE');
  await refuse(loadImageURL(url, { fetcher: async () => streamed([bytes], 200, { 'content-length': String(8 * 1024 * 1024 + 1) }) }), 'ASSET_LIMIT');
  await refuse(loadImageURL(url, { fetcher: async () => streamed([new Uint8Array(5 * 1024 * 1024),
    new Uint8Array(4 * 1024 * 1024)], 200, { 'content-length': '4' }) }), 'ASSET_LIMIT');
  await refuse(loadImageURL(url, { fetcher: async () => { throw new TypeError('network'); } }), 'INVALID_ASSET');
  await refuse(loadImageURL(url, { fetcher: async () => new Response(new ReadableStream({
    start(controller) { controller.error(new Error('stream')); },
  }), { status: 200, headers }) }), 'INVALID_ASSET');
  await refuse(loadImageURL(url, { fetcher: async () => new Response(null,
    { status: 204, headers }) }), 'UNSUPPORTED_FEATURE');
  await refuse(loadImageURL(url, { fetcher: async () => ({ ok: true, headers: new Headers(headers),
    body: { getReader() { throw new Error('locked'); } } }) }), 'INVALID_ASSET');

  let preAbortCalls = 0;
  const pre = new AbortController(); pre.abort();
  await abort(loadImageURL(url, { signal: pre.signal, fetcher: async () => { preAbortCalls++; return streamed(); } }));
  assert.equal(preAbortCalls, 0);
  let pulled;
  const readStarted = new Promise(resolve => { pulled = resolve; });
  let cancelled = false;
  const during = new AbortController();
  const pending = loadImageURL(url, { signal: during.signal, fetcher: async () =>
    new Response(new ReadableStream({ pull() { pulled(); }, cancel() { cancelled = true; } }),
      { status: 200, headers }) });
  await readStarted; during.abort(); await abort(pending);
  assert.equal(cancelled, true);
  const duringDecode = new AbortController();
  globalThis.createImageBitmap = async () => {
    duringDecode.abort();
    return { width: 2, height: 2, close() { closes++; } };
  };
  await abort(loadImageURL(url, { signal: duringDecode.signal, fetcher: async () => streamed() }));
  assert.equal(closes, acceptedCloses + 1);
  const failingDecode = new AbortController();
  globalThis.createImageBitmap = async () => { failingDecode.abort(); throw new Error('decode failed'); };
  await abort(loadImageURL(url, { signal: failingDecode.signal, fetcher: async () => streamed() }));
  console.log(JSON.stringify({ result: 'ok', fetchCalls: called, refusals,
    preAbortCalls, cancelled, bitmapCloses: closes, copiedBytes: rgba.length }));
} finally {
  if (oldBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = oldBitmap;
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
}
