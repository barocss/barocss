import assert from 'node:assert/strict';
const { rasterizeBrowserText: single, rasterizeBrowserMultilineText: multi, rasterizeBrowserWrappedText: wrapped, Canvas2DError } =
  await import(process.env.BAROCSS_TEXT_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array;
const base = { text: 'HI', font: '24px monospace', atlasId: 'Label' };
const helpers = {
  single: { fn: single, input: base, bounds: { left: -3, top: -9, width: 14, height: 13 }, draws: [{ text: 'HI', x: 3, y: 9 }] },
  printable: { fn: single, input: { ...base, text: '-$20', textPolicy: 'printable-ascii' }, bounds: { left: -3, top: -9, width: 14, height: 13 }, draws: [{ text: '-$20', x: 3, y: 9 }] },
  multiline: { fn: multi, input: { ...base, text: 'A\nB', lineAdvance: 12 }, bounds: { left: -3, top: -9, width: 14, height: 25 }, draws: [{ text: 'A', x: 3, y: 9 }, { text: 'B', x: 3, y: 21 }] },
  wrapped: { fn: wrapped, input: { ...base, text: 'A B', lineAdvance: 12, maxWidth: 10 }, bounds: { left: -3, top: -9, width: 14, height: 25 }, draws: [{ text: 'A', x: 3, y: 9 }, { text: 'B', x: 3, y: 21 }] }
};
const cases = []; let getters = 0, preflightDOMReads = 0;
Object.defineProperty(globalThis, 'document', { configurable: true, get() { preflightDOMReads++; throw Error('validation touched DOM'); } });
let preflightCases = 0;
for (const { fn, input } of Object.values(helpers)) {
  for (const value of [null, [], { ...input, extra: true }, { ...input, text: '' }, { ...input, dpr: undefined }]) {
    assert.throws(() => fn(value), error => error.code === 'INVALID_SCENE'); preflightCases++;
  }
  const accessor = { ...input }; Object.defineProperty(accessor, 'text', { enumerable: true, get() { getters++; return input.text; } });
  assert.throws(() => fn(accessor), error => error.code === 'INVALID_SCENE'); preflightCases++;
}
assert.equal(getters, 0); assert.equal(preflightDOMReads, 0); delete globalThis.document;
for (const { fn, input } of Object.values(helpers)) {
  assert.throws(() => fn(input), error => error.code === 'UNSUPPORTED_FEATURE'); preflightCases++;
}
function facility(settings = {}) {
  let width = 300, height = 150, font = '';
  const events = [], canvases = [], draws = [], counts = { create: 0, context: 0, measure: 0, draw: 0, read: 0, allocations: 0 };
  let data;
  const context = { get font() { return font; }, set font(value) {
    if (settings.fontSetup) throw Error('font setup');
    if (settings.invalidFont && value === base.font) return;
    font = value;
  }, setTransform() { if (settings.configure) throw Error('configure'); }, scale() {}, measureText(text) {
    counts.measure++; if (settings.measure) throw Error('measure');
    return { width: settings.badMetric ? NaN : text.includes(' ') ? 25 : 10, actualBoundingBoxLeft: 1,
      actualBoundingBoxRight: 9, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2 };
  }, fillText(text, x, y) { counts.draw++; draws.push({ text, x, y }); if (settings.drawError) throw settings.drawError; if (settings.draw) throw Error('draw'); },
  getImageData(x, y, w, h) {
    counts.read++; if (settings.read) throw Error('read'); assert.deepEqual([x, y, w, h], [0, 0, width, height]);
    data = new Uint8ClampedArray(settings.short ? 1 : width * height * 4);
    if (!settings.noInk && !settings.short) data.set([settings.red ?? 10, 20, 30, 255]);
    return { data };
  } };
  const canvas = { get width() { return width; }, set width(value) {
    events.push('width:' + value);
    if (value === 0 && settings.widthCleanup) throw Error('width cleanup');
    if (value !== 0 && settings.widthSetup) throw Error('width setup'); width = value;
  }, get height() { return height; }, set height(value) {
    events.push('height:' + value);
    if (value === 0 && settings.heightCleanup) throw Error('height cleanup');
    if (value !== 0 && settings.heightSetup) throw Error('height setup'); height = value;
  }, getContext(kind, options) {
    counts.context++; assert.equal(kind, '2d'); assert.deepEqual(options, { willReadFrequently: true });
    if (settings.context) throw Error('context'); return settings.nullContext ? null : context;
  } };
  if (settings.missingContextAPI) canvas.getContext = undefined;
  globalThis.document = { fonts: { check: () => !settings.unreadyFont }, createElement(kind) {
    counts.create++; assert.equal(kind, 'canvas'); if (settings.create) throw Error('create'); canvases.push(canvas); return canvas;
  } };
  if (settings.allocation) globalThis.Uint8Array = new Proxy(NativeU8, { construct() { counts.allocations++; throw Error('allocation'); } });
  return { canvas, canvases, context, counts, events, draws, data: () => data };
}
function run(name, helper = helpers.single, settings = {}, refusal = null) {
  const f = facility(settings); let result;
  try {
    if (refusal) assert.throws(() => helper.fn(helper.input), error => refusal.error ? error === refusal.error : error instanceof Canvas2DError && error.code === refusal.code && error.message === refusal.message, name);
    else {
      result = helper.fn(helper.input); assert.deepEqual(result.bounds, helper.bounds); assert.equal(result.advance, 10); assert.equal(result.dpr, 1);
      assert.equal(result.asset.width, helper.bounds.width); assert.equal(result.asset.height, helper.bounds.height);
      assert.deepEqual(f.draws, helper.draws); assert.equal(result.layout.text, helper.input.text); assert.equal(result.layout.glyphs.length, 1);
      assert.deepEqual(result.layout.glyphs[0], { sourceRect: { x: 0, y: 0, width: helper.bounds.width, height: helper.bounds.height },
        x: -3, y: -9, width: helper.bounds.width, height: helper.bounds.height, textStart: 0, textEnd: helper.input.text.length });
      const expected = new NativeU8(result.asset.width * result.asset.height * 4); expected.set([settings.red ?? 10, 20, 30, 255]);
      assert.deepEqual(result.asset.pixels, expected); assert.notEqual(result.asset.pixels.buffer, f.data().buffer);
      f.data().fill(0); assert.deepEqual(result.asset.pixels, expected);
      assert.equal(f.counts.draw, helper.draws.length); assert.equal(f.counts.read, 1);
      if (helper === helpers.multiline || helper === helpers.wrapped) assert.deepEqual(result.lines, [
        { textStart: 0, textEnd: 1, baseline: 0, advance: 10 }, { textStart: 2, textEnd: 3, baseline: 12, advance: 10 }
      ]);
    }
  } finally { globalThis.Uint8Array = NativeU8; }
  assert.equal(f.counts.create, 1);
  if (settings.create) assert.deepEqual(f.events, []);
  else {
    assert.deepEqual(f.events.slice(-2), ['width:0', 'height:0'], name);
    if (!settings.widthCleanup) assert.equal(f.canvas.width, 0);
    if (!settings.heightCleanup) assert.equal(f.canvas.height, 0);
  }
  cases.push({ name, code: refusal?.code ?? 'success', counts: f.counts, cleanup: settings.create ? [] : f.events.slice(-2) });
  return { result, facility: f };
}
for (const [name, helper] of Object.entries(helpers)) run(name + ' exact bytes and layout', helper);
const generic = { code: 'INVALID_ASSET', message: 'browser could not allocate, measure, draw or read text' };
for (const mode of ['create', 'context', 'fontSetup', 'configure', 'measure', 'widthSetup', 'heightSetup', 'draw', 'read', 'allocation']) run('failure ' + mode, helpers.single, { [mode]: true }, generic);
run('missing context API', helpers.single, { missingContextAPI: true }, { code: 'UNSUPPORTED_FEATURE', message: 'scratch canvas API is unavailable' });
run('null context', helpers.single, { nullContext: true }, { code: 'UNSUPPORTED_FEATURE', message: 'scratch Canvas2D API is unavailable' });
run('ignored CSS font', helpers.single, { invalidFont: true }, { code: 'INVALID_SCENE', message: 'browser ignored the CSS font declaration' });
run('unready font', helpers.single, { unreadyFont: true }, { code: 'INVALID_ASSET', message: 'browser text font is not ready' });
run('invalid metrics', helpers.single, { badMetric: true }, { code: 'INVALID_ASSET', message: 'browser text metrics are outside finite coordinate limits' });
run('invalid readback extent', helpers.single, { short: true }, { code: 'INVALID_ASSET', message: 'browser text readback has an invalid RGBA8 extent' });
run('no ink', helpers.single, { noInk: true }, { code: 'INVALID_ASSET', message: 'browser text raster has no ink' });
for (const [name, helper] of Object.entries(helpers)) {
  for (const settings of [{ widthCleanup: true }, { heightCleanup: true }, { widthCleanup: true, heightCleanup: true }]) {
    run(name + ' cleanup throws preserve result', helper, settings);
    run(name + ' cleanup throws preserve original error', helper, { ...settings, draw: true }, generic);
  }
  const original = new Canvas2DError('INVALID_ASSET', 'controlled original error');
  run(name + ' cleanup preserves existing error identity', helper,
    { widthCleanup: true, heightCleanup: true, drawError: original }, { code: original.code, error: original });
}
// Synchronous helpers cannot overlap in one JS thread; separate batched calls prove ownership isolation.
const isolated = await Promise.all(Object.values(helpers).map((helper, index) => Promise.resolve().then(() => run('batched isolated call ' + index, helper, { red: 40 + index }))));
for (let index = 0; index < isolated.length; index++) {
  assert.equal(isolated[index].result.asset.pixels[0], 40 + index);
  for (let other = 0; other < index; other++) {
    assert.notEqual(isolated[index].result.asset.pixels.buffer, isolated[other].result.asset.pixels.buffer);
    assert.notEqual(isolated[index].facility.canvas, isolated[other].facility.canvas);
  }
}
isolated[0].result.asset.pixels.fill(0); assert.equal(isolated[1].result.asset.pixels[0], 41);
delete globalThis.document;
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_TEXT_MODULE ? 'source-bundle' : 'compiled-root',
  controlledFacilities: true, preflightCases, preflightDOMReads, preflightCanvases: 0, getters,
  firstFailures: [], cases: cases.length, exactCopiedRGBA: true, literalLayoutBounds: true,
  helpers: ['single-default', 'single-printable', 'multiline', 'wrapped'],
  independentResetAttempts: true, cleanupErrorsSuppressed: true, originalErrorsPreserved: true,
  independentBatchedSynchronousCalls: true, caseDetails: cases }, null, 2));
