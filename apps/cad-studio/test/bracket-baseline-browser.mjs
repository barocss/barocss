// D538_SOURCE_FROZEN=1 node test/bracket-baseline-browser.mjs /ABS/NEW/OUTPUT
// B01 selected support-bracket continuation. Root owns all execution and image review.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {clickModelCommand} from './model-rail-helper.mjs';
import {inspectorSource,oracleSource} from './bracket-baseline-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const seedFile=process.env.D538_SEED_FILE??'/tmp/barocss-d448-remaining-run02/05-opfs-saved.bcad';
assert.ok(isAbsolute(seedFile),'Seed input must be an absolute path');
const seedBytes=await readFile(seedFile);
assert.equal(seedBytes.length,3431);assert.equal(sha256(seedBytes),'2727e7d3d726a58030657720ebc7a8d09a4dab574887dd7d2001cc42305ed16f');
const seedDoc=JSON.parse(seedBytes),projectName=`D538-${randomUUID()}`,partName='D538-support-bracket';
const editorProducers=['packages/barocss-cad-model/src/sketch/rules.ts','packages/barocss-cad-model/src/sketch/settle.ts','packages/barocss-cad-model/src/sketch/outlineFields.ts','packages/barocss-cad-model/src/sketch/reopen.ts','packages/barocss-cad-model/src/sketch/profile.ts','apps/cad-studio/src/sketch/preserveConstruction.ts'];
const f=await createFlow({name:'bracket-baseline',envFrozen:'D538_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D538 B01 selected retained support bracket: upstream Width60→80, invalid Fillet HUD1000/Cancel/FIRST Undo/Redo, real Measure76, owned project roundtrip, Width80→60 and real Measure56',
  initialFiles:['apps/cad-studio/test/bracket-baseline-browser.mjs','apps/cad-studio/test/bracket-baseline-oracles.mjs','apps/cad-studio/test/model-rail-helper.mjs',seedFile],
  extraFrozen:editorProducers,
  requiredFrozen:[...editorProducers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/sketch/useSketchActions.ts','apps/cad-studio/src/ui/SketchPanel.tsx','packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits:['Desktop WebGPU1440x900 only; root must inspect original screenshots.',
    'Exact retained complete D448 support-bracket seed; initial plate/boss/Revolve/Union/Hole/four Fillets construction is eligible retained evidence, not replayed here.',
    'Radius1000 is a genuine existing Fillet HUD preview refusal/disabled Apply/Cancel, not NodeEditor Apply refusal.',
    'Display edge mapping only supplies real native-name pointer indices; native BRep and independent Python supply physical authority.',
    'Project persistence uses same-context reload; no cold browser profile, export, download, mobile, release or general bracket-family claim.'],
  snapshotExtra:()=>({measurementPanel:document.querySelector('[aria-label="Measurement"]')?.innerText??null,documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    sketchFields:[...document.querySelectorAll('.sk-panel input')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,locked:field.classList.contains('locked')})),
    dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed={file:seedFile,bytes:seedBytes.length,sha256:sha256(seedBytes),authority:'Exact retained complete W60 support bracket'};
f.report.projectName=projectName;
let projectCreated=false;const nativeCache=new Map(),labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
const invariant=(doc,width)=>{
  assert.deepEqual({...doc,nodes:seedDoc.nodes},seedDoc,'root metadata/output/nextId retained');
  assert.deepEqual(doc.nodes.slice(1),seedDoc.nodes.slice(1),'all downstream IDs/nodes/ref strings/historical signatures retained');
  const sketch=doc.nodes[0],original=seedDoc.nodes[0];
  const {min,max,outline,...extras}=sketch,{min:oldMin,max:oldMax,outline:oldOutline,...originalExtras}=original;
  assert.deepEqual(extras,originalExtras);assert.deepEqual(min,[-20,-20]);assert.deepEqual(max,[width-20,20]);
  assert.deepEqual(outline.lengths,{'0':width,'1':40});assert.deepEqual(outline.hv,oldOutline.hv);
};
const qualify=async(label,expectedDoc,width)=>{
  f.phase=label;await f.same(expectedDoc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),previous=nativeCache.get(key);
  const parameters={width},read=previous?.read??await f.inspect(`${label}-native`,state.doc,{label,width});
  f.report.reads.push({label,read,exactWholeDocSha256:key,reusedFrom:previous?.label??null});
  const input={doc:state.doc,expectedDoc,seedDoc,read,consumer:state,parameters,documentJSON:state.documentJSON};
  await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'bracket-baseline-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');
  let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve first malformed result before assertions. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:previous?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,'PASS_ONE_DECLARED_D538_BRACKET_STATE');
  invariant(state.doc,width);assert.deepEqual(state.doc,expectedDoc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!previous)nativeCache.set(key,{label,read});return {state,read};
};

// Bounded public pointer framing retained from the D448 driver. No selection writes.
async function selectionFilter(f, text) {
  const button = f.page.getByRole('button', { name: 'Selection filter', exact: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await button.innerText()).trim().endsWith(text)) return;
    await button.click();
  }
  assert.fail(`public selection filter could not select ${text}`);
}
async function publicView(f, name) {
  await f.page.getByRole('group', { name: 'Views', exact: true }).getByRole('button', { name, exact: true }).click();
  await f.page.locator('.views button[title="Frame all (F)"]').click();
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function projected(f, world) {
  const read = await f.page.evaluate(world => {
    const pixel = window.__studioScreenOf(world);
    return { pixel, clear: pixel && !!document.elementFromPoint(...pixel)?.closest('.vp-canvas') };
  }, world);
  assert.ok(read.pixel?.length === 2 && read.clear, 'unobstructed projected pointer target'); return read.pixel;
}
async function orbit(f, dx, dy) {
  const point = await f.page.evaluate(() => {
    const box = document.querySelector('.vp-canvas').getBoundingClientRect(), point = [box.left + box.width / 2, box.top + box.height / 2];
    return document.elementFromPoint(...point)?.closest('.vp-canvas') ? point : null;
  });
  assert.ok(point, 'public orbit needs an unobstructed canvas center');
  await f.page.mouse.move(...point); await f.page.mouse.down({ button: 'right' });
  try { await f.page.mouse.move(point[0] + dx, point[1] + dy, { steps: 8 }); }
  finally { await f.page.mouse.up({ button: 'right' }); }
  await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function frameQualified3D(f, targets) {
  const points = targets.map(target => target.world), attempts = [];
  for (let attempt = 0; attempt < 11; attempt++) {
    const read = await f.page.evaluate(points => {
      const canvas = document.querySelector('.vp-canvas'), box = canvas.getBoundingClientRect();
      const projected = points.map(world => {
        const pixel = window.__studioScreenOf(world);
        return { world, pixel, clear: !!pixel && pixel[0] > box.left + 24 && pixel[0] < box.right - 24 && pixel[1] > box.top + 24 && pixel[1] < box.bottom - 24
          && !!document.elementFromPoint(...pixel)?.closest('.vp-canvas') };
      });
      let wheelPoint = null;
      for (const [u, v] of [[.5, .5], [.6, .5], [.5, .6], [.65, .65]]) {
        const point = [box.left + box.width * u, box.top + box.height * v];
        if (document.elementFromPoint(...point)?.closest('.vp-canvas')) { wheelPoint = point; break; }
      }
      return { projected, wheelPoint, allClear: projected.every(point => point.clear), box: [box.left, box.top, box.width, box.height] };
    }, points);
    attempts.push(read);
    if (read.allClear) { f.report.observations.push({ label: 'qualified-3d-framing', attempts }); return true; }
    if (!read.wheelPoint || attempt === 10) break;
    await f.page.mouse.move(...read.wheelPoint); await f.page.mouse.wheel(0, 300);
    await f.page.waitForTimeout(350);
  }
  f.report.observations.push({ label: 'qualified-3d-framing-not-clear', attempts }); return false;
}
async function visibleEdge(f, target, framingTargets = [target]) {
  assert.ok(Number.isInteger(target.index) && target.world?.length === 3 && target.nativeNames?.length, 'qualified actual native/display edge mapping required');
  const attempts = [];
  for (let attempt = 0; attempt < 13; attempt++) {
    const framed = await frameQualified3D(f, framingTargets);
    const read = await f.page.evaluate(world => {
      const pixel = window.__studioScreenOf(world);
      return { pixel, clear: !!pixel && !!document.elementFromPoint(...pixel)?.closest('.vp-canvas'), hit: window.__studioEdgeAt(world), eye: window.__studioEye?.() };
    }, target.world);
    attempts.push(read);
    if (framed && read.clear && read.hit?.body === 0 && read.hit.edge === target.index) { f.report.observations.push({ label: 'real-edge-visibility', target, attempts }); return read.pixel;
    }
    if (attempt < 12) await orbit(f, 90, attempt === 5 ? 45 : attempt === 9 ? -45 : 0);
  }
  f.report.observations.push({ label: 'edge-not-visible', target, attempts }); await f.snapshot('first-edge-visibility-failure');
  assert.fail(`qualified edge is not reachable after bounded real orbit: ${target.nativeNames.join(', ')}`);
}
async function assertDriving(width,label){
  await f.page.waitForFunction(width=>{
    const panel=document.querySelector('.sk-panel'),a=panel?.querySelector('[aria-label="Edge 1 length"]'),b=panel?.querySelector('[aria-label="Edge 2 length"]');
    return a&&b&&Number(a.value)===width&&Number(b.value)===40&&a.classList.contains('locked')&&b.classList.contains('locked')
      &&/Fully defined/.test(panel.textContent)&&/rank\s*8\s*·\s*0 DOF/.test(panel.textContent)&&!panel.querySelector('[role="alert"]');
  },width,{timeout:30000});
  await capture(label);
}
async function editWidth(previous,from,to,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(1,label);
  await f.editor().getByRole('button',{name:'Edit sketch',exact:true}).click();await f.sketchPanel().waitFor();
  await assertDriving(from,`${label}-reopened-fully-defined`);
  const field=f.sketchPanel().getByLabel('Edge 1 length',{exact:true});await field.fill(String(to));await field.press('Enter');
  await assertDriving(to,`${label}-local-fully-defined`);assert.deepEqual(await f.doc(),previous,'local sketch drafting leaves accepted Doc unchanged');
  await f.page.locator('.topbar button.finish').click();await f.sketchPanel().waitFor({state:'hidden'});await f.changed(previous);
  const actual=await capture(`${label}-actual-Finish-before-assert`);return actual.doc;
}
function measurementTarget(read,width){
  const target=read.display.measurement;assert.ok(target&&Number.isInteger(target.index));
  assert.ok(target.nativeNames.includes('n1.bottom|n1.side[e1]'),'qualified original native measurement name');
  assert.equal(target.length,width-4);assert.deepEqual(target.world,[0,-20,0]);
  assert.deepEqual(new Set([JSON.stringify(target.a),JSON.stringify(target.b)]),new Set([JSON.stringify([-18,-20,0]),JSON.stringify([width-22,-20,0])]));
  return target;
}
async function invalidFilletRetains(target,accepted,beforeState){
  f.phase='03-public-invalid-Fillet-HUD-radius1000';await f.page.keyboard.press('Escape');await publicView(f,'Iso');await selectionFilter(f,'Edges');
  await f.page.mouse.click(...await visibleEdge(f,target));
  assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.edges),[{body:0,edge:target.index}]);
  await f.command('Fillet');const hud=f.page.getByRole('dialog',{name:'Fillet',exact:true});await hud.waitFor();
  await hud.getByLabel('Radius',{exact:true}).fill('1000');
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='refused',null,{timeout:60000});
  const state=await capture('03-invalid-Fillet1000-preview-before-assert');
  assert.equal(await hud.getByRole('button',{name:'Apply',exact:true}).isEnabled(),false);
  assert.match(state.hud,/\[RADIUS_EXCEEDS_FACE\]/,'the current failure must be the declared size refusal');
  assert.match(state.hud,/edge n1\.bottom\|n1\.side\[e1\]/,'the size refusal must name the actual selected edge');
  assert.match(state.hud,/fillet 1000 mm/,'the failure must belong to the current typed radius');
  const reason=await hud.locator('.hud-error').innerText();assert.ok(reason.trim());
  assert.deepEqual(state.doc,accepted);assert.deepEqual(state.worker.bodies,beforeState.worker.bodies);assert.deepEqual(state.historyRows,beforeState.historyRows);
  f.report.observations.push({label:'genuine-existing-Fillet-HUD-refusal',reason,radius:1000,applyDisabled:true,documentRetained:true,bodyRetained:true});
  await hud.getByRole('button',{name:'Cancel',exact:true}).click();await hud.waitFor({state:'hidden'});await f.same(accepted);
  await qualify('04-invalid-Cancel-retains-W80',accepted,80);
}
async function realMeasure(target,width,label){
  f.phase=label;const before=await f.doc();await f.page.keyboard.press('Escape');await publicView(f,'Iso');await selectionFilter(f,'Edges');
  await visibleEdge(f,target);await clickModelCommand(f.page,'Inspect','Measure');const panel=f.page.getByLabel('Measurement',{exact:true});await panel.waitFor();
  await f.page.mouse.click(...await visibleEdge(f,target));
  await panel.locator('.measure-item').getByText('Line',{exact:true}).waitFor();
  await panel.locator('.kv').filter({hasText:/^Length/}).getByText(`${width-4} mm`,{exact:true}).waitFor();
  f.report.observations.push({label,target,ui:await panel.innerText(),authority:'Actual existing Measure command and unobstructed real pointer pick'});
  await qualify(label,before,width);await panel.getByRole('button',{name:'Done measuring',exact:true}).click();await f.same(before);
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
  await writeFile(join(output,'08-own-opfs-saved-W80.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),expected);
  f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};
  await qualify('08-own-project-saved-W80',expected,80);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});
  await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');
  await f.ready();card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);
  await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();
  await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();
  await f.same(expected);await f.ready();await qualify('09-same-context-reload-project-Open-exact-W80',expected,80);
  f.report.observations.push({label:'owned-project-roundtrip',sameContext:true,exactAcceptedDoc:true,downloads:f.report.downloads.length});
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    // The retained seed already has seven nodes, so count/readiness alone cannot qualify async Open.
    await f.page.setInputFiles('input[aria-label="Model file"]',seedFile);await f.same(seedDoc);await f.ready();
    await capture('00-exact-retained-W60-antecedent');
    const W80=await editWidth(seedDoc,60,80,'01-upstream-width80');
    const accepted80=await qualify('02-accepted-W80',W80,80),target80=measurementTarget(accepted80.read,80);
    await invalidFilletRetains(target80,W80,accepted80.state);
    // No successful Doc commit between the failed preview and this FIRST document Undo.
    await f.undo();await f.same(seedDoc);await qualify('05-FIRST-document-Undo-exact-W60',seedDoc,60);
    await f.redo();await f.same(W80);const redone=await qualify('06-Redo-exact-W80',W80,80);
    await realMeasure(measurementTarget(redone.read,80),80,'07-real-Measure76');
    await saveReopen(W80);
    const W60=await editWidth(W80,80,60,'10-postOpen-upstream-width60');
    const final=await qualify('11-postOpen-accepted-W60',W60,60);
    await realMeasure(measurementTarget(final.read,60),60,'12-postOpen-real-Measure56');
    assert.equal(f.report.reads.length,9,'Nine declared fresh Doc/Worker physical bindings');
    assert.deepEqual(f.report.downloads,[]);f.report.nativeCaptures=nativeCache.size;f.report.currentWorkerBindings=f.report.reads.length;
    f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
  }finally{
    if(projectCreated){
      const cleanup={ownedProject:projectName};
      try{
        const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();
        cleanup.namespace=await f.page.evaluate(async name=>{
          const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});
          try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}
        },projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');
      }finally{f.report.cleanup.push(cleanup);await f.persist();}
    }
  }
});
