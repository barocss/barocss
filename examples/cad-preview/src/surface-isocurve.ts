import {extractSurfaceIsoCurve,compileCadModel,curveDomain,evaluateCurve} from '@barocss/cad';
import type {Surface,SurfaceIsoCurveOptions,SurfaceIsoCurveResult} from '@barocss/cad';
import type {MeshEdgeOverlay} from '@barocss/gpu';
import {transformPoint} from './scene-transform';
import type {Placement,Vec3} from './scene-transform';
import {nativeToPreview} from './scene-display';
export type {SurfaceIsoCurveOptions,SurfaceIsoCurveResult} from '@barocss/cad';
/** Matches the private editor's fixed display scale and zero display translation. */
export const ISOCURVE_SCENE_MM_SCALE=.035;
export interface SurfaceIsocurveSample {parameter:number;uv:[number,number];local:Vec3;world:Vec3;preview:Vec3}
export interface SurfaceIsocurveDisplay {result:SurfaceIsoCurveResult;samples:SurfaceIsocurveSample[];paths:MeshEdgeOverlay['paths'];bounds:{min:Vec3;max:Vec3}}
function requireValue(condition:unknown,message:string):asserts condition {if(!condition)throw Error('Parameter curve: '+message);}
function sameData(a:unknown,b:unknown):boolean {
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>sameData(value,b[i]));
 if(a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'){const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&sameData(left[key],right[key]));}
 return Object.is(a,b);
}
/** Retain actual endpoint bits and increasing original breaks, with no snapping. */
function sampleParameters(knots:number[],domain:[number,number]):number[] {
 const [first,last]=domain,breaks=[first];
 for(const knot of knots)if(knot>first&&knot<last&&knot!==breaks[breaks.length-1])breaks.push(knot);
 breaks.push(last);const parameters=[first];
 for(let i=1;i<breaks.length;i++){
  const a=breaks[i-1],b=breaks[i],delta=b-a;
  requireValue(b>a,'original varying knot spans must increase');
  for(const fraction of [.25,.5,.75]){
   const value=Number.isFinite(delta)?a+delta*fraction:a*(1-fraction)+b*fraction;
   requireValue(Number.isFinite(value)&&value>a&&value<b&&value>parameters[parameters.length-1],'span interiors are not distinctly representable; sampling refused');
   parameters.push(value);
  }
  parameters.push(b);requireValue(parameters.length<=64,'sample count exceeds64');
 }
 return parameters;
}
/** Native621 inspection data, not scene geometry, topology, or a persistent Curve intent. */
export function buildSurfaceIsocurve(surface:Surface,placement:Placement,options:SurfaceIsoCurveOptions):SurfaceIsocurveDisplay {
 const result=extractSurfaceIsoCurve(surface,options),compiled=compileCadModel(result.source,{sourceVersion:result.sourceVersion});
 requireValue(compiled.ok,'actual Curve source0 compiler refused');
 requireValue(compiled.constructions.length===0&&sameData(compiled.model,result.model),'actual Curve source0 adoption changed native coefficients/IDs/knots/order/signed zero');
 const parameters=sampleParameters(result.curve.knots,curveDomain(result.curve)),bounds:{min:Vec3;max:Vec3}={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},samples:SurfaceIsocurveSample[]=[];
 let previousFloat:Vec3|undefined;
 for(const parameter of parameters){
  const local=evaluateCurve(result.curve,parameter),world=transformPoint(local,placement),preview=nativeToPreview(world),converted=preview.map(value=>value*ISOCURVE_SCENE_MM_SCALE);
  requireValue(converted.every(value=>Number.isFinite(value)&&Math.abs(value)<=1000),'converted sample exceeds the editor scene limits');
  const floats=converted.map(Math.fround) as Vec3,previous=samples[samples.length-1];
  requireValue(!previous||local.some((value,axis)=>value!==previous.local[axis]),'consecutive native samples coincide');
  requireValue(!previous||preview.some((value,axis)=>value!==previous.preview[axis]),'transformed consecutive samples coincide');
  requireValue(!previousFloat||floats.some((value,axis)=>value!==previousFloat![axis]),'consecutive Float32 samples collapse');
  const uv:[number,number]=result.provenance.fixedAxis==='u'?[result.provenance.parameter,parameter]:[parameter,result.provenance.parameter];
  samples.push({parameter,uv,local,world,preview});previousFloat=floats;
  for(let axis=0;axis<3;axis++){bounds.min[axis]=Math.min(bounds.min[axis],preview[axis]);bounds.max[axis]=Math.max(bounds.max[axis],preview[axis]);}
 }
 // Alternate real consecutive sample segments. Check every segment above,
 // including gaps; always retain the terminal segment and both endpoints.
 const paths:MeshEdgeOverlay['paths']=[];
 for(let i=0;i<samples.length-1;i++)if(i%2===0||i===samples.length-2)paths.push({id:result.curve.id+'_dash_'+i,points:[[...samples[i].preview],[...samples[i+1].preview]]});
 return {result,samples,paths,bounds};
}
