import {prepareParticleLayer} from './particle-layer.js';
import type {ParticleLayerV0,PreparedParticleLayer} from './particle-layer.js';
import {validateAdaptiveCurveSamples,validateWideAdaptiveCurveSamples} from '@barocss/cad';
import type {AdaptiveCurveSamplingResult,WideAdaptiveCurveSamplingResult} from '@barocss/cad';
import {GPUError} from './renderer.js';
import type {UpdateResult} from './renderer.js';
import {validateMeshOptions} from './mesh-packet.js';
import type {PreviewPacket,MeshOptions} from './mesh-packet.js';
import type {RGB,Vec3} from './scene.js';
import type {MeshSceneOptions} from './mesh-scene-renderer.js';
import {prepareSceneMesh,prepareSceneTransform,sceneRotation,displayBounds} from './mesh-scene-transform.js';
import type {MeshSceneTransform,MeshSceneBounds} from './mesh-scene-transform.js';
import {prepareCamera} from './camera.js';
import {meshLightingShaders,applyMeshLighting,materialMeshShaders,applyMeshMaterial} from './mesh-shaders.js';
import {validateMeshMaterialBinding} from './mesh-material.js';
import type {MeshMaterialBinding} from './mesh-material.js';

export type PrimitiveSceneEntry=
 |{kind:'surface';packet:PreviewPacket;color:RGB;transform?:MeshSceneTransform}
 |{kind:'curve';sample:AdaptiveCurveSamplingResult;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform};
export type PrimitiveSceneOptions=MeshSceneOptions;
export type PrimitiveSceneEntryV1=
 |Extract<PrimitiveSceneEntry,{kind:'surface'}>
 |(Extract<PrimitiveSceneEntry,{kind:'curve'}>&{sampleVersion:0})
 |{kind:'curve';sampleVersion:1;sample:WideAdaptiveCurveSamplingResult;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform};
