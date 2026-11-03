// Private Node22 proof port. Standard-library transport only; no producer imports.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

export const PROTOCOL='p4-position-witness-kernel-v1';
export const RPC_PROTOCOL='p4-native-witness-rpc-v1';
export const MAX_BYTES=2*1024*1024;
const LIMIT=2000000,REDUCED_BITS=8192,INTERMEDIATE_BITS=16385,MAX_BIT_CACHE=1024;
const PHASES=['parse','prepare','factor','kkt','rne','compare'];
const PRICES=Object.fromEntries(['READ_FIELD','READ_CHAR','WRITE_CHAR','READ_BYTE',
  'ADD','SUB','MUL','NEG','CMP','BIT_LENGTH','SHL','SHR','AND','OR','QUOT','REM',
  'F64_CAST','F64_PACK','F64_FROM_SMALL_INT','F64_SCALE_POW2','F64_FINITE','F64_CMP',
  'F64_ABS','F64_SUB','F64_HYPOT3'].map(name=>[name,1]));
PRICES.DIVMOD=2;Object.freeze(PRICES);
const RESIDUAL_KEYS=['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'];
const RESULT_KEYS=['ok','status','basisRows','basisRank','dynamicDof','counters','trace',
  'lastSafeIterate','translations','lambdaKgM','primalMarginsM','objectiveKgM2',
  'certificate','infeasibilityCertificate','reason','worldStepped'];
const COUNTER_LIMITS={iterations:1024,activeChanges:1024,rankChecks:2048,linearSolves:2048,
  constraintTests:262144,factorizations:2048,blockRightHandSides:57344,
  exactIntegerOperations:1000000,exactPeakBits:16385};
const ZERO=Object.freeze([0n,1n]),ONE=Object.freeze([1n,1n]);
const HEX_BITS=Object.freeze({'0':0,'1':1,'2':2,'3':2,'4':3,'5':3,'6':3,'7':3,'8':4,'9':4,a:4,b:4,c:4,d:4,e:4,f:4});
const DIGITS=Object.freeze({'0':0n,'1':1n,'2':2n,'3':3n,'4':4n,'5':5n,'6':6n,'7':7n,'8':8n,'9':9n});
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
export class ProofError extends Error{
  constructor(reason,detail=null){super(reason);this.reason=reason;this.detail=detail;}
}
const need=(condition,reason='PROOF_INPUT_INVALID',detail=null)=>{if(!condition)throw new ProofError(reason,detail);};
function keys(value,expected){need(plain(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key)));}
const zeros=names=>Object.fromEntries(names.map(name=>[name,0]));

class Meter{
  constructor(deadline){
    this.phase='parse';this.performed=0;this.attempted=0;this.gcdRemainders=0;this.normalizations=0;
    this.factorizations=0;this.pivots=0;this.allRows=0;this.dof=0;this.witnessRows=0;
    this.peakInput=0;this.peakReduced=0;this.peakIntermediate=0;
    this.phasePerformed=zeros(PHASES);this.phaseAttempted=zeros(PHASES);this.operations=zeros(Object.keys(PRICES));
    this.denied=null;this.deadline=deadline;this.sinceCheck=0;
  }
  checkTime(){if(performance.now()>=this.deadline)throw new ProofError('PROOF_TIME_LIMIT');this.sinceCheck=0;}
  use(operation,count=1){
    if(!Number.isInteger(count)||count<1||count>256||!Object.hasOwn(PRICES,operation))throw new Error('Invalid fixed reservation');
    const price=PRICES[operation]*count;
    if(this.sinceCheck+price>1024)this.checkTime();
    this.attempted+=price;this.phaseAttempted[this.phase]+=price;
    if(this.attempted>LIMIT){this.denied={phase:this.phase,operation,price,attempted:this.attempted};throw new ProofError('PROOF_PRIMITIVE_LIMIT');}
    this.performed+=price;this.phasePerformed[this.phase]+=price;this.operations[operation]+=count;this.sinceCheck+=price;
    if(this.sinceCheck>=1024)this.checkTime();
  }
  chars(operation,value){let count=0;for(const unit of value){count++;if(count===256){this.use(operation,count);count=0;}}if(count)this.use(operation,count);}
  setPhase(phase){if(!PHASES.includes(phase))throw new Error('Unknown phase');this.checkTime();this.phase=phase;}
  snapshot(){return {pricing:'p4-position-witness-primitives-v1',limit:LIMIT,performed:this.performed,attempted:this.attempted,
    phasePerformed:{...this.phasePerformed},phaseAttempted:{...this.phaseAttempted},operationCounts:{...this.operations},
    gcdRemainders:this.gcdRemainders,normalizations:this.normalizations,factorizationAttempts:this.factorizations,
    pivots:this.pivots,allRows:this.allRows,dynamicDof:this.dof,witnessRows:this.witnessRows,
    peakInputBits:this.peakInput,peakReducedBits:this.peakReduced,peakIntermediateBits:this.peakIntermediate,
    denied:this.denied,resetCount:0};}
}

