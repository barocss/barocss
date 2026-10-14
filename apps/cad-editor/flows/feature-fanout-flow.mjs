import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const nativeOptions = {maximumParameterResolutions:8,maximumFeatureEvaluations:7};
const meshIds = ['editor_mesh','view_leaf_1','view_leaf_2','view_leaf_3'];
const mesh = {maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024};

/** Extend the same bounded native feature/file gate with actual plural outputs. */
export async function runFeatureFanoutFlow({page,browser,cad,editor,result,evidence,prefix,repo}) {
  const fixture=resolve(repo,'apps/cad-editor/fixtures/shared-extrusions.authored-graph.json');
  const text=readFileSync(fixture,'utf8');const full=cad.parseBooleanExtrusionFeatureGraph(text,nativeOptions);
  const leaves=full.document.features.filter(f=>f.kind==='normal-extrusion');assert.equal(leaves.length,4);assert.equal(full.document.features.length,7);
  const outputs=graph=>leaves.map((leaf,i)=>({selection:{graphId:graph.document.id,revision:graph.document.revision,featureId:leaf.id,outputSlotId:leaf.outputSlotId},mesh:{meshId:meshIds[i],...mesh}}));
  function observe(accepted,base,area) {
    const actual=cad.evaluateBooleanExtrusionFeatureGraph(accepted.document,nativeOptions);
    assert.equal(actual.report.summary.materialAreaUV,area);assert.deepEqual(actual.report.nativeBuilderCalls,{faceInput:2,coplanarBoolean:1,normalExtrusion:4});
    assert.equal(Object.is(actual.document.parameters.find(p=>p.id==='unused').definition.valueMM,-0),true);
    const vectors=leaves.map((leaf,i)=>{
      const native=actual.features.find(f=>f.featureId===leaf.id).evaluation,distance=base+i;
      assert.equal(native.options.distanceMM,distance);const expected=[-distance/Math.sqrt(2),0,distance/Math.sqrt(2)];
      assert.ok(native.translationMM.every((value,axis)=>Math.abs(value-expected[axis])<1e-8));
      for(const top of native.vertices.filter(v=>v.layer==='top')){const bottom=native.vertices.find(v=>v.layer==='bottom'&&v.nativeVertexId===top.nativeVertexId);assert.ok(bottom);top.pointMM.forEach((value,axis)=>assert.ok(Math.abs(value-bottom.pointMM[axis]-expected[axis])<1e-8));}
      return {featureId:leaf.id,outputSlotId:leaf.outputSlotId,distanceMM:distance,translationMM:native.translationMM,shellCount:native.shells.length};
    });
    for(const id of ['face_a_feature','face_b_feature'])assert.deepEqual(actual.document.features.find(f=>f.id===id),full.document.features.find(f=>f.id===id));
    return {graphId:actual.document.id,revision:actual.document.revision,materialAreaUV:area,vectors,nativeBuilderCalls:actual.report.nativeBuilderCalls};
  }
  observe(full,2,24);
  const pure=editor.createCadEditorFeatureSession(full.document,{native:nativeOptions,display:{featureId:leaves[0].id,outputSlotId:leaves[0].outputSlotId},mesh:{meshId:meshIds[0],...mesh}});
  pure.selectFeature(leaves[0].id);pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'3'});
  const saved=pure.serializeAccepted(),before=pure.getSnapshot(),descriptors=outputs(before.accepted);
  const candidate=pure.prepareDisplayOutputs([...descriptors].reverse());candidate.displays[0].selection.graphId='caller_mutated';candidate.displays[0].nativeMesh.report.meshId='caller_mutated';descriptors[0].selection.featureId='caller_mutated';
  pure.acceptCandidate(candidate.token);const displayed=pure.getSnapshot();assert.equal(displayed.generation,before.generation);assert.equal(displayed.displayGeneration,before.displayGeneration+1);assert.deepEqual(displayed.accepted,before.accepted);assert.deepEqual(displayed.history,before.history);assert.deepEqual(displayed.pending,before.pending);assert.equal(displayed.selectedFeatureId,before.selectedFeatureId);assert.deepEqual(displayed.displays.map(d=>d.selection.featureId),leaves.map(f=>f.id));assert.equal(displayed.displays[0].selection.graphId,full.document.id);assert.equal(displayed.displays[0].nativeMesh.report.meshId,meshIds[0]);pure.markDownloaded(saved.token);assert.equal(pure.getSnapshot().dirty,false);
  const retained=pure.getSnapshot();
  for(const bad of [[],[...outputs(full),outputs(full)[0]],[outputs(full)[0],outputs(full)[0]],[{...outputs(full)[0],selection:{...outputs(full)[0].selection,revision:1}}],[{...outputs(full)[0],selection:{...outputs(full)[0].selection,graphId:'foreign_graph'}}],[{...outputs(full)[0],mesh:{...outputs(full)[0].mesh,maximumVertices:1}}]]) {assert.throws(()=>pure.prepareDisplayOutputs(bad));assert.deepEqual(pure.getSnapshot(),retained);}
  const stale=pure.prepareDisplayOutputs([outputs(full)[3]]);pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'4'});assert.throws(()=>pure.acceptCandidate(stale.token),e=>e.code==='STALE');assert.deepEqual(pure.getSnapshot().accepted,retained.accepted);pure.dispose();
  result.events.push({stage:'pure-qualified-fanout-display',privateCandidates:true,downloadCaptureAndDraftPreserved:true,explicitBudgetDuplicateStaleForeignMeshRefusals:true});

  const snapshot=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.snapshot());
  const display=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.display());
  const wait=(p,g,d)=>p.waitForFunction(({g,d})=>{const s=window.__cadFeatureFlow.snapshot(),r=window.__cadFeatureFlow.display();return s.generation===g&&s.displayGeneration===d&&!s.candidate&&r?.status==='ready'&&r.graphRevision===s.accepted.document.revision&&r.displayGeneration===d&&r.qualifiedOutputs.length===s.displays.length;},{g,d});
  const old=await snapshot();await page.getByLabel('Open native feature graph file').setInputFiles(fixture);await wait(page,old.generation+1,old.displayGeneration+1);
  const opened=await snapshot();assert.equal(opened.displays.length,1);observe(opened.accepted,2,24);
  await page.getByTestId('show-all-outputs').click();await wait(page,opened.generation,opened.displayGeneration+1);const all=await snapshot(),allFrame=await display();
  assert.equal(all.displays.length,4);assert.equal(allFrame.scene.entries.length,4);assert.equal(allFrame.resourceCounts.vertexArrays,8);assert.equal(allFrame.resourceCounts.buffers,20);assert.ok(allFrame.nonBackgroundPixels>0);
  assert.deepEqual(allFrame.scene.entries.map(e=>e.ref.featureId),leaves.map(f=>f.id));assert.equal(all.generation,opened.generation);assert.deepEqual(all.accepted,opened.accepted);assert.deepEqual(all.history,opened.history);
  result.events.push({stage:'actual-four-qualified-shells',native:observe(all.accepted,2,24),display:allFrame,nestedNativeRegion:true});
  await page.getByTestId('feature-select-leaf_middle').click();await page.getByTestId('fit-selected-output').click();await page.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,allFrame.readIndex);await display();assert.deepEqual((await snapshot()).accepted,all.accepted);
  await page.getByTestId('parameter-value-base_height').fill('3');const draft=await snapshot();const captured=await page.evaluate(()=>window.__cadFeatureFlow.session.serializeAccepted());
  await page.getByTestId('output-visible-leaf_middle').click();await wait(page,draft.generation,draft.displayGeneration+1);const hidden=await snapshot();assert.equal(hidden.displays.length,3);assert.deepEqual(hidden.pending,draft.pending);assert.deepEqual(hidden.accepted,draft.accepted);assert.deepEqual(hidden.history,draft.history);assert.equal(hidden.dirty,draft.dirty);
  const hiddenFrame=await display();await page.getByTestId('fit-selected-output').click();await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.context.field==='fit-selected-output');await page.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,hiddenFrame.readIndex);const refusedFit=await display();assert.equal(refusedFit.pixelHash,hiddenFrame.pixelHash);assert.deepEqual(refusedFit.camera,hiddenFrame.camera);
  await page.getByTestId('output-visible-leaf_middle').click();await wait(page,hidden.generation,hidden.displayGeneration+1);await page.evaluate(token=>window.__cadFeatureFlow.session.markDownloaded(token),captured.token);assert.deepEqual((await snapshot()).pending,draft.pending);assert.equal((await snapshot()).dirty,false);
  const beforeApply=await snapshot();await page.getByTestId('feature-apply').click();await wait(page,beforeApply.generation+1,beforeApply.displayGeneration);const height=await snapshot();observe(height.accepted,3,24);assert.equal((await display()).scene.entries.length,4);
  await page.getByTestId('feature-select-boolean_feature').click();await page.getByTestId('boolean-operation-boolean_feature').selectOption('intersection');await page.getByTestId('feature-apply').click();await wait(page,height.generation+1,height.displayGeneration);const intersection=await snapshot();observe(intersection.accepted,3,4);
  result.events.push({stage:'fanout-shared-native-edit-and-view-retention',native:observe(intersection.accepted,3,4),display:await display(),hiddenSelectedFitRefused:true,displayOnlyDraftHistoryDownloadPreserved:true});

  await page.getByTestId('feature-select-leaf_high').click();await page.getByTestId('solo-selected-output').click();await wait(page,intersection.generation,intersection.displayGeneration+1);const solo=await snapshot();assert.deepEqual(solo.displays.map(d=>d.selection.featureId),['leaf_high']);const soloFrame=await display();
  await page.getByTestId('parameter-value-base_height').fill('4');await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(true));await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.code==='DISPLAY');
  await page.getByTestId('show-all-outputs').click();await page.waitForFunction(()=>!window.__cadFeatureFlow.snapshot().candidate);await page.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,soloFrame.readIndex);const gpuRefused=await snapshot();assert.deepEqual(gpuRefused.accepted,solo.accepted);assert.deepEqual(gpuRefused.history,solo.history);assert.equal(gpuRefused.displayGeneration,solo.displayGeneration);assert.deepEqual(gpuRefused.displays,solo.displays);assert.equal(gpuRefused.pending.parameters.base_height.rawValueMM,'4');const gpuFrame=await display();assert.equal(gpuFrame.pixelHash,soloFrame.pixelHash);assert.deepEqual(gpuFrame.camera,soloFrame.camera);
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(false));await page.getByTestId('feature-discard').click();
  result.events.push({stage:'fanout-full-scene-gpu-refusal',displayGeneration:solo.displayGeneration,display:gpuFrame,acceptedGraphDraftHistorySelectionRetained:true});
  await page.getByTestId('parameter-value-base_height').fill('9');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const download=await downloadPromise;const path=resolve(evidence,prefix+'-fanout-'+download.suggestedFilename());await download.saveAs(path);const downloaded=readFileSync(path,'utf8'),savedNative=cad.parseBooleanExtrusionFeatureGraph(downloaded,nativeOptions);observe(savedNative,3,4);assert.equal(savedNative.document.features.length,7);assert.equal((await snapshot()).pending.parameters.base_height.rawValueMM,'9');assert.equal(downloaded,cad.serializeBooleanExtrusionFeatureGraph((await snapshot()).accepted.document,nativeOptions));
  const freshContext=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
  try {
    const fresh=await freshContext.newPage();fresh.on('pageerror',e=>result.pageErrors.push(e.message));await fresh.goto(page.url());await fresh.waitForFunction(()=>window.__cadFeatureFlow?.display()?.status==='ready');await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await wait(fresh,1,1);
    await fresh.getByTestId('output-visible-leaf_middle').click();await wait(fresh,1,2);assert.deepEqual((await snapshot(fresh)).displays.map(d=>d.selection.featureId),['extrusion_feature','leaf_middle']);await fresh.getByTestId('parameter-value-base_height').fill('4');await fresh.getByTestId('feature-apply').click();await wait(fresh,2,2);const reopened=await snapshot(fresh);assert.equal(reopened.accepted.document.revision,savedNative.document.revision+1);observe(reopened.accepted,4,4);assert.equal(reopened.accepted.document.features.length,7);const frame=await display(fresh);assert.equal(frame.scene.entries.length,2);assert.ok(frame.nonBackgroundPixels>0);await fresh.screenshot({path:resolve(evidence,prefix+'-fanout-fresh-reedit.png')});
    result.events.push({stage:'genuine-full-fanout-file-roundtrip',path,native:observe(reopened.accepted,4,4),display:frame,differentView:true,allFourNativeLeavesRetained:true});
    // Open genuine native empty leaves, then refuse selected-output framing without changing the camera.
    const emptyText=readFileSync(resolve(evidence,prefix+'-empty.graph.json'),'utf8');await fresh.getByLabel('Open native feature graph file').setInputFiles({name:'empty.graph.json',mimeType:'application/json',buffer:Buffer.from(emptyText)});await wait(fresh,3,3);await fresh.getByTestId('feature-select-extrusion_feature').click();const emptyFrame=await display(fresh);await fresh.getByTestId('fit-selected-output').click();await fresh.waitForFunction(()=>window.__cadFeatureFlow.error()?.context.field==='fit-selected-output');await fresh.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,emptyFrame.readIndex);assert.deepEqual((await display(fresh)).camera,emptyFrame.camera);assert.equal((await display(fresh)).nonBackgroundPixels,0);result.events.push({stage:'actual-empty-selected-output-fit-refusal',display:await display(fresh)});
  } catch(error) {try{const pages=freshContext.pages();await pages.at(-1)?.screenshot({path:resolve(evidence,prefix+'-fanout-failure.png')});}catch{/* Keep the original failure if capture fails. */}throw error;}finally{await freshContext.close();}
}

// The standalone command runs the same existing feature gate and its fanout extension.
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const args=[...process.argv.slice(2),'--fanout'];
  if(!args.includes('--evidence'))args.push('--evidence','/Users/user/.barocss-ai/v3/evidence-cad-editor-feature-fanout');
  const child=spawnSync(process.execPath,[resolve(import.meta.dirname,'feature-graph-flow.mjs'),...args],{stdio:'inherit'});
  if(child.error)throw child.error;
  process.exitCode=child.status ?? 1;
}
