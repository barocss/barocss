// D541_SOURCE_FROZEN=1 node test/flanged-shaft-baseline-browser.mjs /ABS/NEW/OUTPUT
// Genuine public two-Cylinder flanged shaft; root owns execution and image review.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {inspectorSource,oracleSource} from './flanged-shaft-baseline-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const projectName=`D541-${randomUUID()}`,partName='D541-flanged-shaft';
const producers=['packages/barocss-cad-model/src/app/commands.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/engine/doc.ts','packages/barocss-cad-model/src/engine/part.ts','packages/barocss-cad-model/src/engine/references.ts','packages/barocss-cad-model/src/engine/errors.ts','apps/cad-studio/src/viewport/vertexPick.ts'];
const f=await createFlow({name:'flanged-shaft-baseline',envFrozen:'D541_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D541 true circular flange/shaft: public New/twoCylinders/orderedUnion/ThroughHoleR3/toprimR1, Distance25→35, Distance0 refusal/FIRST UndoRedo, own project roundtrip and postOpen Distance25 with receipt cleanup',
  initialFiles:['apps/cad-studio/test/flanged-shaft-baseline-browser.mjs','apps/cad-studio/test/flanged-shaft-baseline-oracles.mjs','apps/cad-studio/test/flanged-shaft-admission-preflight.mjs','apps/cad-studio/test/bracket-baseline-oracles.mjs','apps/cad-studio/test/enclosure-baseline-oracles.mjs','apps/cad-studio/test/enclosure-admission-preflight.mjs'],
  extraFrozen:producers,requiredFrozen:[...producers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','apps/cad-studio/src/ui/Hud.tsx','apps/cad-studio/src/ui/BodyBrowserRows.tsx','apps/cad-studio/src/viewport/Viewport.tsx','packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits:['Desktop WebGPU1440x900 only; root must view original screenshots.',
    'One circular flange R20/Z0..6 plus shaft R10/Z5..30/40 with1mm overlap, ThroughHoleR3 and outertoprimR1; no wholeB03/wholeCAD claim.',
    'Actual cap/rim refs and display indices derive from each current original native prefix; real pointer actions never inject selection or force clicks.',
    'Actual Cylinder .made receipts remain until NodeEditor invalidates them. PostOpen25 restores geometry while shaft receipt remains absent; it is not raw-originalA.',
    'Actual UI Distance0 reason/retention is separate from controlled native PARAMETER/n3 classification; no actual Worker code/feature is inferred.',
    'Native BRep and independent Python are physical authority; same-context project reload is not cold-process persistence. No export/download/mobile/release.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    hudFields:[...document.querySelectorAll('.hud input,.hud select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    selected:window.__studioSelection?.selection??null,alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.projectName=projectName;let projectCreated=false,seedDoc=null,authoredA=null,referenceAnchors=null;const nativeCache=new Map(),labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
async function command(name) {
  await f.page.evaluate(() => document.activeElement?.blur());
  await f.command(name);
}
function receipt(node,values){
  assert.equal(node.made?.command,'cylinder');for(const[key,wanted]of Object.entries(values)){
    const value=node.made.values[key];assert.ok(typeof value==='number'||typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value));assert.equal(Number(value),wanted);
  }assert.ok(node.made.values.up===undefined||node.made.values.up==='+z');
}
function invariant(doc,height){
  assert.equal(doc.format,'barocss-cad-model');assert.equal(doc.schema,3);assert.equal(doc.units,'mm');assert.deepEqual(doc.parameters,{});assert.equal(doc.nextId,doc.nodes.length);
  doc.nodes.forEach((node,index)=>assert.equal(node.id,`n${index}`));
  assert.deepEqual(doc.nodes[0],{kind:'sketch',profile:'circle',center:[0,0],radius:20,id:'n0'});
  const flange=doc.nodes[1];assert.equal(flange.kind,'extrude');assert.equal(flange.sketch,0);assert.equal(flange.height,6);assert.equal(flange.from,undefined);receipt(flange,{r:20,h:6,x:0,y:0,z:0});
  if(doc.nodes.length>=4){
    assert.deepEqual(doc.nodes[2],{kind:'sketch',profile:'circle',center:[0,0],radius:10,id:'n2'});const shaft=doc.nodes[3];
    assert.equal(shaft.kind,'extrude');assert.equal(shaft.sketch,2);assert.equal(shaft.height,height-5);assert.equal(shaft.from,5);
    if(shaft.made)receipt(shaft,{r:10,h:25,x:0,y:0,z:5});
  }
  if(doc.nodes.length>=5)assert.deepEqual(doc.nodes[4],{kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'},id:'n4'});
  if(doc.nodes.length>=6){const hole=doc.nodes[5];assert.equal(hole.kind,'hole');assert.deepEqual(hole.parent,{node:4,side:'solid'});assert.equal(hole.radius,3);assert.deepEqual(hole.center,[0,0]);assert.equal(hole.face,'n3.top');assert.equal(hole.depth,undefined);}
  if(doc.nodes.length===7){
    const finish=doc.nodes[6];assert.equal(finish.kind,'fillet');assert.deepEqual(finish.parent,{node:5,side:'solid'});assert.equal(finish.radius,1);
    if(authoredA){
      assert.deepEqual(doc.nodes.filter((_,i)=>i!==3),authoredA.nodes.filter((_,i)=>i!==3),'all other source/root/ref/signature intent remains exact');
      const {made,...actual}=doc.nodes[3],{made:oldMade,...original}=authoredA.nodes[3];assert.deepEqual(actual,{...original,height:height-5});
    }
  }
}
async function qualify(label,expectedDoc,height,phase){
  f.phase=label;await f.same(expectedDoc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),previous=nativeCache.get(key),parameters={height};
  const read=previous?.read??await f.inspect(`${label}-native`,state.doc,{label,phase,parameters});
  f.report.reads.push({label,read,exactWholeDocSha256:key,reusedFrom:previous?.label??null});
  const input={doc:state.doc,expectedDoc,seedDoc,read,consumer:state,parameters,referenceAnchors,documentJSON:state.documentJSON};
  await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'flanged-shaft-baseline-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');
  let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve first malformed result before assertions. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:previous?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,'PASS_ONE_DECLARED_D541_FLANGED_SHAFT_STATE');
  invariant(state.doc,height);assert.deepEqual(state.doc,expectedDoc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!previous)nativeCache.set(key,{label,read});return {state,read};
}

// Current bounded public camera and native-name pointer helpers, unchanged from D539.
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
async function cylinder(previous,radius,height,z,label){
  f.phase=label;await f.page.keyboard.press('Escape');await command('Cylinder');const hud=f.page.getByRole('dialog',{name:'Cylinder',exact:true});await hud.waitFor();
  for(const[field,value]of [['Radius',radius],['Height',height],['Centre X',0],['Centre Y',0],['At Z',z]])await hud.getByLabel(field,{exact:true}).fill(String(value));
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});await capture(`${label}-typed-preview-before-Apply`);
  assert.equal(await hud.getByLabel('Operation',{exact:true}).count(),0,'Cylinder creates a separate body');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);await hud.waitFor({state:'hidden'});
  return (await capture(`${label}-actual-accepted-before-assert`)).doc;
}
async function unionBodies(previous){
  f.phase='03-ordered-flange-then-shaft-Union';await f.ready();const bodies=(await f.bodies()).bodies;
  const flange=bodies.findIndex(body=>body.key==='b1'),shaft=bodies.findIndex(body=>body.key==='b3');assert.ok(flange>=0&&shaft>=0&&flange!==shaft);
  const rows=f.page.locator('.outliner .ol-row > button.ol');assert.equal(await rows.count(),2);await rows.nth(flange).click();await rows.nth(shaft).click({modifiers:['Shift']});
  await capture('03-real-ordered-two-body-selection-before-assert');assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.bodies),[flange,shaft]);
  await command('Union');await f.changed(previous);return (await capture('03-actual-Union-before-assert')).doc;
}
async function throughHole(previous,top){
  f.phase='04-real-upward-shaft-cap-Through-Hole';assert.ok(top&&Number.isInteger(top.index)&&top.nativeNames.includes('n3.top'));
  f.report.observations.push({label:'actual-current-shaft-cap-before-real-pick',target:top});
  await f.page.keyboard.press('Escape');await publicView(f,'Top');await selectionFilter(f,'Faces');assert.equal(await frameQualified3D(f,[top]),true);
  await f.page.mouse.click(...await projected(f,top.world));await capture('04-real-shaft-cap-picked-before-assert');
  assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.faces),[{body:top.bodyIndex,face:top.index}]);
  await command('Hole');const hud=f.page.getByRole('dialog',{name:'Hole',exact:true});await hud.waitFor();
  await hud.getByLabel('Type',{exact:true}).selectOption('through');await hud.getByLabel('Copies',{exact:true}).selectOption('one');
  for(const[field,value]of [['Diameter',6],['Centre X',0],['Centre Y',0]])await hud.getByLabel(field,{exact:true}).fill(String(value));
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});await capture('04-Through-Hole-typed-preview');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);await hud.waitFor({state:'hidden'});
  const actual=await capture('04-actual-Hole-before-assert');assert.equal(actual.doc.nodes[5].face,top.nativeName.split('+')[0]);return actual.doc;
}
async function topRimFinish(previous,rim){
  f.phase='05-real-outer-top-circular-rim-R1';assert.ok(rim&&Number.isInteger(rim.index)&&rim.nativeMembers.length===2);
  f.report.observations.push({label:'actual-current-original-outer-rim-before-real-pick',target:rim});
  await f.page.keyboard.press('Escape');await publicView(f,'Iso');await selectionFilter(f,'Edges');await f.page.mouse.click(...await visibleEdge(f,rim));
  await capture('05-real-outer-rim-selected-before-assert');assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.edges),[{body:rim.bodyIndex,edge:rim.index}]);
  await command('Fillet');const hud=f.page.getByRole('dialog',{name:'Fillet',exact:true});await hud.waitFor();
  await hud.getByLabel('Fillet type',{exact:true}).selectOption('edge');await hud.getByLabel('Fillet radius mode',{exact:true}).selectOption('constant');
  await hud.getByLabel('Radius',{exact:true}).fill('1');await hud.getByLabel('Section',{exact:true}).selectOption('circular');
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});await capture('05-circular-R1-typed-preview');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);await hud.waitFor({state:'hidden'});
  const state=await capture('05-actual-finish-A-before-assert');assert.deepEqual(new Set(state.doc.nodes[6].edges),new Set(rim.nativeNames));
  authoredA=state.doc;referenceAnchors=structuredClone(state.doc.nodes[6].sigs);assert.ok(state.doc.nodes[1].made&&state.doc.nodes[3].made);return state.doc;
}
async function distance(previous,from,to,label){
  f.phase=label;await f.closeEditor();await f.openFeatureEditor(3,label);const field=f.editor().getByLabel('Distance',{exact:true});
  assert.equal(Number(await field.inputValue()),from);await field.fill(String(to));await capture(`${label}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous);
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);const actual=await capture(`${label}-accepted-before-assert`);
  assert.equal(actual.doc.nodes[3].made,undefined,'NodeEditor invalidates the edited shaft builder receipt');assert.deepEqual(actual.doc.nodes[1].made,authoredA.nodes[1].made);
  await f.closeEditor();return actual.doc;
}
async function refuseZero(B,acceptedB){
  f.phase='07-Distance0-NodeEditor-Apply';await f.openFeatureEditor(3,'07-invalid-Distance0');await f.editor().getByLabel('Distance',{exact:true}).fill('0');
  await capture('07-Distance0-local-before-Apply');assert.deepEqual(await f.doc(),B);
  assert.equal(await f.editor().getByRole('button',{name:'Apply',exact:true}).isDisabled(),true);
  await f.editor().getByLabel('Distance',{exact:true}).press('Enter');
  const reason=await f.editor().getByRole('status').getByText(/Distance.*except 0 mm/i).innerText(),state=await capture('07-Distance0-refused-before-assert');
  assert.match(reason,/except 0 mm/i);assert.deepEqual(state.doc,B);assert.deepEqual(state.worker.bodies,acceptedB.worker.bodies);assert.deepEqual(state.historyRows,acceptedB.historyRows);
  f.report.observations.push({label:'actual-Distance0-UI-refusal',actualUIReason:reason,acceptedDocRetained:true,acceptedBodyRetained:true,historyRetained:true,
    separateControlledNativeClassification:{code:'PARAMETER',feature:'n3',message:'height must not be zero',authority:'D541 original native admission; not an actual Worker code/feature observation'}});
  await f.closeEditor();await f.dismissToasts();await f.same(B);await qualify('07-refusal-retains-B',B,40,'finish');
}
async function versions(){
  await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});
  if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;
}
async function saveReopen(B){
  f.phase='10-own-project-Save';let card=await versions();
  const absent=await f.page.evaluate(async name=>{
    const root=await navigator.storage.getDirectory();try{const projects=await root.getDirectoryHandle('projects');await projects.getDirectoryHandle(name);return false;}
    catch(error){if(error.name==='NotFoundError')return true;throw error;}
  },projectName);assert.equal(absent,true,'Never overwrite existing project');
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;
  await f.page.locator('.doc-tab input').fill(partName);await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
  await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{
    const root=await navigator.storage.getDirectory(),project=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    const file=await(await project.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};
  },{projectName,partName});
  await writeFile(join(output,'10-own-project-saved-B.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),B);
  f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};await qualify('10-own-project-saved-exact-B',B,40,'finish');
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});
  await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();
  await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(B);await f.ready();await qualify('11-same-context-reload-Open-exact-B',B,40,'finish');
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await f.page.getByRole('button',{name:'New part',exact:true}).click();await f.page.waitForFunction(()=>window.__studioDoc?.nodes.length===0);await f.ready();
    const blank=await capture('00-public-New-part-before-assert');assert.deepEqual(blank.doc,{format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes:[],outputs:{},nextId:0});seedDoc=blank.doc;
    const flange=await cylinder(seedDoc,20,6,0,'01-flange-Cylinder');await qualify('01-actual-flange',flange,30,'flange');
    const shaft=await cylinder(flange,10,25,5,'02-shaft-Cylinder');await qualify('02-actual-shaft-New-two-live-outputs',shaft,30,'shaftNew');
    const union=await unionBodies(shaft),unionRead=await qualify('03-actual-Union',union,30,'union');
    const hole=await throughHole(union,unionRead.read.display.top),holeRead=await qualify('04-actual-Through-Hole',hole,30,'hole');
    const A=await topRimFinish(hole,holeRead.read.display.rim);await qualify('05-actual-finish-A',A,30,'finish');
    const B=await distance(A,25,35,'06-Distance35');const acceptedB=await qualify('06-accepted-B-shaft-top40',B,40,'finish');await refuseZero(B,acceptedB.state);
    await f.undo();await f.same(A);await qualify('08-FIRST-document-Undo-exact-original-A',A,30,'finish');
    await f.redo();await f.same(B);await qualify('09-Redo-exact-B',B,40,'finish');await saveReopen(B);
    const postA=await distance(B,35,25,'12-postOpen-Distance25');await qualify('12-postOpen-A-geometry-cleaned-receipt',postA,30,'finish');
    const expected={...A,nodes:A.nodes.map((node,index)=>index===3?(({made,...rest})=>rest)(node):node)};
    assert.deepEqual(postA,expected,'Original A geometry with intentionally removed shaft receipt');assert.notDeepEqual(postA,A);
    assert.equal(f.report.reads.length,12);assert.deepEqual(f.report.downloads,[]);f.report.nativeCaptures=nativeCache.size;f.report.currentWorkerBindings=f.report.reads.length;
    f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
  }finally{
    if(projectCreated){const cleanup={ownedProject:projectName};try{
      const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();
      cleanup.namespace=await f.page.evaluate(async name=>{
        const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});
        try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}
      },projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');
    }finally{f.report.cleanup.push(cleanup);await f.persist();}}
  }
});
