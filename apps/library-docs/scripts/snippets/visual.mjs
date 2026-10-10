import { compileCadModel, evaluateCurve, curveDomain, evaluateSurface, tessellateSurface } from '@barocss/cad';
import { mountScene, mountMesh, compileMeshMaterial } from '@barocss/gpu';
export const presets = {
  scene: { title:'GPU scene · rotated box and sphere', language:'GPU scene source1', source:`@scene shapes {
  version: 1;
  background: #101820;
  sphere #ball;
  box #block;
}
sphere { radius: .65; color: #F1AA55; }
#ball { translate: -1.1 0 0; }
#block {
  size: 1 1.5 .8;
  translate: 1 0 0;
  rotate-x: 20deg;
  rotate-y: 35deg;
  rotate-z: -10deg;
  color: #57B4D9;
}` },
  curve: {title:'CAD curve · rational quarter circle',language:'CAD source0',source:`@model arc {
  version: 0;
  length-unit: mm;
  @curve #quarter {
    type: nurbs;
    degree: 2;
    knots: [0,0,0,1,1,1];
    control-points: [[20,0,0],[20,20,0],[0,20,0]];
    weights: [1,0.7071067811865476,1];
  }
}` },
  surface: {title:'CAD surface · weighted NURBS patch',language:'CAD source0 → GPU mesh',source:`@model patch {
  version: 0;
  length-unit: mm;
  @surface #weighted {
    type: nurbs;
    degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[1,7,3]],[[9,2,4],[12,8,-2]]];
    weights: [[1,2],[3,4]];
  }
}` },
  material: {title:'GPU material · host-controlled blend',language:'Opaque mesh fragment profile0',source:`@shader #blend {
  @uniform amount: float(0,1,0);
  @let ratio: float(smoothstep(0,1,amount));
  @fragment {
    color: mix(#2060D0,#F09030,ratio);
  }
}` }
};
const options={mmToSceneUnit:.12,translate:[-.7,-.45,0],color:[.22,.65,.85],background:[.063,.094,.125],camera:{eye:[2,1.6,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}};
function surfaceData(source){const result=compileCadModel(source,{sourceVersion:0});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));const object=result.model.objects.find(o=>o.kind==='surface');if(!object)throw Error('Expected a Surface');const mesh=tessellateSurface(object,{countU:17,countV:17,revision:0});return{...mesh,centerMM:evaluateSurface(object,.5,.5)};}
function samplingGrid(packet){
 const point=(u,v)=>packet.positions.slice((u*17+v)*3,(u*17+v)*3+3);
 return {version:0,packet,color:[.65,.85,.95],paths:[...Array.from({length:17},(_,u)=>({id:'row_'+u,points:Array.from({length:17},(_,v)=>point(u,v))})),...Array.from({length:17},(_,v)=>({id:'column_'+v,points:Array.from({length:17},(_,u)=>point(u,v))}))]};
}
export function createExample(canvas,kind,source){
 if(kind==='scene'){
  const renderer=mountScene(canvas,source,undefined,{sourceVersion:1});
  return{dispose:()=>renderer.dispose(),update(text){const result=renderer.update(text);if(!result.ok)throw result.error;return this.report();},report:()=>({sourceVersion:1,objects:renderer.scene.objects.map(o=>({id:o.id,type:o.type,translate:o.translate,rotateDegrees:o.rotateDegrees})),backend:'WebGL2 SDF'})};
 }
 if(kind==='curve'){
  const context=canvas.getContext('2d');if(!context)throw Error('Canvas2D unavailable');
  const controller={dispose(){},update(text){const result=compileCadModel(text,{sourceVersion:0});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));const curve=result.model.objects.find(o=>o.kind==='curve');if(!curve)throw Error('Expected a Curve');const [a,b]=curveDomain(curve);const points=Array.from({length:101},(_,i)=>evaluateCurve(curve,a+(b-a)*i/100));const all=[...points,...curve.controlPoints];const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),xmin=Math.min(0,...xs),ymin=Math.min(0,...ys),span=Math.max(Math.max(...xs)-xmin,Math.max(...ys)-ymin,1),scale=(canvas.height-110)/span;const project=p=>[90+(p[0]-xmin)*scale,canvas.height-60-(p[1]-ymin)*scale];context.fillStyle='#101820';context.fillRect(0,0,canvas.width,canvas.height);context.strokeStyle='#425267';context.lineWidth=1;context.beginPath();context.moveTo(90,35);context.lineTo(90,canvas.height-60);context.lineTo(canvas.width-35,canvas.height-60);context.stroke();context.setLineDash([6,5]);context.strokeStyle='#8093AA';context.beginPath();curve.controlPoints.forEach((p,i)=>{const[x,y]=project(p);i?context.lineTo(x,y):context.moveTo(x,y);});context.stroke();context.setLineDash([]);context.strokeStyle='#5ED6E0';context.lineWidth=4;context.beginPath();points.forEach((p,i)=>{const[x,y]=project(p);i?context.lineTo(x,y):context.moveTo(x,y);});context.stroke();context.font='14px sans-serif';curve.controlPoints.forEach((p,i)=>{const[x,y]=project(p);context.fillStyle='#F1AA55';context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.fill();context.fillText('P'+i+' ['+p.slice(0,2).join(',')+'] mm',x+9,y+18);});context.fillStyle='#D2E2ED';context.fillText('CYAN: evaluated curve  /  DASHED: control polygon',25,25);const mid=evaluateCurve(curve,(a+b)/2);this.value={backend:'CAD evaluation → host Canvas2D drawing',domain:[a,b],sampleCount:points.length,midpointMM:mid};return this.value;},report(){return this.value;}};controller.update(source);return controller;
 }
 const data=surfaceData(kind==='material'?presets.surface.source:source);
 const renderer=mountMesh(canvas,data.packet,options,kind==='surface'?samplingGrid(data.packet):null);
 let value={backend:'CAD sampling → WebGL2 mesh',centerMM:data.centerMM,vertices:data.report.vertexCount,triangles:data.report.triangleCount,maxSampledDeviationMM:data.report.maxSampledDeviationMM,certified:data.report.certified,mmToSceneUnit:options.mmToSceneUnit};
 const controller={dispose:()=>renderer.dispose(),report:()=>value,update(text){if(kind==='material'){const compiled=compileMeshMaterial(text);if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics));const result=renderer.setMaterial({material:compiled.material,uniforms:{amount:0}});if(!result.ok)throw result.error;this.material=compiled.material;value={...value,shaderId:compiled.material.shaderId,uniforms:{amount:0}};}else{const next=surfaceData(text),result=renderer.update(next.packet,options,samplingGrid(next.packet));if(!result.ok)throw result.error;value={...value,centerMM:next.centerMM,vertices:next.report.vertexCount,triangles:next.report.triangleCount,maxSampledDeviationMM:next.report.maxSampledDeviationMM};}return value;},setAmount(amount){const result=renderer.setMaterial({material:this.material,uniforms:{amount}});if(!result.ok)throw result.error;value={...value,uniforms:{amount}};return value;}};
 if(kind==='material'){try{controller.update(source);}catch(error){renderer.dispose();throw error;}}
 return controller;
}
