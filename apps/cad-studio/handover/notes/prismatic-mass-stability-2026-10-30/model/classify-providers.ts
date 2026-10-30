import { writeFileSync } from 'node:fs';
import { massPropertiesOf, brepMassProperties, checkBrep } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/index.ts';
import { cylinderPart, withNode } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts';
import { evaluateDoc, partBreps } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
import { partSnapshot } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/part.ts';
import { part } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/api/index.ts';
import { resolveNativeOffsetFace, validateNativeOffsetDistance } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/nativeOffsetFace.ts';
import { offsetFaceCommand } from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/profileCommands.ts';
const results=[];
for(const [axis,rotation,angle] of [[0,'y',90],[1,'x',-90],[2,'z',0]] as const){
 const rotated=withNode(cylinderPart(3,5.00009),{kind:'rotate',parent:{node:1,side:'solid'},axis:rotation,angle}),doc=withNode(rotated,{kind:'translate',parent:{node:2,side:'solid'},offset:[.1234567,-.2345678,.3456789]}),before=JSON.stringify(doc);
 const row:any={axis,rotation,angle,status:'NOT_CLASSIFIED',scope:axis===2?'Z-upright repaired provider control':'Other provider/admission classification only; no longitudinal repair acceptance claim'};let phase='source-evaluate';
 try{
  const view=evaluateDoc(doc,0);if(!view.ok)throw view.error;
  const face=view.bodies[0].mesh.faces.findIndex(f=>f.kind==='plane'&&f.normal[axis]>.999999),ctx={doc,bodies:view.bodies,selection:{faces:[{body:0,face}],edges:[],bodies:[]}};
  row.selected=view.bodies[0].mesh.faces[face];const source=partBreps(doc)[0].brep;row.sourceNative=source;
  row.selectedNativeNormalCoefficients=source.faces.filter(f=>row.selected.name.split('+').includes(f.name)).map(f=>({name:f.name,values:f.surface.kind==='surface'?[...new Set(f.surface.controlPoints.flat().map(p=>p[axis]))]:null}));
  phase='resolve-profile';const profile=resolveNativeOffsetFace(ctx);row.profile={axis:profile.axis,sign:profile.sign,coordinate:profile.coordinate,opposite:profile.opposite};const distance=-Math.abs(profile.coordinate-profile.opposite);row.distance=distance;row.storedRequestedCoordinate=profile.coordinate+profile.sign*distance;
  phase='guard';validateNativeOffsetDistance(profile,distance);row.guard='ACCEPTED';
  phase='composition';const output=offsetFaceCommand.build!(ctx,{d:distance});row.outputRecipe=output;const nativeOutputs=partBreps(output);row.nativeOutputCount=nativeOutputs.length;if(nativeOutputs.length!==1){row.status='COMPOSITION_RETURNED_EMPTY_NATIVE_OUTPUT';row.model=evaluateDoc(output,1);row.inputUnchanged=JSON.stringify(doc)===before;results.push(row);continue;}const b=nativeOutputs[0].brep;row.outputNative=b;row.strict=checkBrep(b,{strict:true});row.outputLevels=[Math.min(...b.vertices.map(v=>v.point[axis])),Math.max(...b.vertices.map(v=>v.point[axis]))];
  phase='actual-providers';const snapshot=partSnapshot(output);row.kernel={representation:snapshot.outputs[0].representation,mass:massPropertiesOf(snapshot.outputs[0],1)};const model=evaluateDoc(output,1);row.model=model.ok?{volume:model.bodies[0].volume,centroid:model.bodies[0].centroid}:model;const facade=part('provider classification',output);row.public=facade.body(facade.bodies()[0]).mass({density:1});
  try{row.nativeQuadrature=brepMassProperties(b,1);}catch(error){row.nativeQuadrature={error:String(error)};}row.status='ACTUAL_COMPOSITION_RETURNED';
 }catch(error:any){row.status='REFUSED';row.error={phase,code:error?.code,message:error?.message??String(error)};}
 row.inputUnchanged=JSON.stringify(doc)===before;results.push(row);
}
writeFileSync('/tmp/d343-model/provider-classifications.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({axis,status,error,guard,kernel,outputLevels,inputUnchanged})=>({axis,status,error,guard,kernel,outputLevels,inputUnchanged})),null,2));
