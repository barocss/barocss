import {createCadDocument,createCadGeometryReference,queryCadDocumentCurveArcLength,
  validateCadDocumentCurveArcLength,evaluateCurve} from '@barocss/cad';

export const LENGTH_OPTIONS=Object.freeze({interval:null,absoluteToleranceMM:1e-6,relativeTolerance:1e-8,
  maximumEvaluations:16384,maximumSubdivisions:128,maximumDepth:12});
const fields=['sourceId','expectedSource','faceId','modelId','curveId'];
const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face Curve length: '+message);};
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
  for(const key of ['faceId','modelId','curveId'])check(typeof pin[key]==='string'&&pin[key].length>=1&&pin[key].length<=128,'pin.'+key+' length is invalid');
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face Curve length: pin cannot be copied',{cause});}
  return pin;
}
function currentAsset(scene,sourceId){
  check(scene&&Array.isArray(scene.assets),'a current qualified Face scene is required');
  const asset=scene.assets.find(value=>value.sourceId===sourceId);
  check(asset,'sourceId is absent from the current scene');return asset;
}
function originalCurve(asset,curveId){
  const curve=asset.face.geometry.objects.find(value=>value.kind==='curve'&&value.id===curveId);
  check(curve,'curveId does not identify an original retained Curve');return curve;
}
export function lengthPin(scene,sourceId,curveId){
  check(typeof sourceId==='string'&&/^[A-F]$/.test(sourceId),'this example admits current sourceIds A..F only');
  check(typeof curveId==='string'&&curveId.length>=1&&curveId.length<=128,'curveId length is invalid');
  const asset=currentAsset(scene,sourceId);originalCurve(asset,curveId);
  return parsePin({sourceId,expectedSource:asset.source,faceId:asset.face.topology.face.id,
    modelId:asset.face.geometry.name,curveId});
}
export function queryQualifiedFaceCurveLength(scene,input,options=LENGTH_OPTIONS){
  const pin=parsePin(input),asset=currentAsset(scene,pin.sourceId);
  check(asset.source===pin.expectedSource,'source content pin differs from the current original');
  check(asset.face.topology.face.id===pin.faceId&&asset.face.geometry.name===pin.modelId,
    'Face/Model pin differs from the current original');
  originalCurve(asset,pin.curveId);
  const cad=createCadDocument({schema:'barocss-cad-document',version:1,profile:'direct-geometry',
    documentId:'face_length_'+pin.sourceId,revision:0,units:{length:'mm',angle:'rad'},nativeFrame:'authored-xyz-no-axis-conversion',
    assets:[{id:'source_asset',revision:0,role:'authored-native-source',sourceVersion:0,
      sourceFrame:'authored-xyz-no-axis-conversion',source:asset.source}],
    bodies:[{id:'curve_body',name:'Curve length inspection',kind:'direct-geometry-object',assetId:'source_asset',geometryId:pin.curveId}],
    features:[],parameters:[],constraints:[],placements:[],derivedCaches:[]});
  check(cad.compiledAssets[0].model.objects.length===5&&sameBits(cad.compiledAssets[0].model,asset.face.geometry),
    'complete original source Model does not bit-match the current Face geometry');
  const reference=createCadGeometryReference(cad,{bodyId:'curve_body'}).reference;
  const length=queryCadDocumentCurveArcLength(cad,reference,options);
  const validated=validateCadDocumentCurveArcLength(cad,length);
  check(sameBits(validated,length.report),'completed Curve length report differs from public reconstruction');
  const [low,high]=length.report.interval;
  const first=evaluateCurve(length.geometry,low),second=evaluateCurve(length.geometry,high);
  check(first.every(Number.isFinite)&&second.every(Number.isFinite),'original interval endpoints are not finite');
  const chordMM=Math.hypot(...second.map((value,axis)=>value-first[axis])),t=low+(high-low)*.5;
  check(Number.isFinite(chordMM)&&Number.isFinite(t),'endpoint chord or measured parameter midpoint is not finite');
  const anchor={kind:'curve',sourceId:pin.sourceId,expectedSource:pin.expectedSource,faceId:pin.faceId,
    modelId:pin.modelId,geometryId:pin.curveId,t};
  return structuredClone({version:0,pin,inspectionDocument:cad.document,reference,length,chordMM,anchor});
}
