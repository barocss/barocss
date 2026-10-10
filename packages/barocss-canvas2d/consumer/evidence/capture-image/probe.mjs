import assert from 'node:assert/strict';
const { Canvas2DRenderer, Canvas2DError } = await import(process.env.BAROCSS_CAPTURE_MODULE ?? '../../../dist/index.js');
function mock({ width = 1, height = 1, dpr = 1, bytes = [0, 0, 0, 0],
  disposed = false, lost = false, gpu = {}, glLost = false, loseAfterRead = false,
  readError = 0, readThrow = null, renderThrow = null, canvasWidth, canvasHeight } = {}) {
  const renderer = Object.create(Canvas2DRenderer.prototype);
  const source = new Uint8Array(bytes);
  const counts = { render: 0, read: 0, getError: 0 };
  const calls = [], readBuffers = [], events = [];
  const gl = { RGBA: 6408, UNSIGNED_BYTE: 5121, NO_ERROR: 0,
    isContextLost() { return glLost || (loseAfterRead && counts.read > 0); },
    getError() { counts.getError++; return readError; },
    readPixels(x, y, w, h, format, type, target) {
      counts.read++; events.push('read'); calls.push([x, y, w, h, format, type]); readBuffers.push(target);
      if (readThrow) throw readThrow;
      assert.equal(target.length, w * h * 4); assert.ok(target instanceof Uint8Array);
      target.set(source);
    } };
  Object.assign(renderer, { disposed, lost, gpu, gl, size: { width, height }, dpr,
    canvas: { width: canvasWidth ?? Math.ceil(width * dpr), height: canvasHeight ?? Math.ceil(height * dpr) },
    scene: { sentinel: 'accepted' }, view: { panX: 2, panY: 3, zoom: 1 },
    backgroundColor: [0.1, 0.2, 0.3, 0.4], assets: new Map([['Retained', { sentinel: true }]]),
    render() { counts.render++; events.push('render'); if (renderThrow) throw renderThrow; } });
  return { renderer, source, counts, calls, readBuffers, events };
}
function keptState(renderer) {
  return { scene: renderer.scene, view: renderer.view, backgroundColor: renderer.backgroundColor,
    assets: renderer.assets, canvas: renderer.canvas, size: renderer.size, dpr: renderer.dpr, gpu: renderer.gpu };
}
function stateBytes(renderer) { return JSON.stringify({ ...keptState(renderer), assets: [...renderer.assets] }); }
function captureFixture(name, settings, expected) {
  const test = mock(settings), before = keptState(test.renderer), beforeBytes = stateBytes(test.renderer);
  const result = test.renderer.captureImageAsset();
  assert.deepEqual(Object.keys(result), ['width', 'height', 'pixels']);
  assert.deepEqual([...result.pixels], expected, name); assert.ok(result.pixels instanceof Uint8Array);
  assert.equal(result.width, test.renderer.canvas.width); assert.equal(result.height, test.renderer.canvas.height);
  assert.deepEqual(test.counts, { render: 1, read: 1, getError: 1 });
  assert.deepEqual(test.events, ['render', 'read']);
  assert.deepEqual(test.calls, [[0, 0, result.width, result.height, 6408, 5121]]);
  assert.deepEqual(keptState(test.renderer), before);
  for (const key of Object.keys(before)) assert.equal(keptState(test.renderer)[key], before[key]);
  assert.equal(stateBytes(test.renderer), beforeBytes);
  assert.deepEqual([...test.source], settings.bytes);
  return { name, width: result.width, height: result.height, pixels: [...result.pixels], counts: test.counts };
}
// Input rows are bottom-to-top. Expected bytes are independent top-to-bottom literals.
const odd = captureFixture('odd rows and quantized channels', { width: 2, height: 3, bytes: [
  10, 20, 30, 255, 5, 6, 7, 0,
  32, 64, 128, 128, 64, 1, 0, 64,
  1, 2, 3, 2, 10, 11, 12, 255
] }, [128, 255, 255, 2, 10, 11, 12, 255,
  64, 128, 255, 128, 255, 4, 0, 64,
  10, 20, 30, 255, 0, 0, 0, 0]);
