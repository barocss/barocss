import test from 'node:test';
import assert from 'node:assert/strict';
import { configureEngineWebGPUCanvas } from '../dist/engine-webgpu-canvas-config.js';
function harness() {
  const events = [], device = { limits: { maxTextureDimension2D: 4096 } };
  const context = {
    configure(d) { events.push(['configure', d]); },
    unconfigure() { events.push(['unconfigure']); },
  };
  return { device, context, events };
}
test('Canvas is configured with COPY_DST for offscreen-to-backing texture copy', () => {
  const h = harness(), lease = configureEngineWebGPUCanvas(h.context, h.device, 320, 240, 'rgba8unorm');
  assert.equal(h.events.length, 1);
  assert.deepEqual(h.events[0], ['configure', {device:h.device, format:'rgba8unorm', alphaMode:'opaque', usage:18}]);
  lease.dispose(); lease.dispose();
  assert.deepEqual(h.events.slice(1), [['unconfigure']]);
});
test('invalid dimensions/format refuse before context configuration', () => {
  const h = harness();
  assert.throws(() => configureEngineWebGPUCanvas(h.context,h.device,0,240,'rgba8unorm'), RangeError);
  assert.throws(() => configureEngineWebGPUCanvas(h.context,h.device,2049,240,'rgba8unorm'), RangeError);
  assert.throws(() => configureEngineWebGPUCanvas(h.context,h.device,64,64,'rgba16float'), TypeError);
  assert.deepEqual(h.events, []);
});
test('native configure error propagates without claiming a lease', () => {
  const h = harness();
  h.context.configure = () => { throw Error('configuration refused'); };
  assert.throws(() => configureEngineWebGPUCanvas(h.context,h.device,64,64,'bgra8unorm'), /configuration refused/);
});
