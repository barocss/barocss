import {compileCadModel,evaluateSurfaceCurvature} from '@barocss/cad';
import {areaPin} from './surface-area.js';

const qualification=['sourceId','expectedSource','faceId','modelId','surfaceId'];
const fields=[...qualification,'u','v'];
const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face Surface curvature: '+message);};
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&sameBits(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function parameter(value,name){
  check(typeof value==='number'&&Number.isFinite(value),name+' must be a finite original parameter');return value;
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
  parameter(pin.u,'u');parameter(pin.v,'v');
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face Surface curvature: pin cannot be copied',{cause});}
  return pin;
}
export function surfaceCurvaturePin(scene,sourceId,u=.5,v=.5){
  parameter(u,'u');parameter(v,'v');return{...areaPin(scene,sourceId),u,v};
}
export function queryQualifiedFaceSurfaceCurvature(scene,input){
  const pin=parsePin(input),current=areaPin(scene,pin.sourceId);
  check(qualification.every(key=>Object.is(pin[key],current[key])),
    'pin differs from the current original source/Face/Model/Surface');
  const asset=scene.assets.find(value=>value.sourceId===pin.sourceId);
  const compiled=compileCadModel(pin.expectedSource,{sourceVersion:0});
  if(!compiled.ok)throw new RangeError('Qualified Face Surface curvature: complete original Source0 compilation refused',
    {cause:compiled.diagnostics});
  check(compiled.model.version===0&&compiled.model.lengthUnit==='mm'&&compiled.model.objects.length===5
    &&sameBits(compiled.model,asset.face.geometry),'complete original source Model does not bit-match the current Face geometry');
  const surface=compiled.model.objects.find(value=>value.kind==='surface'&&value.id===pin.surfaceId);
  check(surface&&surface.id===asset.face.topology.face.surfaceId,'compiled original Face Surface is missing');
  const curvature=evaluateSurfaceCurvature(surface,pin.u,pin.v);
  const anchor={kind:'surface',sourceId:pin.sourceId,expectedSource:pin.expectedSource,faceId:pin.faceId,
    modelId:pin.modelId,geometryId:pin.surfaceId,u:pin.u,v:pin.v};
  return structuredClone({version:0,pin,curvature,anchor});
}