class Arithmetic{
  constructor(meter){this.m=meter;this.bitCache=new Map();this.guardedGcdEntries=0;this.invariantRemainders=0;}
  cmpInt(a,b){this.m.use('CMP');if(a<b)return -1;this.m.use('CMP');return a>b?1:0;}
  bits(a){
    this.m.use('BIT_LENGTH');
    const found=this.bitCache.get(a);if(found!==undefined)return found;
    // One logical BIT_LENGTH, implemented by bounded radix16 magnitude text.
    // The already-bounded operand needs <=4098 code units including its sign.
    const text=a.toString(16),start=text[0]==='-'?1:0;
    const size=text[start]==='0'?0:4*(text.length-start-1)+HEX_BITS[text[start]];
    if(this.bitCache.size<MAX_BIT_CACHE)this.bitCache.set(a,size);
    return size;
  }
  checked(a){const size=this.bits(a);this.m.peakIntermediate=Math.max(this.m.peakIntermediate,size);this.m.use('CMP');if(size>INTERMEDIATE_BITS)throw new ProofError('PROOF_INTERMEDIATE_BITS','retained integer bit bound');return a;}
  prebound(size){this.m.use('CMP');if(size>INTERMEDIATE_BITS)throw new ProofError('PROOF_INTERMEDIATE_BITS','proposed bit bound='+size);}
  addI(a,b){this.prebound(Math.max(this.bits(a),this.bits(b))+1);this.m.use('ADD');return this.checked(a+b);}
  subI(a,b){this.prebound(Math.max(this.bits(a),this.bits(b))+1);this.m.use('SUB');return this.checked(a-b);}
  negI(a){this.checked(a);this.m.use('NEG');return this.checked(-a);}
  mulI(a,b){if(this.cmpInt(a,0n)===0||this.cmpInt(b,0n)===0)return 0n;this.prebound(this.bits(a)+this.bits(b));this.m.use('MUL');return this.checked(a*b);}
  shl(a,power){
    if(!Number.isInteger(power)||power<0||power>INTERMEDIATE_BITS)throw new ProofError('PROOF_INTERMEDIATE_BITS','shift count');
    if(this.cmpInt(a,0n)===0)return 0n;this.prebound(this.bits(a)+power);this.m.use('SHL');return this.checked(a<<BigInt(power));
  }
  shr(a,power){this.checked(a);if(!Number.isInteger(power)||power<0||power>INTERMEDIATE_BITS||this.cmpInt(a,0n)<0)throw new ProofError('PROOF_INPUT_INVALID','right-shift domain');this.m.use('SHR');return this.checked(a>>BigInt(power));}
  bitop(op,a,b){this.checked(a);this.checked(b);if(this.cmpInt(a,0n)<0||this.cmpInt(b,0n)<0)throw new ProofError('PROOF_INPUT_INVALID','bit operation domain');this.m.use(op);return this.checked(op==='AND'?a&b:a|b);}
  divmodI(a,b){
    this.checked(a);this.checked(b);if(this.cmpInt(b,0n)===0)throw new ProofError('PROOF_DIVISION_BY_ZERO');
    this.m.use('DIVMOD');return [this.checked(a/b),this.checked(a%b)];
  }
  // All signed quotient uses are exact divisions by a known GCD or factor.
  // The only nonexact divmod uses are nonnegative RNE/text operands. Bareiss
  // rejects nonzero remainder before consuming its quotient, so JS truncation
  // cannot substitute a different accepted value for Python floor division.
  quot(a,b){this.checked(a);this.checked(b);if(this.cmpInt(b,0n)===0)throw new ProofError('PROOF_DIVISION_BY_ZERO');this.m.use('QUOT');return this.checked(a/b);}
  rem(a,b){this.checked(a);this.checked(b);if(this.cmpInt(b,0n)===0)throw new ProofError('PROOF_DIVISION_BY_ZERO');this.m.use('REM');return this.checked(a%b);}
  exactDiv(a,b){const [q,remainder]=this.divmodI(a,b);if(this.cmpInt(remainder,0n)!==0)throw new ProofError('PROOF_EXACT_DIVISION_FAILED');return q;}
  gcd(a,b){
    // The only localized guard-policy exception: both entry operands are
    // actually inspected, bounded and included in the exact measured peak.
    this.checked(a);this.checked(b);
    if(this.cmpInt(a,0n)<0)a=this.negI(a);if(this.cmpInt(b,0n)<0)b=this.negI(b);
    this.guardedGcdEntries++;
    // Invariant: a,b>=0 and each magnitude<=max(abs(entryA),abs(entryB)).
    // With b!=0, BigInt remainder has 0<=r<b, so it cannot allocate a larger
    // mathematical integer or increase the already measured exact peak.
    // No bit/range inspections are performed or priced inside this loop.
    for(;;){
      this.m.use('CMP');if(b===0n)return a;
      this.m.use('REM');const remainder=a%b;
      this.m.gcdRemainders++;this.invariantRemainders++;a=b;b=remainder;
    }
  }
  reduced(n,d){this.checked(n);this.checked(d);if(this.cmpInt(d,0n)<=0)throw new ProofError('PROOF_DIVISION_BY_ZERO');const size=Math.max(this.bits(n),this.bits(d));this.m.peakReduced=Math.max(this.m.peakReduced,size);this.m.use('CMP');if(size>REDUCED_BITS)throw new ProofError('PROOF_REDUCED_BITS');return [n,d];}
  q(n,d=1n){this.m.normalizations++;this.checked(n);this.checked(d);if(this.cmpInt(d,0n)===0)throw new ProofError('PROOF_DIVISION_BY_ZERO');if(this.cmpInt(n,0n)===0)return ZERO;if(this.cmpInt(d,0n)<0){n=this.negI(n);d=this.negI(d);}const common=this.gcd(n,d);return this.reduced(this.quot(n,common),this.quot(d,common));}
  neg(a){return [this.negI(a[0]),a[1]];}
  add(a,b){
    if(this.cmpInt(a[0],0n)===0)return b;if(this.cmpInt(b[0],0n)===0)return a;
    const common=this.gcd(a[1],b[1]),ad=this.quot(a[1],common),bd=this.quot(b[1],common);
    const numerator=this.addI(this.mulI(a[0],bd),this.mulI(b[0],ad)),cancel=this.gcd(numerator,common);
    return this.reduced(this.quot(numerator,cancel),this.mulI(ad,this.quot(b[1],cancel)));
  }
  sub(a,b){return this.add(a,this.neg(b));}
  mul(a,b){if(this.cmpInt(a[0],0n)===0||this.cmpInt(b[0],0n)===0)return ZERO;const g=this.gcd(a[0],b[1]),h=this.gcd(b[0],a[1]);return this.reduced(this.mulI(this.quot(a[0],g),this.quot(b[0],h)),this.mulI(this.quot(a[1],h),this.quot(b[1],g)));}
  div(a,b){if(this.cmpInt(b[0],0n)===0)throw new ProofError('PROOF_DIVISION_BY_ZERO');if(this.cmpInt(a[0],0n)===0)return ZERO;const g=this.gcd(a[0],b[0]),h=this.gcd(a[1],b[1]);let n=this.mulI(this.quot(a[0],g),this.quot(b[1],h)),d=this.mulI(this.quot(a[1],h),this.quot(b[0],g));if(this.cmpInt(d,0n)<0){n=this.negI(n);d=this.negI(d);}return this.reduced(n,d);}
  cmp(a,b){return this.cmpInt(this.mulI(a[0],b[1]),this.mulI(b[0],a[1]));}
  abs(a){return this.cmpInt(a[0],0n)<0?this.neg(a):a;}
  total(values){let value=ZERO;for(const item of values)value=this.add(value,item);return value;}
  productSum(products){
    const terms=[];let denominator=1n,termCount=0;
    for(const factors of products){termCount++;need(termCount<=36,'PROOF_ALLOCATION_LIMIT','product-sum term bound');need(Array.isArray(factors)&&factors.length>=1&&factors.length<=4,'PROOF_ALLOCATION_LIMIT','product-sum factor bound');
      let numerator=1n,termDenominator=1n;
      for(const value of factors){if(this.cmpInt(value[0],0n)===0){numerator=0n;break;}numerator=this.mulI(numerator,value[0]);termDenominator=this.mulI(termDenominator,value[1]);}
      if(this.cmpInt(numerator,0n)===0)continue;
      const common=this.gcd(denominator,termDenominator);denominator=this.mulI(this.exactDiv(denominator,common),termDenominator);terms.push([numerator,termDenominator]);
    }
    let numerator=0n;for(const [n,d]of terms)numerator=this.addI(numerator,this.mulI(n,this.exactDiv(denominator,d)));
    return this.q(numerator,denominator);
  }
  dot(a,b){return this.productSum(a.map((x,i)=>[x,b[i]]));}
  maximum(values){let result=ZERO;for(const value of values)if(this.cmp(value,result)>0)result=value;return result;}
  finite(value){this.m.use('READ_FIELD');if(typeof value!=='number')throw new ProofError('PROOF_INPUT_INVALID','finite numerical field');this.m.use('F64_CAST');const result=Number(value);this.m.use('F64_FINITE');if(!Number.isFinite(result))throw new ProofError('PROOF_INPUT_INVALID','nonfinite number');return result;}
  binary(value){
    value=this.finite(value);this.m.use('F64_PACK');const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value,false);let word=0n;
    for(let i=0;i<8;i++){this.m.use('READ_BYTE');word=this.bitop('OR',this.shl(word,8),BigInt(view.getUint8(i)));}
    const exponent=this.bitop('AND',this.shr(word,52),2047n);let mantissa=this.bitop('AND',word,0xfffffffffffffn);
    if(this.cmpInt(exponent,0n)!==0)mantissa=this.bitop('OR',mantissa,0x10000000000000n);
    if(this.cmpInt(this.shr(word,63),0n)!==0)mantissa=this.negI(mantissa);
    const power=exponent===0n?-1074:Number(exponent)-1075;
    const result=power<0?this.q(mantissa,this.shl(1n,-power)):this.q(this.shl(mantissa,power));
    const size=Math.max(this.bits(result[0]),this.bits(result[1]));this.m.peakInput=Math.max(this.m.peakInput,size);this.m.use('CMP');if(size>REDUCED_BITS)throw new ProofError('PROOF_INPUT_BITS');return result;
  }
  numeric(value){
    let [n,d]=value;const negative=this.cmpInt(n,0n)<0;if(negative)n=this.negI(n);if(this.cmpInt(n,0n)===0)return 0;
    let exponent=this.bits(n)-this.bits(d);
    if(exponent>=0?this.cmpInt(n,this.shl(d,exponent))<0:this.cmpInt(this.shl(n,-exponent),d)<0)exponent--;
    if(exponent>1023)throw new ProofError('PROOF_NONFINITE_PRESENTATION');
    const unit=Math.max(-1074,exponent-52),numerator=unit<0?this.shl(n,-unit):n,denominator=unit>0?this.shl(d,unit):d;
    let [significand,remainder]=this.divmodI(numerator,denominator);const comparison=this.cmpInt(this.mulI(remainder,2n),denominator);
    if(comparison>0||comparison===0&&this.cmpInt(this.bitop('AND',significand,1n),0n)!==0)significand=this.addI(significand,1n);
    const significandBits=this.bits(significand);if(significandBits>53&&this.cmpInt(significand,this.shl(1n,53))!==0)throw new ProofError('PROOF_NONFINITE_PRESENTATION','significand bound');
    this.m.use('F64_FROM_SMALL_INT');const small=Number(significand);this.m.use('F64_SCALE_POW2');let number=small*2**unit;
    this.m.use('F64_FINITE');if(!Number.isFinite(number))throw new ProofError('PROOF_NONFINITE_PRESENTATION');
    if(negative){this.m.use('F64_SUB');number=-0-number;}return number;
  }
  integerText(value){
    const negative=this.cmpInt(value,0n)<0;if(negative)value=this.negI(value);const chunks=[];
    while(this.cmpInt(value,0n)!==0){const pair=this.divmodI(value,1000000000n);value=pair[0];chunks.push(pair[1]);}
    if(chunks.length===0){this.m.chars('WRITE_CHAR','0');return '0';}
    let text=chunks.pop().toString();this.m.chars('WRITE_CHAR',text);
    for(let i=chunks.length-1;i>=0;i--){const part=chunks[i].toString().padStart(9,'0');this.m.chars('WRITE_CHAR',part);text+=part;}
    if(negative){this.m.chars('WRITE_CHAR','-');text='-'+text;}return text;
  }
  text(value){const numerator=this.integerText(value[0]),denominator=this.integerText(value[1]);this.m.chars('WRITE_CHAR','/');return numerator+'/'+denominator;}
}

