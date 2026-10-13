/** Deterministic software-only RenderPass integration, not hardware evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { submitPreparedEngineWebGPUFrame } from '../dist/engine-webgpu-submit-frame.js';

function fixture() {
  const calls = [];
  const gpu = { id:'shared', positions:{}, indices:{}, indexFormat:'uint16',indexCount:3 };
  const frame = { format:'barocss-gpu-engine-webgpu-frame', version:0,
    draws:[{id:'mesh-a',geometryId:'shared'}, {id:'mesh-b',geometryId:'shared'}],
    indexFormats:{shared:'uint16'} };
  const geometries = new Map([['shared',gpu]]);
  const uniforms = { draws:[{id:'mesh-a',bindGroup:'a'}, {id:'mesh-b',bindGroup:'b'}] };
  const pipeline = { pipeline:{} };
  const targets = { color:{createView:()=>({})}, depth:{createView:()=>({})} };
  const pass = { setPipeline(){}, setBindGroup(_index,group){calls.push(['bind',group]);},
    setVertexBuffer(){}, setIndexBuffer(){},
    drawIndexed(n){calls.push(['draw',n]);}, end(){calls.push(['end']);} };
  const device = { createCommandEncoder(){calls.push(['encode']);return{
    beginRenderPass(){return pass;},finish(){return {};}};},
    queue:{submit(){calls.push(['submit']);}} };
  return {calls,frame,geometries,uniforms,pipeline,targets,device};
}

test('multiple Mesh instances share geometry and produce ordered indexed draws', () => {
  const f=fixture();
  assert.equal(submitPreparedEngineWebGPUFrame(f.device,f.frame,f.pipeline,
    f.targets,f.uniforms,f.geometries,[0,0,0]),2);
  assert.deepEqual(f.calls.filter(c=>c[0]==='bind'),[['bind','a'],['bind','b']]);
  assert.deepEqual(f.calls.filter(c=>c[0]==='draw'),[['draw',3],['draw',3]]);
  assert.deepEqual(f.calls.slice(-2).map(c=>c[0]),['end','submit']);
});
test('missing geometry, wrong index format and mismatched uniform identity refuse before GPU work',()=>{
  for (const mode of ['geometry','format','identity']) {
    const f=fixture();
    if(mode==='geometry') f.geometries.clear();
    if(mode==='format') f.frame.indexFormats.shared='uint32';
    if(mode==='identity') f.uniforms.draws[1].id='wrong';
    assert.throws(()=>submitPreparedEngineWebGPUFrame(f.device,f.frame,f.pipeline,
      f.targets,f.uniforms,f.geometries,[0,0,0]),TypeError);
    assert.deepEqual(f.calls,[]);
  }
});
