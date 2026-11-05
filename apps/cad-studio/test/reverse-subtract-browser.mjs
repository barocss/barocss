// D547_SOURCE_FROZEN=1 node test/reverse-subtract-browser.mjs /ABS/NEW/OUTPUT
// Exact retained D452 reverse B-A source; root owns execution. No creation replay.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {config,builderFiles,inputFiles,retainedFiles,oracleStatus,inspectorSource,oracleSource,seedPath,seedBytes,seedSHA256,seedJSON,seedDoc,states} from './reverse-subtract-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const seed=await readFile(seedPath);assert.equal(seed.length,seedBytes);assert.equal(sha256(seed),seedSHA256);assert.equal(seed.toString(),seedJSON);assert.deepEqual(JSON.parse(seed),seedDoc);assert.deepEqual(seedDoc,states.A.doc);
assert.deepEqual(config.fields.B,{index:3,key:'c0',label:'Corner X',from:40,value:36});assert.deepEqual(config.fields.postA,{index:3,key:'c0',label:'Corner X',from:36,value:40});assert.equal(config.guard.index,3);assert.equal(config.guard.key,'h');assert.equal(config.guard.label,'Distance');assert.equal(config.guard.value,0);
const controlDir='/tmp/barocss-d547-control01',runtimeFile=join(controlDir,'runtime-config.json'),runtime=JSON.parse(await readFile(runtimeFile));
const pinsFile='/tmp/barocss-d547-preflight01/source-pins.json',pins=JSON.parse(await readFile(pinsFile));assert.ok(Object.keys(pins).length>0);
for(const[file,digest]of Object.entries(pins))assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Current producer pin: ${file}`);
const receiptFile=join(controlDir,'receipt.json'),control=JSON.parse(await readFile(receiptFile)),nativeCache=new Map();
assert.equal(control.status,'PASS_D547_CURRENT_NATIVE_AB_AND_GUARD');assert.equal(control.sourceOrigin,config.sourceOrigin);assert.equal(control.freshPositiveNativeCalls,2);assert.equal(control.negativeNativeCalls,1);
assert.equal(runtime.workId,'D547');assert.equal(runtime.sourceOrigin,config.sourceOrigin);assert.deepEqual(runtime.sourceDoc,seedDoc);assert.deepEqual(runtime.sourceDocA,seedDoc);assert.deepEqual(runtime.states,states);assert.deepEqual(runtime.guard,config.guard);assert.equal(runtime.originalSeedPath,seedPath);assert.equal(runtime.seedBytes,seedBytes);assert.equal(runtime.seedSHA256,seedSHA256);
const materialized=await readFile(runtime.seedPath);assert.equal(materialized.length,seedBytes);assert.equal(sha256(materialized),seedSHA256);assert.equal(materialized.toString(),seedJSON);
for(const name of ['A','B']){
  const file=join(controlDir,`${name}-native-before-assert.json`),bytes=await readFile(file),read=JSON.parse(bytes),state=states[name],row=control.rows.find(row=>row.label===name);
  assert.equal(runtime.packetPaths[name],file);assert.equal(row.status,'PASS_ONE_CURRENT_D547_NATIVE_CLASS_ONLY');assert.equal(row.packet,file.split('/').at(-1));assert.equal(row.packetSHA256,sha256(bytes));assert.equal(row.documentSHA256,state.documentSHA256);
  assert.equal(read.ok,true);assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);assert.equal(read.documentJSON,state.documentJSON);assert.equal(read.documentSHA256,sha256(state.documentJSON));assert.deepEqual(JSON.parse(state.documentJSON),state.doc);assert.deepEqual(read.request.parameters,state.parameters);
  nativeCache.set(state.documentSHA256,{read,label:`NEW-current-D547-control-${name}`,file,sha256:sha256(bytes)});
}
const negativeFile=join(controlDir,'negative1-native-before-assert.json'),negativeBytes=await readFile(negativeFile),negative=JSON.parse(negativeBytes),negativeRow=control.rows.find(row=>row.label==='negative1');
assert.equal(negativeRow.status,'PASS_EXPECTED_CURRENT_TYPED_REFUSAL');assert.equal(negativeRow.packetSHA256,sha256(negativeBytes));assert.equal(negative.ok,false);assert.equal(negative.inputUnchanged,true);assert.equal(negative.documentSHA256,sha256(negative.documentJSON));assert.equal(negative.documentSHA256,negativeRow.documentSHA256);assert.equal(negative.error.code,config.guard.expectedCode);assert.equal(negative.error.feature,config.guard.expectedFeature);assert.equal(negative.error.message,config.guard.expectedMessage);
const candidate=structuredClone(states.B.doc);candidate.nodes[3].height=0;assert.deepEqual(JSON.parse(negative.documentJSON),candidate);const invalidUIReason=config.guard.reason;assert.ok(invalidUIReason&&negative.error.message.includes(invalidUIReason));
const controlFiles=(await readdir(controlDir)).map(file=>join(controlDir,file)),projectName=`D547-${randomUUID()}`,partName='D547-reverse-subtract';
const producers=[...Object.keys(pins),'packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/sketch/outlineFields.ts','packages/barocss-cad-model/src/sketch/profile.ts','packages/barocss-cad-model/src/engine/part.ts'];
const f=await createFlow({name:'reverse-subtract',envFrozen:'D547_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D547 retained reverse B-A: original parent CornerX40/36, Distance0 atomic refusal/FIRSTUndoRedo, ownSave/same-contextOpen/postCorner40',
  initialFiles:['apps/cad-studio/test/reverse-subtract-browser.mjs',...builderFiles,...inputFiles,...retainedFiles,...controlFiles,pinsFile,seedPath],extraFrozen:producers,
  requiredFrozen:[...builderFiles,...inputFiles,...retainedFiles,...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx'].map(file=>relative(repo,resolve(repo,file))),
  limits:['Desktop WebGPU1440x900 only; root must view original PNGs. Eight selected action groups/eight fresh physical bindings.',
    'Exact retained D452 reverse Subtract source; original public creation remains historical and is not replayed. No forward branch stitching.',
    'Only NEW exact current A/B native packets under complete producer pins; every consumer has a fresh original Worker and new independent Python.',
    'Parentn3/tooln1/outputb4, originalA outline/tags and both body names stay exact. Only originalB rectangle min/maxX changes.',
    'Actual UI reason/Doc/body/history/dirty retention is separate from controlled native code/feature; no unexposed Worker fields are inferred.',
    'Own UUID project and same-context reload only; no cold-process recovery, final resave, exports, downloads, mobile, general Boolean or wholeCAD claim.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed={file:seedPath,bytes:seedBytes,sha256:seedSHA256,authority:'Exact historical D452 actual reverse Subtract creation; no new creation claim'};
f.report.controls={receiptFile,receiptSHA256:sha256(await readFile(receiptFile)),runtimeFile,runtimeSHA256:sha256(await readFile(runtimeFile)),pinsFile,pinsSHA256:sha256(await readFile(pinsFile)),matchedPins:Object.keys(pins).length,packets:[...nativeCache.values()].map(({read,...rest})=>rest)};
f.report.sourceOrigin=config.sourceOrigin;f.report.separateControlledGuard={file:negativeFile,sha256:sha256(negativeBytes),error:negative.error,authority:'Controlled native classification; actual UI and accepted-source retention are captured separately'};
f.report.projectName=projectName;let projectCreated=false,newCaptures=0;const labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
function retained(state,before,doc){assert.deepEqual(state.doc,doc);assert.deepEqual(state.worker.bodies,before.worker.bodies);assert.deepEqual(state.historyRows,before.historyRows);assert.equal(state.dirty,before.dirty);}
async function qualify(label,doc,parameters){
  f.phase=label;await f.same(doc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),prior=nativeCache.get(key),read=prior?.read??await f.inspect(`${label}-native`,state.doc,{label,parameters});if(!prior)newCaptures++;
  f.report.reads.push({label,read,exactWholeDocSHA256:key,reusedFrom:prior?.label??null});
  const input={doc:state.doc,documentJSON:state.documentJSON,expectedDoc:doc,seedDoc,read,consumer:state,parameters};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'reverse-subtract-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Original output is already preserved. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:prior?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.deepEqual(state.doc,doc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!prior)nativeCache.set(key,{read,label});return {state,read};
}
async function corner(previous,oldValue,value,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(3,label);const field=f.editor().getByLabel('Corner X',{exact:true});assert.equal(Number(await field.inputValue()),oldValue);
  await field.fill(String(value));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const state=await capture(`${label}-accepted-before-assert`);await f.closeEditor();return state.doc;
}
async function refuse(B,accepted){
  f.phase='03-original-parent-Distance0';await f.openFeatureEditor(3,f.phase);const field=f.editor().getByLabel('Distance',{exact:true});assert.equal(Number(await field.inputValue()),10);await field.fill('0');await capture('03-Distance0-typed-before-Apply');assert.deepEqual(await f.doc(),B);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.page.waitForFunction(reason=>[...document.querySelectorAll('.toast[role="alert"]')].some(alert=>alert.textContent.includes(reason)),invalidUIReason);
  const state=await capture('03-Distance0-refused-before-assert');retained(state,accepted,B);
  f.report.observations.push({label:'original-parent-Distance0-actual-UI-retention',actualUIReasons:state.alerts,separateControlledNative:{file:negativeFile,sha256:sha256(negativeBytes),error:negative.error},authority:'Actual UI reason and accepted Doc/body/history/dirty retention; native code/feature are separate controlled observations'});
  await f.closeEditor();await f.dismissToasts();await qualify('03-retained-B',B,states.B.parameters);
}
async function versions(){await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;}
async function saveOpen(B){
  let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
  await writeFile(join(output,'06-own-project-saved-B.bcad'),saved.text);f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text)};await f.persist();assert.deepEqual(JSON.parse(saved.text),B);await qualify('06-own-project-Save-B',B,states.B.parameters);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(B);await f.ready();return qualify('07-same-context-reload-Open-B',B,states.B.parameters);
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await f.page.setInputFiles('input[aria-label="Model file"]',seedPath);await f.same(states.A.doc);await f.ready();await qualify('01-initial-retained-reverse-A',states.A.doc,states.A.parameters);
    const B=await corner(states.A.doc,40,36,'02-public-original-parent-CornerX36');assert.deepEqual(B,states.B.doc);const accepted=await qualify('02-accepted-B',B,states.B.parameters);
    await refuse(B,accepted.state);await f.undo();await f.same(states.A.doc);await qualify('04-FIRST-document-Undo-A',states.A.doc,states.A.parameters);
    await f.redo();await f.same(B);await qualify('05-document-Redo-B',B,states.B.parameters);await saveOpen(B);
    const A=await corner(B,36,40,'08-postOpen-original-parent-CornerX40');assert.deepEqual(A,states.A.doc);const post=await qualify('08-postOpen-A',A,states.A.parameters);assert.equal(post.state.dirty,true);
    assert.equal(f.report.reads.length,8);assert.deepEqual(f.report.downloads,[]);f.report.nativeCaptures=newCaptures;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(row=>row.reusedFrom!==null).length;
  }finally{
    if(projectCreated){const cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}finally{f.report.cleanup.push(cleanup);await f.persist();}}
  }
});
