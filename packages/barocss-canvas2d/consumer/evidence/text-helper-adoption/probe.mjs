import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// This is focused synthetic host evidence. Fake fonts, metrics, pixels and
// timers do not prove platform font loading, raster paint, pointer or GPU work.
const rootURL = new URL('../../../dist/index.js', import.meta.url).href;
const { Canvas2DError, rasterizeBrowserText } = await import(rootURL);
const hostSource = await readFile(new URL('../../text-raster-host.mjs', import.meta.url), 'utf8');
assert.ok(hostSource.includes('@barocss/canvas2d'), 'host must consume the public package root');
const compiledHost = hostSource.replace(/(['"])@barocss\/canvas2d\1/g, JSON.stringify(rootURL));
const { HostTextError, validateText, prepareRaster, admitRaster, getHostCounts } =
  await import(`data:text/javascript;base64,${Buffer.from(compiledHost).toString('base64')}`);

let refusalCount = 0;
const cases = [];
function expectError(name, error, code, type = HostTextError, original) {
  assert.ok(error instanceof type, `${name}: error class`);
  assert.equal(error.code, code, name);
  if (original) assert.equal(error, original, `${name}: original error identity`);
  refusalCount++;
  cases.push(name);
  return true;
}
function reject(name, operation, code, type, original) {
  return assert.rejects(operation, error => expectError(name, error, code, type, original));
}
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function drain() { for (let step = 0; step < 12; step++) await Promise.resolve(); }

async function environment(config, operation) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const timers = new Map();
  let nextTimer = 1;
  const stats = { fontLoads: 0, fontChecks: 0, canvases: 0, draws: 0, reads: 0,
    resized: 0, clearedTimers: 0, byteLengths: [] };
  globalThis.setTimeout = (callback, delay, ...args) => {
    const id = nextTimer++;
    timers.set(id, { callback: () => callback(...args), delay });
    return id;
  };
  globalThis.clearTimeout = id => { if (timers.delete(id)) stats.clearedTimers++; };
  const fonts = {
    ready: config.ready ?? Promise.resolve(),
    async load(font, text) {
      stats.fontLoads++;
      assert.equal(font, '24px monospace');
      assert.equal(typeof text, 'string');
      if (config.loadError) throw config.loadError;
      return config.loaded ?? [];
    },
    check() { stats.fontChecks++; return config.fontCheck ?? true; },
  };
  const document = {
    fonts,
    createElement(tag) {
      stats.canvases++;
      assert.equal(tag, 'canvas');
      if (config.helperError) throw config.helperError;
      let width = 300;
      let height = 150;
      const context = {
        font: '10px sans-serif',
        setTransform() {}, scale() {},
        measureText() {
          return { width: 48.5, actualBoundingBoxLeft: 1.25, actualBoundingBoxRight: 47.1,
            actualBoundingBoxAscent: 18.25, actualBoundingBoxDescent: 4.5, ...config.metrics };
        },
        fillText() { stats.draws++; },
        getImageData() {
          stats.reads++;
          const data = new Uint8ClampedArray(width * height * 4);
          data[3] = 255;
          stats.byteLengths.push(data.byteLength);
          return { data };
        },
      };
      return {
        get width() { return width; },
        set width(value) { stats.resized++; width = value; context.font = '10px sans-serif'; },
        get height() { return height; },
        set height(value) { stats.resized++; height = value; context.font = '10px sans-serif'; },
        getContext(type) { assert.equal(type, '2d'); return context; },
      };
    },
  };
  if (config.noFonts) delete document.fonts;
  if (config.noLoad) delete fonts.load;
  if (config.noCheck) delete fonts.check;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  function fire(delay) {
    const selected = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(selected, `synthetic timer ${delay} must be scheduled`);
    timers.delete(selected[0]);
    selected[1].callback();
  }
  try { return await operation({ stats, timers, fire }); }
  finally {
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    delete globalThis.document;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  }
}

for (const text of ['Canvas2D', 'HI', 'H I', ' a0 ', 'A'.repeat(32)]) assert.equal(validateText(text), text);
for (const [index, text] of [undefined, null, 1, {}, new String('HI'), '', ' ', 'A'.repeat(33),
  'A\nB', 'A\tB', 'é', '한글', 'A-B', 'A_B', 'A!'].entries()) {
  assert.throws(() => validateText(text), error => expectError(`host text ${index}`, error, 'HOST_TEXT'));
}
for (const delay of [NaN, Infinity, -1, .5, 1001, '1', null]) {
  await environment({}, async ({ stats }) => {
    await reject(`host delay ${String(delay)}`, () => prepareRaster('HI', delay), 'HOST_FONT');
    assert.equal(stats.fontLoads, 0);
    assert.equal(stats.canvases, 0);
  });
}
for (const config of [{ noFonts: true }, { noLoad: true }, { noCheck: true },
  { ready: Promise.reject(new Error('synthetic ready failure')) },
  { loadError: new Error('synthetic load failure') }, { fontCheck: false }]) {
  await environment(config, async ({ stats }) => {
    await reject('host font policy', () => prepareRaster('HI'), 'HOST_FONT');
    assert.equal(stats.canvases, 0);
  });
}

const successful = await environment({}, async ({ stats, timers }) => {
  const result = await prepareRaster('H I');
  assert.ok(result);
  assert.equal(result.text, 'H I');
  assert.equal(result.asset.width, 108);
  assert.equal(result.asset.height, 56);
  assert.equal(result.asset.pixels.length, 24192);
  assert.equal(stats.fontLoads, 1);
  assert.equal(stats.canvases, 1);
  assert.equal(stats.draws, 1);
  assert.equal(stats.reads, 1);
  assert.equal(timers.size, 0, 'font timeout is cleared');
  return { backing: [result.asset.width, result.asset.height], bytes: result.asset.pixels.length };
});

await environment({}, async ({ stats, fire, timers }) => {
  const pending = prepareRaster('HI', 1000);
  await drain();
  assert.equal(stats.fontLoads, 0, 'host delay precedes font preparation');
  assert.equal(stats.canvases, 0);
  fire(1000);
  assert.ok(await pending);
  assert.equal(stats.fontLoads, 1);
  assert.equal(stats.canvases, 1);
  assert.equal(timers.size, 0);
});

await environment({}, async ({ stats }) => {
  const before = getHostCounts().helperCalls;
  assert.equal(await prepareRaster('HI', 0, () => false), null);
  assert.equal(stats.canvases, 0, 'already superseded host creates no helper scratch');
  assert.equal(getHostCounts().helperCalls, before);
});
for (const reason of ['superseded', 'disposed']) {
  const ready = deferred();
  await environment({ ready: ready.promise }, async ({ stats, timers }) => {
    const before = getHostCounts().helperCalls;
    let current = true;
    const pending = prepareRaster('HI', 0, () => current);
    await drain();
    current = false;
    ready.resolve();
    assert.equal(await pending, null, `${reason} readiness completion ignored`);
    assert.equal(stats.canvases, 0, `${reason}: no public helper scratch`);
    assert.equal(stats.draws, 0);
    assert.equal(getHostCounts().helperCalls, before);
    assert.equal(timers.size, 0);
  });
}

const lateReady = deferred();
await environment({ ready: lateReady.promise }, async ({ stats, fire, timers }) => {
  const before = getHostCounts().helperCalls;
  const pending = prepareRaster('HI');
  const rejection = reject('controlled unresolved ready timeout', () => pending, 'HOST_FONT_TIMEOUT');
  await drain();
  fire(5000);
  await rejection;
  lateReady.resolve();
  await drain();
  assert.equal(stats.canvases, 0, 'late timeout completion creates no helper raster');
  assert.equal(getHostCounts().helperCalls, before);
  assert.equal(timers.size, 0);
});

await environment({ metrics: { width: 508, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 508,
  actualBoundingBoxAscent: 60, actualBoundingBoxDescent: 0 } }, async ({ stats }) => {
  const accepted = await prepareRaster('HI');
  assert.ok(accepted);
  assert.equal(accepted.asset.width, 1024);
  assert.equal(accepted.asset.height, 128);
  assert.equal(accepted.asset.pixels.length, 524288);
  assert.equal(stats.reads, 1);
});
await environment({ metrics: { width: 508, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 508,
  actualBoundingBoxAscent: 61, actualBoundingBoxDescent: 0 } }, async ({ stats }) => {
  await reject('narrower host cap after helper', () => prepareRaster('HI'), 'HOST_RASTER_LIMIT');
  assert.equal(stats.canvases, 1, 'host cap is evaluated after bounded helper scratch');
  assert.equal(stats.draws, 1);
  assert.equal(stats.reads, 1);
  assert.deepEqual(stats.byteLengths, [532480]);
});
const originalError = new Canvas2DError('INVALID_ASSET', 'synthetic public helper refusal');
await environment({ helperError: originalError }, async () => {
  await reject('public classified refusal', () => prepareRaster('HI'), 'INVALID_ASSET', Canvas2DError, originalError);
});
await environment({}, async () => {
  const prepared = rasterizeBrowserText({ text: 'HI', font: '24px monospace', dpr: 2, atlasId: 'TextAtlas' });
  const admitted = admitRaster(prepared, 2);
  assert.equal(admitted.asset, prepared.asset, 'host reuses public copied asset');
  assert.equal(admitted.layout, prepared.layout, 'host reuses public whole-label layout');
  assert.equal(admitted.font.loadedFaces, 2);
  assert.equal(admitted.font.style, prepared.font);
  assert.equal(admitted.bounds.advance, prepared.advance);
});

console.log(JSON.stringify({ scope: 'synthetic existing text host adoption policy', refusalCount, cases,
  successful, acceptedHostMaximum: { width: 1024, height: 128, bytes: 524288 },
  narrowerHostCapAfterHelper: true, staleBeforeHelper: true, disposedBeforeHelper: true,
  controlledFontTimeout: true, originalCanvas2DErrorRetained: true,
  actualFontLoading: false, browserPaint: false, pointer: false, gpu: false,
  historicalProbeRun: false, providerRefusalReplay: false,
  firstFailures: ['read command used repo-relative path from package cwd',
    'removed invented malformed-byte admission assertion: host narrows trusted public output',
    'type command first used missing package-local TypeScript path; retried existing workspace TypeScript'] }));
