// Primitive scenes as data: surfaces (preview packets) and native curve samples with colours and poses,
// complete frames with materials, particle and cloth layers, and their CPU admission. The @barocss/gpu
// viewer draws them (through @barocss/viewer); nothing here touches a canvas.
import {validateAdaptiveCurveSamples,validateWideAdaptiveCurveSamples} from '@barocss/cad';
import type {AdaptiveCurveSamplingResult,WideAdaptiveCurveSamplingResult} from '@barocss/cad';
import type {ParticleLayerV0} from './particle-layer.js';
import type {ClothLayerV0} from './cloth-layer.js';
import {validateUniformCurvePreview,validateSelectedUniformCurvePreview} from './uniform-curve-preview.js';
import type {UniformCurvePreview,SelectedUniformCurvePreview} from './uniform-curve-preview.js';
import {GPUError} from './gpu-error.js';
import {validateMeshOptions} from './mesh-packet.js';
import type {PreviewPacket,MeshOptions} from './mesh-packet.js';
import type {RGB,Vec3} from './scene.js';
import {prepareSceneMesh,prepareSceneTransform,sceneRotation,displayBounds} from './mesh-scene-transform.js';
import type {MeshSceneTransform,MeshSceneBounds} from './mesh-scene-transform.js';
import {validateMeshMaterialBinding} from './mesh-material.js';
import type {MeshMaterialBinding} from './mesh-material.js';

/** Scene options: the mesh options without the per-entry colour. */
export type MeshSceneOptions=Omit<MeshOptions,'color'>;

export type PrimitiveSceneEntry=
 |{kind:'surface';packet:PreviewPacket;color:RGB;transform?:MeshSceneTransform}
 |{kind:'curve';sample:AdaptiveCurveSamplingResult;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform};
export type PrimitiveSceneOptions=MeshSceneOptions;
export type PrimitiveSceneEntryV1=
 |Extract<PrimitiveSceneEntry,{kind:'surface'}>
 |(Extract<PrimitiveSceneEntry,{kind:'curve'}>&{sampleVersion:0})
 |{kind:'curve';sampleVersion:1;sample:WideAdaptiveCurveSamplingResult;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform}
 |{kind:'curve';sampleVersion:2;sample:UniformCurvePreview;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform}
 |{kind:'curve';sampleVersion:3;sample:SelectedUniformCurvePreview;basis:'authored-xyz-matches-rhyup';color:RGB;transform?:MeshSceneTransform};
