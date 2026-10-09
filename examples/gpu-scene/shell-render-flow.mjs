import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {build} from 'esbuild';

const arguments_=process.argv.slice(2),buildOnly=arguments_.includes('--build-only');
function argument(name,required=true){const index=arguments_.indexOf(name);if(index<0){if(required)throw new Error('Missing '+name);return null;}return resolve(arguments_[index+1]);}
const output=argument('--output'),meshes=argument('--meshes',!buildOnly),repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const names=['cross_union','containment_hole','strip_two_components','reverse_containment_empty','cross_union_distance_edit'];
const client=String.raw`
import {mountBooleanShell,prepareCamera} from '../../packages/barocss-gpu/dist/index.js';
const names=['cross_union','containment_hole','strip_two_components','reverse_containment_empty','cross_union_distance_edit'];
const canvas=document.querySelector('canvas'),button=document.querySelector('button'),status=document.querySelector('pre');
function check(value,message){if(!value)throw new Error(message);}
function same(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
function hash(bytes){let h=2166136261;for(const byte of bytes)h=Math.imul(h^byte,16777619);return(h>>>0).toString(16);}
const mesh={mmToSceneUnit:0.05,translate:[0,0,0],color:[0.75,0.55,0.32],background:[0.05,0.07,0.1],
 camera:{eye:[-0.85,-0.2,0.95],target:[-0.075,-0.2,-0.025],up:[0,1,0],fovYDegrees:45,near:0.01,far:10}};
const options={mesh,edges:null};
const world=p=>p.map((n,i)=>n*mesh.mmToSceneUnit+mesh.translate[i]);
function faceCenter(native,face){const points=native.mesh.positionsMM.slice(face.vertexStart*3,(face.vertexStart+face.vertexCount)*3);return[0,1,2].map(axis=>points.filter((_,i)=>i%3===axis).reduce((a,b)=>a+b,0)/face.vertexCount);}
function cameraFor(native){const face=native.faceRanges.find(f=>f.kind==='top-cap');if(!face)return structuredClone(mesh.camera);const target=world(faceCenter(native,face));const normal=native.mesh.normals.slice(face.vertexStart*3,face.vertexStart*3+3);return{...mesh.camera,target,eye:target.map((n,i)=>n+normal[i]*1.8)};}
function projected(point,camera){const matrices=prepareCamera(camera,canvas.width/canvas.height);function mul(m,p){return[0,1,2,3].map(row=>[0,1,2,3].reduce((sum,col)=>sum+m[col*4+row]*p[col],0));}const clip=mul(matrices.projection,mul(matrices.view,[...point,1]));return[Math.round((clip[0]/clip[3]+1)*canvas.width/2),Math.round((clip[1]/clip[3]+1)*canvas.height/2)];}
function pixel(pixels,point){const x=Math.max(0,Math.min(canvas.width-1,point[0])),y=Math.max(0,Math.min(canvas.height-1,point[1]));return[...pixels.slice((y*canvas.width+x)*4,(y*canvas.width+x)*4+3)];}
const background=mesh.background.map(n=>Math.round(n*255));
function isMaterial(rgb){return rgb.some((n,i)=>Math.abs(n-background[i])>2);}
function materialCount(pixels){let count=0;for(let i=0;i<pixels.length;i+=4)if(isMaterial(pixels.slice(i,i+3)))count++;return count;}
button.addEventListener('click',async()=>{
 button.disabled=true;let renderer=null;const result={schema:'barocss-gpu-shell-render-flow',version:0,actualGL:false,cases:[],failures:[]};
 try{
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});check(gl,'Actual WebGL2 unavailable');
  const uploads=[],bufferData=gl.bufferData.bind(gl);gl.bufferData=(target,data,usage)=>{if(ArrayBuffer.isView(data))uploads.push({target,type:data.constructor.name,values:[...data]});return bufferData(target,data,usage);};
  const files=[];for(const name of names){const response=await fetch('/native/'+name);check(response.ok,'Native file read refused');const bytes=await response.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);const sha256=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');files.push({name,sha256,native:JSON.parse(new TextDecoder().decode(bytes))});}
  const unionCamera=cameraFor(files[0].native);
  for(const file of files){
   const local={...options,mesh:{...mesh,camera:file.name==='cross_union_distance_edit'?unionCamera:cameraFor(file.native)}},original=structuredClone(file.native);uploads.length=0;
   if(!renderer)renderer=mountBooleanShell(canvas,file.native,local);else check(renderer.update(file.native,local).ok,'Native update refused');
   const pixels=renderer.readPixels(),count=materialCount(pixels);check(same(renderer.native,original),'Native bits/provenance changed');
   if(file.native.mesh.indices.length){check(count>300,'No actual filled Shell pixels');const expected=file.native.mesh.positionsMM.map((n,i)=>Math.fround(n*mesh.mmToSceneUnit+mesh.translate[i%3]));check(same(uploads[0].values,expected),'Actual vertex uploads mismatch');check(same(uploads[1].values,file.native.mesh.normals.map(Math.fround)),'Actual hard normals mismatch');check(same(uploads[2].values,file.native.mesh.indices),'Actual triangles mismatch');
    for(const top of file.native.faceRanges.filter(f=>f.kind==='top-cap')){const t=top.triangles[0];const p=[0,1,2].map(axis=>t.vertexIndices.reduce((s,i)=>s+file.native.mesh.positionsMM[i*3+axis],0)/3);check(isMaterial(pixel(pixels,projected(world(p),local.mesh.camera))),'Missing actual component cap material');}
   }else check(count===0&&renderer.empty,'Empty viewport contains geometry pixels');
   if(file.name==='containment_hole'){
    const top=file.native.faceRanges.find(f=>f.kind==='top-cap'),hole=top.loops.find(l=>l.role==='hole');check(hole,'Authentic hole missing');const vertices=[...new Set(hole.uses.flatMap(u=>u.effectiveVertexIndices))];const center=[0,1,2].map(axis=>vertices.reduce((sum,i)=>sum+file.native.mesh.positionsMM[i*3+axis],0)/vertices.length);check(!isMaterial(pixel(pixels,projected(world(center),local.mesh.camera))),'Native hole is filled');
   }
   if(file.name==='cross_union'){
    const before=hash(pixels),native=renderer.native,counts=renderer.resourceCounts;
    const bad=structuredClone(file.native);bad.faceRanges[0].surfaceId='forged_surface';check(!renderer.update(bad,local).ok,'Forged face accepted');check(hash(renderer.readPixels())===before&&same(renderer.native,native)&&same(renderer.resourceCounts,counts),'Refusal changed frame/source/resources');
    check(!renderer.setOptions({...local,mesh:{...local.mesh,mmToSceneUnit:0}}).ok,'Unsafe view accepted');check(hash(renderer.readPixels())===before,'Invalid view changed pixels');
    const createProgram=gl.createProgram.bind(gl);gl.createProgram=()=>null;try{check(!renderer.setOptions(local).ok,'Forced allocation accepted');}finally{gl.createProgram=createProgram;}check(hash(renderer.readPixels())===before&&same(renderer.resourceCounts,counts),'Program failure changed accepted resources/pixels');
    const copied=renderer.native;copied.faceRanges[0].faceId='mutated_copy';renderer.render();check(same(renderer.native,native)&&hash(renderer.readPixels())===before,'Copied provenance changed authority');
    const old=file.native.mesh.positionsMM[0];file.native.mesh.positionsMM[0]=999;renderer.render();check(hash(renderer.readPixels())===before,'Caller mutation changed accepted frame');file.native.mesh.positionsMM[0]=old;
    uploads.length=0;check(renderer.setOptions({...local,edges:{color:[0.95,0.9,0.1]}}).ok,'Edge toggle refused');const edgePixels=renderer.readPixels();check(hash(edgePixels)!==before,'No actual edge pixel difference');const expectedEdges=file.native.edgePaths.flatMap(p=>p.samples.flatMap(s=>s.curveD1.point)).map((n,i)=>Math.fround(n*mesh.mmToSceneUnit+mesh.translate[i%3]));check(same(uploads[3].values,expectedEdges),'Actual true Curve edge upload mismatch');check(uploads[4].values.length===file.native.edgePaths.length*4,'True path index count mismatch');
    result.edgePixelsChanged=true;renderer.resize(480,360);check(materialCount(renderer.readPixels())>300&&same(renderer.native,native),'Resize changed original authority/lost material');renderer.resize(640,480);
    const orbit={...local,mesh:{...local.mesh,camera:{...local.mesh.camera,eye:[-0.95,0.3,1.15]}}};check(renderer.setOptions(orbit).ok&&materialCount(renderer.readPixels())>300,'Declared orbit failed');check(same(renderer.native,native),'Camera changed native data');check(renderer.setOptions(local).ok,'Restore declared baseline camera refused');
   }
   check(gl.getError()===gl.NO_ERROR,'Actual GL error');result.cases.push({name:file.name,sha256:file.sha256,pixels:count,pixelHash:hash(renderer.readPixels()),faces:renderer.native.faceRanges.length,shells:renderer.native.shellRanges.length,truePaths:renderer.native.edgePaths.length,resources:renderer.resourceCounts});
  }
  check(result.cases[0].pixelHash!==result.cases[4].pixelHash,'Real distance edit did not change framebuffer');
  const native=renderer.native,loss=gl.getExtension('WEBGL_lose_context');check(loss,'Actual context-loss extension unavailable');const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));loss.loseContext();await lost;check(!renderer.update(native,options).ok&&same(renderer.native,native),'Context-loss authority/refusal failed');let readRefused=false;try{renderer.readPixels();}catch{readRefused=true;}check(readRefused,'Context-loss pixel read accepted');renderer.dispose();renderer.dispose();check(Object.values(renderer.resourceCounts).every(n=>n===0),'Owned handles leaked after disposal');
  result.actualGL=true;result.disposedResources=renderer.resourceCounts;status.textContent='PASS '+JSON.stringify(result);document.body.dataset.result='pass';
 }catch(error){result.failures.push(String(error.stack||error));status.textContent='FAIL '+result.failures[0];document.body.dataset.result='fail';if(renderer)renderer.dispose();}
 await fetch('/receipt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)});
});
`;
await mkdir(output,{recursive:true});
await build({stdin:{contents:client,resolveDir:resolve(repo,'examples/gpu-scene'),sourcefile:'shell-render-client.mjs',loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:resolve(output,'client.mjs')});
const html='<!doctype html><html><head><meta charset="utf-8"><title>Native Shell pending GPU flow</title></head><body><canvas width="640" height="480"></canvas><button>Run actual Shell flow</button><pre>Pending actual WebGL2 proof</pre><script type="module" src="/client.mjs"></script></body></html>';
await writeFile(resolve(output,'client-source.mjs'),client);await writeFile(resolve(output,'index.html'),html);
if(buildOnly){await writeFile(resolve(output,'build-only.json'),JSON.stringify({schema:'shell-render-build-only',actualGL:false,browserRun:false,serverStarted:false,clientCompiled:true},null,2)+'\n');console.log('Generated actual-flow client compiled; no server, browser or GL execution.');}
else{
 const server=createServer(async(request,response)=>{
  try{
   if(request.url==='/'&&request.method==='GET'){response.setHeader('content-type','text/html');response.end(html);return;}
   if(request.url==='/client.mjs'&&request.method==='GET'){response.setHeader('content-type','text/javascript');response.end(await readFile(resolve(output,'client.mjs')));return;}
   if(request.method==='GET'&&request.url?.startsWith('/native/')){const name=request.url.slice(8);if(!names.includes(name))throw new Error('Unknown native fixture');response.setHeader('content-type','application/json');response.end(await readFile(resolve(meshes,name+'.owned-extrusion-mesh.json')));return;}
   if(request.url==='/receipt'&&request.method==='POST'){let body='';for await(const chunk of request){body+=chunk;if(body.length>262144)throw new Error('Receipt budget exceeded');}const receipt=JSON.parse(body);await writeFile(resolve(output,'actual-result.json'),JSON.stringify(receipt,null,2)+'\n');response.end('saved');console.log('Actual result received: '+JSON.stringify(receipt));return;}
   response.statusCode=404;response.end('Not found');
  }catch(error){response.statusCode=400;response.end(String(error));}
 });
 server.listen(52215,'127.0.0.1',()=>console.log('Pending own target http://127.0.0.1:52215/; use only after trusted policy restoration.'));
}
