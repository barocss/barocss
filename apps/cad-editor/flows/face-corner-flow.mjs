import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const native={maximumParameterResolutions:8,maximumFeatureEvaluations:7};
const mesh={maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024};
export async function runFaceCornerFlow({page,browser,cad,editor,result,evidence,prefix,repo,persist=()=>{}}) {
  const fixture=resolve(repo,'apps/cad-editor/fixtures/shared-extrusions.authored-graph.json');
  const original=cad.parseBooleanExtrusionFeatureGraph(readFileSync(fixture,'utf8'),native);
  const faceId='face_a_feature',cornerIndex=2,trigger=`face-corner-edit-${faceId}-${cornerIndex}`;
  const initialDoc=structuredClone(original.document);initialDoc.features.find(f=>f.kind==='coplanar-boolean').options.operation='intersection';
  const intersect=cad.evaluateBooleanExtrusionFeatureGraph(initialDoc,native);
  const opts={native,display:{featureId:'extrusion_feature',outputSlotId:'extrusion_slot'},mesh:{...mesh,meshId:'editor_mesh'}};
  const leaves=graph=>graph.document.features.filter(f=>f.kind==='normal-extrusion');
  const outputs=graph=>leaves(graph).map((f,i)=>({selection:{graphId:graph.document.id,revision:graph.document.revision,featureId:f.id,outputSlotId:f.outputSlotId},mesh:{...mesh,meshId:i?'view_leaf_'+i:'editor_mesh'}}));
  const expectedFeatures=(base,point)=>base.document.features.map(f=>{
    const next=structuredClone(f);if(f.id===faceId){next.loop.edges[1].controlPoints[1]=[...point];next.loop.edges[2].controlPoints[0]=[...point];}return next;
  });
  function observe(accepted,area,base,point) {
    cad.validateBooleanExtrusionFeatureGraph(accepted);
    const actual=cad.evaluateBooleanExtrusionFeatureGraph(accepted.document,native);
    assert.equal(actual.report.summary.materialAreaUV,area);
    assert.deepEqual(actual.document.features,expectedFeatures(base,point));assert.deepEqual(actual.document.parameters,original.document.parameters);
    assert.equal(Object.is(actual.document.parameters.find(p=>p.id==='unused').definition.valueMM,-0),true);
    assert.equal(Object.is(actual.document.features.find(f=>f.id===faceId).loop.edges[0].knots[0],-0),true);
    const extrusions=leaves(actual).map(f=>actual.features.find(e=>e.featureId===f.id).evaluation);
    assert.deepEqual(extrusions.map(e=>e.options.distanceMM),[2,3,4,5]);
    for(const e of extrusions){const vector=[-e.options.distanceMM/Math.sqrt(2),0,e.options.distanceMM/Math.sqrt(2)];assert.ok(e.translationMM.every((v,i)=>Math.abs(v-vector[i])<1e-8));
      for(const top of e.vertices.filter(v=>v.layer==='top')){const bottom=e.vertices.find(v=>v.layer==='bottom'&&v.nativeVertexId===top.nativeVertexId);assert.ok(bottom);top.pointMM.forEach((v,i)=>assert.ok(Math.abs(v-bottom.pointMM[i]-vector[i])<1e-8));}}
    return {revision:actual.document.revision,areaUV:area,pointMM:point,distancesMM:extrusions.map(e=>e.options.distanceMM),vectors:extrusions.map(e=>e.translationMM),featureIds:actual.document.features.map(f=>f.id),nativeBuilderCalls:actual.report.nativeBuilderCalls};
  }
  const pure=editor.createCadEditorFeatureSession(intersect.document,opts);pure.acceptCandidate(pure.prepareDisplayOutputs(outputs(intersect)).token);pure.selectFeature(faceId);
  const corner=pure.getFaceCorners(faceId)[cornerIndex];assert.deepEqual(corner.pointMM,[.5,-3,.5]);assert.equal(corner.binding.previousPoleIndex,1);assert.equal(corner.binding.nextPoleIndex,0);
  assert.equal(corner.binding.previousLineId,'original_line_1');assert.equal(corner.binding.nextLineId,'original_line_2');
  let before=pure.getSnapshot();
  for(const binding of [null,{...corner.binding,extra:true},{...corner.binding,revision:99},{...corner.binding,graphId:'foreign_graph'},{...corner.binding,featureId:'face_b_feature'},{...corner.binding,outputSlotId:'foreign_slot'},{...corner.binding,cornerIndex:99},{...corner.binding,previousLineId:'original_line_3'},{...corner.binding,nextPoleIndex:1}]){
    before=pure.getSnapshot();assert.throws(()=>pure.prepareFaceCornerEdit(binding,[1,-3,1]));assert.deepEqual(pure.getSnapshot(),before);
  }
  let getterCalls=0;const accessor={...corner.binding};Object.defineProperty(accessor,'revision',{enumerable:true,get(){getterCalls++;return 0;}});
  before=pure.getSnapshot();assert.throws(()=>pure.prepareFaceCornerEdit(accessor,[1,-3,1]));assert.equal(getterCalls,0);assert.deepEqual(pure.getSnapshot(),before);
  for(const point of [[NaN,-3,1],[Infinity,-3,1],[10001,-3,10001],[5,-3,5],[1,-3,2],[-5.5,-7,-5.5],[-5.5,-3,-5.5],[2.5,-1,2.5]]){
    before=pure.getSnapshot();assert.throws(()=>pure.prepareFaceCornerEdit(corner.binding,point),e=>point[0]===2.5?e.code==='NATIVE'&&e.cause instanceof cad.BooleanExtrusionFeatureGraphError&&e.cause.cause?.code==='CONTACT':true);assert.deepEqual(pure.getSnapshot(),before);
  }
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'3'});before=pure.getSnapshot();assert.throws(()=>pure.prepareFaceCornerEdit(corner.binding,[1,-3,1]));assert.deepEqual(pure.getSnapshot(),before);pure.discardPending();
  const binding={...corner.binding},point=[1,-3,1],capture=pure.serializeAccepted(),base=pure.getSnapshot();
  const candidate=pure.prepareFaceCornerEdit(binding,point);assert.equal(candidate.kind,'structure');before=pure.getSnapshot();assert.throws(()=>pure.prepareFaceCornerEdit(binding,point));assert.deepEqual(pure.getSnapshot(),before);
  binding.featureId='foreign';point[0]=99;candidate.result.document.features.length=0;pure.acceptCandidate(candidate.token);
  const accepted=pure.getSnapshot();observe(accepted.accepted,4.75,intersect,[1,-3,1]);assert.equal(accepted.selectedFeatureId,faceId);assert.equal(accepted.displayGeneration,base.displayGeneration);assert.equal(accepted.generation,base.generation+1);assert.equal(accepted.history.count,base.history.count+1);assert.equal(accepted.displays.length,4);
  assert.throws(()=>pure.prepareFaceCornerEdit(corner.binding,[.75,-3,.75]));assert.throws(()=>pure.markDownloaded(capture.token),e=>e.code==='STALE');
  pure.acceptCandidate(pure.prepareUndo().token);observe(pure.getSnapshot().accepted,4,intersect,[.5,-3,.5]);pure.acceptCandidate(pure.prepareRedo().token);observe(pure.getSnapshot().accepted,4.75,intersect,[1,-3,1]);
  const privateCorner=pure.getFaceCorners(faceId)[cornerIndex];privateCorner.pointMM[0]=99;privateCorner.binding.featureId='foreign';assert.deepEqual(pure.getFaceCorners(faceId)[cornerIndex].pointMM,[1,-3,1]);
  pure.dispose();assert.throws(()=>pure.getFaceCorners(faceId),e=>e.code==='LIFECYCLE');
  result.events.push({stage:'pure-coupled-native-corner',native:observe(accepted.accepted,4.75,intersect,[1,-3,1]),getterCalls,privateBindingPointCandidate:true,currentBindingDraftActiveStaleRangeNativeContactRefusals:true,selectionHistoryFourOutputsPreserved:true});

  persist();
  const snapshot=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.snapshot());
  const display=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.display());
  const wait=(p,old,n=1)=>p.waitForFunction(({g,n})=>{const s=window.__cadFeatureFlow.snapshot(),r=window.__cadFeatureFlow.display();return s.generation===g+n&&!s.candidate&&r?.status==='ready'&&r.graphRevision===s.accepted.document.revision&&r.displayGeneration===s.displayGeneration&&r.qualifiedOutputs.length===s.displays.length;},{g:old.generation,n});
  async function retained(old,frame){await page.waitForFunction(()=>!window.__cadFeatureFlow.snapshot().candidate&&window.__cadFeatureFlow.error());await page.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,frame.readIndex);const now=await snapshot(),actual=await display();for(const key of ['accepted','history','pending','displays','generation','displayGeneration','selectedFeatureId'])assert.deepEqual(now[key],old[key]);assert.equal(actual.pixelHash,frame.pixelHash);assert.deepEqual(actual.camera,frame.camera);return actual;}
  const fill=async(p,point)=>{for(const [i,axis] of ['x','y','z'].entries())await p.getByTestId('face-corner-'+axis).fill(String(point[i]));};
  let old=await snapshot();await page.getByLabel('Open native feature graph file').setInputFiles(fixture);await wait(page,old);
  await page.getByTestId('feature-select-boolean_feature').click();await page.getByTestId('boolean-operation-boolean_feature').selectOption('intersection');old=await snapshot();await page.getByTestId('feature-apply').click();await wait(page,old);
  old=await snapshot();await page.getByTestId('show-all-outputs').click();await wait(page,old,0);await page.getByTestId('feature-select-'+faceId).click();
  const uiBase=await snapshot();observe(uiBase.accepted,4,intersect,[.5,-3,.5]);await page.screenshot({path:resolve(evidence,prefix+'-corner-original.png')});
  await page.getByTestId(trigger).click();await fill(page,[1,-3,1]);const keyBefore=await snapshot();
  await page.getByTestId('face-corner-x').focus();await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.deepEqual(await snapshot(),keyBefore);
  await page.getByTestId('face-corner-x').focus();const cdp=await page.context().newCDPSession(page);await cdp.send('Input.imeSetComposition',{text:'1',selectionStart:1,selectionEnd:1});
  const ime=await page.getByTestId('face-corner-x').evaluate(el=>{const event=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,isComposing:true});el.dispatchEvent(event);return {isComposing:event.isComposing,value:el.value};});assert.equal(ime.isComposing,true);assert.deepEqual(await snapshot(),keyBefore);await cdp.send('Input.insertText',{text:'1'});await cdp.detach();await fill(page,[1,-3,1]);
  await page.getByTestId('face-corner-help').click();await page.getByTestId('face-corner-help-dialog').waitFor();await page.getByTestId('face-corner-help-close').click();await page.getByTestId('face-corner-help-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='face-corner-help');assert.equal(await page.getByTestId('face-corner-x').inputValue(),'1');assert.deepEqual(await snapshot(),keyBefore);
  for(const [point,diagnostic] of [[[1,-3,2],'coplanarity'],[[5,-3,5],'finite native Plane domain'],[[-5.5,-3,-5.5],'concave'],[[2.5,-1,2.5],'CONTACT']]){await fill(page,point);old=await snapshot();const frame=await display();await page.getByTestId('face-corner-confirm').click();await retained(old,frame);assert.ok(JSON.stringify(await page.evaluate(()=>window.__cadFeatureFlow.error())).includes(diagnostic));if(diagnostic==='CONTACT')assert.match(await page.getByTestId('face-corner-dialog').getByRole('alert').innerText(),/unsupported contact/i);for(const [i,axis]of ['x','y','z'].entries())assert.equal(await page.getByTestId('face-corner-'+axis).inputValue(),String(point[i]));result.events.push({stage:'actual-corner-native-refusal-'+diagnostic,diagnostic:await page.evaluate(()=>window.__cadFeatureFlow.error()),graphRevision:old.accepted.document.revision,pixelHash:frame.pixelHash});}
  await page.screenshot({path:resolve(evidence,prefix+'-corner-contact-refusal.png')});await fill(page,[1,-3,1]);await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(true));await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.code==='DISPLAY');old=await snapshot();const originalFrame=await display();await page.getByTestId('face-corner-confirm').click();const gpu=await retained(old,originalFrame);assert.equal(await page.getByTestId('face-corner-x').inputValue(),'1');await page.screenshot({path:resolve(evidence,prefix+'-corner-gpu-refusal.png')});
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(false));old=await snapshot();await page.getByTestId('face-corner-confirm').click();await wait(page,old);await page.getByTestId('face-corner-dialog').waitFor({state:'hidden'});await page.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')===id,trigger);
  const changed=await snapshot(),changedFrame=await display();observe(changed.accepted,4.75,uiBase.accepted,[1,-3,1]);assert.equal(changed.selectedFeatureId,faceId);assert.equal(changed.displayGeneration,uiBase.displayGeneration);assert.equal(changed.history.count,uiBase.history.count+1);assert.notEqual(changedFrame.pixelHash,originalFrame.pixelHash);assert.ok(changedFrame.nonBackgroundPixels>0);assert.deepEqual(changedFrame.camera,originalFrame.camera);assert.equal(changedFrame.qualifiedOutputs.length,4);for(const output of changedFrame.qualifiedOutputs)assert.equal(output.binding.revision,changed.accepted.document.revision);
  const independent=cad.evaluateBooleanExtrusionFeatureGraph(changed.accepted.document,native);
  for(const [index,output] of changed.displays.entries()) {
    assert.deepEqual(output.nativeMesh.extrusion,independent.features.find(f=>f.featureId===output.binding.featureId).evaluation);
    assert.deepEqual(changedFrame.scene.entries[index].native,output.nativeMesh);
    assert.deepEqual(changedFrame.scene.entries[index].ref,{graphId:output.binding.graphId,graphRevision:output.binding.revision,featureId:output.binding.featureId,outputSlotId:output.binding.outputSlotId});
    assert.notDeepEqual(output.nativeMesh.mesh.positionsMM,uiBase.displays[index].nativeMesh.mesh.positionsMM);
  }
  await page.screenshot({path:resolve(evidence,prefix+'-corner-applied.png')});result.events.push({stage:'actual-coupled-corner-gpu-accept',native:observe(changed.accepted,4.75,uiBase.accepted,[1,-3,1]),display:changedFrame,gpuRefusal:gpu,keyboardTabEnterComposition:ime,helpRawFocusRetained:true,acceptedCornerFocus:true});
  persist();
  old=await snapshot();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(page,old);observe((await snapshot()).accepted,4,uiBase.accepted,[.5,-3,.5]);old=await snapshot();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(page,old);observe((await snapshot()).accepted,4.75,uiBase.accepted,[1,-3,1]);
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download',exact:true}).click()]);const path=resolve(evidence,prefix+'-corner-'+download.suggestedFilename());await download.saveAs(path);const saved=cad.parseBooleanExtrusionFeatureGraph(readFileSync(path,'utf8'),native);assert.deepEqual(saved.document,(await snapshot()).accepted.document);observe(saved,4.75,uiBase.accepted,[1,-3,1]);
  const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
  try {
    const fresh=await context.newPage();fresh.on('pageerror',e=>result.pageErrors.push(e.message));await fresh.goto(page.url());await fresh.waitForFunction(()=>window.__cadFeatureFlow?.display()?.status==='ready');old=await snapshot(fresh);await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await wait(fresh,old);old=await snapshot(fresh);await fresh.getByTestId('show-all-outputs').click();await wait(fresh,old,0);await fresh.getByTestId('feature-select-'+faceId).click();
    await fresh.getByTestId(trigger).click();assert.equal(await fresh.getByTestId('face-corner-x').inputValue(),'1');await fill(fresh,[.75,-3,.75]);old=await snapshot(fresh);await fresh.getByTestId('face-corner-confirm').click();await wait(fresh,old);await fresh.getByTestId('face-corner-dialog').waitFor({state:'hidden'});const reedited=await snapshot(fresh);observe(reedited.accepted,4.375,uiBase.accepted,[.75,-3,.75]);const frame=await display(fresh);assert.ok(frame.nonBackgroundPixels>0);assert.notEqual(frame.pixelHash,changedFrame.pixelHash);assert.equal(frame.qualifiedOutputs.length,4);await fresh.screenshot({path:resolve(evidence,prefix+'-corner-fresh-reedit.png')});result.events.push({stage:'genuine-corner-download-fresh-reedit',path,native:observe(reedited.accepted,4.375,uiBase.accepted,[.75,-3,.75]),display:frame});
    persist();
    for(const cancel of ['escape','cancel']){await fresh.getByTestId(trigger).click();await fill(fresh,[1,-3,2]);if(cancel==='escape')await fresh.keyboard.press('Escape');else await fresh.getByTestId('face-corner-cancel').click();await fresh.getByTestId('face-corner-dialog').waitFor({state:'hidden'});await fresh.waitForFunction(id=>document.activeElement?.getAttribute('data-testid')===id,trigger);assert.deepEqual(await snapshot(fresh),reedited);}
    await fresh.evaluate(()=>window.__cadFeatureFlow.setMounted(false));await fresh.waitForFunction(()=>window.__cadFeatureFlow.display()?.status==='disposed');const disposed=await display(fresh);assert.ok(Object.values(disposed.resourceCounts).every(n=>n===0));assert.deepEqual(await snapshot(fresh),reedited);await fresh.evaluate(()=>window.__cadFeatureFlow.setMounted(true));await fresh.waitForFunction(()=>window.__cadFeatureFlow.display()?.status==='ready');assert.deepEqual(await snapshot(fresh),reedited);result.events.push({stage:'corner-cancel-escape-focus-remount',zeroResources:true,sessionRetained:true});
  }catch(error){try{await context.pages().at(-1)?.screenshot({path:resolve(evidence,prefix+'-corner-fresh-failure.png')});}catch{ /* Preserve the original failure if collecting diagnostics also fails. */ }throw error;}finally{await context.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=[...process.argv.slice(2),'--face-corner'];if(!args.includes('--evidence'))args.push('--evidence','/Users/user/.barocss-ai/v3/evidence-cad-editor-face-corner');const child=spawnSync(process.execPath,[resolve(import.meta.dirname,'feature-graph-flow.mjs'),...args],{stdio:'inherit'});if(child.error)throw child.error;process.exitCode=child.status??1;}
