// D540_SOURCE_FROZEN=1 node test/revolve-boss-depth-browser.mjs /ABS/NEW/OUTPUT
// One missing full-Revolve boss-depth interaction; not a shaft/flange or B03 completion.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {inspectorSource,oracleSource} from './revolve-boss-depth-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const seedFile='/tmp/barocss-d448-remaining-run02/05-opfs-saved.bcad',seedBytes=await readFile(seedFile);
assert.equal(seedBytes.length,3431);assert.equal(sha256(seedBytes),'2727e7d3d726a58030657720ebc7a8d09a4dab574887dd7d2001cc42305ed16f');
const seedDoc=JSON.parse(seedBytes),projectName=`D540-${randomUUID()}`,partName='D540-revolve-boss-depth';
const archivedAFile='/tmp/barocss-d538-control01/W60-native.stdout.json',archivedAPinsFile='/tmp/barocss-d538-control01/source-pins.json';
const archivedBFile=process.env.D540_REUSE_B_FROM,archivedBPinsFile=archivedBFile?(process.env.D540_REUSE_B_PINS??join(dirname(archivedBFile),'source-pins.json')):null;
async function eligiblePacket(file,pinsFile,label,expectedPinCount,expectedOk=true){
  assert.ok(isAbsolute(file)&&isAbsolute(pinsFile));const bytes=await readFile(file),pinsBytes=await readFile(pinsFile),pins=JSON.parse(pinsBytes);
  assert.ok(Object.keys(pins).length>0);if(expectedPinCount!==undefined)assert.equal(Object.keys(pins).length,expectedPinCount);
  for(const [path,digest]of Object.entries(pins))assert.equal(sha256(await readFile(resolve(repo,path))),digest,`${label}: current source matches ${path}`);
  const read=JSON.parse(bytes);assert.equal(read.ok,expectedOk);assert.equal(read.inputUnchanged,true);assert.equal(read.documentSHA256,sha256(read.documentJSON));
  return {read,pins,receipt:{label,file,sha256:sha256(bytes),pinsFile,pinsSha256:sha256(pinsBytes),matchedSourcePins:Object.keys(pins).length,authority:'Original packet/request metadata unchanged; eligibility is exact source and whole-Doc identity'}};
}
const archivedA=await eligiblePacket(archivedAFile,archivedAPinsFile,'archived-D538-A-depth16',466);
assert.deepEqual(JSON.parse(archivedA.read.documentJSON),seedDoc);
const archivedB=archivedBFile?await eligiblePacket(archivedBFile,archivedBPinsFile,'controlled-D540-B-depth20'):null;
if(archivedB)assert.deepEqual(JSON.parse(archivedB.read.documentJSON),{...seedDoc,nodes:seedDoc.nodes.map((node,index)=>index===2?{...node,max:[10,29]}:node)});
const invalidNativeFile=process.env.D540_INVALID_NATIVE_FROM??'/tmp/barocss-d540-control01/Depth0-native.stdout.json';
const invalidPinsFile=process.env.D540_INVALID_NATIVE_PINS??join(dirname(invalidNativeFile),'source-pins.json');
const invalidNative=await eligiblePacket(invalidNativeFile,invalidPinsFile,'separate-controlled-Depth0-native-classification',undefined,false);
assert.deepEqual(JSON.parse(invalidNative.read.documentJSON),{...seedDoc,nodes:seedDoc.nodes.map((node,index)=>index===2?{...node,max:[10,9]}:node)});
assert.equal(typeof invalidNative.read.error.code,'string');assert.equal(typeof invalidNative.read.error.feature,'string');
assert.equal(typeof invalidNative.read.error.message,'string');assert.ok(invalidNative.read.error.message.trim());
const invalidUIReason=invalidNative.read.error.message.replace(/^n\d+:\s*/,'').trim();


