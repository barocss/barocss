import {compileCadModel,evaluateCurveD1} from '@barocss/cad';
import {lengthPin} from './curve-length.js';

const qualification=['sourceId','expectedSource','faceId','modelId','curveId'];
const fields=[...qualification,'t'];
const check=(value,message)=>{if(!value)throw new RangeError('Qualified Face tangent angle: '+message);};
function sameBits(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
  return keys.length===other.length&&keys.every(key=>other.includes(key)
    &&sameBits(Object.getOwnPropertyDescriptor(a,key)?.value,Object.getOwnPropertyDescriptor(b,key)?.value));
}
function parameter(t){check(typeof t==='number'&&Number.isFinite(t),'t must be a finite original parameter');return t;}
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
  parameter(pin.t);
  try{structuredClone(input);}catch(cause){throw new RangeError('Qualified Face tangent angle: pin cannot be copied',{cause});}
  return pin;
}
function originalCurve(scene,pin){
  const current=lengthPin(scene,pin.sourceId,pin.curveId);
  check(qualification.every(key=>Object.is(pin[key],current[key])),
    'pin differs from the current original source/Face/Model/Curve');
  const asset=scene.assets.find(value=>value.sourceId===pin.sourceId);
  const compiled=compileCadModel(pin.expectedSource,{sourceVersion:0});
  if(!compiled.ok)throw new RangeError('Qualified Face tangent angle: complete original Source0 compilation refused',
    {cause:compiled.diagnostics});
  check(compiled.model.version===0&&compiled.model.lengthUnit==='mm'&&compiled.model.objects.length===5
    &&sameBits(compiled.model,asset.face.geometry),'complete original source Model does not bit-match the current Face geometry');
  const curve=compiled.model.objects.find(value=>value.kind==='curve'&&value.id===pin.curveId);
  check(curve,'compiled original Curve is missing');return curve;
}
function finite(value,label){check(Number.isFinite(value),label+' is not finite');return value;}
function tangent(pin,derivatives){
  check(derivatives.derivative.every(Number.isFinite),'original derivative contains a nonfinite component');
  const tangentNormMM=finite(Math.hypot(...derivatives.derivative),'original derivative norm');
  check(tangentNormMM>0,'original derivative has represented zero norm');
  const unitTangent=derivatives.derivative.map(value=>{
    const normalized=finite(value/tangentNormMM,'normalized tangent component');
    check(value===0||normalized!==0,'nonzero original derivative component collapsed during normalization');return normalized;
  });
  return{pin,derivatives,tangentNormMM,unitTangent};
}
function product(a,b){
  const value=finite(a*b,'normalized product');
  check(a===0||b===0||value!==0,'nonzero normalized factors produced represented zero');return value;
}
export function tangentAnglePin(scene,sourceId,curveId,t=.5){
  parameter(t);return{...lengthPin(scene,sourceId,curveId),t};
}
export function queryQualifiedFaceTangentAngle(scene,firstInput,secondInput){
  const firstPin=parsePin(firstInput),secondPin=parsePin(secondInput);
  const firstCurve=originalCurve(scene,firstPin),secondCurve=originalCurve(scene,secondPin);
  const firstDerivatives=evaluateCurveD1(firstCurve,firstPin.t);
  const secondDerivatives=evaluateCurveD1(secondCurve,secondPin.t);
  const first=tangent(firstPin,firstDerivatives),second=tangent(secondPin,secondDerivatives);
  const a=first.unitTangent,b=second.unitTangent;
  const cross=[finite(product(a[1],b[2])-product(a[2],b[1]),'cross X'),
    finite(product(a[2],b[0])-product(a[0],b[2]),'cross Y'),
    finite(product(a[0],b[1])-product(a[1],b[0]),'cross Z')];
  const dot=finite(finite(product(a[0],b[0])+product(a[1],b[1]),'dot partial sum')+product(a[2],b[2]),'dot sum');
  const angleRadians=finite(Math.atan2(finite(Math.hypot(...cross),'cross norm'),dot),'angle radians');
  const angleDegrees=finite(angleRadians*180/Math.PI,'angle degrees');
  check(angleRadians>=0&&angleRadians<=Math.PI&&angleDegrees>=0&&angleDegrees<=180,'unsigned angle exceeds its declared range');
  const anchor={kind:'curve',sourceId:firstPin.sourceId,expectedSource:firstPin.expectedSource,faceId:firstPin.faceId,
    modelId:firstPin.modelId,geometryId:firstPin.curveId,t:firstPin.t};
  return structuredClone({version:0,first,second,angleRadians,angleDegrees,
    metric:'unsigned-native-tangent-angle',basis:'authored-xyz-matches-rhyup',certification:'not-certified',anchor});
}