function scan(value,r,depth=0,state={cells:0}){
  state.cells++;need(state.cells<=65536&&depth<=32,'PROOF_ALLOCATION_LIMIT','input tree');
  if(value===null||typeof value==='boolean')r.m.use('READ_FIELD');
  else if(typeof value==='number')r.finite(value);
  else if(typeof value==='string'){need(value.length<=4096);r.m.chars('READ_CHAR',value);}
  else if(Array.isArray(value)){need(value.length<=65536,'PROOF_ALLOCATION_LIMIT');for(const child of value)scan(child,r,depth+1,state);}
  else if(plain(value)){const entries=Object.entries(value);need(entries.length<=65536,'PROOF_ALLOCATION_LIMIT');for(const [key,child]of entries){need(key.length<=4096);r.m.chars('READ_CHAR',key);scan(child,r,depth+1,state);}}
  else throw new ProofError('PROOF_INPUT_INVALID','nondata value');
}

function prepare(problem,observed,r){
  keys(problem,['bodies','rows']);need(Array.isArray(problem.bodies)&&problem.bodies.length===9);need(Array.isArray(problem.rows)&&problem.rows.length===36);scan(problem,r);scan(observed,r);
  const ids=new Set(),inverse=[],columns={},bodyIds=[];let staticCount=0;
  for(const body of problem.bodies){keys(body,['id','inverseMass']);const name=body.id;need(typeof name==='string'&&name.length>0&&name.length<=64&&!ids.has(name));ids.add(name);bodyIds.push(name);const massInverse=r.binary(body.inverseMass);if(r.cmp(massInverse,ZERO)===0)staticCount++;else{need(r.cmp(massInverse,ONE)===0);Object.defineProperty(columns,name,{value:inverse.length,enumerable:true});inverse.push(massInverse,massInverse,massInverse);}}
  need(staticCount===1&&inverse.length===24);keys(observed,RESULT_KEYS);need(observed.status==='SOLVED'&&observed.ok===true&&observed.worldStepped===false);need(observed.reason===null&&observed.infeasibilityCertificate===null);
  const witness=observed.basisRows;need(Array.isArray(witness)&&witness.length<=24,'WITNESS_INDEX_INVALID');r.m.allRows=36;r.m.dof=24;r.m.witnessRows=witness.length;
  let previous=-1;
  for(const index of witness){r.m.use('READ_FIELD');need(Number.isInteger(index),'WITNESS_INDEX_INVALID');need(r.cmpInt(index,previous)>0&&r.cmpInt(index,36)<0,'WITNESS_INDEX_INVALID');previous=index;}
  need(Number.isInteger(observed.basisRank)&&r.cmpInt(observed.basisRank,witness.length)===0,'WITNESS_INDEX_INVALID');need(Number.isInteger(observed.dynamicDof)&&r.cmpInt(observed.dynamicDof,24)===0);
  keys(observed.counters,Object.keys(COUNTER_LIMITS));for(const [name,bound]of Object.entries(COUNTER_LIMITS)){const value=observed.counters[name];need(Number.isInteger(value)&&r.cmpInt(value,0)>=0&&r.cmpInt(value,bound)<=0);}
  need(Array.isArray(observed.trace)&&observed.trace.length<=observed.counters.iterations+1);
  function metadataIndexes(values){need(Array.isArray(values)&&values.length<=36);let before=-1;for(const value of values){r.m.use('READ_FIELD');need(Number.isInteger(value)&&r.cmpInt(value,before)>0&&r.cmpInt(value,36)<0);before=value;}}
  for(const record of observed.trace){
    keys(record,['iteration','enteringRow','basisBefore','basisAfter','action','blocker','stepKgM','schurInverseKg','condition','exactDependent']);need(Number.isInteger(record.iteration)&&r.cmpInt(record.iteration,0)>=0&&r.cmpInt(record.iteration,1024)<=0);
    for(const name of ['enteringRow','blocker']){const value=record[name];need(value===null||Number.isInteger(value)&&r.cmpInt(value,0)>=0&&r.cmpInt(value,36)<0);}
    metadataIndexes(record.basisBefore);metadataIndexes(record.basisAfter);need(['add','drop','dependent-drop','infeasible','unsafe','work-limit'].includes(record.action));need(record.exactDependent===null||typeof record.exactDependent==='boolean');for(const name of ['stepKgM','schurInverseKg','condition'])if(record[name]!==null)r.finite(record[name]);
  }
  const safe=observed.lastSafeIterate;keys(safe,['uDynamic','lambdaKgM','pendingRow','pendingLambdaKgM','basisRows']);need(Array.isArray(safe.uDynamic)&&safe.uDynamic.length===24);need(Array.isArray(safe.lambdaKgM)&&safe.lambdaKgM.length===36);metadataIndexes(safe.basisRows);
  if(safe.pendingRow!==null)need(Number.isInteger(safe.pendingRow)&&r.cmpInt(safe.pendingRow,0)>=0&&r.cmpInt(safe.pendingRow,36)<0);r.finite(safe.pendingLambdaKgM);
  need(Array.isArray(observed.translations)&&observed.translations.length===9);for(let i=0;i<9;i++){const item=observed.translations[i];keys(item,['id','u']);need(item.id===bodyIds[i]&&Array.isArray(item.u)&&item.u.length===3);}
  for(const name of ['lambdaKgM','primalMarginsM'])need(Array.isArray(observed[name])&&observed[name].length===36);
  keys(observed.certificate,RESIDUAL_KEYS);for(const value of Object.values(observed.certificate)){const number=r.finite(value);r.m.use('F64_CMP');need(number>=0);}let number=r.finite(observed.objectiveKgM2);r.m.use('F64_CMP');need(number>=0);
  r.m.setPhase('prepare');const a=[],b=[],seenPairs=new Set();
  for(const row of problem.rows){
    keys(row,['aId','bId','normal','boundM']);const ai=row.aId,bi=row.bId;need(ids.has(ai)&&ids.has(bi)&&ai!==bi);const pair=JSON.stringify([ai,bi].sort());need(!seenPairs.has(pair));seenPairs.add(pair);need(Array.isArray(row.normal)&&row.normal.length===3);
    const normalF=row.normal.map(x=>r.finite(x));r.m.use('F64_HYPOT3');const length=Math.hypot(...normalF);r.m.use('F64_SUB');let delta=length-1;r.m.use('F64_ABS');delta=Math.abs(delta);r.m.use('F64_CMP');need(delta<=1e-12);
    const normal=normalF.map(x=>r.binary(x)),boundF=r.finite(row.boundM);r.m.use('F64_CMP');need(boundF>=-10);r.m.use('F64_CMP');need(boundF<=10);const coefficients=Array(24).fill(ZERO);
    for(const [name,negative]of [[ai,true],[bi,false]])if(Object.hasOwn(columns,name))for(let axis=0;axis<3;axis++)coefficients[columns[name]+axis]=negative?r.neg(normal[axis]):normal[axis];
    a.push(coefficients);b.push(r.binary(boundF));
  }
  return {a,b,inverse,columns,bodyIds,witness:[...witness],d:24,m:36};
}

