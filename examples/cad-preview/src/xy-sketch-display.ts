/** Host subset and display adapter for actual native Sketch0 profiles. */
import {evaluateXYSketchDocument,sampleCurveAdaptive} from '@barocss/cad';
import type {XYSketchDocumentResult,XYSketchDocumentV0,XYSketchProfileIntent,XYPoint} from '@barocss/cad';
import type {PrimitiveSceneInputV2,PrimitiveSceneOptions} from '@barocss/gpu';
export const XY_SKETCH_MM_SCALE=.025;
export function admitXYSketchHost(document:XYSketchDocumentV0):XYSketchDocumentResult{
 const result=evaluateXYSketchDocument(document);
 if(result.profiles.length>2)throw Error('This workspace displays at most two original profiles; no data were truncated');
 for(const profile of result.document.profiles){
  if(profile.kind==='polyline'&&(profile.points.length<3||profile.points.length>12))throw Error('This workspace supports3..12 authored polyline points');
  if(profile.kind==='rectangle'&&(profile.widthMM>600||profile.heightMM>600))throw Error('Rectangle size exceeds the600mm host limit');
  const evaluated=result.profiles.find(p=>p.profileId===profile.id)!;
  if(evaluated.evaluation.curve.controlPoints.some(p=>Math.abs(p[0])>300||Math.abs(p[1])>300||p[2]!==0))throw Error('All original XY points/corners must remain within±300mm');
 }
 return result;
}
export function xySketchPrimitiveInput(result:XYSketchDocumentResult):PrimitiveSceneInputV2{
 if(!result.profiles.length)throw Error('Empty native Sketch uses explicit viewport.clear');
 return{version:2,entries:result.profiles.map((profile,index)=>({kind:'curve',sampleVersion:0,sample:sampleCurveAdaptive(profile.evaluation.curve,{chordToleranceMM:.01,maxSegments:64,maxDepth:4,resultIdPrefix:'sketch_sample_'+index}),basis:'authored-xyz-matches-rhyup',ref:{modelId:result.document.id,geometryId:profile.evaluation.curve.id},transform:{translationMm:[0,0,0],rotationXYZW:[-Math.SQRT1_2,0,0,Math.SQRT1_2],scale:[1,1,1]},color:index===0?[.96,.67,.28]:[.36,.8,.94]}))};
}
export function xySketchPoints(profile:XYSketchProfileIntent):XYPoint[]{
 if(profile.kind!=='rectangle')return profile.points.map(p=>[...p.xy]);
 const[x,y]=profile.originMM,w=profile.widthMM,h=profile.heightMM;return[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
}
export function xySketchFit(result:XYSketchDocumentResult,options:PrimitiveSceneOptions,aspect:number):PrimitiveSceneOptions{
 const points=result.document.profiles.flatMap(xySketchPoints);if(!points.length)return options;
 const min=[0,1].map(axis=>Math.min(...points.map(p=>p[axis]))),max=[0,1].map(axis=>Math.max(...points.map(p=>p[axis]))),target:[number,number,number]=[(min[0]+max[0])*XY_SKETCH_MM_SCALE/2,0,-(min[1]+max[1])*XY_SKETCH_MM_SCALE/2],radius=Math.hypot(max[0]-min[0],max[1]-min[1])*XY_SKETCH_MM_SCALE/2,halfY=Math.PI/8,halfX=Math.atan(Math.tan(halfY)*aspect),distance=Math.max(2,radius/Math.sin(Math.min(halfX,halfY))*1.3);
 return{...options,camera:{eye:[target[0],distance,target[2]],target,up:[0,0,-1],fovYDegrees:45,near:.01,far:1000}};
}
