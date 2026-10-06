import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {startServer} from './server.mjs';
const output=process.env.BAROCSS_NATIVE_TOPOLOGY_EVIDENCE;
assert(output&&process.env.PW_DIR&&process.env.CHROME,'Set evidence and existing runtime/browser paths');await mkdir(output,{recursive:true});
const {chromium}=createRequire(path.join(process.env.PW_DIR,'package.json'))('playwright');const server=await startServer();const browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));
 const snapshot=()=>page.evaluate(()=>window.examplePreview.snapshot());
 const pixelHash=()=>page.evaluate(async()=>{const data=await crypto.subtle.digest('SHA-256',window.examplePreview.readPixels());return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');});
 // Project native mm controls with the actual accepted mesh transform and camera.
 const controls=points=>page.evaluate(async points=>{
  const gpu=await import('/gpu.js'),r=window.examplePreview.renderer,o=r.options,c=document.getElementById('preview'),rgba=r.readPixels(),camera=gpu.prepareCamera(o.camera,c.width/c.height);
  const mul=(m,v)=>[0,1,2,3].map(i=>m[i]*v[0]+m[4+i]*v[1]+m[8+i]*v[2]+m[12+i]*v[3]);
  const samples=points.map(pointMM=>{const world=pointMM.map((n,i)=>n*o.mmToSceneUnit+o.translate[i]),clip=mul(camera.projection,mul(camera.view,[...world,1]));const x=Math.floor((clip[0]/clip[3]+1)*c.width/2),y=Math.floor((clip[1]/clip[3]+1)*c.height/2);if(x<2||y<2||x>=c.width-2||y>=c.height-2)throw new Error('Control projection leaves buffer');const patch=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const offset=((y+dy)*c.width+x+dx)*4;patch.push(...rgba.slice(offset,offset+4));}const offset=(y*c.width+x)*4;return{pointMM,world,clip,pixel:[x,y],color:Array.from(rgba.slice(offset,offset+4)),patch};});
  return{samples,background:Array.from(rgba.slice(0,4)),camera:o.camera,transform:{mmToSceneUnit:o.mmToSceneUnit,translate:o.translate},buffer:[c.width,c.height],glError:c.getContext('webgl2').getError()};
 },points);
 for(const id of ['cad-native-l-shell','cad-native-hole-face']){
  await page.goto(server.url+'/#'+id);await page.waitForFunction(id=>window.examplePreview?.snapshot()?.id===id,id);
  assert(await page.locator('#error').isHidden());assert.equal(await page.locator('select').count(),1);assert.equal(await page.locator('input,button,textarea,aside').count(),0);
  const state=await snapshot(),n=state.native,p=state.packet,onHash=await pixelHash();assert.deepEqual(state.overlay.packet,p);assert.deepEqual(state.overlay.paths,n.preview.edgePaths);assert.equal(new Set(state.overlay.paths.map(path=>path.id)).size,state.overlay.paths.length);
  assert(n.preview.edgeProvenance.every(e=>e.curveId||e.canonical?.curveId));
  if(id==='cad-native-l-shell'){assert.equal(p.positions.length,108);assert.equal(p.indices.length,60);assert.equal(state.overlay.paths.length,18);assert.equal(n.shell.report.faceCount,8);assert.equal(n.shell.report.solid,false);assert.equal(n.preview.faceRanges.length,8);}
  else{assert.equal(p.positions.length,48);assert.equal(p.indices.length,24);assert.equal(state.overlay.paths.length,8);assert.equal(n.face.report.areasMM2.net,84);assert(Math.abs(n.preview.report.area.meshMM2-84)<=n.preview.report.area.comparisonMM2);assert.equal(n.face.report.solid,false);}
  await page.screenshot({path:path.join(output,id+'.png')});
  const front={...state.options,camera:{...state.options.camera,eye:[0,0,6],target:[0,0,0],up:[0,1,0]}};
  assert(await page.evaluate(o=>window.examplePreview.renderer.update(window.examplePreview.renderer.packet,o).ok,front));
  const points=id==='cad-native-hole-face'?[[1,1,0],[5,5,0],[11,5,0],[3,5,0]]:[[.5,3,6],[2,2,6],[0,3,6]];
  const onControls=await controls(points);assert.equal(onControls.glError,0);assert.notDeepEqual(onControls.samples[0].color,onControls.background);assert.deepEqual(onControls.samples[1].color,onControls.background);if(id==='cad-native-hole-face')assert.deepEqual(onControls.samples[2].color,onControls.background);
  const frontHash=await pixelHash();assert(await page.evaluate(()=>window.examplePreview.renderer.setEdgeOverlay(null).ok));const offHash=await pixelHash();assert.notEqual(offHash,frontHash);
  const off=await snapshot(),offControls=await controls(points);assert.deepEqual(off.packet,state.packet);assert.deepEqual(off.native,state.native);assert.deepEqual(offControls.samples[0].color,onControls.samples[0].color);assert.deepEqual(offControls.samples[1].color,onControls.samples[1].color);
  const edgeIndex=points.length-1;assert.notDeepEqual(onControls.samples[edgeIndex].patch,offControls.samples[edgeIndex].patch,'Actual native boundary pixels change with edges');
  await page.screenshot({path:path.join(output,id+'-edges-off.png')});
  assert(await page.evaluate(overlay=>window.examplePreview.renderer.setEdgeOverlay(overlay).ok,state.overlay));assert.equal(await pixelHash(),frontHash);
  await page.screenshot({path:path.join(output,id+'-front.png')});
  const beforeStale=await snapshot(),hashBeforeStale=await pixelHash();const stale=await page.evaluate(()=>{const r=window.examplePreview.renderer,overlay=r.edgeOverlay;overlay.packet.parameters[0]+=.125;const result=r.setEdgeOverlay(overlay);return{ok:result.ok,error:result.error?.message};});assert.equal(stale.ok,false);assert.match(stale.error,/complete accepted mesh/);assert.deepEqual(await snapshot(),beforeStale);assert.equal(await pixelHash(),hashBeforeStale);
  await page.mouse.move(400,300);await page.mouse.down();await page.mouse.move(460,330,{steps:3});await page.mouse.up();const orbit=await snapshot();assert.notEqual(await pixelHash(),frontHash);assert.notDeepEqual(orbit.options.camera,front.camera);assert.deepEqual(orbit.packet,state.packet);assert.deepEqual(orbit.native,state.native);assert.deepEqual(orbit.overlay,state.overlay);assert(orbit.viewRevision>state.viewRevision);
  await page.screenshot({path:path.join(output,id+'-orbit.png')});records.push({id,state,onHash,frontHash,offHash,onControls,offControls,stale,orbit});
 }
 await page.selectOption('#example','sphere');assert(await page.locator('#error').isHidden());assert.equal((await snapshot()).scene.objects[0].type,'sphere');assert.deepEqual(errors,[]);
 const backend=await page.evaluate(()=>{const gl=document.getElementById('preview').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return{version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),glError:gl.getError()};});assert.equal(backend.glError,0);
 await writeFile(path.join(output,'index.json'),JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),records,backend,errors,sphereReselect:true,broaderValidation:'deferred'},null,2)+'\n');console.log('Actual native L shell/hole face rendered with original edges, projected empty regions, edge controls, stale binding rejection, orbit ownership and Sphere reselect passed.');
}finally{await browser.close();await server.close();}
