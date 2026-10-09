import {compileCadModel,sampleCurve} from '@barocss/cad';
import type {Curve,Model,Point} from '@barocss/cad';
import {freezeGpuData,ownRecord} from './gpu-data.js';

export type UniformCurvePreviewDiagnosticCode='INPUT'|'BUDGET'|'SOURCE'|'PROFILE'|'NATIVE'|'RECONSTRUCTION';
export class UniformCurvePreviewError extends Error {
 readonly code:UniformCurvePreviewDiagnosticCode;
 constructor(code:UniformCurvePreviewDiagnosticCode,message:string,cause?:unknown){
  super(message,cause===undefined?undefined:{cause});this.name='UniformCurvePreviewError';this.code=code;
 }
}
export interface UniformCurvePreviewInput {source:string;count:number}
/** Original source/native authority plus explicitly nonadaptive derived observations. */
export interface UniformCurvePreview {
 format:'barocss-gpu-uniform-curve-preview';version:0;profile:'native-uniform-curve-v0';sourceVersion:0;
 source:string;model:Model;count:number;parameters:number[];pointsMM:Point[];
}
function requireData(value:unknown,code:UniformCurvePreviewDiagnosticCode,message:string):asserts value {
 if(!value)throw new UniformCurvePreviewError(code,message);
}
function fields(value:unknown,keys:string[]):Record<string,unknown>{
 try{return ownRecord(value,keys);}catch(cause){throw new UniformCurvePreviewError('INPUT','Uniform Curve requires exact own data fields',cause);}
}
/** Bound reflection and copying before native compilation or evaluation. */
function snapshot(input:unknown):unknown {
 let values=8192;const active=new WeakSet<object>();
 const copy=(value:unknown,depth:number):unknown=>{
  requireData(--values>=0&&depth<=24,'BUDGET','Uniform Curve data exceed value/depth limits');
  if(typeof value==='number'){requireData(Number.isFinite(value),'INPUT','Uniform Curve numbers must be finite');return value;}
  if(typeof value==='string'){requireData(value.length<=65536,'BUDGET','Uniform Curve strings exceed limit');return value;}
  requireData(value!==null&&typeof value==='object'&&!active.has(value),'INPUT','Uniform Curve requires acyclic plain records and arrays');
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value);
  requireData(array?proto===Array.prototype:proto===Object.prototype||proto===null,'INPUT','Uniform Curve data have a foreign prototype');
  requireData(keys.length<=(array?257:16),'BUDGET','Uniform Curve has excessive fields');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  requireData(keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable)),'INPUT','Uniform Curve has accessors, hidden or symbolic fields');
  active.add(value);let result:unknown;
  if(array){
   const length=descriptors.length.value;
   requireData(Number.isInteger(length)&&length>=0&&length<=256,'BUDGET','Uniform Curve arrays exceed capacity');
   requireData(keys.length===length+1,'INPUT','Uniform Curve arrays must be dense');
   result=Array.from({length},(_,i)=>{requireData(Object.hasOwn(descriptors,String(i)),'INPUT','Uniform Curve arrays must be dense');return copy(descriptors[String(i)].value,depth+1);});
  }else result=Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));
  active.delete(value);return result;
 };return copy(input,0);
}
/** Compile original Source0 and evaluate the existing native uniform sampler once. */
export function prepareUniformCurvePreview(input:UniformCurvePreviewInput):UniformCurvePreview {
 const request=fields(input,['source','count']);
 requireData(typeof request.source==='string','INPUT','Uniform Curve source must be a string');
 requireData(request.source.length<=65536&&new TextEncoder().encode(request.source).length<=65536,'BUDGET','Uniform Curve source exceeds 65536 bytes/code units');
 requireData(typeof request.count==='number'&&Number.isInteger(request.count),'INPUT','Uniform Curve count must be an integer');
 requireData(request.count>=2&&request.count<=129,'BUDGET','Uniform Curve count must be2..129');
 try{
  const compiled=compileCadModel(request.source,{sourceVersion:0});
  if(!compiled.ok)throw new UniformCurvePreviewError('SOURCE','Uniform Curve Source0 compilation failed',freezeGpuData(compiled.diagnostics));
  const model=compiled.model;
  requireData(model.version===0&&model.lengthUnit==='mm'&&model.objects.length===1&&model.objects[0].kind==='curve','PROFILE','Uniform Curve requires one original Curve in Model0/mm');
  const curve=model.objects[0] as Curve,identity=/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
  requireData(identity.test(model.name)&&identity.test(curve.id),'PROFILE','Uniform Curve model and geometry IDs require ASCII1..128');
  requireData(curve.degree>=1&&curve.degree<=5&&curve.controlPoints.length>=2&&curve.controlPoints.length<=64&&curve.knots.length<=70,'PROFILE','Uniform Curve exceeds native degree/pole/knot capacity');
  const samples=sampleCurve(curve,request.count);
  requireData(samples.length===request.count&&samples.every(s=>Number.isFinite(s.parameter)&&s.point.every(Number.isFinite)),'NATIVE','Uniform Curve native observations must be finite and complete');
  return freezeGpuData({format:'barocss-gpu-uniform-curve-preview',version:0,profile:'native-uniform-curve-v0',sourceVersion:0,source:request.source,model,count:request.count,parameters:samples.map(s=>s.parameter),pointsMM:samples.map(s=>[...s.point] as Point)});
 }catch(cause){if(cause instanceof UniformCurvePreviewError)throw cause;throw new UniformCurvePreviewError('NATIVE','Uniform Curve native preparation failed',cause);}
}
/** Equality of owned complete data; number comparisons retain signed zero. */
function matches(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const left=Object.keys(a),right=Object.keys(b);
 return left.length===right.length&&left.every(k=>Object.hasOwn(b,k)&&matches((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
/** Reconstruct all source, native and derived fields; return a new frozen DTO. */
export function validateUniformCurvePreview(input:unknown):UniformCurvePreview {
 const owned=fields(snapshot(input),['format','version','profile','sourceVersion','source','model','count','parameters','pointsMM']);
 requireData(owned.format==='barocss-gpu-uniform-curve-preview'&&owned.version===0&&owned.profile==='native-uniform-curve-v0'&&owned.sourceVersion===0,'PROFILE','Unsupported uniform Curve format/version/profile');
 const rebuilt=prepareUniformCurvePreview({source:owned.source as string,count:owned.count as number});
 requireData(matches(owned,rebuilt),'RECONSTRUCTION','Uniform Curve data do not match original source and uniform observations');
 return rebuilt;
}
