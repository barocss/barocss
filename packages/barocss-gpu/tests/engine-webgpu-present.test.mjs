/** Software-only command sequencing, not a real browser/device result. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { presentEngineWebGPUColor } from '../dist/engine-webgpu-present.js';

function harness(rejectQueue = false) {
  const calls = [], source = { tag: 'source' }, destination = { tag: 'backing' };
  const device = {
    limits: { maxTextureDimension2D: 4096 },
    createCommandEncoder() { calls.push('encoder'); return {
      copyTextureToTexture(from, to, extent) { calls.push({ from, to, extent }); },
      finish() { calls.push('finish'); return 'commands'; },
    }; },
    queue: {
      submit(commands) { calls.push(['submit', commands]); },
      async onSubmittedWorkDone() { calls.push('completed'); if (rejectQueue) throw Error('queue refused'); },
    },
  };
  const context = { getCurrentTexture() { calls.push('backing'); return destination; } };
  return { device, context, source, destination, calls };
}
test('offscreen texture copies to actual canvas backing before queue completion', async () => {
  const h = harness();
  await presentEngineWebGPUColor(h.device, h.context, h.source, 320, 240);
  assert.equal(h.calls[0], 'backing');
  assert.equal(h.calls[1], 'encoder');
  assert.deepEqual(h.calls[2], { from: { texture: h.source }, to: { texture: h.destination },
    extent: { width: 320, height: 240, depthOrArrayLayers: 1 } });
  assert.deepEqual(h.calls.slice(-3), ['finish', ['submit', ['commands']], 'completed']);
});
test('invalid backing extent refuses without touching canvas/device', async () => {
  const h = harness();
  await assert.rejects(presentEngineWebGPUColor(h.device, h.context, h.source, 0, 240), RangeError);
  h.device.limits.maxTextureDimension2D = 64;
  await assert.rejects(presentEngineWebGPUColor(h.device, h.context, h.source, 320, 240), RangeError);
  assert.deepEqual(h.calls, []);
});
test('actual queue-completion rejection propagates to presentation caller', async () => {
  const h = harness(true);
  await assert.rejects(presentEngineWebGPUColor(h.device, h.context, h.source, 32, 32), /queue refused/);
});
