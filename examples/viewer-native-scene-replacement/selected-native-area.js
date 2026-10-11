import {createCadDocument,createCadGeometryReference,queryCadDocumentSurfaceArea,
  validateCadDocumentSurfaceArea} from '@barocss/cad';
import {readNativePointScope} from './selected-native-point.js';

export const NATIVE_SURFACE_AREA_OPTIONS=Object.freeze({region:null,absoluteToleranceMM2:.01,
  relativeTolerance:1e-6,maximumEvaluations:16384,maximumSubdivisions:128,maximumDepth:8});
const prefix='Selected native Surface area: ';
const check=(value,message)=>{if(!value)throw new RangeError(prefix+message);};
const geometryId=/^[A-Za-z_][A-Za-z0-9_-]{0,127}$/;
const modelId=/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/;
const profiles={
  expected:{values:8192,depth:16,array:512,record:64,key:64,string:65536,bytes:65536},
  options:{values:32768,depth:8,array:128,record:16,key:128,string:128,bytes:128},
  output:{values:2097152,depth:40,array:8192,record:64,key:128,string:262144,bytes:1048576},
};
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&same(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function snapshot(input,profile,label,originalGuard=false){
  let remaining=profile.values;const active=new Set();
  const copy=(value,depth)=>{
    check(--remaining>=0&&depth<=profile.depth,label+' value/depth budget exceeded');
    if(value===null||typeof value==='boolean')return value;
    if(typeof value==='number'){check(Number.isFinite(value),label+' numbers must be finite');return value;}
    if(typeof value==='string'){
      check(value.length<=profile.string&&new TextEncoder().encode(value).length<=profile.bytes,
        label+' string budget exceeded');return value;
    }
    check(value&&typeof value==='object',label+' requires own JSON data');
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    check(array?prototype===Array.prototype:prototype===Object.prototype||prototype===null,
      label+' has a foreign prototype');
    check(!active.has(value),label+' contains a cycle');active.add(value);
    const keys=Reflect.ownKeys(value);let output;
    if(array){
      const length=Object.getOwnPropertyDescriptor(value,'length');
      check(length&&'value'in length&&Number.isInteger(length.value)&&length.value>=0
        &&length.value<=profile.array&&keys.length===length.value+1,label+' array must be bounded and dense');
      output=[];
      for(let index=0;index<length.value;index++){
        const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,label+' array requires own data');
        output.push(copy(descriptor.value,depth+1));
      }
    }else{
      check(keys.length<=profile.record&&keys.every(key=>typeof key==='string'&&key.length<=profile.key),
        label+' record/key budget exceeded');output={};
      for(const key of keys){
        const descriptor=Object.getOwnPropertyDescriptor(value,key);
        check(descriptor&&descriptor.enumerable&&'value'in descriptor,label+' record requires own data');
        Object.defineProperty(output,key,{value:copy(descriptor.value,depth+1),enumerable:true,
          writable:true,configurable:true});
      }
    }
    active.delete(value);return output;
  };
  try{
    const owned=copy(input,0);
    // Clone the ORIGINAL input graph; cloning only owned data would admit a Proxy.
    if(originalGuard)structuredClone(input);
    return owned;
  }catch(cause){
    if(cause instanceof RangeError&&cause.message.startsWith(prefix))throw cause;
    throw new RangeError(prefix+label+' own-data copy refused',{cause});
  }
}
function record(value,fields,label){
  check(value&&typeof value==='object'&&!Array.isArray(value),label+' must be a record');
  const keys=Reflect.ownKeys(value);
  check(keys.length===fields.length&&keys.every(key=>fields.includes(key)),label+' has missing or extra fields');
  return value;
}
function expectedPin(input){
  const pin=record(input,['source','model','ref'],'expected scope');
  check(typeof pin.source==='string'&&pin.source.length>=1,'whole Source0 is required');
  const ref=record(pin.ref,['kind','modelId','surfaceId'],'original Surface reference');
  check(ref.kind==='surface'&&typeof ref.modelId==='string'&&modelId.test(ref.modelId)
    &&typeof ref.surfaceId==='string'&&geometryId.test(ref.surfaceId),'original Surface reference must use bounded ASCII IDs');
  const model=record(pin.model,['name','version','lengthUnit','objects'],'whole original Model');
  check(model.name===ref.modelId&&model.version===0&&model.lengthUnit==='mm'
    &&Array.isArray(model.objects)&&model.objects.length>=1&&model.objects.length<=4,
  'whole original Model header/inventory differs');
  return pin;
}
function areaOptions(input){
  const options=record(input,['region','absoluteToleranceMM2','relativeTolerance','maximumEvaluations',
    'maximumSubdivisions','maximumDepth'],'options');
  if(options.region!==null){
    const region=record(options.region,['u','v'],'original U/V region');
    check(['u','v'].every(axis=>Array.isArray(region[axis])&&region[axis].length===2
      &&region[axis].every(value=>typeof value==='number'&&Number.isFinite(value))),
    'region must contain two explicit finite numbers per axis');
  }
  check(['absoluteToleranceMM2','relativeTolerance','maximumEvaluations','maximumSubdivisions','maximumDepth']
    .every(key=>typeof options[key]==='number'&&Number.isFinite(options[key])),
  'each numeric option must be an explicit finite number');
  // Native ranges, region order/domains and numerical budgets remain public CAD policy.
  return options;
}

