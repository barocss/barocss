export const MESSAGES=Object.freeze({
  input:'full-pair position reference input is invalid',limit:'full-pair position reference admits at most nine bodies and thirty-six rows',
  empty:'full-pair position reference requires at least one body',ids:'full-pair position reference body IDs must be nonempty and unique',
  mass:'full-pair position reference inverse mass is invalid',endpoints:'full-pair position reference row endpoints are invalid',
  normal:'full-pair position reference normal must be finite and unit length',
  bound:'full-pair position reference bound must be finite and between minus ten and ten metres',
  result:'full-pair position reference result is invalid',workLimits:'full-pair position reference work limits are invalid',
});
export class FullPairPositionReferenceError extends Error {
  constructor(code,message){super(message);this.name='FullPairPositionReferenceError';this.code=code;}
}
export const DEFAULT_LIMITS=Object.freeze({iterations:1024,activeChanges:1024,rankChecks:2048,linearSolves:2048,constraintTests:262144,
  exactIntegerOperations:1000000,reducedRationalBits:8192,intermediateIntegerBits:16385});
export const COUNTER_KEYS=Object.freeze(['iterations','activeChanges','rankChecks','linearSolves','constraintTests','factorizations','blockRightHandSides','exactIntegerOperations','exactPeakBits']);
export function zeroFullPairCounters(){return Object.fromEntries(COUNTER_KEYS.map(k=>[k,0]));}
export function requireFull(condition,key='input',code='INVALID_INPUT'){
  if(!condition)throw new FullPairPositionReferenceError(code,MESSAGES[key]);
}
/** Read only own DATA descriptors. Accessors are rejected without invocation. */
export function dataRecord(value,keys){
  if(value===null||typeof value!=='object'||Array.isArray(value))return null;
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))return null;
  const copy={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value'))return null;Object.defineProperty(copy,k,{value:d.value,enumerable:true,writable:true,configurable:true});}return copy;
}
export function dataArray(value,size){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
  const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value<0)return null;
  const n=length.value;if(size!==undefined&&n!==size)return null;
  const own=Reflect.ownKeys(value);if(own.length!==n+1)return null;
  const copy=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value'))return null;copy.push(d.value);}return copy;
}
export function dataFiniteVector(value,size){const a=dataArray(value,size);return a&&a.every(v=>typeof v==='number'&&Number.isFinite(v))?a:null;}
/** @returns {import('./full-pair-types.js').FullPairProblem} */
export function validateFullPairProblem(value){
  const p=dataRecord(value,['bodies','rows']);requireFull(p!==null);
  const bodies=dataArray(p.bodies),rows=dataArray(p.rows);requireFull(bodies!==null&&rows!==null);
  requireFull(bodies.length<=9&&rows.length<=36,'limit','PROFILE_LIMIT');requireFull(bodies.length>0,'empty');
  const checkedBodies=[],ids=new Set();
  for(const raw of bodies){const b=dataRecord(raw,['id','inverseMass']);requireFull(b!==null);requireFull(typeof b.id==='string'&&b.id.length>0&&!ids.has(b.id),'ids');ids.add(b.id);
    requireFull(typeof b.inverseMass==='number'&&Number.isFinite(b.inverseMass)&&(b.inverseMass===0||(b.inverseMass>=1e-6&&b.inverseMass<=1e6)),'mass');checkedBodies.push({id:b.id,inverseMass:b.inverseMass});}
  const checkedRows=[];
  for(const raw of rows){const row=dataRecord(raw,['aId','bId','normal','boundM']);requireFull(row!==null);requireFull(ids.has(row.aId)&&ids.has(row.bId)&&row.aId!==row.bId,'endpoints');
    const normal=dataFiniteVector(row.normal,3);requireFull(normal!==null&&Math.abs(Math.hypot(...normal)-1)<=1e-12,'normal');requireFull(typeof row.boundM==='number'&&Number.isFinite(row.boundM)&&row.boundM>=-10&&row.boundM<=10,'bound');
    checkedRows.push({aId:row.aId,bId:row.bId,normal:[...normal],boundM:row.boundM});}
  return {bodies:checkedBodies,rows:checkedRows};
}
export function validateWorkLimits(value){
  const limits=dataRecord(value,Object.keys(DEFAULT_LIMITS));requireFull(limits!==null,'workLimits');
  for(const k of Object.keys(DEFAULT_LIMITS))requireFull(Number.isSafeInteger(limits[k])&&limits[k]>=0&&limits[k]<=DEFAULT_LIMITS[k],'workLimits');return {...limits};
}
/** Only this private exception becomes a structured numerical/work status. */
export class CoreStop extends Error {
  constructor(status,reason){super(reason);this.name='FullPairCoreStop';this.status=status;this.reason=reason;}
}
export function unsafe(reason){throw new CoreStop('NUMERIC_UNSAFE',reason);}
export function finite(value){if(!Number.isFinite(value))unsafe('nonfinite');return value;}
export function createMeter(limits=DEFAULT_LIMITS){
  const selected=validateWorkLimits(limits),counters=zeroFullPairCounters();
  return {limits:selected,counters,
    take(key,amount=1){const next=counters[key]+amount;if(!Number.isSafeInteger(next)||next>selected[key])throw new CoreStop('WORK_LIMIT','budget:'+key);counters[key]=next;},
    bits(value,reduced=false){const size=value===0n?0:(value<0n?-value:value).toString(2).length;
      const key=reduced?'reducedRationalBits':'intermediateIntegerBits';if(size>selected[key])throw new CoreStop('WORK_LIMIT','budget:'+key);counters.exactPeakBits=Math.max(counters.exactPeakBits,size);return size;},
    plannedBits(size){if(size>selected.intermediateIntegerBits)throw new CoreStop('WORK_LIMIT','budget:intermediateIntegerBits');},
  };
}
