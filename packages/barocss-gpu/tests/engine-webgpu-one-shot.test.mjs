/** Software structural GPU test; no adapter, driver or physical pixel assertions. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEngineWebGPUOnce } from '../dist/engine-webgpu-one-shot.js';

function original() {
  const mesh = id => ({id,type:'mesh',parentId:null,translation:[0,0,0],
    rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId:'tri',materialId:'red'});
  return {format:'barocss-gpu-engine-scene',version:0,id:'scene',
    coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,0,0],
    camera:{eye:[0,0,5],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:100},
    geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'tri',
      coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
      positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],
      uvs:[0,0,1,0,0,1],indices:[0,1,2]}],
    materials:[{id:'red',type:'unlit',colorSpace:'linear',color:[1,0,0]}],
    nodes:[mesh('a'),mesh('b')]};
}
function gpu(fail = '') {
  const events=[],buffers=[],textures=[];
  const device={
    limits:{maxTextureDimension2D:4096},
    createShaderModule(){return{getCompilationInfo:async()=>({messages:[]})};},
    createBindGroupLayout(){return{};},createPipelineLayout(){return{};},
    createRenderPipelineAsync:async()=>({}),
    createBuffer(desc){if(fail==='buffer' && buffers.length===2)throw Error('allocation refused');
      const id=buffers.length,buffer={destroy(){events.push('destroyBuffer:'+id);}};
      buffers.push(buffer);events.push('buffer:'+desc.size);return buffer;},
    createTexture(desc){const id=textures.length,texture={createView(){return{};},
      destroy(){events.push('destroyTexture:'+id);}};
      textures.push(texture);events.push('texture:'+desc.format);return texture;},
    createBindGroup(){return{};},
    queue:{writeBuffer(){},submit(){events.push('submit');}},
    createCommandEncoder(){return{beginRenderPass(){return{setPipeline(){},setBindGroup(){},
      setVertexBuffer(){},setIndexBuffer(){},drawIndexed(){events.push('draw');},end(){}};},
      finish(){return{};}};},
  };
  return{device,events};
}
test('one shared geometry submits two ordered draws and disposes all owners',async()=>{
 const g=gpu(),source=original(),snapshot=structuredClone(source);
 const rendered=await renderEngineWebGPUOnce(g.device,source,64,64,'rgba8unorm');
 assert.equal(rendered.drawCount,2);
 assert.equal(rendered.geometryCount,1);
 assert.equal(g.events.filter(x=>x==='draw').length,2);
 assert.equal(g.events.filter(x=>x.startsWith('buffer:')).length,5);
 assert.equal(g.events.at(-1),'submit');
 rendered.dispose();rendered.dispose();
 assert.equal(g.events.filter(x=>x.startsWith('destroyBuffer:')).length,5);
 assert.equal(g.events.filter(x=>x.startsWith('destroyTexture:')).length,2);
 assert.deepEqual(source,snapshot);
});
test('failed staged allocation cleans prior GPU owners',async()=>{
 const g=gpu('buffer');
 await assert.rejects(renderEngineWebGPUOnce(g.device,original(),64,64,'rgba8unorm'),/allocation refused/);
 assert.equal(g.events.filter(x=>x.startsWith('destroyBuffer:')).length,2);
 assert.equal(g.events.filter(x=>x.startsWith('destroyTexture:')).length,2);
});
test('invalid original scene refuses before any GPU call',async()=>{
 const g=gpu(),bad=original();bad.nodes[1].geometryId='nonexistent';
 await assert.rejects(renderEngineWebGPUOnce(g.device,bad,64,64,'rgba8unorm'));
 assert.deepEqual(g.events,[]);
});
