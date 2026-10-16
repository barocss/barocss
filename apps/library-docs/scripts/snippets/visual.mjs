/* global createViewerExample: readonly, createCanvas2DExample: readonly, createPhysicsExample: readonly */
// Build-time host bindings inserted by gallery-input.mjs at the host-factory marker.
import { compileCadModel, evaluateCurve, curveDomain, evaluateSurface, tessellateSurface } from '@barocss/cad';
import { createViewer, showScene, bindingShader, compileMeshMaterial, validateMeshMaterialBinding, SceneViewError } from '@barocss/gpu';
// DOCS_HOST_FACTORIES
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
// DOCS_GALLERY_PRESETS
for (const [key, preset] of Object.entries(presets)) {
 preset.kind ??= key;
 preset.label = preset.targetFunction ? preset.targetFunction+'()' : preset.label || {scene:'GPU scene',curve:'CAD curve',surface:'CAD surface',material:'GPU material'}[key];
 preset.anchor ??= {scene:'gpu-scene',curve:'cad-curve',surface:'cad-surface',material:'gpu-material'}[key] || key;
}
// Millimetres into scene units, the old mesh host's framing; the WebGPU viewer frames it on first show.
const options={mmToSceneUnit:.12,translate:[-.7,-.45,0],color:[.22,.65,.85],background:[.063,.094,.125]};
const camera={position:[2,1.6,3],target:[0,0,0],up:[0,1,0],fovY:45};
function surfaceData(source, sourceVersion=0){const result=compileCadModel(source,{sourceVersion});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));const object=result.model.objects.find(o=>o.kind==='surface');if(!object)throw Error('Expected a Surface');const mesh=tessellateSurface(object,{countU:17,countV:17,revision:0});return{...mesh,centerMM:evaluateSurface(object,.5,.5),sourceVersion,parameters:(result.ir.parameters || []).map(({id,value,unit})=>({id,value,unit}))};}
function fittedOptions(packet){
 const {min,max}=packet.bounds,scale=1.8/Math.max(...max.map((n,i)=>n-min[i]),1);
 return {...options,mmToSceneUnit:scale,translate:min.map((n,i)=>-(n+max[i])/2*scale)};
}
// Column-major: scale by mmToSceneUnit, then translate.
const placement=view=>{const s=view.mmToSceneUnit,[x,y,z]=view.translate;return[s,0,0,0,0,s,0,0,0,0,s,0,x,y,z,1];};
// The sampled 17 × 17 U/V grid as line segments over the packet's own vertices.
function samplingGrid(packet){
 const indices=[],at=(u,v)=>u*17+v;
 for(let u=0;u<17;u++)for(let v=0;v<16;v++)indices.push(at(u,v),at(u,v+1));
 for(let v=0;v<17;v++)for(let u=0;u<16;u++)indices.push(at(u,v),at(u+1,v));
 return{positions:packet.positions,indices,topology:'lines'};
}
function describeSceneObject(object) {
 const value={id:object.id,type:object.type,color:[...object.color],translate:[...object.translate],rotateDegrees:[...object.rotateDegrees]};
 if(['sphere','cylinder','capsule','rounded-box'].includes(object.type))value.radius=object.radius;
 if(['box','rounded-box'].includes(object.type))value.size=[...object.size];
 if(object.type==='cylinder')value.height=object.height;
 if(object.type==='capsule'){value.start=[...object.start];value.end=[...object.end];}
 if(object.type==='torus'){value.majorRadius=object.majorRadius;value.minorRadius=object.minorRadius;}
 return value;
}
export async function createExample(canvas,key,source){
 const preset=presets[key];if(!preset)throw Error('Unknown example');
 const kind=preset.kind;
 if(kind==='viewer')return createViewerExample(canvas,source);
 if(kind==='canvas2d')return createCanvas2DExample(canvas,source);
 if(kind==='physics')return createPhysicsExample(canvas,source);
 if(kind==='scene'){
  const viewer=await createViewer(canvas,{camera});
  let view;
  try{view=showScene(viewer,source);}catch(error){viewer.dispose();throw error;}
  const report=()=>({sourceVersion:view.result.execution.scene.version,objects:view.result.execution.scene.objects.map(describeSceneObject),meshes:view.meshes.size,backend:'WebGPU viewer · showScene'});
  return{dispose:()=>{view.dispose();viewer.dispose();},update(text){const result=view.update(text);if(!result.ok)throw new SceneViewError(result.diagnostics);return report();},report};
 }
 if(kind==='curve'){
  const context=canvas.getContext('2d');if(!context)throw Error('Canvas2D unavailable');
  const controller={dispose(){},update(text){const result=compileCadModel(text,{sourceVersion:0});if(!result.ok)throw Error(JSON.stringify(result.diagnostics));const curve=result.model.objects.find(o=>o.kind==='curve');if(!curve)throw Error('Expected a Curve');const [a,b]=curveDomain(curve);const points=Array.from({length:101},(_,i)=>evaluateCurve(curve,a+(b-a)*i/100));const all=[...points,...curve.controlPoints];const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]),xmin=Math.min(0,...xs),ymin=Math.min(0,...ys),span=Math.max(Math.max(...xs)-xmin,Math.max(...ys)-ymin,1),scale=(canvas.height-110)/span;const project=p=>[90+(p[0]-xmin)*scale,canvas.height-60-(p[1]-ymin)*scale];context.fillStyle='#101820';context.fillRect(0,0,canvas.width,canvas.height);context.strokeStyle='#425267';context.lineWidth=1;context.beginPath();context.moveTo(90,35);context.lineTo(90,canvas.height-60);context.lineTo(canvas.width-35,canvas.height-60);context.stroke();context.setLineDash([6,5]);context.strokeStyle='#8093AA';context.beginPath();curve.controlPoints.forEach((p,i)=>{const[x,y]=project(p);if(i)context.lineTo(x,y);else context.moveTo(x,y);});context.stroke();context.setLineDash([]);context.strokeStyle='#5ED6E0';context.lineWidth=4;context.beginPath();points.forEach((p,i)=>{const[x,y]=project(p);if(i)context.lineTo(x,y);else context.moveTo(x,y);});context.stroke();context.font='14px sans-serif';curve.controlPoints.forEach((p,i)=>{const[x,y]=project(p);context.fillStyle='#F1AA55';context.beginPath();context.arc(x,y,5,0,Math.PI*2);context.fill();context.fillText('P'+i+' ['+p.slice(0,2).join(',')+'] mm',x+9,y+18);});context.fillStyle='#D2E2ED';context.fillText('CYAN: evaluated curve  /  DASHED: control polygon',25,25);const mid=evaluateCurve(curve,(a+b)/2);this.value={backend:'CAD evaluation → host Canvas2D drawing',domain:[a,b],sampleCount:points.length,midpointMM:mid};return this.value;},report(){return this.value;}};controller.update(source);return controller;
 }
 const data=surfaceData(kind==='material'?presets.surface.source:source,preset.sourceVersion || 0);
 const initialOptions=preset.sourceVersion ? fittedOptions(data.packet) : options;
 const control=preset.control || {name:'amount',min:0,max:1,step:.05,default:0};
 let compiled;
 if(kind==='material'){compiled=compileMeshMaterial(source);if(!compiled.ok)throw Error(JSON.stringify(compiled.diagnostics));}
 const viewer=await createViewer(canvas,{background:options.background,camera});
 let surface=null,grid=null;
 // A new packet replaces both meshes; the old ones stay until the new ones are added.
 function show(packet,view){
  const transform=placement(view);
  const nextSurface=viewer.add({positions:packet.positions,normals:packet.normals,indices:packet.indices},{name:packet.surfaceId,transform,material:{color:view.color,doubleSided:true,roughness:.6,...(surface?{shader:surface.material.shader}:{})}});
  const nextGrid=kind==='surface'?viewer.add(samplingGrid(packet),{name:'sampling-grid',transform,pickable:false,material:{color:[.65,.85,.95],unlit:true}}):null;
  surface?.remove();grid?.remove();surface=nextSurface;grid=nextGrid;
 }
 try{show(data.packet,initialOptions);viewer.fit();}catch(error){viewer.dispose();throw error;}
 const report=(next,view)=>({backend:'CAD sampling → WebGPU viewer mesh',sourceVersion:next.sourceVersion,centerMM:next.centerMM,parameters:next.parameters,vertices:next.report.vertexCount,triangles:next.report.triangleCount,maxSampledDeviationMM:next.report.maxSampledDeviationMM,certified:next.report.certified,mmToSceneUnit:view.mmToSceneUnit});
 let value=report(data,initialOptions),acceptedAmount=control.default;
 // A refused material leaves the drawn one and the accepted amount in place.
 function adoptMaterial(material,amount){
  // validateMeshMaterialBinding refuses an unknown or out-of-range uniform; bindingShader lowers it to WGSL.
  const uniforms={[control.name]:amount},shader=bindingShader(validateMeshMaterialBinding({material,uniforms}));
  // The mesh colour multiplies the shader's colour: white leaves the material's own colour.
  surface.material={shader,color:[1,1,1]};
  acceptedAmount=amount;value={...value,shaderId:material.shaderId,targetFunction:preset.targetFunction,uniforms};
 }
 const controller={dispose:()=>viewer.dispose(),report:()=>value,update(text){
  if(kind==='material'){
   const candidate=compileMeshMaterial(text);if(!candidate.ok)throw Error(JSON.stringify(candidate.diagnostics));
   adoptMaterial(candidate.material,acceptedAmount);this.material=candidate.material;
  }else{
   const next=surfaceData(text,preset.sourceVersion || 0),view=preset.sourceVersion ? fittedOptions(next.packet) : options;
   show(next.packet,view);
   value=report(next,view);
  }
  return value;
 },setAmount(amount){adoptMaterial(this.material,amount);return value;}};
 if(kind==='material'){try{adoptMaterial(compiled.material,acceptedAmount);controller.material=compiled.material;}catch(error){viewer.dispose();throw error;}}
 return controller;
}