export interface PrimitiveSceneInputV1 {version:1;entries:PrimitiveSceneEntryV1[]}
/** Host-scoped accepted source namespace; not a native revision/topology certificate. */
export interface PrimitiveSceneRef {modelId:string;geometryId:string}
export type PrimitiveSceneEntryV2=PrimitiveSceneEntryV1&{ref:PrimitiveSceneRef};
export interface PrimitiveSceneInputV2 {version:2;entries:PrimitiveSceneEntryV2[]}
/** Copied derived appearance bound to one accepted qualified Surface. */
export interface PrimitiveSceneMaterial {ref:PrimitiveSceneRef;binding:MeshMaterialBinding}
/** Explicit complete appearance/frame replacement; no implicit binding carry. */
export interface PrimitiveSceneFrameV0 {version:0;scene:PrimitiveSceneInputV2;options:PrimitiveSceneOptions;particles:ParticleLayerV0|null;materials:PrimitiveSceneMaterial[]}
/** Additive complete native and derived frame. Version0 replacement explicitly clears cloth. */
export interface PrimitiveSceneFrameV1 {version:1;scene:PrimitiveSceneInputV2;options:PrimitiveSceneOptions;particles:ParticleLayerV0|null;materials:PrimitiveSceneMaterial[];cloth:ClothLayerV0|null}
type AdaptiveNativeCurveSample=AdaptiveCurveSamplingResult|WideAdaptiveCurveSamplingResult;
type NativeCurveSample=AdaptiveNativeCurveSample|UniformCurvePreview|SelectedUniformCurvePreview;
interface Primitive {
 entry:PrimitiveSceneEntry|PrimitiveSceneEntryV1|PrimitiveSceneEntryV2;positions:Float32Array;normals?:Float32Array;indices?:Uint16Array;bounds:MeshSceneBounds;material?:MeshMaterialBinding;
}
function check(v:unknown,message:string):asserts v {if(!v)throw new GPUError(message);}
function record(input:unknown,allowed:string[],required=allowed):Record<string,unknown>{
 check(input!==null&&typeof input==='object'&&Object.getPrototypeOf(input)===Object.prototype,'Primitive fields must be plain own data');
 const keys=Reflect.ownKeys(input),descriptors=Object.getOwnPropertyDescriptors(input);
 check(keys.length<=allowed.length&&keys.every(k=>typeof k==='string'&&allowed.includes(k)&&'value'in descriptors[k]&&descriptors[k].enumerable)&&required.every(k=>Object.hasOwn(descriptors,k)),'Primitive fields are missing, unsupported or not own data');
 return Object.fromEntries((keys as string[]).map(k=>[k,descriptors[k].value]));
}
/** Snapshot before native validation: never invoke an input accessor or keep caller data. */
function sampleSnapshot(input:unknown,wide=false):AdaptiveNativeCurveSample {
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
 };return copy(input,0) as AdaptiveNativeCurveSample;
}
function curvePositions(sample:NativeCurveSample,options:MeshOptions,pose?:MeshSceneTransform):Float32Array {
 const rotate=pose?sceneRotation(pose):null,converted:number[]=[];
 for(const raw of sample.pointsMM){
  let point=raw;
  if(pose){
   const x=raw[0]*pose.scale[0],y=raw[1]*pose.scale[1],z=raw[2]*pose.scale[2];
   check(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)&&(raw[0]===0||x!==0)&&(raw[1]===0||y!==0)&&(raw[2]===0||z!==0),
    'Native Curve coordinate overflows or underflows during pose scaling');
   point=rotate!(x,y,z);
  }
  for(let axis=0;axis<3;axis++){
   const millimeters=point[axis]+(pose?.translationMm[axis]??0),scaled=millimeters*options.mmToSceneUnit;
   check(Number.isFinite(scaled)&&(millimeters===0||scaled!==0),'Native Curve coordinate overflows or underflows during scene scaling');
   const n=scaled+options.translate[axis];check(Number.isFinite(n)&&Math.abs(n)<=1000,'Curve display positions exceed ±1000 scene units');
   const f32=Math.fround(n);check(Number.isFinite(f32)&&(n===0||f32!==0),'Native Curve coordinate underflows in Float32 display');
   converted.push(n);
  }
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
   const sampleVersion=sceneVersion===0?0:entry.sampleVersion;check(sampleVersion===0||sampleVersion===1||sampleVersion===2||sampleVersion===3,'Unsupported native Curve sampleVersion');
   const opts=validateMeshOptions({...options,color:entry.color}),pose=hasPose?prepareSceneTransform(entry.transform):undefined;
   const sample:NativeCurveSample=sampleVersion===3?validateSelectedUniformCurvePreview(entry.sample):sampleVersion===2?validateUniformCurvePreview(entry.sample):sampleSnapshot(entry.sample,sampleVersion===1);
   check(sample!==null&&typeof sample==='object'&&Array.isArray(sample.pointsMM)&&sample.pointsMM.length>=2,'Native Curve sampling result required');
   if(sampleVersion===3){
    const selected=sample as SelectedUniformCurvePreview;
    check(selected.version===1&&selected.sourceVersion===0,'Selected uniform Curve preview DTO/source version does not match the declared profile');
    if(ref)check(ref.modelId===selected.model.name,'Qualified modelId does not match original selected uniform Curve source');
   }else if(sampleVersion===2){
    const uniform=sample as UniformCurvePreview;
    check(uniform.version===0&&uniform.sourceVersion===0,'Uniform Curve preview DTO/source version does not match the declared profile');
    if(ref)check(ref.modelId===uniform.model.name,'Qualified modelId does not match original uniform Curve source');
   }else check((sample as AdaptiveNativeCurveSample).report?.dto?.version===sampleVersion&&sample.sourceVersion===0,'Curve sampling DTO/version does not match the declared profile');
   curvePoints+=sample.pointsMM.length;curveSegments+=sample.pointsMM.length-1;
   check(curvePoints<=(sceneVersion>=1?16388:4096)&&curveSegments<=(sceneVersion>=1?16384:4092),'Scene Curve point/segment budget exceeded');
   check(sample.pointsMM.length<=(sampleVersion===2||sampleVersion===3?129:sampleVersion===1?4097:1025),'Curve sample point capacity exceeded');
   if(sampleVersion===1)validateWideAdaptiveCurveSamples(sample as WideAdaptiveCurveSamplingResult);else if(sampleVersion===0)validateAdaptiveCurveSamples(sample as AdaptiveCurveSamplingResult);
   bindIdentity(sampleVersion===3?(sample as SelectedUniformCurvePreview).curveId:sampleVersion===2?(sample as UniformCurvePreview).model.objects[0].id:(sample as AdaptiveNativeCurveSample).curve.id);
   const positions=curvePositions(sample,opts,pose);
   const fields={basis:'authored-xyz-matches-rhyup' as const,color:[...opts.color] as RGB,...(pose?{transform:pose}:{})};
   const owned:PrimitiveSceneEntry|PrimitiveSceneEntryV1=sampleVersion===3?{kind:'curve',sampleVersion:3,sample:sample as SelectedUniformCurvePreview,...fields}:sampleVersion===2?{kind:'curve',sampleVersion:2,sample:sample as UniformCurvePreview,...fields}:sampleVersion===1?{kind:'curve',sampleVersion:1,sample:sample as WideAdaptiveCurveSamplingResult,...fields}:sceneVersion>=1?{kind:'curve',sampleVersion:0,sample:sample as AdaptiveCurveSamplingResult,...fields}:{kind:'curve',sample:sample as AdaptiveCurveSamplingResult,...fields};
   primitives.push({entry:ref?{...owned,ref} as PrimitiveSceneEntryV2:owned,positions,bounds:displayBounds(positions)});
  }
 }
 return{primitives,options};
}
function prepareV2(input:unknown,options:unknown):ReturnType<typeof prepare>{const envelope=record(input,['version','entries']);check(envelope.version===2,'Only explicit qualified primitive scene version2 is supported');return prepare(envelope.entries,options,2);}

