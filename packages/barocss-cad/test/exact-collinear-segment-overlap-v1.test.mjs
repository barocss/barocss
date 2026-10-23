import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCollinearSegmentOverlapV1 as overlap } from '../dist/exact-proof/exact-collinear-segment-overlap-v1.js';
const p=(x,y)=>({x,y});
const kind=(a,b,c,d)=>overlap(a,b,c,d).relation;
test('collinear segments classify overlap, containment and reversal',()=>{
 for(const [a,b,c,d] of [
  [p(0,0),p(4,0),p(2,0),p(6,0)],
  [p(4,0),p(0,0),p(6,0),p(2,0)],
  [p(2,0),p(6,0),p(0,0),p(4,0)],
  [p(0,0),p(4,0),p(1,0),p(3,0)],
  [p(0,0),p(4,0),p(4,0),p(0,0)]
 ]) assert.equal(kind(a,b,c,d),'positive-length-overlap');
 assert.deepEqual(overlap(p(0,0),p(4,0),p(2,0),p(6,0)).overlapMM,[p(2,0),p(4,0)]);
});
test('collinear single point, disjoint, vertical and subnormal coordinate cases',()=>{
 assert.equal(kind(p(0,0),p(2,0),p(2,0),p(3,0)),'single-point-touch');
 assert.equal(kind(p(0,0),p(2,0),p(3,0),p(4,0)),'disjoint');
 assert.equal(kind(p(0,-2),p(0,2),p(0,1),p(0,3)),'positive-length-overlap');
 assert.equal(kind(p(0,0),p(Number.MIN_VALUE,0),p(Number.MIN_VALUE,0),p(2*Number.MIN_VALUE,0)),'single-point-touch');
 assert.equal(kind(p(-0,-1),p(+0,1),p(0,0),p(0,2)),'positive-length-overlap');
});
test('refuse noncollinear and malformed with no getter execution',()=>{
 assert.deepEqual(overlap(p(0,0),p(3,0),p(0,1),p(3,1)),{status:'refused',reason:'not-collinear'});
 assert.deepEqual(overlap(p(0,0),p(0,0),p(0,1),p(0,2)),{status:'unsupported',reason:'degenerate-segment'});
 let reads=0;const hostile={y:0};
 Object.defineProperty(hostile,'x',{enumerable:true,get(){reads++;return 0;}});
 assert.deepEqual(overlap(hostile,p(1,0),p(2,0),p(3,0)),{status:'unsupported',reason:'invalid-input'});
 assert.equal(reads,0);
 assert.equal(overlap(p(Infinity,0),p(1,0),p(2,0),p(3,0)).status,'unsupported');
});
