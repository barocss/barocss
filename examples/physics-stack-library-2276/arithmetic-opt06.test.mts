// Fixed32 analytic probes; read the real TS-private Arithmetic, never change it.
import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {Body,Vec3} from '../../packages/barocss-physics/src/internal-types.js';
import {StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS} from '../../packages/barocss-physics/src/stack/strict-line.js';
interface Rational {n:bigint;d:bigint}
interface Probe {
 make(n:bigint,d?:bigint):Rational;mul(a:Rational,b:Rational):Rational;
 add(a:Rational,b:Rational):Rational;div(a:Rational,b:Rational):Rational;
 neg(a:Rational):Rational;number(a:Rational):number;
 readonly counters:{rationalOperations:number;integerOperations:number;peakIntegerBits:number};
}
const current={StrictLineContext,StrictLineFailure,STRICT_LINE_LIMITS};
async function baseline(){assert.ok(process.env.STRICT_LINE_BASELINE_MODULE);return import(pathToFileURL(process.env.STRICT_LINE_BASELINE_MODULE).href);}
function box(id:string):Body{return parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[1,1,1]},positionM:[0,0,0],orientation:[0,0,0,1],velocityMps:[0,0,0],massKg:1,restitution:0});}
function arithmetic(api:typeof current):Probe{return (new api.StrictLineContext(box('a'),box('b'),[0,1,0] as Vec3) as unknown as {readonly m:Probe}).m;}
function refusal(api:typeof current,call:()=>unknown,message:string){assert.throws(call,(e:unknown)=>e instanceof api.StrictLineFailure&&(e as Error).message===message);}
function word(value:number){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return bytes.toString('hex');}
type Op='mul'|'add'|'div';
type Literal=[string,Op,bigint,bigint,bigint,bigint,bigint|null,bigint|null,number];
const literals:Literal[]=[
 ['01 positive multiplication','mul',2n,3n,3n,5n,2n,5n,9],
 ['02 negative numerator','mul',-2n,3n,3n,5n,-2n,5n,9],
 ['03 negative product denominator','mul',2n,3n,3n,-5n,-2n,5n,11],
 ['04 both input denominators negative','mul',-2n,-3n,3n,-5n,-2n,5n,9],
 ['05 unreduced input rationals','mul',6n,8n,10n,15n,1n,2n,8],
 ['06 canonical zero product','mul',0n,1n,5n,7n,0n,1n,2],
 ['07 zero before negative denominator sign','mul',0n,-2n,3n,5n,0n,1n,2],
 ['08 zero numerator and denominator priority','mul',0n,1n,3n,0n,null,null,2],
 ['09 nonzero numerator zero denominator','mul',3n,0n,5n,7n,null,null,2],
 ['10 dyadic normalization retained','mul',1n,2n,1n,2n,1n,4n,8],
 ['11 integer normalization retained','mul',2n,1n,3n,1n,6n,1n,2],
 ['12 signed integer normalization','mul',-2n,1n,3n,-1n,6n,1n,4],
 ['13 general add fallback','add',1n,3n,1n,5n,8n,15n,14],
 ['14 signed add fallback','add',-1n,3n,1n,5n,-2n,15n,13],
 ['15 coprime add fallback','add',1n,3n,2n,5n,11n,15n,15],
 ['16 negative denominator add fallback','add',1n,-3n,1n,5n,-2n,15n,13],
 ['17 nondividing composite add fallback','add',1n,6n,1n,10n,4n,15n,14],
 ['18 zero sum normalization','add',0n,3n,0n,5n,0n,1n,6],
 ['19 invalid zero denominator add fallback','add',0n,0n,0n,5n,null,null,4],
 ['20 general division fallback','div',2n,3n,4n,5n,5n,6n,11],
 ['21 signed dividend fallback','div',-2n,3n,4n,5n,-5n,6n,11],
 ['22 signed divisor fallback','div',2n,3n,-4n,5n,-5n,6n,13],
 ['23 division zero denominator priority','div',0n,1n,0n,1n,null,null,2],
 ['24 unchanged divisible denominator path','div',0n,1n,3n,8n,0n,1n,4],
];
for(const [name,op,an,ad,bn,bd,n,d,integerDelta]of literals)test(name,async()=>{
 const old=await baseline(),receipts=[];assert.deepEqual(STRICT_LINE_LIMITS,old.STRICT_LINE_LIMITS);
 for(const api of [current,old]){
  const m=arithmetic(api),a={n:an,d:ad},b={n:bn,d:bd},before={...m.counters};
  if(n===null)refusal(api,()=>m[op](a,b),'zero rational denominator');else assert.deepEqual(m[op](a,b),{n,d});
  assert.deepEqual(a,{n:an,d:ad});assert.deepEqual(b,{n:bn,d:bd});
  assert.equal(m.counters.rationalOperations-before.rationalOperations,1);assert.equal(m.counters.integerOperations-before.integerOperations,integerDelta);assert.equal(m.counters.peakIntegerBits,before.peakIntegerBits);
  receipts.push({before,after:{...m.counters}});
 }assert.deepEqual(receipts[0],receipts[1],'complete OPT05 counter/peak parity');
});
test('25 maximum legal product retains exact integer and counters',async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];
 for(const api of [current,old]){const m=arithmetic(api),before={...m.counters};assert.deepEqual(m.mul({n:P,d:1n},{n:P-1n,d:1n}),{n:(1n<<16384n)-P,d:1n});assert.equal(m.counters.rationalOperations-before.rationalOperations,1);assert.equal(m.counters.integerOperations-before.integerOperations,2);assert.equal(m.counters.peakIntegerBits,16384);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
for(const [name,op]of [['26 oversized numerator precedes invalid denominator','mul'],['27 oversized add cross-product precedes cancellation','add'],['28 oversized div denominator precedes reduction','div']] as const)test(name,async()=>{
 const old=await baseline(),P=1n<<8192n,receipts=[];
 for(const api of [current,old]){
  const m=arithmetic(api),before={...m.counters};
  const a=op==='mul'?{n:P,d:0n}:{n:P,d:P+1n},b=op==='mul'?{n:P,d:1n}:{n:op==='add'?-P:P,d:P-1n};
  refusal(api,()=>m[op](a,b),'integer bit limit');assert.equal(m.counters.rationalOperations-before.rationalOperations,1);assert.equal(m.counters.integerOperations-before.integerOperations,op==='mul'?1:4);assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});
 }assert.deepEqual(receipts[0],receipts[1]);
});
test('29 multiplication preserves independent midpoint and signed zero words',async()=>{
 const old=await baseline(),D=1n<<53n;
 for(const [n,d,expected]of [[D+1n,D,'3ff0000000000000'],[D+3n,D,'3ff0000000000002'],[-1n,1n<<1075n,'8000000000000000'],[1n,1n<<1075n,'0000000000000000']] as const){const receipts=[];for(const api of [current,old]){const m=arithmetic(api),value=m.mul({n,d},{n:1n,d:1n});assert.deepEqual(value,{n,d});assert.equal(word(m.number(value)),expected);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);}
});
test('30 actual rational exhaustion retains all followup refusal counters',async t=>{
 const old=await baseline(),receipts=[];
 for(const api of [current,old]){const m=arithmetic(api),zero=m.make(0n);let attempted=0,error:unknown=null;for(;attempted<200001;){attempted++;try{m.neg(zero);}catch(e){error=e;break;}}assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'rational work limit');for(const op of ['mul','add','div'] as const)refusal(api,()=>m[op]({n:1n,d:3n},{n:1n,d:5n}),'rational work limit');receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualRationalExhaustion:receipts[0],noCounterMutation:true}));
});
test('31 actual integer exhaustion retains all followup refusal counters',async t=>{
 const old=await baseline(),receipts=[];
 for(const api of [current,old]){const m=arithmetic(api);let attempted=0,error:unknown=null,last:Rational|null=null;for(;attempted<200001;){attempted++;try{last=m.mul({n:55n,d:89n},{n:1n,d:1n});}catch(e){error=e;break;}}assert.deepEqual(last,{n:55n,d:89n});assert.ok(error instanceof api.StrictLineFailure);assert.equal((error as Error).message,'integer work limit');assert.ok(m.counters.rationalOperations<=200000);for(const op of ['mul','add','div'] as const)refusal(api,()=>m[op]({n:1n,d:3n},{n:1n,d:5n}),'integer work limit');refusal(api,()=>m.make(1n),'integer work limit');receipts.push({attempted,counters:{...m.counters}});}assert.deepEqual(receipts[0],receipts[1]);t.diagnostic(JSON.stringify({actualIntegerExhaustion:receipts[0],noCounterMutation:true}));
});
test('32 previously failed bit context retains product integer guard',async()=>{
 const old=await baseline(),receipts=[];for(const api of [current,old]){const m=arithmetic(api);refusal(api,()=>m.make(1n<<16384n),'integer bit limit');refusal(api,()=>m.mul({n:1n,d:1n},{n:1n,d:1n}),'integer bit limit');assert.equal(m.counters.peakIntegerBits,16385);receipts.push({...m.counters});}assert.deepEqual(receipts[0],receipts[1]);
});