function reconstruct(model,r){
  const {witness:indexes,a,b,inverse}=model,size=indexes.length;if(size===0)return [Array(24).fill(ZERO),Array(36).fill(ZERO)];
  const gram=indexes.map(i=>indexes.map(j=>r.total(Array.from({length:24},(_,k)=>r.mul(r.mul(a[i][k],inverse[k]),a[j][k])))));
  r.m.setPhase('factor');r.m.factorizations++;const table=[];
  for(let i=0;i<size;i++){const values=[...gram[i],b[indexes[i]]];let denominator=1n;for(const value of values)denominator=r.mulI(r.quot(denominator,r.gcd(denominator,value[1])),value[1]);table.push(values.map(value=>r.mulI(value[0],r.exactDiv(denominator,value[1]))));}
  let previous=1n;
  for(let k=0;k<size;k++){r.m.pivots++;const pivot=table[k][k],direction=r.cmpInt(pivot,0n);if(direction===0)throw new ProofError('WITNESS_BASIS_DEPENDENT');if(direction<0)throw new ProofError('WITNESS_GRAM_NOT_POSITIVE');
    for(let i=k+1;i<size;i++){const leading=table[i][k];for(let j=k+1;j<=size;j++){const numerator=r.subI(r.mulI(pivot,table[i][j]),r.mulI(leading,table[k][j]));table[i][j]=r.exactDiv(numerator,previous);}table[i][k]=0n;}previous=pivot;
  }
  const local=Array(size).fill(ZERO);
  for(let i=size-1;i>=0;i--){let denominator=1n;for(const value of local.slice(i+1))denominator=r.mulI(r.quot(denominator,r.gcd(denominator,value[1])),value[1]);let numerator=r.mulI(table[i][size],denominator);
    for(let j=i+1;j<size;j++){const term=r.mulI(r.mulI(table[i][j],local[j][0]),r.exactDiv(denominator,local[j][1]));numerator=r.subI(numerator,term);}local[i]=r.q(numerator,r.mulI(table[i][i],denominator));}
  const lam=Array(36).fill(ZERO);for(let i=0;i<size;i++)lam[indexes[i]]=local[i];const u=Array.from({length:24},(_,j)=>r.mul(inverse[j],r.total(indexes.map(i=>r.mul(a[i][j],lam[i])))));return [u,lam];
}

