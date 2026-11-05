// D546_SOURCE_FROZEN=1 node test/b04-sheet-bracket-browser.mjs /ABS/NEW/OUTPUT
// Root owns every execution. Current scripted D121 source; actual Studio consumers and one file reader.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {config,builderFiles,inputFiles,oracleStatus,inspectorSource,oracleSource} from './b04-sheet-bracket-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const controlDir='/tmp/barocss-d546-control01',runtimeFile=join(controlDir,'runtime-config.json'),runtime=JSON.parse(await readFile(runtimeFile));
const {sourceDoc,states,seedPath,seedBytes,seedSHA256}=runtime,seed=await readFile(seedPath);
assert.equal(runtime.sourceOrigin,config.sourceOrigin);assert.equal(seed.length,seedBytes);assert.equal(sha256(seed),seedSHA256);assert.equal(seed.toString(),states.A.documentJSON);assert.deepEqual(JSON.parse(seed),sourceDoc);assert.deepEqual(sourceDoc,states.A.doc);
const pinsFile='/tmp/barocss-d546-preflight01/source-pins.json',pins=JSON.parse(await readFile(pinsFile));assert.equal(Object.keys(pins).length,655);
for(const[file,digest]of Object.entries(pins))assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Current producer pin: ${file}`);
const receiptFile=join(controlDir,'receipt.json'),control=JSON.parse(await readFile(receiptFile));assert.equal(control.status,'PASS_D546_CURRENT_CONTROLLED_SCRIPTED_TWO_CLASSES_AND_GUARD');
const nativeCache=new Map();
for(const name of ['A','B']){
  const file=join(controlDir,`${name}-native-before-assert.json`),bytes=await readFile(file),read=JSON.parse(bytes),state=states[name],row=control.rows.find(row=>row.label===name);
  assert.equal(row.status,'PASS_ONE_CURRENT_D546_NATIVE_FLAT_CLASS_ONLY');assert.equal(row.packetSHA256,sha256(bytes));assert.equal(row.documentSHA256,state.documentSHA256);assert.equal(read.ok,true);assert.equal(read.inputUnchanged,true);assert.equal(read.documentJSON,state.documentJSON);assert.equal(read.documentSHA256,sha256(state.documentJSON));assert.deepEqual(JSON.parse(state.documentJSON),state.doc);assert.deepEqual(read.request.parameters,state.parameters);
  nativeCache.set(state.documentSHA256,{read,label:`NEW-current-D546-control-${name}`,file,sha256:sha256(bytes)});
}
const negativeFile=join(controlDir,'negative1-native-before-assert.json'),negativeBytes=await readFile(negativeFile),negative=JSON.parse(negativeBytes),negativeRow=control.rows.find(row=>row.label==='negative1');
assert.equal(negativeRow.status,'PASS_EXPECTED_CURRENT_TYPED_REFUSAL');assert.equal(negativeRow.packetSHA256,sha256(negativeBytes));assert.equal(negative.ok,false);assert.equal(negative.error.code,config.guard.expectedCode);assert.equal(negative.error.feature,config.guard.expectedFeature);assert.ok(negative.error.message.includes(config.guard.reason));
const readerReceipt=JSON.parse(await readFile(config.readerRuntimeReceipt));assert.equal(readerReceipt.status,'PASS_EXISTING_EZDXF_1_4_5_RUNTIME_ONLY');assert.equal(readerReceipt.files.length,4);assert.equal(sha256(await readFile(config.readerRuntimeJSON)),readerReceipt.runtimeSHA256);
for(const file of readerReceipt.files){const bytes=await readFile(file.path);assert.equal(bytes.length,file.bytes);assert.equal(sha256(bytes),file.sha256);}
const controlFiles=(await readdir(controlDir)).map(file=>join(controlDir,file)),projectName=`D546-${randomUUID()}`,partName='D546-sheet-bracket';
const producers=[...Object.keys(pins),config.dxfPythonPath,...config.readerRuntimeFiles,'apps/cad-studio/src/ui/FlatPatternDialog.tsx','apps/cad-studio/src/ui/SelectionInspector.tsx'];
const f=await createFlow({name:'b04-sheet-bracket',envFrozen:'D546_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D546 selected scripted D121 sheet bracket consumers: thickness/refusal/FIRSTUndoRedo/flatDisplay/ownSaveOpen/one actual AC1015 export and one installed reader/post-edit',
  initialFiles:['apps/cad-studio/test/b04-sheet-bracket-browser.mjs',...builderFiles,...inputFiles,...controlFiles,pinsFile,seedPath],extraFrozen:producers,
  requiredFrozen:[...builderFiles,...inputFiles,...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx'].map(file=>relative(repo,resolve(repo,file))),
  limits:['Desktop WebGPU1440x900 only; root must view original PNGs. Ten selected consumer groups, not whole B04 acceptance.',
    'Input is current CONTROLLED_SCRIPTED D121 dispatchTool source, not historical authored Studio creation. No creation replay.',
    'Only NEW exact current A/B native packets under all655 producer pins; every join has fresh original Worker and new common Python.',
    'Native BRep hash labels a paired controlled physical class, not bytes embedded in DXF or read from Worker. API/browser byte equality is metadata only.',
    'Actual flat SVG coordinates round to1e-3; SVG is display evidence, not the independent native/flat numerical oracle.',
    'One actual local AC1015 export and one preinstalled ezdxf reader invocation; no network/install. Same-context reload, not cold-process persistence.',
    'Public Frame all is allowed for this folded observation; no general automatic-fit claim or mobile test.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]'),
    flatDialog:document.querySelector('[role="dialog"][aria-label="Flat pattern"]')?.textContent??null,
    flatDrawing:document.querySelector('svg[aria-label="Flat pattern drawing"]')?.outerHTML??null,
    flatVersion:document.querySelector('[aria-label="Flat DXF version"]')?.value??null}),
});
f.report.sourceOrigin={kind:config.sourceOrigin,sourceDocumentSHA256:sha256(JSON.stringify(sourceDoc)),runtimeFile,seedPath,seedBytes,seedSHA256};
f.report.controls={receiptFile,receiptSHA256:sha256(await readFile(receiptFile)),pinsFile,pinsSHA256:sha256(await readFile(pinsFile)),matchedPins:655,constructionEvaluateCalls:control.constructionEvaluateCalls,packets:[...nativeCache.values()].map(({read,...rest})=>rest)};
f.report.readerRuntime={receipt:config.readerRuntimeReceipt,receiptSHA256:sha256(await readFile(config.readerRuntimeReceipt)),runtime:config.readerRuntimeJSON,files:readerReceipt.files,actualInvocations:0};
f.report.projectName=projectName;let projectCreated=false,newCaptures=0;const labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
function retained(state,before,doc){assert.deepEqual(state.doc,doc);assert.deepEqual(state.worker.bodies,before.worker.bodies);assert.deepEqual(state.historyRows,before.historyRows);assert.equal(state.dirty,before.dirty);}
async function qualify(label,doc,parameters,extra={}){
  f.phase=label;await f.same(doc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),prior=nativeCache.get(key),read=prior?.read??await f.inspect(`${label}-native`,state.doc,{label,parameters});if(!prior)newCaptures++;
  f.report.reads.push({label,read,exactWholeDocSHA256:key,reusedFrom:prior?.label??null});
  const input={doc:state.doc,documentJSON:state.documentJSON,expectedDoc:doc,sourceDoc,read,consumer:state,parameters,...extra};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'b04-sheet-bracket-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Original output is already preserved. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:prior?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.deepEqual(state.doc,doc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!prior)nativeCache.set(key,{read,label});return {state,read};
}
async function thickness(previous,oldValue,value,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(config.fields.B.index,label);const field=f.editor().getByLabel('Thickness',{exact:true});assert.equal(Number(await field.inputValue()),oldValue);await field.fill(String(value));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const state=await capture(`${label}-accepted-before-assert`);await f.closeEditor();return state.doc;
}
async function refuse(B,accepted){
  f.phase='03-Thickness0';await f.openFeatureEditor(config.guard.index,f.phase);await f.editor().getByLabel(config.guard.label,{exact:true}).fill(String(config.guard.value));await capture('03-Thickness0-typed-before-Apply');assert.deepEqual(await f.doc(),B);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.page.waitForFunction(reason=>[...document.querySelectorAll('.toast[role="alert"]')].some(alert=>alert.textContent.includes(reason)),config.guard.reason);
  const state=await capture('03-Thickness0-refused-before-assert');retained(state,accepted,B);
  f.report.observations.push({label:'Thickness0-actual-UI-retention',actualUIReasons:state.alerts,separateControlledNative:{file:negativeFile,sha256:sha256(negativeBytes),error:negative.error},authority:'Actual UI reason and accepted Doc/body/history retention; native code/feature are separately controlled, not exposed Worker fields'});
  await f.closeEditor();await f.dismissToasts();await qualify('03-retained-B',B,states.B.parameters);
}
async function openFlat(){
  await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const rows=f.page.locator('.outliner .ol-row > button.ol');assert.equal(await rows.count(),1);await rows.first().click();
  await f.page.getByRole('button',{name:'Show the flat pattern',exact:true}).click();const dialog=f.page.getByRole('dialog',{name:'Flat pattern',exact:true});await dialog.waitFor();return dialog;
}
async function closeFlat(){const dialog=f.page.getByRole('dialog',{name:'Flat pattern',exact:true});if(await dialog.count()){await dialog.getByRole('button',{name:'Close the flat pattern',exact:true}).click();await dialog.waitFor({state:'hidden'});}}
async function flatView(B,before){
  f.phase='06-actual-flat-display';await openFlat();const shown=await qualify('06-actual-flat-view-B',B,states.B.parameters);assert.ok(shown.state.flatDrawing);assert.equal(shown.state.flatVersion,'AC1015');retained(shown.state,before,B);
  await closeFlat();const closed=await capture('06-flat-closed-before-assert');retained(closed,before,B);assert.equal(closed.flatDialog,null);
}
async function versions(){await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;}
async function saveOpen(B){
  let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
  await writeFile(join(output,'07-own-project-saved-B.bcad'),saved.text);f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text)};await f.persist();assert.deepEqual(JSON.parse(saved.text),B);await qualify('07-own-project-Save-B',B,states.B.parameters);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(B);await f.ready();return qualify('08-same-context-reload-Open-B',B,states.B.parameters);
}
async function exported(B,before){
  f.phase='09-one-actual-FlatPatternDialog-AC1015-export';const dialog=await openFlat();await dialog.getByLabel('Flat DXF version',{exact:true}).selectOption('AC1015');const typed=await capture('09-actual-AC1015-selection-before-export');retained(typed,before.state,B);assert.equal(typed.flatVersion,'AC1015');
  const pending=f.page.waitForEvent('download');await dialog.getByRole('button',{name:'Export flat DXF',exact:true}).click();const download=await pending,file=join(output,'09-actual-browser-export-B-AC1015.dxf');await download.saveAs(file);const bytes=await readFile(file),digest=sha256(bytes);
  const reading=spawnSync(config.dxfPythonPath,['-I',config.dxfReaderPath,file],{encoding:'utf8',maxBuffer:16*1024*1024});f.report.readerRuntime.actualInvocations++;
  const stdout=reading.stdout??'',stderr=reading.stderr??'';await writeFile(join(output,'09-original-reader.stdout.json'),stdout);await writeFile(join(output,'09-original-reader.stderr.txt'),stderr);
  const provenance={path:file,suggestedFilename:download.suggestedFilename(),bytes:bytes.length,sha256:digest,readerInputSHA256:digest,readerOutputSHA256:sha256(stdout),readerSHA256:config.dxfReaderSHA256,readerExit:reading.status,readerSignal:reading.signal,readerError:reading.error?String(reading.error):null,documentSHA256:sha256(JSON.stringify(B)),nativeBRepSHA256:before.read.outputs[0].nativeBRepSHA256,
    authority:'Actual FlatPatternDialog local download; native hash is separately paired current controlled physical-class provenance, never embedded DXF or Worker native bytes',apiBytesEqualObservedOnly:bytes.equals(Buffer.from(before.read.outputs[0].apiDxfAC1015.bytes))};
  f.report.actualDxf=provenance;await writeFile(join(output,'09-actual-export-and-reader-provenance.json'),JSON.stringify(provenance,null,2));await f.persist();
  assert.equal(reading.error,undefined);assert.equal(reading.status,0,stderr);const dxfReading=JSON.parse(stdout);
  const result=await qualify('09-actual-exported-B',B,states.B.parameters,{dxfReading,dxfReadingJSON:stdout,dxfBytes:Array.from(bytes),dxfProvenance:provenance});retained(result.state,before.state,B);assert.equal(f.report.downloads.length,1);assert.equal(f.report.readerRuntime.actualInvocations,1);
  await closeFlat();const closed=await capture('09-export-dialog-closed-before-assert');retained(closed,before.state,B);
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await f.page.setInputFiles('input[aria-label="Model file"]',seedPath);await f.same(states.A.doc);await f.ready();await f.page.getByTitle('Frame all (F)',{exact:true}).click();await qualify('01-initial-scripted-A-Open',states.A.doc,states.A.parameters);
    const B=await thickness(states.A.doc,1.5,2,'02-public-Thickness2');assert.deepEqual(B,states.B.doc);const accepted=await qualify('02-public-Thickness2-B',B,states.B.parameters);
    await refuse(B,accepted.state);await f.undo();await f.same(states.A.doc);await qualify('04-FIRST-document-Undo-A',states.A.doc,states.A.parameters);
    await f.redo();await f.same(B);const redone=await qualify('05-document-Redo-B',B,states.B.parameters);await flatView(B,redone.state);
    const opened=await saveOpen(B);await exported(B,opened);
    const A=await thickness(B,2,1.5,'10-postOpen-Thickness1_5');assert.deepEqual(A,states.A.doc);await qualify('10-postOpen-Thickness1_5-A',A,states.A.parameters);
    assert.equal(f.report.reads.length,10);assert.equal(f.report.downloads.length,1);assert.equal(f.report.readerRuntime.actualInvocations,1);f.report.nativeCaptures=newCaptures;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(row=>row.reusedFrom!==null).length;
  }finally{
    await closeFlat();if(projectCreated){const cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}finally{f.report.cleanup.push(cleanup);await f.persist();}}
  }
});
