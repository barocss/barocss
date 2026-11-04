// Fixed32 analytic normalization probes of the actual private Arithmetic instance. No shipping hook.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from '../../packages/barocss-physics/src/stack/strict-line.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
  make(n:bigint,d?:bigint):Rational;from(value:number):Rational;div(a:Rational,b:Rational):Rational;
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
function exact(api:typeof current,n:bigint,d:bigint,wantedN:bigint,wantedD:bigint){
 const m=arithmetic(api),result=m.make(n,d);assert.deepEqual(result,{n:wantedN,d:wantedD});return result;
}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
const literals:[string,bigint,bigint,bigint,bigint][]=[
 ['01 positive dyadic reduction',6n,8n,3n,4n],['02 negative numerator',-6n,8n,-3n,4n],
 ['03 negative denominator',6n,-8n,-3n,4n],['04 both negative',-6n,-8n,3n,4n],
 ['05 numerator factor exceeds denominator',32n,8n,4n,1n],['06 odd dyadic numerator',3n,8n,3n,8n],
 ['07 old zero route before sign normalization',0n,-8n,0n,1n],['08 positive integer',7n,1n,7n,1n],
 ['09 negative integer',-7n,1n,-7n,1n],['10 integer denominator sign normalization',7n,-1n,-7n,1n],
 ['11 composite nonbinary fallback',12n,18n,2n,3n],['12 signed nonbinary fallback',-15n,21n,-5n,7n]
];
for(const [name,n,d,wantedN,wantedD]of literals)test(name,async()=>{
 const old=await baseline();assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);assert.deepEqual(exact(current,n,d,wantedN,wantedD),exact(old,n,d,wantedN,wantedD));
});
for(const [name,n]of [['13 nonzero numerator zero denominator',5n],['14 zero denominator precedes zero shortcut',0n]] as const)test(name,async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(n,0n),'zero rational denominator');}
});
test('15 oversized integer numerator refuses before shortcut',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n,1n),'integer bit limit');}
});
test('16 oversized zero denominator operand refuses before zero shortcut',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(0n,1n<<16384n),'integer bit limit');}
});
test('17 exact maximum-bit integer numerator remains admitted',async()=>{
 const old=await baseline(),N=(1n<<16384n)-1n;assert.deepEqual(exact(current,N,1n,N,1n),exact(old,N,1n,N,1n));
});
test('18 exact maximum-bit binary denominator remains admitted',async()=>{
 const old=await baseline(),D=1n<<16383n;assert.deepEqual(exact(current,3n,D,3n,D),exact(old,3n,D,3n,D));
});
test('19 large common dyadic factor reduces to three halves',async()=>{
 const old=await baseline(),N=3n*(1n<<8191n),D=1n<<8192n;assert.deepEqual(exact(current,N,D,3n,2n),exact(old,N,D,3n,2n));
});
test('20 large numerator factor exceeds the binary denominator',async()=>{
 const old=await baseline(),N=1n<<8193n,D=1n<<8192n;assert.deepEqual(exact(current,N,D,2n,1n),exact(old,N,D,2n,1n));
});
test('21 large common dyadic factor preserves double sign normalization',async()=>{
 const old=await baseline(),N=-3n*(1n<<8191n),D=-(1n<<8192n);assert.deepEqual(exact(current,N,D,3n,2n),exact(old,N,D,3n,2n));
});
for(const [name,n,d,expectedWord]of [
 ['22 midpoint even lower',(1n<<53n)+1n,1n<<53n,'3ff0000000000000'],
 ['23 midpoint even upper',(1n<<53n)+3n,1n<<53n,'3ff0000000000002'],
 ['24 minimum subnormal',1n,1n<<1074n,'0000000000000001']
] as [string,bigint,bigint,string][])test(name,async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api),value=m.make(n,d);assert.deepEqual(value,{n,d});assert.equal(word(m.number(value)),expectedWord);}
});
test('25 signed binary64 zeros decode to canonical positive rational zero',async()=>{
 const old=await baseline();for(const api of [current,old])for(const input of [0,-0]){const m=arithmetic(api),value=m.from(input);assert.deepEqual(value,{n:0n,d:1n});assert.equal(word(m.number(value)),'0000000000000000');}
});
for(const [name,n,expectedWord]of [['26 negative half-subnormal rounds to negative zero',-1n,'8000000000000000'],['27 positive half-subnormal rounds to positive zero',1n,'0000000000000000']] as const)test(name,async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api);assert.equal(word(m.number(m.make(n,1n<<1075n))),expectedWord);}
});
test('28 all nonfinite binary64 operands retain original refusal',async()=>{
 const old=await baseline();for(const api of [current,old])for(const input of [Infinity,-Infinity,NaN]){const m=arithmetic(api);refusal(api,()=>m.from(input),'nonfinite exact operand');}
});
test('29 actual zero-divisor divisions retain original denominator refusal',async()=>{
 const old=await baseline();for(const api of [current,old]){const m=arithmetic(api),a=m.make(1n,7n),zero=m.make(0n);refusal(api,()=>m.div(a,zero),'zero rational denominator');refusal(api,()=>m.div(zero,zero),'zero rational denominator');}
});
test('30 actual rational exhaustion refuses division and candidate integer shortcut',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),zero=m.make(0n),a=m.make(1n,8n),b=m.make(3n,4n);let attempted=0,error:unknown=null;
  for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}
  assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');refusal(api,()=>m.div(a,b),'rational work limit');
  if(name==='candidate')refusal(api,()=>m.make(7n,1n),'rational work limit');receipts.push({name,attempted,counters:{...m.counters},baselineDirectMakeParityRequired:false});
 }t.diagnostic(JSON.stringify({actualNegExhaustion:receipts,noCounterMutation:true}));
});
test('31 actual nonbinary make exhaustion blocks all predeclared followup routes',async t=>{
 const old=await baseline(),receipts=[];
 for(const [name,api]of [['candidate',current],['baseline',old]] as const){
  const m=arithmetic(api),a=m.make(1n,8n),b=m.make(3n,4n),zero=m.make(0n),one=m.make(1n);let attempted=0,error:unknown=null,last:Rational|null=null;
  for(;attempted<200001;){attempted++;try{last=m.make(55n,89n);}catch(e){error=e;break;}}
  assert.deepEqual(last,{n:55n,d:89n});assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');assert.ok(m.counters.rationalOperations<=200000);
  refusal(api,()=>m.make(7n,1n),'integer work limit');refusal(api,()=>m.make(3n,8n),'integer work limit');refusal(api,()=>m.div(a,b),'integer work limit');refusal(api,()=>m.div(zero,one),'integer work limit');receipts.push({name,attempted,counters:{...m.counters}});
 }t.diagnostic(JSON.stringify({actualMakeExhaustion:receipts,noCounterMutation:true}));
});
test('32 candidate integer shortcut cannot recover an already failed bit context',t=>{
 const m=arithmetic(current);refusal(current,()=>m.make(1n<<16384n,1n),'integer bit limit');refusal(current,()=>m.make(7n,1n),'integer bit limit');
 t.diagnostic(JSON.stringify({candidateFailedContextGuard:true,baselineDirectMakeRecoveryParityRequired:false,counters:{...m.counters}}));
});
