import * as cad from '../../packages/barocss-cad/dist/index.js';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readbackPng} from './png.mjs';
import {objectFixtures} from './fixtures.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n';
const normalize=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='revision'||k==='viewRevision'?undefined:x));
async function state(page){return page.evaluate(()=>({snapshot:window.cadPreview.snapshot(),primitive:window.cadPreview.primitiveState(),pixels:Array.from(window.cadPreview.readPixels())}));}
async function download(page,id){const event=page.waitForEvent('download');await page.locator(id).click();const item=await event;return{bytes:await readFile(await item.path()),name:item.suggestedFilename()};}
async function open(page,bytes){await page.locator('#project-open').setInputFiles({name:'test.barocad.json',mimeType:'application/json',buffer:Buffer.from(bytes)});await page.waitForFunction(()=>document.querySelector('#project-open').files.length===0&&(document.querySelector('#project-status').textContent.startsWith('Opened ')||document.querySelector('#project-status').textContent.startsWith('Open rejected:')));}
export async function runProjectBrowser({browser,page,server,evidence,allowed,taskCommit,integrationCommit}){
 const frames=[],records=[],negatives=[],blocked=[],errors=[];
 const currentFields=p=>p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('input:not([type=file]),select,textarea')].map(e=>[e.id,e.value])));
 async function fresh(){
  const p=await browser.newPage({viewport:{width:1280,height:720}});
  p.on('pageerror',error=>errors.push(error.message));
  await p.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==server.url||!allowed.has(url.pathname)||url.search){blocked.push(url.href);return route.abort();}return route.continue();});
  await p.addInitScript(()=>{window.projectProbe={resources:[],violations:[]};document.addEventListener('securitypolicyviolation',e=>window.projectProbe.violations.push(e.violatedDirective));const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const gl=original.apply(this,args);if(gl&&args[0]==='webgl2'&&!gl.projectTracked){gl.projectTracked=true;for(const kind of ['Buffer','Shader','Program','VertexArray','Framebuffer','Renderbuffer','Texture']){const fn=gl['create'+kind].bind(gl);gl['create'+kind]=(...a)=>{const resource=fn(...a);if(resource)window.projectProbe.resources.push({kind,resource,gl});return resource;};}}return gl;};});
  await p.goto(server.url);await p.waitForFunction(()=>window.cadPreview?.snapshot()?.packet);return p;
 }
 async function capture(p,name,primitiveRequest=null,fixture=null){
  const s=(await state(p)).snapshot,bytes=await p.evaluate(()=>Array.from(window.cadPreview.readPixels())),size=await p.locator('#preview').evaluate(e=>[e.width,e.height]);
  const compiled=cad.compileCadModel(s.source,{sourceVersion:s.sourceVersion??0});assert(compiled.ok);const model=compiled.model,surface=model.objects.find(o=>o.id===s.packet.surfaceId);
  assert.deepEqual(normalize(model),normalize(s.model));if(s.sourceVersion===1)assert.deepEqual(compiled.constructions,s.constructions);
  const replay=cad.tessellateSurface(surface,{...s.report.grid,revision:s.revision});assert.deepEqual(replay.packet,s.packet);assert.deepEqual(replay.report,s.report);assert.deepEqual(cad.exportIGES(model,[surface.id]),s.iges);
  const native=await download(p,'#export');assert.equal(native.bytes.toString(),s.iges.iges);
  const data={'ast.json':json(compiled.ast),'ir.json':json(compiled.ir),'diagnostics.json':json(compiled.diagnostics),'source.css':s.source,'model.json':json(s.model),'packet.json':json(s.packet),'report.json':json(s.report),'display.json':json({options:s.options,revision:s.revision,viewRevision:s.viewRevision}),'iges.json':json(s.iges),'igs':s.iges.iges,'downloaded.igs':native.bytes,'png':readbackPng(bytes,...size)};
  if(s.sourceVersion===1){data['constructions.json']=json(s.constructions);data['selected-construction.json']=json(s.selectedConstruction);}
  if(primitiveRequest)data['primitive.json']=json({requested:primitiveRequest});
  if(fixture){data['objects.json']=json(await p.evaluate(()=>window.cadPreview.objects()));data['inspection.json']=json(await p.evaluate(()=>window.cadPreview.inspection()));}
  const hashes={};for(const [suffix,content]of Object.entries(data)){const file=name+'.'+suffix;await writeFile(path.join(evidence,file),content);hashes[file]=hash(content);}
  const glError=await p.locator('#preview').evaluate(e=>e.getContext('webgl2').getError());assert.equal(glError,0);
  const frame={sourceReplayed:true,packetReplayed:true,reportReplayed:true,glError,certified:false,name,taskCommit,integrationCommit,sourceVersion:s.sourceVersion??0,revision:s.revision,viewRevision:s.viewRevision,displayedId:s.packet.surfaceId,inspectedId:s.packet.surfaceId,fixtureId:fixture?.selectorId??null,primitiveRequest,hashes,actualReadPixels:true,readbackHash:hash(Uint8Array.from(bytes))};frames.push(frame);return frame;
 }
 // Actual UI Create -> Update -> downloaded accepted file -> separate fresh page Open.
 for(const kind of ['sheet','quarter-wall']){
  await page.locator('#discard-source').click();await page.selectOption('#primitive-kind',kind);await page.fill('#primitive-size','100');await page.fill('#primitive-height','100');await page.click('#primitive-create');
  const size=kind==='sheet'?128.5:42.375,height=76.625;await page.fill('#primitive-size',String(size));await page.fill('#primitive-height',String(height));await page.click('#primitive-update');
  if(kind==='sheet'){await page.locator('#camera-panel').evaluate(e=>e.open=true);await page.fill('#camera-target','-0,0,0');await page.click('#camera-apply');}
  const saved=await state(page);
  // Save must ignore every staged numeric/source value.
  await page.evaluate(()=>{document.querySelector('#count-u').value='63';document.querySelector('#camera-fov').value='99';document.querySelector('#primitive-size').value='299';document.querySelector('#source').value+=' /* pending */';});
  const file=await download(page,'#project-save');assert(file.name.endsWith('.barocad.json'));const record=JSON.parse(file.bytes.toString());assert.equal(record.source,saved.snapshot.source);assert.deepEqual(record.grid,saved.snapshot.report.grid);assert.deepEqual(record.options,saved.snapshot.options);assert.equal(record.primitive.size,size);if(kind==='sheet'){assert(Object.is(record.options.camera.target[0],-0));assert(Object.is(saved.snapshot.options.camera.target[0],-0));}
  const filename=`project-${kind}.barocad.json`;await writeFile(path.join(evidence,filename),file.bytes);
  const p=await fresh();await open(p,file.bytes);assert((await p.locator('#project-status').textContent()).startsWith('Opened '));const reopened=await state(p);
  assert.deepEqual(normalize(reopened.snapshot),normalize(saved.snapshot));assert.deepEqual(reopened.pixels,saved.pixels);assert.deepEqual(reopened.primitive,saved.primitive);assert.equal(reopened.snapshot.revision,2);assert.equal(await p.locator('#source').inputValue(),record.source);
  await capture(p,`project-reopened-${kind}`,{kind,size,height});
  await p.fill('#primitive-size',String(size+1.125));await p.fill('#primitive-height','90.75');await p.click('#primitive-update');assert.equal((await state(p)).primitive.size,size+1.125);
  await p.locator('#preview').scrollIntoViewIfNeeded();const box=await p.locator('#preview').boundingBox(),before=await state(p);await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:3});await p.mouse.up();const after=await state(p);assert(after.snapshot.options.camera.eye[1]>before.snapshot.options.camera.eye[1]);assert.equal(after.snapshot.revision,before.snapshot.revision);assert.deepEqual(after.primitive,before.primitive);
  await capture(p,`project-continued-${kind}`,{kind,size:size+1.125,height:90.75});
  const repeated=await p.evaluate(()=>{const h=window.cadPreview,record=h.projectState(),renderer=h.renderer,live=()=>window.projectProbe.resources.filter(({kind,resource,gl})=>gl['is'+kind](resource)).length,before=live();for(let i=0;i<12;i++){const r=h.loadProject(record,h.snapshot().source);if(!r.ok)throw Error(r.error);h.projectState();}return{before,after:live(),sameRenderer:renderer===h.renderer};});assert.equal(repeated.before,repeated.after);assert(repeated.sameRenderer);
  records.push({kind,file:filename,fileHash:hash(file.bytes),savedRevision:saved.snapshot.revision,reopenedRevision:reopened.snapshot.revision,identicalPixels:true,continuedDimensions:true,orbitPreservedGeometry:true,repeated});
  await p.close();
 }
 // Both native and construction multi-object projects retain the explicitly shown output.
 for(const fixture of objectFixtures){
  await page.selectOption('#fixture',fixture.selectorId);await page.locator('[data-object-id="oblique_wall"] [data-action="show"]').click();const saved=await state(page),file=await download(page,'#project-save');
  assert.equal(JSON.parse(file.bytes).primitive,null);const filename=`project-${fixture.selectorId}.barocad.json`;await writeFile(path.join(evidence,filename),file.bytes);
  const p=await fresh();await open(p,file.bytes);const reopened=await state(p);assert.deepEqual(normalize(reopened.snapshot),normalize(saved.snapshot));assert.deepEqual(reopened.pixels,saved.pixels);assert.equal(reopened.primitive,undefined);assert.equal(await p.locator('#primitive-update').isDisabled(),true);
  await capture(p,`project-${fixture.selectorId}`,null,fixture);records.push({fixtureId:fixture.selectorId,file:filename,fileHash:hash(file.bytes),selectedSurface:'oblique_wall',identicalPixels:true,manualOwnership:true});await p.close();
 }
 const p=await fresh(),base=await state(p),record=await p.evaluate(()=>window.cadPreview.projectState());
 // UI failures preserve all accepted and staged controls, including a pending raw source.
 await p.evaluate(()=>{document.querySelector('#source').value+=' pending';document.querySelector('#primitive-size').value='207';document.querySelector('#camera-fov').value='99';});const pending=await currentFields(p);await open(p,json(record));assert.match(await p.locator('#project-status').textContent(),/pending source/);assert.deepEqual(await state(p),base);assert.deepEqual(await currentFields(p),pending);await p.locator('#source-toggle').click();await p.locator('#discard-source').click();
 const badFiles=[['empty',''],['oversize','x'.repeat(300*1024+1)],['json','{'],['format',json({...record,format:'foreign'})],['version',json({...record,version:2})],['foreign',json({...record,extra:1})],['dangerous','{"__proto__":{}}'],['nonfinite',json(record).replace('"countU": 17','"countU": 1e999')],['source',json({...record,source:'invalid grammar'})],['options',json({...record,options:{...record.options,mmToSceneUnit:0}})],['primitive',json({...record,primitive:{kind:'sheet',size:100,height:100}})],['curve',json({...record,sourceVersion:objectFixtures[1].sourceVersion,source:objectFixtures[1].source,surfaceId:'arc'})],['utf8',Buffer.from([255])]];
 for(const[name,bytes]of badFiles){const old=await state(p),fields=await currentFields(p);await open(p,bytes);const message=await p.locator('#project-status').textContent();assert.match(message,/Open rejected:/,name);assert.deepEqual(await state(p),old,name);assert.deepEqual(await currentFields(p),fields,name);negatives.push({name,message,retained:true});}
 const prior=await state(p);const rejected=await p.evaluate(record=>{const gl=document.querySelector('#preview').getContext('webgl2'),original=gl.getError.bind(gl);let injected=false;gl.getError=()=>{if(!injected){injected=true;return 0x500;}return original();};const r=window.cadPreview.loadProject(record,window.cadPreview.snapshot().source);gl.getError=original;return r;},record);assert.equal(rejected.ok,false);assert.deepEqual(await state(p),prior);
 await p.setViewportSize({width:1440,height:900});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(evidence,'project-desktop.ui.png'),fullPage:true});await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:path.join(evidence,'project-mobile.ui.png'),fullPage:true});
 await p.locator('#project-save').focus();assert.equal(await p.evaluate(()=>document.activeElement.id),'project-save');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'project-open');assert(await p.locator('#project-open').evaluate(e=>e.labels.length>0));
 assert((await p.evaluate(()=>window.cadPreview.createPrimitive({kind:'sheet',size:100,height:100},window.cadPreview.snapshot().source))).ok);
 const lifecycle=await p.evaluate(async record=>{const h=window.cadPreview,s=h.snapshot(),owner=h.primitiveState(),gl=document.querySelector('#preview').getContext('webgl2');gl.getExtension('WEBGL_lose_context').loseContext();await new Promise(r=>document.querySelector('#preview').addEventListener('webglcontextlost',r,{once:true}));const loss=h.loadProject(record,s.source);h.dispose();const disposed=h.loadProject(record,s.source);return{lossRejected:!loss.ok,disposedRejected:!disposed.ok,retained:JSON.stringify(h.snapshot())===JSON.stringify(s),ownerRetained:JSON.stringify(h.primitiveState())===JSON.stringify(owner),violations:window.projectProbe.violations};},record);assert(lifecycle.lossRejected&&lifecycle.disposedRejected&&lifecycle.retained&&lifecycle.ownerRetained);assert.deepEqual(lifecycle.violations,[]);await p.close();
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 const result={taskCommit,integrationCommit,records,negatives,drawFailureRetained:true,pendingFieldsRetained:true,lifecycle,keyboardFocus:true,noOverflow:true,errors,blocked,frames};await writeFile(path.join(evidence,'project-lineage.json'),json(result));return result;
}
