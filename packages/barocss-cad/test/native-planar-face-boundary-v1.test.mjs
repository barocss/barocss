import assert from 'node:assert/strict';
import test from 'node:test';
import { constructNativePlanarFaceBoundaryV1 as construct } from '../dist/native-planar-face-boundary-v1.js';
const p=(x,y)=>({x,y});
test('immutable face boundary has cyclic next/previous connectivity and no sewn twins',()=>{
 const input=[p(0,0),p(4,0),p(4,4),p(0,4)];
 const r=construct('faceA',input);
 assert.equal(r.status,'qualified');
 assert.equal(r.winding,'counterclockwise');
 assert.equal(r.vertices.length,4);
 assert.equal(r.halfEdges.length,4);
 const edges=new Map(r.halfEdges.map(e=>[e.id,e]));
 for(const e of r.halfEdges){
  const next=edges.get(e.nextId), previous=edges.get(e.previousId);
  assert.equal(next.previousId,e.id);
  assert.equal(previous.nextId,e.id);
  assert.equal(next.originVertexId,e.destinationVertexId);
  assert.equal(e.twinId,null);
 }
 assert.equal(Object.isFrozen(r),true);
 assert.equal(Object.isFrozen(r.halfEdges),true);
 input[0].x=999;
 assert.deepEqual(r.vertices[0].pointMM,p(0,0));
});
test('clockwise cycle preserves input direction, invalid loops and IDs fail closed',()=>{
 const input=[p(0,0),p(0,4),p(4,4),p(4,0)];
 assert.equal(construct('faceB',input).winding,'clockwise');
 assert.deepEqual(construct('invalid/id',input),{status:'refused',reason:'invalid-face-id'});
 assert.equal(construct('faceB',[p(0,0),p(4,4),p(0,4),p(4,0)]).status,'refused');
});
