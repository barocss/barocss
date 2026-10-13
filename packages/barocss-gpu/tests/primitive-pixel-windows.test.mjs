/** Synthetic unit tests only. Real WebGPU/WebGL2 samples are still required by #1512. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePixelWindow } from '../../../examples/gpu-scene/primitive-pixel-windows.mjs';

test('same RGBA backing pixels are equal at zero tolerance', () => {
  const pixels = Uint8Array.from([10, 20, 30, 255, 40, 50, 60, 255]);
  const result = comparePixelWindow(pixels, pixels.slice(), 2, 1, { x: 0, y: 0, width: 2, height: 1 }, 0);
  assert.equal(result.changedPixels, 0);
  assert.equal(result.outsideTolerancePixels, 0);
  assert.equal(result.withinTolerance, true);
});

test('declared window ignores outside pixels and measures per-channel differences', () => {
  const before = Uint8Array.from([0, 0, 0, 255, 10, 10, 10, 255]);
  const after = Uint8Array.from([255, 0, 0, 255, 12, 10, 10, 255]);
  const inner = comparePixelWindow(before, after, 2, 1, { x: 1, y: 0, width: 1, height: 1 }, 2);
  assert.equal(inner.changedPixels, 1);
  assert.equal(inner.outsideTolerancePixels, 0);
  assert.equal(inner.maxChannelDelta, 2);
  assert.equal(inner.meanChannelDelta, 0.5);
  const full = comparePixelWindow(before, after, 2, 1, { x: 0, y: 0, width: 2, height: 1 }, 2);
  assert.equal(full.outsideTolerancePixels, 1);
  assert.equal(full.withinTolerance, false);
});

test('reject malformed pixel arrays, windows and tolerances without truncation', () => {
  const bytes = new Uint8Array(8);
  const win = { x: 0, y: 0, width: 2, height: 1 };
  assert.throws(() => comparePixelWindow(bytes, new Uint8Array(7), 2, 1, win, 0), TypeError);
  assert.throws(() => comparePixelWindow(bytes, bytes, 2, 1, { x: 1, y: 0, width: 2, height: 1 }, 0), RangeError);
  assert.throws(() => comparePixelWindow(bytes, bytes, 2, 1, win, 0.5), RangeError);
});
