import assert from 'node:assert/strict';
import test from 'node:test';
import { rotateCardinalPoint as rotate, rotateCardinalCurve, rotateCardinalSurface } from '../dist/modeling-rotation-internal.js';

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

test('Curve and Surface staging rotate independent copied coefficients',()=>{
 const curve={kind:'curve',id:'curveA',degree:1,knots:[0,0,1,1],weights:[1,1],controlPoints:[[1,2,3],[4,5,6]]};
 const surface={kind:'surface',id:'surfaceA',degreeU:1,degreeV:1,knotsU:[0,0,1,1],knotsV:[0,0,1,1],
  weights:[[1,1],[1,1]],controlPoints:[[[1,2,3],[4,5,6]],[[7,8,9],[10,11,12]]]};
 const spec={axis:'z',degrees:90};
 const c=rotateCardinalCurve(curve,spec), face=rotateCardinalSurface(surface,spec);
 assert.deepEqual(c.controlPoints,[[-2,1,3],[-5,4,6]]);
 assert.deepEqual(face.controlPoints[0],[[-2,1,3],[-5,4,6]]);
 assert.notStrictEqual(c.controlPoints,curve.controlPoints);
 assert.notStrictEqual(c.knots,curve.knots);
 assert.notStrictEqual(face.weights[0],surface.weights[0]);
 c.controlPoints[0][0]=999;
 assert.deepEqual(curve.controlPoints[0],[1,2,3]);
 assert.deepEqual(surface.controlPoints[0][0],[1,2,3]);
});
test('hostile point and spec getters never execute in cardinal mapping',()=>{
 let reads=0;
 const point=new Proxy([1,2,3],{get(){reads++;throw Error('getter');}});
 const spec=new Proxy({axis:'x',degrees:90},{get(){reads++;throw Error('getter');}});
 assert.deepEqual(rotate(point,spec),[1,-3,2]);
 assert.equal(reads,0);
 const revoked=Proxy.revocable([1,2,3],{});revoked.revoke();
 assert.throws(()=>rotate(revoked.proxy,{axis:'x',degrees:90}),RangeError);
 assert.throws(()=>rotate([1,2,3],null),RangeError);
 const array=[1,2,3];
 Object.defineProperty(array,'0',{enumerable:true,get(){reads++;return 1;}});
 assert.throws(()=>rotate(array,{axis:'x',degrees:90}),RangeError);
 assert.equal(reads,0);
});
