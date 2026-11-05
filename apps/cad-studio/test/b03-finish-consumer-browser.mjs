// D543_SOURCE_FROZEN=1 node test/b03-finish-consumer-browser.mjs /ABS/NEW/OUTPUT
// Exact retained rectangular Chamfer/Through-Hole current consumer. Root owns execution.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {seedPath,seedBytes,seedSHA256,seedText,originalSeedDoc,originalSeedJSON,originalSeedSHA256,states,builderFiles,previewGuard,oracleStatus,inspectorSource,oracleSource} from './b03-finish-consumer-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const originalSeedFile='/tmp/barocss-d449-category-run01/chamfer-edited.bcad',saved=await readFile(seedPath),original=await readFile(originalSeedFile);
assert.equal(saved.length,seedBytes);assert.equal(sha256(saved),seedSHA256);assert.equal(saved.toString(),seedText);assert.deepEqual(JSON.parse(saved),states.B.doc);
assert.equal(original.length,607);assert.equal(sha256(original),originalSeedSHA256);assert.equal(original.toString(),originalSeedJSON);assert.deepEqual(JSON.parse(original),originalSeedDoc);
const pinsFile='/tmp/barocss-d543-preflight01/source-pins.json',pins=JSON.parse(await readFile(pinsFile));assert.equal(Object.keys(pins).length,475);
for(const[file,digest]of Object.entries(pins))assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Current control source pin: ${file}`);
const controlDir='/tmp/barocss-d543-control01',controlReceiptFile=join(controlDir,'receipt.json'),controlReceipt=JSON.parse(await readFile(controlReceiptFile));assert.equal(controlReceipt.status,'PASS_CURRENT_D543_NATIVE_AB_ONLY');
const controlFiles=[],nativeCache=new Map();
for(const name of ['A','B']){
  const file=join(controlDir,`${name}-native-before-assert.json`),bytes=await readFile(file),read=JSON.parse(bytes),state=states[name],row=controlReceipt.rows.find(row=>row.label===name);controlFiles.push(file);
  assert.equal(row.status,'PASS_ONE_CURRENT_D543_NATIVE_CLASS_ONLY');assert.equal(row.packetSHA256,sha256(bytes));assert.equal(row.documentSHA256,state.documentSHA256);assert.equal(read.ok,true);assert.equal(read.inputUnchanged,true);
  assert.equal(read.documentJSON,state.documentJSON);assert.equal(read.documentSHA256,state.documentSHA256);assert.equal(sha256(read.documentJSON),state.documentSHA256);assert.deepEqual(read.request.parameters,state.parameters);
  nativeCache.set(state.documentSHA256,{read,label:`NEW-current-D543-control-${name}`,file,sha256:sha256(bytes)});
}
const projectName=`D543-${randomUUID()}`,partName='D543-chamfer-consumer',producers=[...Object.keys(pins),'packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/app/commands.ts','apps/cad-studio/src/viewport/vertexPick.ts'];
const f=await createFlow({name:'b03-finish-consumer',envFrozen:'D543_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D543 retained Chamfer/Hole: exactB Open/Distance3A/newChamfer1000 preview refusal-FIRSTUndoRedo/ownSaveOpenA/postDistance2B',
  initialFiles:['apps/cad-studio/test/b03-finish-consumer-browser.mjs',...builderFiles,seedPath,originalSeedFile,pinsFile,controlReceiptFile,...controlFiles],
  extraFrozen:producers,requiredFrozen:[...builderFiles,...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','apps/cad-studio/src/ui/Hud.tsx','apps/cad-studio/src/viewport/Viewport.tsx'].map(file=>relative(repo,resolve(repo,file))),
  limits:['Desktop WebGPU1440x900 only; root must view original screenshots.',
    'One exact retained rectangular Chamfer plus disjoint ThroughHole branch; no new creation, stitched Fillet branch, wholeB03 or wholeCAD acceptance.',
    'Only NEW exact current D543 native packets are reused after all producer/builder pins; every consumer has a fresh Worker and new unchanged D533 Python join.',
    'The guard is a genuine new Chamfer1000 refused preview/disabled Apply/Cancel, not committed NodeEditor invalid Apply or separately synthesized native guard.',
    'Original D533 readiness FAIL, D542 observer FAIL and D501 custody FAIL remain separate. Positive tapped remains without eligible authored data.',
    'Same-context project reload is not cold-process persistence. No export/download/mobile/release or general finishing claim.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    hudFields:[...document.querySelectorAll('.hud input,.hud select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    hudError:document.querySelector('.hud-error')?.textContent??null,selected:window.__studioSelection?.selection??null,dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed={file:seedPath,bytes:seedBytes,sha256:seedSHA256,authority:'Actual saved B input; distinct original607B Chamfer-only seed goes to unchanged Python'};
f.report.controls={receipt:controlReceiptFile,receiptSHA256:sha256(await readFile(controlReceiptFile)),pinsFile,pinsSHA256:sha256(await readFile(pinsFile)),matchedPins:Object.keys(pins).length,packets:[...nativeCache.values()].map(({read,...metadata})=>metadata)};
f.report.pythonSeed={file:originalSeedFile,bytes:607,sha256:originalSeedSHA256,authority:'Exact original D533 Chamfer-only seedDoc for unchanged Python; never substituted savedB'};
f.report.independentUV={status:'NOT_EXERCISED',maximumPcurveLiftGapMM:null,rawOracleOutput:'Preserved unchanged; empty-loop zero aggregate is not a zero-error UV proof'};
f.report.projectName=projectName;let projectCreated=false,newCaptures=0;const labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
async function qualify(label,doc,parameters){
  f.phase=label;await f.same(doc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),prior=nativeCache.get(key),read=prior?.read??await f.inspect(`${label}-native`,state.doc,{label,parameters});if(!prior)newCaptures++;
  f.report.reads.push({label,read,exactWholeDocSha256:key,reusedFrom:prior?.label??null});
  const input={doc:state.doc,documentJSON:state.documentJSON,expectedDoc:doc,seedDoc:originalSeedDoc,read,consumer:state,parameters};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'b03-finish-consumer-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve original output before assertion. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:prior?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.deepEqual(state.doc,doc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!prior)nativeCache.set(key,{read,label});return {state,read};
}
async function distance(previous,oldValue,value,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(2,label);const field=f.editor().getByLabel('Distance',{exact:true});assert.equal(Number(await field.inputValue()),oldValue);
  await field.fill(String(value));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const state=await capture(`${label}-accepted-before-assert`);await f.closeEditor();return state.doc;
}
async function refusedPreview(A,read){
  f.phase='03-actual-surviving-back-top-new-Chamfer-preview';await f.closeEditor();await f.page.keyboard.press('Escape');
  const filter=f.page.getByRole('button',{name:'Selection filter',exact:true});let edgeFilter=false;
  for(let i=0;i<6;i++){if((await filter.innerText()).includes('Edges')){edgeFilter=true;break;}await filter.click();}assert.equal(edgeFilter,true);
  const edges=read.display.edges.filter(edge=>edge.names.includes(previewGuard.edge)&&[edge.a,edge.b].every(point=>Math.abs(point[1]-20)<1e-9&&Math.abs(point[2]-10)<1e-9));assert.equal(edges.length,1);
  const edge=edges[0],point=[0,1,2].map(k=>(edge.a[k]+edge.b[k])/2);f.report.observations.push({label:'current-native-display-back-top-target',edge,point,authority:'Actual current native/display mapping; no ordinal guess'});
  await f.page.getByRole('button',{name:'Top',exact:true}).click();await f.page.getByTitle('Frame all (F)',{exact:true}).click();await f.page.waitForTimeout(500);
  const projected=await f.page.evaluate(point=>{const pixel=window.__studioScreenOf(point);return {pixel,clear:pixel&&!!document.elementFromPoint(...pixel)?.closest('.vp-canvas'),hit:window.__studioEdgeAt(point)};},point);
  assert.ok(projected.pixel?.length===2&&projected.pixel.every(Number.isFinite)&&projected.clear);assert.equal(projected.hit?.body,read.display.bodyIndex);assert.equal(projected.hit?.edge,edge.index);
  await f.page.mouse.move(...projected.pixel);await f.page.mouse.click(...projected.pixel);const selected=await capture('03-real-back-top-edge-selected-before-assert');
  assert.deepEqual(selected.selected.edges,[{body:read.display.bodyIndex,edge:edge.index}]);assert.deepEqual(selected.doc,A);
  await f.command('Chamfer');const hud=f.page.getByRole('dialog',{name:'Chamfer',exact:true});await hud.waitFor();await hud.getByLabel('Distance',{exact:true}).fill(String(previewGuard.distance));
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='refused',null,{timeout:60000});const detail=hud.locator('details summary');if(await detail.count())await detail.click();
  const state=await capture('03-new-Chamfer1000-refused-before-assert');assert.equal(await hud.getByRole('button',{name:'Apply',exact:true}).isDisabled(),true);assert.match(state.hudError,/RADIUS_EXCEEDS_FACE/);assert.match(state.hudError,/chamfer 1000 mm/);
  assert.deepEqual(state.doc,A);assert.deepEqual(state.historyRows,selected.historyRows);assert.deepEqual(state.worker.bodies,selected.worker.bodies);
  f.report.observations.push({label:'genuine-new-Chamfer-preview-refusal',actualUIReason:state.hudError,parent:previewGuard.parent,edge:previewGuard.edge,distance:previewGuard.distance,applyDisabled:true,authority:'Actual UI preview/Cancel only; no synthesized native guard'});
  await hud.getByRole('button',{name:'Cancel',exact:true}).click();await hud.waitFor({state:'hidden'});await f.same(A);await qualify('03-preview-Cancel-retains-A',A,states.A.parameters);
}
async function versions(){await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;}
async function saveOpen(A){
  let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
  await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
  await writeFile(join(output,'06-own-project-saved-A.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),A);f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};await qualify('06-own-project-Save-exact-A',A,states.A.parameters);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(A);await f.ready();await qualify('07-same-context-reload-Open-exact-A',A,states.A.parameters);
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await f.page.setInputFiles('input[aria-label="Model file"]',seedPath);await f.same(states.B.doc);await f.ready();await qualify('01-exact-saved-B-Open',states.B.doc,states.B.parameters);
    const A=await distance(states.B.doc,2,3,'02-public-Distance3');assert.deepEqual(A,states.A.doc);const accepted=await qualify('02-exact-A',A,states.A.parameters);
    await refusedPreview(A,accepted.read);await f.undo();await f.same(states.B.doc);await qualify('04-FIRST-document-Undo-exact-B',states.B.doc,states.B.parameters);
    await f.redo();await f.same(A);await qualify('05-Redo-exact-A',A,states.A.parameters);await saveOpen(A);
    const B=await distance(A,3,2,'08-postOpen-Distance2');assert.deepEqual(B,states.B.doc);await qualify('08-postOpen-exact-B',B,states.B.parameters);
    assert.equal(f.report.reads.length,8);assert.deepEqual(f.report.downloads,[]);f.report.nativeCaptures=newCaptures;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
  }finally{if(projectCreated){const cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}finally{f.report.cleanup.push(cleanup);await f.persist();}}}
});
