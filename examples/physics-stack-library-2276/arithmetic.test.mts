// Fixed16 analytic probes of the actual private Arithmetic instance. No shipping hook.
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
  ['01 zero',0n,1n,0n,1n,0n,1n],['02 positive integers',3n,1n,4n,1n,7n,1n],
  ['03 signed integers',-5n,1n,2n,1n,-3n,1n],['04 cancellation',5n,7n,-5n,7n,0n,1n],
  ['05 positive reduction',1n,6n,1n,6n,1n,3n],['06 negative reduction',-1n,6n,-1n,6n,-1n,3n],
  ['07 unequal numerators',2n,9n,5n,9n,7n,9n],['08 unequal denominators',1n,2n,1n,3n,5n,6n],
  ['09 zero fallback',0n,1n,1n,7n,1n,7n]
];
for(const [name,aN,aD,bN,bD,n,d]of literals)test(name,async()=>{
  const old=await baseline();assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
  assert.deepEqual(exact(current,aN,aD,bN,bD,n,d),exact(old,aN,aD,bN,bD,n,d));
});
test('10 large same denominator improves actual temporary resource outcome',async t=>{
  const old=await baseline(),D=(1n<<8192n)+1n,m=arithmetic(current),a=m.make(1n,D),b=m.make(1n,D);
  assert.deepEqual(m.add(a,b),{n:2n,d:D});assert.ok(m.counters.peakIntegerBits<=16384);
  const prior=arithmetic(old),x=prior.make(1n,D),y=prior.make(1n,D);refusal(old,()=>prior.add(x,y),'integer bit limit');
  t.diagnostic(JSON.stringify({candidate:'CANONICAL_2_OVER_D',baseline:'INTEGER_BIT_LIMIT',candidatePeak:m.counters.peakIntegerBits,baselinePeak:prior.counters.peakIntegerBits,universalResourceParity:false}));
});
test('11 raw same-denominator numerator sum must still exceed bit guard',async()=>{
  const old=await baseline(),N=(1n<<16384n)-1n;
  for(const api of [current,old]){const m=arithmetic(api),a=m.make(N,2n),b=m.make(N,2n);refusal(api,()=>m.add(a,b),'integer bit limit');assert.ok(m.counters.peakIntegerBits>16384);}
});
test('12 actual neg exhaustion prevents later fast-branch addition',async t=>{
  const old=await baseline(),receipts=[];
  for(const [name,api]of [['candidate',current],['baseline',old]] as const){
    const m=arithmetic(api),zero=m.make(0n);let attempted=0,error:unknown=null;
    for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}
    assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');
    refusal(api,()=>m.add(zero,zero),'rational work limit');receipts.push({name,attempted,counters:{...m.counters}});
  }t.diagnostic(JSON.stringify({actualNegExhaustion:receipts,noCounterMutation:true}));
});
test('13 actual integer-work exhaustion prevents later fast-branch addition',async t=>{
  const old=await baseline(),receipts=[];
  for(const [name,api]of [['candidate',current],['baseline',old]] as const){
    const m=arithmetic(api),a=m.make(1n,89n),b=m.make(54n,89n);let attempted=0,error:unknown=null;
    for(;attempted<200001;){attempted++;try{assert.deepEqual(m.add(a,b),{n:55n,d:89n});}catch(e){error=e;break;}}
    assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');
    assert.ok(m.counters.rationalOperations<=200000);refusal(api,()=>m.add(a,b),'integer work limit');receipts.push({name,attempted,counters:{...m.counters}});
  }t.diagnostic(JSON.stringify({actualAddExhaustion:receipts,noCounterMutation:true}));
});
test('14 analytic half-ULP tie rounds to even lower word',async()=>{
  const old=await baseline(),N=(1n<<53n)+1n,D=1n<<54n;
  for(const api of [current,old]){const m=arithmetic(api),result=m.add(m.make(N,D),m.make(N,D));assert.deepEqual(result,{n:N,d:1n<<53n});assert.equal(word(m.number(result)),'3ff0000000000000');}
});
test('15 analytic next half-ULP tie rounds to even upper word',async()=>{
  const old=await baseline(),N=(1n<<53n)+3n,D=1n<<54n;
  for(const api of [current,old]){const m=arithmetic(api),result=m.add(m.make(N,D),m.make(N,D));assert.deepEqual(result,{n:N,d:1n<<53n});assert.equal(word(m.number(result)),'3ff0000000000002');}
});
test('16 analytic subnormal sum retains exact binary64 word',async()=>{
  const old=await baseline(),D=1n<<1074n;
  for(const api of [current,old]){const m=arithmetic(api),result=m.add(m.make(1n,D),m.make(1n,D));assert.deepEqual(result,{n:1n,d:1n<<1073n});assert.equal(word(m.number(result)),'0000000000000002');}
});
