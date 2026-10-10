import assert from 'node:assert/strict';

// This probe uses synthetic metrics and RGBA bytes. It does not prove browser
// font matching, Canvas rasterization, pointer routing or WebGL behavior.
const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let browserReads = 0;
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  get() { browserReads++; throw new Error('document read during root import'); },
});
const { rasterizeBrowserText, Canvas2DError } = await import('../../../dist/index.js');
assert.equal(browserReads, 0, 'compiled root import must be inert');
assert.equal(typeof rasterizeBrowserText, 'function');
delete globalThis.document;

const options = { text: 'H I', font: '24px monospace', atlasId: 'label' };
let refusals = 0;
let getterCalls = 0;
const cases = [];
function refuse(name, operation, code, original) {
  assert.throws(operation, error => {
    assert.ok(error instanceof Canvas2DError, name);
    assert.equal(error.code, code, name);
    if (original) assert.equal(error, original, `${name}: retain classified error`);
    return true;
  });
  refusals++;
  cases.push(name);
}

const baseMetrics = {
  width: 27.25,
  actualBoundingBoxLeft: 1.25,
  actualBoundingBoxRight: 26.2,
  actualBoundingBoxAscent: 15.2,
  actualBoundingBoxDescent: 3.1,
};

function browser(config = {}) {
  const stats = { created: 0, contexts: 0, resized: 0, draws: [], reads: [],
    checks: [], fonts: [], transforms: [], scales: [], sourceBytes: [] };
  const failAt = name => {
    if (config.failAt === name) throw config.error ?? new Error(`synthetic ${name} failure`);
  };
  const document = {
    fonts: {
      check(font, text) {
        stats.checks.push({ font, text });
        failAt('check');
        return config.ready ?? true;
      },
    },
    createElement(tag) {
      stats.created++;
      assert.equal(tag, 'canvas');
      failAt('allocation');
      let width = 300;
      let height = 150;
      let font = '10px sans-serif';
      const context = {
        get font() { return font; },
        set font(value) {
          stats.fonts.push(value);
          // Invalid declarations are ignored, as in the Canvas font setter.
          if (value === 'invalid font syntax') return;
          font = value.trim().replace(/\s+/g, ' ');
        },
        measureText(text) {
          failAt('measure');
          assert.equal(typeof text, 'string');
          return { ...baseMetrics, ...config.metrics };
        },
        setTransform(...values) { stats.transforms.push(values); failAt('transform'); },
        resetTransform() { stats.transforms.push([1, 0, 0, 1, 0, 0]); failAt('transform'); },
        scale(...values) { stats.scales.push(values); failAt('scale'); },
        fillText(...values) {
          assert.equal(context.textAlign, 'left');
          assert.equal(context.textBaseline, 'alphabetic');
          assert.equal(context.direction, 'ltr');
          assert.ok(context.fillStyle === '#ffffff' || context.fillStyle === 'white');
          assert.equal(context.globalAlpha, 1);
          assert.equal(context.globalCompositeOperation, 'source-over');
          assert.equal(context.fontKerning, 'auto');
          assert.equal(context.letterSpacing, '0px');
          assert.equal(context.wordSpacing, '0px');
          stats.draws.push(values);
          failAt('draw');
        },
        letterSpacing: '0px',
        wordSpacing: '0px',
        clearRect() { failAt('clear'); },
        getImageData(...values) {
          stats.reads.push(values);
          failAt('read');
          const pixels = new Uint8ClampedArray(width * height * 4 + (config.byteDelta ?? 0));
          if (!config.emptyInk && pixels.length >= 4) pixels.set([9, 20, 30, 255]);
          stats.sourceBytes.push(pixels);
          return { data: config.badData ?? pixels, width, height };
        },
      };
      for (const key of config.missingMethods ?? []) delete context[key];
      const canvas = {
        get width() { return width; },
        set width(value) { failAt('resize'); stats.resized++; width = value; font = '10px sans-serif'; },
        get height() { return height; },
        set height(value) { failAt('resize'); stats.resized++; height = value; font = '10px sans-serif'; },
        getContext(type, attributes) {
          stats.contexts++;
          assert.equal(type, '2d');
          assert.equal(attributes?.willReadFrequently, true);
          failAt('context');
          return config.nullContext ? null : context;
        },
      };
      if (config.missingContextAPI) delete canvas.getContext;
      return canvas;
    },
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  return { stats, document };
}

try {
  refuse('nonbrowser call', () => rasterizeBrowserText(options), 'UNSUPPORTED_FEATURE');

  // Validation must finish without reading any browser API or invoking getters.
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    get() { browserReads++; throw new Error('browser touched before input admission'); },
  });
  for (const [index, value] of [undefined, null, [], 'text', 1, false,
    Object.assign(Object.create(null), options),
    Object.assign(Object.create({ inherited: true }), options)].entries()) {
    refuse(`options record ${index}`, () => rasterizeBrowserText(value), 'INVALID_SCENE');
  }
  refuse('unknown option', () => rasterizeBrowserText({ ...options, extra: true }), 'INVALID_SCENE');
  refuse('symbol option', () => rasterizeBrowserText({ ...options, [Symbol('extra')]: 1 }), 'INVALID_SCENE');
  const hidden = Object.defineProperty({ ...options }, 'dpr', { value: 1, enumerable: false });
  refuse('nonenumerable option', () => rasterizeBrowserText(hidden), 'INVALID_SCENE');
  for (const key of ['text', 'font', 'atlasId', 'dpr']) {
    const accessor = Object.defineProperty({ ...options }, key, {
      enumerable: true,
      get() { getterCalls++; return options[key] ?? 1; },
    });
    refuse(`${key} accessor`, () => rasterizeBrowserText(accessor), 'INVALID_SCENE');
  }
  for (const key of ['text', 'font', 'atlasId']) {
    const missing = { ...options };
    delete missing[key];
    refuse(`missing ${key}`, () => rasterizeBrowserText(missing), 'INVALID_SCENE');
  }
  for (const text of [undefined, null, '', ' ', '   ', 'a\nb', 'a\tb', '한글', 'a!',
    'a'.repeat(129), 12]) {
    refuse(`text ${String(text)}`, () => rasterizeBrowserText({ ...options, text }), 'INVALID_SCENE');
  }
  for (const font of [undefined, null, '', ' ', 'x'.repeat(257), '24px\nserif',
    '24px\rserif', '24px\0serif', 24]) {
    refuse(`font ${String(font)}`, () => rasterizeBrowserText({ ...options, font }), 'INVALID_SCENE');
  }
  for (const dpr of [undefined, null, NaN, Infinity, -Infinity, 0, -0, .9, 4.01, '2']) {
    refuse(`DPR ${String(dpr)}`, () => rasterizeBrowserText({ ...options, dpr }), 'INVALID_SCENE');
  }
  for (const atlasId of [undefined, null, '', 'has space', 'a'.repeat(65), '1label', 4]) {
    refuse(`atlas ${String(atlasId)}`, () => rasterizeBrowserText({ ...options, atlasId }), 'INVALID_ASSET');
  }
  assert.equal(browserReads, 0);
  assert.equal(getterCalls, 0);

  // Browser capability and font admission are distinct from raster failures.
  for (const missing of ['fonts', 'createElement']) {
    const { document } = browser();
    delete document[missing];
    refuse(`missing document.${missing}`, () => rasterizeBrowserText(options), 'UNSUPPORTED_FEATURE');
  }
  {
    const { document } = browser();
    delete document.fonts.check;
    refuse('missing fonts.check', () => rasterizeBrowserText(options), 'UNSUPPORTED_FEATURE');
  }
  for (const config of [{ missingContextAPI: true }, { nullContext: true },
    { missingMethods: ['measureText'] }, { missingMethods: ['setTransform'] },
    { missingMethods: ['scale'] }, { missingMethods: ['fillText'] },
    { missingMethods: ['getImageData'] }]) {
    browser(config);
    refuse(`missing 2D capability ${JSON.stringify(config)}`, () => rasterizeBrowserText(options), 'UNSUPPORTED_FEATURE');
  }
  {
    const { stats } = browser({ ready: false });
    refuse('font not ready', () => rasterizeBrowserText(options), 'INVALID_ASSET');
    assert.equal(stats.draws.length, 0);
  }
  browser();
  refuse('ignored CSS font', () => rasterizeBrowserText({ ...options, font: 'invalid font syntax' }), 'INVALID_SCENE');

  for (const key of Object.keys(baseMetrics)) {
    for (const value of [NaN, Infinity, -Infinity, undefined]) {
      const { stats } = browser({ metrics: { [key]: value } });
      refuse(`${key} ${String(value)}`, () => rasterizeBrowserText(options), 'INVALID_ASSET');
      assert.equal(stats.resized, 0);
      assert.equal(stats.draws.length, 0);
    }
  }
  for (const metrics of [
    { width: -1 }, { actualBoundingBoxLeft: 1_000_001 },
    { actualBoundingBoxRight: 1_000_001 }, { actualBoundingBoxAscent: 1_000_001 },
    { actualBoundingBoxDescent: 1_000_001 },
    { actualBoundingBoxLeft: -10, actualBoundingBoxRight: -10 },
    { actualBoundingBoxAscent: -10, actualBoundingBoxDescent: -10 },
    { actualBoundingBoxLeft: 1_000_000 },
    { actualBoundingBoxAscent: 1_000_000 },
  ]) {
    const { stats } = browser({ metrics });
    refuse(`invalid bounds ${JSON.stringify(metrics)}`, () => rasterizeBrowserText(options), 'INVALID_ASSET');
    assert.equal(stats.resized, 0);
    assert.equal(stats.draws.length, 0);
  }
  for (const metrics of [{ actualBoundingBoxRight: 1024 }, { actualBoundingBoxAscent: 256 }]) {
    const { stats } = browser({ metrics });
    refuse(`positive cap ${JSON.stringify(metrics)}`, () => rasterizeBrowserText(options), 'ASSET_LIMIT');
    assert.equal(stats.resized, 0, 'cap admission precedes bitmap allocation');
    assert.equal(stats.draws.length, 0);
  }

  for (const stage of ['allocation', 'context', 'check', 'measure', 'resize', 'transform', 'scale', 'draw', 'read']) {
    browser({ failAt: stage });
    refuse(`${stage} error`, () => rasterizeBrowserText(options), 'INVALID_ASSET');
  }
  for (const stage of ['allocation', 'context', 'check', 'measure', 'resize', 'draw', 'read']) {
    const error = new Canvas2DError('DISPOSED', 'synthetic classified error');
    browser({ failAt: stage, error });
    refuse(`${stage} classified error`, () => rasterizeBrowserText(options), 'DISPOSED', error);
  }
  for (const config of [{ byteDelta: -4 }, { byteDelta: 4 }, { emptyInk: true }, { badData: [] }]) {
    browser(config);
    refuse(`readback ${JSON.stringify(config)}`, () => rasterizeBrowserText(options), 'INVALID_ASSET');
  }

  const { stats } = browser();
  const first = rasterizeBrowserText({ ...options, font: ' 24px   monospace ', dpr: 1.5 });
  assert.equal(first.font, '24px monospace');
  assert.equal(first.dpr, 1.5);
  assert.equal(first.advance, 27.25);
  // L=-4, R=29, T=-18, B=6; fractional backing rounds outward.
  assert.deepEqual(first.bounds, { left: -4, top: -18, width: 50 / 1.5, height: 36 / 1.5 });
  assert.equal(first.asset.width, 50);
  assert.equal(first.asset.height, 36);
  assert.ok(first.asset.pixels instanceof Uint8Array);
  assert.equal(first.asset.pixels.length, 50 * 36 * 4);
  assert.deepEqual(first.layout, {
    atlasId: 'label', text: 'H I', baseline: 0, opacity: 1, sampling: 'nearest',
    glyphs: [{ sourceRect: { x: 0, y: 0, width: 50, height: 36 },
      x: -4, y: -18, width: 50 / 1.5, height: 36 / 1.5, textStart: 0, textEnd: 3 }],
  });
  assert.deepEqual(stats.draws, [['H I', 4, 18]]);
  assert.deepEqual(stats.reads, [[0, 0, 50, 36]]);
  assert.deepEqual(stats.checks, [{ font: '24px monospace', text: 'H I' }]);
  assert.deepEqual(stats.scales, [[1.5, 1.5]]);
  assert.deepEqual(stats.transforms, [[1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 0]]);
  assert.ok(stats.fonts.filter(value => value === first.font).length >= 2, 'normalized font reapplied after reset');
  assert.notEqual(first.asset.pixels.buffer, stats.sourceBytes[0].buffer);
  stats.sourceBytes[0][0] = 77;
  assert.equal(first.asset.pixels[0], 9, 'readback owns copied bytes');

  const second = rasterizeBrowserText({ ...options, dpr: 1.5 });
  for (const key of ['asset', 'layout', 'bounds']) assert.notEqual(first[key], second[key]);
  assert.notEqual(first.asset.pixels.buffer, second.asset.pixels.buffer);
  assert.notEqual(first.layout.glyphs, second.layout.glyphs);
  assert.notEqual(first.layout.glyphs[0], second.layout.glyphs[0]);
  assert.notEqual(first.layout.glyphs[0].sourceRect, second.layout.glyphs[0].sourceRect);
  first.layout.glyphs[0].sourceRect.width = 1;
  first.bounds.width = 1;
  first.asset.pixels[0] = 88;
  assert.equal(second.layout.glyphs[0].sourceRect.width, 50);
  assert.equal(second.bounds.width, 50 / 1.5);
  assert.equal(second.asset.pixels[0], 9);
  assert.equal(stats.created, 2, 'one detached canvas per call');
  assert.equal(stats.contexts, 2);
  assert.equal(stats.resized, 4);

  browser();
  assert.equal(rasterizeBrowserText(options).dpr, 1, 'absent DPR default');
  browser();
  assert.equal(rasterizeBrowserText({ ...options, dpr: 4 }).dpr, 4, 'maximum DPR');
  for (const font of ['10px serif', '20px monospace']) {
    browser();
    assert.equal(rasterizeBrowserText({ ...options, font }).font, font,
      'valid declaration equal to a sentinel remains accepted');
  }
  browser();
  assert.equal(rasterizeBrowserText({ ...options, text: 'a'.repeat(128), atlasId: 'a'.repeat(64) }).layout.text.length,
    128, 'maximum text and asset ID lengths');
  browser({ metrics: { width: 1020, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 1020,
    actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 252 } });
  const maximum = rasterizeBrowserText(options);
  assert.equal(maximum.asset.width, 1024);
  assert.equal(maximum.asset.height, 256);
  assert.equal(maximum.asset.pixels.length, 1048576, 'caps are inclusive');
  console.log(JSON.stringify({ scope: 'synthetic browser-text admission and ownership only',
    refusals, cases, browserReads, getterCalls, inertRootImport: true,
    fractionalBacking: [50, 36], copiedReadback: true, independentOutputs: true,
    actualFontMatching: false, browserRasterization: false, renderer: false, gpu: false }));
} finally {
  delete globalThis.document;
  if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
}