const producers=['packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/engine/part.ts','packages/barocss-cad-model/src/engine/references.ts','packages/barocss-cad-model/src/engine/errors.ts','packages/barocss-cad-model/src/sketch/reopen.ts','packages/barocss-cad-model/src/sketch/profile.ts','apps/cad-studio/test/bracket-baseline-oracles.mjs',...Object.keys(archivedA.pins),...Object.keys(archivedB?.pins??{}),...Object.keys(invalidNative.pins)];
const f=await createFlow({name:'revolve-boss-depth',envFrozen:'D540_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D540 retained support: original full-Revolve boss meridian Depth16→20, Depth0 NodeEditor Apply refusal/FIRST UndoRedo, owned project Save/Open, postOpen Depth20→16',
  initialFiles:['apps/cad-studio/test/revolve-boss-depth-browser.mjs','apps/cad-studio/test/revolve-boss-depth-oracles.mjs',seedFile,archivedAFile,archivedAPinsFile,...(archivedB?[archivedBFile,archivedBPinsFile]:[]),invalidNativeFile,invalidPinsFile],
  extraFrozen:producers,requiredFrozen:[...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits:['Desktop WebGPU1440x900 only; root must view original screenshots.',
    'Exact retained D448 support bracket: plate/boss/Union/ThroughHoleR3/fourR2 creation is retained ancestry, not replayed.',
    'Only the original full-Revolve boss source Depth16/20 is qualified; no true shaft/flange, partial Revolve or B03 completion claim.',
    'Actual UI refusal/retention is separate from High controlled native error classification; no actual Worker code or feature is inferred.',
    'Native original BRep and independent Python are physical authority; project persistence uses same-context reload, not a cold browser profile.',
    'No export/download/mobile/release or generic Revolve/Boolean/finishing claim.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed={file:seedFile,bytes:seedBytes.length,sha256:sha256(seedBytes),authority:'Exact retained complete support with original full-Revolve meridian Depth16'};
f.report.projectName=projectName;f.report.controlledDepth0Refusal={...invalidNative.receipt,error:invalidNative.read.error,authority:'Separate controlled native classification only; actual UI source reason is matched without inferring Worker code/feature'};f.report.eligibleNativePackets=[archivedA.receipt,...(archivedB?[archivedB.receipt]:[])];let projectCreated=false,newNativeCaptures=0;const nativeCache=new Map(),labels=new Set();
nativeCache.set(sha256(archivedA.read.documentJSON),{label:archivedA.receipt.label,read:archivedA.read});
if(archivedB)nativeCache.set(sha256(archivedB.read.documentJSON),{label:archivedB.receipt.label,read:archivedB.read});
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
const invariant=(doc,depth)=>{
  assert.deepEqual({...doc,nodes:seedDoc.nodes},seedDoc,'root units/parameters/outputs/nextId unchanged');
  assert.deepEqual(doc.nodes.filter((_,i)=>i!==2),seedDoc.nodes.filter((_,i)=>i!==2),'all original node IDs/Union/Hole/fourR2/ref strings/historical signatures unchanged');
  const meridian={...seedDoc.nodes[2],max:[10,9+depth]};assert.deepEqual(doc.nodes[2],meridian,'only original meridian maxY changes');
  assert.equal(doc.nodes[3].axis,'y');assert.equal(doc.nodes[3].angle,360);
};
async function qualify(label,expectedDoc,depth){
  f.phase=label;await f.same(expectedDoc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),previous=nativeCache.get(key),parameters={depth};
  const read=previous?.read??await f.inspect(`${label}-native`,state.doc,{label,parameters});if(!previous)newNativeCaptures++;
  f.report.reads.push({label,read,exactWholeDocSha256:key,reusedFrom:previous?.label??null});
  const input={doc:state.doc,expectedDoc,seedDoc,read,consumer:state,parameters,documentJSON:state.documentJSON};
  await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'revolve-boss-depth-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');
  let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve first malformed result before assertions. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:previous?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,'PASS_ONE_DECLARED_D540_REVOLVE_BOSS_DEPTH_STATE');
  invariant(state.doc,depth);assert.deepEqual(state.doc,expectedDoc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!previous)nativeCache.set(key,{label,read});return state;
}
async function editDepth(previous,from,to,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(3,label);const field=f.editor().getByLabel('Depth',{exact:true});
  assert.equal(Number(await field.inputValue()),from);await field.fill(String(to));await capture(`${label}-typed-before-Apply`);
  assert.deepEqual(await f.doc(),previous,'local numeric draft leaves accepted Doc unchanged');
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);
  const actual=await capture(`${label}-actual-accepted-before-assert`);await f.closeEditor();return actual.doc;
}
async function refuseZero(B,acceptedB){
  f.phase='03-local-Depth0-Apply';await f.openFeatureEditor(3,'03-invalid-depth0');await f.editor().getByLabel('Depth',{exact:true}).fill('0');
  await capture('03-Depth0-local-before-Apply');assert.deepEqual(await f.doc(),B);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();
  const alert=f.page.locator('.toast[role="alert"]');await alert.waitFor();const reason=await alert.textContent(),refused=await capture('04-Depth0-refused-before-assert');
  assert.ok(reason.includes(invalidUIReason),'Actual UI detail matches separately classified controlled native source reason');
  assert.deepEqual(refused.doc,B);assert.deepEqual(refused.worker.bodies,acceptedB.worker.bodies);assert.deepEqual(refused.historyRows,acceptedB.historyRows);
  f.report.observations.push({label:'actual-Depth0-NodeEditor-Apply-refusal',actualUIReason:reason,acceptedDocRetained:true,acceptedBodyRetained:true,historyRetained:true,
    nativeClassificationAuthority:'Separate High controlled preflight; no actual Worker code or feature captured'});
  await f.closeEditor();await f.dismissToasts();await f.same(B);await qualify('05-refusal-retains-B-depth20',B,20);
}
async function versions(){
  await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});
  if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;
}
async function saveReopen(expected){
  f.phase='08-own-UUID-project-Save';let card=await versions();
  const absent=await f.page.evaluate(async name=>{
    const root=await navigator.storage.getDirectory();try{const projects=await root.getDirectoryHandle('projects');await projects.getDirectoryHandle(name);return false;}
    catch(error){if(error.name==='NotFoundError')return true;throw error;}
  },projectName);assert.equal(absent,true,'Never overwrite an existing project namespace');
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();
  await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();
  await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
  await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{
    const root=await navigator.storage.getDirectory(),project=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    const file=await(await project.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};
  },{projectName,partName});
  await writeFile(join(output,'08-own-opfs-saved-B-depth20.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),expected);
  f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};
  await qualify('08-own-project-saved-B-depth20',expected,20);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});
  await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);
  await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();
  await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();
  await f.same(expected);await f.ready();await qualify('09-same-context-reload-project-Open-exact-B-depth20',expected,20);
  f.report.observations.push({label:'owned-project-roundtrip',sameContext:true,exactAcceptedDoc:true,downloads:f.report.downloads.length});
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await f.page.setInputFiles('input[aria-label="Model file"]',seedFile);await f.same(seedDoc);await f.ready();
    await qualify('00-initial-actual-A-depth16',seedDoc,16);
    const B=await editDepth(seedDoc,16,20,'01-public-Revolve-Depth20');const acceptedB=await qualify('02-accepted-B-depth20',B,20);
    await refuseZero(B,acceptedB);
    // The invalid local editor was closed; no successful commit separates refusal from FIRST Undo.
    await f.undo();await f.same(seedDoc);await qualify('06-FIRST-document-Undo-exact-A-depth16',seedDoc,16);
    await f.redo();await f.same(B);await qualify('07-Redo-exact-B-depth20',B,20);
    await saveReopen(B);
    const A=await editDepth(B,20,16,'10-postOpen-Revolve-Depth16');await qualify('11-postOpen-accepted-A-depth16',A,16);
    assert.deepEqual(A,seedDoc,'post-Open edit restores exact original source');assert.equal(f.report.reads.length,8);assert.deepEqual(f.report.downloads,[]);
    f.report.nativeCaptures=newNativeCaptures;f.report.eligibleNativeClasses=nativeCache.size;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
  }finally{
    if(projectCreated){const cleanup={ownedProject:projectName};try{
      const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();
      cleanup.namespace=await f.page.evaluate(async name=>{
        const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});
        try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}
      },projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');
    }finally{f.report.cleanup.push(cleanup);await f.persist();}}
  }
});
