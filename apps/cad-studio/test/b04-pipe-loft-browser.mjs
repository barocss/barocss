// D544_SOURCE_FROZEN=1 node test/b04-pipe-loft-browser.mjs /ABS/NEW/OUTPUT
// Two separate current saved-part consumers; root owns all execution and images.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {capsule,createFlow,sha256} from './flow-helper.mjs';
import {cases,caseConfigs,builderFiles,retainedFiles,inspectorSource,oracleSource,oracleStatus} from './b04-pipe-loft-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..'),app=resolve(import.meta.dirname,'..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const order=['pipe','loft'],modulePath='apps/cad-studio/test/b04-pipe-loft-oracles.mjs',moduleHash='33ed11b42df4664391599931e4ee60c087c566eb9200393cd4dc14e7d4417b95';
assert.deepEqual(caseConfigs,cases);assert.deepEqual(Object.keys(cases),order);
const index={status:'PREPARING',authority:'TWO_SEPARATE_CURRENT_STUDIO_CASES_NO_CROSS_DOC_STITCHING',children:order.map(caseId=>({caseId,status:'NOT_RUN',output:join(output,caseId)})),firstFailure:null};
const persistIndex=()=>writeFile(join(output,'category-index.json'),JSON.stringify(index,null,2));await persistIndex();
const evidence=new Set(['apps/cad-studio/test/b04-pipe-loft-browser.mjs','apps/cad-studio/test/flow-helper.mjs',...builderFiles,...retainedFiles]);
const sourcePins=new Set(),prepared=new Map();let frozen=null;
async function jsonEvidence(file){evidence.add(file);const bytes=await readFile(file);return {value:JSON.parse(bytes),sha256:sha256(bytes)};}
function expected(config,parameters){
  const state=Object.values(config.states).find(state=>JSON.stringify(state.parameters)===JSON.stringify(parameters));assert.ok(state,'Only declared S/B/C parameter classes');return structuredClone(state.doc);
}
async function prepare(){
  assert.equal(sha256(await readFile(resolve(repo,modulePath))),moduleHash);
  const pinsFile='/tmp/barocss-d544-preflight01/source-pins.json',wrapperFile='/tmp/barocss-d544-preflight01/wrapper-receipt.json';
  const pinEvidence=await jsonEvidence(pinsFile),wrapper=await jsonEvidence(wrapperFile),pins=pinEvidence.value;
  assert.equal(wrapper.value.childExit,0);assert.deepEqual(wrapper.value.changed,[]);assert.equal(wrapper.value.moduleSHA256,moduleHash);assert.equal(wrapper.value.sourcePinCount,479);assert.equal(Object.keys(pins).length,wrapper.value.sourcePinCount);
  for(const[path,digest]of Object.entries(pins)){sourcePins.add(path);assert.equal(sha256(await readFile(resolve(repo,path))),digest,`Exact current producer/builder pin: ${path}`);}
  const executed='/tmp/barocss-d544-preflight01/executed-b04-pipe-loft-oracles.mjs';evidence.add(executed);assert.equal(sha256(await readFile(executed)),moduleHash);
  const control=await jsonEvidence('/tmp/barocss-d544-control01/receipt.json');assert.equal(control.value.status,'PASS_CURRENT_D544_DECLARED_ADMISSIONS_ONLY');
  index.controlCustody={receipt:{file:'/tmp/barocss-d544-control01/receipt.json',sha256:control.sha256,status:control.value.status},pins:{file:pinsFile,sha256:pinEvidence.sha256,count:Object.keys(pins).length},wrapper:{file:wrapperFile,sha256:wrapper.sha256},executedModule:{file:executed,sha256:moduleHash}};
  for(const caseId of order){
    const config=cases[caseId],dir=join('/tmp/barocss-d544-control01',caseId),bytes=await readFile(config.seedPath);evidence.add(config.seedPath);
    assert.equal(bytes.length,config.seedBytes);assert.equal(sha256(bytes),config.seedSHA256);assert.equal(bytes.toString(),config.seedText);assert.deepEqual(JSON.parse(bytes),config.states.S.doc);
    evidence.add(config.legacyOraclePath);assert.equal(sha256(await readFile(config.legacyOraclePath)),config.legacyOracleSHA256);await jsonEvidence(config.historicalReceipt);
    const controlReceipt=await jsonEvidence(join(dir,'receipt.json'));assert.equal(controlReceipt.value.status,'PASS_ONE_CONTROLLED_D544_CASE_ONLY');const cache=new Map(),packets=[];
    for(const name of ['S','B','C']){
      const file=join(dir,`${name}-native-before-assert.json`),packet=await jsonEvidence(file),read=packet.value,state=config.states[name],row=controlReceipt.value.rows.find(row=>row.label===name);
      assert.equal(row?.status,'PASS_ONE_CURRENT_D544_NATIVE_CLASS_ONLY');assert.equal(row.packetSHA256,packet.sha256);assert.equal(row.documentSHA256,state.documentSHA256);
      assert.equal(read.ok,true);assert.equal(read.inputUnchanged,true);assert.equal(read.documentJSON,state.documentJSON);assert.equal(read.documentSHA256,state.documentSHA256);assert.equal(sha256(read.documentJSON),state.documentSHA256);
      assert.deepEqual(JSON.parse(read.documentJSON),state.doc);assert.equal(read.request.caseId,caseId);assert.deepEqual(read.request.parameters,state.parameters);
      cache.set(read.documentSHA256,{read,label:`NEW-D544-control-${caseId}-${name}`,file,sha256:packet.sha256});packets.push({state:name,file,sha256:packet.sha256,documentSHA256:read.documentSHA256});
    }
    const guards=[];
    for(let i=0;i<config.guards.length;i++){
      const g=config.guards[i],file=join(dir,`negative${i+1}-native-before-assert.json`),packet=await jsonEvidence(file),read=packet.value,row=controlReceipt.value.rows.find(row=>row.label===`negative${i+1}`);
      assert.equal(row?.status,'PASS_EXPECTED_CURRENT_TYPED_REFUSAL');assert.equal(row.packetSHA256,packet.sha256);assert.equal(read.ok,false);assert.equal(read.inputUnchanged,true);assert.equal(read.documentSHA256,sha256(read.documentJSON));assert.equal(row.documentSHA256,read.documentSHA256);
      assert.equal(read.error.code,g.expectedCode);assert.equal(read.error.feature,g.expectedFeature);assert.ok(read.error.message.includes(g.reason));assert.equal(read.request.caseId,caseId);assert.deepEqual(read.request.parameters,{attemptedFrom:config.states.C.parameters,field:g});
      const invalid=structuredClone(config.states.C.doc);if(caseId==='pipe'){assert.equal(g.key,'run0');invalid.nodes[g.index].path[0].length=g.value;}else{assert.equal(g.key,'z1');invalid.nodes[g.index].sections[1].z=g.value;}assert.deepEqual(JSON.parse(read.documentJSON),invalid);
      guards.push({file,sha256:packet.sha256,error:read.error,sourceReason:read.error.message.replace(/^n\d+:\s*/,''),field:g});
    }
    prepared.set(caseId,{config,seedDoc:JSON.parse(bytes),cache,packets,guards,controlReceipt:{file:join(dir,'receipt.json'),sha256:controlReceipt.sha256,status:controlReceipt.value.status}});
  }
  const studio=(await readdir(join(app,'src'),{recursive:true})).filter(file=>/\.(ts|tsx|css)$/.test(file)).map(file=>join(app,'src',file));for(const file of [...sourcePins,...studio,'apps/cad-studio/vite.config.ts'])evidence.add(file);
  frozen=await capsule(repo,output,'category-frozen',[...evidence]);index.sourceFreeze={count:Object.keys(frozen).length,file:'source-category-frozen.json',expandedInspectorSHA256:sha256(inspectorSource),expandedPythonSHA256:sha256(oracleSource)};
  await writeFile(join(output,'expanded-inspector.ts'),inspectorSource);await writeFile(join(output,'expanded-oracle.py'),oracleSource);index.status='RUNNING';await persistIndex();
}
async function runCase(caseId){
  const own=prepared.get(caseId),config=own.config,child=index.children.find(x=>x.caseId===caseId),projectName=`D544-${caseId}-${randomUUID()}`,partName=`D544-${caseId}`;
  child.status='RUNNING';child.projectName=projectName;await persistIndex();let projectCreated=false,newCaptures=0;const labels=new Set();
  const f=await createFlow({name:'b04-pipe-loft',envFrozen:'D544_SOURCE_FROZEN',output:child.output,inspectorSource,oracleSource,
    qualification:`D544 ${caseId}: independent actual saved-part editor/refusal/history/project/re-edit consumer`,initialFiles:[...evidence],extraFrozen:[...sourcePins],requiredFrozen:[...builderFiles,...retainedFiles,...sourcePins,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx'].map(file=>relative(repo,resolve(repo,file))),
    limits:['Desktop WebGPU1440x900 only; root must view original screenshots.','This child is one separate saved Pipe/Loft part; no cross-Doc composition or wholeB04 claim.',
      'Only NEW D544 exact current controls are eligible; original full BRep and same-packet legacy observation views remain unchanged.',
      'Optional original pcurve absence remains NOT_EXERCISED/null. Legacy presence booleans alone do not qualify UV lifts.',
      'All nine consumer joins use a fresh current Worker and new Python; cache misses capture actual source without forcing equality.',
      'Native guard code/feature is separately labelled controlled evidence, never inferred as an actual Worker field.',
      'Sheet is a separate B04 candidate. Same-context reload is not cold-process persistence; no export/download/mobile/release.'],
    snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
      historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
      editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
      alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
  });
  f.report.caseId=caseId;f.report.seed={path:config.seedPath,bytes:config.seedBytes,sha256:config.seedSHA256,historicalAuthority:config.historicalAuthority};f.report.projectName=projectName;
  f.report.eligibleControls={packets:own.packets,guards:own.guards,receipt:own.controlReceipt,eligibility:'ALL_CURRENT_D544_SOURCE_PINS_EXACT_NO_HISTORICAL_NATIVE_REUSE'};
  const basePersist=f.persist;f.persist=async()=>{await basePersist();child.phase=f.phase;child.bindings=f.report.reads.length;child.snapshots=f.report.states.length;await persistIndex();};
  const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(child.output,`${label}-actual.bcad`),state.documentJSON);return state;};
  async function qualify(label,doc,parameters){
    f.phase=label;await f.same(doc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),prior=own.cache.get(key),read=prior?.read??await f.inspect(`${label}-native`,state.doc,{caseId,parameters,label});if(!prior)newCaptures++;
    f.report.reads.push({label,read,exactWholeDocSha256:key,reusedFrom:prior?.label??null});
    const input={caseId,doc:state.doc,expectedDoc:doc,read,parameters,consumer:state,documentJSON:state.documentJSON};await writeFile(join(child.output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
    const run=spawnSync('python3',['-I',join(child.output,'b04-pipe-loft-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
    await writeFile(join(child.output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(child.output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve original result. */}
    f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:prior?.label??null});await f.persist();
    assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.deepEqual(state.doc,expected(config,parameters));assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
    if(!prior)own.cache.set(key,{read,label});return state;
  }
  async function edit(field,previous,label){
    f.phase=label;await f.closeEditor();await f.openFeatureEditor(field.index,label);await f.editor().getByLabel(field.label,{exact:true}).fill(String(field.value));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
    await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const state=await capture(`${label}-accepted-before-assert`);await f.closeEditor();return state.doc;
  }
  async function guards(C,accepted){
    for(let i=0;i<own.guards.length;i++){
      const guard=own.guards[i],field=guard.field;f.phase=`04-guard${i+1}`;await f.openFeatureEditor(field.index,f.phase);await f.editor().getByLabel(field.label,{exact:true}).fill(String(field.value));await capture(`04-guard${i+1}-typed-before-Apply`);assert.deepEqual(await f.doc(),C);
      await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.page.waitForFunction(reason=>[...document.querySelectorAll('.toast[role="alert"]')].some(alert=>alert.textContent.includes(reason)),guard.sourceReason);
      const state=await capture(`04-guard${i+1}-refused-before-assert`);assert.deepEqual(state.doc,C);assert.deepEqual(state.worker.bodies,accepted.worker.bodies);assert.deepEqual(state.historyRows,accepted.historyRows);
      f.report.observations.push({label:`guard${i+1}-actual-UI-retention`,field,actualUIReasons:state.alerts,separateControlledNative:{file:guard.file,sha256:guard.sha256,error:guard.error},authority:'Actual UI detail/retention joined to separately classified native guard; no actual Worker code/feature assertion'});
      await f.closeEditor();await f.dismissToasts();await f.same(C);
    }
    await qualify('04-retained-C-after-all-guards',C,config.states.C.parameters);
  }
  async function versions(){await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;}
  async function saveOpen(C){
    let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
    await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
    await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
    await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
    const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
    await writeFile(join(child.output,'07-own-project-saved-C.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),C);f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};await qualify('07-own-project-Save-exact-C',C,config.states.C.parameters);
    const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
    card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(C);await f.ready();await qualify('08-same-context-reload-Open-exact-C',C,config.states.C.parameters);
  }
  await f.run(async()=>{
    await f.newPage();await f.page.setViewportSize({width:1440,height:900});
    try{
      await f.page.setInputFiles('input[aria-label="Model file"]',config.seedPath);await f.same(own.seedDoc);await f.ready();await qualify('01-initial-S',own.seedDoc,config.states.S.parameters);
      const B=await edit(config.fields.B,own.seedDoc,'02-public-B');await qualify('02-accepted-B',B,config.states.B.parameters);
      const C=await edit(config.fields.C,B,'03-public-C'),accepted=await qualify('03-accepted-C',C,config.states.C.parameters);await guards(C,accepted);
      await f.undo();await f.same(B);await qualify('05-FIRST-document-Undo-exact-B',B,config.states.B.parameters);await f.redo();await f.same(C);await qualify('06-Redo-exact-C',C,config.states.C.parameters);
      await saveOpen(C);const post=await edit(config.fields.postOpen,C,'09-postOpen-B');await qualify('09-postOpen-exact-B',post,config.states.B.parameters);assert.deepEqual(post,B);assert.equal(f.report.reads.length,9);assert.deepEqual(f.report.downloads,[]);
      f.report.nativeCaptures=newCaptures;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
    }catch(error){f.report.status='FAIL';f.report.failure=error.stack??String(error);child.status='FAIL_PENDING_CLEANUP';index.status='FAIL';index.firstFailure??={caseId,phase:f.phase,error:f.report.failure};await f.persist();throw error;}
    finally{if(projectCreated){const cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}finally{f.report.cleanup.push(cleanup);await f.persist();}}}
  });
  child.status=f.report.status;child.receipt={file:join(child.output,'receipt.json'),sha256:sha256(await readFile(join(child.output,'receipt.json')))};child.nativeCaptures=newCaptures;child.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;await persistIndex();
  const after=await capsule(repo,output,`category-after-${caseId}`,[...evidence]);assert.deepEqual(after,frozen,'Global source freeze remains through every child cleanup');assert.equal(f.report.status,'PASS',f.report.failure);return f.report.reads.length;
}
try{
  await prepare();let bindings=0;for(const caseId of order){try{bindings+=await runCase(caseId);}catch(error){const child=index.children.find(child=>child.caseId===caseId);child.status='FAIL';index.status='FAIL';index.firstFailure??={caseId,phase:child.phase??'child preparation/completion',error:error.stack??String(error)};await persistIndex();throw error;}}assert.equal(bindings,18);index.currentWorkerBindings=bindings;index.status='PASS';
}catch(error){index.status='FAIL';index.firstFailure??={phase:'category preparation/child completion',error:error.stack??String(error)};process.exitCode=1;await persistIndex();}
finally{
  if(frozen)try{const after=await capsule(repo,output,'category-after-all-cleanup',[...evidence]);assert.deepEqual(after,frozen);}catch(error){index.status='FAIL';index.sourceFailure=error.stack??String(error);process.exitCode=1;}
  await persistIndex();const sealed=JSON.stringify(index,null,2);await writeFile(join(output,'category-index.sealed.json'),sealed);await writeFile(join(output,'category-seal.json'),JSON.stringify({indexFile:'category-index.sealed.json',indexSHA256:sha256(sealed),children:index.children.map(({caseId,status,receipt})=>({caseId,status,receipt})),expandedInspectorSHA256:sha256(inspectorSource),expandedPythonSHA256:sha256(oracleSource)},null,2));
}
