import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBody } from '../../packages/barocss-physics/src/validation.js';
import type { Body,Vec3,Quat } from '../../packages/barocss-physics/src/types.js';
import { featureContact } from '../physics-rigid-feature-geometry/geometry.js';
import { StrictLineContext,nextAfterToward,StrictLineFailure,STRICT_LINE_LIMITS } from '../physics-rigid-feature-geometry/strict-line.js';

function box(id:string,positionM:Vec3=[0,0,0],orientation:Quat=[0,0,0,1],halfExtentsM:Vec3=[1,1,1]):Body {
  return parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM},positionM,orientation,
    velocityMps:[0,0,0],massKg:1,restitution:0});
}

test('strict closed slabs admit an exact edge and reject one representable step outside',()=>{
  const a=box('a'),b=box('b',[0,1.8,0]),context=new StrictLineContext(a,b,[0,1,0]);
  assert.equal(context.check([1,.9,1]),true);
  assert.equal(context.check([nextAfterToward(1,2),.9,1]),false);
  assert.equal(context.check([nextAfterToward(1,0),.9,nextAfterToward(1,0)]),true);
});

test('line intersection does not inflate a parallel slab by witness tolerance',()=>{
  const context=new StrictLineContext(box('a'),box('b'),[0,1,0]);
  assert.equal(context.check([1+Number.EPSILON,0,0]),false);
  assert.equal(context.onFace(0,{axis:1,side:1},[1+Number.EPSILON,1,0]),true);
});

test('two nonempty line intervals do not certify a distant actual surface midpoint',()=>{
  const context=new StrictLineContext(box('a'),box('b',[0,1.8,0]),[1e-19,1,0]);
  // At x=1, the positive-X side ends A's line interval at t=0.
  // B is first entered through its bottom at approximately t=-0.1.
  // Both boxes are intersected, but their actual surface midpoint is
  // approximately0.05m from this point, independent of the implementation.
  const boundary:Vec3=[1,.9,0];
  assert.equal(context.check(boundary),false);
  assert.equal(context.selectedFaceBounds(boundary,{axis:1,side:1},{axis:1,side:-1}),false);
  // One inward X ULP gives more than1000m of side clearance along this
  // almost vertical line, so the two selected Y faces are the actual bounds.
  const inward:Vec3=[nextAfterToward(1,0),.9,0];
  assert.equal(context.check(inward),true);
  assert.equal(context.selectedFaceBounds(inward,{axis:1,side:1},{axis:1,side:-1}),true);
});

test('nextafter moves exactly one representable value for either sign',()=>{
  assert.equal(nextAfterToward(1,2),1+Number.EPSILON);
  assert.equal(nextAfterToward(-1,0),-1+Number.EPSILON/2);
  assert.equal(nextAfterToward(0,1),Number.MIN_VALUE);
  assert.equal(nextAfterToward(0,-1),-Number.MIN_VALUE);
  assert.ok(Object.is(nextAfterToward(-0,0),-0));
  assert.throws(()=>nextAfterToward(Infinity,0),StrictLineFailure);
});

test('named face projection correctly rounds an exact non-dyadic ratio',()=>{
  const context=new StrictLineContext(box('a'),box('b'),[1,3,0]);
  const [a,b]=context.projectedPair([0,0,0],{axis:1,side:1},{axis:1,side:1});
  assert.equal(a[0],1/3);assert.equal(a[1],1);assert.deepEqual(a,b);
});

test('named face projection rounds a half-ULP tie to the even significand',()=>{
  const context=new StrictLineContext(box('a',[0,0,0],[0,0,0,1],[2,2,2]),box('b'),[1,2**53,0]);
  const [even]=context.projectedPair([1,0,0],{axis:1,side:1},{axis:1,side:1});
  // A's y=2 gives a full ULP; B's y=1 is the half-ULP tie.
  assert.equal(even[0],1+Number.EPSILON);
  const [,tie]=context.projectedPair([1,0,0],{axis:1,side:1},{axis:1,side:1});
  assert.equal(tie[0],1);
});

test('exact movement gate is Euclidean rather than a per-coordinate box',()=>{
  const context=new StrictLineContext(box('a'),box('b'),[0,1,0]);
  assert.equal(context.movementWithin([0,0,0],[1e-12,0,0]),true);
  assert.equal(context.movementWithin([0,0,0],[.8e-12,.8e-12,0]),false);
});

test('normalized rational quaternion geometry is invariant to its sign',()=>{
  const q:Quat=[0,Math.sin(.1),0,Math.cos(.1)],neg=q.map(value=>-value) as Quat;
  const a=box('a',[0,0,0],q),b=box('b',[0,1.8,0],q);
  const c=new StrictLineContext(a,b,[0,1,0]);
  const d=new StrictLineContext(box('a',[0,0,0],neg),box('b',[0,1.8,0],neg),[0,1,0]);
  assert.equal(c.check([0,.9,0]),true);assert.equal(d.check([0,.9,0]),true);
  assert.deepEqual(c.projectedPair([0,.9,0],{axis:1,side:1},{axis:1,side:-1}),
    d.projectedPair([0,.9,0],{axis:1,side:1},{axis:1,side:-1}));
});

test('already valid aligned face retains exact witnesses, IDs and input data',()=>{
  const a=box('a'),b=box('b',[0,1.8,0]),before=structuredClone([a,b]),g=featureContact(a,b)!;
  assert.equal(g.points.length,4);assert.equal(g.conditioning.boundaryRoundingMovedPoints,0);
  assert.deepEqual(g.points.map(p=>p.key),['face:a:1:1:b:1:-1:0','face:a:1:1:b:1:-1:1',
    'face:a:1:1:b:1:-1:2','face:a:1:1:b:1:-1:3']);
  for(const p of g.points) {assert.equal(p.witnessAM[1],1);assert.equal(p.witnessBM[1],.8);}
  assert.deepEqual([a,b],before);assert.deepEqual(featureContact(a,b),g);
});

test('zero-width edge contact retains both selected face rows',()=>{
  const g=featureContact(box('a'),box('b',[2,2,0]))!;
  assert.equal(g.points.length,2);assert.equal(g.conditioning.boundaryRoundingMovedPoints,0);
  assert.equal(new Set(g.points.map(point=>point.key)).size,2);
  for(const p of g.points) assert.equal(p.normalGapM,0);
});

test('rotated face outputs certify the actual returned float midpoint',()=>{
  const a=box('a'),b=box('b',[0,1.7,0],[0,Math.sin(.1),0,Math.cos(.1)]),g=featureContact(a,b)!;
  const exact=new StrictLineContext(a,b,g.planeNormalAtoB);
  assert.equal(g.points.length,4);
  for(const p of g.points) {
    assert.equal(exact.check(p.midpointM),true);
    assert.deepEqual(p.midpointM,p.witnessAM.map((value,i)=>(value+p.witnessBM[i])*.5));
  }
  assert.ok(Number(g.conditioning.boundaryRoundingMaximumSteps)<=STRICT_LINE_LIMITS.roundingSteps);
});

test('invalid exact operands and parallel named-face projection refuse',()=>{
  const a=box('a'),b=box('b');
  assert.throws(()=>new StrictLineContext(a,b,[0,0,0]),StrictLineFailure);
  assert.throws(()=>new StrictLineContext(a,b,[NaN,1,0]),StrictLineFailure);
  assert.throws(()=>new StrictLineContext(a,b,[1,0,0]).projectedPair([0,0,0],{axis:1,side:1},{axis:1,side:-1}),StrictLineFailure);
});