const even = captureFixture('even rows', { width: 1, height: 2, bytes: [128, 0, 0, 128, 0, 64, 0, 128] },
  [0, 128, 0, 128, 255, 0, 0, 128]);
const single = captureFixture('single row', { bytes: [64, 32, 16, 128] }, [128, 64, 32, 128]);
const dpr = captureFixture('fractional DPR ceiling', { width: 1.25, height: 1.25, dpr: 1.5,
  bytes: [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255] },
  [7, 8, 9, 255, 10, 11, 12, 255, 1, 2, 3, 255, 4, 5, 6, 255]);
const copy = mock({ bytes: [64, 32, 16, 128] });
const first = copy.renderer.captureImageAsset(), second = copy.renderer.captureImageAsset();
assert.notEqual(first.pixels, second.pixels); assert.notEqual(copy.readBuffers[0], copy.readBuffers[1]);
first.pixels.fill(0); assert.deepEqual([...second.pixels], [128, 64, 32, 128]);
assert.deepEqual([...copy.source], [64, 32, 16, 128]);
const third = copy.renderer.captureImageAsset(); assert.deepEqual([...third.pixels], [128, 64, 32, 128]);
assert.deepEqual(copy.counts, { render: 3, read: 3, getError: 3 });
const failures = [];
function rejects(name, settings, code, expectedRender = 0, expectedRead = 0) {
  const test = mock(settings), before = keptState(test.renderer), beforeBytes = stateBytes(test.renderer);
  assert.throws(() => test.renderer.captureImageAsset(), error => error instanceof Canvas2DError && error.code === code, name);
  assert.equal(test.counts.render, expectedRender); assert.equal(test.counts.read, expectedRead);
  assert.deepEqual(keptState(test.renderer), before);
  assert.equal(stateBytes(test.renderer), beforeBytes);
  failures.push({ name, code, render: test.counts.render, read: test.counts.read });
}
rejects('disposed before capture', { disposed: true }, 'DISPOSED');
rejects('tracked loss before capture', { lost: true }, 'CONTEXT_LOST');
rejects('missing GPU before capture', { gpu: null }, 'CONTEXT_LOST');
rejects('GL loss before capture', { glLost: true }, 'CONTEXT_LOST');
rejects('backing width mismatch', { canvasWidth: 2 }, 'INVALID_SIZE');
rejects('backing height mismatch', { canvasHeight: 2 }, 'INVALID_SIZE');
rejects('one MiB limit before capture', { width: 1024, height: 257 }, 'ASSET_LIMIT');
rejects('readback GL error', { readError: 1282 }, 'INVALID_ASSET', 1, 1);
rejects('loss during readback', { loseAfterRead: true }, 'CONTEXT_LOST', 1, 1);
const renderError = new Error('render sentinel'), renderFailure = mock({ renderThrow: renderError });
assert.throws(() => renderFailure.renderer.captureImageAsset(), error => error === renderError);
assert.equal(renderFailure.counts.render, 1); assert.equal(renderFailure.counts.read, 0);
const readError = new Error('read sentinel'), readFailure = mock({ readThrow: readError });
assert.throws(() => readFailure.renderer.captureImageAsset(), error => error === readError);
assert.equal(readFailure.counts.render, 1); assert.equal(readFailure.counts.read, 1);
// The exact byte cap is admitted, with no constructor or WebGL setup in this mock.
const limit = mock({ width: 1024, height: 256, bytes: new Array(1048576).fill(0) });
const admitted = limit.renderer.captureImageAsset(); assert.equal(admitted.pixels.length, 1048576);
assert.deepEqual(limit.counts, { render: 1, read: 1, getError: 1 });
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_CAPTURE_MODULE ? 'source-bundle' : 'compiled-root',
  prototypeMock: true, odd, even, single, dpr, alphaZeroClearsRGB: true, quantizedUnpremultiply: true, channelsClamp255: true,
  independentCopies: true, retainedState: true, exactOneMiBAdmitted: true, beforeRenderReadRefusals: 7,
  renderThrowPreserved: true, readThrowPreserved: true, failures }, null, 2));
