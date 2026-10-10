const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face picked chord: '+message);};
const inputFields=['kind','sourceId','expectedSource','faceId','modelId','geometryId','u','v'];

function snapshot(input){
  let values=0;const active=new Set();
  const text=value=>check(value.length<=65536&&new TextEncoder().encode(value).length<=65536,'string exceeds the supported budget');
  function visit(value,depth){
    check(++values<=8192&&depth<=16,'snapshot exceeds the supported budget');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),'snapshot numbers must be finite');return value;}
    if(typeof value==='string'){text(value);return value;}
    check(value!==null&&typeof value==='object','snapshot requires plain JSON data');
    const array=Array.isArray(value);
    check(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype),'snapshot requires ordinary objects and arrays');
    check(!active.has(value),'snapshot contains a cycle');active.add(value);
    try{
      const keys=Reflect.ownKeys(value);
      if(array){
        const field=Object.getOwnPropertyDescriptor(value,'length');
        check(field&&'value'in field&&Number.isInteger(field.value)&&field.value>=0&&field.value<=512,'array length exceeds the supported budget');
        const length=field.value;
        check(keys.length===length+1&&keys.every(key=>key==='length'||typeof key==='string'
          &&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<length),'array must be dense own data');
        const result=[];
        for(let index=0;index<length;index++){
          const entry=Object.getOwnPropertyDescriptor(value,String(index));
          check(entry&&entry.enumerable&&'value'in entry,'array entries must be own data');
          result.push(visit(entry.value,depth+1));
        }
        return result;
      }
      check(keys.length<=64,'record key budget exceeded');const result={};
      for(const key of keys){
        check(typeof key==='string','symbol keys are not supported');text(key);
        const field=Object.getOwnPropertyDescriptor(value,key);
        check(field&&field.enumerable&&'value'in field,'record fields must be own data');
        Object.defineProperty(result,key,{value:visit(field.value,depth+1),enumerable:true,writable:true,configurable:true});
      }
      return result;
    }finally{active.delete(value);}
  }
  const owned=visit(input,0);
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face picked chord: snapshot cannot be copied',{cause});}
  return owned;
}
function record(value,fields,label){
  check(value!==null&&typeof value==='object'&&!Array.isArray(value),'missing '+label+' record');
  const keys=Object.keys(value);
  check(keys.length===fields.length&&keys.every(key=>fields.includes(key)),label+' has missing or unsupported fields');return value;
}
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)&&sameBits(a[key],b[key]));
}
function vector(value,label){check(Array.isArray(value)&&value.length===3&&value.every(Number.isFinite),label+' must be finite XYZ');}
function inputPoint(value){
  record(value,inputFields,'bare point');check(value.kind==='surface','point must identify the original Face Surface');
  for(const key of ['sourceId','faceId','modelId','geometryId'])check(typeof value[key]==='string'
    &&value[key].length>=1&&value[key].length<=(key==='sourceId'?48:128),key+' length is invalid');
  check(typeof value.expectedSource==='string'&&value.expectedSource.length>=1,'expectedSource must contain the whole original source');
  check(Number.isFinite(value.u)&&Number.isFinite(value.v),'U/V must be finite');return value;
}
function barePoint(value){return{kind:value.kind,sourceId:value.sourceId,expectedSource:value.expectedSource,
  faceId:value.faceId,modelId:value.modelId,geometryId:value.geometryId,u:value.u,v:value.v};}
