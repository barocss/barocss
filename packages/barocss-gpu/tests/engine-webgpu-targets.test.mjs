/** Structural fake-device tests only, not physical WebGPU texture evidence. */
import assert from 'node:assert/strict';
import test from 'node:test';
import './engine-webgpu-readback.test.mjs';
import { createEngineWebGPURenderTargets } from '../dist/engine-webgpu-targets.js';

function mock(failDepth = false) {
  const events = [];
  const textures = [];
  const device = {
    limits: { maxTextureDimension2D: 4096 },
    createTexture(descriptor) {
      events.push(['create', descriptor]);
      if (failDepth && descriptor.format === 'depth24plus') throw Error('depth allocation refused');
      const id = textures.length;
      const texture = {
        createView() { return {}; },
        destroy() { events.push(['destroy', id]); },
      };
      textures.push(texture); return texture;
    },
  };
  return { device, events };
}
test('opaque color and shared-depth target have correct usages and owned cleanup', () => {
  const { device, events } = mock();
  const t = createEngineWebGPURenderTargets(device, 320, 240, 'rgba8unorm');
  assert.equal(t.logicalBytes, 320 * 240 * 8);
  assert.equal(t.width, 320);
  assert.deepEqual(events.filter(e => e[0] === 'create').map(e => e[1].format),
    ['rgba8unorm', 'depth24plus']);
  assert.equal(events[0][1].usage, 17);
  assert.equal(events[1][1].usage, 16);
  assert.deepEqual(events[0][1].size, { width: 320, height: 240, depthOrArrayLayers: 1 });
  t.dispose(); t.dispose();
  assert.deepEqual(events.filter(e => e[0] === 'destroy').map(e => e[1]), [0, 1]);
});
test('second texture failure disposes first and preserves initial exception', () => {
  const { device, events } = mock(true);
  assert.throws(() => createEngineWebGPURenderTargets(device, 16, 16, 'bgra8unorm'),
    /depth allocation refused/);
  assert.deepEqual(events.filter(e => e[0] === 'destroy').map(e => e[1]), [0]);
});
test('dimension, device limit and format refusals precede any allocation', () => {
  const { device, events } = mock();
  assert.throws(() => createEngineWebGPURenderTargets(device, 0, 16, 'rgba8unorm'), RangeError);
  assert.throws(() => createEngineWebGPURenderTargets(device, 4096, 16, 'rgba8unorm'), RangeError);
  device.limits.maxTextureDimension2D = 64;
  assert.throws(() => createEngineWebGPURenderTargets(device, 65, 16, 'rgba8unorm'), RangeError);
  assert.throws(() => createEngineWebGPURenderTargets(device, 16, 16, 'rgba16float'), TypeError);
  assert.deepEqual(events, []);
});