export interface PrimitiveSceneInputV1 {version:1;entries:PrimitiveSceneEntryV1[]}
/** Host-scoped accepted source namespace; not a native revision/topology certificate. */
export interface PrimitiveSceneRef {modelId:string;geometryId:string}
export type PrimitiveSceneEntryV2=PrimitiveSceneEntryV1&{ref:PrimitiveSceneRef};
export interface PrimitiveSceneInputV2 {version:2;entries:PrimitiveSceneEntryV2[]}
/** Copied derived appearance bound to one accepted qualified Surface. */
export interface PrimitiveSceneMaterial {ref:PrimitiveSceneRef;binding:MeshMaterialBinding}
type NativeCurveSample=AdaptiveCurveSamplingResult|WideAdaptiveCurveSamplingResult;
interface Primitive {
 entry:PrimitiveSceneEntry|PrimitiveSceneEntryV1|PrimitiveSceneEntryV2;positions:Float32Array;normals?:Float32Array;indices?:Uint16Array;bounds:MeshSceneBounds;material?:MeshMaterialBinding;
}
interface Draw extends Primitive {vao:WebGLVertexArrayObject|null;buffers:WebGLBuffer[];program:WebGLProgram|null}
interface ParticleDraw extends PreparedParticleLayer {vao:WebGLVertexArrayObject|null;buffer:WebGLBuffer|null;program:WebGLProgram|null}
interface PreparedScene {primitives:Primitive[];options:PrimitiveSceneOptions;particles?:PreparedParticleLayer|null}
interface Frame {particles:ParticleDraw|null;draws:Draw[];options:PrimitiveSceneOptions;programs:WebGLProgram[];framebuffer:WebGLFramebuffer|null;color:WebGLTexture|null;depth:WebGLRenderbuffer|null;width:number;height:number}
const LINE_SHADERS={vertex:`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
uniform float aspect;
uniform bool defaultCamera;
uniform mat4 view;
uniform mat4 projection;
void main(){
 if(defaultCamera){vec3 p=position-vec3(0.0,0.0,6.0);float f=2.414213562373095;gl_Position=vec4(p.x*f/aspect,p.y*f,-1.000200020002*p.z-0.02000200020002,-p.z);}
 else{gl_Position=projection*view*vec4(position,1.0);}
}`,fragment:`#version 300 es
precision highp float;
uniform vec3 color;
out vec4 outputColor;
void main(){outputColor=vec4(color,1.0);}`};
const PARTICLE_SHADERS={vertex:LINE_SHADERS.vertex.replace('\n}', '\n gl_PointSize=6.0;\n}'),fragment:`#version 300 es
precision highp float;
out vec4 outputColor;
void main(){if(length(gl_PointCoord-vec2(0.5))>0.5)discard;outputColor=vec4(0.1,0.7,1.0,1.0);}`};
function check(v:unknown,message:string):asserts v {if(!v)throw new GPUError(message);}
function record(input:unknown,allowed:string[],required=allowed):Record<string,unknown>{
 check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'Primitive fields must be plain own data');
 const keys=Reflect.ownKeys(input),descriptors=Object.getOwnPropertyDescriptors(input);
 check(keys.length<=allowed.length&&keys.every(k=>typeof k==='string'&&allowed.includes(k)&&'value'in descriptors[k]&&descriptors[k].enumerable)&&required.every(k=>Object.hasOwn(descriptors,k)),'Primitive fields are missing, unsupported or not own data');
 return Object.fromEntries((keys as string[]).map(k=>[k,descriptors[k].value]));
}
/** Snapshot before native validation: never invoke an input accessor or keep caller data. */
function sampleSnapshot(input:unknown,wide=false):NativeCurveSample {
 let budget=wide?2097152:262144;const depthLimit=wide?32:24,arrayLimit=wide?8192:4096,stack=new WeakSet<object>();
 const copy=(value:unknown,depth:number):unknown=>{
  check(--budget>=0&&depth<=depthLimit,'Native Curve snapshot exceeds value/depth limits');
  if(typeof value==='number'){check(Number.isFinite(value),'Native Curve numbers must be finite');return value;}
  if(typeof value==='string'){check(value.length<=262144,'Native Curve string exceeds limit');return value;}
  if(value===null||typeof value==='boolean')return value;
  check(value!==null&&typeof value==='object'&&!stack.has(value),'Native Curve requires acyclic plain data');
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),descriptors=Object.getOwnPropertyDescriptors(value);
  check(array?proto===Array.prototype:proto===Object.prototype||proto===null,'Native Curve data have a foreign prototype');
  check(keys.length<=(array?arrayLimit+1:64)&&keys.every(k=>typeof k==='string'&&k.length<=128&&'value'in descriptors[k]&&(array&&k==='length'||descriptors[k].enumerable)),'Native Curve has getters, hidden, symbolic or excessive fields');
  stack.add(value);let result:unknown;
  if(array){const length=descriptors.length.value;check(Number.isInteger(length)&&length>=0&&length<=arrayLimit&&keys.length===length+1,'Native Curve arrays must be dense and bounded');result=Array.from({length},(_,i)=>{check(Object.hasOwn(descriptors,String(i)),'Native Curve array is sparse');return copy(descriptors[String(i)].value,depth+1);});}
  else result=Object.fromEntries((keys as string[]).map(k=>[k,copy(descriptors[k].value,depth+1)]));
  stack.delete(value);return result;
 };return copy(input,0) as NativeCurveSample;
}
function curvePositions(sample:NativeCurveSample,options:MeshOptions,pose?:MeshSceneTransform):Float32Array {
 const rotate=pose?sceneRotation(pose):null,converted:number[]=[];
 for(const raw of sample.pointsMM){
  const point=pose?rotate!(raw[0]*pose.scale[0],raw[1]*pose.scale[1],raw[2]*pose.scale[2]):raw;
  for(let axis=0;axis<3;axis++){const n=(point[axis]+(pose?.translationMm[axis]??0))*options.mmToSceneUnit+options.translate[axis];check(Number.isFinite(n)&&Math.abs(n)<=1000,'Curve display positions exceed ±1000 scene units');converted.push(n);}
 }
 const positions=Float32Array.from(converted);
 for(let i=1;i<sample.pointsMM.length;i++){
  const originalSame=sample.pointsMM[i].every((n,axis)=>n===sample.pointsMM[i-1][axis]);
  const displaySame=[0,1,2].every(axis=>positions[i*3+axis]===positions[(i-1)*3+axis]);
  check(originalSame||!displaySame,'Native nonzero Curve segment collapses in Float32 display');
 }
 return positions;
}
function prepareOptions(optionsInput:unknown):PrimitiveSceneOptions{
 const common=record(optionsInput,['mmToSceneUnit','translate','background','camera','lighting'],['mmToSceneUnit','translate','background']);
 const white=validateMeshOptions({...common,color:[1,1,1]});
 return{mmToSceneUnit:white.mmToSceneUnit,translate:[...white.translate] as Vec3,background:[...white.background] as RGB,...(white.camera?{camera:structuredClone(white.camera)}:{}),...(white.lighting?{lighting:white.lighting}:{})};
}
function prepare(input:unknown,optionsInput:unknown,sceneVersion:0|1|2=0):{primitives:Primitive[];options:PrimitiveSceneOptions}{
 const options=prepareOptions(optionsInput);
 check(Array.isArray(input)&&Object.getPrototypeOf(input)===Array.prototype,'Primitive entries must be a plain array');
 const length=Object.getOwnPropertyDescriptor(input,'length')!.value;
 check(Number.isInteger(length)&&length>=1&&length<=4&&Reflect.ownKeys(input).length===length+1,'Primitive scene requires1..4 dense entries');
 let curvePoints=0,curveSegments=0;const ids=new Set<string>(),qualified=new Map<string,Set<string>>(),primitives:Primitive[]=[];
 for(let i=0;i<length;i++){
  const d=Object.getOwnPropertyDescriptor(input,String(i));check(d&&'value'in d&&d.enumerable,'Primitive entries must be own data');
  const tag=record(d.value,['kind','packet','sample','basis','color','transform',...(sceneVersion>=1?['sampleVersion']:[]),...(sceneVersion===2?['ref']:[])],['kind','color']),hasPose=Object.hasOwn(tag,'transform');
  check(tag.kind==='surface'||tag.kind==='curve','Unsupported primitive kind');
  const keys=tag.kind==='surface'?['kind','packet','color']:['kind','sample','basis','color',...(sceneVersion>=1?['sampleVersion']:[])];if(hasPose)keys.push('transform');if(sceneVersion===2)keys.push('ref');
  const entry=record(d.value,keys);
  let ref:PrimitiveSceneRef|undefined;
  if(sceneVersion===2){const r=record(entry.ref,['modelId','geometryId']);check(typeof r.modelId==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(r.modelId),'Qualified modelId requires ASCII1..128');check(typeof r.geometryId==='string','Qualified geometryId must be own string data');ref={modelId:r.modelId,geometryId:r.geometryId};}
  const bindIdentity=(nativeId:string)=>{
   if(!ref){check(!ids.has(nativeId),'Primitive native IDs must be distinct');ids.add(nativeId);return;}
   check(ref.geometryId===nativeId,'Qualified geometryId does not match original native data');
   let model=qualified.get(ref.modelId);if(!model){model=new Set<string>();qualified.set(ref.modelId,model);}
   check(!model.has(nativeId),'Qualified native (modelId,geometryId) pairs must be distinct');model.add(nativeId);
  };
  if(tag.kind==='surface'){
   const mesh=prepareSceneMesh(entry.packet,{...options,color:entry.color},entry.transform,hasPose);
   bindIdentity(mesh.packet.surfaceId);
   primitives.push({entry:{kind:'surface',packet:mesh.packet,color:[...mesh.options.color],...(mesh.transform?{transform:mesh.transform}:{}),...(ref?{ref}:{})},positions:mesh.positions,normals:mesh.normals,indices:mesh.indices,bounds:mesh.displayBounds});
  }else{
   check(entry.basis==='authored-xyz-matches-rhyup','Curve authored XYZ must explicitly match renderer Y-up XYZ');
   const sampleVersion=sceneVersion===0?0:entry.sampleVersion;check(sampleVersion===0||sampleVersion===1,'Unsupported native Curve sampleVersion');
   const opts=validateMeshOptions({...options,color:entry.color}),pose=hasPose?prepareSceneTransform(entry.transform):undefined,sample=sampleSnapshot(entry.sample,sampleVersion===1);
   check(sample!==null&&typeof sample==='object'&&Array.isArray(sample.pointsMM)&&sample.pointsMM.length>=2,'Native Curve sampling result required');
   check(sample.report?.dto?.version===sampleVersion&&sample.sourceVersion===0,'Curve sampling DTO/version does not match the declared profile');
   curvePoints+=sample.pointsMM.length;curveSegments+=sample.pointsMM.length-1;
   check(curvePoints<=(sceneVersion>=1?16388:4096)&&curveSegments<=(sceneVersion>=1?16384:4092),'Scene Curve point/segment budget exceeded');
   check(sample.pointsMM.length<=(sampleVersion===1?4097:1025),'Curve sample point capacity exceeded');
   if(sampleVersion===1)validateWideAdaptiveCurveSamples(sample as WideAdaptiveCurveSamplingResult);else validateAdaptiveCurveSamples(sample as AdaptiveCurveSamplingResult);
   bindIdentity(sample.curve.id);
   const positions=curvePositions(sample,opts,pose);
   const fields={basis:'authored-xyz-matches-rhyup' as const,color:[...opts.color] as RGB,...(pose?{transform:pose}:{})};
   const owned:PrimitiveSceneEntry|PrimitiveSceneEntryV1=sampleVersion===1?{kind:'curve',sampleVersion:1,sample:sample as WideAdaptiveCurveSamplingResult,...fields}:sceneVersion>=1?{kind:'curve',sampleVersion:0,sample:sample as AdaptiveCurveSamplingResult,...fields}:{kind:'curve',sample:sample as AdaptiveCurveSamplingResult,...fields};
   primitives.push({entry:ref?{...owned,ref} as PrimitiveSceneEntryV2:owned,positions,bounds:displayBounds(positions)});
  }
 }
 return{primitives,options};
}
function prepareV1(input:unknown,options:unknown):ReturnType<typeof prepare>{const envelope=record(input,['version','entries']);check(envelope.version===1,'Only explicit primitive scene version1 is supported');return prepare(envelope.entries,options,1);}
function prepareV2(input:unknown,options:unknown):ReturnType<typeof prepare>{const envelope=record(input,['version','entries']);check(envelope.version===2,'Only explicit qualified primitive scene version2 is supported');return prepare(envelope.entries,options,2);}

