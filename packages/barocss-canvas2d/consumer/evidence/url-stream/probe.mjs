import assert from 'node:assert/strict';
const { loadImageURL: load, Canvas2DError } = await import(process.env.BAROCSS_URL_MODULE ?? '../../../dist/index.js');
const url = 'https://example.test/pixel.png?m=1';
const decodedBytes = [255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 128, 0, 255, 0, 255];
const cases = [], unhandled = [];
const onUnhandled = error => unhandled.push(String(error)); process.on('unhandledRejection', onUnhandled);
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function facility(settings = {}) {
  const controller = new AbortController(), events = [], listeners = new Set(), encoded = [];
  const counts = { fetch: 0, reader: 0, read: 0, cancel: 0, bodyCancel: 0, release: 0, add: 0, remove: 0, decode: 0, canvas: 0, bitmapClose: 0 };
  const add = controller.signal.addEventListener.bind(controller.signal), remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = (type, listener, options) => { assert.equal(type, 'abort'); assert.deepEqual(options, { once: true }); counts.add++; listeners.add(listener); add(type, listener, options); };
  controller.signal.removeEventListener = (type, listener) => { assert.equal(type, 'abort'); assert.ok(listeners.has(listener)); counts.remove++; listeners.delete(listener); remove(type, listener); };
  const readStarted = deferred();
  const reader = { read() {
    const index = counts.read++; events.push('read'); readStarted.resolve();
    const step = settings.steps?.[index] ?? { done: true };
    return typeof step === 'function' ? step() : Promise.resolve(step);
  }, cancel() {
    counts.cancel++; events.push('cancel'); settings.onCancel?.();
    if (settings.cancelMode === 'throw') throw new Error('cancel throw sentinel');
    if (settings.cancelMode === 'reject') return Promise.reject(new Error('cancel rejection sentinel'));
    return Promise.resolve();
  }, releaseLock() { counts.release++; events.push('release'); } };
  const body = { getReader() { counts.reader++; if (settings.readerThrow) throw new Error('reader sentinel'); return reader; }, cancel() {
    counts.bodyCancel++; events.push('bodyCancel');
    if (settings.bodyCancelMode === 'throw') throw new Error('body cancel throw sentinel');
    if (settings.bodyCancelMode === 'reject') return Promise.reject(new Error('body cancel rejection sentinel'));
    return Promise.resolve();
  } };
  const response = { ok: settings.ok ?? true, body, headers: { get(name) {
    if (name === 'content-type') return settings.mime ?? 'image/png; charset=binary';
    if (name === 'content-length') return settings.length ?? null;
    return null;
  } } };
  const fetcher = (input, options) => {
    counts.fetch++; events.push('fetch'); assert.equal(input, url);
    assert.deepEqual(options, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'follow', signal: controller.signal });
    if (settings.fetchThrow) throw new Error('fetch sentinel');
    return settings.fetchPromise ?? Promise.resolve(response);
  };
  globalThis.createImageBitmap = async blob => {
    counts.decode++; encoded.push(...new Uint8Array(await blob.arrayBuffer()));
    if (settings.decodeReject) throw new Error('decode sentinel');
    return { width: 2, height: 2, close() { counts.bitmapClose++; } };
  };
  const readback = new Uint8ClampedArray(decodedBytes);
  globalThis.document = { createElement() { counts.canvas++; return { width: 0, height: 0, getContext() {
    return { drawImage() {}, getImageData() { return { data: readback }; } };
  } }; } };
  return { controller, events, counts, reader, response, fetcher, readStarted, encoded, readback, listeners };
}
async function rejection(promise, code, message) {
  await assert.rejects(promise, error => code === 'AbortError'
    ? error.name === 'AbortError' && error.message === 'Image load aborted'
    : error instanceof Canvas2DError && error.code === code && error.message === message);
}
function clean(f) {
  assert.equal(f.counts.release, f.counts.reader ? 1 : 0);
  assert.equal(f.counts.add, f.counts.reader ? 1 : 0); assert.equal(f.counts.remove, f.counts.add); assert.equal(f.listeners.size, 0);
  const canceled = f.counts.cancel; f.controller.abort(); assert.equal(f.counts.cancel, canceled, 'late abort listener retained');
}
async function refuse(name, settings, code, message, readerCancel = 1, bodyCancel = 0) {
  const f = facility(settings); await rejection(load(url, { signal: f.controller.signal, fetcher: f.fetcher }), code, message); await turn();
  assert.equal(f.counts.cancel, readerCancel); assert.equal(f.counts.bodyCancel, bodyCancel); assert.equal(f.counts.decode, 0); clean(f);
  cases.push({ name, code, counts: f.counts, events: f.events });
}
const chunkA = new Uint8Array([1, 2]), chunkB = new Uint8Array([3, 4]);
const success = facility({ steps: [{ done: false, value: chunkA }, () => { chunkA.fill(9); return Promise.resolve({ done: false, value: chunkB }); },
  () => { chunkB.fill(9); return Promise.resolve({ done: true }); }] });
