// One compiled own CAD sampling producer -> compiled own GPU -> actual WebGL2 flow.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),output=process.env.BAROCSS_PRIMITIVE_EVIDENCE;
assert(output,'Unique evidence directory required');await mkdir(output,{recursive:true});
const cad=await import(pathToFileURL(path.join(repo,'packages/barocss-cad/dist/index.js')).href);
const surface=(id,x0,x1)=>'@surface #'+id+' {type:nurbs;degree-u:1;degree-v:1;knots-u:[0,0,1,1];knots-v:[0,0,1,1];control-points:[[['+x0+',-450,0],['+x0+',450,0]],[['+x1+',-450,0],['+x1+',450,0]]];weights:[[1,1],[1,1]];}';
const curve=(id,points,weights)=>'@curve #'+id+' {type:nurbs;degree:2;knots:[-2,-2,-2,7,7,7];control-points:'+JSON.stringify(points)+';weights:'+JSON.stringify(weights)+';}';
const source='@model native_mixed {version:0;length-unit:mm;'+surface('left_patch',-1000,-50)+surface('right_patch',50,1000)+curve('weighted_left',[[-850,-200,100],[-550,400,100],[-150,-100,100]],[1,1.4,1])+curve('weighted_right',[[150,-100,120],[500,450,170],[850,-200,120]],[1,.7,1.2])+'}';
const c=cad.compileCadModel(source,{sourceVersion:0});assert(c.ok,c.diagnostics?.[0]?.message);
const entries=c.model.objects.map(o=>o.kind==='surface'?{kind:'surface',packet:cad.tessellateSurface(o,{countU:2,countV:2,revision:2}).packet,color:o.id==='left_patch'?[.9,.15,.1]:[.15,.9,.1]}:{kind:'curve',sample:cad.sampleCurveAdaptive(o,{chordToleranceMM:4,maxSegments:128,maxDepth:8,resultIdPrefix:o.id==='weighted_left'?'left_draw':'right_draw'}),basis:'authored-xyz-matches-rhyup',color:o.id==='weighted_left'?[0,1,1]:[1,0,1]});
const thin=cad.sampleCurveAdaptive({kind:'curve',id:'tiny_native',degree:1,knots:[2,2,5,5],controlPoints:[[0,0,0],[1,0,0]],weights:[1,1]},{chordToleranceMM:1,maxSegments:1,maxDepth:0,resultIdPrefix:'tiny_draw'});
assert(entries.filter(e=>e.kind==='curve').every(e=>e.sample.domain[0]===-2&&e.sample.domain[1]===7));
await writeFile(path.join(output,'original.barocad'),source);await writeFile(path.join(output,'native-samples.json'),JSON.stringify(entries.filter(e=>e.kind==='curve').map(e=>e.sample),null,2));
const jsData=v=>JSON.stringify(v,(_,n)=>Object.is(n,-0)?'__native_negative_zero__':n).replaceAll('"__native_negative_zero__"','-0');
const html='<!doctype html><html><head><meta charset="utf-8"><title>Own native mixed GPU scene</title></head><body style="background:#12202d;color:#e6f0f5;font:14px system-ui"><h1>Two native Surfaces + two rational Curves</h1><canvas id="stage" width="640" height="480" style="width:640px;height:480px;border:1px solid #456"></canvas><div><button id="run">Run native primitive flow</button></div><pre id="state">Ready</pre><script type="module" src="/proof.js"></script></body></html>';
const proof=`import * as gpu from '/gpu.js';
const entries=${jsData(entries)},thin=${jsData(thin)},canvas=document.querySelector('#stage'),status=document.querySelector('#state'),errors=[],resources={},contexts=new Set(),calls=[];
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
for(const type of ['Buffer','Program','VertexArray','Framebuffer','Texture','Renderbuffer','Shader']){const live=new Set();resources[type]=live;const p=WebGL2RenderingContext.prototype,create=p['create'+type],remove=p['delete'+type];p['create'+type]=function(...args){const v=create.apply(this,args);if(v)live.add(v);return v;};p['delete'+type]=function(v){live.delete(v);return remove.call(this,v);};}
const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const r=get.apply(this,args);if(args[0]==='webgl2'&&r)contexts.add(r);return r;};
for(const method of ['clear','drawElements','drawArrays']){const p=WebGL2RenderingContext.prototype,fn=p[method];p[method]=function(...args){calls.push({method,args});return fn.apply(this,args);};}
function check(v,message){if(!v)throw Error(message);}const bits=v=>JSON.stringify(v,(_,n)=>Object.is(n,-0)?'__negative_zero':n),same=(a,b)=>bits(a)===bits(b),close=(a,b)=>a.length===b.length&&a.every((n,i)=>Math.abs(n-b[i])<2e-6);
function hash(v){let h=2166136261;for(const n of v)h=Math.imul(h^n,16777619);return h>>>0;}
const options={mmToSceneUnit:.001,translate:[0,0,0],background:[.015,.02,.03]},nativeBefore=bits(entries);let scene;
function expected(entry,opts){
 const points=entry.kind==='curve'?entry.sample.pointsMM:entry.packet.positions.reduce((a,n,i)=>{if(i%3===0)a.push(entry.packet.positions.slice(i,i+3));return a;},[]),pose=entry.transform;
 return Float32Array.from(points.flatMap(point=>{let p=pose?point.map((n,i)=>n*pose.scale[i]):point;if(pose&&pose.rotationXYZW[2]!==0)p=[-p[1],p[0],p[2]];return p.map((n,i)=>(n+(pose?.translationMm[i]??0))*opts.mmToSceneUnit+opts.translate[i]);}));
}
function capture(step){
 const gl=canvas.getContext('webgl2'),accepted=scene.entries,opts=scene.options,frame=scene.accepted,pixels=scene.readPixels();let cyan=0,magenta=0;
 for(let i=0;i<pixels.length;i+=4){if(pixels[i]<20&&pixels[i+1]>230&&pixels[i+2]>230)cyan++;if(pixels[i]>230&&pixels[i+1]<20&&pixels[i+2]>230)magenta++;}
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},upload=frame.draws.map((draw,index)=>{
  const entry=accepted[index],wanted=expected(entry,opts),positions=new Float32Array(wanted.length);gl.bindVertexArray(draw.vao);gl.bindBuffer(gl.ARRAY_BUFFER,draw.buffers[0]);gl.getBufferSubData(gl.ARRAY_BUFFER,0,positions);check(close(Array.from(positions),Array.from(wanted)),'Independent actual primitive position buffer mismatch');
  for(let i=0;i<positions.length;i++){const a=i%3;bounds.min[a]=Math.min(bounds.min[a],positions[i]);bounds.max[a]=Math.max(bounds.max[a],positions[i]);}
  if(entry.kind==='curve'){check(draw.buffers.length===1&&!draw.indices&&!draw.normals,'Curve was fabricated as a Surface');check(same(entry.sample,entries[index].sample),'Native Curve coefficients/source/parameters changed');}
  else{check(draw.buffers.length===3&&draw.indices,'Original Surface buffers missing');const norm=new Float32Array(draw.normals.length),indices=new Uint16Array(draw.indices.length);gl.bindBuffer(gl.ARRAY_BUFFER,draw.buffers[1]);gl.getBufferSubData(gl.ARRAY_BUFFER,0,norm);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,draw.buffers[2]);gl.getBufferSubData(gl.ELEMENT_ARRAY_BUFFER,0,indices);check(norm.every((n,i)=>n===Math.fround(entry.packet.normals[i]))&&indices.every((n,i)=>n===entry.packet.indices[i]),'Surface normals/indices changed');}
  gl.bindVertexArray(null);return{kind:entry.kind,id:entry.kind==='curve'?entry.sample.curve.id:entry.packet.surfaceId,positions:Array.from(positions),bufferCount:draw.buffers.length,pointCount:entry.kind==='curve'?entry.sample.pointsMM.length:null,domain:entry.kind==='curve'?entry.sample.domain:null};
 });
 check(same(scene.bounds,bounds),'Mixed display bounds disagree with uploaded buffers');check(gl.getError()===0&&!errors.length,'Actual GL/runtime errors');check(gl.getParameter(gl.LINE_WIDTH)===1,'Curve width is not1 device pixel');
 return{step,entries:accepted,options:opts,bounds:scene.bounds,pixelHash:hash(pixels),cyanPixels:cyan,magentaPixels:magenta,upload,calls:calls.splice(0),contexts:contexts.size,canvasCount:document.querySelectorAll('canvas').length,dimensions:[canvas.width,canvas.height],glError:0,errors:[...errors]};
}
document.querySelector('#run').onclick=async()=>{const receipts=[];try{
 scene=gpu.mountPrimitiveScene(canvas,entries,options);const initial=capture('mixed');receipts.push(initial);check(initial.cyanPixels>30&&initial.magentaPixels>30,'Both genuine native Curves must produce visible line pixels');
 check(same(scene.entries,entries),'Initial native entry authority changed');
 const moved=structuredClone(entries);moved[2].transform={translationMm:[-400,100,200],rotationXYZW:[0,0,Math.SQRT1_2,Math.SQRT1_2],scale:[.7,.9,1.2]};moved[0].transform={translationMm:[0,0,50],rotationXYZW:[0,0,0,1],scale:[1,1,1]};
 check(scene.update(moved,options).ok,'Mixed TRS refused');const transformed=capture('transformed');receipts.push(transformed);check(transformed.pixelHash!==initial.pixelHash,'Mixed transform did not change pixels');
 const copied=scene.entries,bounds=scene.bounds;copied[2].sample.pointsMM[0][0]=999;copied[2].transform.scale[0]=99;bounds.min[0]=999;check(same(scene.entries,transformed.entries)&&same(scene.bounds,transformed.bounds),'Mixed getters alias accepted data');
 function refuse(label,candidate,opts=options){const result=scene.update(candidate,opts);check(!result.ok,label+' accepted');const kept=capture(label);kept.error=result.error.message;receipts.push(kept);check(kept.pixelHash===transformed.pixelHash&&same(kept.entries,transformed.entries)&&same(kept.options,transformed.options)&&same(kept.bounds,transformed.bounds)&&kept.calls.length===0,label+' changed accepted mixed scene');}
 const corrupt=structuredClone(moved);corrupt[2].sample.pointsMM[0][0]+=1;refuse('native-sample-mismatch',corrupt);
 const badBasis=structuredClone(moved);badBasis[3].basis='implicit-z-up';refuse('missing-explicit-basis',badBasis);
 const badPose=structuredClone(moved);badPose[3].transform={translationMm:[0,0,0],rotationXYZW:[0,0,0,.5],scale:[1,1,1]};refuse('invalid-second-curve-pose',badPose);
 let reads=0;const getter=structuredClone(moved);Object.defineProperty(getter[2].sample,'report',{enumerable:true,get(){reads++;return entries[2].sample.report;}});refuse('sample-accessor',getter);check(reads===0,'Native sample getter executed');
 const collapsed=[{kind:'curve',sample:thin,basis:'authored-xyz-matches-rhyup',color:[0,1,1],transform:{translationMm:[0,0,0],rotationXYZW:[0,0,0,1],scale:[.001,.001,.001]}}];refuse('curve-float32-collapse',collapsed,{...options,translate:[500,0,0]});
 const hidden=structuredClone(entries);for(const e of hidden)if(e.kind==='curve')e.transform={translationMm:[0,0,-600],rotationXYZW:[0,0,0,1],scale:[1,1,1]};check(scene.update(hidden,options).ok,'Depth display scene refused');const depth=capture('shared-depth-hidden');receipts.push(depth);check(depth.cyanPixels===0&&depth.magentaPixels===0,'Curves behind actual Surfaces were not occluded');
 check(scene.update(entries,options).ok,'Original mixed reset refused');const reset=capture('reset');receipts.push(reset);check(reset.pixelHash===initial.pixelHash,'Original mixed reset pixels differ');
 scene.resize(480,320);const resized=capture('resized');receipts.push(resized);const retainedHash=resized.pixelHash;let refused=false;try{scene.resize(0,320);}catch{refused=true;}check(refused&&hash(scene.readPixels())===retainedHash,'Invalid resize changed mixed frame');
 scene.render();receipts.push(capture('stable'));check(bits(entries)===nativeBefore,'Caller native entries mutated');
 scene.dispose();scene.dispose();let disposed=false;try{scene.entries;}catch{disposed=true;}check(disposed,'Disposed primitive renderer remains callable');const remaining=Object.fromEntries(Object.entries(resources).map(([k,v])=>[k,v.size]));check(Object.values(remaining).every(v=>v===0),'Mixed GPU resources leaked');
 const result={ok:true,receipts,remaining,disposed:true,callerDataUnchanged:true,lineWidthDevicePixels:1,nativeCurvesNotEdges:true,broaderValidation:'deferred'};await fetch('/result',{method:'POST',body:JSON.stringify(result)});status.textContent='PASS · native Surface + Curve buffers/pixels/poses/shared depth · source retained · invalid record refused · cleanup zero';
 }catch(error){if(scene)scene.dispose();const result={ok:false,message:error.message,receipts,errors};await fetch('/result',{method:'POST',body:JSON.stringify(result)});status.textContent='FAIL · '+error.message;}};`;
