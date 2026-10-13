import assert from 'node:assert/strict';
import test from 'node:test';
import { qualifyNativePlanarLoopV1 as qualify } from '../dist/native-planar-loop-qualification-v1.js';
const p=(x,y)=>({x,y});
test('counterclockwise and clockwise square loops qualify',()=>{
 const pts=[p(0,0),p(4,0),p(4,4),p(0,4)];
 assert.deepEqual(qualify(pts),{status:'qualified',winding:'counterclockwise',vertexCount:4,method:'exact-binary64-orientation-and-bigint-area'});
 assert.equal(qualify([...pts].reverse()).winding,'clockwise');
 assert.equal(qualify([pts[1],pts[2],pts[3],pts[0]]).winding,'counterclockwise');
});
test('reject bow-tie and repeated vertices rather than inventing faces',()=>{
 assert.deepEqual(qualify([p(0,0),p(4,4),p(0,4),p(4,0)]),{status:'refused',reason:'self-intersection'});
 assert.deepEqual(qualify([p(0,0),p(4,0),p(4,4),p(0,0)]),{status:'refused',reason:'repeated-vertex'});
 assert.equal(qualify([p(0,0),p(1,1),p(2,2)]).reason,'zero-area');
 assert.equal(qualify([p(0,0),p(1,0)]).reason,'invalid-loop');
});
test('represented decimals, subnormals, bounds and hostile getter',()=>{
 assert.equal(qualify([p(0,0),p(.5,0),p(0,.5)]).winding,'counterclockwise');
 assert.equal(qualify([p(0,0),p(1,0),p(0,Number.MIN_VALUE)]).winding,'counterclockwise');
 assert.equal(qualify([p(0,0),p(10001,0),p(0,1)]).status,'unsupported');
 let reads=0;const hostile={y:0};Object.defineProperty(hostile,'x',{enumerable:true,get(){reads++;return 0;}});
 assert.equal(qualify([hostile,p(1,0),p(0,1)]).status,'refused');
 assert.equal(reads,0);
});
