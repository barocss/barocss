import {BaroCADQualifiedBodyBoundaryMeshBabylonLoader} from '@barocss/cad-interop/qualified-body-boundary-mesh-babylon';
import {VertexBuffer} from '@babylonjs/core/Buffers/buffer.js';
import {Material} from '@babylonjs/core/Materials/material.js';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial.js';
export const CASE_KEYS = Object.freeze(['main','edited','single']);
export const INPUT_PINS = Object.freeze([
 {key:'main',role:'request',file:'main.mesh-request.json',bytes:1997510,sha256:'6777a43586cfb0ef6df0f4979f83ec610e37223b98b6294f02cdb8372cb2ae09'},
 {key:'main',role:'result',file:'main.mesh-result.json',bytes:2783390,sha256:'30013ca3ff2e04b77388a5c7d5ea2fe1f3ea97c6054089f7491e54ef7ffb2165'},
 {key:'edited',role:'request',file:'edited.mesh-request.json',bytes:2011904,sha256:'af325a5efddf789fae2c7021db94eb6220fc0a05bf632afeef50dbe96eeb5d65'},
 {key:'edited',role:'result',file:'edited.mesh-result.json',bytes:2806407,sha256:'241b8ebe23c844f3717110b3d856499ec6e1b6e9cfc5a9aa6a2eda1e40e9bfa0'},
 {key:'single',role:'request',file:'single.mesh-request.json',bytes:702431,sha256:'a7cd5e9628940555f6c5c9555491292429536788c4d2dc4af85a3f67dbc3f06c'},
 {key:'single',role:'result',file:'single.mesh-result.json',bytes:986547,sha256:'935c30ad1693d27765c6aad0a66613edda9a2904258f3a0bb469b41eaefa627a'},
].map(pin=>Object.freeze(pin)));
export function createNativeOptions(){return{unitsPerMillimeter:0.001};}
export function fact(condition,message){if(!condition)throw new Error(message);}
export function assertNative(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){fact(Object.is(a,b),'Whole Object.is mismatch at '+path);return;}
 if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){fact(ArrayBuffer.isView(a)&&ArrayBuffer.isView(b)&&a.constructor===b.constructor&&a.length===b.length,'Typed array shape/type differs at '+path);for(let index=0;index<a.length;index++)assertNative(a[index],b[index],path+'['+index+']');return;}
 fact(Array.isArray(a)===Array.isArray(b),'Array shape differs at '+path);const keys=Object.keys(a);fact(keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)),'Object fields differ at '+path);for(const key of keys)assertNative(a[key],b[key],path+'.'+key);
}
export function stringifyNative(value,space=2){return JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?{type:item.constructor.name,values:Array.from(item)}:typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
export function cpu(value){if(value===null||typeof value!=='object')return value;if(ArrayBuffer.isView(value))return{type:value.constructor.name,values:Array.from(value)};if(Array.isArray(value))return value.map(cpu);return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,cpu(item)]));}
export function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);if(ArrayBuffer.isView(value)){set.add(value.buffer);return set;}for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
export function intersection(a,b){let count=0;for(const item of a)if(b.has(item))count++;return count;}
export function errorReceipt(error){const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error),valueType:typeof error};if(error?.cause!==undefined)result.cause=error.cause instanceof Error?errorReceipt(error.cause):cpu(error.cause);return result;}
export function pose(mesh){return{position:mesh.position.asArray(),rotation:mesh.rotation.asArray(),rotationQuaternion:mesh.rotationQuaternion?.asArray()??null,scaling:mesh.scaling.asArray()};}
function checkPose(mesh){assertNative(pose(mesh),{position:[0,0,0],rotation:[0,0,0],rotationQuaternion:null,scaling:[1,1,1]});fact(mesh.parent===null,'SDK candidate must retain no parent transform');}