function samplePoint(value){
  record(value,['version','pick','parameters','nativePoint','displayToNativeDistanceScene','certification'],'sample');
  check(value.version===0&&value.certification==='not-certified','sample version or certification is unsupported');
  const pick=record(value.pick,['ref','triangleIndex','displayPositionScene','depthScene','approximate','ambiguous'],'pick');
  const ref=record(pick.ref,['sourceId','expectedSource','faceId','modelId','surfaceId'],'pick reference');
  check(pick.approximate===true&&typeof pick.ambiguous==='boolean','pick must disclose approximation and ambiguity');
  check(Number.isInteger(pick.triangleIndex)&&pick.triangleIndex>=0&&pick.triangleIndex<=511,'triangleIndex is outside0..511');
  check(Number.isFinite(pick.depthScene)&&pick.depthScene>0,'pick depth must be finite and positive');
  vector(pick.displayPositionScene,'display point');
  const parameters=record(value.parameters,['u','v','approximate','method'],'parameters');
  check(parameters.approximate===true&&parameters.method==='display-triangle-barycentric'
    &&Number.isFinite(parameters.u)&&Number.isFinite(parameters.v),'parameters must disclose finite approximate barycentric U/V');
  const native=record(value.nativePoint,[...inputFields,'pointMM','pointScene'],'native point');
  const input=inputPoint(barePoint(native));vector(native.pointMM,'native point');vector(native.pointScene,'sample Scene point');
  check(Object.is(input.u,parameters.u)&&Object.is(input.v,parameters.v),'approximate U/V differs from the native input');
  check(ref.sourceId===input.sourceId&&ref.expectedSource===input.expectedSource&&ref.faceId===input.faceId
    &&ref.modelId===input.modelId&&ref.surfaceId===input.geometryId,'pick reference differs from the original native input');
  check(Number.isFinite(value.displayToNativeDistanceScene)&&value.displayToNativeDistanceScene>=0,'local Scene difference must be finite and nonnegative');
  return input;
}
function storedPoint(value){
  record(value,['input','pointMM','face','sample'],'stored point');
  const input=inputPoint(value.input),sampleInput=samplePoint(value.sample);
  vector(value.pointMM,'stored native point');record(value.face,['geometry','topology'],'stored Face');
  check(sameBits(input,sampleInput)&&sameBits(value.pointMM,value.sample.nativePoint.pointMM),'stored point differs from its sampled original point');
  return value;
}
function currentFace(scene,input){
  if(!scene||!Array.isArray(scene.assets))return null;
  const asset=scene.assets.find(value=>value.sourceId===input.sourceId);if(!asset)return null;
  const owned=snapshot(asset);
  if(owned.source!==input.expectedSource||owned.face.topology.face.id!==input.faceId
    ||owned.face.geometry.name!==input.modelId||owned.face.topology.face.surfaceId!==input.geometryId)return null;
  check(owned.face.geometry.objects.length===5,'current Face must retain the complete five-object original Model');
  return owned.face;
}

/** A fresh original evaluation validates the stored sample; its screen provenance remains approximate. */
export function createPickedFacePoint(viewer,sample){
  const owned=snapshot(sample),input=samplePoint(owned);
  const face=currentFace(viewer.getState().qualifiedFaceScene,input);check(face,'sample pin is not current');
  const fresh=viewer.measureQualifiedFacePoints(input,input);
  for(const point of [fresh.first,fresh.second])check(sameBits(point.pointMM,owned.nativePoint.pointMM)
    &&sameBits(point.pointScene,owned.nativePoint.pointScene),'sample native point differs from a fresh original evaluation');
  return structuredClone({input,pointMM:owned.nativePoint.pointMM,face,sample:owned});
}

/** Current original content identity only; it does not certify an unseen reload or query native math. */
export function isPickedFacePointCurrent(viewer,point){
  const owned=storedPoint(snapshot(point)),face=currentFace(viewer.getState().qualifiedFaceScene,owned.input);
  return face!==null&&sameBits(face,owned.face);
}

/** Measure the original chord at two approximately selected, still-current native parameter pins. */
export function measurePickedFaceChord(viewer,first,second){
  const a=storedPoint(snapshot(first)),b=storedPoint(snapshot(second));
  const scene=viewer.getState().qualifiedFaceScene;
  const firstFace=currentFace(scene,a.input),secondFace=currentFace(scene,b.input);
  check(firstFace&&secondFace&&sameBits(firstFace,a.face)&&sameBits(secondFace,b.face),'stored point source or complete Face content is stale');
  const measurement=viewer.measureQualifiedFacePoints(a.input,b.input);
  check(sameBits(measurement.first.pointMM,a.pointMM)&&sameBits(measurement.second.pointMM,b.pointMM),
    'stored native point differs from a fresh original evaluation');
  return structuredClone({version:0,first:a,second:b,measurement,
    selection:'approximate-display-parameters',certification:'not-certified'});
}
