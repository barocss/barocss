import assert from 'node:assert/strict';
const { rasterizeBrowserMultilineText: multi, rasterizeBrowserText: single, Canvas2DError } =
  await import(process.env.BAROCSS_TEXT_MODULE ?? '../../../dist/index.js');
const base = { text: 'Balance\n-$20', font: '24px monospace', atlasId: 'Label', lineAdvance: 40, dpr: 2 };
let getters = 0, domReads = 0;
const refusals = [];
function reject(name, value, code = 'INVALID_SCENE') {
  assert.throws(() => multi(value), error => error instanceof Canvas2DError && error.code === code, name);
  refusals.push({ name, code });
}
// Validation must finish without asking for browser APIs or evaluating option getters.
Object.defineProperty(globalThis, 'document', { configurable: true, get() { domReads++; throw Error('DOM read'); } });
for (const lineAlign of [undefined, null, '', 'justify', 'Left', 0, true, {}, []]) {
  reject('alignment ' + String(lineAlign), { ...base, lineAlign });
}
for (const text of ['', 'A\n', '\nA', 'A\n\nB', 'A\n \nB', 'A\nB\nC\nD\nE', 'A\r\nB', 'A\tB', 'A\0B', 'A\x7f', 'é', '한글', '😀', 'A'.repeat(129), 'A'.repeat(127) + '\nB']) {
  reject('text ' + JSON.stringify(text), { ...base, text, lineAlign: 'center' });
}
for (const lineAdvance of [undefined, null, 0, -1, NaN, Infinity, 1000001, '40']) reject('advance ' + String(lineAdvance), { ...base, lineAdvance });
reject('displaced baseline limit', { ...base, text: 'A\nB\nC\nD', lineAdvance: 333334 });
for (const dpr of [undefined, null, 0, 4.1, NaN]) reject('DPR ' + String(dpr), { ...base, dpr });
for (const font of ['', null, 'a'.repeat(257), 'A\nB']) reject('font ' + String(font), { ...base, font });
for (const value of [null, [], Object.create(base), { ...base, extra: true }, { ...base, textPolicy: 'printable-ascii' }, { ...base, [Symbol('field')]: 1 }]) reject('record', value);
const alignedBase = { ...base, lineAlign: 'center' };
for (const key of Object.keys(alignedBase)) {
  const accessor = { ...alignedBase };
  Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; throw Error('getter'); } });
  reject('accessor ' + key, accessor);
  const hidden = { ...alignedBase };
  Object.defineProperty(hidden, key, { enumerable: false, value: alignedBase[key] });
  reject('hidden ' + key, hidden);
}
for (const key of ['text', 'font', 'atlasId', 'lineAdvance']) {
  const value = { ...alignedBase }; delete value[key]; reject('missing ' + key, value);
}
assert.equal(getters, 0); assert.equal(domReads, 0);
delete globalThis.document;
for (const lineAlign of ['left', 'center', 'right']) reject('without browser ' + lineAlign, { ...base, lineAlign }, 'UNSUPPORTED_FEATURE');
assert.throws(() => single({ text: 'A\nB', font: base.font, atlasId: base.atlasId }), error => error.code === 'INVALID_SCENE');
assert.throws(() => single({ text: 'A', font: base.font, atlasId: base.atlasId, lineAlign: 'center' }), error => error.code === 'INVALID_SCENE');

const normalMetrics = { width: 10.5, actualBoundingBoxLeft: 1.25, actualBoundingBoxRight: 9.25, actualBoundingBoxAscent: 7.5, actualBoundingBoxDescent: 2.25 };
// These advances and signed ink overhangs are independent fixture data.
const distinctMetrics = {
  Wide: { width: 17.75, actualBoundingBoxLeft: 1.25, actualBoundingBoxRight: 16.5, actualBoundingBoxAscent: 7.5, actualBoundingBoxDescent: 2.25 },
  n: { width: 5.25, actualBoundingBoxLeft: -0.75, actualBoundingBoxRight: 9.75, actualBoundingBoxAscent: 6.25, actualBoundingBoxDescent: 1.5 },
  j: { width: 10.5, actualBoundingBoxLeft: 2.5, actualBoundingBoxRight: 15.25, actualBoundingBoxAscent: 8.25, actualBoundingBoxDescent: 3.75 }
};
let mode = 'ok', measure = 0, draw = 0, read = 0, lastData;
const canvases = [];
globalThis.document = { fonts: { check: () => true }, createElement() {
  let width = 300, height = 150;
  const writes = [], draws = [];
  const context = { font: '', setTransform() {}, scale() {}, measureText(text) {
    measure++;
    if (mode === 'distinct') return { ...distinctMetrics[text] };
    if (mode === 'shiftLimit') return { ...normalMetrics, width: text === 'A' ? 1e6 : 1, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text === 'A' ? 1 : 1e6 };
    if (mode === 'alignedOversize') return { ...normalMetrics, width: text === 'A' ? 1000 : 10, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 10 };
    return { ...normalMetrics, ...(mode === 'badMetric' ? { width: NaN } : {}) };
  }, fillText(text, x, y) { draw++; draws.push({ text, x, y }); if (mode === 'drawThrow') throw Error('draw'); },
  getImageData() { read++; lastData = new Uint8ClampedArray(width * height * 4); if (mode !== 'noInk') lastData[3] = 255;
    return { data: mode === 'short' ? new Uint8Array(1) : lastData }; } };
  const canvas = { get width() { return width; }, set width(value) { width = value; writes.push(['width', value]); },
    get height() { return height; }, set height(value) { height = value; writes.push(['height', value]); },
    getContext() { return context; }, writes, draws };
  canvases.push(canvas); return canvas;
} };
function released() { assert.equal(canvases.at(-1).width, 0); assert.equal(canvases.at(-1).height, 0); }
const legacyInput = { ...base, text: ' A \nB', dpr: 1.5, lineAdvance: 12.25 };
const legacy = multi(legacyInput); released();
assert.deepEqual(legacy.bounds, { left: -4, top: -10, width: 16, height: 27.333333333333332 });
assert.deepEqual(legacy.lines, [{ textStart: 0, textEnd: 3, baseline: 0, advance: 10.5 }, { textStart: 4, textEnd: 5, baseline: 12.25, advance: 10.5 }]);
assert.equal(legacy.asset.width, 24); assert.equal(legacy.asset.height, 41);
assert.deepEqual(canvases.at(-1).draws, [{ text: ' A ', x: 4, y: 10 }, { text: 'B', x: 4, y: 22.25 }]);
lastData[3] = 0; assert.equal(legacy.asset.pixels[3], 255);
const explicitLeft = multi({ ...legacyInput, lineAlign: 'left' }); released();
assert.deepEqual(explicitLeft, legacy);
assert.deepEqual(Object.keys(legacy), ['asset', 'font', 'dpr', 'advance', 'bounds', 'layout', 'lineAdvance', 'lines']);
assert.deepEqual(Object.keys(legacy.lines[0]), ['textStart', 'textEnd', 'baseline', 'advance']);
legacy.lines[0].baseline = 999; assert.equal(legacy.layout.baseline, 0);

