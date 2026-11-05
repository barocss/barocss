// D545_SOURCE_FROZEN=1 node test/project-open-framing-browser.mjs /ABS/NEW/OUTPUT
// Measurement only: observe the real delayed project Open fit before any repair.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {capsule,createFlow,sha256} from './flow-helper.mjs';
import {cases,builderFiles,retainedFiles,inspectorSource,oracleSource,oracleStatus} from './b04-pipe-loft-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..'),app=resolve(import.meta.dirname,'..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const inputs=[
  {caseId:'pipe',file:'/tmp/barocss-d544-studio01/pipe/07-own-project-saved-C.bcad',bytes:855,sha256:'c17ab55291bd47836468fcf550d9d627d366e57ed0928c73b828e62fbe94d4b2'},
  {caseId:'loft',file:'/tmp/barocss-d544-studio01/loft/07-own-project-saved-C.bcad',bytes:2458,sha256:'ca1d60a011fb590730f747ad7d4577e0ae54074ef380398726488c97c7ed0dd1'},
];
const index={status:'PREPARING',authority:'BOUNDED_PROJECT_OPEN_FRAMING_MEASUREMENT_NO_PRODUCT_REPAIR',children:inputs.map(input=>({caseId:input.caseId,status:'NOT_RUN',output:join(output,input.caseId)})),firstFailure:null};
const persistIndex=()=>writeFile(join(output,'category-index.json'),JSON.stringify(index,null,2));await persistIndex();
const evidence=new Set(['apps/cad-studio/test/project-open-framing-browser.mjs','apps/cad-studio/test/flow-helper.mjs',...builderFiles,...retainedFiles]),prepared=new Map(),sourcePins=new Set();let frozen=null;
async function jsonEvidence(file){evidence.add(file);const bytes=await readFile(file);return {value:JSON.parse(bytes),sha256:sha256(bytes)};}

// Installed before application code on each owned document. Only the source-identified
// 300 ms project timer is logged; other timers pass through untouched. No fit is invoked here.
function observeProjectFitTimer(){
  const original=window.setTimeout,ownDescriptor=Object.getOwnPropertyDescriptor(window,'setTimeout');
  const state={installedAt:performance.now(),events:[],errors:[]};let next=1;
  const read=()=>{try{return {time:performance.now(),documentJSON:JSON.stringify(window.__studioDoc??null),eye:window.__studioEye?.()??null,rootFresh:window.__studioFresh??null,workerFresh:window.__studioBodies?.()?.fresh??null};}catch(error){return {time:performance.now(),observationError:String(error?.message??error)};}};
  const forwarding=function(...scheduledArgs){
    const [callback,delay]=scheduledArgs;
    const stack=typeof callback==='function'&&delay===300?new Error('D545 passive timer origin').stack??'':'';
    if(typeof callback!=='function'||delay!==300||!stack.includes('scheduleProjectOpenFit')||!stack.includes('/projectOpenFit.ts'))return Reflect.apply(original,this,scheduledArgs);
    const event={id:next++,delay,stack,scheduled:read(),fired:null,finished:null,timerHandle:null};state.events.push(event);
    const wrapped=function(...callbackArgs){
      event.fired=read();try{return Reflect.apply(callback,this,callbackArgs);}finally{event.finished=read();}
    };
    const forwarded=scheduledArgs.slice();forwarded[0]=wrapped;const handle=Reflect.apply(original,this,forwarded);event.timerHandle=handle;return handle;
  };
  window.setTimeout=forwarding;window.__d545ProjectFitTimer={state,original,ownDescriptor,forwarding};
}

