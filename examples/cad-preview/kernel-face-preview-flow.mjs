import * as gpu from '/gpu.js';
import {screenRay,sameData} from '/screen-ray.mjs';
const canvas=document.getElementById('preview'),status=document.getElementById('status');
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
function requireValue(condition,message){if(!condition)throw Error(message);}
function near(a,b){return a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=1e-7);}
function frame(renderer,name){const rgba=Array.from(renderer.readPixels());let foreground=0;for(let i=0;i<rgba.length;i+=4)if(Math.abs(rgba[i]-rgba[0])+Math.abs(rgba[i+1]-rgba[1])+Math.abs(rgba[i+2]-rgba[2])>20)foreground++;return{name,width:canvas.width,height:canvas.height,rgba,foreground};}
function checkOriginal(dto,prepared){
 let vertex=0,index=0;const expected={positions:[],normals:[],uv:[],indices:[]};
 for(const chunk of dto.chunks){
  const face=prepared.faces.find(f=>f.reference.faceToken===chunk.faceToken);requireValue(face.reference.nativeFaceId===chunk.nativeFaceId,'Native face ID was rewritten');requireValue(face.faceOrientation===chunk.faceOrientation&&face.normalSource===chunk.normalSource,'Native sense/normal source lost');
  requireValue(sameData(face.vertexRange,[vertex,vertex+chunk.positionsMM.length/3]),'Face vertex range mismatch');requireValue(sameData(face.indexRange,[index,index+chunk.indices.length]),'Face index range mismatch');
  for(let i=0;i<chunk.positionsMM.length;i+=3){expected.positions.push(chunk.positionsMM[i],chunk.positionsMM[i+2],-chunk.positionsMM[i+1]);expected.normals.push(chunk.normals[i],chunk.normals[i+2],-chunk.normals[i+1]);}
  expected.uv.push(...chunk.parametersUV);expected.indices.push(...chunk.indices.map(i=>i+vertex));vertex+=chunk.positionsMM.length/3;index+=chunk.indices.length;
 }
 requireValue(sameData(prepared.packet.positions,expected.positions)&&sameData(prepared.packet.normals,expected.normals),'Native position/normal R conversion mismatch');requireValue(sameData(prepared.packet.parameters,expected.uv)&&sameData(prepared.packet.indices,expected.indices),'UV or native winding changed');return expected;
}
function checkUpload(renderer,prepared,options){
 const gl=canvas.getContext('webgl2'),owned=gpu.prepareMesh(prepared.packet,options),arrays=[owned.positions,owned.normals,owned.indices],targets=[gl.ARRAY_BUFFER,gl.ARRAY_BUFFER,gl.ELEMENT_ARRAY_BUFFER];
 const uploads=[];gl.bindVertexArray(renderer.accepted.vao);
 for(let i=0;i<arrays.length;i++){const actual=new arrays[i].constructor(arrays[i].length);gl.bindBuffer(targets[i],renderer.accepted.buffers[i]);gl.getBufferSubData(targets[i],0,actual);requireValue(sameData(Array.from(actual),Array.from(arrays[i])),'Actual GPU buffer differs from native-derived data');uploads.push(Array.from(actual));}
 gl.bindVertexArray(null);requireValue(gl.getError()===0,'GL readback error');return uploads;
}
const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rayHit(packet,ray){let hit=null;for(let i=0;i<packet.indices.length;i+=3){const p=packet.indices.slice(i,i+3).map(n=>packet.positions.slice(n*3,n*3+3)),e1=sub(p[1],p[0]),e2=sub(p[2],p[0]),h=cross(ray.direction,e2),det=dot(e1,h);if(Math.abs(det)<1e-12)continue;const inv=1/det,s=sub(ray.originMM,p[0]),u=dot(s,h)*inv;if(u<0||u>1)continue;const q=cross(s,e1),v=dot(ray.direction,q)*inv;if(v<0||u+v>1)continue;const distance=dot(e2,q)*inv;if(distance>=0&&distance<=ray.maxDistanceMM&&(!hit||distance<hit.distance))hit={index:i,distance};}return hit;}
function pickFace(prepared,options){
 const matrices=gpu.prepareCamera(options.camera,canvas.width/canvas.height),r=canvas.getBoundingClientRect();
 const transform=(m,v)=>[0,1,2,3].map(i=>v.reduce((sum,n,k)=>sum+m[k*4+i]*n,0));
 for(const face of prepared.faces){for(let i=face.indexRange[0];i<face.indexRange[1];i+=3){const ids=prepared.packet.indices.slice(i,i+3);if(ids.every(n=>prepared.packet.normals[n*3+1]<.5))continue;const point=[0,1,2].map(axis=>ids.reduce((sum,n)=>sum+prepared.packet.positions[n*3+axis],0)/3*options.mmToSceneUnit+options.translate[axis]);const clip=transform(matrices.projection,transform(matrices.view,[...point,1]));if(clip[3]<=0)continue;const x=r.left+(clip[0]/clip[3]+1)/2*r.width,y=r.top+(1-clip[1]/clip[3])/2*r.height;if(x<r.left||x>=r.right||y<r.top||y>=r.bottom)continue;const ray=screenRay(canvas,options,x,y,gpu),hit=rayHit(prepared.packet,ray.query);if(!hit)continue;const selected=prepared.faces.find(f=>hit.index>=f.indexRange[0]&&hit.index<f.indexRange[1]);return{ray,hit,binding:gpu.resolveKernelFaceReference(prepared,selected.reference)};}}
 throw Error('Actual native top-face screen ray found no selectable triangle');
}
document.getElementById('run').onclick=async()=>{
 document.getElementById('run').disabled=true;status.textContent='Running';let renderer;const frames=[];let evidence;
 try{
  const [initial,rebuilt,metadata]=await Promise.all(['/initial.json','/rebuilt.json','/metadata.json'].map(async p=>{const r=await fetch(p);requireValue(r.ok,'Missing actual native input');return r.json();}));
  const initialBefore=structuredClone(initial),rebuiltBefore=structuredClone(rebuilt);
  const first=gpu.prepareKernelFacePreview(initial,{displayId:'own_plate',packetRevision:1}),next=gpu.prepareKernelFacePreview(rebuilt,{displayId:'own_plate',packetRevision:2});
  const firstNative=checkOriginal(initial,first),rebuiltNative=checkOriginal(rebuilt,next);
  requireValue(Math.abs(first.packet.bounds.max[0]-first.packet.bounds.min[0]-80)<1e-7&&Math.abs(next.packet.bounds.max[0]-next.packet.bounds.min[0]-100)<1e-7,'Actual native width80 ->100 rebuild evidence required');
  requireValue(!sameData(first.context,next.context),'Actual rebuild needs a new native result context');requireValue(first.faces.some(f=>next.faces.some(n=>n.reference.faceToken===f.reference.faceToken)),'Real rebuild did not exercise a repeated result-scoped token');
  const bounds=first.packet.bounds,center=bounds.min.map((n,i)=>(n+bounds.max[i])*.005),extent=Math.max(...bounds.max.map((n,i)=>(n-bounds.min[i])*.01));
  const options={mmToSceneUnit:.01,translate:[0,0,0],color:[.45,.72,.84],background:[.04,.06,.08],camera:{eye:[center[0],center[1]+extent*1.9,center[2]+extent*1.4],target:center,up:[0,1,0],fovYDegrees:42,near:.01,far:100}};
  renderer=gpu.mountMesh(canvas,first.packet,options);let accepted=first;
  const firstUpload=checkUpload(renderer,first,options);frames.push(frame(renderer,'initial-cut'));requireValue(frames[0].foreground>1000,'Actual initial native geometry has no visible body');
  const selection=pickFace(first,options);requireValue(selection.binding,'Actual native face selection failed');
  requireValue(renderer.setFaceHighlight({version:0,packet:first.packet,faceId:'picked_native_face',indexRange:selection.binding.indexRange,color:[1,.65,.2]}).ok,'Actual face tint refused');frames.push(frame(renderer,'selected-face'));requireValue(!sameData(frames[0].rgba,frames[1].rgba),'Face selection has no visible tint');
  const update=renderer.update(next.packet,options,null,null);requireValue(update.ok,update.error?.message??'Rebuild update refused');accepted=next;
  const rebuiltUpload=checkUpload(renderer,next,options);frames.push(frame(renderer,'rebuilt-width100'));requireValue(!sameData(frames[0].rgba,frames[2].rgba),'Actual rebuilt native body has unchanged pixels');
  requireValue(gpu.resolveKernelFaceReference(accepted,selection.binding.reference)===null,'Old topology ref rebound to rebuilt body');requireValue(gpu.resolveKernelFaceReference(first,selection.binding.reference)!==null,'Pinned old result stopped resolving its own ref');
  const acceptedContext=structuredClone(accepted.context),acceptedPacket=renderer.packet,beforeRefusal=renderer.readPixels();
  // A native-valid packet can fail original Float32 display admission; no new native fixture.
  const refused=renderer.update(next.packet,{...options,mmToSceneUnit:1e-10,translate:[500,500,500]},null,null);
  requireValue(!refused.ok,'Expected real Float32 geometry collapse refusal');requireValue(sameData(renderer.packet,acceptedPacket)&&sameData(accepted.context,acceptedContext)&&sameData(Array.from(renderer.readPixels()),Array.from(beforeRefusal)),'Display refusal changed accepted packet/context/frame');
  requireValue(sameData(initial,initialBefore)&&sameData(rebuilt,rebuiltBefore),'Original native DTO was mutated');
  const gl=canvas.getContext('webgl2'),extension=gl.getExtension('WEBGL_debug_renderer_info'),backend={renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),glError:gl.getError()};requireValue(backend.glError===0,'GL error after flow');requireValue(errors.length===0,'Browser runtime errors');
  evidence={ok:true,metadata,initialContext:first.context,rebuiltContext:next.context,firstNative,rebuiltNative,firstUpload,rebuiltUpload,faces:first.faces,rebuiltFaces:next.faces,selection,staleReferenceRefused:true,pinnedReferenceResolved:true,refusal:refused.error.message,originalDTOsUnchanged:true,acceptedContext,backend,errors,frames};status.textContent='PASS · own native data / upload / pixels / face / stale / refusal';
 }catch(error){status.textContent='FAIL · '+error.message;evidence={ok:false,error:error.message,errors,frames};}
 const payload={...evidence,frames:evidence.frames.map(({rgba,...f})=>{let binary='';for(let i=0;i<rgba.length;i+=8192)binary+=String.fromCharCode(...rgba.slice(i,i+8192));return{...f,rgbaBase64:btoa(binary)};})};
 await fetch('/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
 window.kernelFaceFlowResult={...evidence,frames:evidence.frames.map(({rgba,...f})=>f)};
 // Keep the final actual frame visible; disposal is an explicit page lifecycle boundary.
 window.addEventListener('pagehide',()=>renderer?.dispose(),{once:true});
};