function kkt(model,u,lam,r,exact){
  const {a,b,inverse:inv}=model,margins=a.map((row,i)=>r.sub(r.dot(row,u),b[i]));
  if(exact&&margins.some(value=>r.cmp(value,ZERO)<0))throw new ProofError('WITNESS_PRIMAL_INFEASIBLE');
  if(exact&&lam.some(value=>r.cmp(value,ZERO)<0))throw new ProofError('WITNESS_DUAL_NEGATIVE');
  const stationary=Array.from({length:24},(_,j)=>r.sub(r.div(u[j],inv[j]),r.productSum(Array.from({length:36},(_,i)=>[a[i][j],lam[i]]))));
  if(exact&&stationary.some(value=>r.cmp(value,ZERO)!==0))throw new ProofError('WITNESS_STATIONARITY_NONZERO');
  const comp=lam.map((x,i)=>r.mul(x,margins[i]));if(exact&&comp.some(value=>r.cmp(value,ZERO)!==0))throw new ProofError('WITNESS_COMPLEMENTARITY_NONZERO');
  const objective=r.productSum(u.map((x,i)=>[x,x,[inv[i][1],inv[i][0]],[1n,2n]]));return [margins,stationary,comp,objective];
}

function nativeCompare(model,observed,u,lam,objective,r){
  r.m.setPhase('compare');const dynamic=[],allNative=[];
  for(const item of observed.translations){const numbers=item.u.map(x=>r.finite(x)),vector=numbers.map(x=>r.binary(x));allNative.push(...vector);if(Object.hasOwn(model.columns,item.id))dynamic.push(...vector);else for(const value of numbers){r.m.use('F64_PACK');need(Object.is(value,0));}r.m.use('F64_HYPOT3');const length=Math.hypot(...numbers);r.m.use('F64_CMP');need(length<=10);}
  const nativeLam=observed.lambdaKgM.map(x=>r.binary(x)),[full,stationary,comp,obj]=kkt(model,dynamic,nativeLam,r,false);
  const residual={primalViolationM:r.maximum(full.map(x=>r.neg(x))),negativeMultiplierKgM:r.maximum(nativeLam.map(x=>r.neg(x))),complementarityKgM2:r.maximum(comp.map(x=>r.abs(x))),stationarityKgM:r.maximum(stationary.map(x=>r.abs(x)))};
  const actualU=[];for(const name of model.bodyIds)actualU.push(...(Object.hasOwn(model.columns,name)?u.slice(model.columns[name],model.columns[name]+3):[ZERO,ZERO,ZERO]));
  const measures={translationDifferenceM:r.maximum(allNative.map((v,i)=>r.abs(r.sub(v,actualU[i])))),objectiveDifferenceKgM2:r.abs(r.sub(r.binary(observed.objectiveKgM2),objective)),certificateReportedDifference:r.maximum(Object.entries(residual).map(([key,value])=>r.abs(r.sub(r.binary(observed.certificate[key]),value)))),marginReportedDifferenceM:r.maximum(observed.primalMarginsM.map((x,i)=>r.abs(r.sub(r.binary(x),full[i])))),objectiveReportedDifferenceKgM2:r.abs(r.sub(r.binary(observed.objectiveKgM2),obj))};
  const gate=r.binary(1e-12),violations=[];for(const [key,value]of Object.entries({...residual,...measures}))if(r.cmp(value,gate)>0)violations.push(key+' exceeds frozen 1e-12 in stated units');
  for(let i=0;i<36;i++)if(!model.witness.includes(i)&&r.cmp(nativeLam[i],ZERO)!==0)violations.push('nonbasis native multiplier is not exact zero');
  r.m.setPhase('rne');const metrics=Object.fromEntries(Object.entries(measures).map(([name,value])=>[name,r.numeric(value)]));for(const [name,value]of Object.entries(residual))metrics[name]=r.numeric(value);metrics.solutionReached=true;metrics.actualCertificateExact=Object.fromEntries(Object.entries(residual).map(([name,value])=>[name,r.text(value)]));return [metrics,violations];
}

