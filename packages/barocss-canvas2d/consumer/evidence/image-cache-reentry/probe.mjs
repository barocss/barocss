import assert from 'node:assert/strict';

// Actual public root only. An override must name a bundle of the current source.
// These platform fixtures exercise CPU control flow, not real PNG/browser/GPU decoding.
const moduleURL = process.env.BAROCSS_CACHE_MODULE ?? new URL('../../../dist/index.js', import.meta.url).href;
if (process.env.BAROCSS_CACHE_MODULE) assert.equal(new URL(moduleURL).protocol, 'file:');
const { createImageAssetCache, Canvas2DError } = await import(moduleURL);
assert.equal(typeof createImageAssetCache, 'function');

const ROOT = 'https://assets.example.test/';
const A = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0];
const B = [17, 34, 51, 255, 68, 85, 102, 255, 119, 136, 153, 255, 170, 187, 204, 255];
const ENCODED = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const LOAD_LIMIT = 48;
const EXPECTED_LOADS = 40;
const WATCHDOG_MS = 5000;
const counters = {
  loadCalls: 0, fetches: 0, responses: 0, readers: 0, reads: 0,
  readerCancels: 0, readerReleases: 0, bodyCancels: 0, manualBodyCancels: 0,
  decodeCalls: 0, bitmaps: 0, bitmapCloseAttempts: 0, bitmapCloseCompleted: 0,
  canvases: 0, scratchWidthZeroAttempts: 0, scratchWidthZeroCompleted: 0,
  scratchHeightZeros: 0, expectedBodyCancelRejections: 0,
  expectedReaderCancelRejections: 0, expectedReaderReleaseErrors: 0,
  expectedBitmapDecodeRejections: 0, expectedPixelReadErrors: 0,
};
const caches = [];
const gates = [];
const loads = [];
const responses = [];
const decodePlans = [];
const scratchPlans = [];
const ownedBitmaps = [];
const ownedCanvases = [];
const matrix = [];
const unhandled = [];
const onUnhandled = reason => { unhandled.push(reason); };
const previousListeners = process.listeners('unhandledRejection');
const globalKeys = ['createImageBitmap', 'document'];
const previousDescriptors = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));

