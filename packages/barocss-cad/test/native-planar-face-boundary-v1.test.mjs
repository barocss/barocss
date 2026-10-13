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

test('face is built exclusively from descriptor snapshot despite hostile getter traps',()=>{
 let gets=0;
 const guard=(x,y)=>new Proxy(p(x,y),{get(){gets++;throw Error('external get');}});
 const r=construct('faceProxy',[guard(0,0),guard(4,0),guard(4,4),guard(0,4)]);
 assert.equal(r.status,'qualified');
 assert.equal(r.winding,'counterclockwise');
 assert.deepEqual(r.vertices.map(v=>v.pointMM),[p(0,0),p(4,0),p(4,4),p(0,4)]);
 const liar=(x,y)=>new Proxy(p(x,y),{get(){gets++;return 9000;}});
 const l=construct('faceLiar',[liar(0,0),liar(4,0),liar(4,4),liar(0,4)]);
 assert.equal(l.status,'qualified');
 assert.deepEqual(l.vertices.map(v=>v.pointMM),[p(0,0),p(4,0),p(4,4),p(0,4)]);
 assert.equal(gets,0);
});
test('face refuses revoked proxies, reflection traps and array getter without evaluation',()=>{
 const revoked=Proxy.revocable(p(0,0),{});revoked.revoke();
 const revokedArray=Proxy.revocable([p(0,0),p(1,0),p(0,1)],{});revokedArray.revoke();
 const hostile=[
  revoked.proxy,
  new Proxy(p(0,0),{getPrototypeOf(){throw Error('prototype');}}),
  new Proxy(p(0,0),{ownKeys(){throw Error('keys');}}),
  new Proxy(p(0,0),{getOwnPropertyDescriptor(){throw Error('descriptor');}})
 ];
 for(const point of hostile) assert.deepEqual(construct('faceA',[point,p(1,0),p(0,1)]),
  {status:'refused',reason:'invalid-loop'});
 assert.deepEqual(construct('faceA',revokedArray.proxy),{status:'refused',reason:'invalid-loop'});
 const array=[p(0,0),p(1,0),p(0,1)];let reads=0;
 Object.defineProperty(array,'0',{enumerable:true,get(){reads++;return p(0,0);}});
 assert.deepEqual(construct('faceA',array),{status:'refused',reason:'invalid-loop'});
 assert.equal(reads,0);
});

test('boundary construction snapshots descriptors and never executes hostile coordinate getters',()=>{
 let reads=0;
 const guarded=(x,y)=>new Proxy({x,y},{get(){reads++;throw Error('hostile get');}});
 const r=construct('faceProxy',[guarded(0,0),guarded(4,0),guarded(4,4),guarded(0,4)]);
 assert.equal(r.status,'qualified');
 assert.deepEqual(r.vertices[0].pointMM,p(0,0));
 assert.equal(reads,0);
 const revoked=Proxy.revocable({x:0,y:0},{});revoked.revoke();
 assert.equal(construct('faceProxy',[revoked.proxy,p(1,0),p(0,1)]).status,'refused');
});
