import assert from 'node:assert/strict';
import test from 'node:test';
import { intersectProperSegmentsExactBinary64V1 as intersect } from '../dist/exact-proof/exact-segment-intersection-point-v1.js';
const p=(x,y)=>({x,y});
const rat=(numerator,denominator='1')=>({numerator,denominator});
test('exact point and parameters for proper crossing including segment reversal',()=>{
 const cases=[
  [p(0,0),p(4,4),p(0,4),p(4,0)],
  [p(4,4),p(0,0),p(0,4),p(4,0)],
  [p(0,4),p(4,0),p(0,0),p(4,4)]
 ];
 for(const [a,b,c,d] of cases){
  const x=intersect(a,b,c,d);
  assert.equal(x.status,'exact');
  assert.deepEqual(x.pointMM,{x:rat('2'),y:rat('2')});
  assert.deepEqual(x.parameterAB,rat('1','2'));
  assert.deepEqual(x.parameterCD,rat('1','2'));
 }
});
test('exact dyadic decimal crossing returns canonical rational coordinates',()=>{
 const x=intersect(p(0,0),p(.5,.5),p(0,.5),p(.5,0));
 assert.equal(x.status,'exact');
 assert.deepEqual(x.pointMM,{x:rat('1','4'),y:rat('1','4')});
 const tiny=intersect(p(-1,0),p(1,0),p(0,-Number.MIN_VALUE),p(0,Number.MIN_VALUE));
 assert.equal(tiny.status,'exact');
 assert.deepEqual(tiny.pointMM,{x:rat('0'),y:rat('0')});
});
test('refuses boundary, disjoint, invalid inputs and hostile accessors',()=>{
 for(const args of [
  [p(0,0),p(1,0),p(1,0),p(1,1)],
  [p(0,0),p(1,0),p(2,0),p(3,0)],
  [p(0,0),p(1,0),p(0,1),p(1,1)]
 ]) assert.deepEqual(intersect(...args),{status:'refused',reason:'not-proper-interior-crossing'});
 let reads=0;
 const hostile={y:0};Object.defineProperty(hostile,'x',{enumerable:true,get(){reads++;return 0}});
 assert.deepEqual(intersect(hostile,p(1,0),p(0,1),p(1,1)),{status:'unsupported',reason:'invalid-input'});
 assert.equal(reads,0);
 assert.deepEqual(intersect(p(0,0),p(0,0),p(0,1),p(1,0)),{status:'unsupported',reason:'degenerate-segment'});
});
