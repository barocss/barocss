// Device-start failures use local fakes only; no browser, GPU, or shared resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewer } from '../dist/viewer/index.js';

test('viewer destroys the acquired device once when its canvas context is unavailable or throws', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  try {
    for (const mode of ['null','throw','configure']) {
      const sentinel = new Error(`${mode} original failure`), calls = { acquired: 0, destroyed: 0, configured: 0 };
      const device = { destroy() { calls.destroyed++; }, lost: new Promise(() => {}) };
      const gpu = { requestAdapter: async () => ({ requestDevice: async () => { calls.acquired++; return device; } }), getPreferredCanvasFormat: () => 'bgra8unorm' };
      Object.defineProperty(globalThis,'navigator',{ configurable: true, value: { gpu } });
      const canvas = { width: 64, height: 64, getContext(kind) {
        assert.equal(kind,'webgpu');
        if (mode === 'null') return null;
        if (mode === 'throw') throw sentinel;
        return { configure() { calls.configured++; throw sentinel; }, unconfigure() {} };
      } };
      await assert.rejects(Viewer.create(canvas,{ controls: false, autoResize: false }), error => mode === 'null' ? error?.code === 'NO_CONTEXT' : error === sentinel);
      assert.equal(calls.acquired,1,mode); assert.equal(calls.destroyed,1,mode);
      assert.equal(calls.configured,mode === 'configure' ? 1 : 0,mode);
    }
  } finally { if (previous) Object.defineProperty(globalThis,'navigator',previous); else delete globalThis.navigator; }
});