function explicitInput(value,meter){
  const stack=[[value,0]],seen=new Set();let cells=0,bytes=0;
  while(stack.length){const [item,depth]=stack.pop();cells++;if(cells%1024===0)meter.checkTime();need(cells<=65536&&depth<=32,'PROOF_ALLOCATION_LIMIT','ownership tree');
    if(item!==null&&typeof item==='object'){if(seen.has(item))continue;seen.add(item);}
    if(item===null||typeof item==='boolean'||typeof item==='number')bytes+=32;
    else if(typeof item==='string')bytes+=64+2*item.length;
    else if(Array.isArray(item)){bytes+=64+16*item.length;need(item.length<=65536,'PROOF_ALLOCATION_LIMIT');for(const child of item)stack.push([child,depth+1]);}
    else if(plain(item)){const entries=Object.entries(item);bytes+=64+48*entries.length;for(const [key,child]of entries){stack.push([key,depth+1]);stack.push([child,depth+1]);}}
    else throw new ProofError('PROOF_INPUT_INVALID','ownership data type');
    need(bytes<=4*1024*1024,'PROOF_ALLOCATION_LIMIT','child input reservation');
  }
  return bytes;
}

export function certifyPositionWitness(problem,observed,{deadline=performance.now()+170000,includeModel=false}={}){
  const meter=new Meter(deadline),r=new Arithmetic(meter);let modelExact=null;
  try{
    meter.checkTime();explicitInput([problem,observed],meter);const model=prepare(problem,observed,r),[u,lam]=reconstruct(model,r);meter.setPhase('kkt');const [margins,stationary,comp,objective]=kkt(model,u,lam,r,true);
    const [metrics,violations]=nativeCompare(model,observed,u,lam,objective,r);meter.setPhase('rne');const translationsExact=[],translations=[];
    for(const name of model.bodyIds){const vector=Object.hasOwn(model.columns,name)?u.slice(model.columns[name],model.columns[name]+3):[ZERO,ZERO,ZERO];translationsExact.push({id:name,u:vector.map(x=>r.text(x))});translations.push({id:name,u:vector.map(x=>r.numeric(x))});}
    const certificate={translationsExact,lambdaExactKgM:lam.map(x=>r.text(x)),primalMarginsExactM:margins.map(x=>r.text(x)),objectiveExactKgM2:r.text(objective),stationarityExactKgM:stationary.map(x=>r.text(x)),complementarityExactKgM2:comp.map(x=>r.text(x)),basisRows:[...model.witness],basisRank:model.witness.length,dynamicDof:24,certificateExact:Object.fromEntries(RESIDUAL_KEYS.map(key=>[key,r.text(ZERO)])),translations,lambdaKgM:lam.map(x=>r.numeric(x)),primalMarginsM:margins.map(x=>r.numeric(x)),objectiveKgM2:r.numeric(objective)};
    if(includeModel)modelExact={a:model.a.map(row=>row.map(x=>r.text(x))),b:model.b.map(x=>r.text(x)),inverse:model.inverse.map(x=>r.text(x)),columns:{...model.columns},d:model.d,m:model.m};
    return {reply:{protocol:PROTOCOL,status:violations.length?'OBSERVED_RESULT_MISMATCH':'EXACT_KKT_CERTIFIED',ok:violations.length===0,resolved:true,reason:violations.length?'OBSERVED_RESULT_MISMATCH':null,certificate,metrics,proofCounters:meter.snapshot(),violations},modelExact};
  }catch(error){if(!(error instanceof ProofError))throw error;return {reply:{protocol:PROTOCOL,status:'UNRESOLVED',ok:false,resolved:false,reason:error.reason,certificate:null,metrics:null,proofCounters:meter.snapshot(),violations:[error.reason,...(error.detail===null?[]:[error.detail])]},modelExact:null};}
}