/** Genuine sampled native Curves and Surface packets share one candidate frame/depth. */
class PrimitiveSceneBackend {
 private readonly gl:WebGL2RenderingContext;private accepted:Frame|null=null;private disposed=false;private lost=false;
 private readonly onLoss=(event:Event)=>{event.preventDefault();this.lost=true;};
 constructor(private readonly canvas:HTMLCanvasElement,prepared:ReturnType<typeof prepare>){
  this.dimensions(canvas.width,canvas.height);
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});check(gl&&!gl.isContextLost(),'WebGL2 is unavailable');this.gl=gl;canvas.addEventListener('webglcontextlost',this.onLoss);
  let frame:Frame|null=null;try{frame=this.create(prepared.primitives,prepared.options,canvas.width,canvas.height);this.present(frame);this.accepted=frame;}catch(error){if(frame)this.release(frame);this.dispose();throw error;}
 }
 protected get hasPrimitives():boolean{this.live();return this.accepted!.draws.length>0;}
 protected copyEntries():(PrimitiveSceneEntry|PrimitiveSceneEntryV1|PrimitiveSceneEntryV2)[]{this.live();return this.accepted!.draws.map(d=>structuredClone(d.entry));}
 get options():PrimitiveSceneOptions{this.live();return structuredClone(this.accepted!.options);}
 get bounds():MeshSceneBounds{this.live();const draws=this.accepted!.draws;return{min:[0,1,2].map(a=>Math.min(...draws.map(d=>d.bounds.min[a]))) as Vec3,max:[0,1,2].map(a=>Math.max(...draws.map(d=>d.bounds.max[a]))) as Vec3};}
 private live(){check(!this.disposed,'Primitive renderer is disposed');check(!this.lost&&!this.gl.isContextLost(),'WebGL2 context is lost; mount a new renderer');}
 private dimensions(width:number,height:number){check(Number.isInteger(width)&&Number.isInteger(height)&&width>=1&&height>=1&&width<=4096&&height<=4096&&width*height<=4194304,'Buffer dimensions exceed limits');}
 private checkGL(){const error=this.gl.getError();check(error===this.gl.NO_ERROR,'WebGL2 error 0x'+error.toString(16));check(!this.gl.isContextLost(),'WebGL2 context is lost');}
 private program(source:{vertex:string;fragment:string}):WebGLProgram {
  const gl=this.gl,shaders:WebGLShader[]=[];let program:WebGLProgram|null=null;
  try{for(const[kind,text]of[[gl.VERTEX_SHADER,source.vertex],[gl.FRAGMENT_SHADER,source.fragment]]as const){const shader=gl.createShader(kind);check(shader,'Cannot allocate primitive shader');shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);check(gl.getShaderParameter(shader,gl.COMPILE_STATUS),'Primitive shader compile failed: '+gl.getShaderInfoLog(shader));}program=gl.createProgram();check(program,'Cannot allocate primitive program');for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);check(gl.getProgramParameter(program,gl.LINK_STATUS),'Primitive program link failed: '+gl.getProgramInfoLog(program));return program;}
  catch(error){if(program)gl.deleteProgram(program);throw error;}finally{for(const shader of shaders)gl.deleteShader(shader);}
 }
 private create(primitives:Primitive[],options:PrimitiveSceneOptions,width:number,height:number,particles:PreparedParticleLayer|null=null):Frame {
  this.live();this.dimensions(width,height);this.checkGL();const gl=this.gl,camera=prepareCamera(options.camera,width/height),frame:Frame={particles:null,draws:[],options,programs:[],framebuffer:null,color:null,depth:null,width,height};
  try{
   if(particles){check(primitives.length>0,'Particles require accepted native geometry');const range=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;check(range.length===2&&range[0]<=6&&range[1]>=6,'Target does not support fixed6px points');}
   const programs=new Map<string,WebGLProgram>();
   for(const primitive of primitives){
    const kind=primitive.entry.kind,key=primitive.material?'material_'+frame.draws.length:kind;if(!programs.has(key)){const program=this.program(kind==='surface'?(primitive.material?materialMeshShaders(options.lighting,primitive.material):meshLightingShaders(options.lighting)):LINE_SHADERS);programs.set(key,program);frame.programs.push(program);}
    const draw:Draw={...primitive,vao:gl.createVertexArray(),buffers:[],program:programs.get(key)!};frame.draws.push(draw);check(draw.vao,'Cannot allocate primitive vertex array');gl.bindVertexArray(draw.vao);
    const attributes:[number,Float32Array][]=[[0,primitive.positions]];if(primitive.normals)attributes.push([1,primitive.normals]);
    for(const[location,data]of attributes){const buffer=gl.createBuffer();check(buffer,'Cannot allocate primitive vertex buffer');draw.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);}
    if(primitive.indices){const buffer=gl.createBuffer();check(buffer,'Cannot allocate primitive index buffer');draw.buffers.push(buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,primitive.indices,gl.STATIC_DRAW);}
   }
   if(particles){
    const point:ParticleDraw={...particles,program:null,vao:null,buffer:null};frame.particles=point;
    point.program=this.program(PARTICLE_SHADERS);frame.programs.push(point.program);
    point.vao=gl.createVertexArray();point.buffer=gl.createBuffer();check(point.vao&&point.buffer,'Cannot allocate particle vertex resources');
    gl.bindVertexArray(point.vao);gl.bindBuffer(gl.ARRAY_BUFFER,point.buffer);gl.bufferData(gl.ARRAY_BUFFER,point.positions,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
   }
   frame.framebuffer=gl.createFramebuffer();frame.color=gl.createTexture();frame.depth=gl.createRenderbuffer();check(frame.framebuffer&&frame.color&&frame.depth,'Cannot allocate primitive scene frame');
   gl.bindTexture(gl.TEXTURE_2D,frame.color);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,width,height);
   gl.bindRenderbuffer(gl.RENDERBUFFER,frame.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,width,height);gl.bindFramebuffer(gl.FRAMEBUFFER,frame.framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,frame.color,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,frame.depth);check(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'Primitive scene frame is incomplete');
   gl.viewport(0,0,width,height);gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.POLYGON_OFFSET_FILL);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);gl.colorMask(true,true,true,true);gl.lineWidth(1);
   gl.clearColor(...options.background,1);gl.clearDepth(1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   for(const draw of frame.draws){const program=draw.program!;gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(program,'defaultCamera'),options.camera===undefined?1:0);gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(program,'projection'),false,camera.projection);gl.uniform3fv(gl.getUniformLocation(program,'color'),draw.entry.color);if(draw.entry.kind==='surface'){applyMeshLighting(gl,program,options.lighting);applyMeshMaterial(gl,program,draw.material??null);}gl.bindVertexArray(draw.vao);if(draw.indices)gl.drawElements(gl.TRIANGLES,draw.indices.length,gl.UNSIGNED_SHORT,0);else gl.drawArrays(gl.LINE_STRIP,0,draw.positions.length/3);}
   if(frame.particles){const point=frame.particles,program=point.program!;gl.useProgram(program);gl.uniform1f(gl.getUniformLocation(program,'aspect'),width/height);gl.uniform1i(gl.getUniformLocation(program,'defaultCamera'),options.camera===undefined?1:0);gl.uniformMatrix4fv(gl.getUniformLocation(program,'view'),false,camera.view);gl.uniformMatrix4fv(gl.getUniformLocation(program,'projection'),false,camera.projection);gl.bindVertexArray(point.vao);gl.drawArrays(gl.POINTS,0,point.positions.length/3);}
   this.checkGL();return frame;
  }catch(error){this.release(frame);throw error;}
 }
 private present(frame:Frame){this.live();const gl=this.gl;gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,frame.framebuffer);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);gl.blitFramebuffer(0,0,frame.width,frame.height,0,0,this.canvas.width,this.canvas.height,gl.COLOR_BUFFER_BIT,gl.NEAREST);this.checkGL();gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
 /** Appearance replacement reuses already accepted native geometry, never caller getters. */
 protected copyMaterials():PrimitiveSceneMaterial[]{
  this.live();return this.accepted!.draws.filter(d=>d.material).map(d=>({ref:structuredClone((d.entry as PrimitiveSceneEntryV2).ref),binding:structuredClone(d.material!)}));
 }
 protected setQualifiedMaterial(refInput:PrimitiveSceneRef,input:MeshMaterialBinding|null):UpdateResult{
  return this.updatePrepared(()=>{
   const ref=record(refInput,['modelId','geometryId']);
   check(typeof ref.modelId==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(ref.modelId)&&typeof ref.geometryId==='string','Material requires exact own qualified reference');
   const prior=this.accepted!,index=prior.draws.findIndex(d=>{const r=(d.entry as PrimitiveSceneEntryV2).ref;return r?.modelId===ref.modelId&&r.geometryId===ref.geometryId;});
   check(index>=0,'Material reference is not in accepted scene');check(prior.draws[index].entry.kind==='surface','Material requires an accepted Surface, not a Curve');
   const material=input===null?undefined:validateMeshMaterialBinding(input);
   const primitives=prior.draws.map((draw,i)=>{const candidate:Primitive={entry:draw.entry,positions:draw.positions,normals:draw.normals,indices:draw.indices,bounds:draw.bounds};const binding=i===index?material:draw.material;if(binding)candidate.material=binding;return candidate;});
   return{primitives,options:prior.options,particles:prior.particles};
  });
 }
 protected copyParticleLayer():ParticleLayerV0|null{this.live();return this.accepted!.particles?structuredClone(this.accepted!.particles!.layer):null;}
 protected prepareSceneParticles(input:unknown):PreparedParticleLayer|null{this.live();return prepareParticleLayer(input,this.accepted!.particles?.layer??null,true);}
 protected setParticles(input:ParticleLayerV0|null):UpdateResult{
  return this.updatePrepared(()=>{const prior=this.accepted!,particles=prepareParticleLayer(input,prior.particles?.layer??null);check(!particles||prior.draws.length>0,'Particles require accepted native geometry');return{primitives:prior.draws,options:prior.options,particles};});
 }
 protected updatePrepared(candidate:()=>PreparedScene):UpdateResult{
  let frame:Frame|null=null;try{this.live();const p=candidate();frame=this.create(p.primitives,p.options,this.canvas.width,this.canvas.height,p.particles??null);this.present(frame);const prior=this.accepted!;this.accepted=frame;this.release(prior);return{ok:true};}
  catch(error){if(frame)this.release(frame);if(!this.disposed&&!this.lost&&!this.gl.isContextLost()&&this.accepted){try{this.present(this.accepted);}catch{this.lost=true;}}return{ok:false,error:error instanceof Error?error:new GPUError('Primitive scene update failed')};}
 }
 resize(width=this.canvas.width,height=this.canvas.height):void{
  this.live();this.dimensions(width,height);const prior=this.accepted!;let frame:Frame|null=null;
  try{frame=this.create(prior.draws,prior.options,width,height,prior.particles);this.canvas.width=width;this.canvas.height=height;check(this.gl.drawingBufferWidth===width&&this.gl.drawingBufferHeight===height,'Requested primitive buffer allocation failed');this.present(frame);this.accepted=frame;this.release(prior);}
  catch(error){if(frame)this.release(frame);this.canvas.width=prior.width;this.canvas.height=prior.height;if(!this.gl.isContextLost())this.present(prior);throw error;}
 }
 render():void{this.live();this.dimensions(this.canvas.width,this.canvas.height);this.present(this.accepted!);}
 readPixels():Uint8Array{this.live();this.dimensions(this.canvas.width,this.canvas.height);const gl=this.gl,pixels=new Uint8Array(this.canvas.width*this.canvas.height*4);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,null);gl.pixelStorei(gl.PACK_ALIGNMENT,4);gl.pixelStorei(gl.PACK_ROW_LENGTH,0);gl.pixelStorei(gl.PACK_SKIP_ROWS,0);gl.pixelStorei(gl.PACK_SKIP_PIXELS,0);gl.readPixels(0,0,this.canvas.width,this.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);this.checkGL();return pixels;}
 private release(frame:Frame){const gl=this.gl;if(!gl.isContextLost()){if(frame.programs.includes(gl.getParameter(gl.CURRENT_PROGRAM)))gl.useProgram(null);if(frame.draws.some(d=>d.vao&&gl.getParameter(gl.VERTEX_ARRAY_BINDING)===d.vao)||frame.particles?.vao===gl.getParameter(gl.VERTEX_ARRAY_BINDING))gl.bindVertexArray(null);for(const[target,binding]of[[gl.READ_FRAMEBUFFER,gl.READ_FRAMEBUFFER_BINDING],[gl.DRAW_FRAMEBUFFER,gl.DRAW_FRAMEBUFFER_BINDING]]as const)if(frame.framebuffer&&gl.getParameter(binding)===frame.framebuffer)gl.bindFramebuffer(target,null);}for(const d of frame.draws){for(const b of d.buffers)gl.deleteBuffer(b);if(d.vao)gl.deleteVertexArray(d.vao);}if(frame.particles){if(frame.particles.buffer)gl.deleteBuffer(frame.particles.buffer);if(frame.particles.vao)gl.deleteVertexArray(frame.particles.vao);}for(const program of frame.programs)gl.deleteProgram(program);if(frame.framebuffer)gl.deleteFramebuffer(frame.framebuffer);if(frame.depth)gl.deleteRenderbuffer(frame.depth);if(frame.color)gl.deleteTexture(frame.color);}
 dispose():void{if(this.disposed)return;this.disposed=true;this.canvas.removeEventListener('webglcontextlost',this.onLoss);if(this.accepted)this.release(this.accepted);this.accepted=null;}
}
export class PrimitiveSceneRenderer extends PrimitiveSceneBackend {
 constructor(canvas:HTMLCanvasElement,entries:PrimitiveSceneEntry[],options:PrimitiveSceneOptions){super(canvas,prepare(entries,options));}
 get entries():PrimitiveSceneEntry[]{return this.copyEntries() as PrimitiveSceneEntry[];}
 update(entries:PrimitiveSceneEntry[],options:PrimitiveSceneOptions):UpdateResult{return this.updatePrepared(()=>prepare(entries,options));}
}
export class PrimitiveSceneRendererV1 extends PrimitiveSceneBackend {
 constructor(canvas:HTMLCanvasElement,input:PrimitiveSceneInputV1,options:PrimitiveSceneOptions){super(canvas,prepareV1(input,options));}
 get entries():PrimitiveSceneEntryV1[]{return this.copyEntries() as PrimitiveSceneEntryV1[];}
 update(input:PrimitiveSceneInputV1,options:PrimitiveSceneOptions):UpdateResult{return this.updatePrepared(()=>prepareV1(input,options));}
}
export class PrimitiveSceneRendererV2 extends PrimitiveSceneBackend {
 get particleLayer():ParticleLayerV0|null{return this.copyParticleLayer();}
 setParticleLayer(frame:ParticleLayerV0|null):UpdateResult{return this.setParticles(frame);}
 get materials():PrimitiveSceneMaterial[]{return this.copyMaterials();}
 setMaterial(ref:PrimitiveSceneRef,binding:MeshMaterialBinding|null):UpdateResult{return this.setQualifiedMaterial(ref,binding);}
 constructor(canvas:HTMLCanvasElement,input:PrimitiveSceneInputV2,options:PrimitiveSceneOptions){super(canvas,prepareV2(input,options));}
 get entries():PrimitiveSceneEntryV2[]{return this.copyEntries() as PrimitiveSceneEntryV2[];}
 update(input:PrimitiveSceneInputV2,options:PrimitiveSceneOptions,particles:ParticleLayerV0|null=null):UpdateResult{return this.updatePrepared(()=>({...prepareV2(input,options),particles:this.prepareSceneParticles(particles)}));}
}
export function mountPrimitiveScene(canvas:HTMLCanvasElement,entries:PrimitiveSceneEntry[],options:PrimitiveSceneOptions):PrimitiveSceneRenderer{return new PrimitiveSceneRenderer(canvas,entries,options);}
export function mountPrimitiveSceneV1(canvas:HTMLCanvasElement,input:PrimitiveSceneInputV1,options:PrimitiveSceneOptions):PrimitiveSceneRendererV1{return new PrimitiveSceneRendererV1(canvas,input,options);}
export function mountPrimitiveSceneV2(canvas:HTMLCanvasElement,input:PrimitiveSceneInputV2,options:PrimitiveSceneOptions):PrimitiveSceneRendererV2{return new PrimitiveSceneRendererV2(canvas,input,options);}

