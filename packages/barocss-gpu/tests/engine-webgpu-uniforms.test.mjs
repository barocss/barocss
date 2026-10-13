import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadEngineWebGPUUniforms } from '../dist/engine-webgpu-uniforms.js';
function setup(fail = '') {
  const events = [], owned = [];
  const device = {
    createBuffer(desc) {
      if (fail === 'draw-create' && owned.length === 1) throw Error('allocation failed');
      const index = owned.length;
      const handle = { destroy() { events.push(['destroy', index]); } };
      owned.push(handle); events.push(['create', desc.size]); return handle;
    },
    queue: { writeBuffer(buffer, offset, data) {
      events.push(['write', owned.indexOf(buffer), offset, data.byteLength]);
      if (fail === 'draw-write' && owned.indexOf(buffer) === 1) throw Error('upload failed');
    } },
    createBindGroup(desc) {
      events.push(['bind', desc]); if (fail === 'bind') throw Error('bind failed');
      return {};
    },
  };
  const pipeline = { groupLayout: {} };
  const frame = { format: 'barocss-gpu-engine-webgpu-frame', version: 0,
    cameraBytes: new Float32Array(32), draws: [
      { id: 'first', uniformBytes: new Float32Array(20) },
      { id: 'second', uniformBytes: new Float32Array(20) },
    ] };
  return { device, pipeline, frame, events };
}
test('shared camera and distinct 256-byte draw uniforms form valid bindings', () => {
  const s = setup(), result = uploadEngineWebGPUUniforms(s.device, s.pipeline, s.frame);
  assert.deepEqual(s.events.filter(e => e[0] === 'create').map(e => e[1]), [128, 256, 256]);
  assert.deepEqual(s.events.filter(e => e[0] === 'write').map(e => e[3]), [128, 80, 80]);
  const binds = s.events.filter(e => e[0] === 'bind').map(e => e[1].entries);
  assert.equal(binds.length, 2);
  assert.equal(binds[0][0].resource.buffer, result.camera);
  assert.notEqual(binds[0][1].resource.buffer, binds[1][1].resource.buffer);
  assert.deepEqual(result.draws.map(e => e.id), ['first', 'second']);
  result.dispose(); result.dispose();
  assert.equal(s.events.filter(e => e[0] === 'destroy').length, 3);
});
test('allocation, write and bind errors free every allocated buffer', () => {
  for (const phase of ['draw-create', 'draw-write', 'bind']) {
    const s = setup(phase);
    assert.throws(() => uploadEngineWebGPUUniforms(s.device, s.pipeline, s.frame), /failed/);
    assert.equal(s.events.filter(e => e[0] === 'create').length,
      s.events.filter(e => e[0] === 'destroy').length);
  }
});
test('invalid frame refuses before GPU allocation', () => {
  const s = setup(); s.frame.cameraBytes = new Float32Array(2);
  assert.throws(() => uploadEngineWebGPUUniforms(s.device, s.pipeline, s.frame), TypeError);
  assert.deepEqual(s.events, []);
});