/** Estimate the current selected original parametric Surface area without writing Viewer state or caches. */
export function querySelectedNativeSurfaceArea(viewer,expected,options){
  check(arguments.length===3,'query takes exactly three arguments');
  const pin=expectedPin(snapshot(expected,profiles.expected,'expected',true));
  const settings=areaOptions(snapshot(options,profiles.options,'options',true));
  const scope=readNativePointScope(viewer);
  check(scope.source===pin.source&&same(scope.model,pin.model)&&scope.selectedRef!==null
    &&same(scope.selectedRef,pin.ref),'whole original source, Model or current Surface selection changed');
  const geometry=scope.model.objects.find(value=>value.kind==='surface'&&value.id===pin.ref.surfaceId);
  check(geometry,'selected original Surface is missing');
  const cad=createCadDocument({schema:'barocss-cad-document',version:1,profile:'direct-geometry',
    documentId:'native_surface_area',revision:0,units:{length:'mm',angle:'rad'},
    nativeFrame:'authored-xyz-no-axis-conversion',
    assets:[{id:'source_asset',revision:0,role:'authored-native-source',sourceVersion:0,
      sourceFrame:'authored-xyz-no-axis-conversion',source:scope.source}],
    bodies:[{id:'surface_body',name:'Surface area inspection',kind:'direct-geometry-object',
      assetId:'source_asset',geometryId:pin.ref.surfaceId}],
    features:[],parameters:[],constraints:[],placements:[],derivedCaches:[]});
  check(cad.compiledAssets.length===1&&cad.compiledAssets[0].source===scope.source
    &&same(cad.compiledAssets[0].model,scope.model),'complete inspection Model differs from the original');
  const selected=createCadGeometryReference(cad,{bodyId:'surface_body'});
  check(selected.source===scope.source&&selected.reference.geometryKind==='surface'
    &&selected.reference.geometryId===pin.ref.surfaceId&&same(selected.geometry,geometry),
  'inspection reference differs from the original Surface');
  const area=queryCadDocumentSurfaceArea(cad,selected.reference,settings);
  const report=validateCadDocumentSurfaceArea(cad,area);
  check(same(report,area.report),'validated complete native area report differs');
  const latest=readNativePointScope(viewer);
  check(latest.source===scope.source&&same(latest.model,scope.model)&&same(latest.refs,scope.refs)
    &&latest.selectedRef!==null&&same(latest.selectedRef,pin.ref),
  'original source or current Surface selection changed during area estimation');
  const output=snapshot({version:0,scope:pin,inspectionDocument:cad.document,reference:selected.reference,area,
    areaUnit:'mm2',coordinateFrame:'native-authored',certification:'not-certified'},profiles.output,'output');
  // Serialization is only a capacity check; the owned output retains original signed-zero bits.
  check(new TextEncoder().encode(JSON.stringify(output)).length<=16*1024*1024,
    'complete copied report exceeds16MiB JSON UTF8; no partial report is returned');
  return output;
}
