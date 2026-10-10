import {createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,
  validateCadDocumentSurfaceArea} from '@barocss/cad';

export const AREA_OPTIONS=Object.freeze({region:null,absoluteToleranceMM2:.01,relativeTolerance:1e-6,
  maximumEvaluations:16384,maximumSubdivisions:128,maximumDepth:8});
const fields=['sourceId','expectedSource','faceId','modelId','surfaceId'];
const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face area: '+message);};
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&sameBits(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function parsePin(input){
  check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'pin must be plain own data');
  const keys=Reflect.ownKeys(input);
  check(keys.length===fields.length&&keys.every(key=>typeof key==='string'&&fields.includes(key)),'pin has missing or unsupported fields');
  const pin={};
  for(const key of fields){const field=Object.getOwnPropertyDescriptor(input,key);
    check(field&&field.enumerable&&'value'in field,'pin.'+key+' must be own data');pin[key]=field.value;}
  check(typeof pin.sourceId==='string'&&/^[A-F]$/.test(pin.sourceId),'this example admits current sourceIds A..F only');
  check(typeof pin.expectedSource==='string'&&pin.expectedSource.length>=1&&pin.expectedSource.length<=65536
    &&new TextEncoder().encode(pin.expectedSource).length<=65536,'expectedSource must retain1..65536UTF8bytes');
  for(const key of ['faceId','modelId','surfaceId'])check(typeof pin[key]==='string'&&pin[key].length>=1&&pin[key].length<=128,'pin.'+key+' length is invalid');
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face area: pin cannot be copied',{cause});}
  return pin;
}
function currentAsset(scene,sourceId){
  check(scene&&Array.isArray(scene.assets),'a current qualified Face scene is required');
  const asset=scene.assets.find(value=>value.sourceId===sourceId);
  check(asset,'sourceId is absent from the current scene');return asset;
}
export function areaPin(scene,sourceId){
  check(typeof sourceId==='string'&&/^[A-F]$/.test(sourceId),'this example admits current sourceIds A..F only');
  const asset=currentAsset(scene,sourceId);
  return parsePin({sourceId,expectedSource:asset.source,faceId:asset.face.topology.face.id,
    modelId:asset.face.geometry.name,surfaceId:asset.face.topology.face.surfaceId});
}
export function queryQualifiedFaceSurfaceArea(scene,input,options=AREA_OPTIONS){
  const pin=parsePin(input),asset=currentAsset(scene,pin.sourceId);
  check(asset.source===pin.expectedSource,'source content pin differs from the current original');
  check(asset.face.topology.face.id===pin.faceId&&asset.face.geometry.name===pin.modelId
    &&asset.face.topology.face.surfaceId===pin.surfaceId,'Face/Model/Surface pin differs from the current original');
  const cad=createCadDocument({schema:'barocss-cad-document',version:1,profile:'direct-geometry',
    documentId:'face_area_'+pin.sourceId,revision:0,units:{length:'mm',angle:'rad'},nativeFrame:'authored-xyz-no-axis-conversion',
    assets:[{id:'source_asset',revision:0,role:'authored-native-source',sourceVersion:0,
      sourceFrame:'authored-xyz-no-axis-conversion',source:asset.source}],
    bodies:[{id:'surface_body',name:'Surface area inspection',kind:'direct-geometry-object',assetId:'source_asset',geometryId:pin.surfaceId}],
    features:[],parameters:[],constraints:[],placements:[],derivedCaches:[]});
  check(cad.compiledAssets[0].model.objects.length===5&&sameBits(cad.compiledAssets[0].model,asset.face.geometry),
    'complete original source Model does not bit-match the current Face geometry');
  const reference=createCadGeometryReference(cad,{bodyId:'surface_body'}).reference;
  const area=queryCadDocumentSurfaceArea(cad,reference,options);
  const validated=validateCadDocumentSurfaceArea(cad,area);
  check(sameBits(validated,area.report),'completed area report differs from public reconstruction');
  const domains=area.report.originalDomains;
  const u=domains.u[0]+(domains.u[1]-domains.u[0])*.5,v=domains.v[0]+(domains.v[1]-domains.v[0])*.5;
  check(Number.isFinite(u)&&Number.isFinite(v),'original parameter midpoint is not finite');
  const anchor={kind:'surface',sourceId:pin.sourceId,expectedSource:pin.expectedSource,faceId:pin.faceId,
    modelId:pin.modelId,geometryId:pin.surfaceId,u,v};
  return structuredClone({version:0,pin,inspectionDocument:cad.document,reference,area,anchor});
}
