import assert from 'node:assert/strict';
const { rasterizeBrowserWrappedText: wrap, rasterizeBrowserMultilineText: multi,
  rasterizeBrowserText: single, Canvas2DError } = await import(process.env.BAROCSS_TEXT_MODULE ?? '../../../dist/index.js');
const base = { text: 'AV To j', font: '24px monospace', atlasId: 'WrappedLabel', maxWidth: 15, lineAdvance: 12.25, dpr: 1.5 };
let getters = 0, domReads = 0;
const refusals = [];
function reject(name, input, code = 'INVALID_SCENE') {
  assert.throws(() => wrap(input), error => error instanceof Canvas2DError && error.code === code, name);
  refusals.push({ name, code });
}
Object.defineProperty(globalThis, 'document', { configurable: true, get() { domReads++; throw Error('DOM read'); } });
for (const text of ['', ' AV', 'AV ', 'AV  To', 'AV\nTo', 'AV\rTo', 'AV\tTo', 'AV\0To', '\x7f', 'é', '한글', '😀', 'A'.repeat(129)]) reject('text ' + JSON.stringify(text), { ...base, text });
for (const maxWidth of [undefined, null, 0, -1, NaN, Infinity, 1000001, '15']) reject('width ' + String(maxWidth), { ...base, maxWidth });
for (const lineAdvance of [undefined, null, 0, -1, NaN, Infinity, 1000001, '12']) reject('advance ' + String(lineAdvance), { ...base, lineAdvance });
for (const lineAlign of [undefined, null, '', 'justify', 'Left', 0, true]) reject('alignment ' + String(lineAlign), { ...base, lineAlign });
for (const dpr of [undefined, null, 0, 4.1, NaN]) reject('DPR ' + String(dpr), { ...base, dpr });
for (const font of ['', null, 'a'.repeat(257), 'A\nB']) reject('font ' + String(font), { ...base, font });
for (const input of [null, [], Object.create(base), { ...base, extra: true }, { ...base, textPolicy: 'printable-ascii' }, { ...base, [Symbol('field')]: 1 }]) reject('record', input);
const complete = { ...base, lineAlign: 'center' };
for (const key of Object.keys(complete)) {
  const accessor = { ...complete };
  Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; throw Error('getter'); } });
  reject('accessor ' + key, accessor);
  const hidden = { ...complete };
  Object.defineProperty(hidden, key, { enumerable: false, value: complete[key] }); reject('hidden ' + key, hidden);
}
for (const key of ['text', 'font', 'atlasId', 'lineAdvance', 'maxWidth']) {
  const input = { ...base }; delete input[key]; reject('missing ' + key, input);
}
assert.equal(getters, 0); assert.equal(domReads, 0); delete globalThis.document;
reject('no browser', base, 'UNSUPPORTED_FEATURE');

