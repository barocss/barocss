// Fixed25 analytic probes of the actual private Arithmetic instance. No shipping hook.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from '../../packages/barocss-physics/src/stack/strict-line.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
  make(n:bigint,d?:bigint):Rational;add(a:Rational,b:Rational):Rational;
  neg(a:Rational):Rational;number(a:Rational):number;
  readonly counters:{rationalOperations:number;integerOperations:number;peakIntegerBits:number};
}
const current={StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS};
async function baseline(){assert.ok(process.env.STRICT_LINE_BASELINE_MODULE);return import(pathToFileURL(process.env.STRICT_LINE_BASELINE_MODULE).href);}
function box(id:string):Body{return parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[1,1,1]},positionM:[0,0,0],orientation:[0,0,0,1],velocityMps:[0,0,0],massKg:1,restitution:0});}
function arithmetic(api:typeof current):Probe {
  const context=new api.StrictLineContext(box('a'),box('b'),[0,1,0] as Vec3);
  // TEST ONLY: read the existing TS-private field; never change fields/counters.
  return (context as unknown as {readonly m:Probe}).m;
}
function exact(api:typeof current,aN:bigint,aD:bigint,bN:bigint,bD:bigint,n:bigint,d:bigint){
  const m=arithmetic(api),result=m.add(m.make(aN,aD),m.make(bN,bD));assert.deepEqual(result,{n,d});return result;
}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
const literals:[string,bigint,bigint,bigint,bigint,bigint,bigint][]=[
 ['01 equal denominators',2n,7n,3n,7n,5n,7n],
 ['02 divisible forward',1n,8n,1n,2n,5n,8n],['03 divisible reverse',1n,2n,1n,8n,5n,8n],
 ['04 divisible third forward',1n,12n,1n,3n,5n,12n],['05 divisible third reverse',1n,3n,1n,12n,5n,12n],
 ['06 signed reduction forward',-7n,12n,1n,3n,-1n,4n],['07 signed reduction reverse',1n,3n,-7n,12n,-1n,4n],
 ['08 zero forward',0n,1n,3n,8n,3n,8n],['09 zero reverse',3n,8n,0n,1n,3n,8n],
 ['10 neither denominator divides',1n,6n,1n,10n,4n,15n],
 ['11 coprime fallback',1n,2n,1n,3n,5n,6n],['12 equal cancellation',5n,7n,-5n,7n,0n,1n]
];
for(const [name,aN,aD,bN,bD,n,d]of literals)test(name,async()=>{
 const old=await baseline();assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
 assert.deepEqual(exact(current,aN,aD,bN,bD,n,d),exact(old,aN,aD,bN,bD,n,d));
});
for(const reverse of [false,true])test(reverse?'14 large divisible reverse':'13 large divisible forward',async t=>{
 const old=await baseline(),D=1n<<8193n;
 const m=arithmetic(current),a=m.make(1n,D),b=m.make(1n,D/2n);
 assert.deepEqual(reverse?m.add(b,a):m.add(a,b),{n:3n,d:D});assert.ok(m.counters.peakIntegerBits<=16384);
 const prior=arithmetic(old),x=prior.make(1n,D),y=prior.make(1n,D/2n);
 refusal(old,()=>reverse?prior.add(y,x):prior.add(x,y),'integer bit limit');
 t.diagnostic(JSON.stringify({reverse,candidate:'EXACT_3_OVER_D',baseline:'INTEGER_BIT_LIMIT',candidatePeak:m.counters.peakIntegerBits,baselinePeak:prior.counters.peakIntegerBits,universalResourceParity:false}));
});
for(const reverse of [false,true])test(reverse?'16 raw sum guard reverse':'15 raw sum guard forward',async()=>{
 const old=await baseline(),N=(1n<<16384n)-3n;
 for(const api of [current,old]){const m=arithmetic(api),a=m.make(N,6n),b=m.make(4n,3n);refusal(api,()=>reverse?m.add(b,a):m.add(a,b),'integer bit limit');assert.ok(m.counters.peakIntegerBits>16384);}
});
for(const reverse of [false,true])test(reverse?'18 scaled product guard reverse':'17 scaled product guard forward',async()=>{
 const old=await baseline();
 for(const api of [current,old]){const m=arithmetic(api),a=m.make(1n,2n),b=m.make(1n<<16383n,1n);refusal(api,()=>reverse?m.add(b,a):m.add(a,b),'integer bit limit');assert.ok(m.counters.peakIntegerBits>16384);}
});
for(const reverse of [false,true])test(reverse?'20 maximum legal quotient reverse':'19 maximum legal quotient forward',async()=>{
 const old=await baseline(),Q=1n<<16383n;
 for(const api of [current,old]){const m=arithmetic(api),a=m.make(1n,Q),b=m.make(1n,1n);assert.deepEqual(reverse?m.add(b,a):m.add(a,b),{n:Q+1n,d:Q});assert.ok(m.counters.peakIntegerBits<=16384);}
});
test('21 actual rational exhaustion blocks divisible add',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),zero=m.make(0n),a=m.make(1n,8n),b=m.make(1n,2n);let attempted=0,error:unknown=null;
  for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}
  assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');
  refusal(api,()=>m.add(a,b),'rational work limit');receipts.push({name,attempted,counters:{...m.counters}});
 }t.diagnostic(JSON.stringify({actualNegExhaustion:receipts,noCounterMutation:true}));
});
test('22 actual integer exhaustion blocks divisible add in both orders',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),a=m.make(1n,178n),b=m.make(54n,89n);let attempted=0,error:unknown=null,last:Rational|null=null;
  for(;attempted<200001;){attempted++;try{last=m.add(a,b);}catch(e){error=e;break;}}
  assert.deepEqual(last,{n:109n,d:178n});assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');
  assert.ok(m.counters.rationalOperations<=200000);refusal(api,()=>m.add(a,b),'integer work limit');refusal(api,()=>m.add(b,a),'integer work limit');receipts.push({name,attempted,counters:{...m.counters}});
 }t.diagnostic(JSON.stringify({actualAddExhaustion:receipts,noCounterMutation:true}));
});
test('23 divisible RNE midpoint rounds to even lower word',async()=>{
 const old=await baseline(),D=1n<<53n;
 for(const api of [current,old]){const m=arithmetic(api),sum=m.add(m.make(1n,1n),m.make(1n,D));assert.deepEqual(sum,{n:D+1n,d:D});assert.equal(word(m.number(sum)),'3ff0000000000000');}
});
test('24 reverse divisible RNE midpoint rounds to even upper word',async()=>{
 const old=await baseline(),D=1n<<53n;
 for(const api of [current,old]){const m=arithmetic(api),sum=m.add(m.make(3n,D),m.make(1n,1n));assert.deepEqual(sum,{n:D+3n,d:D});assert.equal(word(m.number(sum)),'3ff0000000000002');}
});
test('25 divisible subnormal sum retains exact binary64 word',async()=>{
 const old=await baseline(),D=1n<<1074n;
 for(const api of [current,old]){const m=arithmetic(api),sum=m.add(m.make(1n,D),m.make(1n,D/2n));assert.deepEqual(sum,{n:3n,d:D});assert.equal(word(m.number(sum)),'0000000000000003');}
});
