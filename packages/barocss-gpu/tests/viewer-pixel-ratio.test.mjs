// CPU boundary checks against the emitted Viewer. No browser, native GPU or rendering benchmark.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewer, ViewerError } from '../dist/viewer/viewer.js';

const invalid = [NaN, Infinity, -Infinity, 0, -0, -2];
const sizeError = error => error instanceof ViewerError && error.code === 'SIZE_INVALID';

function fixture({ width = 320, height = 180, cssWidth = 201, cssHeight = 101, limit = 8192 } = {}) {
  const writes = [], meshes = [{ dirty: false, geometry: { identity: 'retained' } }, { dirty: true }];
  const state = { width, height, requests: 0 };
  const canvas = {
    clientWidth: cssWidth, clientHeight: cssHeight,
    get width() { return state.width; },
    set width(value) { writes.push(['width', value]); state.width = value; },
    get height() { return state.height; },
    set height(value) { writes.push(['height', value]); state.height = value; },
  };
  const device = { limits: { maxTextureDimension2D: limit } };
  const viewer = Object.assign(Object.create(Viewer.prototype), {
    canvas, meshes, device, pixelRatio: 1, scheduled: 73,
    requestRender() { state.requests++; },
  });
  return { viewer, canvas, meshes, device, state, writes };
}

test('resize refuses invalid pixel ratios before changing backing size, meshes or scheduling', () => {
  for (const ratio of invalid) {
    const f = fixture(), geometry = f.meshes[0].geometry;
    assert.throws(() => f.viewer.resize(ratio), sizeError, String(ratio));
    assert.equal(f.viewer.pixelRatio, 1);
    assert.strictEqual(f.viewer.canvas, f.canvas);
    assert.strictEqual(f.viewer.meshes, f.meshes);
    assert.strictEqual(f.viewer.device, f.device);
    assert.strictEqual(f.meshes[0].geometry, geometry);
    assert.deepEqual(f.meshes.map(mesh => mesh.dirty), [false, true]);
    assert.deepEqual(f.state, { width: 320, height: 180, requests: 0 });
    assert.deepEqual(f.writes, [], 'not even an unchanged canvas dimension is assigned');
    assert.equal(f.viewer.scheduled, 73);
  }
});

test('Viewer.create refuses invalid explicit pixel ratios before GPU or canvas context access', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let gpuAccesses = 0, contextAccesses = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    get gpu() { gpuAccesses++; throw new Error('GPU must not be accessed'); },
  } });
  const canvas = { width: 320, height: 180, getContext() { contextAccesses++; throw new Error('Context must not be accessed'); } };
  try {
    for (const pixelRatio of invalid) {
      await assert.rejects(Viewer.create(canvas, { pixelRatio, controls: false, autoResize: false }), sizeError, String(pixelRatio));
      assert.equal(gpuAccesses, 0);
      assert.equal(contextAccesses, 0);
      assert.equal(canvas.width, 320);
      assert.equal(canvas.height, 180);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});

test('positive fractional pixel ratio preserves rounding, dirty marking and one render request', () => {
  const f = fixture();
  f.viewer.resize(1.5);
  assert.equal(f.viewer.pixelRatio, 1.5);
  assert.deepEqual(f.state, { width: 302, height: 152, requests: 1 });
  assert.deepEqual(f.meshes.map(mesh => mesh.dirty), [true, true]);
  assert.deepEqual(f.writes, [['width', 302], ['height', 152]]);
  f.writes.length = 0;
  f.meshes[0].dirty = false;
  f.viewer.resize();
  assert.equal(f.state.requests, 1, 'unchanged dimensions and ratio do not request another render');
  assert.deepEqual(f.writes, []);
  assert.equal(f.meshes[0].dirty, false);
});

test('valid ratio retains device size cap and does not replace mesh or geometry identities', () => {
  const f = fixture({ limit: 256 }), geometry = f.meshes[0].geometry;
  f.viewer.resize(1.5);
  assert.equal(f.state.width, 256);
  assert.equal(f.state.height, 152);
  assert.equal(f.state.requests, 1);
  assert.strictEqual(f.viewer.meshes, f.meshes);
  assert.strictEqual(f.meshes[0].geometry, geometry);
});
