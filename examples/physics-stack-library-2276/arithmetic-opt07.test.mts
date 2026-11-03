// Fixed32 independent sum-square probes; no production override or counter write.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from '../../packages/barocss-physics/src/stack/strict-line.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
 make(n:bigint,d?:bigint):Rational;add(a:Rational,b:Rational):Rational;
 mul(a:Rational,b:Rational):Rational;sumSquare(a:Rational,b:Rational):Rational;
 neg(a:Rational):Rational;number(a:Rational):number;
 readonly counters:{rationalOperations:number;integerOperations:number;peakIntegerBits:number};
}
const current={StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS};
async function baseline(){assert.ok(process.env.STRICT_LINE_BASELINE_MODULE);return import(pathToFileURL(process.env.STRICT_LINE_BASELINE_MODULE).href);}
function box(id:string):Body{return parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[1,1,1]},positionM:[0,0,0],orientation:[0,0,0,1],velocityMps:[0,0,0],massKg:1,restitution:0});}
function arithmetic(api:typeof current):Probe{return (new api.StrictLineContext(box('a'),box('b'),[0,1,0] as Vec3) as unknown as {readonly m:Probe}).m;}
function evaluate(m:Probe,candidate:boolean,a:Rational,b:Rational):Rational{if(candidate)return m.sumSquare(a,b);const sum=m.add(a,b);return m.mul(sum,sum);}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
type Literal=[string,bigint,bigint,bigint,bigint,bigint,bigint,number,number];
const literals:Literal[]=[
 ['01 positive nonbinary sum',1n,5n,2n,5n,9n,25n,11,20],
 ['02 negative nonbinary sum',-1n,5n,-2n,5n,9n,25n,11,20],
 ['03 negative raw denominators',1n,-5n,2n,-5n,9n,25n,13,22],
 ['04 nonreduced raw inputs',6n,8n,-1n,4n,1n,4n,12,18],
 ['05 dyadic normalized sum',1n,8n,1n,4n,9n,64n,12,18],
 ['06 integer normalized sum',2n,3n,1n,3n,1n,1n,8,8],
 ['07 cancellation zero',1n,7n,-1n,7n,0n,1n,3,3],
 ['08 zero before negative denominator sign',0n,-3n,0n,-3n,0n,1n,3,3],
 ['09 dyadic sum becomes integer',3n,2n,-1n,2n,1n,1n,9,9],
 ['10 reverse divisible denominator sum',1n,3n,1n,6n,1n,4n,13,19],
 ['11 general add fallback',1n,3n,1n,5n,64n,225n,16,26],
 ['12 signed general add fallback',1n,-3n,1n,5n,4n,225n,15,22],
];
for(const [name,an,ad,bn,bd,n,d,newTicks,oldTicks]of literals)test(name,async()=>{
 const old=await baseline(),peaks=[];assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
 for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),a={n:an,d:ad},b={n:bn,d:bd},before={...m.counters};assert.deepEqual(evaluate(m,candidate,a,b),{n,d});assert.deepEqual(a,{n:an,d:ad});assert.deepEqual(b,{n:bn,d:bd});assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,candidate?newTicks:oldTicks);assert.equal(m.counters.peakIntegerBits,before.peakIntegerBits);peaks.push(m.counters.peakIntegerBits);}assert.equal(peaks[0],peaks[1]);
});
for(const [name,an,ad,bn,bd,ticks]of [
 ['13 equal zero denominators',1n,0n,1n,0n,1],
 ['14 zero numerator cannot hide zero denominator',0n,0n,0n,5n,4],
 ['15 mixed invalid denominator',1n,3n,1n,0n,4]
] as const)test(name,async()=>{const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};refusal(api,()=>evaluate(m,candidate,{n:an,d:ad},{n:bn,d:bd}),'zero rational denominator');assert.equal(m.counters.rationalOperations-before.rationalOperations,1);assert.equal(m.counters.integerOperations-before.integerOperations,ticks);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);});
test('16 oversized add intermediate refuses before cancellation and square',async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};refusal(api,()=>evaluate(m,candidate,{n:P,d:P+1n},{n:-P,d:P-1n}),'integer bit limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,1);assert.equal(m.counters.integerOperations-before.integerOperations,4);assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('17 maximum legal numerator square uses independent polynomial value',async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};assert.deepEqual(evaluate(m,candidate,{n:P-1n,d:1n},{n:0n,d:1n}),{n:(1n<<16384n)-(1n<<8193n)+1n,d:1n});assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,3);assert.equal(m.counters.peakIntegerBits,16384);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('18 oversized numerator square refuses before denominator product',async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};refusal(api,()=>evaluate(m,candidate,{n:P,d:1n},{n:0n,d:1n}),'integer bit limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,2);assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('19 maximum legal denominator square uses independent polynomial value',async()=>{
 const old=await baseline(),P=1n<<8192n,peaks=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};assert.deepEqual(evaluate(m,candidate,{n:1n,d:P-1n},{n:0n,d:P-1n}),{n:1n,d:(1n<<16384n)-(1n<<8193n)+1n});assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,candidate?9:15);assert.equal(m.counters.peakIntegerBits,16384);peaks.push(m.counters.peakIntegerBits);}assert.equal(peaks[0],peaks[1]);
});
test('20 oversized denominator square retains original checked failure',async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};refusal(api,()=>evaluate(m,candidate,{n:1n,d:P},{n:0n,d:P}),'integer bit limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,9);assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('21 large nonreduced raw input is normalized inside sumSquare',async()=>{
 const old=await baseline(),Q=1n<<4096n;for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),before={...m.counters};assert.deepEqual(evaluate(m,candidate,{n:6n*Q,d:8n*Q},{n:-Q,d:4n*Q}),{n:1n,d:4n});assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,candidate?12:18);assert.equal(m.counters.peakIntegerBits,4100);}
});
for(const [name,an,ad,bn,bd,n,d,expected]of [
 ['22 exact normal RNE word',1n,2n,1n,1n,9n,4n,'4002000000000000'],
 ['23 minimum subnormal square',1n,1n<<537n,0n,1n<<537n,1n,1n<<1074n,'0000000000000001'],
 ['24 positive underflow square',1n,1n<<538n,0n,1n<<538n,1n,1n<<1076n,'0000000000000000'],
 ['25 negative operand yields positive square',-1n,1n<<537n,0n,1n<<537n,1n,1n<<1074n,'0000000000000001']
] as const)test(name,async()=>{const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),value=evaluate(m,candidate,{n:an,d:ad},{n:bn,d:bd});assert.deepEqual(value,{n,d});assert.equal(word(m.number(value)),expected);receipts.push({...m.counters});}assert.equal(receipts[0].rationalOperations,receipts[1].rationalOperations);assert.equal(receipts[1].integerOperations-receipts[0].integerOperations,6);assert.equal(receipts[0].peakIntegerBits,receipts[1].peakIntegerBits);});
test('26 actual rational exhaustion preserves addition refusal',async t=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),zero=m.make(0n);let attempted=0,error:unknown=null;for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');refusal(api,()=>evaluate(m,candidate,{n:1n,d:5n},{n:2n,d:5n}),'rational work limit');receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualRationalExhaustion:receipts[0],noCounterMutation:true}));
});
test('27 actual integer exhaustion preserves addition refusal',async t=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api);let attempted=0,error:unknown=null,last:Rational|null=null;for(;attempted<200001;){attempted++;try{last=m.make(55n,89n);}catch(e){error=e;break;}}assert.deepEqual(last,{n:55n,d:89n});assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');assert.ok(m.counters.rationalOperations<200000);refusal(api,()=>evaluate(m,candidate,{n:1n,d:5n},{n:2n,d:5n}),'integer work limit');receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualIntegerExhaustion:receipts[0],noCounterMutation:true}));
});
test('28 prior bit failure retains nonzero integer failed-context guard',async()=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n),'integer bit limit');refusal(api,()=>evaluate(m,candidate,{n:2n,d:3n},{n:1n,d:3n}),'integer bit limit');assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('29 prior bit failure retains OLD direct zero return behavior',async()=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n),'integer bit limit');assert.deepEqual(evaluate(m,candidate,{n:1n,d:7n},{n:-1n,d:7n}),{n:0n,d:1n});assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
test('30 prior bit failure retains OLD direct nonunit return behavior',async()=>{
 const old=await baseline();for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n),'integer bit limit');const before={...m.counters};assert.deepEqual(evaluate(m,candidate,{n:1n,d:8n},{n:1n,d:4n}),{n:9n,d:64n});assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations-before.integerOperations,candidate?12:18);assert.equal(m.counters.peakIntegerBits,16385);}
});
function prefill(m:Probe,remaining:number){
 const zero=m.make(0n),target=STRICT_LINE_LIMITS.integerOperations-remaining,before={...m.counters};let makes=0,padding=0;
 for(;m.counters.integerOperations+14<=target&&makes<200001;makes++)assert.deepEqual(m.make(55n,89n),{n:55n,d:89n});
 assert.equal(m.counters.integerOperations,before.integerOperations+14*makes);for(;m.counters.integerOperations<target&&padding<14;padding++)m.neg(zero);assert.ok(padding<=13);assert.equal(m.counters.integerOperations,target);assert.ok(m.counters.rationalOperations<200000);return {makes,padding,before};
}
test('31 fixed real remaining12 work admits new exact square but old GCD refuses',async t=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),fill=prefill(m,12),before={...m.counters};if(candidate)assert.deepEqual(evaluate(m,true,{n:1n,d:8n},{n:1n,d:4n}),{n:9n,d:64n});else refusal(api,()=>evaluate(m,false,{n:1n,d:8n},{n:1n,d:4n}),'integer work limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations,candidate?2000000:2000002);assert.equal(m.counters.peakIntegerBits,before.peakIntegerBits);receipts.push({fill,before,after:{...m.counters}});}assert.deepEqual(receipts[0].fill,receipts[1].fill);assert.deepEqual(receipts[0].before,receipts[1].before);t.diagnostic(JSON.stringify({actualWorkAdmissionDifference:receipts,unchangedLimit:2000000}));
});
test('32 fixed real remaining11 work refuses same second product in both',async t=>{
 const old=await baseline(),receipts=[];for(const [candidate,api]of [[true,current],[false,old]] as const){const m=arithmetic(api),fill=prefill(m,11),before={...m.counters};refusal(api,()=>evaluate(m,candidate,{n:1n,d:8n},{n:1n,d:4n}),'integer work limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,2);assert.equal(m.counters.integerOperations,2000001);receipts.push({fill,before,after:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({samePreNormalizationRefusal:receipts[0],noCounterMutation:true}));
});
