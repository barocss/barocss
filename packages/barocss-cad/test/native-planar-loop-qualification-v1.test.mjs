import assert from 'node:assert/strict';
import test from 'node:test';
import { qualifyNativePlanarLoopV1 as qualify } from '../dist/exact-proof/native-planar-loop-qualification-v1.js';
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
 assert.equal(qualify([p(0,0),p(1,1),p(2,2)]).reason,'non-simple-boundary');
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

test('refuses adjacent collinear edge backtracking even with distinct vertices and nonzero area',()=>{
 assert.deepEqual(qualify([p(0,0),p(4,0),p(2,0),p(2,2),p(0,2)]),
   {status:'refused',reason:'non-simple-boundary'});
 assert.deepEqual(qualify([p(2,0),p(0,0),p(4,0),p(4,2),p(2,2)]),
   {status:'refused',reason:'non-simple-boundary'});
 assert.equal(qualify([p(0,0),p(2,0),p(4,0),p(4,2),p(0,2)]).status,'qualified',
   'consecutive collinear edges continuing forward may form a simple boundary');
});

test('descriptor-backed polygon coordinates are not read through hostile Proxy getters', () => {
 let gets = 0;
 const hostile = (x, y) => new Proxy(p(x, y), {
   get() { gets++; throw new Error('caller get must never execute'); }
 });
 assert.equal(qualify([hostile(0,0), hostile(4,0), hostile(4,4), hostile(0,4)]).winding,'counterclockwise');
 const liar = (x,y) => new Proxy(p(x,y), {get() { gets++; return 9999; }});
 assert.equal(qualify([liar(0,0),liar(4,0),liar(4,4),liar(0,4)]).winding,'counterclockwise');
 assert.equal(gets,0);
});
test('hostile reflection, revoked points, and revoked vertex arrays refuse safely', () => {
 const revokedPoint = Proxy.revocable(p(0,0), {}); revokedPoint.revoke();
 const revokedArray = Proxy.revocable([p(0,0),p(1,0),p(0,1)], {}); revokedArray.revoke();
 const invalid = [
   revokedPoint.proxy,
   new Proxy(p(0,0), {ownKeys(){throw Error('ownKeys')}}),
   new Proxy(p(0,0), {getOwnPropertyDescriptor(){throw Error('descriptor')}}),
   new Proxy(p(0,0), {getPrototypeOf(){throw Error('prototype')}}),
 ];
 for(const point of invalid) assert.deepEqual(qualify([point,p(1,0),p(0,1)]),
    {status:'refused',reason:'invalid-loop'});
 assert.deepEqual(qualify(revokedArray.proxy),{status:'refused',reason:'invalid-loop'});
 const accessorArray=[p(0,0),p(1,0),p(0,1)];
 let hits=0;
 Object.defineProperty(accessorArray,'0',{enumerable:true,get(){hits++;return p(0,0)}});
 assert.deepEqual(qualify(accessorArray),{status:'refused',reason:'invalid-loop'});
 assert.equal(hits,0);
});