const ordinary = { width: 10.5, actualBoundingBoxLeft: 1.25, actualBoundingBoxRight: 9.25, actualBoundingBoxAscent: 7.5, actualBoundingBoxDescent: 2.25 };
// AV + To is 17.75 before any space. The complete candidate is only 12.5.
// A sum-of-word-width implementation cannot produce this fixture's first line.
const widths = { AV: 9.5, To: 8.25, j: 3.5, 'AV To': 12.5, 'AV To j': 17.25, 'To j': 13.5 };
let mode = 'words', measure = 0, draw = 0, read = 0, lastData;
const canvases = [];
globalThis.document = { fonts: { check: () => mode !== 'fontNotReady' }, createElement() {
  let width = 300, height = 150;
  const writes = [], measured = [], draws = [];
  const context = { font: '', setTransform() {}, scale() {}, measureText(text) {
    measure++; measured.push(text);
    if (mode === 'constant') return { ...ordinary };
    if (mode === 'lineCap' || mode === 'maxWork') return { ...ordinary, width: text.length };
    if (mode === 'badMetric') return { ...ordinary, width: NaN };
    const advance = widths[text]; assert.notEqual(advance, undefined, 'unexpected candidate ' + text);
    return { width: advance, actualBoundingBoxLeft: text === 'j' ? 2.5 : 1.25,
      actualBoundingBoxRight: text === 'j' ? 4.75 : 13.25,
      actualBoundingBoxAscent: text === 'j' ? 8.25 : 7.5,
      actualBoundingBoxDescent: text === 'j' ? 3.75 : 2.25 };
  }, fillText(text, x, y) { draw++; draws.push({ text, x, y }); if (mode === 'drawThrow') throw Error('draw'); },
  getImageData() { read++; lastData = new Uint8ClampedArray(width * height * 4); if (mode !== 'noInk') lastData[3] = 255;
    return { data: mode === 'short' ? new Uint8Array(1) : lastData }; } };
  const canvas = { get width() { return width; }, set width(value) { width = value; writes.push(['width', value]); },
    get height() { return height; }, set height(value) { height = value; writes.push(['height', value]); },
    getContext() { return context; }, writes, measured, draws };
  canvases.push(canvas); return canvas;
} };
function released() { assert.equal(canvases.at(-1).width, 0); assert.equal(canvases.at(-1).height, 0); }
const lineRecords = [{ textStart: 0, textEnd: 5, baseline: 0, advance: 12.5 }, { textStart: 6, textEnd: 7, baseline: 12.25, advance: 3.5 }];
const expected = {
  left: { bounds: { left: -5, top: -10, width: 32 / 1.5, height: 28 }, width: 32, xs: [5, 5] },
  center: { bounds: { left: -2, top: -10, width: 29 / 1.5, height: 28 }, width: 29, xs: [3.25, 7.75] },
  right: { bounds: { left: -1, top: -10, width: 20, height: 28 }, width: 30, xs: [3.5, 12.5] }
};
const synthetic = [];
let left;
for (const lineAlign of ['left', 'center', 'right']) {
  const before = { measure, draw, read }, result = wrap({ ...base, lineAlign }), oracle = expected[lineAlign];
  assert.deepEqual(result.lines, lineRecords); assert.equal(result.advance, 12.5); assert.equal(result.maxWidth, 15);
  assert.deepEqual(result.bounds, oracle.bounds); assert.equal(result.asset.width, oracle.width); assert.equal(result.asset.height, 42);
  assert.equal(result.layout.text, base.text); assert.equal(result.layout.glyphs.length, 1); assert.equal(result.layout.glyphs[0].textEnd, 7);
  assert.deepEqual(canvases.at(-1).draws, [{ text: 'AV To', x: oracle.xs[0], y: 10 }, { text: 'j', x: oracle.xs[1], y: 22.25 }]);
  assert.ok(canvases.at(-1).measured.includes('AV To')); assert.ok(canvases.at(-1).measured.includes('AV To j'));
  assert.ok(measure - before.measure <= 128); assert.equal(draw - before.draw, 2); assert.equal(read - before.read, 1);
  assert.equal(base.text.slice(result.lines[0].textStart, result.lines[0].textEnd), 'AV To');
  assert.equal(base.text[result.lines[0].textEnd], ' '); assert.equal(base.text.slice(result.lines[1].textStart, result.lines[1].textEnd), 'j');
  released(); lastData[3] = 0; assert.equal(result.asset.pixels[3], 255);
  if (lineAlign === 'left') left = result;
  synthetic.push({ lineAlign, bounds: result.bounds, lines: result.lines, measured: canvases.at(-1).measured, draws: canvases.at(-1).draws });
}
assert.deepEqual(wrap(base), left); released();
const noDpr = { ...base }; delete noDpr.dpr;
const defaultDpr = wrap(noDpr); released(); assert.equal(defaultDpr.dpr, 1);
assert.equal(defaultDpr.asset.width, 21); assert.equal(defaultDpr.asset.height, 28);
assert.deepEqual(Object.keys(left), ['asset', 'font', 'dpr', 'advance', 'bounds', 'layout', 'lineAdvance', 'lines', 'maxWidth']);
assert.deepEqual(Object.keys(left.lines[0]), ['textStart', 'textEnd', 'baseline', 'advance']);
const exact = wrap({ ...base, maxWidth: 12.5 }); released(); assert.deepEqual(exact.lines, lineRecords);
const narrower = wrap({ ...base, maxWidth: 12.49 }); released();
assert.deepEqual(narrower.lines, [{ textStart: 0, textEnd: 2, baseline: 0, advance: 9.5 }, { textStart: 3, textEnd: 5, baseline: 12.25, advance: 8.25 }, { textStart: 6, textEnd: 7, baseline: 24.5, advance: 3.5 }]);
function refuseBeforeDrawing(name, input, code) {
  const before = { measure, draw, read }; reject(name, input, code); released();
  assert.equal(draw, before.draw); assert.equal(read, before.read); assert.ok(measure - before.measure <= 128);
  assert.deepEqual(canvases.at(-1).writes, [['width', 0], ['height', 0]]);
}
refuseBeforeDrawing('unsplit long word', { ...base, text: 'AV', maxWidth: 9.49 }, 'ASSET_LIMIT');
refuseBeforeDrawing('configured alignment coordinate limit', { ...base, text: 'j', maxWidth: 1e6, lineAlign: 'right' }, 'INVALID_ASSET');
mode = 'lineCap';
refuseBeforeDrawing('fifth wrapped line', { ...base, text: 'A B C D E', maxWidth: 1 }, 'ASSET_LIMIT');
const four = wrap({ ...base, text: 'A B C D', maxWidth: 1 }); released(); assert.equal(four.lines.length, 4); assert.equal(canvases.at(-1).draws.length, 4);
refuseBeforeDrawing('baseline displacement', { ...base, text: 'A B C D', maxWidth: 1, lineAdvance: 333334 }, 'INVALID_ASSET');
mode = 'maxWork';
const maximum = wrap({ ...base, text: Array(63).fill('A').join(' ') + ' AA', maxWidth: 128, dpr: 1 }); released();
assert.equal(maximum.layout.text.length, 128); assert.ok(canvases.at(-1).measured.length <= 128); assert.equal(canvases.at(-1).draws.length, 1);
mode = 'words'; refuseBeforeDrawing('height cap', { ...base, lineAdvance: 200, dpr: 2 }, 'ASSET_LIMIT');
for (const bad of ['badMetric', 'fontNotReady']) { mode = bad; refuseBeforeDrawing(bad, base, 'INVALID_ASSET'); }
for (const bad of ['drawThrow', 'noInk', 'short']) { mode = bad; reject(bad, base, 'INVALID_ASSET'); released(); }
mode = 'constant';
const oldInput = { text: ' A \nB', font: base.font, atlasId: base.atlasId, lineAdvance: 12.25, dpr: 1.5 };
const oldMulti = multi(oldInput); released(); assert.deepEqual(oldMulti, multi({ ...oldInput, lineAlign: 'left' })); released();
assert.deepEqual(oldMulti.bounds, { left: -4, top: -10, width: 16, height: 27.333333333333332 });
const oldSingle = single({ text: 'HI', font: base.font, atlasId: base.atlasId, dpr: 1.5 });
assert.deepEqual(Object.keys(oldSingle), ['asset', 'font', 'dpr', 'advance', 'bounds', 'layout']); assert.equal(canvases.at(-1).width, 24);
assert.throws(() => single({ text: 'A', font: base.font, atlasId: base.atlasId, maxWidth: 10 }), error => error.code === 'INVALID_SCENE');
assert.throws(() => multi({ ...oldInput, maxWidth: 10 }), error => error.code === 'INVALID_SCENE');
delete globalThis.document;
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_TEXT_MODULE ? 'source-bundle' : 'compiled-root',
  refusals: refusals.length, getters, domReads, completeCandidateGreedy: true, nonadditiveWidths: true, exactWidthBoundary: true,
  configuredWidthAlignment: true, originalTextRanges: true, noWordSplit: true, fourLineCap: true, boundedWork: true,
  copiedRGBA: true, multilineCleanup: true, refusalDrawReadDelta0: true, defaultExplicitLeftEqual: true, defaultDpr1: true, priorHelpersRetained: true,
  synthetic, refusalCases: refusals }, null, 2));
