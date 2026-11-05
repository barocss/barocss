// D548_SOURCE_FROZEN=1 node test/two-sheet-postopen-svg-browser.mjs /ABS/NEW/OUTPUT
// D548_CONTINUE_FROM_SAVED_B=1 resumes four remaining groups with one owned Save setup binding.
// Exact retained D486 issued-B/H8 drawing; root owns execution. Two actual local SVG exports, no PDF.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {appendFile,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {config,builderFiles,inputFiles,retainedFiles,oracleStatus,inspectorSource,preflightSource,oracleSource,seedPath,seedBytes,seedSHA256,seedText,seedJSON,seedDoc,states} from './two-sheet-postopen-svg-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const seed=await readFile(seedPath);assert.equal(seed.length,seedBytes);assert.equal(sha256(seed),seedSHA256);assert.equal(seed.toString(),seedText);assert.equal(JSON.stringify(JSON.parse(seed)),seedJSON);assert.deepEqual(JSON.parse(seed),seedDoc);assert.deepEqual(seedDoc,states.A.doc);
assert.deepEqual(config.fields.B,{index:1,key:'h',label:'Distance',from:8,value:10});assert.deepEqual(config.fields.postA,{index:1,key:'h',label:'Distance',from:10,value:8});assert.equal(config.guard.index,1);assert.equal(config.guard.key,'h');assert.equal(config.guard.label,'Distance');assert.equal(config.guard.value,0);
const controlDir='/tmp/barocss-d548-control01',runtimeFile=join(controlDir,'runtime-config.json'),runtime=JSON.parse(await readFile(runtimeFile));
const pinsFile='/tmp/barocss-d548-preflight02/source-pins.json',pins=JSON.parse(await readFile(pinsFile));assert.equal(Object.keys(pins).length,497);
const compatibilityFile='/tmp/barocss-d548-preflight02/compatibility.json',compatibilityBytes=await readFile(compatibilityFile),compatibility=JSON.parse(compatibilityBytes);
const originalPinsFile='/tmp/barocss-d548-preflight01/source-pins.json',originalPinsBytes=await readFile(originalPinsFile),originalPins=JSON.parse(originalPinsBytes);
const changedModule='apps/cad-studio/test/two-sheet-postopen-svg-oracles.mjs',oldModuleSHA='a4e144c999746d4dbaeccaa7fa7434d6eba6a305f708099f33ff098605c4e4f7',newModuleSHA='8fd7491c1c4dad12491d446276cfd46668debe61ab14668fbc3acc2294f8fec5';
assert.equal(compatibility.status,'PASS_PYTHON_ONLY_VIEWPORT_CHECK_NATIVE_REUSE_COMPATIBILITY');assert.equal(compatibility.producerPins,497);assert.equal(compatibility.nativeEvaluations,0);assert.equal(compatibility.nativeControlReuse,controlDir);assert.equal(compatibility.originalPinsFile,originalPinsFile);assert.equal(compatibility.currentPinsFile,pinsFile);
assert.equal(sha256(originalPinsBytes),'9f23f38c9581415bd606f5e018e3ed7b539870fea6766cb712374754c740a829');assert.equal(compatibility.originalPinsSHA256,sha256(originalPinsBytes));assert.equal(Object.keys(originalPins).length,497);assert.deepEqual(Object.keys(pins).sort(),Object.keys(originalPins).sort());
assert.deepEqual(compatibility.changed,[{file:changedModule,oldSHA256:oldModuleSHA,newSHA256:newModuleSHA,scope:'PRIVATE_PYTHON_DOM_VIEWBOX_ONLY'}]);assert.equal(compatibility.moduleLineChanges.length,1);assert.equal(originalPins[changedModule],oldModuleSHA);assert.equal(pins[changedModule],newModuleSHA);
assert.equal(compatibility.nativeInspectorSHA256,'f016cf8fe53e8d886d1c7db2ac14a481a5b427158c1acaa2928533093e0447f2');assert.equal(sha256(inspectorSource),compatibility.nativeInspectorSHA256);assert.equal(compatibility.nativePreflightSHA256,'00fe683aca0bd3f5c666c9f897093dec84bab45a4aa5dfcaa51efaa71697e03c');assert.equal(sha256(preflightSource),compatibility.nativePreflightSHA256);assert.equal(compatibility.configSHA256,'382d72612a28eff0dd8d90e3c6fb5178e35b5207addb37f7f9389dd48e973ddb');assert.equal(sha256(JSON.stringify(config)),compatibility.configSHA256);assert.equal(sha256(oracleSource),compatibility.newPythonSHA256);
for(const[file,digest]of Object.entries(originalPins)){if(file===changedModule)continue;assert.equal(pins[file],digest,`Only private DOM checker may change: ${file}`);}
for(const[file,digest]of Object.entries(pins))assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Current producer pin: ${file}`);
const savedRequalificationFile='/tmp/barocss-d548-savedrequal01/receipt.json',savedRequalificationBytes=await readFile(savedRequalificationFile),savedRequalification=JSON.parse(savedRequalificationBytes);
assert.equal(compatibility.savedRequalification,savedRequalificationFile);assert.equal(sha256(savedRequalificationBytes),'bc37921e53be25abb1cd55d7a7e4064864f614f5e88ff14c6f11ae9d6142c9a9');assert.equal(compatibility.savedRequalificationSHA256,sha256(savedRequalificationBytes));assert.equal(savedRequalification.status,'PASS_SAVED_ONLY_ORIGINAL_D548_INITIAL_H8');assert.equal(savedRequalification.moduleSHA256,newModuleSHA);assert.equal(savedRequalification.oracleSHA256,sha256(oracleSource));assert.equal(savedRequalification.exit,0);assert.equal(savedRequalification.error,null);assert.equal(savedRequalification.stdout.status,oracleStatus);assert.deepEqual(savedRequalification.stdout.parameters,{height:8});assert.equal(sha256(await readFile(savedRequalification.inputPath)),savedRequalification.inputSHA256);
const firstFailureFile='/tmp/barocss-d548-studio01/receipt.json',firstFailureBytes=await readFile(firstFailureFile),firstFailure=JSON.parse(firstFailureBytes);assert.equal(sha256(firstFailureBytes),'4a76698b4b4b59eb2660fc023270cbfa7a4155f26845c466366678e24d81aa83');assert.equal(savedRequalification.originalReceiptSHA256,sha256(firstFailureBytes));assert.equal(firstFailure.status,'FAIL');
const compatibilityFiles=[compatibilityFile,originalPinsFile,savedRequalificationFile,savedRequalification.inputPath,firstFailureFile];
const receiptFile=join(controlDir,'receipt.json'),control=JSON.parse(await readFile(receiptFile)),nativeCache=new Map();
assert.equal(control.status,'PASS_D548_CURRENT_NATIVE_AB_AND_GUARD');assert.deepEqual(control.rows.map(row=>row.label).sort(),['A','B','negative1']);
assert.equal(runtime.workId,'D548');assert.equal(runtime.sourceOrigin,config.sourceOrigin);assert.deepEqual(runtime.sourceDoc,seedDoc);assert.deepEqual(runtime.sourceDocA,seedDoc);assert.deepEqual(runtime.states,states);assert.deepEqual(runtime.guard,config.guard);assert.equal(runtime.seedPath,seedPath);assert.equal(runtime.originalSeedPath,seedPath);assert.equal(runtime.seedBytes,seedBytes);assert.equal(runtime.seedSHA256,seedSHA256);
const materialized=await readFile(runtime.materializedSeedPath);assert.equal(materialized.length,seedBytes);assert.equal(sha256(materialized),seedSHA256);assert.equal(materialized.toString(),seedText);
for(const name of ['A','B']){
  const file=join(controlDir,`${name}-native-before-assert.json`),bytes=await readFile(file),read=JSON.parse(bytes),state=states[name],row=control.rows.find(row=>row.label===name);
  assert.equal(runtime.packetPaths[name],file);assert.equal(row.status,'PASS_ONE_CURRENT_D548_NATIVE_DRAWING_CLASS_ONLY');assert.equal(row.packetSHA256,sha256(bytes));assert.equal(row.documentSHA256,state.documentSHA256);assert.equal(read.ok,true);assert.equal(read.status,'CAPTURED');assert.equal(read.inputUnchanged,true);
  assert.equal(read.documentJSON,state.documentJSON);assert.equal(read.documentSHA256,sha256(state.documentJSON));assert.deepEqual(JSON.parse(state.documentJSON),state.doc);assert.deepEqual(read.request.parameters,state.parameters);assert.equal(read.expectedSourceRevision,read.currentSourceRevision);assert.match(read.expectedSourceRevision,/^[0-9a-f]{16}$/);
  nativeCache.set(state.documentSHA256,{read,label:`NEW-current-D548-control-${name}`,file,sha256:sha256(bytes)});
}
const negativeFile=join(controlDir,'negative1-native-before-assert.json'),negativeBytes=await readFile(negativeFile),negative=JSON.parse(negativeBytes),negativeRow=control.rows.find(row=>row.label==='negative1');
assert.equal(negativeRow.status,'PASS_EXPECTED_CURRENT_TYPED_REFUSAL');assert.equal(negativeRow.packetSHA256,sha256(negativeBytes));assert.equal(negative.ok,false);assert.equal(negative.inputUnchanged,true);assert.equal(negative.documentSHA256,sha256(negative.documentJSON));assert.equal(negative.error.code,config.guard.expectedCode);assert.equal(negative.error.feature,config.guard.expectedFeature);assert.equal(negative.error.message,config.guard.expectedMessage);
const candidate=structuredClone(states.B.doc);candidate.nodes[1].height=0;assert.deepEqual(JSON.parse(negative.documentJSON),candidate);const invalidUIReason=config.guard.reason;assert.ok(invalidUIReason&&negative.error.message.includes(invalidUIReason));
const continuationFlag=process.env.D548_CONTINUE_FROM_SAVED_B;assert.ok(continuationFlag===undefined||continuationFlag==='1');const continueFromSavedB=continuationFlag==='1';let continuation=null;const continuationFiles=[];
if(continueFromSavedB){
  const directory='/tmp/barocss-d548-studio02',receiptFile=join(directory,'receipt.json'),receiptBytes=await readFile(receiptFile),receipt=JSON.parse(receiptBytes),savedFile=join(directory,'06-own-project-saved-B.bcad'),savedBytes=await readFile(savedFile);
  assert.equal(sha256(receiptBytes),'dac47cda36203025ae5c748e647e25171209c08d6770be73f9188a074a058879');assert.equal(receipt.status,'FAIL');assert.equal(receipt.phase,'06-own-project-Save-B');assert.ok(receipt.failure.includes('Close project'));assert.equal(receipt.states.length,24);assert.equal(receipt.reads.length,6);assert.equal(receipt.oracles.length,6);for(const key of ['errors','consoleErrors','changes','downloads'])assert.deepEqual(receipt[key],[]);
  assert.equal(receipt.sourceFrozenCount,807);assert.equal(receipt.sourceAfterCleanupCount,807);assert.equal(Object.keys(receipt.sourceFrozen).length,807);assert.deepEqual(receipt.sourceFrozen,receipt.sourceAfterCleanup);
  const expectedLabels=['01-initial-issued-B-H8','02-accepted-H10','03-retained-H10','04-FIRST-document-Undo-H8','05-document-Redo-H10','06-own-project-Save-B'];assert.deepEqual(receipt.reads.map(row=>row.label),expectedLabels);assert.deepEqual(receipt.oracles.map(row=>row.label),expectedLabels);
  for(let index=0;index<6;index++){const state=states[[0,3].includes(index)?'A':'B'],read=receipt.reads[index],oracle=receipt.oracles[index];assert.equal(read.read.ok,true);assert.equal(read.read.documentJSON,state.documentJSON);assert.equal(read.exactWholeDocSHA256,state.documentSHA256);assert.equal(oracle.exit,0);assert.equal(oracle.stdout.status,oracleStatus);assert.equal(oracle.stdout.documentSHA256,state.documentSHA256);assert.deepEqual(oracle.stdout.parameters,state.parameters);assert.equal(oracle.stdout.currentDOMSheets.length,2);}
  assert.equal(savedBytes.length,3892);assert.equal(sha256(savedBytes),'4c157be03f88a8280cd0b89ea619b0f29e4b57a1b779b044e603c3dfae86cc10');assert.equal(receipt.ownedSave.bytes,savedBytes.length);assert.equal(receipt.ownedSave.sha256,sha256(savedBytes));const doc=JSON.parse(savedBytes);assert.deepEqual(doc,states.B.doc);
  const frozenFile=join(directory,'source-frozen.json'),cleanupFile=join(directory,'source-after-cleanup.json'),frozenBytes=await readFile(frozenFile),cleanupBytes=await readFile(cleanupFile);assert.equal(sha256(frozenBytes),'2fae65436fac55b4118e143bcfba03ed0ecd178e2c48bdb4f544607c0e9db65c');assert.equal(sha256(cleanupBytes),sha256(frozenBytes));const frozenCapsule=JSON.parse(frozenBytes),cleanupCapsule=JSON.parse(cleanupBytes);assert.equal(frozenCapsule.count,807);assert.equal(cleanupCapsule.count,807);assert.deepEqual(frozenCapsule.hashes,receipt.sourceFrozen);assert.deepEqual(cleanupCapsule.hashes,receipt.sourceAfterCleanup);
  const browserFile='apps/cad-studio/test/two-sheet-postopen-svg-browser.mjs',executedBrowserFile=join(directory,'executed-two-sheet-postopen-svg-browser.mjs'),executedOracleFile=join(directory,'executed-two-sheet-postopen-svg-oracles.mjs'),executedBrowserSHA=sha256(await readFile(executedBrowserFile));assert.equal(executedBrowserSHA,'3e893f47a33e8d2b63e3c6d61af8e155df0890795422f6c281b2f1bc7056220a');assert.equal(receipt.sourceFrozen[browserFile],executedBrowserSHA);assert.equal(sha256(await readFile(executedOracleFile)),newModuleSHA);
  for(const[file,digest]of Object.entries(receipt.sourceFrozen)){if(file===browserFile)continue;assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Six-prefix source unchanged except private browser: ${file}`);}
  assert.ok(receipt.cleanup.some(entry=>typeof entry==='object'&&entry.namespace==='REMOVED_AND_ABSENT'));for(const closed of ['CONTEXT_CLOSED','BROWSER_CLOSED','SERVER_CLOSED'])assert.ok(receipt.cleanup.includes(closed));
  continuationFiles.push(receiptFile,savedFile,frozenFile,cleanupFile,executedBrowserFile,executedOracleFile);continuation={receiptFile,receiptSHA256:sha256(receiptBytes),receipt,savedFile,savedBytes:savedBytes.length,savedSHA256:sha256(savedBytes),doc,expectedLabels,executedBrowserFile,executedBrowserSHA,executedOracleFile,frozenFile,cleanupFile};
}
const controlFiles=(await readdir(controlDir)).map(file=>join(controlDir,file)),projectName=`D548-${randomUUID()}`,partName='D548-issued-B-two-sheets';
const producers=[...Object.keys(pins),...Object.keys(continuation?.receipt.sourceFrozen??{}),'packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/io/svg.ts','packages/barocss-cad-model/src/drawing/sheets.ts','packages/barocss-cad-model/src/drawing/dimensions.ts','apps/cad-studio/src/ui/useDrawingSheet.ts','apps/cad-studio/src/ui/drawing/ExportActions.tsx'];
const f=await createFlow({name:'two-sheet-postopen-svg',envFrozen:'D548_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D548 issued-B two sheets: original Distance8/10, refused0/FIRSTUndoRedo, ownSaveOpenH10, actual SVG per sheet, postH8',
  initialFiles:['apps/cad-studio/test/two-sheet-postopen-svg-browser.mjs',...builderFiles,...inputFiles,...retainedFiles,...controlFiles,pinsFile,seedPath,...compatibilityFiles,...continuationFiles],extraFrozen:producers,
  requiredFrozen:[...builderFiles,...inputFiles,...retainedFiles,...compatibilityFiles,...continuationFiles,...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx'].map(file=>relative(repo,resolve(repo,file))),
  limits:[continueFromSavedB?'Desktop WebGPU1440x900 only; root must view original PNGs. Six eligible prior groups plus four remaining groups; five fresh tail bindings include one own-Save setup, two actual sheets each.':'Desktop WebGPU1440x900 only; root must view original PNGs. Ten selected groups/ten fresh physical bindings, two actual sheets per binding.',
    'Exact retained D486 issued-B/H8 source; creation and earlier issue lifecycle remain historical. No Next revision or new drawing creation.',
    'Only NEW exact current H8/H10 native packets under complete producer pins; each consumer has fresh original Worker and new independent Python.',
    'B/revisedModel3336e060 remains the H8 issue print; both H10 sheets are stale, H8 clears stale. Six historical H6 signature caches are retained source metadata, not current geometric truth.',
    'Two owned local generated SVG downloads only. Original bytes and actual DOM SVG differ in role; API/browser equality is not numerical authority. XML verifier is product-import-free standard-library Python.',
    'SVG serializer envelope is distinct from native physical budgets. Current title comes from actual file tab/settings; no historical fallback title is forced.',
    'Same-context project reload, not cold-process persistence. No final resave, PDF/owner-held mismatch investigation, external acquisition/mobile/standards/wholeB06 claim.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    fileName:document.querySelector('.doc-tab input')?.value??null,alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
// Private diagnostics only. A diagnostic failure must not replace an action failure.
f.report.runtimeOwnership={nodePID:process.pid,nodePPID:process.ppid,startedAt:new Date().toISOString(),serverURL:null};
f.report.versionsDiagnostics=[];f.report.resourceCloseDiagnostics=[];
async function diagnosticWrite(){let timer;try{const line=JSON.stringify({at:new Date().toISOString(),phase:f.phase,runtimeOwnership:f.report.runtimeOwnership,versionsDiagnostics:f.report.versionsDiagnostics,resourceCloseDiagnostics:f.report.resourceCloseDiagnostics})+'\n';await Promise.race([appendFile(join(output,'diagnostics-live.jsonl'),line),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Diagnostic append exceeded 1500ms')),1500);})]);}catch(error){console.error('D548 diagnostic append failed:',String(error));}finally{clearTimeout(timer);}}
async function boundedObservation(read){let timer;try{return await Promise.race([read(),new Promise(resolve=>{timer=setTimeout(()=>resolve({diagnosticTimeout:true}),1500);})]);}catch(error){return {diagnosticError:String(error)};}finally{clearTimeout(timer);}}
async function versionsCheckpoint(step){
  const entry={step,phase:f.phase,at:new Date().toISOString(),url:f.page?.url()??null};f.report.versionsDiagnostics.push(entry);await diagnosticWrite();
  const observed=await boundedObservation(()=>f.page.evaluate(()=>{
    const card=document.querySelector('[aria-label="Versions panel"]'),button=document.querySelector('button[aria-label="Project and versions"]');
    const visible=element=>!!element&&!!element.getClientRects().length&&getComputedStyle(element).visibility!=='hidden';
    return {documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.()??null,rootFresh:window.__studioFresh??null,panelPresent:!!card,panelVisible:visible(card),buttonVisible:visible(button),buttonClass:button?.className??null,events:window.__d548VersionsEvents??[]};
  }));
  if(observed.documentJSON!==undefined){observed.documentSHA256=sha256(observed.documentJSON);delete observed.documentJSON;}Object.assign(entry,observed);await diagnosticWrite();
}
const wrappedResources=new WeakSet();
function watchClose(resource,label){
  if(!resource||wrappedResources.has(resource))return;wrappedResources.add(resource);const original=resource.close;
  resource.close=async function(...args){const entry={label,startedAt:new Date().toISOString()};f.report.resourceCloseDiagnostics.push(entry);await diagnosticWrite();try{const result=await original.apply(this,args);entry.completedAt=new Date().toISOString();entry.status='CLOSED';await diagnosticWrite();return result;}catch(error){entry.completedAt=new Date().toISOString();entry.status='FAIL';entry.error=error.stack??String(error);await diagnosticWrite();throw error;}};
}
const originalStart=f.start;f.start=async function(...args){const result=await originalStart.apply(this,args);f.report.runtimeOwnership.serverURL=f.server.resolvedUrls.local[0];watchClose(f.browser,'BROWSER');watchClose(f.server,'SERVER');await diagnosticWrite();return result;};
const originalNewPage=f.newPage;f.newPage=async function(...args){const result=await originalNewPage.apply(this,args);watchClose(f.context,'CONTEXT');const observeVersions=()=>{
  const events=window.__d548VersionsEvents=[];
  for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,event=>{if(event.target instanceof Element&&event.target.closest('button[aria-label="Project and versions"]')&&events.length<64)events.push({type:event.type,trusted:event.isTrusted,at:new Date().toISOString(),timeStamp:event.timeStamp});},{capture:true,passive:true});
};await f.page.addInitScript(observeVersions);await f.page.evaluate(observeVersions);return result;};
await diagnosticWrite();
f.report.seed={file:seedPath,bytes:seedBytes,sha256:seedSHA256,authority:'Exact actual D486 issued-B/H8 saved Doc; retained six historical H6 reference caches and sheet ownership'};
f.report.controls={receiptFile,receiptSHA256:sha256(await readFile(receiptFile)),runtimeFile,runtimeSHA256:sha256(await readFile(runtimeFile)),pinsFile,pinsSHA256:sha256(await readFile(pinsFile)),matchedPins:Object.keys(pins).length,packets:[...nativeCache.values()].map(({read,...rest})=>rest)};
f.report.nativeReuseCompatibility={file:compatibilityFile,sha256:sha256(compatibilityBytes),...compatibility,currentPinsSHA256:sha256(await readFile(pinsFile)),authority:'Original current native/control/guard packets retained unchanged; only private Python DOM-versus-file viewport expectation changed, with all remaining original producer pins exact'};
f.report.savedInitialRequalification={file:savedRequalificationFile,sha256:sha256(savedRequalificationBytes),status:savedRequalification.status,authority:savedRequalification.authority,newNative:0,newWorker:0,newStudio:0,workflowGroupsPassed:0};
f.report.firstActualFailure={file:firstFailureFile,sha256:sha256(firstFailureBytes),status:firstFailure.status,phase:firstFailure.phase,failure:firstFailure.failure,workflowGroupsPassed:0,exports:0,authority:'Original Studio01 FAIL preserved; saved-only initial H8 requalification does not relabel it or certify the unrun lifecycle'};
f.report.sourceOrigin=config.sourceOrigin;f.report.separateControlledGuard={file:negativeFile,sha256:sha256(negativeBytes),error:negative.error,authority:'Controlled native classification; actual UI and accepted-source retention are captured separately'};
f.report.continuation=continuation?{mode:'D548_CONTINUE_FROM_SAVED_B=1',priorReceipt:continuation.receiptFile,priorReceiptSHA256:continuation.receiptSHA256,priorStatus:'FAIL',prefixQualification:'SIX_QUALIFIED_GROUPS_ONLY',eligiblePrefixGroups:continuation.expectedLabels,eligiblePrefixGroupCount:6,sourcePinsCompared:807,sourceException:'Private browser requery/strict tail continuation only',executedBrowserFile:continuation.executedBrowserFile,executedBrowserSHA256:continuation.executedBrowserSHA,savedFile:continuation.savedFile,savedBytes:continuation.savedBytes,savedSHA256:continuation.savedSHA256,setupSaveBindings:1,remainingWorkflowGroups:4,plannedFreshTailBindings:5}:null;
f.report.svgExports=[];f.report.projectName=projectName;let projectCreated=false,newCaptures=0;const labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
function retained(state,before,doc){assert.deepEqual(state.doc,doc);assert.deepEqual(state.worker.bodies,before.worker.bodies);assert.deepEqual(state.historyRows,before.historyRows);assert.equal(state.dirty,before.dirty);}
async function model(){await f.page.getByRole('button',{name:'Model',exact:true}).click();await f.closeEditor();await f.ready();}
async function drawing(source){
  await f.page.getByRole('button',{name:'Drawing',exact:true}).click();await f.page.getByRole('complementary',{name:'Drawing settings',exact:true}).waitFor();await f.ready();
  await f.page.waitForFunction(source=>{const summary=window.__studioDrawing?.(),svg=document.querySelector('svg[aria-label="Drawing sheet"]');if(!summary||!svg||document.querySelector('.dw-busy'))return false;const prints=[...svg.querySelectorAll('text')].map(x=>x.textContent).filter(x=>x.startsWith('SRC '));return prints.length===1&&prints[0]==='SRC '+source;},source,{timeout:60000});
}
async function selectSheet(index,source){
  const tabs=f.page.getByRole('tablist',{name:'Sheets',exact:true});await tabs.getByRole('tab',{name:`Sheet ${index+1}`,exact:true}).click();
  await f.page.waitForFunction(index=>{const active=document.querySelector('[role="tablist"][aria-label="Sheets"] [role="tab"][aria-selected="true"]'),svg=document.querySelector('svg[aria-label="Drawing sheet"]');return active?.textContent===`Sheet ${index+1}`&&!!svg&&!document.querySelector('.dw-busy')&&[...svg.querySelectorAll('text')].some(x=>x.textContent===`${index+1} OF 2 A4`);},index,{timeout:60000});await drawing(source);
}
async function captureBoth(label,read){
  await drawing(read.expectedSourceRevision);const first=await f.page.evaluate(()=>({doc:JSON.parse(JSON.stringify(window.__studioDoc)),documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,fileName:document.querySelector('.doc-tab input')?.value??null})),sheets=[];
  for(const sheetIndex of [0,1]){
    await selectSheet(sheetIndex,read.expectedSourceRevision);const svg=f.page.getByLabel('Drawing sheet',{exact:true}),settings=f.page.getByRole('complementary',{name:'Drawing settings',exact:true}),texts=await svg.locator('text').allTextContents();
    const observation={sheetIndex,doc:await f.doc(),summary:await f.page.evaluate(()=>window.__studioDrawing?.()??null),printedSRC:texts.filter(text=>text.startsWith('SRC ')),svg:await svg.evaluate(element=>element.outerHTML),busy:await f.page.locator('.dw-busy').count()>0,revisionInput:await settings.getByLabel('Revision',{exact:true}).inputValue(),staleWarningCount:await settings.getByLabel('Revision out of date',{exact:true}).count(),texts};
    sheets.push(observation);await writeFile(join(output,`${label}-sheet${sheetIndex+1}-DOM.svg`),observation.svg);await writeFile(join(output,`${label}-sheet${sheetIndex+1}-observed.json`),JSON.stringify(observation,null,2));await capture(`${label}-sheet${sheetIndex+1}`);
  }
  const state={...first,sheets,historyRows:await f.page.locator('.history .hs').evaluateAll(rows=>rows.map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')}))),dirty:await f.page.getByLabel('Unsaved changes',{exact:true}).count()>0};
  await writeFile(join(output,`${label}-both-sheets-before-assert.json`),JSON.stringify(state,null,2));f.report.observations.push({label,...state});await f.persist();return state;
}
async function qualify(label,doc,parameters,extra={}){
  f.phase=label;await f.same(doc);await f.ready();const raw=await capture(`${label}-raw-before-assert`),key=sha256(raw.documentJSON),prior=nativeCache.get(key),read=prior?.read??await f.inspect(`${label}-native`,raw.doc,{label,parameters});if(!prior)newCaptures++;
  f.report.reads.push({label,read,exactWholeDocSHA256:key,reusedFrom:prior?.label??null});const state=await captureBoth(label,read);
  const input={doc:state.doc,documentJSON:state.documentJSON,expectedDoc:doc,seedDoc,read,consumer:state,parameters,...extra};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'two-sheet-postopen-svg-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve original output before assertions. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:prior?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.deepEqual(state.doc,doc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);for(const sheet of state.sheets)assert.deepEqual(sheet.doc,doc);await f.same(doc);
  if(!prior)nativeCache.set(key,{read,label});return {state,read};
}
async function height(previous,oldValue,value,label){
  f.phase=label;await model();await f.openFeatureEditor(1,label);const field=f.editor().getByLabel('Distance',{exact:true});assert.equal(Number(await field.inputValue()),oldValue);await field.fill(String(value));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const state=await capture(`${label}-accepted-before-assert`);await f.closeEditor();return state.doc;
}
async function refuse(B,accepted){
  f.phase='03-original-Distance0';await model();await f.openFeatureEditor(1,f.phase);const field=f.editor().getByLabel('Distance',{exact:true});assert.equal(Number(await field.inputValue()),10);await field.fill('0');await capture('03-Distance0-typed-before-Apply');assert.deepEqual(await f.doc(),B);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.page.waitForFunction(reason=>[...document.querySelectorAll('.toast[role="alert"]')].some(alert=>alert.textContent.includes(reason)),invalidUIReason);
  const state=await capture('03-Distance0-refused-before-assert');retained(state,accepted,B);f.report.observations.push({label:'Distance0-actual-UI-retention',actualUIReasons:state.alerts,separateControlledNative:{file:negativeFile,sha256:sha256(negativeBytes),error:negative.error},authority:'Actual UI/accepted Doc/body/history/dirty retention; controlled code/feature are not inferred Worker fields'});
  await f.closeEditor();await f.dismissToasts();await qualify('03-retained-H10',B,states.B.parameters);
}
let versionsCall=0;
async function versions(){
  const previousPhase=f.phase,prefix=`versions-${++versionsCall}`;f.phase=`${prefix}-close-editor`;
  try{
    await f.closeEditor();f.phase=`${prefix}-Model-click`;await versionsCheckpoint('before-Model-click');await f.page.getByRole('button',{name:'Model',exact:true}).click();await versionsCheckpoint('after-Model-click');
    const card=f.page.getByLabel('Versions panel',{exact:true});f.phase=`${prefix}-card-visibility`;await versionsCheckpoint('before-card-visibility');const visible=await card.isVisible();await versionsCheckpoint(`after-card-visibility-${visible}`);
    if(!visible){f.phase=`${prefix}-Project-click`;await versionsCheckpoint('before-Project-click');await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await versionsCheckpoint('after-Project-click');}
    f.phase=`${prefix}-panel-wait`;await versionsCheckpoint('before-panel-wait');await card.waitFor();await versionsCheckpoint('after-panel-wait');f.phase=previousPhase;return card;
  }catch(error){f.report.firstActionFailure??={phase:f.phase,error:error.stack??String(error),at:new Date().toISOString()};await versionsCheckpoint('versions-error-before-rethrow');throw error;}
}
async function saveOpen(B,setupOnly=false){
  let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
  await writeFile(join(output,setupOnly?'setup-own-project-saved-B.bcad':'06-own-project-saved-B.bcad'),saved.text);f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text)};await f.persist();assert.deepEqual(JSON.parse(saved.text),B);await qualify(setupOnly?'setup-own-project-Save-H10-not-group6':'06-own-project-Save-B',B,states.B.parameters);
  card=await versions();const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(B);await f.ready();return qualify('07-same-context-reload-Open-B',B,states.B.parameters);
}
async function exportSheet(index,B,opened){
  const label=`0${index+8}-actual-SVG-sheet${index+1}-H10`;f.phase=label;await drawing(opened.read.expectedSourceRevision);await selectSheet(index,opened.read.expectedSourceRevision);
  const selected=await capture(`${label}-selected-before-download`),domSVG=await f.page.getByLabel('Drawing sheet',{exact:true}).evaluate(element=>element.outerHTML),filename=await f.page.locator('.doc-tab input').inputValue(),title=selected.doc.drawing.title??filename;
  const pending=f.page.waitForEvent('download');await f.page.getByRole('button',{name:'Export SVG',exact:true}).click();const download=await pending,path=join(output,`${label}-actual.svg`);await download.saveAs(path);const bytes=await readFile(path);
  const svgExport={sheetIndex:index,bytes:Array.from(bytes),sha256:sha256(bytes),documentSHA256:sha256(selected.documentJSON),nativeBRepSHA256:opened.read.outputs[0].nativeBRepSHA256,domSVG,filename:download.suggestedFilename(),title};
  const provenance={path,...svgExport,bytes:bytes.length,currentFilename:filename,authority:'Actual current-sheet Export SVG after own project OpenH10; original file and selected DOM preserved; native hash is a paired physical-class observation, not embedded SVG or Worker BRep'};
  await writeFile(join(output,`${label}-selected-DOM.svg`),domSVG);await writeFile(join(output,`${label}-actual-export-before-assert.json`),JSON.stringify(provenance,null,2));f.report.svgExports.push(provenance);await f.persist();
  retained(selected,opened.state,B);assert.equal(download.suggestedFilename(),`${filename}-sheet-${index+1}.svg`);const qualified=await qualify(label,B,states.B.parameters,{svgExport});retained(qualified.state,opened.state,B);assert.equal(f.report.downloads.length,index+1);
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    let B,opened;
    if(continueFromSavedB){
      f.phase='setup-exact-Studio02-saved-H10-Open';await f.page.setInputFiles('input[aria-label="Model file"]',continuation.savedFile);await f.page.waitForFunction(()=>window.__studioDoc?.nodes?.length===2);await capture('setup-saved-H10-Open-observed-before-exact-wait');await f.same(continuation.doc);await f.ready();B=await f.doc();opened=await saveOpen(B,true);
    }else{
    await f.page.setInputFiles('input[aria-label="Model file"]',seedPath);await f.page.waitForFunction(()=>window.__studioDoc?.nodes?.length===2);await capture('00-initial-Open-observed-before-exact-wait');await f.same(seedDoc);await f.ready();const initial=await qualify('01-initial-issued-B-H8',await f.doc(),states.A.parameters),A=initial.state.doc;
    B=await height(A,8,10,'02-public-Distance10');const accepted=await qualify('02-accepted-H10',B,states.B.parameters);
    await refuse(B,accepted.state);await model();await f.undo();await f.same(A);await qualify('04-FIRST-document-Undo-H8',A,states.A.parameters);
    await model();await f.redo();await f.same(B);await qualify('05-document-Redo-H10',B,states.B.parameters);opened=await saveOpen(B);
    }
    await exportSheet(0,B,opened);await exportSheet(1,B,opened);const postDoc=await height(B,10,8,'10-postOpen-Distance8'),post=await qualify('10-postOpen-H8',postDoc,states.A.parameters);assert.equal(post.state.dirty,true);
    assert.equal(f.report.reads.length,continueFromSavedB?5:10);assert.equal(f.report.downloads.length,2);assert.equal(f.report.svgExports.length,2);f.report.setupPhysicalBindings=continueFromSavedB?1:0;f.report.freshWorkflowGroupsThisRun=continueFromSavedB?4:10;f.report.eligiblePriorWorkflowGroups=continueFromSavedB?6:0;f.report.nativeCaptures=newCaptures;f.report.currentWorkerBindings=f.report.reads.length;f.report.actualSheetObservations=f.report.reads.length*2;f.report.exactWholeDocNativeReuses=f.report.reads.filter(row=>row.reusedFrom!==null).length;
  }catch(error){f.report.firstActionFailure??={phase:f.phase,error:error.stack??String(error),at:new Date().toISOString()};await diagnosticWrite();throw error;}finally{
    if(projectCreated){const priorActionFailure=f.report.firstActionFailure,cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}catch(error){cleanup.error=error.stack??String(error);if(!priorActionFailure)throw error;}finally{f.report.cleanup.push(cleanup);await diagnosticWrite();}}
  }
});
