import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {startServer} from '../cad-preview/server.mjs';
import {compileGpu,compileScene,parseScene} from '../../packages/barocss-gpu/dist/index.js';
const output=process.env.BAROCSS_CYLINDER_EVIDENCE;
assert(output&&process.env.PW_DIR&&process.env.CHROME,'Set evidence path and installed browser/runtime paths');await mkdir(output,{recursive:true});
const source='@scene posts{version:1;background:#101820;cylinder #post;box #block;sphere #ball;}cylinder{radius:.6;height:2;color:#e08040;}#post{translate:-1.4 0 0;rotate-x:20deg;rotate-z:-15deg;}#block{size:1 1 1;translate:.4 0 0;color:#4090e0;}#ball{radius:.4;translate:1.7 0 0;color:#80d040;}';
const source0='@scene baseline{version:0;background:#101820;box #b;sphere #s;}#b{size:1 2 .8;translate:-1 0 0;color:#e08040;}#s{radius:.6;translate:1.4 0 0;color:#4090e0;}';
const source1='@scene tilted{version:1;background:#101820;box #block;sphere #ball;}#block{size:1 2 .8;rotate-x:20deg;rotate-y:35deg;rotate-z:-10deg;color:#e08040;}#ball{radius:.6;translate:1.4 0 0;color:#4090e0;}';
const vertexHash='a7ced79fa042f2bd638dca61eed0b28cb711572fe30952b95ef035621ab7408a';
const controls=[{source:source0,fragment:'c4b95dc50621c36148237628216d0f241cf376b013d0f0fe6bc8f857cafe2381',head:'c27d170fd66fc270de9781ed83fb57b256df6f52'},
 {source:source1,sourceVersion:1,fragment:'f30b84c809d687832894996f32551caffadc31d609d9d179b11ae337ac704a76',head:'917da5ad30799551865a3c8a7805ef75f5afd4e8'}];
