import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareEngineWebGPUFrame, engineSceneWGSL } from '../dist/index.js';

const scene = () => ({
  format: 'barocss-gpu-engine-scene', version: 0, id: 'engine', coordinateSystem: 'right-handed-y-up',
  positionUnit: 'scene', background: [0, 0, 0],
  camera: { eye: [0,0,5], target: [0,0,0], up: [0,1,0], fovYDegrees: 45, near: .1, far: 100 },
  geometries: [{
    format: 'barocss-gpu-triangle-geometry', version: 0, id: 'triangle', coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', winding: 'ccw',
    positions: [0,0,0,1,0,0,0,1,0], normals: [0,0,1,0,0,1,0,0,1],
    uvs: [0,0,1,0,0,1], indices: [0,1,2],
  }],
  materials: [{id:'red',type:'unlit',colorSpace:'linear',color:[.5,.25,.75]}],
  nodes: ['first','second'].map(id => ({
    id,type:'mesh',parentId:null,translation:[0,0,0],rotationXYZW:[0,0,0,1],
    scale:[1,1,1],visible:true,geometryId:'triangle',materialId:'red',
  })),
});
test('generic EngineScene creates independent GPU camera and 256-aligned draw uniform plans', () => {
  const input = scene(), before = structuredClone(input);
  const frame = prepareEngineWebGPUFrame(input,320,240);
  assert.equal(frame.format,'barocss-gpu-engine-webgpu-frame');
  assert.equal(frame.cameraBytes.byteLength,128);
  assert.equal(frame.draws.length,2);
  assert.deepEqual(frame.draws.map(d=>d.id),['first','second']);
  assert.deepEqual(Array.from(frame.draws[0].uniformBytes.slice(16,20)),[.5,.25,.75,1]);
  assert.equal(frame.draws[0].uniformBytes.byteLength,80);
  assert.equal(frame.uniformBufferBytes,128+512);
  assert.equal(frame.indexFormats.triangle,'uint16');
  assert.ok(frame.geometryBufferBytes>0);
  assert.notStrictEqual(frame.draws[0].uniformBytes.buffer,frame.draws[1].uniformBytes.buffer);
  assert.equal(frame.wgsl,engineSceneWGSL);
  assert.match(frame.wgsl, /@vertex fn vertexMain/);
  assert.match(frame.wgsl, /@fragment fn fragmentMain/);
  assert.deepEqual(input,before);
});
test('no GPU frame for invalid dimensions or broken geometry reference', () => {
  const input=scene();
  assert.throws(()=>prepareEngineWebGPUFrame(input,0,240),RangeError);
  input.nodes[1].geometryId='missing';
  assert.throws(()=>prepareEngineWebGPUFrame(input,320,240));
});
test('invisible mesh produces no WebGPU draw payload',()=>{
  const input=scene();input.nodes[1].visible=false;
  const frame=prepareEngineWebGPUFrame(input,320,240);
  assert.equal(frame.draws.length,1);
  assert.equal(frame.uniformBufferBytes,128+256);
});
