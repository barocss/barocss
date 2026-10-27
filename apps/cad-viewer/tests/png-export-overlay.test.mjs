import test from 'node:test';
import assert from 'node:assert/strict';
import { createPngExport } from '../png-export.js';

// These tests exercise export scheduling and drawing commands with a mock 2D context.
// A real browser is needed to verify encoded PNG pixels and font rendering.
test('PNG export snapshots the measurement overlay and rejects stale frames', async () => {
  const original = { document: globalThis.document, ImageData: globalThis.ImageData,
    createURL: URL.createObjectURL, revokeURL: URL.revokeObjectURL };
  const calls = [], states = [];
  let reads = 0, downloads = 0, frame = 1, resolveRead;
  const rect = { width: 100, height: 50 };
  const context = new Proxy({}, { get(target, name) {
    if (name === 'measureText') return text => ({ width: text.length * 6 });
    if (name in target) return target[name];
    return (...args) => { calls.push([name, ...args]); };
  }, set(target, name, value) { target[name] = value; return true; } });
  globalThis.document = { createElement(name) {
    if (name === 'a') return { click() { downloads++; } };
    return { getContext() { return context; }, toBlob(callback) { callback(new Blob(['png'])); } };
  } };
  globalThis.ImageData = class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };
  URL.createObjectURL = () => 'blob:mock'; URL.revokeObjectURL = () => {};
  const canvas = { width: 200, height: 150, getBoundingClientRect: () => ({ ...rect }) };
  const viewer = { readPixels() { reads++; return new Promise(resolve => { resolveRead = resolve; }); } };
  const exporter = createPngExport({ viewer, canvas, onChange: value => states.push(value),
    isLoaded: () => true, frameGuard: () => frame, generation: () => 1 });
  const pixels = () => new Uint8Array(canvas.width * canvas.height * 4);
  try {
    const first = exporter.exportImage();
    resolveRead(pixels()); await first;
    assert.equal(downloads, 1);
    assert.equal(calls.filter(([name]) => name === 'scale').length, 0);

    calls.length = 0;
    const overlay = { width: 100, height: 50, distanceMM: 8,
      points: [{ label: 'A', xCss: 10, yCss: 10 }, { label: 'B', xCss: 90, yCss: 30 }] };
    const second = exporter.exportImage({ overlay });
    overlay.points[0].xCss = 99; overlay.distanceMM = 100;
    resolveRead(pixels()); await second;
    assert.equal(downloads, 2);
    assert.ok(calls.some(call => call[0] === 'scale' && call[1] === 2 && call[2] === 3));
    assert.ok(calls.some(call => call[0] === 'arc' && call[1] === 10 && call[2] === 10));
    assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '8 mm'));
    assert.ok(calls.some(call => call[0] === 'lineTo' && call[1] === 90 && call[2] === 30));

    calls.length = 0;
    const offscreen = exporter.exportImage({ overlay: { width: 100, height: 50, distanceMM: 4.1231064,
      points: [{ label: 'A', xCss: -1, yCss: 10 }, { label: 'B', xCss: 101, yCss: 20 }] } });
    resolveRead(pixels()); await offscreen;
    assert.ok(!calls.some(([name]) => name === 'arc' || name === 'lineTo'));
    assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '4.123106 mm'));
    assert.equal(downloads, 3);

    calls.length = 0;
    const huge = exporter.exportImage({ overlay: { width: 100, height: 50, points: [], distanceMM: 1.25e30 } });
    resolveRead(pixels()); await huge;
    assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '1.25e+30 mm'));
    assert.equal(downloads, 4);

    const stale = exporter.exportImage({ overlay: { width: 100, height: 50, points: [], distanceMM: 0 } });
    frame++; resolveRead(pixels()); await stale;
    assert.equal(downloads, 4);
    assert.match(states.at(-1).status, /view changed/i);

    const resize = exporter.exportImage({ overlay: { width: 100, height: 50, points: [], distanceMM: 0 } });
    rect.width = 101; resolveRead(pixels()); await resize;
    assert.equal(downloads, 4);
    assert.match(states.at(-1).status, /size changed/i);
    assert.equal(reads, 6);
  } finally {
    exporter.dispose();
    globalThis.document = original.document; globalThis.ImageData = original.ImageData;
    URL.createObjectURL = original.createURL; URL.revokeObjectURL = original.revokeURL;
  }
});
