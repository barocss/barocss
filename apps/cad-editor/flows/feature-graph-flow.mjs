import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const repo = resolve(import.meta.dirname, '../../..');
const evidence = resolve(option('--evidence', '/Users/user/.barocss-ai/v3/evidence-cad-editor-feature-graph'));
const port = Number(option('--port', '52012'));
const compiled = args.includes('--compiled'), mode = compiled ? 'compiled' : 'source';
mkdirSync(evidence, {recursive:true});
const attempt = readdirSync(evidence).filter(n => new RegExp('^' + mode + '-attempt-\\d+\\.json$').test(n)).length + 1;
const prefix = mode + '-attempt-' + String(attempt).padStart(3, '0');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const workingTree=execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim();
const result = {mode,node:process.version,head,workingTree,events:[],pageErrors:[],outcome:'running'};
const save = () => writeFileSync(resolve(evidence,prefix+'.json'),JSON.stringify(result,null,2)+'\n');
const hash = data => createHash('sha256').update(data).digest('hex');
const fixtureText = readFileSync(resolve(repo,'apps/cad-editor/fixtures/boolean-extrusion.authored-graph.json'),'utf8');
const opts = {native:{maximumParameterResolutions:8,maximumFeatureEvaluations:7},display:{featureId:'extrusion_feature',outputSlotId:'extrusion_slot'},mesh:{meshId:'editor_mesh',maximumVertices:384,maximumTriangles:288,maximumEdgePaths:192,maximumNativeSamples:1024}};
let server,browser,context,freshContext,activePage,serverExited=false;
try {
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  if(args.includes('--face-corner')||args.includes('--extrusion-properties')) assert.equal(workingTree,'','Native feature acceptance needs a clean exact head.');
  let cad,editor,runtimeMapPath;
  if(compiled) {
    const {prepareCompiledCheckpoint}=await import('./compiled-checkpoint.mjs');
    const checkpoint=await prepareCompiledCheckpoint({repo,evidence}); result.compiledCheckpoint=checkpoint;
    runtimeMapPath=checkpoint.runtimeMapPath; register(pathToFileURL(checkpoint.loaderPath));
    cad=await import(pathToFileURL(checkpoint.nativeCadPath)); editor=await import(pathToFileURL(checkpoint.editorRootPath));
  } else {
    const path=resolve(evidence,prefix+'-native.mjs');
    await build({stdin:{contents:`export * from ${JSON.stringify(resolve(repo,'packages/barocss-cad/src/index.ts'))};export * from ${JSON.stringify(resolve(repo,'packages/barocss-cad-editor/src/index.ts'))};`,resolveDir:repo},bundle:true,platform:'node',format:'esm',target:'es2022',outfile:path});
    cad=editor=await import(pathToFileURL(path));
  }
  assert.equal(typeof globalThis.window,'undefined'); assert.equal(typeof globalThis.document,'undefined');
  const initial=cad.parseBooleanExtrusionFeatureGraph(fixtureText,opts.native);
  function observe(accepted,distance,area) {
    // Re-evaluate the authored graph through the public native provider, independent of editor display data.
    const native=cad.evaluateBooleanExtrusionFeatureGraph(accepted.document,opts.native);
    assert.equal(native.report.summary.materialAreaUV,area);
    const feature=native.features.find(f=>f.featureId==='extrusion_feature');
    assert.equal(feature.kind,'normal-extrusion'); const extrusion=feature.evaluation;
    assert.equal(extrusion.options.distanceMM,distance);
    const expected=[-distance/Math.sqrt(2),0,distance/Math.sqrt(2)];
    assert.ok(extrusion.translationMM.every((v,i)=>Math.abs(v-expected[i])<1e-8),'Inclined authored XYZ native extrusion vector');
    for(const top of extrusion.vertices.filter(v=>v.layer==='top')) {
      const bottom=extrusion.vertices.find(v=>v.layer==='bottom'&&v.nativeVertexId===top.nativeVertexId);
      assert.ok(bottom); top.pointMM.forEach((v,i)=>assert.ok(Math.abs(v-bottom.pointMM[i]-expected[i])<1e-8));
    }
    assert.equal(Object.is(native.document.parameters.find(p=>p.id==='unused').definition.valueMM,-0),true);
    assert.equal(Object.is(native.document.features.find(f=>f.id==='face_a_feature').loop.edges[0].knots[0],-0),true);
    assert.deepEqual(native.report.nativeBuilderCalls,{faceInput:2,coplanarBoolean:1,normalExtrusion:1});
    return {graphId:native.document.id,revision:native.document.revision,distanceMM:distance,materialAreaUV:area,normal:extrusion.normal,translationMM:extrusion.translationMM,vertexCount:extrusion.vertices.length,faceCount:extrusion.faces.length,shellCount:extrusion.shells.length,featureDependencies:native.report.featureDependencies,parameterDependencies:native.report.parameterDependencies};
  }
  const pure=editor.createCadEditorFeatureSession(initial.document,opts);
  observe(pure.getSnapshot().accepted,2,24);
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'2'}); assert.equal(pure.prepareApply(),null);
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'3'}); const candidate=pure.prepareApply();
  candidate.result.document.id='caller_mutated'; candidate.display.nativeMesh.report.meshId='caller_mutated';
  pure.acceptCandidate(candidate.token); assert.equal(pure.getSnapshot().accepted.document.id,'cad_boolean_extrusion'); observe(pure.getSnapshot().accepted,3,24);
  const capture=pure.serializeAccepted(); pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'4'}); const stale=pure.prepareApply();
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'5'}); assert.throws(()=>pure.acceptCandidate(stale.token),e=>e.code==='STALE');
  pure.discardPending(); pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'0'});
  const invalid=pure.getSnapshot(); assert.throws(()=>pure.prepareApply()); assert.deepEqual(pure.getSnapshot(),invalid);
  pure.discardPending(); pure.stageLengthParameter('base_height',{kind:'offset',parameterId:'design_height',rawOffsetMM:'0'});
  const cyclic=pure.getSnapshot(); assert.throws(()=>pure.prepareApply()); assert.deepEqual(pure.getSnapshot(),cyclic);
  pure.discardPending();
  const budget=pure.getSnapshot(); assert.throws(()=>pure.prepareOpen(fixtureText,{...opts,mesh:{...opts.mesh,maximumVertices:1}})); assert.deepEqual(pure.getSnapshot(),budget);
  pure.stageLengthParameter('base_height',{kind:'literal',rawValueMM:'4'}); pure.acceptCandidate(pure.prepareApply().token);
  assert.throws(()=>pure.markDownloaded(capture.token),e=>e.code==='STALE'); pure.dispose(); pure.dispose();
  assert.throws(()=>pure.stageBooleanOperation('boolean_feature','union'),e=>e.code==='LIFECYCLE');
  result.events.push({stage:'pure-feature-session',browserGlobalsAbsent:true,privateCandidate:true,nativeValueDependencyMeshRefusals:true,staleLifecycle:true});

  const runtime=option('--playwright','/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const executablePath=option('--browser','/Users/user/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');
  assert.ok(existsSync(executablePath)); const {chromium}=await import(pathToFileURL(runtime)); result.runtime={runtime,executablePath};
  const require=createRequire(resolve(repo,'package.json')); const vite=resolve(dirname(require.resolve('vite/package.json')),'bin/vite.js');
  server=spawn(process.execPath,[vite,'--force','--host','127.0.0.1','--port',String(port)],{cwd:resolve(repo,'apps/cad-editor'),env:{...process.env,...(compiled?{CAD_EDITOR_COMPILED_MAP:runtimeMapPath}:{})},stdio:['ignore','pipe','pipe']});
  let log='';for(const stream of [server.stdout,server.stderr])stream.on('data',b=>{log+=b.toString();writeFileSync(resolve(evidence,prefix+'-server.log'),log);});server.on('exit',()=>{serverExited=true;});
  const url=`http://127.0.0.1:${port}/?flow#/features/cad_boolean_extrusion`,deadline=Date.now()+20000;
  while(true){assert.equal(serverExited,false);assert.ok(!log.includes('already in use'));if(log.includes(`http://127.0.0.1:${port}/`)){try{if((await fetch(url)).ok)break;}catch{/* Retry while the owned server starts. */}}assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,100));}
  result.ownedServer={port,pid:server.pid,worktree:repo,url,childListeningConfirmed:true};
  browser=await chromium.launch({headless:!args.includes('--headed'),executablePath});
  context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
  const page=await context.newPage();activePage=page;page.on('pageerror',e=>result.pageErrors.push(e.message));await page.goto(url);
  const ready=page=>page.waitForFunction(()=>window.__cadFeatureFlow?.display()?.status==='ready'&&window.__cadFeatureFlow.display().nonBackgroundPixels>0);
  await ready(page);
  const snapshot=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.snapshot());
  const display=(p=page)=>p.evaluate(()=>window.__cadFeatureFlow.display());
  const generation=(p,g)=>p.waitForFunction(g=>{const s=window.__cadFeatureFlow.snapshot(),r=window.__cadFeatureFlow.display();return s.generation===g&&!s.candidate&&r?.status==='ready'&&r.graphRevision===s.accepted.document.revision;},g);
  const before=await snapshot();const initialDisplay=await display();observe(before.accepted,2,24);
  assert.equal(await page.locator('[data-testid^="feature-select-"]').count(),4);
  result.events.push({stage:'actual-native-feature-tree',native:observe(before.accepted,2,24),display:initialDisplay});
  await page.getByTestId('parameter-value-base_height').fill('3');await page.getByTestId('feature-apply').click();await generation(page,1);
  const height=await snapshot();const heightDisplay=await display();assert.notEqual(heightDisplay.pixelHash,initialDisplay.pixelHash);
  result.events.push({stage:'native-height-edit',native:observe(height.accepted,3,24),display:heightDisplay});
  await page.getByTestId('feature-select-boolean_feature').click();await page.getByTestId('boolean-operation-boolean_feature').selectOption('intersection');await page.getByTestId('feature-apply').click();await generation(page,2);
  const intersection=await snapshot();const acceptedDisplay=await display();assert.notEqual(acceptedDisplay.pixelHash,heightDisplay.pixelHash);observe(intersection.accepted,3,4);
  for(const id of ['face_a_feature','face_b_feature'])assert.deepEqual(intersection.accepted.document.features.find(f=>f.id===id),before.accepted.document.features.find(f=>f.id===id));
  result.events.push({stage:'native-boolean-operation',native:observe(intersection.accepted,3,4),display:acceptedDisplay,originalFaceInputsRetained:true});
  async function retained(p,prior,frame){await p.waitForFunction(index=>window.__cadFeatureFlow.display().readIndex>index,frame.readIndex);const now=await snapshot(p),read=await display(p);assert.deepEqual(now.accepted,prior.accepted);assert.deepEqual(now.history,prior.history);assert.equal(read.pixelHash,frame.pixelHash);assert.deepEqual(read.camera,frame.camera);return read;}
  await page.getByTestId('parameter-value-base_height').fill('0');await page.getByTestId('feature-apply').click();await page.waitForFunction(()=>window.__cadFeatureFlow.error());
  await retained(page,intersection,acceptedDisplay);assert.equal((await snapshot()).pending.parameters.base_height.rawValueMM,'0');await page.getByTestId('feature-discard').click();
  const cycleFrame=await display();await page.getByTestId('parameter-kind-base_height').selectOption('offset');await page.getByTestId('parameter-reference-base_height').selectOption('design_height');await page.getByTestId('parameter-value-base_height').fill('0');await page.getByTestId('feature-apply').click();await page.waitForFunction(()=>window.__cadFeatureFlow.error());
  await retained(page,intersection,cycleFrame);await page.getByTestId('feature-discard').click();
  result.events.push({stage:'actual-invalid-value-and-cycle',graphHistoryRawDraftFrameRetained:true});
  const gpuFrame=await display();await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(true));await page.waitForFunction(()=>window.__cadFeatureFlow.error()?.code==='DISPLAY');
  await page.getByTestId('parameter-value-base_height').fill('4');await page.getByTestId('feature-apply').click();await page.waitForFunction(()=>!window.__cadFeatureFlow.snapshot().candidate&&window.__cadFeatureFlow.snapshot().pending.parameters.base_height?.rawValueMM==='4');
  const refused=await retained(page,intersection,gpuFrame);result.events.push({stage:'actual-gpu-refusal',diagnostic:await page.evaluate(()=>window.__cadFeatureFlow.error()),display:refused});
  await page.evaluate(()=>window.__cadFeatureFlow.setDisplayRefusal(false));await ready(page);await page.getByTestId('feature-discard').click();
  const contact=structuredClone(before.accepted.document);const b=contact.features.find(f=>f.id==='face_b_feature');for(const line of b.loop.edges)for(const point of line.controlPoints){if(point[1]===-5){point[0]+=1;point[1]+=2;point[2]+=1;}}
  const contactPath=resolve(evidence,prefix+'-contact.json');writeFileSync(contactPath,JSON.stringify(contact));const fileFrame=await display();
  await page.getByLabel('Open native feature graph file').setInputFiles(contactPath);await page.waitForFunction(()=>JSON.stringify(window.__cadFeatureFlow.error()).includes('CONTACT'));await retained(page,intersection,fileFrame);const contactError=await page.evaluate(()=>window.__cadFeatureFlow.error());
  const malformedPath=resolve(evidence,prefix+'-malformed.json');writeFileSync(malformedPath,'{"bad":');const malformedFrame=await display();await page.getByLabel('Open native feature graph file').setInputFiles(malformedPath);await page.waitForFunction(()=>window.__cadFeatureFlow.error());await retained(page,intersection,malformedFrame);
  result.events.push({stage:'actual-contact-and-file-refusals',contactError,acceptedGraphFrameRetained:true});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await generation(page,3);observe((await snapshot()).accepted,3,24);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await generation(page,4);observe((await snapshot()).accepted,3,4);
  await page.getByTestId('parameter-value-base_height').fill('5');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();const download=await downloadPromise;
  const path=resolve(evidence,prefix+'-'+download.suggestedFilename());await download.saveAs(path);const text=readFileSync(path,'utf8');
  const saved=await snapshot();assert.equal(text,cad.serializeBooleanExtrusionFeatureGraph(saved.accepted.document,opts.native));assert.equal(saved.pending.parameters.base_height.rawValueMM,'5');const cold=cad.parseBooleanExtrusionFeatureGraph(text,opts.native);observe(cold,3,4);
  assert.equal(JSON.parse(text).camera,undefined);assert.equal(JSON.parse(text).pending,undefined);assert.ok(text.includes('"valueMM":-0'));
  result.events.push({stage:'genuine-native-graph-download',path,sha256:hash(text),native:observe(cold,3,4),draftExcluded:true});
  freshContext=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});const fresh=await freshContext.newPage();activePage=fresh;fresh.on('pageerror',e=>result.pageErrors.push(e.message));await fresh.goto(url);await ready(fresh);
  await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await generation(fresh,1);await fresh.getByTestId('parameter-value-base_height').fill('4');await fresh.getByTestId('feature-apply').click();await generation(fresh,2);
  let reopened=await snapshot(fresh);const freshDisplay=await display(fresh);assert.ok(freshDisplay.nonBackgroundPixels>0);assert.equal(reopened.accepted.document.revision,cold.document.revision+1);observe(reopened.accepted,4,4);
  await fresh.screenshot({path:resolve(evidence,prefix+'-fresh-reedit.png')});result.events.push({stage:'fresh-open-native-reedit',native:observe(reopened.accepted,4,4),display:freshDisplay});
  const beforeHelp=await display(fresh);await fresh.getByTestId('cad-editor-feature-help').click();await fresh.getByRole('dialog').waitFor();await fresh.keyboard.press('Escape');await fresh.getByRole('dialog').waitFor({state:'hidden'});await fresh.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='cad-editor-feature-help');
  const afterHelp=await display(fresh);assert.equal(afterHelp.width,beforeHelp.width);assert.equal(afterHelp.height,beforeHelp.height);assert.deepEqual(await snapshot(fresh),reopened);
  await fresh.getByRole('button',{name:'Fit',exact:true}).click();await fresh.waitForFunction(i=>window.__cadFeatureFlow.display().readIndex>i,afterHelp.readIndex);assert.deepEqual(await snapshot(fresh),reopened);
  await fresh.getByTestId('parameter-value-base_height').fill('5');const modeDraft=await snapshot(fresh);const modeFrame=await display(fresh);
  await fresh.getByRole('menubar').getByText('File',{exact:true}).click();await fresh.getByRole('menuitem',{name:'Surface document',exact:true}).click();await fresh.locator('[data-viewer-ready="true"]').waitFor();
  await fresh.getByTestId('body-select-surface_body').click();await fresh.getByTestId('cad-editor-zMM').fill('24');await fresh.getByTestId('cad-editor-weight').fill('2');await fresh.getByTestId('cad-editor-apply').click();await fresh.waitForFunction(()=>window.__cadEditorFlow.snapshot().generation===1&&!window.__cadEditorFlow.snapshot().candidate);
  const direct=await fresh.evaluate(()=>window.__cadEditorFlow.snapshot());const ref=cad.createCadGeometryReference(direct.accepted,{bodyId:'surface_body'}).reference;const directPoint=cad.queryCadDocumentPoint(direct.accepted,ref,{kind:'surface',u:0.5,v:0.5}).pointMM;assert.ok(Math.abs(directPoint[2]-56/5)<1e-8);
  await fresh.getByRole('menubar').getByText('File',{exact:true}).click();await fresh.getByRole('menuitem',{name:'New Boolean extrusion',exact:true}).click();await ready(fresh);assert.deepEqual(await snapshot(fresh),modeDraft);const returnedFrame=await display(fresh);assert.equal(returnedFrame.pixelHash,modeFrame.pixelHash);assert.deepEqual(returnedFrame.camera,modeFrame.camera);await fresh.getByTestId('feature-discard').click();
  result.events.push({stage:'help-fit-and-mode-draft-retention',helpFocusAndDimensions:true,nativeCameraSeparation:true,featureDraftRetained:true,actualDirectSurfacePoint:directPoint});
  const emptyDoc=structuredClone(before.accepted.document);emptyDoc.features.find(f=>f.id==='boolean_feature').options.operation='intersection';
  for(const line of emptyDoc.features.find(f=>f.id==='face_b_feature').loop.edges)for(const point of line.controlPoints){const u=point[0]-point[1]*0.5+2;const offset=u===2?3:1;point[0]+=offset;point[2]+=offset;}
  const emptyText=cad.serializeBooleanExtrusionFeatureGraph(emptyDoc,opts.native);assert.equal(cad.parseBooleanExtrusionFeatureGraph(emptyText,opts.native).report.summary.empty,true);const emptyPath=resolve(evidence,prefix+'-empty.graph.json');writeFileSync(emptyPath,emptyText);await fresh.getByLabel('Open native feature graph file').setInputFiles(emptyPath);await generation(fresh,3);const emptyReceipt=await display(fresh);assert.equal(emptyReceipt.empty,true);assert.equal(emptyReceipt.nonBackgroundPixels,0);assert.equal((await snapshot(fresh)).accepted.report.summary.empty,true);
  result.events.push({stage:'actual-empty-boolean-admission',path:emptyPath,display:emptyReceipt,suppression:false});
  await fresh.getByLabel('Open native feature graph file').setInputFiles(path);await generation(fresh,4);await fresh.getByTestId('parameter-value-base_height').fill('4');await fresh.getByTestId('feature-apply').click();await generation(fresh,5);reopened=await snapshot(fresh);observe(reopened.accepted,4,4);
  if(args.includes('--fanout')) {
    const {runFeatureFanoutFlow}=await import('./feature-fanout-flow.mjs');
    await runFeatureFanoutFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo});
    reopened=await snapshot(fresh);
  }
  if(args.includes('--lifecycle')) {
    // The fanout gate intentionally retains its draft. Start the separate fixture through the real Discard action.
    if(args.includes('--fanout')) await fresh.getByTestId('feature-discard').click();
    const {runExtrusionLifecycleFlow}=await import('./extrusion-lifecycle-flow.mjs');
    await runExtrusionLifecycleFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo});
    reopened=await snapshot(fresh);
  }
  if(args.includes('--parameter-lifecycle')) {
    const {runParameterLifecycleFlow}=await import('./parameter-lifecycle-flow.mjs');
    await runParameterLifecycleFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo});
    reopened=await snapshot(fresh);
  }
  if(args.includes('--referenced-lifecycle')) {
    if(args.includes('--fanout')&&!args.includes('--lifecycle')) await fresh.getByTestId('feature-discard').click();
    const {runReferencedFeatureFlow}=await import('./referenced-feature-flow.mjs');
    await runReferencedFeatureFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo});
    reopened=await snapshot(fresh);
  }
  if(args.includes('--face-corner')) {
    const {runFaceCornerFlow}=await import('./face-corner-flow.mjs');
    save();
    await runFaceCornerFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo,persist:save});
    reopened=await snapshot(fresh);
  }
  if(args.includes('--extrusion-properties')) {
    const {runExtrusionPropertiesFlow}=await import('./extrusion-properties-flow.mjs');
    save();
    await runExtrusionPropertiesFlow({page:fresh,browser,cad,editor,result,evidence,prefix,repo,persist:save});
    reopened=await snapshot(fresh);
  }
  await fresh.evaluate(()=>window.__cadFeatureFlow.setMounted(false));await fresh.waitForFunction(()=>window.__cadFeatureFlow.display()?.status==='disposed');const disposed=await display(fresh);assert.deepEqual(disposed.lifecycle,{mounts:1,disposals:1});assert.ok(Object.values(disposed.resourceCounts).every(n=>n===0));assert.deepEqual(await snapshot(fresh),reopened);
  await fresh.evaluate(()=>window.__cadFeatureFlow.setMounted(true));await ready(fresh);assert.deepEqual(await snapshot(fresh),reopened);result.events.push({stage:'unmount-remount',disposed,hostSessionRetained:true});
  assert.deepEqual(result.pageErrors,[]);result.outcome='passed';save();process.stdout.write(JSON.stringify({mode,outcome:'passed',stages:result.events.map(x=>x.stage),evidence:resolve(evidence,prefix+'.json')})+'\n');
} catch(error) {
  if(activePage)try{result.failureWindowState=await activePage.evaluate(()=>({error:window.__cadFeatureFlow?.error(),snapshot:window.__cadFeatureFlow?.snapshot(),display:window.__cadFeatureFlow?.display()}));await activePage.screenshot({path:resolve(evidence,prefix+'-failure.png')});}catch{/* Keep the original failure if capture fails. */}
  result.outcome='failed';result.failure={message:error.message,stack:error.stack};save();process.stderr.write(error.stack+'\n');process.exitCode=1;
} finally {await freshContext?.close();await context?.close();await browser?.close();if(server&&!serverExited){server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(r,2000);});}}
