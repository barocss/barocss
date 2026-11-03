/** Private literal-data test entry. No production entry imports this module. */
import {Unresolved,type ArithmeticContext} from './math-core.js';
import {createTestArithmeticContext,TestLimitError,type LowerLimits} from './test-context.js';
import type {ArithmeticLimits} from './limits.js';
import type {DynamicCounts,RootCertificate} from './types.js';

interface Base {lowerLimits?:LowerLimits}
export type ArithmeticTestRequest=
  | (Base&{kind:'polynomial';coefficients:string[];normalNumerator:string[]})
  | (Base&{kind:'multiply';left:string[];right:string[]})
  | (Base&{kind:'presentation';interval:[string,string]})
  | (Base&{kind:'round';value:string})
  | (Base&{kind:'operation';operation:'initialize'|'parse'|'multiply-integers'|'shift-integer';values?:string[];shift?:number});
interface Observation {context:'CREATED';counts:DynamicCounts;limits:Readonly<ArithmeticLimits>}
export type ArithmeticTestResult=
  | (Observation&{status:'CLASSIFIED';polynomialAscending:string[];sturmAscending:string[][];roots:RootCertificate[];selectedRoot:number})
  | (Observation&{status:'PRESENTED'|'ROUNDED_RATIONAL';value:number})
  | (Observation&{status:'PRESENTATION_UNRESOLVED';value:null})
  | (Observation&{status:'COMPLETED';result:null|string|string[]})
  | (Observation&{status:'UNRESOLVED';reason:string})
  | {status:'UNRESOLVED';reason:'TEST_REQUEST_INVALID'|'TEST_LIMIT_INVALID';context:'NOT_CREATED';counts:null;limits:null};
class TestRequestError extends Error {}
function invalid():never {throw new TestRequestError('TEST_REQUEST_INVALID');}
function strings(value:unknown,max=5):value is string[]{
  if(!Array.isArray(value)||value.length<1||value.length>max)return false;
  for(let i=0;i<value.length;i++)if(typeof value[i]!=='string'||value[i].length>4096)return false;
  return true;
}
function validate(request:ArithmeticTestRequest):void {
  if(request===null||typeof request!=='object'||Array.isArray(request))invalid();
  const common=['kind','lowerLimits'];let allowed:string[];
  switch(request.kind){
    case 'polynomial':if(!strings(request.coefficients)||!strings(request.normalNumerator))invalid();allowed=[...common,'coefficients','normalNumerator'];break;
    case 'multiply':if(!strings(request.left)||!strings(request.right))invalid();allowed=[...common,'left','right'];break;
    case 'presentation':if(!strings(request.interval,2)||request.interval.length!==2)invalid();allowed=[...common,'interval'];break;
    case 'round':if(typeof request.value!=='string'||request.value.length>4096)invalid();allowed=[...common,'value'];break;
    case 'operation':
      if(!['initialize','parse','multiply-integers','shift-integer'].includes(request.operation))invalid();
      if(request.operation==='initialize'){if(request.values!==undefined||request.shift!==undefined)invalid();}
      else if(request.operation==='parse'){if(!strings(request.values,1)||request.values.length!==1||request.shift!==undefined)invalid();}
      else if(request.operation==='multiply-integers'){
        if(!strings(request.values,2)||request.values.length!==2||request.shift!==undefined||request.values.some(s=>!/^[-]?\d+$/.test(s)))invalid();
      }else if(!strings(request.values,1)||request.values.length!==1||!/^[-]?\d+$/.test(request.values[0])
        ||!Number.isSafeInteger(request.shift)||request.shift! < 0||request.shift! > 16384)invalid();
      allowed=[...common,'operation','values','shift'];break;
    default:invalid();
  }
  for(const key of Reflect.ownKeys(request))if(typeof key!=='string'||!allowed.includes(key))invalid();
}

export function runArithmeticTest(request:ArithmeticTestRequest):ArithmeticTestResult {
  let core:ArithmeticContext|undefined,limits:Readonly<ArithmeticLimits>|undefined;
  const observation=():Observation=>({context:'CREATED',counts:core!.copyCounts(),limits:limits!});
  try{
    validate(request);
    const prepared=createTestArithmeticContext(request.lowerLimits);core=prepared.context;limits=prepared.limits;
    core.initialize();
    if(request.kind==='polynomial'){
      const polynomial=core.primitive(request.coefficients.map(core.parsed)),h=request.normalNumerator.map(core.parsed);
      const classified=core.classifyRoots(polynomial,h);
      return {status:'CLASSIFIED',polynomialAscending:polynomial.map(String),sturmAscending:classified.chain.map(p=>p.map(String)),
        roots:classified.rootCertificates,selectedRoot:classified.selected,...observation()};
    }
    if(request.kind==='multiply')return {status:'COMPLETED',result:core.vtext(core.pMul(request.left.map(core.parsed),request.right.map(core.parsed))),...observation()};
    if(request.kind==='presentation'){
      const interval:[ReturnType<ArithmeticContext['parsed']>,ReturnType<ArithmeticContext['parsed']>]=[core.parsed(request.interval[0]),core.parsed(request.interval[1])];
      if(core.cmp(interval[0],interval[1])>0)throw new TestRequestError('TEST_REQUEST_INVALID');
      const value=core.present(interval);
      return value===null?{status:'PRESENTATION_UNRESOLVED',value:null,...observation()}:{status:'PRESENTED',value,...observation()};
    }
    if(request.kind==='round')return {status:'ROUNDED_RATIONAL',value:core.numeric(core.parsed(request.value)),...observation()};
    if(request.operation==='initialize')return {status:'COMPLETED',result:null,...observation()};
    if(request.operation==='parse')return {status:'COMPLETED',result:core.text(core.parsed(request.values![0])),...observation()};
    const integers=request.values!.map(value=>core!.parsed(value+'/1').n);
    const result=request.operation==='multiply-integers'?core.imul(integers[0],integers[1]):core.ishift(integers[0],request.shift!);
    return {status:'COMPLETED',result:String(result),...observation()};
  }catch(error){
    if(error instanceof TestLimitError||error instanceof TestRequestError){
      if(!core)return {status:'UNRESOLVED',reason:error instanceof TestLimitError?'TEST_LIMIT_INVALID':'TEST_REQUEST_INVALID',context:'NOT_CREATED',counts:null,limits:null};
      return {status:'UNRESOLVED',reason:error.message,...observation()};
    }
    if(!(error instanceof Unresolved))throw error;
    return {status:'UNRESOLVED',reason:error.message,...observation()};
  }
}
