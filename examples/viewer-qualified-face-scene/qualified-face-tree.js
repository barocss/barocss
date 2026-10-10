import {compileCadModel,validateFaceBundle,curveDomain,surfaceDomain} from '@barocss/cad';

const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face tree: '+message);};
const refFields=['sourceId','expectedSource','faceId','modelId','kind','geometryId','expectedFace'];

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
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face tree: snapshot cannot be copied',{cause});}
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

function parseRef(input){
  const ref=record(snapshot(input),refFields,'node reference');
  check(typeof ref.sourceId==='string'&&/^[A-F]$/.test(ref.sourceId),'this example admits current sourceIds A..F only');
  check(typeof ref.expectedSource==='string'&&ref.expectedSource.length>=1,'expectedSource must retain the whole original source');
  for(const key of ['faceId','modelId','geometryId'])check(typeof ref[key]==='string'&&ref[key].length>=1
    &&ref[key].length<=128,key+' length is invalid');
  check(ref.kind==='surface'||ref.kind==='curve','node kind must be surface or curve');
  record(ref.expectedFace,['geometry','topology'],'expected Face');return ref;
}
function sceneAssets(scene){
  const field=Object.getOwnPropertyDescriptor(scene,'assets');
  check(field&&field.enumerable&&'value'in field,'current assets must be own data');
  const assets=field.value;
  check(Array.isArray(assets)&&Object.getPrototypeOf(assets)===Array.prototype,'current assets must be an ordinary array');
  const length=Object.getOwnPropertyDescriptor(assets,'length').value;
  check(Number.isInteger(length)&&length>=2&&length<=6,'current scene requires2..6 original assets');
  const keys=Reflect.ownKeys(assets);
  check(keys.length===length+1&&keys.every(key=>key==='length'||typeof key==='string'
    &&/^(0|[1-9]\d*)$/.test(key)&&Number(key)<length),'current assets must be dense own data');
  const owned=[];
  for(let index=0;index<length;index++){
    const asset=Object.getOwnPropertyDescriptor(assets,String(index));
    check(asset&&asset.enumerable&&'value'in asset,'current asset must be own data');
    owned.push(record(snapshot(asset.value),['sourceId','source','face','color'],'current asset'));
  }
  try{structuredClone(assets);}catch(cause){throw new RangeError('Qualified Face tree: assets cannot be copied',{cause});}
  return owned;
}
function sourceEntry(asset){
  check(typeof asset.sourceId==='string'&&/^[A-F]$/.test(asset.sourceId),'this example admits current sourceIds A..F only');
  check(typeof asset.source==='string'&&asset.source.length>=1,'current original source is missing');
  const face=record(asset.face,['geometry','topology'],'current Face');
  const compiled=compileCadModel(asset.source,{sourceVersion:0});
  if(!compiled.ok)throw new RangeError('Qualified Face tree: complete original Source0 compilation refused',{cause:compiled.diagnostics});
  check(compiled.model.version===0&&compiled.model.lengthUnit==='mm'&&compiled.model.objects.length===5
    &&compiled.model.objects.filter(value=>value.kind==='surface').length===1
    &&compiled.model.objects.filter(value=>value.kind==='curve').length===4
    &&sameBits(compiled.model,face.geometry),'complete original source Model does not bit-match the current five-object Face geometry');
  validateFaceBundle(face);
  check(face.topology.face.orientation==='forward','current Face orientation must be forward');
  const faceId=face.topology.face.id,modelId=face.geometry.name;
  const geometries=face.geometry.objects.map(geometry=>{
    const domain=geometry.kind==='surface'?surfaceDomain(geometry):{t:curveDomain(geometry)};
    const ref={sourceId:asset.sourceId,expectedSource:asset.source,faceId,modelId,kind:geometry.kind,
      geometryId:geometry.id,expectedFace:structuredClone(face)};
    return{ref,properties:{lengthUnit:'mm',orientation:'forward',geometry,domain}};
  });
  return{sourceId:asset.sourceId,faceId,modelId,orientation:'forward',geometries};
}

/** Original source-qualified geometry only; no display selection or global topology is created. */
export function buildQualifiedFaceTree(viewer){
  const scene=viewer.getState().qualifiedFaceScene;if(scene==null)return null;
  check(typeof scene==='object'&&Object.getPrototypeOf(scene)===Object.prototype,'current qualified Face scene must be ordinary data');
  const assets=sceneAssets(scene),ids=new Set();
  for(const asset of assets){check(!ids.has(asset.sourceId),'current sourceIds must be distinct');ids.add(asset.sourceId);}
  const sources=assets.map(sourceEntry);
  sources.sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0);
  return structuredClone({version:0,sources});
}
function currentNode(viewer,ref){
  const tree=buildQualifiedFaceTree(viewer);check(tree,'a current qualified Face scene is required');
  const source=tree.sources.find(value=>value.sourceId===ref.sourceId);
  const node=source?.geometries.find(value=>sameBits(value.ref,ref));
  check(node,'node reference differs from the current original source/Face/Model/geometry');
  return structuredClone({version:0,ref:node.ref,properties:node.properties});
}

/** Rebuild current original authority before returning copied properties for an exact seven-field reference. */
export function queryQualifiedFaceTreeNode(viewer,input){
  return currentNode(viewer,parseRef(input));
}

/** One public paired native point query at strict explicit original-domain parameters. */
export function inspectQualifiedFaceTreeNode(viewer,input,parameterInput){
  const ref=parseRef(input),fields=ref.kind==='surface'?['u','v']:['t'];
  const parameters=record(snapshot(parameterInput),fields,'parameters');
  for(const key of fields)check(typeof parameters[key]==='number'&&Number.isFinite(parameters[key]),key+' must be finite');
  const node=currentNode(viewer,ref),domain=node.properties.domain;
  for(const key of fields)check(parameters[key]>=domain[key][0]&&parameters[key]<=domain[key][1],key+' is outside its original inclusive domain');
  const pin={kind:ref.kind,sourceId:ref.sourceId,expectedSource:ref.expectedSource,faceId:ref.faceId,
    modelId:ref.modelId,geometryId:ref.geometryId,...parameters};
  const measurement=viewer.measureQualifiedFacePoints(pin,pin);
  return structuredClone({version:0,node,parameters,measurement});
}
