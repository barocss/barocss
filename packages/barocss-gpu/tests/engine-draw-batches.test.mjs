import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEngineDrawBatches } from '../dist/index.js';

const triangle = () => ({format:'barocss-gpu-triangle-geometry',version:0,id:'tri',coordinateSystem:'right-handed-y-up',
 positionUnit:'scene',winding:'ccw',positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],
 uvs:[0,0,1,0,0,1],indices:[0,1,2]});
const mesh = (id, materialId='red', visible=true) => ({id,type:'mesh',parentId:null,translation:[0,0,0],
 rotationXYZW:[0,0,0,1],scale:[1,1,1],visible,geometryId:'tri',materialId});
const scene = () => ({format:'barocss-gpu-engine-scene',version:0,id:'batched',coordinateSystem:'right-handed-y-up',
 positionUnit:'scene',background:[0,0,0],
 camera:{eye:[0,0,5],target:[0,0,0],up:[0,1,0],fovY:45,near:.1,far:100},
 geometries:[triangle()],materials:[{id:'red',type:'unlit',colorSpace:'linear',color:[1,0,0]},
 {id:'blue',type:'unlit',colorSpace:'linear',color:[0,0,1]}],
 nodes:[mesh('a'),mesh('b'),mesh('c','blue'),mesh('d'),mesh('hidden','red',false)]});
test('consecutive shared mesh/material pairs batch without reordering or counting hidden nodes', () => {
 const input=scene(), snapshot=structuredClone(input), plan=prepareEngineDrawBatches(input);
 assert.equal(plan.visibleDrawCount,4);
 assert.equal(plan.batchCount,3);
 assert.deepEqual(plan.batches.map(b=>b.nodeIds),[['a','b'],['c'],['d']]);
 assert.deepEqual(plan.batches.map(b=>b.instanceCount),[2,1,1]);
 assert.equal(plan.triangleInstances,4);
 assert.equal(plan.uniqueGeometryCount,1);
 assert.equal(plan.uniqueMaterialCount,2);
 assert.equal(plan.instanceMatrixBytes,400);
 assert.ok(plan.sharedGeometryBufferBytes>0);
 assert.deepEqual(input,snapshot);
 assert.equal(Object.isFrozen(plan.batches),true);
});
test('fully hidden nodes have no instance bytes or batches',()=>{
 const input=scene();input.nodes.forEach(node=>{node.visible=false});
 const plan=prepareEngineDrawBatches(input);
 assert.equal(plan.visibleDrawCount,0);assert.equal(plan.batchCount,0);
 assert.equal(plan.sharedGeometryBufferBytes,0);assert.equal(plan.instanceMatrixBytes,0);
});
test('input is readmitted and a corrupt geometry ref is rejected',()=>{
 const input=scene();input.nodes[0].geometryId='missing';
 assert.throws(()=>prepareEngineDrawBatches(input));
});
