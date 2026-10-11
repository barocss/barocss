import {curveDomain,evaluateCurveCurvature} from '@barocss/cad';
import {readNativePointScope} from './selected-native-point.js';

const prefix='Selected native Curve curvature: ';
const check=(value,message)=>{if(!value)throw new RangeError(prefix+message);};
const geometryId=/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const modelId=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function snapshot(input,maximumValues=8192,maximumDepth=16){
  let remaining=maximumValues;const active=new Set();
  function copy(value,depth){
    check(--remaining>=0&&depth<=maximumDepth,'own JSON value/depth budget exceeded');
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
  try{
    const owned=copy(input,0);
    // Check the ORIGINAL graph so a descriptor copy cannot launder a Proxy.
    structuredClone(input);return owned;
  }catch(cause){
    if(cause instanceof RangeError&&cause.message.startsWith(prefix))throw cause;
    throw new RangeError(prefix+'own-data copy refused',{cause});
  }
}
function record(value,keys,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const actual=Reflect.ownKeys(value);
  check(actual.length===keys.length&&actual.every(key=>keys.includes(key)),label+' has missing or extra fields');
  return value;
}
function reference(value){
  record(value,['kind','modelId','curveId'],'original Curve reference');
  check(value.kind==='curve','current original reference must be a Curve');
  check(typeof value.modelId==='string'&&modelId.test(value.modelId),'original Model ID must be ASCII1..128');
  check(typeof value.curveId==='string'&&geometryId.test(value.curveId),'original Curve ID must be ASCII1..128');
  return value;
}
function current(scope,latest,pin){
  return latest.source===scope.source&&same(latest.model,scope.model)&&same(latest.refs,scope.refs)
    &&latest.selectedRef!==null&&same(latest.selectedRef,pin.ref);
}

/** Inspect original local curvature/radius without writing Viewer state or measurements. */
export function querySelectedNativeCurveCurvature(viewer,expected,parameters){
  check(arguments.length===3,'query takes exactly three arguments');
  const owned=snapshot({expected,parameters});
  const pin=record(owned.expected,['source','model','ref'],'expected scope');
  check(typeof pin.source==='string'&&pin.source.length>=1,'whole Source0 is required');
  reference(pin.ref);
  const model=record(pin.model,['name','version','lengthUnit','objects'],'whole original Model');
  check(model.name===pin.ref.modelId&&model.version===0&&model.lengthUnit==='mm'
    &&Array.isArray(model.objects)&&model.objects.length>=1&&model.objects.length<=4,
  'whole original Model header/inventory differs');
  const input=record(owned.parameters,['t'],'original Curve parameter');
  check(typeof input.t==='number'&&Number.isFinite(input.t),'t must be an explicit finite original number');
  const scope=readNativePointScope(viewer);
  check(scope.source===pin.source&&same(scope.model,pin.model)&&scope.selectedRef!==null
    &&same(scope.selectedRef,pin.ref),'whole original source, Model or current Curve selection changed');
  const curve=scope.model.objects.find(value=>value.kind==='curve'&&value.id===pin.ref.curveId);
  check(curve,'selected original Curve is missing');
  const domain=curveDomain(curve);
  // Preserve the public curvature error and its original D2 cause; no fallback or extra numerical query.
  const curvature=evaluateCurveCurvature(curve,input.t);
  check(current(scope,readNativePointScope(viewer),pin),'original scope or selection changed during curvature inspection');
  const output=snapshot({version:0,scope:pin,parameters:input,domain,curvature,lengthUnit:'mm',
    coordinateFrame:'native-authored',certification:'not-certified'},32768,18);
  // JSON is only a capacity check; actual owned data retains original signed-zero bits.
  check(new TextEncoder().encode(JSON.stringify(output)).length<=8*1024*1024,
    'complete copied curvature exceeds8MiB JSON UTF8; no partial result is returned');
  check(current(scope,readNativePointScope(viewer),pin),
    'original scope or selection changed after curvature output copying');
  return output;
}