/** Shared pure frame admission. Internal module export; no canvas or backend access. */
export function prepareCompletePrimitiveFrameData(input:unknown,allowEmpty=false):{prepared:ReturnType<typeof prepare>;materials:PrimitiveSceneMaterial[];particles:unknown}{
   const frame=record(input,['version','scene','options','particles','materials']);check(frame.version===0,'Only complete frame version0 is supported');
   const scene=record(frame.scene,['version','entries']);check(scene.version===2,'Complete frame requires qualified scene version2');
   const empty=allowEmpty&&Array.isArray(scene.entries)&&Object.getPrototypeOf(scene.entries)===Array.prototype&&scene.entries.length===0&&Reflect.ownKeys(scene.entries).length===1;
   const prepared=empty?{primitives:[] as Primitive[],options:prepareOptions(frame.options)}:prepareV2(frame.scene,frame.options);
   const list=frame.materials;check(Array.isArray(list)&&Object.getPrototypeOf(list)===Array.prototype,'Materials require plain dense array');
   const descriptors=Object.getOwnPropertyDescriptors(list as object),length=descriptors.length.value;
   check(Number.isInteger(length)&&length>=0&&length<=4&&Reflect.ownKeys(list).length===length+1,'Complete frame admits0..4 dense materials');
   const seen=new Set<string>(),materials:PrimitiveSceneMaterial[]=[];
   for(let i=0;i<length;i++){
    const descriptor=descriptors[String(i)];check(descriptor&&'value'in descriptor&&descriptor.enumerable,'Material entries must be own data');
    const item=record(descriptor.value,['ref','binding']),ref=record(item.ref,['modelId','geometryId']);
    check(typeof ref.modelId==='string'&&/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(ref.modelId)&&typeof ref.geometryId==='string','Exact qualified material ref required');
    const key=JSON.stringify([ref.modelId,ref.geometryId]);check(!seen.has(key),'Duplicate complete-frame material ref');seen.add(key);
    const primitive=prepared.primitives.find(p=>{const r=(p.entry as PrimitiveSceneEntryV2).ref;return r.modelId===ref.modelId&&r.geometryId===ref.geometryId;});
    check(primitive&&primitive.entry.kind==='surface','Material must reference a candidate-scene Surface');
    primitive.material=validateMeshMaterialBinding(item.binding);
    materials.push({ref:{modelId:ref.modelId,geometryId:ref.geometryId},binding:primitive.material});
   }
   return{prepared,materials,particles:frame.particles};
 }

