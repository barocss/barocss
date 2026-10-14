/** Deterministic GPU-API calls only. No physical device or pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { submitEngineWebGPURenderPass } from '../dist/engine-webgpu-renderpass.js';
function mock() {
  const calls = [];
  const pass = {
    setPipeline(p) { calls.push(['pipeline', p]); },
    setBindGroup(i, b) { calls.push(['group', i, b]); },
    setVertexBuffer(i, b) { calls.push(['vertex', i, b]); },
    setIndexBuffer(b, f) { calls.push(['index', b, f]); },
    drawIndexed(n) { calls.push(['draw', n]); },
    end() { calls.push(['end']); },
  };
  const device = {
    createCommandEncoder() { calls.push(['encoder']); return {
      beginRenderPass(descriptor) { calls.push(['begin', descriptor]); return pass; },
      finish() { calls.push(['finish']); return 'command'; },
    }; },
    queue: { submit(cmd) { calls.push(['submit', cmd]); } },
  };
  const geometry = (count, format = 'uint16') => ({
    positions: {}, indices: {}, indexCount: count, indexFormat: format,
  });
  const pipeline = { pipeline: {} };
  const color = { createView: () => 'colorView' }, depth = { createView: () => 'depthView' };
  return { calls, device, geometry, pipeline, color, depth };
}
test('ordered draws use one shared depth pass and submit only after end', () => {
  const m=mock(), draws=[
    { geometry: m.geometry(3), bindGroup: {} },
    { geometry: m.geometry(6, 'uint32'), bindGroup: {} },
  ];
  assert.equal(submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,draws,[0.1,0.2,0.3]),2);
  assert.deepEqual(m.calls.filter(x=>x[0]==='draw').map(x=>x[1]),[3,6]);
  assert.deepEqual(m.calls.filter(x=>x[0]==='index').map(x=>x[2]),['uint16','uint32']);
  const desc=m.calls.find(x=>x[0]==='begin')[1];
  assert.equal(desc.depthStencilAttachment.depthLoadOp,'clear');
  assert.equal(desc.depthStencilAttachment.depthClearValue,1);
  assert.equal(desc.colorAttachments[0].clearValue.a,1);
  assert.deepEqual(m.calls.slice(-3).map(x=>x[0]),['end','finish','submit']);
});
test('empty render pass clears attachments without indexed draws',()=>{
  const m=mock();
  assert.equal(submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,[],[0,0,0]),0);
  assert.equal(m.calls.filter(x=>x[0]==='draw').length,0);
});
test('malformed draw and background refuse before any device call',()=>{
  const m=mock();
  assert.throws(()=>submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,[{geometry:m.geometry(4),bindGroup:{}}],[0,0,0]),TypeError);
  assert.throws(()=>submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,[],[-1,0,0]),TypeError);
  assert.deepEqual(m.calls,[]);
});

test('original linear background is encoded into the same sRGB target as the material shader',()=>{
  const m=mock(),background=[.25,.5,.75],original=[...background];
  submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,[],background);
  const clear=m.calls.find(x=>x[0]==='begin')[1].colorAttachments[0].clearValue;
  // Declared transfer-function values, independent of the implementation's helper.
  const expected=[.5370987304831942,.7353569830524495,.8808250210902997];
  for(const [index,channel]of['r','g','b'].entries())assert.ok(Math.abs(clear[channel]-expected[index])<1e-15);
  assert.equal(clear.a,1);assert.deepEqual(background,original);
});
test('black, transfer breakpoint and white preserve opaque clear semantics without mutating source',()=>{
  const m=mock(),background=Object.freeze([0,.0031308,1]);
  submitEngineWebGPURenderPass(m.device,m.pipeline,m.color,m.depth,[],background);
  const clear=m.calls.find(x=>x[0]==='begin')[1].colorAttachments[0].clearValue;
  assert.equal(clear.r,0);assert.ok(Math.abs(clear.g-.040449936)<1e-15);
  assert.ok(Math.abs(clear.b-1)<1e-15);assert.equal(clear.a,1);
  assert.deepEqual(background,[0,.0031308,1]);
});
