import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadEngineWebGPUGeometry } from '../dist/engine-webgpu-geometry.js';

const triangle = () => ({
  format:'barocss-gpu-triangle-geometry',version:0,id:'triangle',
  coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
  positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],
  uvs:[0,0,1,0,0,1],indices:[0,1,2],
});
function platform(failAt = '') {
  const calls = [], owned = [];
  const device = {
    createBuffer(descriptor) {
      calls.push(['create', descriptor]);
      if (failAt === 'second-create' && owned.length === 1) throw Error('second allocation refused');
      const handle = { destroy() { calls.push(['destroy', owned.indexOf(handle)]); } };
      owned.push(handle); return handle;
    },
    queue: { writeBuffer(buffer, offset, bytes) {
      calls.push(['write', owned.indexOf(buffer), offset, bytes.byteLength, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice()]);
      if (failAt === 'second-write' && owned.indexOf(buffer) === 1) throw Error('index upload refused');
    } },
  };
  return { device, calls };
}
test('generic triangle uploads aligned GPU buffers and releases each exactly once', () => {
  const { device, calls } = platform();
  const gpu = uploadEngineWebGPUGeometry(device, triangle());
  assert.equal(gpu.indexFormat,'uint16');
  assert.equal(gpu.indexCount,3);
  assert.equal(gpu.byteLength,44);
  assert.deepEqual(calls.filter(x=>x[0]==='create').map(x=>x[1].size),[36,8]);
  assert.equal(calls.find(x=>x[0]==='write' && x[1]===1)[3],8);
  assert.deepEqual(Array.from(calls.find(x=>x[0]==='write' && x[1]===1)[4]),[0,0,1,0,2,0,0,0]);
  gpu.dispose(); gpu.dispose();
  assert.deepEqual(calls.filter(x=>x[0]==='destroy').map(x=>x[1]),[0,1]);
});
test('partial allocation/upload failure destroys all owned buffers', () => {
  for(const failAt of ['second-create','second-write']) {
    const { device, calls } = platform(failAt);
    assert.throws(() => uploadEngineWebGPUGeometry(device,triangle()),/refused/);
    assert.equal(calls.filter(x=>x[0]==='destroy').length,failAt==='second-create'?1:2);
  }
});
test('invalid original geometry is refused before touching GPU', () => {
  const { device, calls } = platform(), input=triangle();
  input.indices=[0,0,2];
  assert.throws(()=>uploadEngineWebGPUGeometry(device,input));
  assert.equal(calls.length,0);
});
