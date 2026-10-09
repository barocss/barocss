import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const native={maximumParameterResolutions:8,maximumFeatureEvaluations:7};
const mesh={maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024};
const meshIds=['editor_mesh','view_leaf_1','view_leaf_2','view_leaf_3'];
export async function runReferencedFeatureFlow({page,browser,cad,editor,result,evidence,prefix,repo}) {
  const fixture=resolve(repo,'apps/cad-editor/fixtures/shared-extrusions.authored-graph.json');
  const original=cad.parseBooleanExtrusionFeatureGraph(readFileSync(fixture,'utf8'),native);
  const leaves=graph=>graph.document.features.filter(f=>f.kind==='normal-extrusion');
  const byKind=(graph,kind)=>graph.document.features.find(f=>f.kind===kind);
  const originalBool=byKind(original,'coplanar-boolean');
  const originalA=original.document.features.find(f=>f.id===originalBool.operandAFeatureId);
  const opts={native,display:{featureId:'extrusion_feature',outputSlotId:'extrusion_slot'},mesh:{...mesh,meshId:meshIds[0]}};
  const outputs=graph=>leaves(graph).map((leaf,i)=>({selection:{graphId:graph.document.id,revision:graph.document.revision,featureId:leaf.id,outputSlotId:leaf.outputSlotId},mesh:{...mesh,meshId:meshIds[i]}}));
  const request=(graph,featureOperations)=>({expectedRevision:graph.document.revision,revision:graph.document.revision+1,featureOperations});
  const upsert=feature=>({kind:'upsert',feature}),remove=featureId=>({kind:'remove',featureId});
  const replacementA={...structuredClone(originalA),id:'repair_face',outputSlotId:'repair_face_slot'};
  const repairedBool={...structuredClone(originalBool),operandAFeatureId:replacementA.id};
  const faceOps=[upsert(replacementA),upsert(repairedBool),remove(originalA.id)];
  const boolOps=(graph,repair=true)=>{
    const current=byKind(graph,'coplanar-boolean');
    const replacement={...structuredClone(current),id:'repair_boolean',outputSlotId:'repair_boolean_slot',
      options:{...current.options,operation:'intersection',evaluationId:'repair_boolean_eval',resultIdPrefix:'rb'}};
    return [upsert(replacement),...(repair?leaves(graph).map(f=>upsert({...structuredClone(f),regionFeatureId:replacement.id})):[]),remove(current.id)];
  };
  function observe(accepted,area,distances,baseHeight=2) {
    cad.validateBooleanExtrusionFeatureGraph(accepted);assert.deepEqual(accepted.options,original.options);
    const evaluated=cad.evaluateBooleanExtrusionFeatureGraph(accepted.document,native);
    assert.equal(evaluated.report.summary.materialAreaUV,area);
    const expectedParameters=structuredClone(original.document.parameters);
    expectedParameters.find(p=>p.id==='base_height').definition.valueMM=baseHeight;
    assert.deepEqual(evaluated.document.parameters,expectedParameters);
    assert.equal(Object.is(evaluated.document.parameters.find(p=>p.id==='unused').definition.valueMM,-0),true);
    const combination=byKind(evaluated,'coplanar-boolean');
    for(const face of evaluated.document.features.filter(f=>f.kind==='face-input')) {
      const starting=face.id==='face_b_feature'?original.document.features.find(f=>f.id===face.id):originalA;
      const {id,outputSlotId,...source}=face,{id:oldId,outputSlotId:oldSlot,...oldSource}=starting;
      assert.deepEqual(source,oldSource);assert.equal(Object.is(face.loop.edges[0].knots[0],-0),true);
    }
    assert.deepEqual(leaves(evaluated).map(f=>f.id),leaves(original).map(f=>f.id));
    for(const leaf of leaves(evaluated)) {
      const starting=leaves(original).find(f=>f.id===leaf.id);
      assert.equal(leaf.regionFeatureId,combination.id);assert.equal(leaf.outputSlotId,starting.outputSlotId);
      assert.deepEqual(leaf.options,starting.options);assert.deepEqual(leaf.distance,starting.distance);
    }
    const extrusions=leaves(evaluated).map(f=>evaluated.features.find(e=>e.featureId===f.id).evaluation);
    assert.deepEqual(extrusions.map(e=>e.options.distanceMM),distances);
    for(const e of extrusions) {
      const vector=[-e.options.distanceMM/Math.sqrt(2),0,e.options.distanceMM/Math.sqrt(2)];
      assert.ok(e.translationMM.every((v,i)=>Math.abs(v-vector[i])<1e-8));
      for(const top of e.vertices.filter(v=>v.layer==='top')) {
        const bottom=e.vertices.find(v=>v.layer==='bottom'&&v.nativeVertexId===top.nativeVertexId);assert.ok(bottom);
        top.pointMM.forEach((v,i)=>assert.ok(Math.abs(v-bottom.pointMM[i]-vector[i])<1e-8));
      }
    }
    return {revision:evaluated.document.revision,areaUV:area,featureIds:evaluated.document.features.map(f=>f.id),distancesMM:distances,
      vectors:extrusions.map(e=>e.translationMM),dependencies:evaluated.report.featureDependencies,nativeBuilderCalls:evaluated.report.nativeBuilderCalls};
  }
  const pure=editor.createCadEditorFeatureSession(original.document,opts);
  pure.acceptCandidate(pure.prepareDisplayOutputs(outputs(original)).token);pure.selectFeature(originalA.id);
  let before=pure.getSnapshot();
  const invalids=[
    [request(before.accepted,[upsert(replacementA),remove(originalA.id)]),'DEPENDENCY'],
    [request(before.accepted,[upsert({...originalA,options:{...originalA.options,evaluationId:'changed'}})]),'IDENTITY'],
    [request(before.accepted,[remove(originalA.id),upsert(originalA)]),'INPUT'],
    [request(before.accepted,[upsert({...replacementA,id:'original_plane'})]),'IDENTITY'],
    [{...request(before.accepted,faceOps),expectedRevision:99},'REVISION'],
    [request(before.accepted,Array.from({length:9},(_,i)=>upsert({...replacementA,id:'over_'+i,outputSlotId:'over_slot_'+i}))),'BUDGET'],
  ];
  for(const [invalid,code] of invalids) {
    before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(invalid),e=>e.code===(code==='REVISION'?'REVISION':'NATIVE')&&e.cause instanceof cad.BooleanExtrusionFeatureGraphError&&e.cause.code===code);
    assert.deepEqual(pure.getSnapshot(),before);
  }
  const leaf=leaves(original)[0];
  for(const ops of [[upsert(leaf)],[remove(leaf.id),upsert(repairedBool)],
    [upsert({...leaf,id:'new_leaf',outputSlotId:'new_leaf_slot'}),upsert(repairedBool)],
    [upsert({...leaf,distance:{kind:'literal',valueMM:3}}),upsert(repairedBool)],
    [upsert({...leaf,options:{...leaf.options,evaluationId:'changed'}}),upsert(repairedBool)],[]]) {
    before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(request(before.accepted,ops)));assert.deepEqual(pure.getSnapshot(),before);
  }
  const contact=structuredClone(original.document.features.find(f=>f.id==='face_b_feature'));
  for(const line of contact.loop.edges)for(const point of line.controlPoints)if(point[1]===-5){point[0]+=1;point[1]+=2;point[2]+=1;}
  before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(request(before.accepted,[upsert(contact)])),e=>JSON.stringify(e.cause).includes('CONTACT')||e.cause?.cause?.code==='CONTACT');assert.deepEqual(pure.getSnapshot(),before);
  let getterCalls=0;const accessor={};Object.defineProperty(accessor,'expectedRevision',{enumerable:true,get(){getterCalls++;return 0;}});const cyclic={};cyclic.self=cyclic;
  for(const invalid of [accessor,{[Symbol('private')]:1},cyclic]){before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(invalid));assert.deepEqual(pure.getSnapshot(),before);}assert.equal(getterCalls,0);
  const firstRequest=request(before.accepted,structuredClone(faceOps));const first=pure.prepareReferencedFeatureTransaction(firstRequest);assert.equal(first.kind,'structure');
  before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(firstRequest));assert.deepEqual(pure.getSnapshot(),before);pure.cancelCandidate(first.token);assert.throws(()=>pure.acceptCandidate(first.token),e=>e.code==='STALE');
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'3'});before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(firstRequest));assert.deepEqual(pure.getSnapshot(),before);pure.discardPending();
  const capture=pure.serializeAccepted(),base=pure.getSnapshot();const candidate=pure.prepareReferencedFeatureTransaction(firstRequest);
  firstRequest.featureOperations[0].feature.loop.edges[0].controlPoints[0][0]=99;candidate.result.document.features.length=0;
  pure.acceptCandidate(candidate.token);const faceAccepted=pure.getSnapshot();observe(faceAccepted.accepted,24,[2,3,4,5]);
  assert.deepEqual(byKind(faceAccepted.accepted,'coplanar-boolean'),repairedBool);
  assert.deepEqual(faceAccepted.accepted.document.features,original.document.features.filter(f=>f.id!==originalA.id).map(f=>f.id===originalBool.id?repairedBool:f).concat(replacementA));
  assert.equal(faceAccepted.selectedFeatureId,null);assert.equal(faceAccepted.displayGeneration,base.displayGeneration);assert.equal(faceAccepted.history.count,base.history.count+1);assert.throws(()=>pure.markDownloaded(capture.token),e=>e.code==='STALE');
  for(const [oldId,newId] of [[originalA.id,replacementA.id],[leaf.id,leaf.id]]) {
    const oldFeature=original.features.find(f=>f.featureId===oldId);
    const newFeature=faceAccepted.accepted.features.find(f=>f.featureId===newId);
    assert.deepEqual(newFeature.evaluation,oldFeature.evaluation);
  }
  before=pure.getSnapshot();assert.throws(()=>pure.prepareReferencedFeatureTransaction(request(before.accepted,boolOps(before.accepted,false))),e=>e.cause?.code==='DEPENDENCY');assert.deepEqual(pure.getSnapshot(),before);
  pure.selectFeature(originalBool.id);before=pure.getSnapshot();pure.acceptCandidate(pure.prepareReferencedFeatureTransaction(request(before.accepted,boolOps(before.accepted))).token);
  const repaired=pure.getSnapshot();observe(repaired.accepted,4,[2,3,4,5]);assert.equal(repaired.selectedFeatureId,null);assert.equal(repaired.displays.length,4);assert.equal(repaired.displayGeneration,base.displayGeneration);
  assert.deepEqual(byKind(repaired.accepted,'coplanar-boolean'),boolOps(faceAccepted.accepted)[0].feature);
  assert.deepEqual(repaired.accepted.document.parameters,original.document.parameters);
  pure.acceptCandidate(pure.prepareUndo().token);observe(pure.getSnapshot().accepted,24,[2,3,4,5]);assert.deepEqual(pure.getSnapshot().accepted.document.features,faceAccepted.accepted.document.features);
  pure.acceptCandidate(pure.prepareRedo().token);observe(pure.getSnapshot().accepted,4,[2,3,4,5]);assert.deepEqual(pure.getSnapshot().accepted.document.features,repaired.accepted.document.features);
  // A real changed-geometry mesh budget refusal, using the actual smaller intersection vertex count.
  const limit=repaired.displays[0].nativeMesh.report.vertexCount;
  const bounded=editor.createCadEditorFeatureSession(repaired.accepted.document,{...opts,mesh:{...opts.mesh,maximumVertices:limit}});
  const boundedBefore=bounded.getSnapshot(),combo=byKind(boundedBefore.accepted,'coplanar-boolean');
  assert.throws(()=>bounded.prepareReferencedFeatureTransaction(request(boundedBefore.accepted,[upsert({...combo,options:{...combo.options,operation:'union'}})])),e=>e.code==='NATIVE'&&e.cause instanceof cad.CoplanarFaceBooleanExtrusionMeshError&&e.cause.code==='BUDGET');assert.deepEqual(bounded.getSnapshot(),boundedBefore);bounded.dispose();pure.dispose();
  result.events.push({stage:'pure-native-referenced-feature-repairs',native:observe(repaired.accepted,4,[2,3,4,5]),privateRequestCandidate:true,getterCalls,actualDependencyIdentityRevisionBudgetContactMeshRefusals:true,extrusionOnlyRegionRepairScope:true,historyFourOutputsSelectionCapture:true});

  const snapshot=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.snapshot());
  const display=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.display());
  const wait=(p,old,n=1)=>p.waitForFunction(({g,n})=>{const s=window.__cadFeatureFlow.snapshot(),r=window.__cadFeatureFlow.display();return s.generation===g+n&&!s.candidate&&r?.status==='ready'&&r.graphRevision===s.accepted.document.revision&&r.displayGeneration===s.displayGeneration&&r.qualifiedOutputs.length===s.displays.length;},{g:old.generation,n});
  async function retained(old,frame) {
    await page.waitForFunction(()=>!window.__cadFeatureFlow.snapshot().candidate&&window.__cadFeatureFlow.error());
    await page.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,frame.readIndex);
    const now=await snapshot(),actual=await display();
    for(const k of ['accepted','history','pending','displays','generation','displayGeneration','selectedFeatureId'])assert.deepEqual(now[k],old[k]);
    assert.equal(actual.pixelHash,frame.pixelHash);assert.deepEqual(actual.camera,frame.camera);return actual;
  }
  let old=await snapshot();await page.getByLabel('Open native feature graph file').setInputFiles(fixture);await wait(page,old);
  old=await snapshot();await page.getByTestId('show-all-outputs').click();await wait(page,old,0);await page.waitForFunction(()=>window.__cadFeatureFlow.display().qualifiedOutputs.length===4);
  await page.getByTestId('replace-feature-'+originalA.id).click();old=await snapshot();let frame=await display();await page.getByTestId('replace-confirm').click();await retained(old,frame);assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'DEPENDENCY');
  await page.getByTestId('replace-repair-'+originalBool.id).focus();await page.keyboard.press('Space');assert.equal(await page.getByTestId('replace-repair-'+originalBool.id).isChecked(),true);
  const helpBefore=await snapshot();await page.getByTestId('replace-help').click();await page.getByTestId('replace-help-dialog').waitFor();await page.getByTestId('replace-help-close').click();await page.getByTestId('replace-help-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='replace-help');assert.deepEqual(await snapshot(),helpBefore);assert.equal(await page.getByTestId('replace-repair-'+originalBool.id).isChecked(),true);
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(true));await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.code==='DISPLAY');old=await snapshot();frame=await display();await page.getByTestId('replace-confirm').click();const gpu=await retained(old,frame);assert.equal(await page.getByTestId('replace-repair-'+originalBool.id).isChecked(),true);await page.screenshot({path:resolve(evidence,prefix+'-referenced-gpu-refusal.png')});
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(false));old=await snapshot();await page.getByTestId('replace-confirm').click();await wait(page,old);await page.getByTestId('replace-dialog').waitFor({state:'hidden'});
  const faceUI=await snapshot(),faceId=byKind(faceUI.accepted,'coplanar-boolean').operandAFeatureId;
  await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='replace-feature-'+id,faceId);observe(faceUI.accepted,24,[2,3,4,5]);assert.equal(faceUI.displayGeneration,old.displayGeneration);
  assert.match(faceId,/^rf\d+_face$/);assert.notEqual(faceId,originalA.id);
  const faceRow=faceUI.accepted.document.features.find(f=>f.id===faceId);assert.equal(faceRow.outputSlotId,faceId.replace(/_face$/,'_slot'));
  const repairedUIBool={...originalBool,operandAFeatureId:faceId};assert.deepEqual(byKind(faceUI.accepted,'coplanar-boolean'),repairedUIBool);
  assert.deepEqual(faceUI.accepted.document.features,original.document.features.filter(f=>f.id!==originalA.id).map(f=>f.id===originalBool.id?repairedUIBool:f).concat(faceRow));
  const faceFrame=await display();assert.equal(faceFrame.pixelHash,gpu.pixelHash);assert.deepEqual(faceFrame.camera,gpu.camera);
  await page.getByTestId('replace-feature-'+originalBool.id).click();const beforeMenu=await snapshot();
  await page.getByTestId('replace-operation').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.getByTestId('replace-operation').inputValue(),'intersection');
  await page.keyboard.press('Tab');assert.deepEqual(await snapshot(),beforeMenu);
  old=await snapshot();frame=await display();await page.getByTestId('replace-confirm').click();await retained(old,frame);assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'DEPENDENCY');
  const allLeaves=leaves(old.accepted);await page.getByTestId('replace-repair-'+allLeaves[0].id).check();old=await snapshot();frame=await display();await page.getByTestId('replace-confirm').click();await retained(old,frame);assert.equal((await page.evaluate(()=>window.__cadFeatureFlow.error())).cause.code,'DEPENDENCY');
  for(const f of allLeaves.slice(1))await page.getByTestId('replace-repair-'+f.id).check();
  assert.equal(await page.getByTestId('replace-operation').inputValue(),'intersection');await page.screenshot({path:resolve(evidence,prefix+'-referenced-four-repairs.png')});
  old=await snapshot();await page.getByTestId('replace-confirm').click();await wait(page,old);await page.getByTestId('replace-dialog').waitFor({state:'hidden'});
  const booleanUI=await snapshot(),boolId=byKind(booleanUI.accepted,'coplanar-boolean').id;await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='replace-feature-'+id,boolId);
  assert.match(boolId,/^rb\d+_combine$/);const nativePrefix=boolId.replace(/_combine$/,'');
  const expectedBoolean={...repairedUIBool,id:boolId,outputSlotId:nativePrefix+'_slot',options:{...originalBool.options,operation:'intersection',evaluationId:nativePrefix+'_eval',resultIdPrefix:nativePrefix}};
  assert.deepEqual(byKind(booleanUI.accepted,'coplanar-boolean'),expectedBoolean);
  assert.deepEqual(booleanUI.accepted.document.features,faceUI.accepted.document.features.filter(f=>f.id!==originalBool.id).map(f=>f.kind==='normal-extrusion'?{...f,regionFeatureId:boolId}:f).concat(expectedBoolean));
  observe(booleanUI.accepted,4,[2,3,4,5]);assert.equal(booleanUI.displays.length,4);assert.equal(booleanUI.displayGeneration,faceUI.displayGeneration);assert.deepEqual(booleanUI.accepted.document.parameters,original.document.parameters);
  const booleanFrame=await display();assert.ok(booleanFrame.nonBackgroundPixels>0);assert.notEqual(booleanFrame.pixelHash,faceFrame.pixelHash);assert.deepEqual(booleanFrame.camera,faceFrame.camera);
  await page.screenshot({path:resolve(evidence,prefix+'-referenced-repaired.png')});result.events.push({stage:'actual-face-boolean-replacement-explicit-repairs',native:observe(booleanUI.accepted,4,[2,3,4,5]),display:await display(),actualGpuRefusal:gpu,missingAndPartialRepairsRefused:true,helpFocusChoicesKeyboardSpaceMenuTab:true,acceptedFocusReplacementRow:true});
  old=await snapshot();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(page,old);observe((await snapshot()).accepted,24,[2,3,4,5]);assert.deepEqual((await snapshot()).accepted.document.features,faceUI.accepted.document.features);
  old=await snapshot();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(page,old);observe((await snapshot()).accepted,4,[2,3,4,5]);assert.deepEqual((await snapshot()).accepted.document.features,booleanUI.accepted.document.features);
  const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const download=await promise,path=resolve(evidence,prefix+'-referenced-'+download.suggestedFilename());await download.saveAs(path);
  const saved=cad.parseBooleanExtrusionFeatureGraph(readFileSync(path,'utf8'),native);assert.deepEqual(saved.document,(await snapshot()).accepted.document);observe(saved,4,[2,3,4,5]);
  const freshContext=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
  try {
    const fresh=await freshContext.newPage();fresh.on('pageerror',e=>result.pageErrors.push(e.message));await fresh.goto(page.url());await fresh.waitForFunction(()=>window.__cadFeatureFlow?.display()?.status==='ready');
    old=await snapshot(fresh);await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await wait(fresh,old);old=await snapshot(fresh);await fresh.getByTestId('show-all-outputs').click();await wait(fresh,old,0);
    await fresh.getByTestId('parameter-value-base_height').fill('3');old=await snapshot(fresh);await fresh.getByTestId('feature-apply').click();await wait(fresh,old);const reedited=await snapshot(fresh);observe(reedited.accepted,4,[3,4,5,6],3);assert.ok((await display(fresh)).nonBackgroundPixels>0);
    assert.deepEqual(byKind(reedited.accepted,'coplanar-boolean'),expectedBoolean);
    await fresh.screenshot({path:resolve(evidence,prefix+'-referenced-fresh-reedit.png')});result.events.push({stage:'genuine-referenced-download-fresh-reedit',path,native:observe(reedited.accepted,4,[3,4,5,6],3),display:await display(fresh)});
    await fresh.getByTestId('replace-feature-'+boolId).click();await fresh.getByTestId('replace-operation').selectOption('difference');await fresh.keyboard.press('Escape');await fresh.getByTestId('replace-dialog').waitFor({state:'hidden'});await fresh.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='replace-feature-'+id,boolId);assert.deepEqual((await snapshot(fresh)).accepted,reedited.accepted);
    await fresh.getByTestId('replace-feature-'+faceId).click();await fresh.getByRole('button',{name:'Cancel',exact:true}).click();await fresh.getByTestId('replace-dialog').waitFor({state:'hidden'});await fresh.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')==='replace-feature-'+id,faceId);assert.deepEqual((await snapshot(fresh)).accepted,reedited.accepted);
  } catch(error) {try{await freshContext.pages().at(-1)?.screenshot({path:resolve(evidence,prefix+'-referenced-failure.png')});}catch{}throw error;}
  finally {await freshContext.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=[...process.argv.slice(2),'--fanout','--referenced-lifecycle'];
  if(!args.includes('--evidence'))args.push('--evidence','/Users/user/.barocss-ai/v3/evidence-cad-editor-referenced-repair');
  const child=spawnSync(process.execPath,[resolve(import.meta.dirname,'feature-graph-flow.mjs'),...args],{stdio:'inherit'});
  if(child.error)throw child.error;process.exitCode=child.status??1;
}