export function encodeBounded(value,maxBytes=MAX_BYTES){
  const chunks=[];let bytes=0,cells=0;
  function emit(text){const size=Buffer.byteLength(text);if(bytes+size+1>maxBytes)throw new Error('REPLY_LIMIT');bytes+=size;chunks.push(text);}
  function walk(item,depth){
    if(++cells>65536||depth>32)throw new Error('REPLY_DATA_SHAPE');
    if(item===null)emit('null');else if(typeof item==='boolean')emit(item?'true':'false');
    else if(typeof item==='number'){if(!Number.isFinite(item))throw new Error('REPLY_NONFINITE');emit(Object.is(item,-0)?'-0.0':JSON.stringify(item));}
    else if(typeof item==='string'){if(item.length>8192)throw new Error('REPLY_STRING_LIMIT');emit(JSON.stringify(item));}
    else if(Array.isArray(item)){emit('[');for(let i=0;i<item.length;i++){if(i)emit(',');walk(item[i],depth+1);}emit(']');}
    else if(plain(item)){emit('{');let first=true;for(const [key,child]of Object.entries(item)){if(!first)emit(',');first=false;emit(JSON.stringify(key));emit(':');walk(child,depth+1);}emit('}');}
    else throw new Error('REPLY_NONDATA');
  }
  walk(value,0);return chunks.join('')+'\n';
}

