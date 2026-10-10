import assert from 'node:assert/strict';
const { decodeImageBlob: decode, Canvas2DError } = await import(process.env.BAROCSS_DECODE_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array;
const blob = new Blob(['controlled raster'], { type: 'image/png' });
const exactBytes = [255, 0, 0, 255, 17, 42, 99, 0, 0, 0, 255, 128, 0, 255, 0, 255];
const cases = [];
async function codeReject(input, code, message) {
  await assert.rejects(decode(input), error => error instanceof Canvas2DError && error.code === code && error.message === message);
}
let domReads = 0, preflightDecodes = 0;
Object.defineProperty(globalThis, 'document', { configurable: true, get() { domReads++; throw Error('preflight DOM access'); } });
globalThis.createImageBitmap = () => { preflightDecodes++; throw Error('preflight decode'); };
for (const input of [undefined, null, {}, new Blob([], { type: 'image/png' })]) await codeReject(input, 'INVALID_ASSET', 'image source must be a nonempty Blob');
await codeReject(new Blob(['x'], { type: 'image/svg+xml' }), 'UNSUPPORTED_FEATURE', 'image MIME type is unsupported');
await codeReject(new Blob([new NativeU8(8 * 1048576 + 1)], { type: 'image/png' }), 'ASSET_LIMIT', 'encoded image exceeds 8 MiB');
assert.equal(domReads, 0); assert.equal(preflightDecodes, 0); delete globalThis.document;
delete globalThis.createImageBitmap;
await codeReject(blob, 'UNSUPPORTED_FEATURE', 'browser image decoding is unavailable');

function install(settings = {}) {
  const events = [], bytes = new Uint8ClampedArray(exactBytes), errors = {};
  for (const kind of ['decode', 'create', 'widthSetup', 'heightSetup', 'context', 'draw', 'read', 'allocation', 'widthCleanup', 'heightCleanup']) errors[kind] = new Error(kind + ' sentinel');
  const counts = { decode: 0, create: 0, draw: 0, read: 0, close: 0, allocation: 0 };
  const bitmap = { width: settings.width ?? 2, height: settings.height ?? 2,
    close() { counts.close++; events.push('close'); } };
  let width = 300, height = 150;
  const canvas = {
    get width() { return width; }, set width(value) {
      events.push('width:' + value);
      if (value === 0 && settings.widthCleanup) throw errors.widthCleanup;
      if (value !== 0 && settings.widthSetup) throw errors.widthSetup;
      width = value;
    },
    get height() { return height; }, set height(value) {
      events.push('height:' + value);
      if (value === 0 && settings.heightCleanup) throw errors.heightCleanup;
      if (value !== 0 && settings.heightSetup) throw errors.heightSetup;
      height = value;
    },
    getContext(kind, options) {
      events.push('context'); assert.equal(kind, '2d'); assert.deepEqual(options, { willReadFrequently: true });
      if (settings.context) throw errors.context;
      if (settings.nullContext) return null;
      return { drawImage(value, x, y) { counts.draw++; events.push('draw'); assert.equal(value, bitmap); assert.equal(x, 0); assert.equal(y, 0); if (settings.draw) throw errors.draw; },
        getImageData(x, y, w, h) { counts.read++; events.push('read'); assert.deepEqual([x, y, w, h], [0, 0, 2, 2]); if (settings.read) throw errors.read; return { data: bytes }; } };
    }
  };
  globalThis.createImageBitmap = async value => { counts.decode++; events.push('decode'); assert.equal(value, blob); if (settings.decode) throw errors.decode; return bitmap; };
  globalThis.document = { createElement(kind) { counts.create++; events.push('create'); assert.equal(kind, 'canvas'); if (settings.create) throw errors.create; return canvas; } };
  if (settings.allocation) globalThis.Uint8Array = new Proxy(NativeU8, { construct() { counts.allocation++; throw errors.allocation; } });
  return { canvas, bitmap, counts, events, errors, bytes };
}
async function run(name, settings = {}, outcome = null) {
  const facility = install(settings);
  let result;
  try {
    if (outcome?.raw) await assert.rejects(decode(blob), error => error === facility.errors[outcome.raw]);
    else if (outcome?.code) await codeReject(blob, outcome.code, outcome.message);
    else {
      result = await decode(blob); assert.deepEqual(Object.keys(result), ['width', 'height', 'pixels']);
      assert.equal(result.width, 2); assert.equal(result.height, 2); assert.deepEqual([...result.pixels], exactBytes);
      assert.ok(result.pixels instanceof NativeU8); assert.notEqual(result.pixels.buffer, facility.bytes.buffer);
      facility.bytes.fill(0); assert.deepEqual([...result.pixels], exactBytes);
    }
  } finally { globalThis.Uint8Array = NativeU8; }
  assert.equal(facility.counts.decode, 1);
  const hasBitmap = !settings.decode, hasCanvas = hasBitmap && !settings.create && !outcome?.noScratch;
  assert.equal(facility.counts.close, hasBitmap ? 1 : 0);
  assert.equal(facility.counts.create, hasBitmap && !outcome?.noScratch ? 1 : 0);
  const hasContext = hasCanvas && !settings.widthSetup && !settings.heightSetup && !settings.context && !settings.nullContext;
  assert.equal(facility.counts.draw, hasContext ? 1 : 0);
  assert.equal(facility.counts.read, hasContext && !settings.draw ? 1 : 0);
  assert.equal(facility.counts.allocation, settings.allocation ? 1 : 0);
  if (hasCanvas) {
    assert.deepEqual(facility.events.slice(-3), ['width:0', 'height:0', 'close']);
    if (!settings.widthCleanup) assert.equal(facility.canvas.width, 0);
    if (!settings.heightCleanup) assert.equal(facility.canvas.height, 0);
  }
  if (outcome?.noScratch || settings.decode || settings.create) assert.equal(facility.events.filter(event => event === 'width:0' || event === 'height:0').length, 0);
  cases.push({ name, outcome: outcome?.raw ?? outcome?.code ?? 'success', counts: facility.counts, events: facility.events });
  return { result, facility };
}
const first = await run('success exact independent RGBA');
assert.deepEqual(first.facility.counts, { decode: 1, create: 1, draw: 1, read: 1, close: 1, allocation: 0 });
assert.deepEqual(first.facility.events, ['decode', 'create', 'width:2', 'height:2', 'context', 'draw', 'read', 'width:0', 'height:0', 'close']);
const second = await run('repeated independent decode'); first.result.pixels.fill(0); assert.deepEqual([...second.result.pixels], exactBytes);
await run('decode rejection closes no bitmap', { decode: true }, { code: 'INVALID_ASSET', message: 'browser could not decode image', noScratch: true });
for (const dimensions of [{ width: 0 }, { height: 0 }, { width: 1.5 }, { height: NaN }]) await run('invalid dimensions', dimensions,
  { code: 'INVALID_ASSET', message: 'decoded image dimensions are invalid', noScratch: true });
for (const dimensions of [{ width: 4097 }, { width: 4096, height: 2049 }]) await run('decoded budget', dimensions,
  { code: 'ASSET_LIMIT', message: 'decoded image exceeds asset limits', noScratch: true });
for (const kind of ['create', 'widthSetup', 'heightSetup', 'context']) await run('raw ' + kind + ' identity', { [kind]: true }, { raw: kind });
await run('null context cleanup', { nullContext: true }, { code: 'UNSUPPORTED_FEATURE', message: '2D canvas is unavailable' });
for (const kind of ['draw', 'read', 'allocation']) await run('converted ' + kind + ' failure', { [kind]: true },
  { code: 'INVALID_ASSET', message: 'browser could not read decoded image pixels' });
await run('width cleanup throws, height and close still run', { widthCleanup: true }, { raw: 'widthCleanup' });
await run('height cleanup throws, bitmap close still runs', { heightCleanup: true }, { raw: 'heightCleanup' });

// Two calls remain pending together; finish the second call before the first.
const pending = [], concurrentCanvases = [], concurrentEvents = [];
globalThis.createImageBitmap = value => new Promise(resolve => { pending.push({ value, resolve }); });
globalThis.document = { createElement() {
  let width = 300, height = 150, drawn;
  const canvas = { get width() { return width; }, set width(value) { width = value; }, get height() { return height; }, set height(value) { height = value; },
    getContext() { return { drawImage(bitmap) { drawn = bitmap; }, getImageData() { return { data: drawn.bytes }; } }; } };
  concurrentCanvases.push(canvas); return canvas;
} };
const blobA = new Blob(['A'], { type: 'image/png' }), blobB = new Blob(['B'], { type: 'image/webp' });
const promiseA = decode(blobA), promiseB = decode(blobB);
assert.equal(pending.length, 2); assert.equal(concurrentCanvases.length, 0);
const bitmapA = { width: 1, height: 1, bytes: new Uint8ClampedArray([1, 2, 3, 4]), closes: 0, close() { this.closes++; concurrentEvents.push('closeA'); } };
const bitmapB = { width: 1, height: 1, bytes: new Uint8ClampedArray([5, 6, 7, 8]), closes: 0, close() { this.closes++; concurrentEvents.push('closeB'); } };
pending[1].resolve(bitmapB); const resultB = await promiseB;
assert.equal(concurrentCanvases.length, 1); assert.equal(bitmapB.closes, 1); assert.equal(bitmapA.closes, 0);
pending[0].resolve(bitmapA); const resultA = await promiseA;
assert.deepEqual([...resultA.pixels], [1, 2, 3, 4]); assert.deepEqual([...resultB.pixels], [5, 6, 7, 8]);
assert.notEqual(resultA.pixels.buffer, resultB.pixels.buffer); assert.notEqual(concurrentCanvases[0], concurrentCanvases[1]);
for (const canvas of concurrentCanvases) assert.deepEqual([canvas.width, canvas.height], [0, 0]);
assert.equal(bitmapA.closes, 1); assert.equal(bitmapB.closes, 1); assert.deepEqual(concurrentEvents, ['closeB', 'closeA']);
resultA.pixels.fill(0); bitmapB.bytes.fill(0); assert.deepEqual([...resultB.pixels], [5, 6, 7, 8]);
delete globalThis.document; delete globalThis.createImageBitmap;
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_DECODE_MODULE ? 'source-bundle' : 'compiled-root',
  controlledFacilities: true, preflightDOMReads: domReads, preflightDecodeCalls: preflightDecodes,
  preflightCases: 7, copiedExactRGBA: true, independentRepeatedCopies: true, canvasReleaseOrder: ['width:0', 'height:0', 'close'],
  bitmapCloseOnce: true, rawErrorIdentityRetained: true, existingReadErrorCodeMessageRetained: true,
  cleanupThrowCasesAreControlled: true, concurrentReverseCompletion: true, concurrentScratchCount: concurrentCanvases.length,
  concurrentCopiesIsolated: true, cases: cases.length, caseDetails: cases }, null, 2));
