import {compileCadModel,evaluateSurfaceD1} from '@barocss/cad';
import {areaPin} from './surface-area.js';

const qualification=['sourceId','expectedSource','faceId','modelId','surfaceId'];
const fields=[...qualification,'u','v'];
const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face normal angle: '+message);};
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&sameBits(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function parameter(value,name){check(typeof value==='number'&&Number.isFinite(value),name+' must be a finite original parameter');return value;}
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
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face normal angle: pin cannot be copied',{cause});}
  return pin;
}
function originalSurface(scene,pin){
  const current=areaPin(scene,pin.sourceId);
  check(qualification.every(key=>Object.is(pin[key],current[key])),
    'pin differs from the current original source/Face/Model/Surface');
  const asset=scene.assets.find(value=>value.sourceId===pin.sourceId);
  const compiled=compileCadModel(pin.expectedSource,{sourceVersion:0});
  if(!compiled.ok)throw new RangeError('Qualified Face normal angle: complete original Source0 compilation refused',
    {cause:compiled.diagnostics});
  check(compiled.model.version===0&&compiled.model.lengthUnit==='mm'&&compiled.model.objects.length===5
    &&sameBits(compiled.model,asset.face.geometry),'complete original source Model does not bit-match the current Face geometry');
  const surface=compiled.model.objects.find(value=>value.kind==='surface'&&value.id===pin.surfaceId);
  check(surface&&surface.id===asset.face.topology.face.surfaceId,'compiled original Face Surface is missing');return surface;
}
function finite(value,label){check(Number.isFinite(value),label+' is not finite');return value;}
function normalize(vector,label){
  check(vector.every(Number.isFinite),label+' contains a nonfinite component');
  const norm=finite(Math.hypot(...vector),label+' norm');check(norm>0,label+' has represented zero norm');
  const unit=vector.map(value=>{
    const normalized=finite(value/norm,label+' normalized component');
    check(value===0||normalized!==0,label+' nonzero component collapsed during normalization');return normalized;
  });
  return{norm,unit};
}
function product(a,b){
  const value=finite(a*b,'normalized product');
  check(a===0||b===0||value!==0,'nonzero normalized factors produced represented zero');return value;
}
function cross(a,b){return[
  finite(product(a[1],b[2])-product(a[2],b[1]),'cross X'),
  finite(product(a[2],b[0])-product(a[0],b[2]),'cross Y'),
  finite(product(a[0],b[1])-product(a[1],b[0]),'cross Z')];}
function normal(pin,derivatives){
  const du=normalize(derivatives.du,'original Du'),dv=normalize(derivatives.dv,'original Dv');
  const parameterCross=cross(du.unit,dv.unit),normalized=normalize(parameterCross,'Surface parameter cross');
  return{pin,derivatives,duNormMM:du.norm,dvNormMM:dv.norm,unitDu:du.unit,unitDv:dv.unit,
    parameterCross,crossNorm:normalized.norm,unitNormal:normalized.unit};
}
export function normalAnglePin(scene,sourceId,u=.5,v=.5){
  parameter(u,'u');parameter(v,'v');return{...areaPin(scene,sourceId),u,v};
}
export function queryQualifiedFaceNormalAngle(scene,firstInput,secondInput){
  const firstPin=parsePin(firstInput),secondPin=parsePin(secondInput);
  const firstSurface=originalSurface(scene,firstPin),secondSurface=originalSurface(scene,secondPin);
  const firstDerivatives=evaluateSurfaceD1(firstSurface,firstPin.u,firstPin.v);
  const secondDerivatives=evaluateSurfaceD1(secondSurface,secondPin.u,secondPin.v);
  const first=normal(firstPin,firstDerivatives),second=normal(secondPin,secondDerivatives);
  const a=first.unitNormal,b=second.unitNormal,crossNormals=cross(a,b);
  const dot=finite(finite(product(a[0],b[0])+product(a[1],b[1]),'dot partial sum')+product(a[2],b[2]),'dot sum');
  const angleRadians=finite(Math.atan2(finite(Math.hypot(...crossNormals),'normal-pair cross norm'),dot),'angle radians');
  const angleDegrees=finite(angleRadians*180/Math.PI,'angle degrees');
  check(angleRadians>=0&&angleRadians<=Math.PI&&angleDegrees>=0&&angleDegrees<=180,'unsigned angle exceeds its declared range');
  const anchor={kind:'surface',sourceId:firstPin.sourceId,expectedSource:firstPin.expectedSource,faceId:firstPin.faceId,
    modelId:firstPin.modelId,geometryId:firstPin.surfaceId,u:firstPin.u,v:firstPin.v};
  return structuredClone({version:0,first,second,angleRadians,angleDegrees,
    metric:'unsigned-native-parameter-normal-angle',basis:'authored-xyz-matches-rhyup',certification:'not-certified',anchor});
}