mode = 'distinct';
const expected = {
  left: { bounds: { left: -5, top: -10, width: 24, height: 62 / 1.5 }, width: 36, xs: [5, 5, 5] },
  center: { bounds: { left: -4, top: -10, width: 38 / 1.5, height: 62 / 1.5 }, width: 38, xs: [4, 10.25, 7.625] },
  right: { bounds: { left: -4, top: -10, width: 44 / 1.5, height: 62 / 1.5 }, width: 44, xs: [4, 16.5, 11.25] }
};
const synthetic = [];
for (const lineAlign of ['left', 'center', 'right']) {
  const before = { measure, draw, read };
  const result = multi({ ...base, text: 'Wide\nn\nj', lineAdvance: 12.25, dpr: 1.5, lineAlign });
  const oracle = expected[lineAlign];
  assert.deepEqual(result.bounds, oracle.bounds); assert.equal(result.asset.width, oracle.width); assert.equal(result.asset.height, 62);
  assert.deepEqual(canvases.at(-1).draws, ['Wide', 'n', 'j'].map((text, index) => ({ text, x: oracle.xs[index], y: [10, 22.25, 34.5][index] })));
  assert.deepEqual(result.lines, [{ textStart: 0, textEnd: 4, baseline: 0, advance: 17.75 }, { textStart: 5, textEnd: 6, baseline: 12.25, advance: 5.25 }, { textStart: 7, textEnd: 8, baseline: 24.5, advance: 10.5 }]);
  assert.equal(result.advance, 17.75); assert.equal(result.layout.glyphs.length, 1); assert.equal(result.layout.glyphs[0].textEnd, 8);
  assert.deepEqual({ measure: measure - before.measure, draw: draw - before.draw, read: read - before.read }, { measure: 3, draw: 3, read: 1 });
  released(); lastData[3] = 0; assert.equal(result.asset.pixels[3], 255);
  synthetic.push({ lineAlign, bounds: result.bounds, draws: canvases.at(-1).draws, atlas: { width: result.asset.width, height: result.asset.height } });
}
for (const bad of ['badMetric', 'drawThrow', 'noInk', 'short']) { mode = bad; reject(bad, { ...base, lineAlign: 'right' }, 'INVALID_ASSET'); released(); }
function refuseBeforeDrawing(name, input, code) {
  const before = { draw, read }; reject(name, input, code); released();
  assert.equal(draw, before.draw); assert.equal(read, before.read);
  assert.deepEqual(canvases.at(-1).writes, [['width', 0], ['height', 0]]);
}
mode = 'ok'; refuseBeforeDrawing('height limit', { ...base, lineAdvance: 200, lineAlign: 'center' }, 'ASSET_LIMIT');
mode = 'alignedOversize';
multi({ ...base, text: 'A\nB', lineAlign: 'left' }); released();
refuseBeforeDrawing('aligned width limit', { ...base, text: 'A\nB', lineAlign: 'right' }, 'ASSET_LIMIT');
mode = 'shiftLimit'; refuseBeforeDrawing('shifted coordinate limit', { ...base, text: 'A\nB', lineAlign: 'right' }, 'INVALID_ASSET');
mode = 'ok';
const old = single({ text: 'HI', font: base.font, atlasId: 'Label', dpr: 1.5 });
assert.deepEqual(Object.keys(old), ['asset', 'font', 'dpr', 'advance', 'bounds', 'layout']);
assert.equal(old.advance, 10.5); assert.equal(old.layout.text, 'HI'); assert.equal(canvases.at(-1).width, 24);
delete globalThis.document;
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_TEXT_MODULE ? 'source-bundle' : 'compiled-root',
  refusals: refusals.length, getters, domReads, syntheticMetrics: true, fractionalOffsets: true, signedOverhang: true,
  copiedRGBA: true, multilineCleanup: true, oversizeDrawReadDelta0: true, shiftedCoordinateDrawReadDelta0: true,
  defaultExplicitLeftMatchesPrior: true, singleLineShapeRetained: true, synthetic, refusalCases: refusals }, null, 2));