export function parseBoundedJSON(raw,deadline){
  if(!Buffer.isBuffer(raw)||raw.length>MAX_BYTES||3*raw.length+65536>4*1024*1024)throw new Error('REQUEST_PREALLOCATION_LIMIT');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);let tokens=0,depth=0,checkpoint=0;
  function clock(index){if(index-checkpoint>=1024){if(performance.now()>=deadline)throw new Error('TRANSPORT_TIME_LIMIT');checkpoint=index;}}
  function token(){tokens++;if(128*tokens+2*text.length>4*1024*1024)throw new Error('JSON_PREALLOCATION_LIMIT');}
  for(let i=0;i<text.length;){clock(i);const c=text[i];if(c===' '||c==='\n'||c==='\r'||c==='\t'){i++;continue;}
    token();
    if(c==='"'){i++;let closed=false;while(i<text.length){clock(i);const unit=text[i++];if(unit==='\\'){if(i===text.length)throw new Error('JSON_UNTERMINATED_ESCAPE');i++;}else if(unit==='"'){closed=true;break;}}if(!closed)throw new Error('JSON_UNTERMINATED_STRING');}
    else if(c==='{'||c==='['){depth++;if(depth>32)throw new Error('JSON_DEPTH_LIMIT');i++;}
    else if(c==='}'||c===']'){depth--;if(depth<0)throw new Error('JSON_DEPTH_LIMIT');i++;}
    else if(c===':'||c===',')i++;
    else{const start=i;while(i<text.length&&![' ','\n','\r','\t','{','}','[',']',':',',','"'].includes(text[i])){i++;clock(i);}if(i===start)throw new Error('JSON_TOKEN');}
  }
  if(depth!==0||performance.now()>=deadline)throw new Error('JSON_DEPTH_OR_TIME_LIMIT');
  return JSON.parse(text);
}

function decimalInput(value,r){
  need(typeof value==='string'&&value.length>=1&&value.length<=2468,'GCD_BANK_INPUT_INVALID');
  r.m.use('READ_CHAR');const negative=value[0]==='-',start=negative?1:0;
  need(value.length-start>=1&&value.length-start<=2467,'GCD_BANK_INPUT_INVALID');let n=0n;
  for(let i=start;i<value.length;i++){r.m.use('READ_CHAR');const digit=value[i];need(Object.hasOwn(DIGITS,digit),'GCD_BANK_INPUT_INVALID');if(i===start&&digit==='0')need(!negative&&i+1===value.length,'GCD_BANK_INPUT_INVALID');n=r.addI(r.mulI(n,10n),DIGITS[digit]);}
  if(negative)n=r.negI(n);const size=r.bits(n);r.m.peakInput=Math.max(r.m.peakInput,size);r.m.use('CMP');if(size>REDUCED_BITS)throw new ProofError('PROOF_INPUT_BITS');return n;
}

export function runGcdBank(cases,{deadline=performance.now()+170000}={}){
  const meter=new Meter(deadline),r=new Arithmetic(meter),gcds=[];let index=null;
  const privateStats=()=>({guardedGcdEntries:r.guardedGcdEntries,invariantRemainders:r.invariantRemainders});
  try{
    meter.checkTime();explicitInput(cases,meter);need(Array.isArray(cases)&&cases.length===32,'GCD_BANK_INPUT_INVALID');
    for(index=0;index<32;index++){
      meter.setPhase('parse');keys(cases[index],['a','b']);const a=decimalInput(cases[index].a,r),b=decimalInput(cases[index].b,r);
      meter.setPhase('factor');const value=r.gcd(a,b);meter.setPhase('rne');gcds.push(r.integerText(value));
    }
    return {protocol:'p4-invariant-gcd-bank-v1',status:'EXACT_GCD_BANK_CERTIFIED',reason:null,gcds,failedCaseIndex:null,proofCounters:meter.snapshot(),privateStats:privateStats()};
  }catch(error){if(!(error instanceof ProofError))throw error;return {protocol:'p4-invariant-gcd-bank-v1',status:'UNRESOLVED',reason:error.reason,gcds,failedCaseIndex:index,proofCounters:meter.snapshot(),privateStats:privateStats()};}
}

function main(argv){
  if(argv.length!==3||!['kernel','gcd-bank'].includes(argv[0]))throw new Error('candidate.mjs kernel|gcd-bank REQUEST_FILE REPLY_FILE');const deadline=performance.now()+170000;
  const size=fs.statSync(argv[1]).size;if(size>MAX_BYTES||3*size+65536>4*1024*1024)throw new Error('REQUEST_PREALLOCATION_LIMIT');const request=parseBoundedJSON(fs.readFileSync(argv[1]),deadline);
  let reply;
  if(argv[0]==='gcd-bank'){keys(request,['op','cases']);need(request.op==='gcd-bank','GCD_BANK_INPUT_INVALID');reply=runGcdBank(request.cases,{deadline});}
  else{need(plain(request)&&request.op==='kernel'&&Object.keys(request).every(key=>['op','scope','problem','result'].includes(key))&&Object.hasOwn(request,'problem')&&Object.hasOwn(request,'result'));reply=certifyPositionWitness(request.problem,request.result,{deadline}).reply;}
  const text=encodeBounded(reply,Math.floor((4*1024*1024-65536)/3));fs.writeFileSync(argv[2],text,{flag:'wx'});process.stdout.write(encodeBounded({status:'SERIALIZED_TYPED_KERNEL_REPLY',resultStatus:reply.status,replyBytes:Buffer.byteLength(text)}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===fs.realpathSync(process.argv[1])){
  try{main(process.argv.slice(2));}catch(error){process.stderr.write(String(error?.stack??error)+'\n');process.exitCode=1;}
}
