// One actual native CAD producer -> compiled public GPU -> WebGL2 display flow.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const output=process.env.BAROCSS_MESH_TRANSFORM_EVIDENCE;
assert(output,'Unique evidence directory required');await mkdir(output,{recursive:true});
const require=createRequire(path.join(process.env.REPO_DEPS_ROOT??repo,'package.json'));
const built=await require('esbuild').build({absWorkingDir:repo,entryPoints:['packages/barocss-cad/src/index.ts'],bundle:true,write:false,platform:'node',format:'esm',target:'es2022',metafile:true});
const cad=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
function patch(id,x0,x1){
 const xs=[x0,(x0+x1)/2,x1],ys=[-450,0,450];
 const poles=xs.map((x,u)=>ys.map((y,v)=>[x,y,u===1&&v===1?220:0]));
 return '@surface #'+id+' {type:nurbs;degree-u:2;degree-v:2;knots-u:[0,0,0,1,1,1];knots-v:[0,0,0,1,1,1];control-points:'+JSON.stringify(poles)+';weights:[[1,1,1],[1,1.5,1],[1,1,1]];}';
}
function plane(id,x0,x1,y0,y1,z){return '@surface #'+id+' {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:[[['+x0+','+y0+','+z+'],['+x0+','+y1+','+z+']],[['+x1+','+y0+','+z+'],['+x1+','+y1+','+z+']]];weights:[[1,1],[1,1]];}';}
const originalSource='@model display_original {version:0;length-unit:mm;'+patch('original_left',-1200,-200)+patch('original_right',200,1200)+'}';
const depthSource='@model display_depth {version:0;length-unit:mm;'+plane('native_near',-500,500,-400,400,0)+plane('native_far',-500,500,-400,400,0)+'}';
const collapseSource='@model display_collapse {version:0;length-unit:mm;'+plane('native_thin',0,1,0,1000,0)+'}';
function packets(source,count=5){const c=cad.compileCadModel(source,{sourceVersion:0});assert(c.ok,c.diagnostics?.[0]?.message);return c.model.objects.map(s=>cad.tessellateSurface(s,{countU:count,countV:count,revision:3}).packet);}
const original=packets(originalSource),depth=packets(depthSource,2),thin=packets(collapseSource,2);
for(const[name,source]of [['original',originalSource],['depth',depthSource],['collapse',collapseSource]])await writeFile(path.join(output,name+'.barocad'),source);
await writeFile(path.join(output,'native-source-graph.json'),JSON.stringify(built.metafile,null,2));
let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
const jsData=value=>JSON.stringify(value,(_,n)=>Object.is(n,-0)?'__gpu_negative_zero__':n).replaceAll('"__gpu_negative_zero__"','-0');
const html='<!doctype html><html><head><meta charset="utf-8"><title>GPU per-object display transforms</title></head><body style="background:#12202d;color:#e6f0f5;font:14px system-ui"><h1>Native CAD packets · explicit display transforms</h1><canvas id="stage" width="640" height="480" style="width:640px;height:480px;border:1px solid #456"></canvas><div><button id="run">Run display transform flow</button></div><pre id="state">Ready</pre><script type="module" src="/proof.js"></script></body></html>';
const proof=`import * as gpu from '/gpu.js';
const original=${jsData(original)},depth=${jsData(depth)},thin=${jsData(thin)};
const canvas=document.querySelector('#stage'),status=document.querySelector('#state'),errors=[],resources={};
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
for(const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']){
 const live=new Set();resources[type]=live;const p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];
 p['create'+type]=function(...args){const v=create.apply(this,args);if(v)live.add(v);return v;};p['delete'+type]=function(v){live.delete(v);return remove.call(this,v);};
}
const contexts=new Set(),get=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(...args){const result=get.apply(this,args);if(args[0]==='webgl2'&&result)contexts.add(result);return result;};
const passes=[],p=WebGL2RenderingContext.prototype,clear=p.clear,draw=p.drawElements;
p.clear=function(...args){passes.push('clear');return clear.apply(this,args);};p.drawElements=function(...args){passes.push('draw');return draw.apply(this,args);};
function check(v,message){if(!v)throw Error(message);}
const bits=v=>JSON.stringify(v,(_,n)=>Object.is(n,-0)?'__negative_zero':n),same=(a,b)=>bits(a)===bits(b);
function hash(bytes){let h=2166136261;for(const n of bytes)h=Math.imul(h^n,16777619);return h>>>0;}
const close=(a,b)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<=2e-6);
const options={mmToSceneUnit:.001,translate:[.05,-.03,.02],background:[.015,.02,.03]},entries=original.map((packet,i)=>({packet,color:i?[.15,.9,.15]:[.9,.15,.15]}));
const nativeBefore=bits(original),pose={translationMm:[200,-100,50],rotationXYZW:[0,-0,Math.SQRT1_2*(1+2e-10),Math.SQRT1_2*(1+2e-10)],scale:[.5,2,1.5]};
let scene;
function independentlyExpected(entry,opts){
 if(!entry.transform){const x=gpu.prepareMesh(entry.packet,{...opts,color:entry.color});return [x.positions,x.normals,x.indices];}
 const t=entry.transform,s=t.scale,positions=[],normals=[];
 const quarterTurn=t.rotationXYZW[2]!==0;
 for(let i=0;i<entry.packet.positions.length;i+=3){
  const src=entry.packet.positions.slice(i,i+3).map((n,j)=>n*s[j]);
  const rotated=quarterTurn?[-src[1],src[0],src[2]]:src;
  positions.push(...rotated.map((n,j)=>Math.fround((n+t.translationMm[j])*opts.mmToSceneUnit+opts.translate[j])));
  const n=entry.packet.normals.slice(i,i+3).map((n,j)=>n/s[j]),r=quarterTurn?[-n[1],n[0],n[2]]:n,len=Math.hypot(...r);
  normals.push(...r.map(n=>Math.fround(n/len)));
 }
 return [Float32Array.from(positions),Float32Array.from(normals),Uint16Array.from(entry.packet.indices)];
}
function capture(step){
 const gl=canvas.getContext('webgl2'),accepted=scene.entries,opts=scene.options,frame=scene.accepted,pixels=scene.readPixels();
 let red=0,green=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>80&&pixels[i]>pixels[i+1]*2)red++;if(pixels[i+1]>80&&pixels[i+1]>pixels[i]*2)green++;}
 const expectedBounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 const upload=frame.draws.map(({mesh,vao,buffers},index)=>{
  const expected=independentlyExpected(accepted[index],opts),targets=[gl.ARRAY_BUFFER,gl.ARRAY_BUFFER,gl.ELEMENT_ARRAY_BUFFER];gl.bindVertexArray(vao);
  const actual=expected.map((values,i)=>{const result=new values.constructor(values.length);gl.bindBuffer(targets[i],buffers[i]);gl.getBufferSubData(targets[i],0,result);
   check(accepted[index].transform?close(Array.from(result),Array.from(values)):result.every((n,j)=>Object.is(n,values[j])),'Independent actual display buffer mismatch: '+i);
   return Array.from(result);
  });gl.bindVertexArray(null);
  for(let i=0;i<actual[0].length;i++){const axis=i%3;expectedBounds.min[axis]=Math.min(expectedBounds.min[axis],actual[0][i]);expectedBounds.max[axis]=Math.max(expectedBounds.max[axis],actual[0][i]);}
  check(same(mesh.packet,accepted[index].packet),'Execution rewrote native packet');
  return{surfaceId:mesh.packet.surfaceId,arrays:actual};
 });
 check(same(scene.bounds,expectedBounds),'Scene bounds disagree with actual uploaded vertices');
 check(gl.getError()===0&&!errors.length,'Actual WebGL/runtime errors');
 const centerIndex=((canvas.height>>1)*canvas.width+(canvas.width>>1))*4;
 return{step,entries:accepted,options:opts,bounds:scene.bounds,pixelHash:hash(pixels),redPixels:red,greenPixels:green,center:Array.from(pixels.slice(centerIndex,centerIndex+4)),upload,passes:passes.splice(0),contexts:contexts.size,canvasCount:document.querySelectorAll('canvas').length,glError:0,errors:[...errors]};
}
document.querySelector('#run').onclick=async()=>{
 const receipts=[];try{
  scene=gpu.mountMeshScene(canvas,entries,options);const initial=capture('default');receipts.push(initial);
  check(initial.redPixels>100&&initial.greenPixels>100,'Both original native surfaces must render');
  check(same(scene.entries,entries),'Default entries compatibility failed');
  const moved=entries.map((e,i)=>({...e,...(i===0?{transform:pose}:{})}));
  check(scene.update(moved,options).ok,'Actual nonidentity TRS refused');const transformed=capture('transformed');receipts.push(transformed);
  check(transformed.pixelHash!==initial.pixelHash,'Visible display pose did not change frame');
  check(same(transformed.entries.map(e=>e.packet),original),'Display transform changed original packet/UV/native IDs');
  check(same(transformed.entries[0].transform,pose),'Authored unit-tolerance quaternion bits changed');
  const owned=scene.entries,bounds=scene.bounds,ownedOptions=scene.options;
  owned[0].transform.scale[0]=99;owned[0].packet.positions[0]=999;bounds.min[0]=999;ownedOptions.translate[0]=999;
  check(same(scene.entries,transformed.entries)&&same(scene.bounds,transformed.bounds)&&same(scene.options,transformed.options),'Getter copies alias accepted data');
  const caller=structuredClone(moved);check(scene.update(caller,options).ok,'Copied pose update refused');receipts.push(capture('copied'));
  caller[0].transform.translationMm[0]=9999;check(same(scene.entries,transformed.entries),'Caller pose aliases accepted data');
  function refuse(label,candidate,opts=options){const r=scene.update(candidate,opts);check(!r.ok,label+' accepted');const kept=capture(label);kept.error=r.error.message;receipts.push(kept);check(kept.pixelHash===transformed.pixelHash&&same(kept.entries,transformed.entries)&&same(kept.options,transformed.options)&&same(kept.bounds,transformed.bounds),label+' changed accepted scene');check(kept.passes.length===0,label+' allocated/drew a rejected candidate');}
  const badQuaternion=structuredClone(moved);badQuaternion[1].transform={translationMm:[0,0,0],rotationXYZW:[0,0,0,.5],scale:[1,1,1]};refuse('invalid-second-quaternion',badQuaternion);
  const badScale=structuredClone(moved);badScale[0].transform.scale[0]=-1;refuse('invalid-scale',badScale);
  const overflow=structuredClone(moved);overflow[0].transform.translationMm[0]=10000;refuse('scene-overflow',overflow,{...options,mmToSceneUnit:.2});
  const sparse=structuredClone(moved);delete sparse[0].transform.scale[1];refuse('sparse-pose',sparse);
  let getterReads=0;const accessor=structuredClone(moved);Object.defineProperty(accessor[0].transform,'scale',{enumerable:true,get(){getterReads++;return [1,1,1];}});refuse('accessor-pose',accessor);check(getterReads===0,'Pose accessor executed');
  const collapsed=[{packet:thin[0],color:[1,0,0],transform:{translationMm:[0,0,0],rotationXYZW:[0,0,0,1],scale:[.001,.001,.001]}}];
  refuse('float32-collapse',collapsed,{...options,translate:[500,0,0]});
  check(scene.update(depth.map((packet,i)=>({packet,color:i?[.9,.15,.15]:[.15,.9,.15],transform:{translationMm:[0,0,i?0:200],rotationXYZW:[0,0,0,1],scale:[1,1,1]}})),{...options,translate:[0,0,0]}).ok,'Depth pose scene refused');
  const shared=capture('shared-depth');receipts.push(shared);check(shared.center[1]>shared.center[0]*2,'Near-first posed native surface did not occlude later far draw');
  check(scene.update(entries,options).ok,'Identity reset refused');const reset=capture('reset');receipts.push(reset);check(reset.pixelHash===initial.pixelHash&&same(reset.entries,initial.entries),'Omitted transform changed old identity result');
  check(bits(original)===nativeBefore,'Caller native packets mutated');scene.dispose();scene.dispose();let rejected=false;try{scene.entries;}catch{rejected=true;}check(rejected,'Disposed renderer getter succeeded');
  const remaining=Object.fromEntries(Object.entries(resources).map(([k,v])=>[k,v.size]));check(Object.values(remaining).every(v=>v===0),'GPU resources leaked');
  const result={ok:true,receipts,remaining,callerPacketsUnchanged:true,disposed:true,sourceRole:'actual original CAD coefficients/tessellation',displayRole:'derived per-entry TRS execution only',broaderValidation:'deferred'};
  await fetch('/result',{method:'POST',body:JSON.stringify(result)});status.textContent='PASS · original packets retained; TRS buffers/normals/bounds/pixels/depth; atomic refusal; owned cleanup';
 }catch(error){if(scene)scene.dispose();const result={ok:false,message:error.message,receipts,errors};await fetch('/result',{method:'POST',body:JSON.stringify(result)});status.textContent='FAIL · '+error.message;}
};`;
const server=createServer(async(req,res)=>{
 if(!/^(?:127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(req.headers.host??'')){res.writeHead(404).end();return;}
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html'}).end(html);return;}
 if(req.method==='GET'&&req.url==='/proof.js'){res.writeHead(200,{'content-type':'text/javascript'}).end(proof);return;}
 if(req.method==='GET'&&req.url==='/gpu.js'){res.writeHead(200,{'content-type':'text/javascript'}).end(await readFile(path.join(repo,'packages/barocss-gpu/dist/index.js')));return;}
 if(req.method==='POST'&&req.url==='/result'){let body='';for await(const part of req){body+=part;if(body.length>1048576){res.writeHead(413).end();return;}}const data=JSON.parse(body);await writeFile(path.join(output,'browser.json'),JSON.stringify(data,null,2));resolveDone(data);res.end('Recorded');return;}
 res.writeHead(404).end();
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(process.env.BAROCSS_MESH_TRANSFORM_PORT??52191),'127.0.0.1',resolve);});
console.log('Actual display transform flow http://127.0.0.1:'+server.address().port+'/');
try{
 const data=await done;assert(data.ok,data.message);
 for(const r of data.receipts){assert.equal(r.contexts,1);assert.equal(r.canvasCount,1);assert.equal(r.glError,0);assert.deepEqual(r.errors,[]);}
 assert(data.disposed&&data.callerPacketsUnchanged);assert(Object.values(data.remaining).every(v=>v===0));
 await writeFile(path.join(output,'result.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),ok:true,steps:data.receipts.map(r=>r.step),actualBuffersNormalsBoundsPixels:true,originalAuthorityRetained:true,sharedDepth:true,atomicPoseRefusal:true,disposed:true,broaderValidation:'deferred'},null,2)+'\n');
 console.log('Actual original CAD packet display transform WebGL2 flow passed.');
}catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message},null,2));throw error;}
finally{await new Promise(resolve=>server.close(resolve));}
