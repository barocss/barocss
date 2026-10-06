import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {startServer} from '../cad-preview/server.mjs';
import {compileGpu,compileScene,parseScene} from '../../packages/barocss-gpu/dist/index.js';

const output=process.env.BAROCSS_ROTATION_EVIDENCE;
assert(output&&process.env.PW_DIR&&process.env.CHROME,'Set evidence path and installed browser/runtime paths');
await mkdir(output,{recursive:true});
const baseline='@scene baseline{version:0;background:#101820;box #b;sphere #s;}#b{size:1 2 .8;translate:-1 0 0;color:#e08040;}#s{radius:.6;translate:1.4 0 0;color:#4090e0;}';
const source='@scene tilted{version:1;background:#101820;box #block;sphere #ball;}#block{size:1 2 .8;rotate-x:20deg;rotate-y:35deg;rotate-z:-10deg;color:#e08040;}#ball{radius:.6;translate:1.4 0 0;color:#4090e0;}';
const hash=s=>createHash('sha256').update(s).digest('hex');
const old=compileGpu({kind:'scene',source:baseline});assert(old.ok);
// Captured from unchanged c27d170f built baseline, not from the new implementation.
const baselineHashes={vertex:'a7ced79fa042f2bd638dca61eed0b28cb711572fe30952b95ef035621ab7408a',fragment:'c4b95dc50621c36148237628216d0f241cf376b013d0f0fe6bc8f857cafe2381'};
assert.equal(hash(old.execution.shaders.vertex),baselineHashes.vertex);
assert.equal(hash(old.execution.shaders.fragment),baselineHashes.fragment);
assert.equal(old.ir.schemaVersion,1);assert(!('rotateDegrees'in old.ir.draws[0]));
assert.equal(compileGpu({kind:'scene',source}).ok,false);
assert.equal(compileGpu({kind:'scene',source:source.replace('version:1','version:0')}).ok,false);
assert.equal(compileGpu({kind:'scene',source:baseline,sourceVersion:1}).ok,false);
const result=compileGpu({kind:'scene',source,sourceVersion:1});assert(result.ok);
assert(Object.isFrozen(result.ast));
assert.equal(result.ir.schemaVersion,2);assert.equal(result.ast.sourceVersion,1);
assert.deepEqual(result.ir.draws[0].rotateDegrees,[20,35,-10]);
assert.deepEqual(result.ir.draws[1].rotateDegrees,[0,0,0]);
assert(Object.isFrozen(result.ir.draws[0].rotateDegrees));
assert.notEqual(result.ir.draws[0].rotateDegrees,result.execution.scene.objects[0].rotateDegrees);
const structured=structuredClone(parseScene(source,{sourceVersion:1}));
assert.deepEqual(compileScene(structured),result.execution.shaders);
structured.objects[0].rotateDegrees[0]=90;assert.equal(result.execution.scene.objects[0].rotateDegrees[0],20);
assert.throws(()=>compileScene({...structured,objects:[{...structured.objects[0],rotateDegrees:[1,,3]}]}));
let getterCalls=0;const bad={...structured.objects[0]};Object.defineProperty(bad,'rotateDegrees',{enumerable:true,get(){getterCalls++;return[0,0,0];}});
assert.throws(()=>compileScene({...structured,objects:[bad]}));assert.equal(getterCalls,0);
assert.deepEqual(parseScene(source+'box{rotate-x:5deg;rotate-y:4deg;}#block{rotate-z:15deg;}',{sourceVersion:1}).objects[0].rotateDegrees,[20,35,15]);
const wrong=source.replace('20deg','20rad'),invalid=compileGpu({kind:'scene',source:wrong,sourceVersion:1});assert(!invalid.ok);
assert.equal(wrong.slice(invalid.diagnostics[0].range.start,invalid.diagnostics[0].range.end),'20rad');
// Independent sequential CPU inverse axes vs coefficients in the actual generated shader.
function inverseSequential(p,degrees){let[x,y,z]=p;const[a,b,c]=degrees.map(d=>d*Math.PI/180);
 [x,y]=[Math.cos(c)*x+Math.sin(c)*y,-Math.sin(c)*x+Math.cos(c)*y];
 [x,z]=[Math.cos(b)*x-Math.sin(b)*z,Math.sin(b)*x+Math.cos(b)*z];
 [y,z]=[Math.cos(a)*y+Math.sin(a)*z,-Math.sin(a)*y+Math.cos(a)*z];return[x,y,z];}