function gate(label, fallback) {
  let resolve;
  let settled = false;
  const promise = new Promise(done => { resolve = done; });
  const result = { label, promise, resolve(value = fallback) {
    if (!settled) { settled = true; resolve(value); }
  } };
  gates.push(result);
  return result;
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`watchdog: ${label}`)), WATCHDOG_MS);
    })]);
  } finally { clearTimeout(timer); }
}
const turn = () => new Promise(resolve => setImmediate(resolve));
function load(cache, url) {
  assert.ok(++counters.loadCalls <= LOAD_LIMIT, 'bounded public cache.load budget');
  const promise = cache.load(url);
  // Attach both handlers in the same synchronous call as the public invocation.
  const outcome = promise.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
  const request = { promise, outcome };
  loads.push(request);
  return request;
}
async function value(request, label = 'load fulfillment') {
  const outcome = await bounded(request.outcome, label);
  assert.equal(outcome.status, 'fulfilled', `${label}: ${outcome.reason?.message ?? ''}`);
  return outcome.value;
}
async function error(request, label = 'load rejection') {
  const outcome = await bounded(request.outcome, label);
  assert.equal(outcome.status, 'rejected', label);
  return outcome.reason;
}
function code(reason, expected) {
  assert.ok(reason instanceof Canvas2DError);
  assert.equal(reason.code, expected);
}
async function sameAbort(first, second) {
  assert.notEqual(first.promise, second.promise, 'public async wrappers are distinct');
  const a = await error(first, 'outer cancellation');
  const b = await error(second, 'joined cancellation');
  assert.equal(a.name, 'AbortError');
  assert.equal(a, b, 'waiters share the exact cancellation object');
}
function asset(actual, pixels) {
  assert.equal(actual.width, 2);
  assert.equal(actual.height, 2);
  assert.ok(actual.pixels instanceof Uint8Array);
  assert.equal(actual.pixels.byteLength, 16);
  assert.deepEqual([...actual.pixels], pixels);
}
function resident(cache, url, pixels) {
  asset(cache.get(url), pixels);
  assert.equal(cache.size, 1);
  assert.equal(cache.byteLength, 16);
}
function empty(cache) {
  assert.equal(cache.size, 0);
  assert.equal(cache.byteLength, 0);
}
function makeCache(fetcher, options = {}) {
  const log = { urls: [], signals: [] };
  const cache = createImageAssetCache({ maxEntries: 1, maxBytes: 16, ...options, fetcher(url, init) {
    counters.fetches++;
    log.urls.push(url);
    log.signals.push(init.signal);
    assert.deepEqual({ method: init.method, mode: init.mode, credentials: init.credentials,
      cache: init.cache, redirect: init.redirect },
    { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    assert.ok(init.signal instanceof AbortSignal);
    return fetcher(url, init);
  } });
  caches.push(cache);
  return { cache, log };
}
function response(label, options = {}) {
  const local = { readers: 0, reads: 0, cancels: 0, releases: 0, bodyCancels: 0, manualCancels: 0 };
  const cancelled = gate(`${label}: body cancellation`);
  const stream = new ReadableStream({ start(controller) {
    if (options.readError) controller.error(options.readError);
    else { controller.enqueue(new Uint8Array(ENCODED)); controller.close(); }
  } });
  const result = new Response(stream, { headers: { 'content-type': 'image/png', 'content-length': '16' } });
  const body = result.body;
  const realGetReader = body.getReader.bind(body);
  const realCancel = body.cancel.bind(body);
  let manuallyCancelling = false;
  Object.defineProperty(body, 'cancel', { configurable: true, value() {
    local.bodyCancels++;
    if (manuallyCancelling) { local.manualCancels++; counters.manualBodyCancels++; }
    else counters.bodyCancels++;
    cancelled.resolve();
    const pending = realCancel();
    if (!options.bodyCancelError) return pending;
    counters.expectedBodyCancelRejections++;
    return pending.then(() => { throw options.bodyCancelError; }, () => { throw options.bodyCancelError; });
  } });
  Object.defineProperty(body, 'getReader', { configurable: true, value() {
    counters.readers++; local.readers++;
    const reader = realGetReader();
    const read = reader.read.bind(reader);
    const cancel = reader.cancel.bind(reader);
    const release = reader.releaseLock.bind(reader);
    reader.read = () => { counters.reads++; local.reads++; return read(); };
    reader.cancel = () => {
      counters.readerCancels++; local.cancels++;
      const pending = cancel();
      if (!options.readerCancelError) return pending;
      counters.expectedReaderCancelRejections++;
      return pending.then(() => { throw options.readerCancelError; }, () => { throw options.readerCancelError; });
    };
    reader.releaseLock = () => {
      counters.readerReleases++; local.releases++;
      release();
      if (options.releaseError) { counters.expectedReaderReleaseErrors++; throw options.releaseError; }
    };
    return reader;
  } });
  if (options.headerError) {
    Object.defineProperty(result.headers, 'get', { configurable: true, value() { throw options.headerError; } });
  }
  const item = { label, response: result, local, cancelled, async drain() {
    if (!local.readers && !local.bodyCancels) {
      manuallyCancelling = true;
      try { await body.cancel(); } catch { /* Deliberately failing boundary cleanup is recorded above. */ }
      finally { manuallyCancelling = false; }
    }
  } };
  responses.push(item);
  counters.responses++;
  return item;
}
function plan(options = {}) {
  const result = { pixels: A, ...options, started: gate('decode started'), closed: gate('bitmap closed') };
  decodePlans.push(result);
  return result;
}
async function scenario(name, work) {
  const before = { ...counters };
  await work();
  await turn();
  assert.deepEqual(unhandled, [], `${name}: no unhandled rejections`);
  matrix.push({ name, ...Object.fromEntries(Object.keys(counters).map(key => [key, counters[key] - before[key]])) });
}
function cancel(cache, action, url) {
  if (action === 'delete') assert.equal(cache.delete(url), true);
  else cache[action]();
}
function assertCancelledState(cache, action) {
  if (action === 'dispose') assert.throws(() => cache.size, reason => reason.code === 'DISPOSED');
  else empty(cache);
}

process.on('unhandledRejection', onUnhandled);
try {
  Object.defineProperty(globalThis, 'createImageBitmap', { configurable: true, writable: true, value: async blob => {
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'image/png');
    assert.equal(blob.size, 16);
    counters.decodeCalls++;
    const selected = decodePlans.shift();
    assert.ok(selected, 'each platform decode has an explicit fixture');
    selected.started.resolve();
    if (selected.wait) await selected.wait.promise;
    if (selected.bitmapError) { counters.expectedBitmapDecodeRejections++; throw selected.bitmapError; }
    counters.bitmaps++;
    scratchPlans.push(selected);
    const bitmap = { width: 2, height: 2, fixture: selected, closed: false, close() {
      counters.bitmapCloseAttempts++;
      assert.equal(bitmap.closed, false, 'bitmap closes exactly once');
      bitmap.closed = true;
      counters.bitmapCloseCompleted++;
      selected.closed.resolve();
    } };
    ownedBitmaps.push(bitmap);
    return bitmap;
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: {
    createElement(name) {
      assert.equal(name, 'canvas');
      counters.canvases++;
      const selected = scratchPlans.shift();
      assert.ok(selected);
      let width = 0; let height = 0; let drawn;
      const canvas = {
        get width() { return width; },
        set width(next) {
          if (next === 0) {
            counters.scratchWidthZeroAttempts++;
            counters.scratchWidthZeroCompleted++;
          }
          width = next;
        },
        get height() { return height; },
        set height(next) { if (next === 0) counters.scratchHeightZeros++; height = next; },
        getContext(kind, options) {
          assert.equal(kind, '2d');
          assert.deepEqual(options, { willReadFrequently: true });
          return {
            drawImage(bitmap, x, y) {
              assert.equal(bitmap.fixture, selected); assert.equal(x, 0); assert.equal(y, 0);
              drawn = bitmap;
            },
            getImageData(x, y, w, h) {
              assert.ok(drawn); assert.deepEqual([x, y, w, h], [0, 0, 2, 2]);
              assert.equal(width, 2); assert.equal(height, 2);
              if (selected.pixelError) { counters.expectedPixelReadErrors++; throw selected.pixelError; }
              return { data: new Uint8ClampedArray(selected.pixels) };
            },
          };
        },
      };
      ownedCanvases.push(canvas);
      return canvas;
    },
  } });

  await scenario('synchronous-same-key-reentry-and-full-capacity', async () => {
    const image = response('reentrant success');
    const release = gate('release reentrant response', image.response);
    const entered = gate('reentrant fetch entered');
    let nested; let refused; let reentered = false;
    const { cache, log } = makeCache(url => {
      assert.equal(url, `${ROOT}a.png`);
      if (!reentered) {
        reentered = true;
        nested = load(cache, `${ROOT}a.png#nested`);
        refused = load(cache, `${ROOT}other.png`);
      }
      entered.resolve();
      // Never return or await the nested same-key load: that would be a cycle.
      return release.promise;
    });
    plan();
    const outer = load(cache, 'HTTPS://ASSETS.EXAMPLE.TEST:443/icons/../a.png#outer');
    assert.equal(log.urls.length, 0, 'dispatch follows complete Pending publication');
    await bounded(entered.promise, 'fetch reentry');
    assert.notEqual(outer.promise, nested.promise);
    code(await error(refused), 'ASSET_LIMIT');
    assert.equal(log.urls.length, 1);
    assert.equal(image.local.readers, 0);
    release.resolve();
    const first = await value(outer);
    const second = await value(nested);
    asset(first, A); asset(second, A);
    assert.notEqual(first, second); assert.notEqual(first.pixels, second.pixels);
    assert.notEqual(first.pixels.buffer, second.pixels.buffer);
    first.pixels[0] = 0;
    asset(second, A); resident(cache, `${ROOT}a.png#resident`, A);
    const cached = await value(load(cache, `${ROOT}a.png#hit`));
    assert.notEqual(cached.pixels.buffer, second.pixels.buffer);
    cached.pixels[1] = 99;
    resident(cache, `${ROOT}a.png`, A);
    assert.deepEqual(log.urls, [`${ROOT}a.png`]);
  });

  for (const action of ['delete', 'clear', 'dispose']) {
    await scenario(`fetch-callback-${action}-cancels-reentrant-waiters`, async () => {
      const image = response(`callback ${action}`, action === 'clear'
        ? { bodyCancelError: new Error('expected late body cleanup rejection') } : {});
      const release = gate(`release callback ${action}`, image.response);
      const entered = gate(`callback ${action} entered`);
      let nested; let reentered = false;
      const url = `${ROOT}callback-${action}.png`;
      const { cache, log } = makeCache((_url, init) => {
        if (!reentered) {
          reentered = true;
          nested = load(cache, `${url}#join`);
          cancel(cache, action, url);
          assert.equal(init.signal.aborted, true);
        }
        entered.resolve();
        return release.promise;
      });
      const outer = load(cache, `${url}#outer`);
      await bounded(entered.promise, `${action} callback`);
      await sameAbort(outer, nested);
      assertCancelledState(cache, action);
      assert.equal(log.urls.length, 1);
      release.resolve();
      await bounded(image.cancelled.promise, `${action} late body cleanup`);
      await turn();
      assert.equal(image.local.readers, 0); assert.equal(image.local.bodyCancels, 1);
      assertCancelledState(cache, action);
    });
  }

  for (const action of ['delete', 'clear', 'dispose']) {
    await scenario(`same-turn-${action}-prevents-dispatch`, async () => {
      const url = `${ROOT}before-dispatch-${action}.png`;
      const { cache, log } = makeCache(() => { throw new Error('cancelled dispatch must never fetch'); });
      const first = load(cache, url);
      const second = load(cache, `${url}#join`);
      cancel(cache, action, url);
      await sameAbort(first, second);
      assert.equal(log.urls.length, 0, 'same-turn cancellation performs zero fetches');
      assertCancelledState(cache, action);
    });
  }

  await scenario('mapped-fetch-failure-preserves-resident-and-retries', async () => {
    const original = new Error('controlled fetch failure');
    const base = `${ROOT}resident.png`;
    const next = `${ROOT}retry.png`;
    let attempts = 0; let nested;
    const { cache, log } = makeCache(url => {
      if (url === next && ++attempts === 1) {
        nested = load(cache, `${next}#reentrant-failure`);
        throw original;
      }
      return response(`retry response ${url}`).response;
    });
    plan(); await value(load(cache, base));
    const failed = load(cache, next);
    const mapped = await error(failed);
    assert.equal(mapped, await error(nested));
    assert.notEqual(mapped, original); code(mapped, 'INVALID_ASSET');
    assert.equal(mapped.message, 'image fetch failed');
    resident(cache, base, A); assert.equal(cache.get(next), null);
    plan({ pixels: B });
    const retry = load(cache, next);
    const joined = load(cache, `${next}#retry-join`);
    assert.notEqual(retry.promise, joined.promise);
    asset(await value(retry), B); asset(await value(joined), B);
    resident(cache, next, B); assert.equal(cache.get(base), null);
    assert.equal(attempts, 2); assert.equal(log.urls.length, 3);
  });

  await scenario('exposed-errors-and-best-effort-cleanup-preserve-resident', async () => {
    const base = `${ROOT}error-resident.png`;
    let selected;
    const { cache } = makeCache(() => selected.response);
    selected = response('error resident'); plan(); await value(load(cache, base));
    const cases = [
      { name: 'header-get', options: { headerError: new Error('expected header getter error') }, exact: 'headerError' },
      { name: 'reader-release', options: { releaseError: new Error('expected reader release error') }, exact: 'releaseError' },
      { name: 'reader-cancel-rejection', options: { readError: new Error('expected read failure'),
        readerCancelError: new Error('expected reader cleanup rejection') } },
      { name: 'pixel-read', options: {}, decode: { pixelError: new Error('expected pixel read error') },
        message: 'browser could not read decoded image pixels' },
      { name: 'bitmap-rejection', options: {}, decode: { bitmapError: new Error('expected bitmap decode rejection') },
        message: 'browser could not decode image' },
    ];
    for (const entry of cases) {
      selected = response(entry.name, entry.options);
      if (entry.decode) plan(entry.decode);
      const url = `${ROOT}${entry.name}.png`;
      const first = load(cache, url);
      const joined = load(cache, `${url}#join`);
      const reason = await error(first, entry.name);
      assert.equal(reason, await error(joined, `${entry.name} joined`));
      if (entry.exact) assert.equal(reason, entry.options[entry.exact] ?? entry.decode[entry.exact]);
      else {
        code(reason, 'INVALID_ASSET');
        assert.equal(reason.message, entry.message ?? 'image response stream failed');
        assert.notEqual(reason, entry.options.readError ?? entry.decode?.pixelError ?? entry.decode?.bitmapError);
        if (entry.options.readerCancelError) {
          assert.notEqual(reason, entry.options.readerCancelError);
          assert.equal(selected.local.cancels, 1);
        }
      }
      resident(cache, base, A); assert.equal(cache.get(url), null);
      if (entry.name === 'header-get') {
        // This exposed header error happens before reader ownership. The harness,
        // not the implementation, drains the unconsumed Response and reports it.
        assert.equal(selected.local.readers, 0); assert.equal(selected.local.bodyCancels, 0);
        await selected.drain();
        assert.equal(selected.local.manualCancels, 1);
      } else assert.equal(selected.local.releases, 1);
    }
  });

  await scenario('cancelled-finally-keeps-new-pending-and-late-response-keeps-resident', async () => {
    const oldImage = response('old fetch');
    const newImage = response('new fetch');
    const oldRelease = gate('release old fetch', oldImage.response);
    const newRelease = gate('release new fetch', newImage.response);
    const oldStarted = gate('old fetch started');
    const newStarted = gate('new fetch started');
    const url = `${ROOT}replace.png`;
    let attempt = 0;
    const { cache, log } = makeCache(() => {
      if (++attempt === 1) { oldStarted.resolve(); return oldRelease.promise; }
      assert.equal(attempt, 2); newStarted.resolve(); return newRelease.promise;
    });
    const old = load(cache, url);
    const oldJoined = load(cache, `${url}#old`);
    await bounded(oldStarted.promise, 'old fetch start');
    assert.equal(cache.delete(url), true);
    const fresh = load(cache, `${url}#new`); // Before the old finally executes.
    await sameAbort(old, oldJoined);
    await bounded(newStarted.promise, 'new fetch start');
    const freshJoined = load(cache, `${url}#after-old-finally`);
    const refused = load(cache, `${ROOT}cannot-admit.png`);
    code(await error(refused), 'ASSET_LIMIT');
    assert.equal(log.urls.length, 2); assert.equal(log.signals[0].aborted, true);
    assert.equal(log.signals[1].aborted, false);
    plan({ pixels: B }); newRelease.resolve();
    asset(await value(fresh), B); asset(await value(freshJoined), B);
    resident(cache, url, B);
    oldRelease.resolve();
    await bounded(oldImage.cancelled.promise, 'old response cancellation');
    await turn();
    assert.equal(oldImage.local.readers, 0); assert.equal(oldImage.local.bodyCancels, 1);
    resident(cache, url, B);
  });

  await scenario('pending-decode-cancellation-cannot-overwrite-new-resident', async () => {
    const bitmapRelease = gate('release old bitmap');
    const oldPlan = plan({ wait: bitmapRelease });
    const url = `${ROOT}decode-replace.png`;
    const { cache, log } = makeCache(() => response('decode replacement').response);
    const old = load(cache, url);
    const joined = load(cache, `${url}#joined`);
    await bounded(oldPlan.started.promise, 'pending platform decode');
    assert.equal(cache.delete(url), true);
    plan({ pixels: B });
    const fresh = load(cache, `${url}#fresh`);
    await sameAbort(old, joined);
    asset(await value(fresh), B); resident(cache, url, B);
    assert.equal(log.signals[0].aborted, true); assert.equal(log.urls.length, 2);
    bitmapRelease.resolve();
    await bounded(oldPlan.closed.promise, 'late bitmap close');
    await turn();
    resident(cache, url, B);
  });

  assert.equal(counters.loadCalls, EXPECTED_LOADS);
  assert.equal(decodePlans.length, 0);
  assert.equal(scratchPlans.length, 0);
} finally {
  // Resolve every owned gate and drain every observed public wrapper, including
  // failure paths. Only our two global descriptors and exact listener are changed.
  try {
    for (const cache of caches) cache.dispose();
    for (const item of gates) item.resolve();
    await bounded(Promise.all(loads.map(item => item.outcome)), 'final public load drain');
    await turn();
    for (const item of responses) await bounded(item.drain(), `final response drain: ${item.label}`);
    await turn();
  } finally {
    for (const [key, descriptor] of previousDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    process.removeListener('unhandledRejection', onUnhandled);
  }
}

assert.deepEqual(unhandled, []);
assert.deepEqual(process.listeners('unhandledRejection'), previousListeners);
for (const [key, descriptor] of previousDescriptors) {
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, key), descriptor);
}
assert.equal(caches.length, 11);
for (const cache of caches) {
  assert.throws(() => cache.size, reason => reason instanceof Canvas2DError && reason.code === 'DISPOSED');
  assert.throws(() => cache.get(`${ROOT}disposed.png`),
    reason => reason instanceof Canvas2DError && reason.code === 'DISPOSED');
}
assert.equal(counters.fetches, 17);
assert.equal(counters.responses, 16);
assert.equal(counters.decodeCalls, 9);
assert.equal(counters.bitmaps, 8);
assert.equal(counters.bitmapCloseAttempts, 8);
assert.equal(counters.bitmapCloseCompleted, 8);
assert.equal(counters.canvases, 8);
assert.equal(counters.scratchWidthZeroAttempts, 8);
assert.equal(counters.scratchWidthZeroCompleted, 8);
assert.equal(counters.scratchHeightZeros, 8);
assert.equal(ownedBitmaps.length, 8);
assert.ok(ownedBitmaps.every(bitmap => bitmap.closed));
assert.equal(ownedCanvases.length, 8);
assert.ok(ownedCanvases.every(canvas => canvas.width === 0 && canvas.height === 0));
assert.equal(counters.readers, 11);
assert.equal(counters.readerReleases, 11);
assert.equal(counters.reads, 21);
assert.equal(counters.readerCancels, 1);
assert.equal(counters.bodyCancels, 4);
assert.equal(counters.manualBodyCancels, 1);
for (const key of ['expectedBodyCancelRejections', 'expectedReaderCancelRejections',
  'expectedReaderReleaseErrors', 'expectedBitmapDecodeRejections', 'expectedPixelReadErrors']) {
  assert.equal(counters[key], 1, key);
}
console.log(JSON.stringify({ result: 'ok', scope: 'bounded CPU control flow through actual public cache/URL/decoder',
  actualNetwork: false, actualPNGDecode: false, browserOrGPU: false,
  loadLimit: LOAD_LIMIT, exactLoadCalls: EXPECTED_LOADS, cachesDisposed: caches.length,
  encodedFixtureBytes: 16, decodedAsset: { width: 2, height: 2, bytes: 16 },
  unhandledRejections: unhandled.length, globalsAndListenerRestored: true,
  expectedFailureResources: { headerResponseDrainedByHarness: 1, readerReleaseThrowsAfterUnlock: 1,
    bitmapRejectionCreatesNoBitmap: 1, pixelReadFailureStillClosesAndZeros: 1 },
  allCreatedBitmapsClosed: true, allScratchDimensionsZero: true, counters, matrix }));