const output = await load(url, { signal: success.controller.signal, fetcher: success.fetcher });
assert.deepEqual(success.encoded, [1, 2, 3, 4]); assert.deepEqual([...output.pixels], decodedBytes);
success.readback.fill(0); assert.deepEqual([...output.pixels], decodedBytes);
assert.equal(success.counts.cancel, 0); assert.equal(success.counts.bodyCancel, 0); assert.equal(success.counts.decode, 1);
assert.equal(success.counts.bitmapClose, 1); clean(success); cases.push({ name: 'success EOF copied chunks and decoded RGBA', counts: success.counts, events: success.events });
for (const value of ['bad', {}, new Uint8ClampedArray(4), null]) await refuse('invalid chunk', { steps: [{ done: false, value }] }, 'INVALID_ASSET', 'image response chunk is invalid');
await refuse('read rejects', { steps: [() => Promise.reject(new Error('read sentinel'))] }, 'INVALID_ASSET', 'image response stream failed');
await refuse('read throws', { steps: [() => { throw new Error('read sentinel'); }] }, 'INVALID_ASSET', 'image response stream failed');
await refuse('overflow', { steps: [{ done: false, value: new Uint8Array(8 * 1048576) }, { done: false, value: new Uint8Array(1) }] }, 'ASSET_LIMIT', 'encoded image exceeds 8 MiB');
for (const cancelMode of ['reject', 'throw']) {
  await refuse('invalid chunk cancel ' + cancelMode, { steps: [{ done: false, value: 'bad' }], cancelMode }, 'INVALID_ASSET', 'image response chunk is invalid');
  await refuse('read failure cancel ' + cancelMode, { steps: [() => Promise.reject(new Error('read sentinel'))], cancelMode }, 'INVALID_ASSET', 'image response stream failed');
}
for (const cancelMode of ['ok', 'reject', 'throw']) {
  const blocked = deferred(), f = facility({ steps: [() => blocked.promise], cancelMode });
  const promise = load(url, { signal: f.controller.signal, fetcher: f.fetcher });
  await f.readStarted.promise; f.controller.abort(); blocked.resolve({ done: true });
  await rejection(promise, 'AbortError'); await turn();
  assert.equal(f.counts.cancel, 1); assert.equal(f.counts.decode, 0); clean(f);
  assert.ok(f.events.indexOf('cancel') < f.events.indexOf('release'));
  cases.push({ name: 'abort blocked read cancel ' + cancelMode, code: 'AbortError', counts: f.counts, events: f.events });
}
for (const bodyCancelMode of ['ok', 'reject', 'throw']) {
  const fetched = deferred(), f = facility({ fetchPromise: fetched.promise, bodyCancelMode });
  const promise = load(url, { signal: f.controller.signal, fetcher: f.fetcher });
  f.controller.abort(); fetched.resolve(f.response); await rejection(promise, 'AbortError'); await turn();
  assert.equal(f.counts.bodyCancel, 1); assert.equal(f.counts.reader, 0); assert.equal(f.counts.decode, 0); clean(f);
  cases.push({ name: 'late response body cancel ' + bodyCancelMode, code: 'AbortError', counts: f.counts, events: f.events });
}
await refuse('non-OK body cancel', { ok: false, bodyCancelMode: 'throw' }, 'INVALID_ASSET', 'image response is not OK', 0, 1);
await refuse('MIME refusal body cancel rejects', { mime: 'image/svg+xml', bodyCancelMode: 'reject' }, 'UNSUPPORTED_FEATURE', 'image response MIME type is unsupported', 0, 1);
await refuse('declared size refusal', { length: String(8 * 1048576 + 1) }, 'ASSET_LIMIT', 'encoded image exceeds 8 MiB', 0, 1);
const decoderFailure = facility({ steps: [{ done: false, value: new Uint8Array([1]) }, { done: true }], decodeReject: true });
await rejection(load(url, { signal: decoderFailure.controller.signal, fetcher: decoderFailure.fetcher }), 'INVALID_ASSET', 'browser could not decode image');
assert.equal(decoderFailure.counts.cancel, 0); assert.equal(decoderFailure.counts.bodyCancel, 0); assert.equal(decoderFailure.counts.decode, 1); clean(decoderFailure);
cases.push({ name: 'decoder failure after EOF does not cancel', code: 'INVALID_ASSET', counts: decoderFailure.counts, events: decoderFailure.events });
const preflight = facility();
for (const input of ['', ' https://example.test/pixel.png', 'ftp://example.test/pixel.png', 'https://user:secret@example.test/pixel.png']) {
  await assert.rejects(load(input, { signal: preflight.controller.signal, fetcher: preflight.fetcher }), error => error.code === 'INVALID_ASSET');
}
preflight.controller.abort(); await rejection(load(url, { signal: preflight.controller.signal, fetcher: preflight.fetcher }), 'AbortError');
assert.equal(preflight.counts.fetch, 0); assert.equal(preflight.counts.decode, 0);
await turn(); assert.deepEqual(unhandled, []); process.removeListener('unhandledRejection', onUnhandled);
delete globalThis.document; delete globalThis.createImageBitmap;
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_URL_MODULE ? 'source-bundle' : 'compiled-root',
  controlledStreams: true, cases: cases.length, preflightCases: 5, preflightFetchDecodeCalls: 0,
  exactCopiedEncodedBytes: success.encoded, exactCopiedDecodedRGBA: true, cancelAtMostOnce: true,
  lateBodyCancelRequested: true, normalEOFNoCancel: true, decoderFailureNoCancel: true,
  listenerAndLockRelease: true, refusalDecodeCalls0: true, originalErrorsRetained: true,
  cleanupRejectThrowSuppressed: true, unhandledRejections: unhandled.length, caseDetails: cases }, null, 2));
