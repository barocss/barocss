// Fixed26 analytic DIV probes of the actual private Arithmetic instance. No shipping hook.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from '../../packages/barocss-physics/src/stack/strict-line.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
  make(n:bigint,d?:bigint):Rational;div(a:Rational,b:Rational):Rational;
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
  const m=arithmetic(api),result=m.div(m.make(aN,aD),m.make(bN,bD));assert.deepEqual(result,{n,d});return result;
}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
const literals:[string,bigint,bigint,bigint,bigint,bigint,bigint][]=[
 ['01 positive shared denominator',3n,7n,2n,7n,3n,2n],['02 negative dividend',-3n,7n,2n,7n,-3n,2n],
 ['03 negative divisor',3n,7n,-2n,7n,-3n,2n],['04 both negative',-3n,7n,-2n,7n,3n,2n],
 ['05 divisible forward',1n,8n,3n,4n,1n,6n],['06 divisible reverse',3n,4n,1n,8n,6n,1n],
 ['07 divisible third forward',5n,12n,2n,3n,5n,8n],['08 divisible third reverse',2n,3n,5n,12n,8n,5n],
 ['09 zero dividend',0n,1n,3n,8n,0n,1n]
];
for(const [name,aN,aD,bN,bD,n,d]of literals)test(name,async()=>{
 const old=await baseline();assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
 assert.deepEqual(exact(current,aN,aD,bN,bD,n,d),exact(old,aN,aD,bN,bD,n,d));
});
test('10 nonzero divided by zero retains old zero-denominator refusal',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api),a=m.make(1n,7n),b=m.make(0n,1n);refusal(api,()=>m.div(a,b),'zero rational denominator');}
});
test('11 zero divided by zero retains old zero-denominator refusal',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api),zero=m.make(0n);refusal(api,()=>m.div(zero,zero),'zero rational denominator');}
});
for(const [name,aN,aD,bN,bD,n,d]of [
 ['12 neither denominator divides',1n,6n,1n,10n,5n,3n],['13 coprime fallback',2n,3n,4n,5n,5n,6n]
] as [string,bigint,bigint,bigint,bigint,bigint,bigint][])test(name,async()=>{
 const old=await baseline();assert.deepEqual(exact(current,aN,aD,bN,bD,n,d),exact(old,aN,aD,bN,bD,n,d));
});
test('14 original large shared-denominator example fits both unchanged caps',async()=>{
 const old=await baseline(),D=(1n<<8192n)+1n;
 for(const api of [current,old]){const m=arithmetic(api),sum=m.div(m.make(D-2n,D),m.make(D-4n,D));assert.deepEqual(sum,{n:D-2n,d:D-4n});assert.ok(m.counters.peakIntegerBits<=16384);}
});
test('15 large equal-denominator cancellation improves actual resource outcome',async t=>{
 const old=await baseline(),D=(1n<<8192n)+3n,m=arithmetic(current);assert.deepEqual(m.div(m.make(D-2n,D),m.make(D-4n,D)),{n:D-2n,d:D-4n});
 const prior=arithmetic(old),a=prior.make(D-2n,D),b=prior.make(D-4n,D);refusal(old,()=>prior.div(a,b),'integer bit limit');
 t.diagnostic(JSON.stringify({candidate:'EXACT_ANALYTIC_RATIO',baseline:'INTEGER_BIT_LIMIT',candidatePeak:m.counters.peakIntegerBits,baselinePeak:prior.counters.peakIntegerBits,universalResourceParity:false}));
});
for(const reverse of [false,true])test(reverse?'17 large divisible denominator reverse':'16 large divisible denominator forward',async t=>{
 const old=await baseline(),E=(1n<<8192n)+3n,m=arithmetic(current),a=m.make(2n*E-1n,2n*E),b=m.make(E-1n,E);
 assert.deepEqual(reverse?m.div(b,a):m.div(a,b),reverse?{n:2n*E-2n,d:2n*E-1n}:{n:2n*E-1n,d:2n*E-2n});
 const prior=arithmetic(old),x=prior.make(2n*E-1n,2n*E),y=prior.make(E-1n,E);refusal(old,()=>reverse?prior.div(y,x):prior.div(x,y),'integer bit limit');
 t.diagnostic(JSON.stringify({reverse,candidate:'EXACT_ANALYTIC_RATIO',baseline:'INTEGER_BIT_LIMIT',candidatePeak:m.counters.peakIntegerBits,baselinePeak:prior.counters.peakIntegerBits,universalResourceParity:false}));
});
for(const reverse of [false,true])test(reverse?'19 scaled numerator must refuse before reduction':'18 scaled denominator must refuse before reduction',async()=>{
 const old=await baseline(),Q=1n<<16383n;
 for(const api of [current,old]){const m=arithmetic(api),a=m.make(Q,3n),b=m.make(Q,1n);refusal(api,()=>reverse?m.div(b,a):m.div(a,b),'integer bit limit');assert.ok(m.counters.peakIntegerBits>16384);}
});
for(const reverse of [false,true])test(reverse?'21 maximum legal quotient reverse':'20 maximum legal quotient forward',async()=>{
 const old=await baseline(),Q=1n<<16383n;
 for(const api of [current,old]){const m=arithmetic(api),a=m.make(1n,Q),b=m.make(1n,1n);assert.deepEqual(reverse?m.div(b,a):m.div(a,b),reverse?{n:Q,d:1n}:{n:1n,d:Q});assert.ok(m.counters.peakIntegerBits<=16384);}
});
test('22 actual rational exhaustion blocks divisible division',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),zero=m.make(0n),a=m.make(1n,8n),b=m.make(3n,4n);let attempted=0,error:unknown=null;
  for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}
  assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');refusal(api,()=>m.div(a,b),'rational work limit');receipts.push({name,attempted,counters:{...m.counters}});
 }t.diagnostic(JSON.stringify({actualNegExhaustion:receipts,noCounterMutation:true}));
});
test('23 actual integer exhaustion blocks division in both orders',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),a=m.make(55n,178n),b=m.make(1n,2n),zero=m.make(0n),one=m.make(1n);let attempted=0,error:unknown=null,last:Rational|null=null;
  for(;attempted<200001;){attempted++;try{last=m.div(a,b);}catch(e){error=e;break;}}
  assert.deepEqual(last,{n:55n,d:89n});assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');
  assert.ok(m.counters.rationalOperations<=200000);refusal(api,()=>m.div(a,b),'integer work limit');refusal(api,()=>m.div(b,a),'integer work limit');refusal(api,()=>m.div(zero,one),'integer work limit');receipts.push({name,attempted,counters:{...m.counters}});
 }t.diagnostic(JSON.stringify({actualDivExhaustion:receipts,noCounterMutation:true}));
});
test('24 divisible RNE midpoint rounds to even lower word',async()=>{
 const old=await baseline(),D=1n<<53n;
 for(const api of [current,old]){const m=arithmetic(api),ratio=m.div(m.make(D+1n,D),m.make(1n,1n));assert.deepEqual(ratio,{n:D+1n,d:D});assert.equal(word(m.number(ratio)),'3ff0000000000000');}
});
test('25 equal-denominator RNE midpoint rounds to even upper word',async()=>{
 const old=await baseline(),D=1n<<53n;
 for(const api of [current,old]){const m=arithmetic(api),ratio=m.div(m.make(D+3n,1n),m.make(D,1n));assert.deepEqual(ratio,{n:D+3n,d:D});assert.equal(word(m.number(ratio)),'3ff0000000000002');}
});
test('26 divisible subnormal retains exact binary64 word',async()=>{
 const old=await baseline(),D=1n<<1074n;
 for(const api of [current,old]){const m=arithmetic(api),ratio=m.div(m.make(1n,D),m.make(1n,2n));assert.deepEqual(ratio,{n:1n,d:D/2n});assert.equal(word(m.number(ratio)),'0000000000000002');}
});
