import {curveDomain,surfaceDomain,evaluateCurveD1,evaluateSurfaceD1} from '@barocss/cad';
import {readNativePointScope} from './selected-native-point.js';

const check=(value,message)=>{if(!value)throw new RangeError('Selected native derivatives: '+message);};
const geometryId=/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const modelId=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function snapshot(input){
  let remaining=8192;const active=new Set();
  function copy(value,depth){
    check(--remaining>=0&&depth<=16,'own JSON value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'own JSON numbers must be finite');return value;}
    if(typeof value==='string'){
      check(value.length<=65536&&new TextEncoder().encode(value).length<=65536,'own JSON string exceeds65536bytes/code units');return value;
    }
    check(value&&typeof value==='object','own JSON data is required');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,'foreign JSON prototype is unsupported');
    check(!active.has(value),'cyclic JSON data is unsupported');active.add(value);
    const keys=Reflect.ownKeys(value);let output;
    if(array){
      const length=Object.getOwnPropertyDescriptor(value,'length');
      check(length&&'value'in length&&Number.isInteger(length.value)&&length.value>=0&&length.value<=512,'array exceeds512elements');
      check(keys.length===length.value+1,'array has holes or extra fields');output=[];
      for(let index=0;index<length.value;index++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,'array requires own dense data');
        output.push(copy(descriptor.value,depth+1));
      }
    }else{
      check(keys.length<=64&&keys.every(key=>typeof key==='string'&&key.length<=64),'record field/key budget exceeded');output={};
      for(const key of keys){
        const descriptor=Object.getOwnPropertyDescriptor(value,key);
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,'record requires own enumerable data');
        Object.defineProperty(output,key,{value:copy(descriptor.value,depth+1),enumerable:true,writable:true,configurable:true});
      }
    }
    active.delete(value);return output;
  }
  const owned=copy(input,0);
  // Check the original graph so a descriptor copy cannot launder a Proxy.
  structuredClone(input);
  return owned;
}
function record(value,keys,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const actual=Reflect.ownKeys(value);
  check(actual.length===keys.length&&actual.every(key=>keys.includes(key)),label+' has missing or extra fields');
  return value;
}
function reference(value){
  check(value&&typeof value==='object'&&!Array.isArray(value),'original reference must be data');
  check(value.kind==='surface'||value.kind==='curve','original reference kind must be Surface or Curve');
  record(value,value.kind==='surface'?['kind','modelId','surfaceId']:['kind','modelId','curveId'],'original reference');
  check(typeof value.modelId==='string'&&modelId.test(value.modelId),'original Model ID must be ASCII1..128');
  const id=value.kind==='surface'?value.surfaceId:value.curveId;
  check(typeof id==='string'&&geometryId.test(id),'original geometry ID must be ASCII1..128');return value;
}

/** Inspect raw original D1 vectors without writing Viewer state or measurements. */
export function querySelectedNativeDerivatives(viewer,expected,input){
  check(arguments.length===3,'query takes exactly three arguments');
  const owned=snapshot({expected,input});
  const pin=record(owned.expected,['source','model','ref'],'expected scope');
  check(typeof pin.source==='string'&&pin.source.length>=1,'whole Source0 is required');
  reference(pin.ref);
  const model=record(pin.model,['name','version','lengthUnit','objects'],'whole original Model');
  check(model.name===pin.ref.modelId&&model.version===0&&model.lengthUnit==='mm'
    &&Array.isArray(model.objects)&&model.objects.length>=1&&model.objects.length<=4,'whole original Model header/inventory differs');
  const parameters=record(owned.input,pin.ref.kind==='surface'?['u','v']:['t'],'original parameters');
  check(Object.values(parameters).every(value=>typeof value==='number'&&Number.isFinite(value)),
    'every original parameter must be an explicit finite number');
  // The existing qualifier explicitly compiles Source0 and checks every original object.
  const scope=readNativePointScope(viewer);
  check(scope.source===pin.source&&same(scope.model,pin.model)&&scope.selectedRef!==null&&same(scope.selectedRef,pin.ref),
    'whole original source, Model or current selection changed');
  const id=pin.ref.kind==='surface'?pin.ref.surfaceId:pin.ref.curveId;
  const geometry=scope.model.objects.find(value=>value.kind===pin.ref.kind&&value.id===id);
  check(geometry,'selected original geometry is missing');
  const domain=pin.ref.kind==='surface'?surfaceDomain(geometry):curveDomain(geometry);
  // Keep original units, raw zero vectors and native errors; do not add a D0/D2 query.
  const derivatives=pin.ref.kind==='surface'?evaluateSurfaceD1(geometry,parameters.u,parameters.v)
    :evaluateCurveD1(geometry,parameters.t);
  const latest=readNativePointScope(viewer);
  check(latest.source===scope.source&&same(latest.model,scope.model)&&same(latest.refs,scope.refs)
    &&latest.selectedRef!==null&&same(latest.selectedRef,pin.ref),'original scope or selection changed during inspection');
  return snapshot({version:0,scope:pin,parameters,domain,derivatives,lengthUnit:'mm',
    coordinateFrame:'native-authored',certification:'not-certified'});
}
