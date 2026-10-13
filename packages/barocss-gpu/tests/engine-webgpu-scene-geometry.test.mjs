import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadEngineWebGPUSceneGeometry } from '../dist/engine-webgpu-scene-geometry.js';
function scene() {
  const geometry = {format:'barocss-gpu-triangle-geometry',version:0,id:'shared',
    coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
    positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,0,1],
    uvs:[0,0,1,0,0,1],indices:[0,1,2]};
  const node = id => ({id,type:'mesh',parentId:null,translation:[0,0,0],
    rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId:'shared',materialId:'red'});
  return {format:'barocss-gpu-engine-scene',version:0,id:'shared_scene',coordinateSystem:'right-handed-y-up',
    positionUnit:'scene',background:[0,0,0],camera:{eye:[0,0,5],target:[0,0,0],up:[0,1,0],
    fovYDegrees:45,near:.1,far:100},geometries:[geometry],
    materials:[{id:'red',type:'unlit',colorSpace:'linear',color:[1,0,0]}],
    nodes:[node('first'),node('second')]};
}
function device(failSecond=false) {
  const events=[], handles=[];
  return {events, createBuffer(d) {
    if(failSecond && handles.length===1)throw new Error('second allocation failed');
    const id=handles.length, buffer={destroy(){events.push(['destroy',id]);}};
    handles.push(buffer);events.push(['allocate',d.size]);return buffer;
  }, queue:{writeBuffer(_buffer,_offset,bytes){events.push(['write',bytes.byteLength]);}}};
}
test('two original mesh instances share exactly one pair of GPU buffers', () => {
  const d=device(), input=scene(), before=structuredClone(input);
  const result=uploadEngineWebGPUSceneGeometry(d,input);
  assert.deepEqual(result.drawGeometryIds,['shared','shared']);
  assert.equal(result.geometries.size,1);
  assert.equal(d.events.filter(x=>x[0]==='allocate').length,2);
  assert.equal(result.uploadedBytes,44);
  assert.deepEqual(input,before);
  result.dispose();result.dispose();
  assert.deepEqual(d.events.filter(x=>x[0]==='destroy').map(x=>x[1]),[0,1]);
});
test('partial upload failure tears down all allocated buffers', () => {
  const d=device(true);
  assert.throws(()=>uploadEngineWebGPUSceneGeometry(d,scene()),/allocation failed/);
  assert.equal(d.events.filter(x=>x[0]==='destroy').length,1);
});
test('bad geometry reference fails admission before GPU resource creation',()=>{
  const d=device(), input=scene();input.nodes[1].geometryId='missing';
  assert.throws(()=>uploadEngineWebGPUSceneGeometry(d,input));
  assert.deepEqual(d.events,[]);
});
