import { DoubleSide, BufferAttribute, MeshNormalMaterial } from 'three';
export const PINS = [
  {
    "path": "main.mesh-request.json",
    "bytes": 1997510,
    "sha256": "6777a43586cfb0ef6df0f4979f83ec610e37223b98b6294f02cdb8372cb2ae09"
  },
  {
    "path": "main.mesh-result.json",
    "bytes": 2783390,
    "sha256": "30013ca3ff2e04b77388a5c7d5ea2fe1f3ea97c6054089f7491e54ef7ffb2165"
  },
  {
    "path": "edited.mesh-request.json",
    "bytes": 2011904,
    "sha256": "af325a5efddf789fae2c7021db94eb6220fc0a05bf632afeef50dbe96eeb5d65"
  },
  {
    "path": "edited.mesh-result.json",
    "bytes": 2806407,
    "sha256": "241b8ebe23c844f3717110b3d856499ec6e1b6e9cfc5a9aa6a2eda1e40e9bfa0"
  },
  {
    "path": "single.mesh-request.json",
    "bytes": 702431,
    "sha256": "a7cd5e9628940555f6c5c9555491292429536788c4d2dc4af85a3f67dbc3f06c"
  },
  {
    "path": "single.mesh-result.json",
    "bytes": 986547,
    "sha256": "935c30ad1693d27765c6aad0a66613edda9a2904258f3a0bb469b41eaefa627a"
  }
];
export const CAMERA = Object.freeze({width:900,height:640,eye:[.095,.070,.085],target:[.020,.02328125,.00225],up:[0,1,0],left:-.05,right:.05,bottom:-.05*640/900,top:.05*640/900,near:.001,far:.5,background:0x101820,markerPosition:[-.008,-.005,.005],markerRadius:.001});

