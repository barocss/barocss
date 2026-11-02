// Executes the actual production grid WGSL on an owned public WebGPU pipeline.
// This isolates signed clipping/fade. It does not enable manual grid in Viewer or bypass its existing refusal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const dist=fileURLToPath(new URL('../dist/',import.meta.url)),cad=fileURLToPath(new URL('../../barocss-cad/dist/',import.meta.url));
const fixture=fileURLToPath(new URL('./fixtures/grid-fade-browser.html',import.meta.url));
const hash=bytes=>createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
function admitted(result){
 assert.ok(result.nonzero>1000,`actual grid pixels ${result.nonzero}`);
 for(const probe of result.probes){
  assert.ok(probe.depth>0&&probe.depth<1,'physical grid probe is inside authored signed clip interval');
  assert.ok(probe.t>0,'grid intersection lies after the admitted near-plane ray origin');
  assert.ok(probe.grazing>.25,'fixed grid probes are nongrazing');
  assert.ok(probe.sample.alpha>25&&probe.sample.rgb>20,`physical grid line is visible: ${JSON.stringify(probe)}`);
 }
}

test('production orthographic grid fades from the eye plane across signed clips, oblique and behind-eye rays', {timeout:120000},async t=>{
 if(!process.env.CHROME||!process.env.PW_DIR){t.skip('CHROME and PW_DIR required');return;}
 const out=process.env.GPU_GRID_FADE_EVIDENCE_DIR;if(out)await mkdir(out,{recursive:false});
 const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
 const server=createServer(async(req,res)=>{
  try{
   if(req.url==='/'){res.setHeader('content-type','text/html');res.end(await readFile(fixture));return;}
   if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
   const base=req.url.startsWith('/cad/')?cad:dist,path=resolve(base,'.'+(base===cad?req.url.slice(4):req.url));
   if(!path.startsWith(base)||!path.endsWith('.js')){res.writeHead(404);res.end();return;}
   res.setHeader('content-type','text/javascript');res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
 });
 let browser,page,cleanup,complete=false;const errors=[],results=[];
 try{
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});
  page=await browser.newPage({viewport:{width:600,height:600}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!!window.gridFade);
  const adapter=await page.evaluate(()=>window.gridFade.initialize());
  if(out)await writeFile(join(out,'production-grid.wgsl'),adapter.source);
  async function render(name,near,far,label){
   const r=await page.evaluate(([name,near,far])=>window.gridFade.render(name,near,far),[name,near,far]);
   const digest=hash(r.rgba);results.push({...r,rgba:undefined,rgbaSha256:digest});
   if(out){await writeFile(join(out,label+'.rgba'),Uint8Array.from(r.rgba));await page.locator('canvas').screenshot({path:join(out,label+'.png')});}
   admitted(r);return{r,digest};
  }
  const axial=[];for(const [i,range]of [[-4,4],[.25,4.25],[-32,32]].entries())axial.push(await render('axial',...range,`axial-${i}`));
  assert.equal(axial[1].digest,axial[0].digest,'fixed orthographic eye/ray/plane is independent of positive near');
  assert.equal(axial[2].digest,axial[0].digest,'wide negative near must not erase the grid');
  for(const [i,range]of [[-4,4],[-32,32]].entries()){
   const b=await render('behind',...range,`behind-${i}`);assert.equal(b.digest,axial[0].digest,'signed admitted behind-eye plane has the same absolute fade distance');
   assert.ok(b.r.probes.every(p=>p.signedEyePlaneDistance<0));
  }
  const oblique=[];for(const [i,range]of [[-4,4],[.25,8.25],[-32,32]].entries())oblique.push(await render('oblique',...range,`oblique-${i}`));
  const perspective=[];for(const [i,range]of [[.25,8.25],[.5,16.5],[2**-10,64]].entries())perspective.push(await render('perspective',...range,`perspective-${i}`));
  // The packet fields defining optics, eye, grid style and ordinary metadata are fixed across these controls.
  for(const family of [axial,oblique,perspective])for(const sample of family.slice(1)){
   assert.deepEqual(sample.r.state,family[0].r.state);assert.deepEqual(sample.r.packet.slice(16,36),family[0].r.packet.slice(16,36));
   assert.deepEqual(sample.r.packet.slice(240,248),family[0].r.packet.slice(240,248));assert.deepEqual(sample.r.packet.slice(580),new Array(12).fill(0));
  }
  assert.deepEqual(errors,[]);complete=true;
  t.diagnostic(JSON.stringify({adapter:{vendor:adapter.vendor,architecture:adapter.architecture},frames:results.length,nonzero:results.map(r=>r.nonzero),axialHash:axial[0].digest,ordinaryGridBehaviorCorrection:true}));
 }finally{
  if(page&&!page.isClosed())try{cleanup=await page.evaluate(()=>window.gridFade?.dispose());}catch(e){cleanup={error:String(e)};}
  await browser?.close();await new Promise(done=>server.close(done));
  if(out)await writeFile(join(out,'receipt.json'),JSON.stringify({complete,results,errors,cleanup,resourcesClosed:true},null,2));
 }
 assert.deepEqual(cleanup,{disposed:true,ownDevice:true});
});