function matrixCheck(compilation,degrees){const m=compilation.execution.shaders.fragment.match(/mat3\(([^)]+)\)/)[1].split(',').map(Number);
 for(const p of [[1,0,0],[0,1,0],[0,0,1],[.4,-.6,.8]]){const actual=[0,1,2].map(i=>m[i]*p[0]+m[3+i]*p[1]+m[6+i]*p[2]);const expected=inverseSequential(p,degrees);actual.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-6));}return m;}
const matrix=matrixCheck(result,[20,35,-10]);
const control=compileGpu({kind:'scene',source:source.replace('20deg','90deg').replace('35deg','0deg').replace('-10deg','0deg'),sourceVersion:1});assert(control.ok);matrixCheck(control,[90,0,0]);
assert.deepEqual(inverseSequential([0,1,0],[90,0,0]).map(v=>Math.round(v)),[0,0,-1]);
const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');
const server=await startServer();const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],frames=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(server.url+'/#rotated-box');
 await page.waitForFunction(()=>window.examplePreview?.snapshot()?.id==='rotated-box');
 assert(await page.locator('#error').isHidden());assert.equal(await page.locator('select').count(),1);
 const frame=async name=>{const data=await page.evaluate(async()=>{const r=window.examplePreview.renderer,bytes=await crypto.subtle.digest('SHA-256',r.readPixels());return{scene:r.scene,camera:r.camera,hash:Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')};});frames.push({name,...data});await page.screenshot({path:path.join(output,name+'.png')});return data;};
 const initial=await frame('initial');assert.equal(initial.scene.version,1);
 const unrotated=source.replace('20deg','0deg').replace('35deg','0deg').replace('-10deg','0deg');
 assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,unrotated));const zero=await frame('unrotated');assert.notEqual(initial.hash,zero.hash);
 assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,source));const rotated=await frame('rotated');assert.equal(initial.hash,rotated.hash);
 const edited=source.replace('color:#e08040','translate:-.5 .2 0;color:#7cd8ca');
 assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,edited));const update=await frame('source-updated');assert.notEqual(update.hash,rotated.hash);
 for(const rejected of [edited.replace('20deg','20rad'),edited.replace('35deg','361deg'),baseline]){assert.equal(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,rejected),false);assert.equal((await frame('rejected-'+frames.length)).hash,update.hash);}
 const before=JSON.stringify(update.scene);await page.mouse.move(400,300);await page.mouse.down();await page.mouse.move(455,330,{steps:3});await page.mouse.up();const orbit=await frame('orbit');assert.equal(JSON.stringify(orbit.scene),before);assert.notEqual(orbit.hash,update.hash);
 const backend=await page.evaluate(()=>{const gl=document.getElementById('preview').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 await page.selectOption('#example','box');assert(await page.locator('#error').isHidden());assert(await page.evaluate(s=>window.examplePreview.renderer.update(s).ok,baseline));await frame('source0-baseline');assert.deepEqual(errors,[]);
 await writeFile(path.join(output,'index.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source,baseline,baselineHead:'c27d170fd66fc270de9781ed83fb57b256df6f52',baselineHashes,ast:result.ast,ir:result.ir,execution:result.execution,matrix,backend,frames,errors,broaderValidation:'deferred'},null,2)+'\n');
 console.log('Rotation prototype: source1/IR2, independent inverse-axis checks, real shader frames/edits/orbit, invalid-frame retention and exact source0 shader bytes passed.');
}finally{await browser.close();await server.close();}
