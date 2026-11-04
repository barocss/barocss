// Fixed20 transport controls. Root executes; no physics/helper import or solve.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {PACKET_LIMITS,PacketFailure,inspectPacket,detachPacket} from './packet.mjs';
const word=n=>{const b=Buffer.alloc(8);b.writeDoubleBE(n);return b.toString('hex');};
const words=['0000000000000000','8000000000000000','0000000000000001','8000000000000001','0010000000000000','8010000000000000','3ff0000000000000','bff0000000000000','7fefffffffffffff','ffefffffffffffff'];
function refused(value,code,limit){assert.throws(()=>detachPacket(value,limit),e=>e instanceof PacketFailure&&e.stage==='admission'&&(!code||e.code===code));}
test('01 independent binary64 word bank survives detachment',()=>{
 const numbers=words.map(x=>Buffer.from(x,'hex').readDoubleBE()),r=detachPacket({numbers});
 assert.deepEqual(r.packet.numbers.map(word),words);assert.equal(r.numericLeavesVerified,words.length);assert.ok(r.wire.length<=r.admission.boundBytes);
});
test('02 Unicode, unpaired surrogates, controls and nonnumeric strings are exact',()=>{
 const source={values:['한글😀','\ud800','\udfff','12e3','-0','null','\b\t\n\r\f','"\\'],empty:'',nil:null,yes:true,no:false};
 assert.deepEqual(detachPacket(source).packet,source);
});
test('03 aliases remain aliases and all mutable ownership is detached',()=>{
 const shared={values:[-0,Number.MIN_VALUE]},source={left:shared,right:shared},r=detachPacket(source);
 assert.equal(r.packet.left,r.packet.right);assert.notEqual(r.packet.left,shared);r.packet.left.values[0]=2;
 assert.equal(word(shared.values[0]),words[1]);shared.values[1]=3;assert.equal(word(r.packet.left.values[1]),words[2]);
});
test('04 frozen records remain data; descriptor flags are outside packet semantics',()=>{
 const source=Object.freeze({value:Object.freeze([-0,1])});assert.deepEqual(detachPacket(source).packet,source);
});
test('05 captured48 prepared records fit and retain their captured words only',()=>{
 const base=new URL('../physics-stack-library-2276/evidence/run-09/native/',import.meta.url);let checked=0;
 for(const scene of ['ALIGNED','OFFSET','YAW'])for(let step=1;step<=16;step++){
  const path=new URL(`${scene}-16-${step}.jsonl.gz`,base),record=JSON.parse(gunzipSync(readFileSync(path),{maxOutputLength:2*1024*1024}));
  const source={scene,step,priorBodies:record.before.bodies,prepared:record.prepared},r=detachPacket(source);
  assert.deepEqual(r.packet,source);assert.equal(r.numericLeavesVerified,r.admission.numericLeaves);assert.ok(r.admission.boundBytes<=PACKET_LIMITS.wireBytes);checked++;
 }assert.equal(checked,48);
});
test('06 exact conservative boundary admits and one byte less refuses',()=>{
 const source={value:[-0,1,'x']},bound=inspectPacket(source).boundBytes;assert.ok(detachPacket(source,bound));refused(source,'CAPACITY',bound-1);
});
test('07 impossible, noninteger and excessive wire bounds refuse before encoding',()=>{
 for(const limit of [0,63,-1,NaN,Infinity,64.5,PACKET_LIMITS.wireBytes+1,'2097152'])refused({},'INVALID_LIMIT',limit);
 assert.equal(inspectPacket({},64).boundBytes,64);assert.ok(detachPacket({},64));
});
test('08 overcapacity string refuses before full encoding',()=>{refused({text:'x'.repeat(PACKET_LIMITS.wireBytes)},'CAPACITY');});
test('09 overcapacity array length refuses before index walking',()=>{refused({values:new Array(PACKET_LIMITS.edges+1)},'CAPACITY');});
function chain(depth){let value=0;for(let i=0;i<depth;i++)value={value};return value;}
test('10 exact depth boundary admits and deeper graph refuses',()=>{assert.ok(detachPacket(chain(PACKET_LIMITS.depth)));refused(chain(PACKET_LIMITS.depth+1),'DEPTH');});
test('11 nonfinite numeric fields refuse',()=>{for(const n of [NaN,Infinity,-Infinity])refused({nested:[n]},'NONFINITE');});
test('12 sparse arrays refuse',()=>{const a=[1,2];delete a[0];refused({a},'SHAPE');});
test('13 extra array properties refuse',()=>{const a=[1];a.extra=2;refused({a},'SHAPE');});
test('14 direct and mutual cycles refuse while shared DAGs remain valid',()=>{
 const a={};a.self=a;refused(a,'CYCLE');const b={},c={b};b.c=c;refused({b},'CYCLE');const shared={x:1};assert.ok(detachPacket({a:shared,b:shared}));
});
test('15 custom prototypes and unsupported typed shapes refuse',()=>{
 for(const value of [Object.create(null),Object.create({x:1}),new Date(),new Map(),new Set(),/x/,new Number(1),new Uint8Array([1]),new ArrayBuffer(8),new DataView(new ArrayBuffer(8)),Buffer.from([1])])refused({value},'SHAPE');
});
test('16 accessors refuse without invoking them',()=>{
 let invoked=0;const value={};Object.defineProperty(value,'x',{enumerable:true,get(){invoked++;throw Error('must not run');}});refused({value},'SHAPE');assert.equal(invoked,0);
});
test('17 nonenumerable and symbol fields refuse',()=>{
 const hidden={};Object.defineProperty(hidden,'x',{value:1});refused({hidden},'SHAPE');refused({[Symbol('x')]:1},'SHAPE');
});
test('18 proxies refuse without invoking traps',()=>{
 let invoked=0;const value=new Proxy({x:1},{ownKeys(){invoked++;throw Error('must not run');}});refused({value},'SHAPE');assert.equal(invoked,0);
});
test('19 unsupported primitive fields and root shapes refuse',()=>{
 for(const value of [undefined,1n,Symbol('x'),()=>0])refused({value},'SHAPE');for(const root of [null,1,'x',true,[]])refused(root,'SHAPE');
});
test('20 encoding bytes are separate from the returned detached graph',()=>{
 const r=detachPacket({text:'abc',numbers:[-0,Number.MAX_VALUE]});r.wire.fill(0);assert.equal(r.packet.text,'abc');assert.equal(word(r.packet.numbers[0]),words[1]);assert.equal(word(r.packet.numbers[1]),words[8]);assert.equal(r.completeOwnedDataQualified,false);
});