let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve;});
const server=createServer(async(req,res)=>{
 if(!/^(?:127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(req.headers.host??'')){res.writeHead(404).end();return;}
 if(req.method==='GET'&&req.url==='/'){res.writeHead(200,{'content-type':'text/html'}).end(html);return;}
 if(req.method==='GET'&&req.url==='/proof.js'){res.writeHead(200,{'content-type':'text/javascript'}).end(proof);return;}
 if(req.method==='GET'&&req.url==='/gpu.js'){res.writeHead(200,{'content-type':'text/javascript'}).end(await readFile(path.join(repo,'packages/barocss-gpu/dist/index.js')));return;}
 if(req.method==='POST'&&req.url==='/result'){let body='';for await(const part of req){body+=part;if(body.length>4194304){res.writeHead(413).end();return;}}const data=JSON.parse(body);await writeFile(path.join(output,'browser.json'),JSON.stringify(data,null,2));resolveDone(data);res.end('Recorded');return;}
 res.writeHead(404).end();
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(Number(process.env.BAROCSS_PRIMITIVE_PORT??52192),'127.0.0.1',resolve);});console.log('Actual native mixed primitive flow http://127.0.0.1:'+server.address().port+'/');
try{const data=await done;assert(data.ok,data.message);for(const r of data.receipts){assert.equal(r.contexts,1);assert.equal(r.canvasCount,1);assert.equal(r.glError,0);assert.deepEqual(r.errors,[]);for(const call of r.calls.filter(c=>c.method==='drawArrays'))assert.equal(call.args[0],3,'Actual LINE_STRIP mode');}assert(data.disposed&&data.callerDataUnchanged);await writeFile(path.join(output,'result.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),ok:true,steps:data.receipts.map(r=>r.step),actualMixedNativeBuffersPixels:true,sourceDomainCoefficientsRetained:true,explicitTRSBounds:true,oneContextSharedDepth:true,lineWidthDevicePixels:1,atomicRefusal:true,ownedDisposal:true,broaderValidation:'deferred'},null,2)+'\n');console.log('Actual native mixed Surface/Curve WebGL2 flow passed.');}
catch(error){await writeFile(path.join(output,'failure.json'),JSON.stringify({message:error.message},null,2));throw error;}
finally{await new Promise(resolve=>server.close(resolve));}