async function prepare(){
  const pinsFile='/tmp/barocss-d544-preflight01/source-pins.json',pinEvidence=await jsonEvidence(pinsFile),wrapper=await jsonEvidence('/tmp/barocss-d544-preflight01/wrapper-receipt.json'),pins=pinEvidence.value;
  assert.equal(Object.keys(pins).length,479);assert.equal(wrapper.value.sourcePinCount,479);assert.equal(wrapper.value.childExit,0);assert.deepEqual(wrapper.value.changed,[]);
  for(const[file,digest]of Object.entries(pins)){sourcePins.add(file);assert.equal(sha256(await readFile(resolve(repo,file))),digest,`Unchanged current D544 native/observer source: ${file}`);}
  const controls=await jsonEvidence('/tmp/barocss-d544-control01/receipt.json');assert.equal(controls.value.status,'PASS_CURRENT_D544_DECLARED_ADMISSIONS_ONLY');
  index.nativeReuse={pinsFile,pinsSHA256:pinEvidence.sha256,count:479,receipt:'/tmp/barocss-d544-control01/receipt.json',receiptSHA256:controls.sha256,authority:'Exact current D544 C packets only; no independent native reevaluation'};
  for(const input of inputs){
    const config=cases[input.caseId],bytes=await readFile(input.file);evidence.add(input.file);assert.equal(bytes.length,input.bytes);assert.equal(sha256(bytes),input.sha256);assert.deepEqual(JSON.parse(bytes),config.states.C.doc);
    const dir=join('/tmp/barocss-d544-control01',input.caseId),packetFile=join(dir,'C-native-before-assert.json'),packet=await jsonEvidence(packetFile),receipt=await jsonEvidence(join(dir,'receipt.json')),read=packet.value;
    const row=receipt.value.rows.find(row=>row.label==='C');assert.equal(receipt.value.status,'PASS_ONE_CONTROLLED_D544_CASE_ONLY');assert.equal(row.status,'PASS_ONE_CURRENT_D544_NATIVE_CLASS_ONLY');assert.equal(row.packetSHA256,packet.sha256);
    assert.equal(read.ok,true);assert.equal(read.inputUnchanged,true);assert.equal(read.documentJSON,JSON.stringify(JSON.parse(bytes)));assert.equal(read.documentSHA256,sha256(read.documentJSON));assert.equal(read.request.caseId,input.caseId);assert.deepEqual(read.request.parameters,config.states.C.parameters);
    const sampleRecords=[];
    for(const raw of read.outputs){
      assert.equal(sha256(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);
      for(const vertex of raw.brep.vertices)sampleRecords.push({kind:'original-native-vertex',outputId:raw.outputId,nativeId:vertex.id,point:vertex.point});
      for(const edge of raw.edgeProbes)for(const [station,point]of edge.probe.samples.entries())sampleRecords.push({kind:'original-native-edge-probe',outputId:raw.outputId,nativeId:edge.id,name:edge.name,station,point});
    }
    assert.ok(sampleRecords.length);assert.ok(sampleRecords.every(sample=>sample.point.length===3&&sample.point.every(Number.isFinite)));
    prepared.set(input.caseId,{input,config,bytes,doc:JSON.parse(bytes),read,sampleRecords,packet:{file:packetFile,sha256:packet.sha256,documentSHA256:read.documentSHA256,nativeBRepSHA256:read.outputs.map(raw=>raw.nativeBRepSHA256)}});
    await jsonEvidence(join('/tmp/barocss-d544-studio01',input.caseId,'receipt.json'));
  }
  const studio=(await readdir(join(app,'src'),{recursive:true})).filter(file=>/\.(ts|tsx|css)$/.test(file)).map(file=>join(app,'src',file));for(const file of [...sourcePins,...studio,'apps/cad-studio/vite.config.ts'])evidence.add(file);
  frozen=await capsule(repo,output,'category-frozen',[...evidence]);index.sourceFreeze={count:Object.keys(frozen).length,expandedInspectorSHA256:sha256(inspectorSource),expandedPythonSHA256:sha256(oracleSource),timerInstrumentationSHA256:sha256(observeProjectFitTimer.toString())};
  await writeFile(join(output,'timer-instrumentation.js'),observeProjectFitTimer.toString());await writeFile(join(output,'expanded-inspector.ts'),inspectorSource);await writeFile(join(output,'expanded-oracle.py'),oracleSource);index.status='RUNNING';await persistIndex();
}

async function runCase(caseId){
  const own=prepared.get(caseId),child=index.children.find(child=>child.caseId===caseId),projectName=`D545-${caseId}-${randomUUID()}`,partName=`D545-${caseId}`;let projectCreated=false,openTiming=null;
  child.status='RUNNING';child.projectName=projectName;await persistIndex();
  const f=await createFlow({name:'project-open-framing',envFrozen:'D545_SOURCE_FROZEN',output:child.output,inspectorSource,oracleSource,
    qualification:`D545 ${caseId}: real scheduled project-Open fit timing, bounded physical-sample projection/DOM occlusion and public Frame-all comparison`,
    initialFiles:[...evidence],extraFrozen:[...sourcePins],requiredFrozen:[...builderFiles,...retainedFiles,...sourcePins,'apps/cad-studio/src/app/projectOpenFit.ts','apps/cad-studio/src/viewport/camera.ts'].map(file=>relative(repo,resolve(repo,file))),
    limits:['Desktop1440x900/WebGPU only; measurement before any repair or layout change.','Original physical vertices/edge probes are finite projected witnesses, not all-view or whole-object geometry/visibility proof.',
      'Full canvas containment and actual DOM control occlusion are separate results. A completed measurement does not imply a successful fit.',
      'Passive real300ms project timer preserves callback/this/args/return/delay. Missing identification is NOT_MEASURED, never an assumed wait or latency benchmark.',
      'Four declared fresh Worker/new-Python bindings use the exact eligible D544 C packet without native reevaluation; public Frame all is observation-only.',
      'Original full BRep/same-raw legacy/optional-UV boundaries remain unchanged. No mobile/download/release/cold-process persistence.'],
    snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,observedAt:performance.now(),cameraEye:window.__studioEye?.()??null,
      projectFitTimers:window.__d545ProjectFitTimer?.state??null,historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
  });
  f.report.caseId=caseId;f.report.input=own.input;f.report.nativeReuse=own.packet;f.report.projections=[];f.report.instrumentation={sourceSHA256:sha256(observeProjectFitTimer.toString()),policy:'SOURCE_IDENTIFIED_REAL_PROJECT_TIMER_ONLY; ORIGINAL_FORWARDING; NO_FORCE_FIT_CALLBACK_OR_STATE'};
  const basePersist=f.persist;f.persist=async()=>{await basePersist();child.phase=f.phase;child.bindings=f.report.reads.length;child.snapshots=f.report.states.length;await persistIndex();};
  const labels=new Set();
  const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(child.output,`${label}-actual.bcad`),state.documentJSON);return state;};
  async function qualify(label){
    f.phase=label;await f.same(own.doc);await f.ready();const state=await capture(label),parameters=own.config.states.C.parameters;
    assert.equal(sha256(state.documentJSON),own.read.documentSHA256,'No native reevaluation or unexpected source substitution in framing measurement');
    f.report.reads.push({label,read:own.read,exactWholeDocSha256:sha256(state.documentJSON),reusedFrom:'EXACT_CURRENT_D544_C',packet:own.packet});
    const input={caseId,doc:state.doc,documentJSON:state.documentJSON,expectedDoc:own.doc,read:own.read,parameters,consumer:state};await writeFile(join(child.output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
    const run=spawnSync('python3',['-I',join(child.output,'project-open-framing-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});await writeFile(join(child.output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(child.output,`${label}-oracle.stderr.txt`),run.stderr??'');let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve original output. */}
    f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr});await f.persist();assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,oracleStatus);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);return state;
  }
  async function projection(label){
    const observed=await f.page.evaluate(samples=>{
      const rect=node=>{const r=node.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const describe=node=>node?{tag:node.tagName,className:node.getAttribute('class'),role:node.getAttribute('role'),ariaLabel:node.getAttribute('aria-label'),title:node.getAttribute('title'),rect:rect(node),owner:(()=>{const owner=node.closest('button,[aria-label],aside,.rail,.outliner,.topbar,.history,.palette,.props,.views');return owner?{tag:owner.tagName,className:owner.getAttribute('class'),ariaLabel:owner.getAttribute('aria-label'),title:owner.getAttribute('title'),text:owner.tagName==='BUTTON'?(owner.textContent??'').trim().slice(0,120):null}:null;})()}:null;
      const canvas=document.querySelector('.vp-canvas');if(!canvas)throw Error('Current canvas missing');const full=rect(canvas),finite=[];
      for(const sample of samples){const pixel=window.__studioScreenOf?.(sample.point)??null,valid=pixel?.length===2&&pixel.every(Number.isFinite),inside=!!valid&&pixel[0]>=full.left&&pixel[0]<=full.right&&pixel[1]>=full.top&&pixel[1]<=full.bottom;
        const hit=inside?document.elementFromPoint(pixel[0],pixel[1]):null,clear=!!hit?.closest('.vp-canvas');finite.push({...sample,pixel,finite:!!valid,inCanvas:inside,unoccluded:inside&&clear,occluder:inside&&!clear?describe(hit):null});}
      const selectors='.rail,.tool-rail,.model-tools,.outliner,.topbar,.history,.palette,.props,.views,.corner-right,.corner-left,.chat-strip';
      const occluderRects=[...document.querySelectorAll(selectors)].filter(node=>{const r=rect(node),s=getComputedStyle(node);return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0&&r.right>full.left&&r.left<full.right&&r.bottom>full.top&&r.top<full.bottom;}).map(describe);
      return {measuredAt:performance.now(),documentJSON:JSON.stringify(window.__studioDoc),rootFresh:window.__studioFresh,cameraEye:window.__studioEye?.()??null,dirty:!!document.querySelector('[aria-label="Unsaved changes"]'),
        fullCanvas:full,unobscuredWorkArea:{representation:'CANVAS_MINUS_VISIBLE_CONTROL_RECTANGLES; SAMPLE_ELEMENT_FROM_POINT_IS_OCCLUSION_AUTHORITY',canvas:full,occluderRects},
        samples:finite,counts:{total:finite.length,nonfinite:finite.filter(x=>!x.finite).length,outsideCanvas:finite.filter(x=>!x.inCanvas).length,insideCanvas:finite.filter(x=>x.inCanvas).length,occludedInsideCanvas:finite.filter(x=>x.inCanvas&&!x.unoccluded).length,unoccluded:finite.filter(x=>x.unoccluded).length},
        timerEvents:window.__d545ProjectFitTimer?.state.events??[]};
    },own.sampleRecords);
    observed.label=label;observed.documentSHA256=sha256(observed.documentJSON);observed.sampleSource={packet:own.packet,samplesSHA256:sha256(JSON.stringify(own.sampleRecords)),authority:'Original native vertices and actual original edge-probe stations only; no display/expected/carrier box substitution'};
    await writeFile(join(child.output,`${label}-projection.json`),JSON.stringify(observed,null,2));f.report.projections.push(observed);await f.persist();assert.deepEqual(JSON.parse(observed.documentJSON),own.doc);return observed;
  }
  async function newObservedPage(){
    f.context=await f.browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});await f.context.addInitScript(observeProjectFitTimer);const page=f.page=await f.context.newPage();
    page.on('pageerror',error=>f.report.errors.push(error.stack??String(error)));page.on('console',message=>{if(message.type()==='error')f.report.consoleErrors.push(message.text());});page.on('download',download=>f.report.downloads.push({phase:f.phase,suggestedFilename:download.suggestedFilename()}));page.on('dialog',dialog=>dialog.accept());
    await page.goto(f.server.resolvedUrls.local[0]);await page.waitForSelector('.viewport[data-renderer="webgpu"]',{timeout:30000});await f.ready();
  }
  async function versions(){await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;}
  async function saveProject(){
    let card=await versions();const absent=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory();try{await(await root.getDirectoryHandle('projects')).getDirectoryHandle(name);return false;}catch(error){if(error.name==='NotFoundError')return true;throw error;}},projectName);assert.equal(absent,true);
    await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
    await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();const saved=await f.page.evaluate(async({projectName,partName})=>{const root=await navigator.storage.getDirectory(),dir=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName),file=await(await dir.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};},{projectName,partName});
    await writeFile(join(child.output,'02-own-project-saved-C.bcad'),saved.text);assert.equal(saved.text,own.bytes.toString(),'Same exact accepted C saved bytes');f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};await qualify('02-own-Save-C');return card;
  }
  async function openAndMeasure(card){
    const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
    card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();
    const before=await page.evaluate(expected=>({at:performance.now(),alreadyExact:JSON.stringify(window.__studioDoc)===expected,rootFresh:window.__studioFresh,timerIds:window.__d545ProjectFitTimer?.state.events.map(event=>event.id)??[]}),JSON.stringify(own.doc));
    const openButton=card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true});
    await openButton.evaluate(button=>{const probe={clickAt:null,beforeDocRef:null,beforeDocJSON:null};window.__d545OpenObservation=probe;button.addEventListener('click',()=>{probe.clickAt=performance.now();probe.beforeDocRef=window.__studioDoc;probe.beforeDocJSON=JSON.stringify(window.__studioDoc);},{once:true,capture:true,passive:true});});
    openTiming={beforeClick:before,observationMethod:'Passive public click timestamp; first polled exact new Doc identity and current Worker freshness, not a latency benchmark'};await openButton.click();
    const clicked=await page.evaluate(()=>({clickAt:window.__d545OpenObservation?.clickAt,returnedAt:performance.now()}));assert.equal(typeof clicked.clickAt,'number');openTiming.publicClickAt=clicked.clickAt;openTiming.clickReturnedAt=clicked.returnedAt;
    const exact=await page.waitForFunction(expected=>{const probe=window.__d545OpenObservation;return probe&&typeof probe.clickAt==='number'&&window.__studioDoc!==probe.beforeDocRef&&JSON.stringify(window.__studioDoc)===expected?{at:performance.now(),newDocIdentity:true}:false;},JSON.stringify(own.doc));openTiming.firstExactDocObservedAt=(await exact.jsonValue()).at;
    const fresh=await page.waitForFunction(()=>{const worker=window.__studioBodies?.();return window.__studioFresh===true&&worker?.fresh&&worker.massReady?{at:performance.now()}:false;});openTiming.firstFreshWorkerObservedAt=(await fresh.jsonValue()).at;
    await f.same(own.doc);await f.ready();
    const immediate=await projection('03-immediate-project-Open-C');const immediateState=await qualify('03-fresh-project-Open-C');
    try{await page.waitForFunction(({after,doc})=>window.__d545ProjectFitTimer?.state.events.some(event=>event.scheduled.time>=after&&event.finished&&event.finished.documentJSON===doc&&performance.now()>=event.finished.time+500),{after:openTiming.publicClickAt,doc:JSON.stringify(own.doc)},{timeout:15000});}
    catch(error){f.report.fitTiming={status:'NOT_MEASURED',reason:'No source-identified current project callback completion plus500ms observed',openTiming,timers:await page.evaluate(()=>window.__d545ProjectFitTimer?.state??null)};await capture('04-project-fit-NOT_MEASURED');await f.persist();throw error;}
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const timers=await page.evaluate(after=>window.__d545ProjectFitTimer.state.events.filter(event=>event.scheduled.time>=after),openTiming.publicClickAt);assert.equal(timers.length,1,'Exactly one real projectOpenFit timer for this public Open');const timer=timers[0];
    openTiming.realProjectTimer=timer;openTiming.freshWorkerElapsedFromClickMS=openTiming.firstFreshWorkerObservedAt-openTiming.publicClickAt;openTiming.callbackFinishedElapsedFromClickMS=timer.finished.time-openTiming.publicClickAt;
    const settled=await projection('04-settled-project-Open-C'),settledState=await qualify('04-settled-project-Open-C');assert.ok(settled.measuredAt>=timer.finished.time+500);
    assert.deepEqual(settledState.doc,immediateState.doc);assert.deepEqual(settledState.worker.bodies,immediateState.worker.bodies);assert.deepEqual(settledState.historyRows,immediateState.historyRows);assert.equal(settledState.dirty,immediateState.dirty);
    f.report.fitTiming={status:'MEASURED_SOURCE_IDENTIFIED_CALLBACK',openTiming,settledAfterCallbackMS:settled.measuredAt-timer.finished.time,authority:'Actual timer callback forwards normally; ownership guard remains intact; camera before/after is observed, no forced fit'};
    f.phase='05-actual-public-Frame-all-comparison-only';await page.getByTitle('Frame all (F)',{exact:true}).click();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const manual=await projection('05-public-Frame-all-comparison'),manualState=await capture('05-public-Frame-all-observation-only');
    assert.deepEqual(manualState.doc,settledState.doc);assert.deepEqual(manualState.worker.bodies,settledState.worker.bodies);assert.deepEqual(manualState.historyRows,settledState.historyRows);assert.equal(manualState.dirty,settledState.dirty);
    f.report.framingMeasurement={status:'MEASURED_FINITE_SAMPLES',immediate:immediate.counts,settled:settled.counts,publicFrameAll:manual.counts,wholeObjectAllViews:'NOT_CLAIMED',productRepair:'NONE'};
    child.framingMeasurement=f.report.framingMeasurement;await f.persist();
  }
  await f.run(async()=>{
    await newObservedPage();
    try{
      await f.page.setInputFiles('input[aria-label="Model file"]',own.input.file);await f.same(own.doc);await f.ready();await projection('01-initial-file-Open-C');await qualify('01-initial-C');
      const card=await saveProject();await openAndMeasure(card);assert.equal(f.report.reads.length,4);assert.deepEqual(f.report.downloads,[]);f.report.nativeCaptures=0;f.report.currentWorkerBindings=4;f.report.exactWholeDocNativeReuses=4;
    }catch(error){f.report.status='FAIL';f.report.failure=error.stack??String(error);index.status='FAIL';index.firstFailure??={caseId,phase:f.phase,error:f.report.failure};await f.persist();throw error;}
    finally{
      let restoreFailure=null;try{if(f.page&&!f.page.isClosed()){
        const restored=await f.page.evaluate(()=>{const journal=window.__d545ProjectFitTimer;if(!journal)return {status:'NOT_INSTALLED'};const owned=window.setTimeout===journal.forwarding;if(owned){if(journal.ownDescriptor)Object.defineProperty(window,'setTimeout',journal.ownDescriptor);else delete window.setTimeout;}const result={status:owned&&window.setTimeout===journal.original?'RESTORED':'NOT_OWNED_OR_NOT_RESTORED',events:journal.state.events};delete window.__d545ProjectFitTimer;delete window.__d545OpenObservation;return result;});f.report.cleanup.push({projectTimerObserver:restored});assert.equal(restored.status,'RESTORED','Owned passive timer wrapper is restored');
      }}catch(error){restoreFailure=error;f.report.cleanup.push({timerRestoreError:error.stack??String(error)});index.firstFailure??={caseId,phase:'owned timer observer restoration',error:error.stack??String(error)};await f.persist();}
      if(projectCreated){const cleanup={ownedProject:projectName};try{const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();cleanup.namespace=await f.page.evaluate(async name=>{const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}},projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');}finally{f.report.cleanup.push(cleanup);await f.persist();}}
      if(restoreFailure)throw restoreFailure;
    }
  });
  child.status=f.report.status;child.receipt={file:join(child.output,'receipt.json'),sha256:sha256(await readFile(join(child.output,'receipt.json')))};await persistIndex();const after=await capsule(repo,output,`category-after-${caseId}`,[...evidence]);assert.deepEqual(after,frozen);assert.equal(f.report.status,'PASS',f.report.failure);return f.report.reads.length;
}
try{await prepare();let bindings=0;for(const input of inputs)try{bindings+=await runCase(input.caseId);}catch(error){const child=index.children.find(child=>child.caseId===input.caseId);child.status='FAIL';index.firstFailure??={caseId:input.caseId,error:error.stack??String(error)};throw error;}index.currentWorkerBindings=bindings;assert.equal(bindings,8);index.status='PASS';}
catch(error){index.status='FAIL';index.firstFailure??={phase:'preparation/child completion',error:error.stack??String(error)};process.exitCode=1;await persistIndex();}
finally{if(frozen)try{const after=await capsule(repo,output,'category-after-all-cleanup',[...evidence]);assert.deepEqual(after,frozen);}catch(error){index.status='FAIL';index.sourceFailure=error.stack??String(error);process.exitCode=1;}await persistIndex();const sealed=JSON.stringify(index,null,2);await writeFile(join(output,'category-index.sealed.json'),sealed);await writeFile(join(output,'category-seal.json'),JSON.stringify({indexFile:'category-index.sealed.json',indexSHA256:sha256(sealed),children:index.children.map(({caseId,status,receipt})=>({caseId,status,receipt})),timerInstrumentationSHA256:sha256(observeProjectFitTimer.toString())},null,2));}