export function assetFromTexts(key,texts){
 const request=JSON.parse(texts.get(key+'.mesh-request.json')),text=texts.get(key+'.mesh-result.json'),native=JSON.parse(text);
 assertNative({body:native.body,options:native.options},request);fact(native.renderChunks.length===6&&native.body.faces.length===6,'Complete original six Face receipt required');assertNative(native.body.models.map(row=>row.model.objects.length),[16,2]);
 return{key,request,native,text,pins:INPUT_PINS.filter(pin=>pin.key===key)};
}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);fact(Object.isFrozen(value),'Binding/profile metadata must be frozen');for(const item of Object.values(value))frozen(item,seen);}
/** Observe captured originals. The SDK owns their release. */
export function observeResult(result){
 assertNative(Object.keys(result),['data','meshes','faceBindings','dispose']);fact(result.meshes.length===6&&result.faceBindings.length===6&&Object.isFrozen(result.meshes)&&Object.isFrozen(result.faceBindings),'Six frozen SDK object/binding lists required');
 const geometries=new Set(),materials=new Set(),buffers=new Set();
 return result.faceBindings.map((binding,index)=>{
  assertNative(Object.keys(binding),['faceId','role','orientation','supportRef','object']);fact(Object.isFrozen(binding),'Binding must be frozen');frozen(binding.supportRef);const mesh=binding.object,chunk=result.data.projection.chunks[index],geometry=mesh.geometry,material=mesh.material;
  fact(mesh===result.meshes[index]&&!mesh.isEnabled()&&mesh.name===chunk.faceId&&geometry&&material instanceof StandardMaterial,'Real registered disabled SDK candidate required');checkPose(mesh);
  assertNative([binding.faceId,binding.role,binding.orientation,binding.supportRef],[chunk.faceId,chunk.role,chunk.orientation,chunk.supportRef]);fact(binding.supportRef!==chunk.supportRef,'Separate copied qualification required');
  fact(material.alpha===1&&material.transparencyMode===Material.MATERIAL_OPAQUE&&material.backFaceCulling===false&&material.disableLighting===true,'Opaque unlit SDK material policy required');assertNative(material.emissiveColor.asArray(),[.48,.36,.96]);
  assertNative(mesh.getVerticesDataKinds().sort(),[VertexBuffer.PositionKind,VertexBuffer.NormalKind].sort());
  const positionArray=mesh.getVerticesData(VertexBuffer.PositionKind,false,false),normalArray=mesh.getVerticesData(VertexBuffer.NormalKind,false,false),indexArray=mesh.getIndices(false,false);
  fact(positionArray instanceof Float32Array&&normalArray instanceof Float32Array&&indexArray instanceof Uint32Array,'Actual F32/F32/U32 CPU target constructors required');
  assertNative(positionArray,chunk.positions);assertNative(normalArray,chunk.normals);assertNative(indexArray,chunk.indices);
  for(const[actual,native]of [[positionArray,chunk.positions],[normalArray,chunk.normals],[indexArray,chunk.indices]]){fact(actual.buffer!==native.buffer&&!buffers.has(actual.buffer),'Independent captured target buffer required');buffers.add(actual.buffer);}
  fact(!geometries.has(geometry)&&!materials.has(material),'Distinct perFace geometry/material required');geometries.add(geometry);materials.add(material);
  const row={result,binding,chunk,mesh,object:mesh,geometry,material,positionBuffer:mesh.getVertexBuffer(VertexBuffer.PositionKind),normalBuffer:mesh.getVertexBuffer(VertexBuffer.NormalKind),indexBuffer:geometry.getIndexBuffer(),positionArray,normalArray,indexArray,nativeUVArray:chunk.nativeUV,positions:Array.from(positionArray),normals:Array.from(normalArray),indices:Array.from(indexArray),nativeUV:Array.from(chunk.nativeUV),meshDisposals:0,geometryDisposals:0,materialDisposals:0};
  mesh.onDisposeObservable.add(()=>row.meshDisposals++);material.onDisposeObservable.add(()=>row.materialDisposals++);
  const original=geometry.dispose;geometry.dispose=function(...args){row.geometryDisposals++;return original.apply(this,args);};return row;
 });
}
export function checkResult(record,{borrowedRow=null,callerGeometry=null,callerMaterial=null,enabled=null}={}){
 const{result,asset}=record,rows=record.resources??record.rows,data=result.data;
 assertNative(Object.keys(data),['native','validationReport','profile','sourceText','projection']);assertNative(data.native,asset.native);assertNative(data.validationReport,asset.native.report);frozen(data.profile);fact(data.profile.capabilities.renderer===false,'Neutral profile remains CPU-only');
 fact(intersection(refs(data.native,new Set(),true),refs(asset.native,new Set(),true))===0&&intersection(refs(data.native,new Set(),true),refs(data.validationReport,new Set(),true))===0&&intersection(refs(data.native,new Set(),true),refs(data.projection,new Set(),true))===0,'Independent native/report/projection ownership required');
 for(const row of rows){
  checkPose(row.mesh);assertNative(row.positionArray,row.chunk.positions);assertNative(row.normalArray,row.chunk.normals);assertNative(row.indexArray,row.chunk.indices);assertNative(Array.from(row.positionArray),row.positions);assertNative(Array.from(row.normalArray),row.normals);assertNative(Array.from(row.indexArray),row.indices);assertNative(Array.from(row.nativeUVArray),row.nativeUV);
  if(!row.mesh.isDisposed()){
   if(row===borrowedRow)fact(row.mesh.geometry===callerGeometry&&row.mesh.material===callerMaterial,'Only authorized caller pointers changed');
   else{fact(row.mesh.geometry===row.geometry&&row.mesh.material===row.material,'Captured current target pointers retained');fact(row.mesh.getVerticesData(VertexBuffer.PositionKind,false,false)===row.positionArray&&row.mesh.getVerticesData(VertexBuffer.NormalKind,false,false)===row.normalArray&&row.mesh.getIndices(false,false)===row.indexArray,'Captured target arrays retained');fact(row.mesh.getVertexBuffer(VertexBuffer.PositionKind)===row.positionBuffer&&row.mesh.getVertexBuffer(VertexBuffer.NormalKind)===row.normalBuffer&&row.geometry.getIndexBuffer()===row.indexBuffer,'Captured target buffer refs retained');}
   if(enabled!==null)fact(row.mesh.isEnabled()===enabled,'Actual enabled state differs');
  }
 }
 return true;
}
export function captureRows(rows){return rows.map(row=>({faceId:row.binding.faceId,role:row.binding.role,orientation:row.binding.orientation,supportRef:cpu(row.binding.supportRef),positions:row.positions,normals:row.normals,indices:row.indices,nativeUV:row.nativeUV,arrayTypes:{position:row.positionArray.constructor.name,normal:row.normalArray.constructor.name,index:row.indexArray.constructor.name,nativeUV:row.nativeUVArray.constructor.name},meshDisposals:row.meshDisposals,geometryDisposals:row.geometryDisposals,materialDisposals:row.materialDisposals,meshDisposed:row.mesh.isDisposed(),geometryDisposed:row.geometry.isDisposed(),nativeUVUploaded:false,cachedOriginalBuffersReadable:true}));}
export async function runGuards(loader,Loader,scene,mainNative,after=()=>{}){
 let getterCalls=0;const nonstring={};Object.defineProperty(nonstring,'x',{enumerable:true,get(){getterCalls++;return 1;}});const cycle={};cycle.self=cycle;const options={};Object.defineProperty(options,'unitsPerMillimeter',{enumerable:true,get(){getterCalls++;return .001;}});
 const controls=[
  {name:'malformed-json',kind:'family',code:'JSON',action:()=>loader.parse('}')},
  {name:'nonstring-getter',kind:'family',code:'INPUT',action:()=>loader.parse(nonstring)},
  {name:'owned-cycle',kind:'family',code:'OWNED',action:()=>loader.read(cycle)},
  {name:'wrong-scale',kind:'family',code:'INPUT',action:()=>new Loader({unitsPerMillimeter:.01},scene)},
  {name:'non-scene',kind:'scene',nameExpected:'TypeError',message:'A live Babylon Scene instance is required',action:()=>new Loader(createNativeOptions(),{})},
  {name:'wrong-handed',kind:'scene',nameExpected:'RangeError',message:'The Babylon Scene must use the right-handed coordinate system',action:()=>{scene.useRightHandedSystem=false;try{return loader.read(mainNative);}finally{scene.useRightHandedSystem=true;}}},
  {name:'options-getter',kind:'family',code:'OWNED',action:()=>new Loader(options,scene)},
 ];
 const receipts=[];
 for(const control of controls){let threw=false,error;try{control.action();}catch(value){threw=true;error=value;}fact(threw,'Unexpected guard acceptance: '+control.name);
  if(control.kind==='family')fact(error?.name==='BaroCadQualifiedBodyBoundaryMeshReadError'&&error.code===control.code,'Actual inherited guard class/code differs');else fact(error?.name===control.nameExpected&&error.message===control.message,'Actual Scene guard differs');fact(getterCalls===0,'Caller getter executed');await after(control,error);receipts.push({name:control.name,error:errorReceipt(error),getterCalls,acceptedRetained:true});
 }
 return{refusals:receipts,getterCalls,acceptedRetained:true};
}
/** Local consumer session; candidate objects are allocated only by the public SDK. */
export function createPublicBabylonBodyMeshHost({scene,prepareCandidate=async()=>{},onChange=()=>{}}){
 const loader=new BaroCADQualifiedBodyBoundaryMeshBabylonLoader(createNativeOptions(),scene),records=[],allResources=[],events=[],guards=[],nativeCases=new Map();let accepted=null,busy=false,disposed=false,callbacks=0,sdkCalls=0,eligibleCalls=0,peakLivePairs=0,cold=null;
 const counts=()=>({admissions:records.length,pairs:allResources.length,meshes:allResources.length,geometries:new Set(allResources.map(row=>row.geometry)).size,materials:new Set(allResources.map(row=>row.material)).size,liveMeshes:allResources.filter(row=>!row.mesh.isDisposed()).length,liveGeometry:allResources.filter(row=>!row.geometry.isDisposed()).length,liveMaterials:allResources.filter(row=>row.materialDisposals===0).length,livePairs:allResources.filter(row=>row.meshDisposals===0&&row.geometryDisposals===0&&row.materialDisposals===0).length,peakLivePairs,meshDisposals:allResources.reduce((n,row)=>n+row.meshDisposals,0),geometryDisposals:allResources.reduce((n,row)=>n+row.geometryDisposals,0),materialDisposals:allResources.reduce((n,row)=>n+row.materialDisposals,0),callbacks,sdkCalls,eligibleCalls,guards:guards.length,disposed});
 const event=(type,key,extra={})=>events.push({type,key,...counts(),...extra});
 function release(record){if(record.disposed)return;try{record.result.dispose();}finally{record.disposed=true;event('released',record.key);}}
 async function load(asset,state='original'){
  fact(!busy&&!disposed,'Consumer cannot load during another action or after cleanup');busy=true;let result,candidate,installed=false;
  try{
   sdkCalls++;const owned=records.length===0&&asset.key==='main';result=owned?loader.read(asset.native):loader.parse(asset.text);eligibleCalls++;
   const resources=observeResult(result);allResources.push(...resources);candidate={key:asset.key,state,asset,result,data:result.data,meshes:result.meshes,resources,rows:resources,readout:cpu(result.data),disposed:false,stage:{status:'disabled-preparing',error:null,cleanupErrors:[]}};
   fact(result.data.sourceText===(owned?null:asset.text),'Literal sourceText/null role required');checkResult(candidate,{enabled:false});for(const mesh of result.meshes)fact(mesh.getScene()===scene&&scene.meshes.includes(mesh),'Disabled candidate registered in caller Scene');
   for(const previous of records)fact(intersection(refs(candidate.data,new Set(),true),refs(previous.data,new Set(),true))===0,'Cross-admission mutable data aliases');peakLivePairs=Math.max(peakLivePairs,counts().livePairs);event('disabled-staged',asset.key);
   await prepareCandidate(candidate);checkResult(candidate,{enabled:false});assertNative(cpu(candidate.data),candidate.readout);candidate.stage.status='verified';
   if(state==='cold-reopen'){const prior=nativeCases.get(asset.key);fact(prior,'Earlier original authority required');assertNative(candidate.readout,prior.readout);cold={key:asset.key,fullReadEqual:true,sourceTextEqual:true,freshPublicParse:true};}
   for(const mesh of result.meshes)mesh.setEnabled(true);if(accepted)release(accepted);accepted=candidate;records.push(candidate);installed=true;
   if(state==='original'&&!nativeCases.has(asset.key))nativeCases.set(asset.key,{key:asset.key,request:cpu(asset.request),readout:candidate.readout});event('admitted',asset.key);callbacks++;onChange(candidate);return candidate;
  }catch(primary){if(candidate){candidate.stage.status='refused';candidate.stage.error=errorReceipt(primary);}if(result&&!installed)try{result.dispose();}catch(cleanup){event('candidate-cleanup-error',asset.key,{error:errorReceipt(cleanup)});}throw primary;}finally{busy=false;}
 }
 async function guardsForMain(mainNative,after=async()=>{}){
  fact(accepted&&!busy&&!disposed,'Accepted MAIN required');busy=true;
  try{
   const record=accepted,before=structuredClone(record.data),rowValues=captureRows(record.resources),members={meshes:[...scene.meshes],materials:[...scene.materials],geometries:[...scene.geometries],cameras:[...scene.cameras],rootNodes:[...scene.rootNodes],activeCamera:scene.activeCamera},beforeRefs=refs(record.data),beforeCounts=counts();
   const result=await runGuards(loader,BaroCADQualifiedBodyBoundaryMeshBabylonLoader,scene,mainNative,async(control,error)=>{
    fact(accepted===record,'Accepted collection reference changed');assertNative(record.data,before);const currentRefs=refs(record.data);fact(currentRefs.size===beforeRefs.size&&[...currentRefs].every(ref=>beforeRefs.has(ref)),'Accepted CPU references changed');checkResult(record,{enabled:true});assertNative(captureRows(record.resources),rowValues);
    for(const field of ['meshes','materials','geometries','cameras','rootNodes'])fact(scene[field].length===members[field].length&&scene[field].every((item,index)=>item===members[field][index]),'Early guard changed Scene references');fact(scene.activeCamera===members.activeCamera,'Early guard changed camera');
    const now=counts();for(const field of ['admissions','pairs','meshes','geometries','materials','livePairs','meshDisposals','geometryDisposals','materialDisposals','callbacks','eligibleCalls'])fact(now[field]===beforeCounts[field],'Early guard changed target/resource count');
    const receipt={name:control.name,error:errorReceipt(error),acceptedRetained:true,observedNewTargetResources:0};guards.push(receipt);event('guard-refused',record.key,{name:control.name});await after(receipt);
   });return result;
  }finally{busy=false;}
 }
 function dispose(){if(disposed)return;fact(!busy,'Consumer cannot dispose a pending preparation');disposed=true;const previous=accepted;accepted=null;let failed=false,primary;try{if(previous)release(previous);}catch(error){failed=true;primary=error;}event('cleanup',null);try{callbacks++;onChange(null);}catch(error){if(!failed){failed=true;primary=error;}}if(failed)throw primary;}
 function snapshot(){return{nativeCases:[...nativeCases.values()].map(cpu),accepted:accepted?{key:accepted.key,state:accepted.state,recordIndex:records.indexOf(accepted)}:null,records:records.map(record=>({key:record.key,state:record.state,disposed:record.disposed,resourceIndices:record.resources.map(row=>allResources.indexOf(row)),nativeCPUReadable:(assertNative(cpu(record.data),record.readout),true),stage:cpu(record.stage)})),resources:captureRows(allResources),counts:counts(),events:cpu(events),guards:cpu(guards),cold:cpu(cold),scope:'Actual public SDK captured objects; GPU/readiness/frame evidence is separate consumer observation'};}
 return{load,runGuards:guardsForMain,dispose,snapshot,get loader(){return loader;},get accepted(){return accepted;},get records(){return records;},get allResources(){return allResources;},get events(){return events;},get counts(){return counts();}};
}
