import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const native={maximumParameterResolutions:8,maximumFeatureEvaluations:7};
const mesh={maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024};
const meshIds=['editor_mesh','view_leaf_1','view_leaf_2','view_leaf_3'];
export async function runParameterLifecycleFlow({page,browser,cad,editor,result,evidence,prefix,repo}) {
  const fixture=resolve(repo,'apps/cad-editor/fixtures/shared-extrusions.authored-graph.json');
  const original=cad.parseBooleanExtrusionFeatureGraph(readFileSync(fixture,'utf8'),native);
  const leaves=graph=>graph.document.features.filter(f=>f.kind==='normal-extrusion');
  const opts={native,display:{featureId:'extrusion_feature',outputSlotId:'extrusion_slot'},mesh:{...mesh,meshId:meshIds[0]}};
  const outputs=graph=>leaves(graph).map((leaf,i)=>({selection:{graphId:graph.document.id,revision:graph.document.revision,featureId:leaf.id,outputSlotId:leaf.outputSlotId},mesh:{...mesh,meshId:meshIds[i]}}));
  const request=(graph,parameterOperations,distanceEdits=[])=>({expectedRevision:graph.document.revision,revision:graph.document.revision+1,parameterOperations,distanceEdits});
  const upsert=(id,definition)=>({kind:'upsert',parameter:{id,type:'length',definition}});
  const literal=valueMM=>({kind:'literal',valueMM});
  const offset=(parameterId,offsetMM)=>({kind:'offset',parameterId,offsetMM});
  function observe(accepted,distances) {
    cad.validateBooleanExtrusionFeatureGraph(accepted);
    assert.deepEqual(accepted.options,original.options);
    const actual=cad.evaluateBooleanExtrusionFeatureGraph(accepted.document,native);
    assert.deepEqual(actual.document.features.map(f=>f.id),original.document.features.map(f=>f.id));
    assert.equal(actual.report.summary.materialAreaUV,24);
    for(const feature of original.document.features) {
      const current=actual.document.features.find(f=>f.id===feature.id);
      if(feature.kind!=='normal-extrusion')assert.deepEqual(current,feature);
      else {const {distance,...rest}=feature,{distance:after,...currentRest}=current;void distance;void after;assert.deepEqual(currentRest,rest);}
    }
    const unused=actual.document.parameters.find(p=>p.id==='unused');
    assert.equal(Object.is(unused.definition.valueMM,-0),true);
    const extrusions=leaves(actual).map(f=>actual.features.find(e=>e.featureId===f.id).evaluation);
    assert.deepEqual(extrusions.map(e=>e.options.distanceMM),distances);
    for(const e of extrusions) {
      const expected=[-e.options.distanceMM/Math.sqrt(2),0,e.options.distanceMM/Math.sqrt(2)];
      assert.ok(e.translationMM.every((v,i)=>Math.abs(v-expected[i])<1e-8));
      for(const top of e.vertices.filter(v=>v.layer==='top')) {
        const bottom=e.vertices.find(v=>v.layer==='bottom'&&v.nativeVertexId===top.nativeVertexId);assert.ok(bottom);
        top.pointMM.forEach((v,i)=>assert.ok(Math.abs(v-bottom.pointMM[i]-expected[i])<1e-8));
      }
    }
    return {revision:actual.document.revision,parameterIds:actual.document.parameters.map(p=>p.id),distancesMM:distances,vectors:extrusions.map(e=>e.translationMM),nativeBuilderCalls:actual.report.nativeBuilderCalls};
  }
  const pure=editor.createCadEditorFeatureSession(original.document,opts);
  pure.acceptCandidate(pure.prepareDisplayOutputs(outputs(original)).token);pure.selectFeature('leaf_top');
  let before=pure.getSnapshot();const freshId='lifecycle_length';
  const add=request(before.accepted,[upsert(freshId,literal(3))]);
  const candidate=pure.prepareParameterTransaction(add);assert.equal(candidate.kind,'parameter');
  add.parameterOperations[0].parameter.definition.valueMM=99;candidate.result.document.parameters.length=0;
  pure.acceptCandidate(candidate.token);const added=pure.getSnapshot();
  assert.equal(added.accepted.document.parameters.at(-1).definition.valueMM,3);
  assert.equal(added.history.count,before.history.count+1);assert.equal(added.displayGeneration,before.displayGeneration);
  assert.equal(added.selectedFeatureId,'leaf_top');observe(added.accepted,[2,3,4,5]);
  const removeBase=graph=>request(graph,[{kind:'remove',parameterId:'base_height'},upsert('design_height',offset(freshId,0))]);
  const repairDistances=graph=>request(graph,[{kind:'remove',parameterId:'design_height'}],leaves(graph).map((f,i)=>({featureId:f.id,definition:offset(freshId,i)})));
  const invalids=[
    request(added.accepted,[{kind:'remove',parameterId:'base_height'}]),
    request(added.accepted,[{kind:'remove',parameterId:'design_height'}]),
    request(added.accepted,[upsert('base_height',offset('design_height',0))]),
    request(added.accepted,[upsert('base_height',literal(0))]),
    request(added.accepted,[{kind:'remove',parameterId:'unused'},upsert('unused',literal(1))]),
    request(added.accepted,[upsert('face_a_feature',literal(1))]),
    request(added.accepted,[{kind:'upsert',parameter:{id:freshId,type:'angle',definition:literal(1)}}]),
    {...request(added.accepted,[upsert(freshId,literal(4))]),expectedRevision:0},
    request(added.accepted,Array.from({length:5},(_,i)=>upsert('extra_length_'+i,literal(3)))),
    request(added.accepted,[]),
  ];
  const codes=['PARAMETER','PARAMETER','PARAMETER','PARAMETER','INPUT','IDENTITY','PARAMETER','REVISION','BUDGET','BUDGET'];
  for(const [i,invalid] of invalids.entries()) {
    before=pure.getSnapshot();
    assert.throws(()=>pure.prepareParameterTransaction(invalid),error=>error.code===(codes[i]==='REVISION'?'REVISION':'NATIVE')&&error.cause instanceof cad.BooleanExtrusionFeatureGraphError&&error.cause.code===codes[i]);
    assert.deepEqual(pure.getSnapshot(),before);
  }
  let getterCalls=0;const accessor={};Object.defineProperty(accessor,'expectedRevision',{enumerable:true,get(){getterCalls++;return 0;}});
  const cyclic={};cyclic.self=cyclic;
  for(const invalid of [accessor,{[Symbol('private')]:1},cyclic]){before=pure.getSnapshot();assert.throws(()=>pure.prepareParameterTransaction(invalid));assert.deepEqual(pure.getSnapshot(),before);}assert.equal(getterCalls,0);
  const edit=request(added.accepted,[upsert(freshId,literal(4))]);
  const active=pure.prepareParameterTransaction(edit);before=pure.getSnapshot();assert.throws(()=>pure.prepareParameterTransaction(edit));assert.deepEqual(pure.getSnapshot(),before);pure.cancelCandidate(active.token);
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'3'});before=pure.getSnapshot();assert.throws(()=>pure.prepareParameterTransaction(edit));assert.deepEqual(pure.getSnapshot(),before);pure.discardPending();assert.throws(()=>pure.acceptCandidate(active.token),e=>e.code==='STALE');
  const capture=pure.serializeAccepted();pure.acceptCandidate(pure.prepareParameterTransaction(removeBase(pure.getSnapshot().accepted)).token);
  observe(pure.getSnapshot().accepted,[3,4,5,6]);assert.throws(()=>pure.markDownloaded(capture.token),e=>e.code==='STALE');
  pure.acceptCandidate(pure.prepareParameterTransaction(repairDistances(pure.getSnapshot().accepted)).token);
  const repaired=pure.getSnapshot();observe(repaired.accepted,[3,4,5,6]);assert.deepEqual(repaired.accepted.document.parameters.map(p=>p.id),['unused',freshId]);
  assert.equal(repaired.displayGeneration,added.displayGeneration);assert.equal(repaired.displays.length,4);
  pure.acceptCandidate(pure.prepareUndo().token);assert.ok(pure.getSnapshot().accepted.document.parameters.some(p=>p.id==='design_height'));observe(pure.getSnapshot().accepted,[3,4,5,6]);
  pure.acceptCandidate(pure.prepareRedo().token);observe(pure.getSnapshot().accepted,[3,4,5,6]);pure.dispose();
  result.events.push({stage:'pure-native-parameter-lifecycle',native:observe(repaired.accepted,[3,4,5,6]),privateRequestAndCandidate:true,getterCalls,actualDependencyCycleIdentityRevisionBudgetRefusals:true,explicitLengthAndFourDistanceRepairs:true,selectedFeatureDisplayGenerationHistoryAndCapture:true});

  const snapshot=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.snapshot());
  const display=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.display());
  const wait=(p,old,n=1)=>p.waitForFunction(({g,n})=>{const s=window.__cadFeatureFlow.snapshot(),r=window.__cadFeatureFlow.display();return s.generation===g+n&&!s.candidate&&r?.status==='ready'&&r.graphRevision===s.accepted.document.revision&&r.displayGeneration===s.displayGeneration&&r.qualifiedOutputs.length===s.displays.length;},{g:old.generation,n});
  async function retained(p,old,frame) {
    await p.waitForFunction(()=>!window.__cadFeatureFlow.snapshot().candidate&&window.__cadFeatureFlow.error());
    await p.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,frame.readIndex);
    const now=await snapshot(p),actual=await display(p);
    for(const key of ['accepted','history','displays','pending','generation','displayGeneration','selectedFeatureId'])assert.deepEqual(now[key],old[key]);
    assert.equal(actual.pixelHash,frame.pixelHash);assert.deepEqual(actual.camera,frame.camera);return actual;
  }
  let old=await snapshot();await page.getByLabel('Open native feature graph file').setInputFiles(fixture);await wait(page,old);
  old=await snapshot();await page.getByTestId('show-all-outputs').click();await wait(page,old,0);await page.waitForFunction(()=>window.__cadFeatureFlow.display().qualifiedOutputs.length===4);
  await page.getByTestId('add-length').click();await page.getByTestId('length-value').fill('3');old=await snapshot();await page.getByTestId('length-confirm').click();await wait(page,old);await page.getByRole('dialog').waitFor({state:'hidden'});
  const newId=(await snapshot()).accepted.document.parameters.at(-1).id;observe((await snapshot()).accepted,[2,3,4,5]);
  await page.getByTestId('edit-length-'+newId).click();await page.getByTestId('length-value').fill('4');
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(true));await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.code==='DISPLAY');old=await snapshot();let frame=await display();await page.getByTestId('length-confirm').click();const gpuRefused=await retained(page,old,frame);assert.equal(await page.getByTestId('length-value').inputValue(),'4');
  const helpBefore=await snapshot(),helpFrame=await display();await page.getByTestId('length-help').click();await page.getByTestId('length-help-dialog').waitFor();await page.getByTestId('length-help-close').click();await page.getByTestId('length-help-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='length-help');assert.equal(await page.getByTestId('length-value').inputValue(),'4');assert.deepEqual(await snapshot(),helpBefore);assert.equal((await display()).pixelHash,helpFrame.pixelHash);
  await page.getByTestId('length-value').focus();await page.keyboard.press('Tab');assert.notEqual(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'length-value');
  await page.getByTestId('length-value').fill('');await page.getByTestId('length-value').focus();
  await page.evaluate(()=>{window.__lengthImeEvents=[];for(const type of ['compositionstart','compositionend','keydown'])document.addEventListener(type,event=>{if(event.target?.getAttribute?.('data-testid')==='length-value')window.__lengthImeEvents.push({type,key:event.key??null,isComposing:event.isComposing??null});},true);});
  const cdp=await page.context().newCDPSession(page);await cdp.send('Input.imeSetComposition',{text:'４',selectionStart:1,selectionEnd:1});await page.keyboard.press('Enter');assert.deepEqual(await snapshot(),helpBefore);await cdp.send('Input.insertText',{text:'4'});await cdp.detach();assert.equal(await page.getByTestId('length-value').inputValue(),'4');const ime=await page.evaluate(()=>window.__lengthImeEvents);assert.ok(ime.some(e=>e.type==='compositionstart'));assert.ok(ime.some(e=>e.type==='compositionend'));assert.ok(ime.some(e=>e.type==='keydown'&&e.key==='Enter'&&e.isComposing));
  await page.screenshot({path:resolve(evidence,prefix+'-parameter-gpu-refusal.png')});
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(false));await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='edit-length-'+id,newId);assert.deepEqual((await snapshot()).accepted,old.accepted);
  for(const value of [4,3]) {
    await page.getByTestId('edit-length-'+newId).click();await page.getByTestId('length-value').fill(String(value));old=await snapshot();
    await page.getByTestId('length-confirm').click();await wait(page,old);await page.getByRole('dialog').waitFor({state:'hidden'});
    const edited=await snapshot();assert.deepEqual(edited.accepted.document.parameters.find(p=>p.id===newId).definition,literal(value));
    assert.equal(edited.history.count,old.history.count+1);assert.equal(edited.displayGeneration,old.displayGeneration);observe(edited.accepted,[2,3,4,5]);
  }
  await page.getByTestId('remove-length-base_height').click();old=await snapshot();frame=await display();await page.getByTestId('length-confirm').click();await retained(page,old,frame);assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'PARAMETER');
  await page.getByTestId('repair-enable-design_height').check();await page.getByTestId('repair-definition-design_height').selectOption('offset');await page.getByTestId('repair-parameter-design_height').selectOption(newId);await page.getByTestId('repair-value-design_height').fill('0');
  old=await snapshot();await page.getByTestId('length-confirm').click();await wait(page,old);await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='add-length');const afterBase=await snapshot();observe(afterBase.accepted,[3,4,5,6]);assert.deepEqual(afterBase.accepted.document.parameters.find(p=>p.id==='design_height').definition,offset(newId,0));
  await page.getByTestId('remove-length-design_height').click();old=await snapshot();frame=await display();await page.getByTestId('length-confirm').click();await retained(page,old,frame);
  assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'PARAMETER');
  for(const [i,leaf] of leaves(old.accepted).entries()) {
    await page.getByTestId('repair-enable-'+leaf.id).check();await page.getByTestId('repair-definition-'+leaf.id).selectOption('offset');await page.getByTestId('repair-parameter-'+leaf.id).selectOption(newId);await page.getByTestId('repair-value-'+leaf.id).fill(String(i));
  }
  const layout=await page.getByTestId('length-dialog').evaluate(element=>{
    const dialog=element.getBoundingClientRect(),header=element.querySelector('[data-slot="dialog-header"]').getBoundingClientRect(),footer=element.querySelector('[data-slot="dialog-footer"]').getBoundingClientRect();
    return {top:dialog.top,bottom:dialog.bottom,headerTop:header.top,footerBottom:footer.bottom,height:innerHeight};
  });
  assert.ok(layout.headerTop>=layout.top&&layout.footerBottom<=layout.bottom&&layout.bottom<=layout.height);
  await page.screenshot({path:resolve(evidence,prefix+'-parameter-repair-dialog.png')});
  old=await snapshot();await page.getByTestId('length-confirm').click();await wait(page,old);await page.getByRole('dialog').waitFor({state:'hidden'});const repairedUI=await snapshot();observe(repairedUI.accepted,[3,4,5,6]);assert.deepEqual(repairedUI.accepted.document.parameters.map(p=>p.id),['unused',newId]);assert.equal(repairedUI.displays.length,4);assert.equal(repairedUI.displayGeneration,afterBase.displayGeneration);
  leaves(repairedUI.accepted).forEach((leaf,i)=>assert.deepEqual(leaf.distance,offset(newId,i)));
  await page.getByTestId('edit-length-'+newId).click();await page.getByTestId('length-value').fill('0');old=await snapshot();frame=await display();await page.getByTestId('length-confirm').click();await retained(page,old,frame);assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'PARAMETER');assert.equal(await page.getByTestId('length-value').inputValue(),'0');assert.match(await page.getByRole('alert').last().innerText(),/0\.0001 to 10000 mm/);await page.screenshot({path:resolve(evidence,prefix+'-parameter-native-height-refusal.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByTestId('length-dialog').waitFor({state:'hidden'});assert.deepEqual((await snapshot()).accepted,repairedUI.accepted);
  await page.screenshot({path:resolve(evidence,prefix+'-parameter-repaired.png')});result.events.push({stage:'actual-length-add-remove-explicit-repairs',native:observe(repairedUI.accepted,[3,4,5,6]),display:await display(),actualGpuRefusal:gpuRefused,modalRawAndCancelFocusRetained:true,missingParameterAndFourDistanceRepairRefusals:true,contextualHelpFocusRawRetained:true,browserCompositionEnterDoesNotCommit:true,actualNativeHeightRangeRefusal:true,fixedRepairHeaderActions:layout});
  old=await snapshot();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(page,old);assert.ok((await snapshot()).accepted.document.parameters.some(p=>p.id==='design_height'));observe((await snapshot()).accepted,[3,4,5,6]);old=await snapshot();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(page,old);observe((await snapshot()).accepted,[3,4,5,6]);
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const download=await promise,path=resolve(evidence,prefix+'-parameter-'+download.suggestedFilename());await download.saveAs(path);
  const saved=cad.parseBooleanExtrusionFeatureGraph(readFileSync(path,'utf8'),native);assert.deepEqual(saved.document,(await snapshot()).accepted.document);observe(saved,[3,4,5,6]);
  const freshContext=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
  try {
    const fresh=await freshContext.newPage();fresh.on('pageerror',e=>result.pageErrors.push(e.message));await fresh.goto(page.url());await fresh.waitForFunction(()=>window.__cadFeatureFlow?.display()?.status==='ready');
    old=await snapshot(fresh);await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await wait(fresh,old);old=await snapshot(fresh);await fresh.getByTestId('show-all-outputs').click();await wait(fresh,old,0);await fresh.waitForFunction(()=>window.__cadFeatureFlow.display().qualifiedOutputs.length===4);
    await fresh.getByTestId('parameter-value-'+newId).fill('4');old=await snapshot(fresh);await fresh.getByTestId('feature-apply').click();await wait(fresh,old);const reedited=await snapshot(fresh);observe(reedited.accepted,[4,5,6,7]);assert.ok((await display(fresh)).nonBackgroundPixels>0);
    await fresh.screenshot({path:resolve(evidence,prefix+'-parameter-fresh-reedit.png')});result.events.push({stage:'genuine-parameter-download-fresh-reedit',path,native:observe(reedited.accepted,[4,5,6,7]),display:await display(fresh)});
    await fresh.getByTestId('edit-length-'+newId).click();await fresh.getByTestId('length-value').fill('12');await fresh.keyboard.press('Escape');await fresh.getByRole('dialog').waitFor({state:'hidden'});await fresh.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='edit-length-'+id,newId);assert.deepEqual((await snapshot(fresh)).accepted,reedited.accepted);
  } catch(error) {try{await freshContext.pages().at(-1)?.screenshot({path:resolve(evidence,prefix+'-parameter-failure.png')});}catch{/* Keep the original failure if capture fails. */}throw error;}
  finally {await freshContext.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=[...process.argv.slice(2),'--fanout','--lifecycle','--parameter-lifecycle'];
  if(!args.includes('--evidence'))args.push('--evidence','/Users/user/.barocss-ai/v3/evidence-cad-editor-parameter-lifecycle');
  const child=spawnSync(process.execPath,[resolve(import.meta.dirname,'feature-graph-flow.mjs'),...args],{stdio:'inherit'});
  if(child.error)throw child.error;process.exitCode=child.status??1;
}
