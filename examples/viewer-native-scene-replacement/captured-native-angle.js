import {readNativePointScope} from './selected-native-point.js';
import {isCapturedNativeChordPointCurrent} from './captured-native-chord.js';

const prefix='Captured native angle: ';
const check=(value,message)=>{if(!value)throw new RangeError(prefix+message);};
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
  try{const owned=copy(input,0);structuredClone(input);return owned;} // Guard the ORIGINAL Proxy graph.
  catch(cause){if(cause instanceof RangeError&&cause.message.startsWith(prefix))throw cause;
    throw new RangeError(prefix+'own-data copy refused',{cause});}
}
function record(value,keys,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const actual=Reflect.ownKeys(value);check(actual.length===keys.length&&actual.every(key=>keys.includes(key)),
    label+' has missing or extra fields');return value;
}
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

const sameAuthority=(a,b)=>a.source===b.source&&same(a.model,b.model)&&same(a.refs,b.refs);
function inScope(point,scope){
  return point.scope.source===scope.source&&same(point.scope.model,scope.model)
    &&scope.refs.some(ref=>same(ref,point.scope.ref));
}
function finite(value,label){check(Number.isFinite(value),label+' is not finite');return value;}
function leg(endpoint,vertex){
  const vector=[0,1,2].map(axis=>finite(endpoint.pointMM[axis]-vertex.pointMM[axis],'original leg component'));
  const length=finite(Math.hypot(...vector),'original leg length');
  check(length>0,'original leg has represented zero length');
  const direction=vector.map(value=>{
    const normalized=finite(value/length,'normalized leg component');
    check(value===0||normalized!==0,'nonzero original leg component collapsed during normalization');
    return normalized;
  });
  return{length,direction};
}
function product(a,b){
  const value=finite(a*b,'normalized product');
  check(a===0||b===0||value!==0,'nonzero normalized factors produced represented zero');return value;
}

/** Unsigned angle from three current original captured points, without SDK cache writes. */
export function measureCapturedNativeAngle(viewer,first,vertex,third){
  check(arguments.length===4,'measurement takes exactly four arguments');
  // Admit ALL THREE complete caller shapes and original graphs before any Viewer read.
  shape(snapshot(first,8192,16));shape(snapshot(vertex,8192,16));shape(snapshot(third,8192,16));
  const owned=snapshot({first,vertex,third}),a=shape(owned.first),v=shape(owned.vertex),b=shape(owned.third);
  check(a.scope.source===v.scope.source&&a.scope.source===b.scope.source
    &&same(a.scope.model,v.scope.model)&&same(a.scope.model,b.scope.model),
  'all captured points must share the complete original source and Model');
  const scope=readNativePointScope(viewer);
  check([a,v,b].every(point=>inScope(point,scope)),'captured original authority is no longer current');
  for(const point of [a,v,b])check(isCapturedNativeChordPointCurrent(viewer,point),
    'captured original point is no longer current');
  check(sameAuthority(scope,readNativePointScope(viewer)),
    'complete original authority changed before angle calculation');
  const firstLeg=leg(a,v),thirdLeg=leg(b,v),x=firstLeg.direction,y=thirdLeg.direction;
  const cross=[
    finite(product(x[1],y[2])-product(x[2],y[1]),'cross X'),
    finite(product(x[2],y[0])-product(x[0],y[2]),'cross Y'),
    finite(product(x[0],y[1])-product(x[1],y[0]),'cross Z'),
  ];
  const dot=finite(finite(product(x[0],y[0])+product(x[1],y[1]),'dot partial sum')
    +product(x[2],y[2]),'dot sum');
  const crossLength=finite(Math.hypot(...cross),'cross norm');
  const angleRadians=finite(Math.atan2(crossLength,dot),'angle radians');
  const angleDegrees=finite(angleRadians*180/Math.PI,'angle degrees');
  check(angleRadians>=0&&angleRadians<=Math.PI&&angleDegrees>=0&&angleDegrees<=180,
    'unsigned angle exceeds its declared range');
  const output=snapshot({version:0,first:a,vertex:v,third:b,legsMM:[firstLeg.length,thirdLeg.length],
    angleRadians,angleDegrees,metric:'unsigned-three-point-angle',coordinateFrame:'native-authored',
    certification:'not-certified'});
  // JSON is a capacity check only; the owned operands retain original signed-zero bits.
  check(new TextEncoder().encode(JSON.stringify(output)).length<=8*1024*1024,
    'complete copied angle exceeds8MiB JSON UTF8; no partial result is returned');
  check(sameAuthority(scope,readNativePointScope(viewer)),
    'complete original authority changed after angle output copying');
  return output;
}
