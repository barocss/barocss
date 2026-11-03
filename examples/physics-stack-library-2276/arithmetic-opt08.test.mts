// Fixed32 exact bit-length controls. Actual private Arithmetic; no counter writes.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from './candidate-strict-line-opt08.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
 checked(value:bigint):bigint;make(n:bigint,d?:bigint):Rational;from(value:number):Rational;
 mul(a:Rational,b:Rational):Rational;sumSquare(a:Rational,b:Rational):Rational;
 neg(a:Rational):Rational;number(a:Rational):number;
 readonly counters:{rationalOperations:number;integerOperations:number;peakIntegerBits:number};
}
const current={StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS};
async function baseline(){assert.ok(process.env.STRICT_LINE_BASELINE_MODULE);return import(pathToFileURL(process.env.STRICT_LINE_BASELINE_MODULE).href);}
function box(id:string):Body{return parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[1,1,1]},positionM:[0,0,0],orientation:[0,0,0,1],velocityMps:[0,0,0],massKg:1,restitution:0});}
function arithmetic(api:typeof current):Probe{
 const seed=(new api.StrictLineContext(box('a'),box('b'),[0,1,0] as Vec3) as unknown as {readonly m:Probe}).m;
 // Construct the actual same private class, so small bit counts are observable
 // without resetting initialized-context counters or substituting an algorithm.
 const Constructor=Object.getPrototypeOf(seed).constructor as new()=>Probe,m=new Constructor();
 assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:0});return m;
}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
function verifyBits(api:typeof current,value:bigint,bits:number){const m=arithmetic(api);assert.equal(m.checked(value),value);assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:bits});}
// Independent literal nibble widths; no binary/hex string length in the oracle.
const nibbleWidths=[1,1,2,2,3,3,3,3,4,4,4,4,4,4,4,4] as const;
for(let digit=0;digit<16;digit++)test(String(digit+1).padStart(2,'0')+' literal leading nibble '+digit,async()=>{
 const old=await baseline();assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
 for(const q of [0,1,15,255,4095])for(const api of [current,old]){
  const value=BigInt(digit)<<(4n*BigInt(q)),bits=digit===0?1:4*q+nibbleWidths[digit];
  verifyBits(api,value,bits);verifyBits(api,-value,bits);
  if(digit!==0&&q!==0){const filled=value+((1n<<(4n*BigInt(q)))-1n);verifyBits(api,filled,bits);verifyBits(api,-filled,bits);}
 }
});
test('17 power boundaries use analytic shift exponents',async()=>{
 const old=await baseline();for(const k of [0,1,3,4,7,8,15,16,31,32,52,53,63,64,255,256,1023,1024,4095,4096,8191,8192,16382,16383]){
  const p=1n<<BigInt(k);for(const api of [current,old])for(const sign of [1n,-1n]){verifyBits(api,sign*p,k+1);verifyBits(api,sign*(p-1n),Math.max(1,k));}
 }
});
test('18 maximum legal positive and negative integers retain exact peak',async()=>{const old=await baseline(),p=(1n<<16384n)-1n;for(const api of [current,old]){verifyBits(api,p,16384);verifyBits(api,-p,16384);}});
for(const [name,value]of [['19 positive minimum oversized',1n<<16384n],['20 negative minimum oversized',-(1n<<16384n)],['21 larger oversized exact peak',(1n<<20000n)+7n]] as const)test(name,async()=>{
 const old=await baseline(),bits=name.startsWith('21')?20001:16385,receipts=[];for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.checked(value),'integer bit limit');assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:bits});receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('22 repeated checks keep monotonic peaks and do not tick',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);for(const [n,peak]of [[0n,1],[15n,4],[-16n,5],[1n,5],[255n,8],[-256n,9],[0n,9]] as const){assert.equal(m.checked(n),n);assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:peak});}}
});
test('23 oversized numerator precedes zero denominator',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n,0n),'integer bit limit');assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:16385});}
});
test('24 oversized denominator precedes zero numerator shortcut',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(0n,1n<<16384n),'integer bit limit');assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:0,peakIntegerBits:16385});}
});
test('25 numerator product refusal precedes invalid denominator',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api),p=1n<<8192n;refusal(api,()=>m.mul({n:p,d:0n},{n:p,d:1n}),'integer bit limit');assert.deepEqual(m.counters,{rationalOperations:1,integerOperations:1,peakIntegerBits:16385});}
});
test('26 signed raw normalization retains independent result and exact ticks',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);assert.deepEqual(m.make(12n,-18n),{n:-2n,d:3n});assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:9,peakIntegerBits:5});}
});
test('27 IEEE decode subnormals extrema and zero retain literal words',async()=>{
 const old=await baseline();for(const [value,n,d,expected]of [[0,0n,1n,'0000000000000000'],[-0,0n,1n,'0000000000000000'],[Number.MIN_VALUE,1n,1n<<1074n,'0000000000000001'],[-Number.MIN_VALUE,-1n,1n<<1074n,'8000000000000001'],[2**-1022,1n,1n<<1022n,'0010000000000000'],[Number.MAX_VALUE,9007199254740991n<<971n,1n,'7fefffffffffffff']] as const){
  const receipts=[];for(const api of [current,old]){const m=arithmetic(api),r=m.from(value);assert.deepEqual(r,{n,d});assert.equal(word(m.number(r)),expected);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
 }
});
test('28 nearest-even midpoint and signed underflow words retain exact counters',async()=>{
 const old=await baseline(),D=1n<<53n;for(const [n,d,expected]of [[D+1n,D,'3ff0000000000000'],[D+3n,D,'3ff0000000000002'],[1n,1n<<1075n,'0000000000000000'],[-1n,1n<<1075n,'8000000000000000']] as const){const receipts=[];for(const api of [current,old]){const m=arithmetic(api);assert.equal(word(m.number(m.make(n,d))),expected);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);}
});
test('29 actual prior bit failure preserves old stale-context resume and guards',async()=>{
 const old=await baseline(),receipts=[];for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.checked(1n<<16384n),'integer bit limit');assert.equal(m.checked(-1n),-1n);assert.deepEqual(m.make(0n),{n:0n,d:1n});refusal(api,()=>m.make(1n),'integer bit limit');assert.deepEqual(m.make(1n,3n),{n:1n,d:3n});assert.deepEqual(m.sumSquare({n:1n,d:8n},{n:1n,d:4n}),{n:9n,d:64n});assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('30 actual rational exhaustion cannot be bypassed by changed encoding',async t=>{
 const old=await baseline(),receipts=[];for(const api of [current,old]){const m=arithmetic(api),zero=m.make(0n);let attempted=0,error:unknown=null;for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');assert.equal(attempted,200001);refusal(api,()=>m.from(1),'rational work limit');const before={...m.counters};assert.equal(m.checked(0n),0n);assert.deepEqual(m.counters,before);receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualRationalExhaustion:receipts[0],noCounterMutation:true}));
});
test('31 actual integer exhaustion preserves checks and unit guard priority',async t=>{
 const old=await baseline(),receipts=[];for(const api of [current,old]){const m=arithmetic(api);let attempted=0,error:unknown=null;for(;attempted<200001;){attempted++;try{m.make(55n,89n);}catch(e){error=e;break;}}assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');assert.equal(attempted,142858);assert.deepEqual(m.counters,{rationalOperations:0,integerOperations:2000001,peakIntegerBits:7});const before={...m.counters};assert.equal(m.checked(0n),0n);assert.deepEqual(m.counters,before);refusal(api,()=>m.make(1n),'integer work limit');receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualIntegerExhaustion:receipts[0],noCounterMutation:true}));
});
test('32 real cap-boundary product passes then next product refuses identically',async t=>{
 const old=await baseline(),receipts=[];for(const api of [current,old]){const m=arithmetic(api);for(let i=0;i<142857;i++)assert.deepEqual(m.make(55n,89n),{n:55n,d:89n});assert.equal(m.counters.integerOperations,1999998);assert.deepEqual(m.mul({n:1n,d:1n},{n:1n,d:1n}),{n:1n,d:1n});assert.deepEqual(m.counters,{rationalOperations:1,integerOperations:2000000,peakIntegerBits:7});refusal(api,()=>m.mul({n:1n,d:1n},{n:1n,d:1n}),'integer work limit');assert.deepEqual(m.counters,{rationalOperations:2,integerOperations:2000001,peakIntegerBits:7});receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({sameActualWorkAdmission:receipts[0],noCounterMutation:true}));
});
