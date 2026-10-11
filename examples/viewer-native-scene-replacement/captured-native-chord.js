import {curveDomain,surfaceDomain,evaluateCurve,evaluateSurface} from '@barocss/cad';
import {readNativePointScope} from './selected-native-point.js';

const check=(value,message)=>{if(!value)throw new RangeError('Captured native chord: '+message);};
const same=(a,b)=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'
  &&Array.isArray(a)===Array.isArray(b)&&Reflect.ownKeys(a).length===Reflect.ownKeys(b).length
  &&Reflect.ownKeys(a).every(key=>Object.hasOwn(b,key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
function snapshot(input,maximumValues=32768,maximumDepth=18,phase=''){
  let remaining=maximumValues;const active=new Set();
  const require=(value,message)=>check(value,phase+message);
  function copy(value,depth){
    require(--remaining>=0&&depth<=maximumDepth,'own JSON value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){require(Number.isFinite(value),'own JSON number must be finite');return value;}
    if(typeof value==='string'){require(value.length<=65536&&new TextEncoder().encode(value).length<=65536,
      'own JSON string exceeds65536bytes/code units');return value;}
    require(value&&typeof value==='object','own JSON data is required');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    require(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,
      'foreign JSON prototype is unsupported');
    require(!active.has(value),'cyclic JSON data is unsupported');active.add(value);
    const keys=Reflect.ownKeys(value);let result;
    if(array){
      const length=Object.getOwnPropertyDescriptor(value,'length');
      require(length&&'value'in length&&Number.isInteger(length.value)&&length.value>=0&&length.value<=512,
        'array exceeds512elements');require(keys.length===length.value+1,'array has holes or extra fields');result=[];
      for(let index=0;index<length.value;index++){
        const field=Object.getOwnPropertyDescriptor(value,String(index));
        require(field&&field.enumerable&&'value'in field,'array requires own dense data');result.push(copy(field.value,depth+1));
      }
    }else{
      require(keys.length<=64&&keys.every(key=>typeof key==='string'&&key.length<=64),'record field/key budget exceeded');
      result={};for(const key of keys){const field=Object.getOwnPropertyDescriptor(value,key);
        require(field&&field.enumerable&&'value'in field,'record requires own enumerable data');
        Object.defineProperty(result,key,{value:copy(field.value,depth+1),enumerable:true,writable:true,configurable:true});}
    }
    active.delete(value);return result;
  }
  const owned=copy(input,0);structuredClone(input);return owned; // Guard the ORIGINAL Proxy graph.
}
function record(value,keys,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const actual=Reflect.ownKeys(value);check(actual.length===keys.length&&actual.every(key=>keys.includes(key)),
    label+' has missing or extra fields');return value;
}
const refKey=ref=>JSON.stringify(ref.kind==='surface'
  ?['surface',ref.modelId,ref.surfaceId]:['curve',ref.modelId,ref.curveId]);
function shape(point){
  record(point,['version','scope','parameters','domain','pointMM','lengthUnit','coordinateFrame','certification'],'stored point');
  check(point.version===0&&point.lengthUnit==='mm'&&point.coordinateFrame==='native-authored'
    &&point.certification==='not-certified','stored point metadata differs from the original point profile');
  const scope=record(point.scope,['source','model','ref'],'stored original scope');
  check(typeof scope.source==='string'&&scope.source.length>=1,'stored complete Source0 is required');
  const model=record(scope.model,['name','version','lengthUnit','objects'],'stored complete Model');
  check(model.version===0&&model.lengthUnit==='mm'&&Array.isArray(model.objects)
    &&model.objects.length>=1&&model.objects.length<=4,'stored complete Model requires1..4original objects');
  const ref=scope.ref;check(ref&&typeof ref==='object'&&(ref.kind==='surface'||ref.kind==='curve'),'stored original reference is required');
  record(ref,ref.kind==='surface'?['kind','modelId','surfaceId']:['kind','modelId','curveId'],'stored reference');
  check(typeof ref.modelId==='string'&&/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/.test(ref.modelId)
    &&typeof model.name==='string'&&model.name===ref.modelId,'stored Model reference must be original ASCII1..128');
  const geometryId=ref.kind==='surface'?ref.surfaceId:ref.curveId;
  check(typeof geometryId==='string'&&/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/.test(geometryId),'stored geometry ID must be ASCII1..128');
  const parameters=record(point.parameters,ref.kind==='surface'?['u','v']:['t'],'stored original parameters');
  check(Object.values(parameters).every(value=>typeof value==='number'&&Number.isFinite(value)),
    'stored parameters must be explicit finite numbers');
  const interval=value=>check(Array.isArray(value)&&value.length===2&&value.every(n=>typeof n==='number'&&Number.isFinite(n))
    &&value[0]<value[1],'stored domain must be a finite original interval');
  if(ref.kind==='surface'){record(point.domain,['u','v'],'stored Surface domain');interval(point.domain.u);interval(point.domain.v);}
  else interval(point.domain);
  check(Array.isArray(point.pointMM)&&point.pointMM.length===3
    &&point.pointMM.every(value=>typeof value==='number'&&Number.isFinite(value)),'stored original point must have three finite coordinates');
  return point;
}
function currentScope(viewer,source){
  const state=viewer.getState();
  if(state.status==='disposed'||!state.native||state.document||state.modelSet||state.assembly||state.shell
    ||state.qualifiedFaceScene||state.uniformCurve||state.selectedUniformCurve||state.mixedDepth
    ||state.native.source!==source)return null;
  return readNativePointScope(viewer);
}
function authority(point,scope){
  return scope&&point.scope.source===scope.source&&same(point.scope.model,scope.model)
    &&scope.refs.some(ref=>refKey(ref)===refKey(point.scope.ref));
}
const sameAuthority=(a,b)=>a&&b&&a.source===b.source&&same(a.model,b.model)&&same(a.refs,b.refs);
function qualify(point,scope){
  const ref=point.scope.ref,id=ref.kind==='surface'?ref.surfaceId:ref.curveId;
  const geometry=scope.model.objects.find(value=>value.kind===ref.kind&&value.id===id);
  check(geometry,'stored original geometry is missing');
  const domain=ref.kind==='surface'?surfaceDomain(geometry):curveDomain(geometry);
  check(same(domain,point.domain),'stored domain differs from the original native domain');
  const fresh=ref.kind==='surface'?evaluateSurface(geometry,point.parameters.u,point.parameters.v)
    :evaluateCurve(geometry,point.parameters.t);
  check(same(fresh,point.pointMM),'stored point differs from fresh original native D0');
}
function parameter(point){
  const ref=point.scope.ref;
  return ref.kind==='surface'?{kind:'surface',modelId:ref.modelId,surfaceId:ref.surfaceId,
    u:point.parameters.u,v:point.parameters.v}:{kind:'curve',modelId:ref.modelId,curveId:ref.curveId,t:point.parameters.t};
}
function nativePoint(point){
  const ref=point.scope.ref;
  return ref.kind==='surface'?{kind:'surface',ref:{modelId:ref.modelId,surfaceId:ref.surfaceId},
    u:point.parameters.u,v:point.parameters.v,pointMM:point.pointMM}
    :{kind:'curve',ref:{modelId:ref.modelId,curveId:ref.curveId},t:point.parameters.t,pointMM:point.pointMM};
}

/** Pure current original-point validation; a captured point is not an SDK selection. */
export function isCapturedNativeChordPointCurrent(viewer,point){
  if(point===null)return false;
  const owned=shape(snapshot(point,8192,16)),scope=currentScope(viewer,owned.scope.source);
  if(!authority(owned,scope))return false;
  qualify(owned,scope);
  return sameAuthority(scope,currentScope(viewer,owned.scope.source));
}

/** Measure an original chord with one SDK call, intentionally committing nativeMeasurement. */
export function measureCapturedNativeChord(viewer,first,second){
  shape(snapshot(first,8192,16));shape(snapshot(second,8192,16));
  const owned=snapshot({first,second}),a=shape(owned.first),b=shape(owned.second);
  check(a.scope.source===b.scope.source&&same(a.scope.model,b.scope.model),'both captured points must share the complete original source and Model');
  const scope=currentScope(viewer,a.scope.source);
  check(authority(a,scope)&&authority(b,scope),'captured original authority is no longer current');
  qualify(a,scope);qualify(b,scope);
  check(sameAuthority(scope,currentScope(viewer,a.scope.source)),'original authority changed before measurement');
  // The public operation evaluates both original inputs and commits its own cache.
  const measurement=viewer.measureNativePoints(parameter(a),parameter(b));
  const output=snapshot({version:0,first:a,second:b,measurement},32768,18,'POSTCOMMIT: ');
  const result=output.measurement;
  check(result&&typeof result==='object'&&same(result.first,nativePoint(a))&&same(result.second,nativePoint(b))
    &&typeof result.distanceMM==='number'&&Number.isFinite(result.distanceMM)&&result.distanceMM>=0
    &&result.metric==='straight-line'&&result.space==='native-authored'&&result.certification==='not-certified',
  'POSTCOMMIT: public measurement differs from the qualified original points');
  check(sameAuthority(scope,currentScope(viewer,a.scope.source)),
    'POSTCOMMIT: original authority changed after the SDK measurement cache commit');
  return output;
}
