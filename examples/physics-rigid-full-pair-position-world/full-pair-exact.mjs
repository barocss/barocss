import {createMeter,unsafe} from './full-pair-input.mjs';
import {prepareModel} from './full-pair-linear.mjs';
const ZERO=Object.freeze({n:0n,d:1n}),ONE=Object.freeze({n:1n,d:1n});
const bits=x=>x===0n?0:(x<0n?-x:x).toString(2).length;
function operation(meter,estimate,fn){meter.plannedBits(estimate);meter.take('exactIntegerOperations');const x=fn();meter.bits(x);return x;}
const addI=(a,b,m)=>operation(m,Math.max(bits(a),bits(b))+1,()=>a+b);
const subI=(a,b,m)=>operation(m,Math.max(bits(a),bits(b))+1,()=>a-b);
const mulI=(a,b,m)=>operation(m,bits(a)+bits(b),()=>a*b);
const divI=(a,b,m)=>operation(m,bits(a),()=>a/b);
const remI=(a,b,m)=>operation(m,bits(a),()=>a%b);
const shiftI=(a,k,m)=>operation(m,bits(a)+k,()=>a<<BigInt(k));
function absI(a,m){return a<0n?subI(0n,a,m):a;}
function gcd(a,b,m){a=absI(a,m);b=absI(b,m);while(b!==0n){const next=remI(a,b,m);a=b;b=next;}return a;}
function checked(q,m){m.bits(q.n,true);m.bits(q.d,true);return q;}
function rational(n,d,m){
  if(d===0n)unsafe('uncertified-infeasibility');
  if(d<0n){n=subI(0n,n,m);d=subI(0n,d,m);}
  if(n===0n)return checked(ZERO,m);
  const g=gcd(n,d,m);return checked({n:divI(n,g,m),d:divI(d,g,m)},m);
}
function addQ(a,b,m){if(a.n===0n)return checked(b,m);if(b.n===0n)return checked(a,m);return rational(addI(mulI(a.n,b.d,m),mulI(b.n,a.d,m),m),mulI(a.d,b.d,m),m);}
function negQ(a,m){return a.n===0n?checked(ZERO,m):checked({n:subI(0n,a.n,m),d:a.d},m);}
function subQ(a,b,m){return addQ(a,negQ(b,m),m);}
function mulQ(a,b,m){if(a.n===0n||b.n===0n)return checked(ZERO,m);return rational(mulI(a.n,b.n,m),mulI(a.d,b.d,m),m);}
function divQ(a,b,m){if(b.n===0n)unsafe('uncertified-infeasibility');if(a.n===0n)return checked(ZERO,m);return rational(mulI(a.n,b.d,m),mulI(a.d,b.n,m),m);}
const text=q=>`${q.n}/${q.d}`;
function fromNumber(value,m){
  if(!Number.isFinite(value))unsafe('nonfinite');if(value===0)return checked(ZERO,m);
  const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);const raw=view.getBigUint64(0,false);
  const sign=raw>>63n,exponent=Number((raw>>52n)&2047n),fraction=raw&((1n<<52n)-1n);
  let n=exponent===0?fraction:addI(1n<<52n,fraction,m),d=1n;const shift=exponent===0?-1074:exponent-1023-52;
  if(shift>=0)n=shiftI(n,shift,m);else d=shiftI(d,-shift,m);if(sign)n=subI(0n,n,m);
  return rational(n,d,m);
}
/** Correct round-to-nearest, ties-to-even conversion; nonzero underflow is unsafe. */
function toNumber(q,m){
  if(q.n===0n)return 0;
  const negative=q.n<0n,n=absI(q.n,m),d=q.d;let exponent=bits(n)-bits(d);
  if(exponent>=0){if(n<shiftI(d,exponent,m))exponent--;}
  else if(shiftI(n,-exponent,m)<d)exponent--;
  if(exponent>1023)unsafe('dependency-conversion');
  const quantum=Math.max(exponent-52,-1074),numerator=quantum<0?shiftI(n,-quantum,m):n,denominator=quantum>0?shiftI(d,quantum,m):d;
  let significand=divI(numerator,denominator,m);const remainder=remI(numerator,denominator,m),twice=mulI(remainder,2n,m);
  if(twice>denominator||(twice===denominator&&remI(significand,2n,m)!==0n))significand=addI(significand,1n,m);
  const result=(negative?-1:1)*Number(significand)*2**quantum;
  if(!Number.isFinite(result)||result===0||(result<0)!==negative)unsafe('dependency-conversion');return result;
}
/** Per-call cache only. No previous problem, iterate, or basis is reused. */
export function makeExactSystem(model,meter){
  const A=model.A.map(row=>row.map(x=>fromNumber(x,meter))),D=model.D.map(x=>fromNumber(x,meter)),b=model.b.map(x=>fromNumber(x,meter)),cache=new Map();
  return {A,D,b,gram(i,j){const key=i+':'+j;if(cache.has(key))return cache.get(key);let sum=checked(ZERO,meter);
    for(let k=0;k<D.length;k++)if(A[i][k].n!==0n&&A[j][k].n!==0n)sum=addQ(sum,mulQ(mulQ(A[i][k],D[k],meter),A[j][k],meter),meter);
    cache.set(key,sum);return sum;}};
}
function solveExact(matrix,rhs,m){
  const n=rhs.length;if(n===0)return [];
  m.take('linearSolves');m.counters.factorizations++;m.counters.blockRightHandSides++;const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;while(pivot<n&&a[pivot][col].n===0n)pivot++;
    if(pivot===n)unsafe('dependent-basis');[a[col],a[pivot]]=[a[pivot],a[col]];
    for(let row=col+1;row<n;row++){
      if(a[row][col].n===0n)continue;const ratio=divQ(a[row][col],a[col][col],m);
      for(let k=col;k<=n;k++)a[row][k]=subQ(a[row][k],mulQ(ratio,a[col][k],m),m);
    }
  }
  const x=Array(n).fill(ZERO);for(let row=n-1;row>=0;row--){let value=a[row][n];for(let col=row+1;col<n;col++)value=subQ(value,mulQ(a[row][col],x[col],m),m);x[row]=divQ(value,a[row][row],m);}return x;
}
export function exactDependency(system,W,p,meter){
  // Caller consumes rankChecks BEFORE constructing exact operands for this probe.
  const rExact=solveExact(W.map(i=>W.map(j=>system.gram(i,j))),W.map(i=>system.gram(i,p)),meter);
  for(let k=0;k<system.D.length;k++){let projection=checked(ZERO,meter);for(let j=0;j<W.length;j++)projection=addQ(projection,mulQ(system.A[W[j]][k],rExact[j],meter),meter);
    if(subQ(system.A[p][k],projection,meter).n!==0n)return {dependent:false,rExact:[],r:[]};}
  return {dependent:true,rExact};
}
export function dependencyNumbers(rExact,meter){return rExact.map(x=>toNumber(x,meter));}
function verifyWeights(system,weights,meter){
  if(weights.length!==system.b.length||weights.some(w=>w.n<0n))return null;
  let sum=checked(ZERO,meter);for(const w of weights)sum=addQ(sum,w,meter);if(sum.n!==sum.d)return null;
  const dynamicDot=[];for(let k=0;k<system.D.length;k++){let dot=checked(ZERO,meter);for(let i=0;i<weights.length;i++)dot=addQ(dot,mulQ(system.A[i][k],weights[i],meter),meter);if(dot.n!==0n)return null;dynamicDot.push(text(dot));}
  let boundDot=checked(ZERO,meter);for(let i=0;i<weights.length;i++)boundDot=addQ(boundDot,mulQ(system.b[i],weights[i],meter),meter);if(boundDot.n<=0n)return null;
  return {weights:weights.map(text),sumWeights:'1/1',dynamicDot,boundDotM:text(boundDot)};
}
export function makeInfeasibilityCertificate(system,W,p,rExact,meter){
  const weights=Array(system.b.length).fill(ZERO);weights[p]=checked(ONE,meter);
  for(let j=0;j<W.length;j++)weights[W[j]]=negQ(rExact[j],meter);
  if(weights.some(w=>w.n<0n))unsafe('uncertified-infeasibility');
  let sum=checked(ZERO,meter);for(const w of weights)sum=addQ(sum,w,meter);if(sum.n<=0n)unsafe('uncertified-infeasibility');
  const normalized=weights.map(w=>divQ(w,sum,meter)),proof=verifyWeights(system,normalized,meter);if(proof===null)unsafe('uncertified-infeasibility');return proof;
}
function parseCanonical(value,meter){
  if(typeof value!=='string'||value.length>4937||!(/^(?:0|-?[1-9][0-9]*)\/[1-9][0-9]*$/).test(value))return null;
  const [ns,ds]=value.split('/');if(ns.replace('-','').length>2467||ds.length>2467)return null;
  meter.take('exactIntegerOperations');const n=BigInt(ns);meter.bits(n,true);meter.take('exactIntegerOperations');const d=BigInt(ds);meter.bits(d,true);
  const q=rational(n,d,meter);return text(q)===value?q:null;
}
/** Separate meter by default; validation never mutates the result's solver counters. */
export function verifyInfeasibilityCertificate(problem,certificate,meter=createMeter()){
  const model=prepareModel(problem),system=makeExactSystem(model,meter),weights=[];
  for(const value of certificate.weights){const q=parseCanonical(value,meter);if(q===null)return false;weights.push(q);}
  const checkedProof=verifyWeights(system,weights,meter);if(checkedProof===null)return false;
  return certificate.sumWeights==='1/1'&&certificate.boundDotM===checkedProof.boundDotM
    &&certificate.dynamicDot.length===checkedProof.dynamicDot.length&&certificate.dynamicDot.every((x,i)=>x===checkedProof.dynamicDot[i]);
}