/** Reuses the current primitive frame lifecycle; empty frames contain no native data. */
class PrimitiveViewportBackend extends PrimitiveSceneBackend {
 get particleLayer():ParticleLayerV0|null{return this.copyParticleLayer();}
 setParticleLayer(frame:ParticleLayerV0|null):UpdateResult{return this.setParticles(frame);}
 get materials():PrimitiveSceneMaterial[]{return this.copyMaterials();}
 setMaterial(ref:PrimitiveSceneRef,binding:MeshMaterialBinding|null):UpdateResult{return this.setQualifiedMaterial(ref,binding);}
 constructor(options:PrimitiveSceneOptions,canvas:HTMLCanvasElement){super(canvas,{primitives:[],options:prepareOptions(options)});}
 get entries():PrimitiveSceneEntryV2[]{return this.copyEntries() as PrimitiveSceneEntryV2[];}
 get empty():boolean{return !this.hasPrimitives;}
 update(input:PrimitiveSceneInputV2,options:PrimitiveSceneOptions,particles:ParticleLayerV0|null=null):UpdateResult{return this.updatePrepared(()=>({...prepareV2(input,options),particles:this.prepareSceneParticles(particles)}));}
 clear(options:PrimitiveSceneOptions):UpdateResult{return this.updatePrepared(()=>({primitives:[],options:prepareOptions(options)}));}
}
/** Explicit empty/clear owner over the same qualified version2 primitive backend. */
export class PrimitiveViewport {
 private readonly backend:PrimitiveViewportBackend;
 get particleLayer():ParticleLayerV0|null{return this.backend.particleLayer;}
 setParticleLayer(frame:ParticleLayerV0|null):UpdateResult{return this.backend.setParticleLayer(frame);}
 get materials():PrimitiveSceneMaterial[]{return this.backend.materials;}
 setMaterial(ref:PrimitiveSceneRef,binding:MeshMaterialBinding|null):UpdateResult{return this.backend.setMaterial(ref,binding);}
 constructor(canvas:HTMLCanvasElement,options:PrimitiveSceneOptions){this.backend=new PrimitiveViewportBackend(options,canvas);}
 get entries():PrimitiveSceneEntryV2[]{return this.backend.entries;}
 get options():PrimitiveSceneOptions{return this.backend.options;}
 get bounds():MeshSceneBounds|null{return this.backend.empty?null:this.backend.bounds;}
 update(input:PrimitiveSceneInputV2,options:PrimitiveSceneOptions,particles:ParticleLayerV0|null=null):UpdateResult{return this.backend.update(input,options,particles);}
 clear(options:PrimitiveSceneOptions):UpdateResult{return this.backend.clear(options);}
 render():void{this.backend.render();}
 readPixels():Uint8Array{return this.backend.readPixels();}
 resize(width?:number,height?:number):void{this.backend.resize(width,height);}
 dispose():void{this.backend.dispose();}
}
export function mountPrimitiveViewport(canvas:HTMLCanvasElement,options:PrimitiveSceneOptions):PrimitiveViewport{return new PrimitiveViewport(canvas,options);}
