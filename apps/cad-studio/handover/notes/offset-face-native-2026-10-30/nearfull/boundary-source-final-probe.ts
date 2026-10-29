import {writeFileSync} from 'node:fs';
import {checkBrep,brepMassProperties} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad/src/index.ts';
import {rectanglePart,cylinderPart,withNode} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/doc.ts';
import {evaluateDoc,partBreps} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/engine/evaluate.ts';
import {resolveNativeOffsetFace,validateNativeOffsetDistance} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/nativeOffsetFace.ts';
import {offsetFaceCommand} from '/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/packages/barocss-cad-model/src/app/profileCommands.ts';
const results=[];
for(const kind of ['box','circle-z','circle-x','circle-y']){
 const seed=kind==='box'?rectanglePart(20.00003,10.00007,5.00009):cylinderPart(3,5.00009);
 let source=seed,parent=1;
 if(kind==='circle-x'||kind==='circle-y'){source=withNode(seed,{kind:'rotate',parent:{node:1,side:'solid'},axis:kind==='circle-x'?'x':'y',angle:90});parent=2;}
 const doc=withNode(source,{kind:'translate',parent:{node:parent,side:'solid'},offset:[.1234567,-.2345678,.3456789]});const evaluated=evaluateDoc(doc,1);if(!evaluated.ok)throw Error(JSON.stringify(evaluated));
 for(let face=0;face<evaluated.bodies[0].mesh.faces.length;face++){
  if(evaluated.bodies[0].mesh.faces[face].kind!=='plane')continue;
  const ctx={doc,bodies:evaluated.bodies,selection:{faces:[{body:0,face}],edges:[],bodies:[]}},p=resolveNativeOffsetFace(ctx);
  for(const retained of [0,.001]){const distance=-Math.abs(p.coordinate-p.opposite)+retained,next=p.coordinate+p.sign*distance,record={kind,face,axis:p.axis,sign:p.sign,coordinate:p.coordinate,opposite:p.opposite,distance,next,positiveStoredGap:p.sign*(next-p.opposite),retained};
   try{validateNativeOffsetDistance(p,distance);const candidate=offsetFaceCommand.build(ctx,{d:distance}),out=evaluateDoc(candidate,2);Object.assign(record,{status:'SUCCESS',evaluation:out.ok?out.bodies.map(b=>({volume:b.volume,centroid:b.centroid})):out});if(out.ok)Object.assign(record,{native:partBreps(candidate).map(x=>({mass:brepMassProperties(x.brep,1),check:checkBrep(x.brep,{strict:true}),vertices:x.brep.vertices}))});}catch(e){Object.assign(record,{status:'REFUSED',error:{message:e.message,code:e.code,details:e.details}});}results.push(record);
  }
 }
}
writeFileSync('/tmp/d342-nearfull/boundary-source-final-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
