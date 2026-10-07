/** One source-only WebGL lifecycle flow. Run this host, then open its printed URL. */
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const browser = `
import * as gpu from './packages/barocss-gpu/src/index.ts';
import * as cad from './packages/barocss-cad/src/index.ts';
import {prepareBoxPreview} from './examples/cad-preview/box-preview.mjs';
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:true,preserveDrawingBuffer:true});
const allocated={buffers:[],programs:[],framebuffers:[],textures:[],renderbuffers:[],vaos:[]},uploads=[];
for(const [method,key] of [['createBuffer','buffers'],['createProgram','programs'],['createFramebuffer','framebuffers'],['createTexture','textures'],['createRenderbuffer','renderbuffers'],['createVertexArray','vaos']]){
 const actual=gl[method].bind(gl);gl[method]=(...args)=>{const resource=actual(...args);if(resource)allocated[key].push(resource);return resource;};
}
const actualUpload=gl.bufferData.bind(gl);gl.bufferData=(target,data,usage)=>{uploads.push({target,data:ArrayBuffer.isView(data)?Array.from(data):null});return actualUpload(target,data,usage);};
const options={mmToSceneUnit:.05,translate:[0,0,0],color:[.2,.7,.9],background:[.025,.035,.055],camera:{eye:[4,3,6],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.01,far:100}};
const equal=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
const uniform=p=>{for(let i=4;i<p.length;i+=4)if(p[i]!==p[0]||p[i+1]!==p[1]||p[i+2]!==p[2]||p[i+3]!==255)return false;return p[3]===255;};
try{
 const viewport=gpu.mountMeshViewport(canvas,options),empty=viewport.readPixels();
 assert(viewport.state.kind==='empty'&&viewport.state.packet===null&&uniform(empty),'Initial display must be opaque true empty');
 assert(allocated.buffers.length===0&&allocated.programs.length===0,'Empty display must allocate no geometry or shader');
 const native=prepareBoxPreview({id:'viewport_box',origin:[-10,-10,-10],sides:[20,20,20],revision:1},cad),packet=native.packet;
 const selection={object:{version:0,packet,objectId:'scene_box',indexRange:[0,packet.indices.length],color:[1,.65,.15]}};
 assert(viewport.update(packet,options,null,selection).ok,'Actual own CAD Box must draw');
 const meshPixels=viewport.readPixels();assert(!uniform(meshPixels)&&!equal(meshPixels,empty),'Mesh pixels must differ from empty');
 assert(viewport.state.kind==='mesh'&&viewport.state.packet.surfaceId==='viewport_box'&&viewport.state.selection.object.objectId==='scene_box','Accepted native packet and selection retained');
 const expected=Array.from(Float32Array.from(packet.positions,n=>n*.05));
 assert(uploads.some(u=>u.target===gl.ARRAY_BUFFER&&u.data&&equal(u.data,expected)),'Original native positions must be uploaded exactly after explicit scale');
 const retained=JSON.stringify(viewport.state),retainedOptions=JSON.stringify(viewport.options);
 const invalid=structuredClone(packet);invalid.indices[0]=-1;
 assert(!viewport.update(invalid,options).ok,'Invalid packet must refuse');
 assert(!viewport.clear({...options,background:[2,0,0]}).ok,'Invalid empty options must refuse');
 const actualFramebuffer=gl.createFramebuffer;gl.createFramebuffer=()=>null;
 const refusedClear=viewport.clear({...options,background:[.2,.2,.2]});gl.createFramebuffer=actualFramebuffer;
 assert(!refusedClear.ok,'Actual GL allocation refusal must retain old mesh');
 assert(JSON.stringify(viewport.state)===retained&&JSON.stringify(viewport.options)===retainedOptions&&equal(viewport.readPixels(),meshPixels),'Failed candidates must retain native state/options/selection/pixels');
 const old={buffers:[...allocated.buffers],programs:[...allocated.programs],framebuffers:[...allocated.framebuffers],textures:[...allocated.textures],renderbuffers:[...allocated.renderbuffers],vaos:[...allocated.vaos]};
 assert(viewport.clear().ok&&viewport.state.kind==='empty'&&viewport.state.selection===null,'Clear accepts no packet/selection');
 assert(uniform(viewport.readPixels()),'Clear must remove old native pixels');
 for(const [key,is] of [['buffers','isBuffer'],['programs','isProgram'],['framebuffers','isFramebuffer'],['textures','isTexture'],['renderbuffers','isRenderbuffer'],['vaos','isVertexArray']]) assert(old[key].every(resource=>!gl[is](resource)),'Clear must release old '+key);
 assert(canvas.getContext('webgl2')===gl,'Stable canvas retains exact context');
 viewport.resize(240,180);assert(viewport.setCamera({...options.camera,eye:[5,4,7]}).ok,'Camera works while empty');viewport.render();
 assert(viewport.state.kind==='empty'&&uniform(viewport.readPixels()),'Resize/camera/render cannot redraw cached mesh');
 const dimensions=[canvas.width,canvas.height];try{viewport.resize(0,180);throw Error('invalid resize accepted');}catch(e){assert(e.message!=='invalid resize accepted','Resize guard');}
 assert(equal([canvas.width,canvas.height],dimensions),'Invalid resize preserves dimensions');
 viewport.dispose();viewport.dispose();
 for(const [key,is] of [['buffers','isBuffer'],['programs','isProgram'],['framebuffers','isFramebuffer'],['textures','isTexture'],['renderbuffers','isRenderbuffer'],['vaos','isVertexArray']]) assert(allocated[key].every(resource=>!gl[is](resource)),'Dispose must release all '+key);
 const glError=gl.getError();assert(glError===0&&errors.length===0,'Actual GL/browser errors must be empty');
 window.result={ok:true,nativeVertices:packet.positions.length/3,nativeTriangles:packet.indices.length/3,originalUpload:true,emptyTransitions:2,allocationRefusal:refusedClear.error.message,sameContext:true,resources:Object.fromEntries(Object.entries(allocated).map(([k,v])=>[k,v.length])),glError,errors};
}catch(error){window.result={ok:false,error:error.stack,errors};}
document.querySelector('pre').textContent=JSON.stringify(window.result,null,2);
fetch('/result',{method:'POST',body:JSON.stringify(window.result)});
`;
const bundle = await build({absWorkingDir:repo,stdin:{contents:browser,resolveDir:repo,sourcefile:'mesh-viewport-source-flow.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,logLevel:'silent'});
const inputs=Object.keys(bundle.metafile.inputs);if(inputs.some(p=>p.includes('/dist/')))throw Error('Source flow imported dist');
const html='<!doctype html><title>Mesh viewport source lifecycle</title><canvas width="256" height="192"></canvas><pre>Running real source flow</pre><script type="module" src="/flow.js"></script>';
const server=createServer(async(req,res)=>{
 if(!/^127\.0\.0\.1(?::[0-9]+)?$/.test(req.headers.host??'')){res.writeHead(404);res.end();return;}
 if(req.method==='POST'&&req.url==='/result'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>16384){res.writeHead(413);res.end();return;}}
  const result=JSON.parse(body);console.log(JSON.stringify({...result,sourceInputs:inputs},null,2));res.writeHead(200);res.end('Recorded');server.close(()=>{process.exitCode=result.ok?0:1;});return;
 }
 const payload=req.method==='GET'&&req.url==='/'?html:req.method==='GET'&&req.url==='/flow.js'?bundle.outputFiles[0].contents:null;
 if(!payload){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':req.url==='/'?'text/html':'text/javascript','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(payload);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
console.log('Open this task-owned source flow: http://127.0.0.1:'+server.address().port+'/');