export function fact(value,message){if(!value)throw new Error(message);}
export function sameNative(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){fact(Object.is(a,b),'Value/sign mismatch '+path);return;}
 if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){fact(ArrayBuffer.isView(a)&&ArrayBuffer.isView(b)&&a.constructor===b.constructor&&a.length===b.length,'Typed array mismatch '+path);for(let i=0;i<a.length;i++)sameNative(a[i],b[i],path+'['+i+']');return;}
 fact(Array.isArray(a)===Array.isArray(b),'Array mismatch '+path);const ak=Object.keys(a),bk=Object.keys(b);fact(ak.length===bk.length&&ak.every((key,i)=>key===bk[i]),'Fields/order mismatch '+path);for(const key of ak)sameNative(a[key],b[key],path+'.'+key);
}
export function stringifyNative(value,space){return JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?{type:item.constructor.name,values:Array.from(item)}:typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
export function negativeZeroPaths(value,path='$',out=[]){if(typeof value==='number'&&Object.is(value,-0))out.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))negativeZeroPaths(item,path+'.'+key,out);return out;}
export function mutableRefs(value,set=new Set()){
 if(value&&typeof value==='object'&&!set.has(value)&&!Object.isFrozen(value)){set.add(value);if(ArrayBuffer.isView(value)){set.add(value.buffer);return set;}for(const item of Object.values(value))mutableRefs(item,set);}return set;
}
export function intersection(a,b){let count=0;for(const item of a)if(b.has(item))count++;return count;}
function deepFrozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);fact(Object.isFrozen(value),'Fixed metadata must be frozen');for(const item of Object.values(value))deepFrozen(item,seen);}
export function assetFromTexts(key,texts){
 const request=JSON.parse(texts.get(key+'.mesh-request.json')),native=JSON.parse(texts.get(key+'.mesh-result.json'));sameNative(native.body,request.body);sameNative(native.options,request.options);fact(native.renderChunks.length===6&&native.body.faces.length===6,'Complete six Face original required');sameNative(native.body.models.map(row=>row.model.objects.length),[16,2]);
 return{key,request,native,text:texts.get(key+'.mesh-result.json'),pins:PINS.filter(p=>p.path.startsWith(key+'.'))};
}
export function errorReceipt(error,depth=0){const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause=error.cause instanceof Error&&depth<16?errorReceipt(error.cause,depth+1):error.cause;return result;}
export function pose(object){object.updateMatrixWorld(true);return{position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),visible:object.visible,matrix:object.matrix.toArray(),world:object.matrixWorld.toArray()};}
export function cameraState(camera){return{...pose(camera),projection:camera.projectionMatrix.toArray(),view:camera.matrixWorldInverse.toArray(),up:camera.up.toArray(),left:camera.left,right:camera.right,bottom:camera.bottom,top:camera.top,near:camera.near,far:camera.far};}
export function observeResult(result){
 sameNative(Object.keys(result),['data','group','faceBindings','dispose']);fact(result.group.isGroup&&result.group.parent===null&&result.group.children.length===6,'Detached complete candidate Group required');fact(result.faceBindings.length===6&&Object.isFrozen(result.faceBindings),'Six frozen bindings required');
 const geometries=new Set(),materials=new Set(),buffers=new Set();
 return result.faceBindings.map((binding,i)=>{
  sameNative(Object.keys(binding),['faceId','role','orientation','supportRef','object']);fact(Object.isFrozen(binding),'Binding metadata frozen');deepFrozen(binding.supportRef);const object=binding.object,chunk=result.data.projection.chunks[i],geometry=object.geometry,material=object.material;
  fact(object.isMesh&&object.parent===result.group&&object.name===chunk.faceId&&geometry.isBufferGeometry&&material instanceof MeshNormalMaterial,'Real qualified Mesh required');
  fact(material.side===DoubleSide&&!material.transparent&&material.opacity===1&&material.depthTest&&material.depthWrite,'Default opaque DoubleSide material required');sameNative(Object.keys(object.userData),[]);sameNative(Object.keys(geometry.attributes).sort(),['normal','position']);
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),index=geometry.getIndex();fact(position instanceof BufferAttribute&&normal instanceof BufferAttribute&&index instanceof BufferAttribute,'Ordinary BufferAttributes required');fact(position.array instanceof Float32Array&&normal.array instanceof Float32Array&&index.array instanceof Uint32Array,'Exact target constructors required');fact(position.itemSize===3&&normal.itemSize===3&&index.itemSize===1&&!position.normalized&&!normal.normalized&&!index.normalized,'Attribute dimensions required');
  sameNative(position.array,chunk.positions);sameNative(normal.array,chunk.normals);sameNative(index.array,chunk.indices);fact(position.array.buffer!==chunk.positions.buffer&&normal.array.buffer!==chunk.normals.buffer&&index.array.buffer!==chunk.indices.buffer,'Target buffers must independently copy neutral');sameNative([object.position.toArray(),object.quaternion.toArray(),object.scale.toArray()],[[0,0,0],[0,0,0,1],[1,1,1]]);
  fact(!geometries.has(geometry)&&!materials.has(material),'Each Face owns distinct geometry/material');geometries.add(geometry);materials.add(material);for(const array of [position.array,normal.array,index.array]){fact(!buffers.has(array.buffer),'Each target attribute has independent buffer');buffers.add(array.buffer);}
  const row={result,binding,object,geometry,material,positionAttribute:position,normalAttribute:normal,indexAttribute:index,positionArray:position.array,normalArray:normal.array,indexArray:index.array,positions:Array.from(position.array),normals:Array.from(normal.array),indices:Array.from(index.array),geometryDisposals:0,materialDisposals:0};geometry.addEventListener('dispose',()=>row.geometryDisposals++);material.addEventListener('dispose',()=>row.materialDisposals++);return row;
 });
}
export function checkResult(record,{borrowedRow=null,callerGeometry=null,callerMaterial=null}={}){
 const{result,asset,rows}=record,data=result.data;sameNative(Object.keys(data),['native','validationReport','profile','sourceText','projection']);sameNative(data.native,asset.native);sameNative(data.validationReport,asset.native.report);deepFrozen(data.profile);fact(data.profile.capabilities.renderer===false&&data.projection.chunks.length===6,'Neutral metadata unchanged');sameNative([result.group.position.toArray(),result.group.quaternion.toArray(),result.group.scale.toArray()],[[0,0,0],[0,0,0,1],[1,1,1]]);
 fact(result.group.name===data.native.packet.meshId,'Original meshId group name required');fact(intersection(mutableRefs(data.native),mutableRefs(asset.native))===0&&intersection(mutableRefs(data.native),mutableRefs(data.validationReport))===0&&intersection(mutableRefs(data.native),mutableRefs(data.projection))===0,'Independent whole CPU ownership required');
 for(const[rowIndex,row]of rows.entries()){
  const chunk=data.projection.chunks[rowIndex];sameNative([row.binding.faceId,row.binding.role,row.binding.orientation,row.binding.supportRef],[chunk.faceId,chunk.role,chunk.orientation,chunk.supportRef]);fact(row.binding.supportRef!==chunk.supportRef,'Binding qualification separately copied');
  sameNative(row.positionArray,chunk.positions);sameNative(row.normalArray,chunk.normals);sameNative(row.indexArray,chunk.indices);sameNative(Array.from(row.positionArray),row.positions);sameNative(Array.from(row.normalArray),row.normals);sameNative(Array.from(row.indexArray),row.indices);
  fact(row.geometry.getAttribute('position')===row.positionAttribute&&row.geometry.getAttribute('normal')===row.normalAttribute&&row.geometry.getIndex()===row.indexAttribute,'Captured original attribute refs retained');
  if(row===borrowedRow)fact(row.object.geometry===callerGeometry&&row.object.material===callerMaterial,'Only authorized borrowed pointers changed');else fact(row.object.geometry===row.geometry&&row.object.material===row.material,'Original current target pointers retained');
  sameNative([row.object.position.toArray(),row.object.quaternion.toArray(),row.object.scale.toArray()],[[0,0,0],[0,0,0,1],[1,1,1]]);
 }
 return true;
}
export function captureRows(rows){return rows.map(row=>({faceId:row.binding.faceId,role:row.binding.role,orientation:row.binding.orientation,supportRef:row.binding.supportRef,positions:row.positions,normals:row.normals,indices:row.indices,arrayTypes:{position:row.positionArray.constructor.name,normal:row.normalArray.constructor.name,index:row.indexArray.constructor.name},geometryDisposals:row.geometryDisposals,materialDisposals:row.materialDisposals}));}
export function createCallerLedger({scene,camera,marker,renderer=null,canvas=null}){
 const geometry=marker.geometry,material=marker.material,counts={geometryDisposals:0,materialDisposals:0,markerRemovals:0,rendererDisposals:0,canvasRemovals:0};geometry.addEventListener('dispose',()=>counts.geometryDisposals++);material.addEventListener('dispose',()=>counts.materialDisposals++);marker.addEventListener('removed',()=>counts.markerRemovals++);
 if(renderer){const original=renderer.dispose;renderer.dispose=function(...args){counts.rendererDisposals++;return original.apply(this,args);};}if(canvas){const original=canvas.remove;canvas.remove=function(...args){counts.canvasRemovals++;return original.apply(this,args);};}
 return{scene,camera,marker,geometry,material,renderer,canvas,counts,initialCamera:cameraState(camera),initialMarker:pose(marker)};
}
export function captureCaller(ledger){sameNative(cameraState(ledger.camera),ledger.initialCamera);sameNative(pose(ledger.marker),ledger.initialMarker);fact(ledger.marker.parent===ledger.scene&&ledger.marker.geometry===ledger.geometry&&ledger.marker.material===ledger.material,'Caller references survive');for(const value of Object.values(ledger.counts))fact(value===0,'Caller disposal/removal must remain zero');return{counts:{...ledger.counts},camera:cameraState(ledger.camera),marker:pose(ledger.marker),canvasConnected:ledger.canvas?ledger.canvas.isConnected:null,alive:true};}
export function runGuards(loader,Loader,after=()=>{}){
 let getterCalls=0;const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){getterCalls++;return 1;}});const cycle={};cycle.self=cycle;
 const controls=[{name:'malformed-json',code:'JSON',message:'JSON value required',action:()=>loader.parse('}')},{name:'wrong-explicit-scale',code:'INPUT',message:'Boundary mesh options require only unitsPerMillimeter 0.001',action:()=>new Loader({unitsPerMillimeter:.01})},{name:'wrong-kind-getter-argument',code:'INPUT',message:'Boundary mesh text must be a string',action:()=>loader.parse(getter)},{name:'small-ancestor-cycle',code:'OWNED',message:'Own ancestor cycle refused',action:()=>loader.read(cycle)}];
 const receipts=[];for(const control of controls){let error;try{control.action();}catch(cause){error=cause;}fact(error?.name==='BaroCadQualifiedBodyBoundaryMeshReadError'&&error.code===control.code&&error.message===control.message,'Unexpected guard result '+control.name);fact(getterCalls===0,'Getter must not execute');after(control,error);receipts.push({name:control.name,error:errorReceipt(error),getterCalls,acceptedRetained:true});}return{refusals:receipts,getterCalls};
}