const hash=s=>createHash('sha256').update(s).digest('hex');
for(const c of controls){const result=compileGpu({kind:'scene',source:c.source,...(c.sourceVersion?{sourceVersion:1}:{})});assert(result.ok);assert.equal(hash(result.execution.shaders.vertex),vertexHash);assert.equal(hash(result.execution.shaders.fragment),c.fragment);assert(!result.execution.shaders.fragment.includes('cylinderDistance'));assert(result.ir.draws.every(d=>!('height'in d)));}
assert.equal(compileGpu({kind:'scene',source:source.replace('version:1','version:0')}).ok,false);
const result=compileGpu({kind:'scene',source,sourceVersion:1});assert(result.ok);assert.equal(result.ir.schemaVersion,2);
const post=result.ir.draws[0];assert.equal(post.kind,'cylinder');assert.equal(post.height,2);assert.equal(post.radius,.6);assert.deepEqual(post.rotateDegrees,[20,0,-15]);assert(result.ir.draws.slice(1).every(d=>!('height'in d)));
assert(Object.isFrozen(result.ast)&&Object.isFrozen(post)&&Object.isFrozen(post.rotateDegrees));
assert.notEqual(post.rotateDegrees,result.execution.scene.objects[0].rotateDegrees);
assert.deepEqual(compileScene(parseScene(source,{sourceVersion:1})),result.execution.shaders);
assert.deepEqual(parseScene(source+'#post{height:3;}cylinder{height:4;}',{sourceVersion:1}).objects[0].height,3);
const defaults=parseScene('@scene defaults{version:1;cylinder #p;}',{sourceVersion:1}).objects[0];assert.equal(defaults.radius,1);assert.equal(defaults.height,2);
const badSource=source+'sphere{height:2;}';const bad=compileGpu({kind:'scene',source:badSource,sourceVersion:1});assert(!bad.ok);assert.equal(badSource.slice(bad.diagnostics[0].range.start,bad.diagnostics[0].range.end),'height');
const structured=structuredClone(result.execution.scene),withoutHeight={...structured.objects[0]};delete withoutHeight.height;
assert.throws(()=>compileScene({...structured,objects:[withoutHeight]}));assert.throws(()=>compileScene({...structured,objects:[{...structured.objects[1],height:2}]}));
assert.throws(()=>parseScene(source.replace('height:2','height:1e-45'),{sourceVersion:1}));
let reads=0;const accessor={...structured.objects[0]};Object.defineProperty(accessor,'height',{enumerable:true,get(){reads++;return 2;}});assert.throws(()=>compileScene({...structured,objects:[accessor]}));assert.equal(reads,0);
function cpuDistance([x,y,z],radius,height){const radial=Math.hypot(x,z)-radius,axial=Math.abs(y)-height/2;return Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0);}
const distances=[[[0,0,0],-.6],[[0,1.2,0],.2],[[.8,0,0],.2],[[.8,1.2,0],Math.sqrt(.08)]].map(([point,expected])=>{const value=cpuDistance(point,post.radius,post.height);assert(Math.abs(value-expected)<1e-12);return{point,value,expected,tolerance:1e-12};});
const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');const server=await startServer();const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],frames=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(server.url+'/#cylinder');await page.waitForFunction(()=>window.examplePreview?.snapshot()?.id==='cylinder');assert(await page.locator('#error').isHidden());assert.equal(await page.locator('select').count(),1);
 const frame=async name=>{const data=await page.evaluate(async()=>{const r=window.examplePreview.renderer,bytes=await crypto.subtle.digest('SHA-256',r.readPixels());return{scene:r.scene,camera:r.camera,hash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};});frames.push({name,...data});await page.screenshot({path:path.join(output,name+'.png')});return data;};
 const gpuDistances=await page.evaluate(()=>{
  const shaders=window.examplePreview.renderer.shaders,c=document.createElement('canvas');c.width=4;c.height=1;
  const gl=c.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true}),compiled=[];let program;
  try{
   const fragment=shaders.fragment.split('void main(){')[0]+`void main(){vec3 controls[4]=vec3[4](vec3(0.0),vec3(0.0,1.2,0.0),vec3(.8,0.0,0.0),vec3(.8,1.2,0.0));float d=cylinderDistance(controls[int(gl_FragCoord.x)],.6,1.0);outputColor=vec4(d*.5+.5,0.0,0.0,1.0);}`;
   for(const [type,text] of [[gl.VERTEX_SHADER,shaders.vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);compiled.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));}
   program=gl.createProgram();compiled.forEach(shader=>gl.attachShader(program,shader));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.viewport(0,0,4,1);gl.disable(gl.DITHER);gl.drawArrays(gl.TRIANGLES,0,3);
   const pixels=new Uint8Array(16);gl.readPixels(0,0,4,1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(gl.getError()!==gl.NO_ERROR)throw new Error('Distance probe WebGL failure');return[0,1,2,3].map(i=>pixels[4*i]/255*2-1);
  }finally{if(program)gl.deleteProgram(program);compiled.forEach(shader=>gl.deleteShader(shader));gl.getExtension('WEBGL_lose_context')?.loseContext();}
 });
 gpuDistances.forEach((value,i)=>assert(Math.abs(value-distances[i].expected)<=2/255,'Actual generated cylinder helper distance, RGBA8 tolerance'));
 const initial=await frame('cylinder-cap-side');assert.equal(initial.scene.objects[0].type,'cylinder');
 const edits=[source.replace('radius:.6','radius:.85'),source.replace('height:2','height:3'),source.replace('20deg','65deg'),source.replace('translate:-1.4 0 0','translate:-1.7 .3 0').replace('color:#e08040','color:#d070d0')];let prior=initial;
 for(let i=0;i<edits.length;i++){assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,edits[i]));const current=await frame('edit-'+i);assert.notEqual(current.hash,prior.hash);prior=current;}
 for(const rejected of [edits.at(-1).replace('height:2','height:0'),edits.at(-1)+'sphere{height:2;}']){assert.equal(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,rejected),false);const retained=await frame('retained-'+frames.length);assert.equal(retained.hash,prior.hash);assert.deepEqual(retained.scene,prior.scene);}
 await page.mouse.move(400,300);await page.mouse.down();await page.mouse.move(455,325,{steps:3});await page.mouse.up();const orbit=await frame('orbit');assert.deepEqual(orbit.scene,prior.scene);assert.notEqual(orbit.hash,prior.hash);
 const backend=await page.evaluate(()=>{const gl=document.getElementById('preview').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 await page.selectOption('#example','box');assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,source0));await frame('source0-control');await page.selectOption('#example','rotated-box');assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,source1));await frame('source1-control');assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'index.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,ast:result.ast,ir:result.ir,execution:result.execution,controls,vertexHash,distances,gpuDistances,gpuDistanceTolerance:2/255,backend,frames,errors,broaderValidation:'deferred'},null,2)+'\n');console.log('Cylinder prototype: source1/IR2 original capped SDF, controls, real radius/height/rotation/color/translation frames, orbit and invalid-frame retention; old source0/source1 bytes passed.');
}finally{await browser.close();await server.close();}
