import assert from 'node:assert/strict';
import test from 'node:test';
import { rotateCardinalPoint as rotate } from '../dist/modeling-rotation-internal.js';

test('cardinal maps are exact right-handed signed permutations', () => {
 const v=[2,3,5];
 assert.deepEqual(rotate(v,{axis:'x',degrees:90}),[2,-5,3]);
 assert.deepEqual(rotate(v,{axis:'x',degrees:180}),[2,-3,-5]);
 assert.deepEqual(rotate(v,{axis:'x',degrees:270}),[2,5,-3]);
 assert.deepEqual(rotate(v,{axis:'y',degrees:90}),[5,3,-2]);
 assert.deepEqual(rotate(v,{axis:'y',degrees:180}),[-2,3,-5]);
 assert.deepEqual(rotate(v,{axis:'y',degrees:270}),[-5,3,2]);
 assert.deepEqual(rotate(v,{axis:'z',degrees:90}),[-3,2,5]);
 assert.deepEqual(rotate(v,{axis:'z',degrees:180}),[-2,-3,5]);
 assert.deepEqual(rotate(v,{axis:'z',degrees:270}),[3,-2,5]);
});
test('binary64 coordinates preserve representability, signed zero and subnormals',()=>{
 const original=[-0,Number.MIN_VALUE,-Number.MIN_VALUE];
 for(const axis of ['x','y','z'])for(const degrees of [90,180,270]){
  const rotated=rotate(original,{axis,degrees});
  const sorted=rotated.map(v=>Math.abs(v)).sort((a,b)=>a-b);
  assert.deepEqual(sorted,[0,Number.MIN_VALUE,Number.MIN_VALUE]);
  assert.equal(rotated.some(v=>Object.is(v,-0)||Object.is(v,0)),true);
 }
});
test('invalid cardinal choices and nonfinite coordinates refuse',()=>{
 for(const degrees of [0,45,360]) assert.throws(()=>rotate([1,2,3],{axis:'x',degrees}),RangeError);
 assert.throws(()=>rotate([NaN,2,3],{axis:'z',degrees:90}),RangeError);
 assert.throws(()=>rotate([Infinity,2,3],{axis:'z',degrees:90}),RangeError);
});
