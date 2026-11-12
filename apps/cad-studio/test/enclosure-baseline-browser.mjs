// D539_SOURCE_FROZEN=1 node test/enclosure-baseline-browser.mjs /ABS/NEW/OUTPUT
// One admitted true-Shell enclosure, public rail/Hole row/corner creation and edit lifecycle.
// Root owns desktop execution and original screenshot review. No product state injection.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve} from 'node:path';
import {createFlow,sha256} from './flow-helper.mjs';
import {clickModelCommand} from './model-rail-helper.mjs';
import {inspectorSource,oracleSource} from './enclosure-baseline-oracles.mjs';

const output=process.argv[2],repo=resolve(import.meta.dirname,'../../..');
assert.ok(output&&isAbsolute(output));assert.ok(relative(repo,resolve(output)).startsWith('../'));await mkdir(output);
const seedFile=process.env.D539_SEED_FILE??'/tmp/barocss-d449-category-run01/shell-edited.bcad';
assert.ok(isAbsolute(seedFile),'Seed input must be an absolute path');
const seedBytes=await readFile(seedFile);
assert.equal(seedBytes.length,582);assert.equal(sha256(seedBytes),'17351eb2ad01ffbafcf9c76d21e2da5030b794600ca80a55a41a0928fdbaf6c9');
const continuationFile=process.env.D539_CONTINUE_HOLE_ROW_FROM;
const continuationReadFile=continuationFile?'/tmp/barocss-d539-studio01/10-actual-Hole-row-native.stdout.json':null;
let continuationDoc=null,continuationRead=null,continuationBytes=null;
if(continuationFile){
  assert.ok(isAbsolute(continuationFile),'Hole-row continuation requires an absolute input');
  continuationBytes=await readFile(continuationFile);
  assert.equal(sha256(continuationBytes),'2ceaf62baf257c0a3dba311f3435cb2ccea1c7e49b851c9c369732e4466e1581','Exact actual Studio01 Hole-row bytes');
  continuationDoc=JSON.parse(continuationBytes);const mappingBytes=await readFile(continuationReadFile);
  assert.equal(sha256(mappingBytes),'705419618dd10da92fb655570ae7936944114a6c1f7bbc0d02cc16f13a06f3fd','Exact retained Studio01 native pointer mapping packet');
  continuationRead=JSON.parse(mappingBytes);
  assert.equal(continuationRead.documentJSON,JSON.stringify(continuationDoc));assert.equal(continuationRead.inputUnchanged,true);assert.equal(continuationRead.ok,true);
}
const seedDoc=JSON.parse(seedBytes),projectName=`D539-${randomUUID()}`,partName='D539-enclosure';
const editorProducers=['packages/barocss-cad-model/src/app/commands.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/sketch/rules.ts','packages/barocss-cad-model/src/sketch/settle.ts','packages/barocss-cad-model/src/sketch/outlineFields.ts','packages/barocss-cad-model/src/sketch/reopen.ts','packages/barocss-cad-model/src/sketch/profile.ts','apps/cad-studio/src/sketch/preserveConstruction.ts','apps/cad-studio/src/viewport/Viewport.tsx','apps/cad-studio/src/viewport/vertexPick.ts','apps/cad-studio/test/vertex-pick-filter.test.ts','apps/cad-studio/src/engine/engine.worker.ts','packages/barocss-cad-model/src/engine/wireDoc.ts','packages/barocss-cad-model/src/engine/errors.ts'];
const f=await createFlow({name:'enclosure-baseline',envFrozen:'D539_SOURCE_FROZEN',output,inspectorSource,oracleSource,
  qualification:'D539 B02 admitted true Shell: public rail New/Union/Hole row/fourR1, Width80→90/Wall2→3, Width4 collapse retention/FIRST UndoRedo, owned project roundtrip and postOpen Copies3→2',
  initialFiles:['apps/cad-studio/test/enclosure-baseline-browser.mjs','apps/cad-studio/test/enclosure-baseline-oracles.mjs','apps/cad-studio/test/enclosure-admission-preflight.mjs','apps/cad-studio/test/model-rail-helper.mjs',seedFile,...(continuationFile?[continuationFile,continuationReadFile]:[])],
  extraFrozen:editorProducers,
  requiredFrozen:[...editorProducers,'apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','apps/cad-studio/src/ui/Hud.tsx','apps/cad-studio/src/ui/BodyBrowserRows.tsx','packages/barocss-cad-model/src/engine/evaluate.ts'],
  limits:['Desktop WebGPU1440x900 only; root must view original screenshots.',
    'Initial actual D449 Shell and public Wall3→2 are setup antecedents; this driver creates one coherent rail/Union/Hole-row/fourR1 enclosure.',
    'Actual Box .made provenance remains raw; controlled typed admission Doc without .made is separate NON_UI evidence.',
    'Display mappings supply real native-name pointer indices only; independent Python original native geometry supplies physical authority.',
    'Width4 is native Shell collapse via existing NodeEditor Apply, not new-tool preview or local sketch Undo.',
    'Project persistence uses same-context reload; no cold browser profile/export/download/mobile/release/general enclosure-family claim.'],
  snapshotExtra:()=>({documentJSON:JSON.stringify(window.__studioDoc),worker:window.__studioBodies?.(),rootFresh:window.__studioFresh,
    historyRows:[...document.querySelectorAll('.history .hs')].map(row=>({index:row.getAttribute('data-node-index'),label:row.getAttribute('aria-label'),suppressed:row.classList.contains('suppressed')})),
    editorFields:[...document.querySelectorAll('.node-editor input,.node-editor select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    hudFields:[...document.querySelectorAll('.hud input,.hud select')].map(field=>({label:field.getAttribute('aria-label'),value:field.value,disabled:field.disabled})),
    selected:window.__studioSelection?.selection??null,alerts:[...document.querySelectorAll('.toast[role="alert"]')].map(alert=>alert.textContent),
    dirty:!!document.querySelector('[aria-label="Unsaved changes"]')}),
});
f.report.seed={file:seedFile,bytes:seedBytes.length,sha256:sha256(seedBytes),authority:'Exact retained original actual Shell W80 Wall3'};
f.report.projectName=projectName;
if(continuationFile)f.report.continuation={file:continuationFile,bytes:continuationBytes.length,sha256:sha256(continuationBytes),nativeMappingFile:continuationReadFile,authority:'Exact actual Studio01 Hole-row source and retained native packet; three prefix bindings remain original-source evidence, not replayed GUI creation'};
let projectCreated=false,authoredA=null,referenceAnchors=null;const nativeCache=new Map(),labels=new Set();
const capture=async label=>{assert.ok(!labels.has(label));labels.add(label);const state=await f.snapshot(label);await writeFile(join(output,`${label}-actual.bcad`),state.documentJSON);return state;};
function invariant(doc,{width,wall,copies},phase){
  assert.equal(doc.format,seedDoc.format);assert.equal(doc.schema,seedDoc.schema);assert.equal(doc.units,'mm');assert.deepEqual(doc.parameters,{});
  const sk=doc.nodes[0];assert.equal(sk.kind,'sketch');assert.equal(sk.profile,'rectangle');assert.equal(sk.id,'n0');
  assert.deepEqual(sk.min,[-20,-20]);assert.deepEqual(sk.max,[width-20,20]);assert.deepEqual(sk.outline.lengths,{'0':width,'1':40});
  assert.deepEqual(sk.outline.hv,seedDoc.nodes[0].outline.hv);assert.deepEqual(sk.sideTags,seedDoc.nodes[0].sideTags);
  assert.deepEqual(doc.nodes[1],seedDoc.nodes[1]);assert.deepEqual(doc.nodes[2],{...seedDoc.nodes[2],thickness:wall});
  const rail=doc.nodes[3],pull=doc.nodes[4],{sideTags,...railFields}=rail;assert.deepEqual(railFields,{kind:'sketch',profile:'rectangle',min:[0,-3],max:[30,3],id:'n3'});
  if(sideTags!==undefined)assert.deepEqual(sideTags,{outer:['e1','e2','e3','e4']});
  assert.equal(pull.kind,'extrude');assert.equal(pull.id,'n4');assert.equal(pull.sketch,3);assert.equal(pull.height,5);assert.equal(pull.from,1);
  assert.equal(pull.made?.command,'box','actual public Box provenance retained');
  for(const [key,value]of Object.entries({w:30,d:6,h:5,x:0,y:-3,z:1})){const actual=pull.made.values[key];assert.ok(typeof actual==='number'||typeof actual==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(actual));assert.ok(Number.isFinite(Number(actual)));assert.equal(Number(actual),value);}
  assert.ok(pull.made.values.up===undefined||pull.made.values.up==='+z','upright public Box');
  if(phase!=='railNew')assert.deepEqual(doc.nodes[5],{kind:'union',left:{node:2,side:'solid'},right:{node:4,side:'solid'},id:'n5'});
  if(phase==='HoleRow'||phase==='finish'){
    const h=doc.nodes[6];assert.equal(h.kind,'hole');assert.equal(h.id,'n6');assert.deepEqual(h.parent,{node:5,side:'solid'});
    assert.equal(h.radius,1);assert.deepEqual(h.center,[5,0]);assert.deepEqual(h.pattern,{count:copies,step:[10,0]});assert.equal(h.face,'n4.top');
  }
  if(phase==='finish'){
    assert.equal(doc.nodes.length,8);const finish=doc.nodes[7];assert.equal(finish.kind,'fillet');assert.equal(finish.radius,1);assert.equal(finish.id,'n7');assert.deepEqual(finish.parent,{node:6,side:'solid'});
    if(authoredA){
      assert.deepEqual(doc.nodes.slice(3,6),authoredA.nodes.slice(3,6),'actual rail provenance and ordered Union unchanged');
      assert.deepEqual(doc.nodes[6],{...authoredA.nodes[6],pattern:{...authoredA.nodes[6].pattern,count:copies}},'only intended row count changes');
      assert.deepEqual(finish,authoredA.nodes[7],'downstream finish IDs/references/signatures unchanged');
    }
  }
  assert.equal(doc.nextId,doc.nodes.length);
}
const qualify=async(label,expectedDoc,parameters,phase='finish')=>{
  f.phase=label;await f.same(expectedDoc);await f.ready();const state=await capture(label),key=sha256(state.documentJSON),previous=nativeCache.get(key);
  const read=previous?.read??await f.inspect(`${label}-native`,state.doc,{label,phase,parameters});
  f.report.reads.push({label,read,parameters,phase,exactWholeDocSha256:key,reusedFrom:previous?.label??null});
  const input={doc:state.doc,expectedDoc,seedDoc,read,consumer:state,parameters,referenceAnchors,documentJSON:state.documentJSON};
  await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
  const run=spawnSync('python3',['-I',join(output,'enclosure-baseline-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:64*1024*1024});
  await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');
  let parsed=null;try{parsed=JSON.parse(run.stdout??'');}catch{/* Preserve original malformed result before assertions. */}
  f.report.oracles.push({label,exit:run.status,signal:run.signal,stdout:parsed,stderr:run.stderr,reusedNativeFrom:previous?.label??null});await f.persist();
  assert.equal(run.error,undefined);assert.equal(run.status,0,run.stderr);assert.equal(parsed?.status,'PASS_ONE_DECLARED_D539_ENCLOSURE_STATE');
  invariant(state.doc,parameters,phase);assert.deepEqual(state.doc,expectedDoc);assert.equal(state.rootFresh,true);assert.equal(state.worker.fresh,true);assert.equal(state.worker.massReady,true);
  if(!previous)nativeCache.set(key,{label,read});return {state,read};
};

// Existing D448/D538 bounded real pointer helpers; never modify selection or Doc.
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
// Read-only wire journal on the actual existing engine Worker. Only the forwarding
// postMessage wrapper changes; payloads, transfer arguments and listeners stay intact.
let journalWorker=null;
async function installWorkerJournal(){
  const workers=f.page.workers().filter(worker=>worker.url().includes('/engine.worker.ts'));
  assert.equal(workers.length,1,'One actual engine Worker for passive request custody');journalWorker=workers[0];
  await journalWorker.evaluate(()=>{
    if(globalThis.__d539RequestJournal)throw new Error('Unexpected existing D539 Worker journal');
    const original=self.postMessage,ownDescriptor=Object.getOwnPropertyDescriptor(self,'postMessage');
    const state={nodes:new Map(),requests:[],failures:[],errors:[],observedRequests:0};
    const unpack=wire=>{
      if(!wire||!Array.isArray(wire.ids)||!Array.isArray(wire.added)||!wire.doc)throw new Error('Unknown WireDoc shape');
      for(const [id,node]of wire.added)state.nodes.set(id,structuredClone(node));
      const nodes=wire.ids.map(id=>{if(!state.nodes.has(id))throw new Error(`Unobserved prior Worker node ID ${id}`);return structuredClone(state.nodes.get(id));});
      if(wire.bearingContext)throw new Error('Unexpected bearing-context materialization in plain enclosure journal');
      // WireReceiver registers shopRows as side-channel provenance; it does not
      // change the JSON Doc. Keep the original wire packet, including that field.
      return {...structuredClone(wire.doc),nodes};
    };
    const incoming=event=>{
      const request=event.data;if(!request?.doc)return;
      try{
        const doc=unpack(request.doc);if(request.base)unpack(request.base);if(request.proposed)unpack(request.proposed);state.observedRequests++;
        if(request.type==='evaluate'&&doc.nodes.length===8&&doc.nodes[0]?.kind==='sketch'&&doc.nodes[0].outline?.lengths?.[0]===4){
          state.requests.push({type:request.type,id:request.id,revision:request.revision,nativeSource:structuredClone(request.nativeSource),wire:structuredClone(request.doc),doc,
            authority:'EXACT_EVALUATION_DOC_MATERIALIZED_FROM_ACTUALLY_OBSERVED_WIRE_ADDED_IDS_NO_POSITIONAL_FALLBACK'});
        }
      }catch(error){state.errors.push({requestId:request.id,type:request.type,message:String(error?.message??error)});}
    };
    const forwarding=function(...args){
      try{const message=args[0];if(message?.result?.ok===false)state.failures.push({id:message.id,result:structuredClone(message.result)});}
      catch(error){state.errors.push({operation:'observe-postMessage',message:String(error?.message??error)});}
      return Reflect.apply(original,this,args);
    };
    self.addEventListener('message',incoming);self.postMessage=forwarding;
    globalThis.__d539RequestJournal={state,original,ownDescriptor,incoming,forwarding};
  });
  f.report.observations.push({label:'passive-actual-Worker-journal-installed-before-seed-Open',workerURL:journalWorker.url(),unknownIdsPolicy:'FAIL_NO_POSITIONAL_FALLBACK'});
}
async function restoreWorkerJournal(){
  if(!journalWorker)return null;const worker=journalWorker;journalWorker=null;
  const result=await worker.evaluate(()=>{
    const journal=globalThis.__d539RequestJournal;if(!journal)throw new Error('D539 journal missing before restoration');
    const owned=self.postMessage===journal.forwarding;self.removeEventListener('message',journal.incoming);
    if(owned){if(journal.ownDescriptor)Object.defineProperty(self,'postMessage',journal.ownDescriptor);else delete self.postMessage;}
    const restored=self.postMessage===journal.original;
    const result={requests:journal.state.requests,failures:journal.state.failures,errors:journal.state.errors,observedRequests:journal.state.observedRequests,ownedWrapperAtRestore:owned,wrapperRestored:restored};
    delete globalThis.__d539RequestJournal;return result;
  });
  f.report.workerJournal=result;await writeFile(join(output,'18-actual-Worker-refusal-journal.json'),JSON.stringify(result,null,2));await f.persist();return result;
}

const Aparams={width:80,wall:2,copies:3},Bparams={width:90,wall:2,copies:3},Cparams={width:90,wall:3,copies:3},Dparams={width:90,wall:3,copies:2};
async function numericEdit(index,label,value,previous,tag){
  f.phase=tag;await f.closeEditor();await f.openFeatureEditor(index,tag);
  const field=f.editor().getByLabel(label,{exact:true});await field.fill(String(value));
  await capture(`${tag}-typed-before-Apply`);assert.deepEqual(await f.doc(),previous,'NodeEditor local draft does not commit');
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();await f.changed(previous);
  const state=await capture(`${tag}-actual-accepted-before-assert`);await f.closeEditor();return state.doc;
}
async function makeRail(base){
  f.phase='01-public-Box-rail-New';await f.closeEditor();await f.page.keyboard.press('Escape');await clickModelCommand(f.page,'Shapes','Box');
  const hud=f.page.getByRole('dialog',{name:'Box',exact:true});await hud.waitFor();
  for(const [label,value]of [['Width X',30],['Depth Y',6],['Height Z',5],['At X',0],['At Y',-3],['At Z',1]])await hud.getByLabel(label,{exact:true}).fill(String(value));
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});
  await capture('01-Box-rail-typed-preview-before-Apply');
  assert.equal(await hud.getByLabel('Operation',{exact:true}).count(),0,'Box inherently creates a separate body');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(base);await hud.waitFor({state:'hidden'});
  const state=await capture('02-actual-rail-New-two-outputs-before-assert');assert.equal(state.worker.bodies.length,2);
  return state.doc;
}
async function unionRail(rail){
  f.phase='04-real-ordered-Shell-then-Rail-Union';await f.ready();const bodies=(await f.bodies()).bodies;
  const shell=bodies.findIndex(body=>body.key==='b2'),mount=bodies.findIndex(body=>body.key==='b4');assert.ok(shell>=0&&mount>=0&&shell!==mount);
  const rows=f.page.locator('.outliner .ol-row > button.ol');assert.equal(await rows.count(),2);
  await rows.nth(shell).click();await rows.nth(mount).click({modifiers:['Shift']});await capture('04-real-ordered-two-body-selection');
  assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.bodies),[shell,mount]);
  await clickModelCommand(f.page,'Combine','Union');await f.changed(rail);const state=await capture('05-actual-Union-before-assert');return state.doc;
}
async function holeRow(union,top){
  f.phase='07-real-positive-Z-railTop-Through-Hole-row';assert.ok(top&&Number.isInteger(top.index)&&top.nativeNames?.includes('n4.top'));
  f.report.observations.push({label:'actual-current-rail-top-target-before-pick',target:top});
  await f.page.keyboard.press('Escape');await publicView(f,'Top');await selectionFilter(f,'Faces');
  assert.equal(await frameQualified3D(f,[top]),true);await f.page.mouse.click(...await projected(f,top.world));
  await capture('07-real-rail-top-face-selected-before-assert');
  assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.faces),[{body:0,face:top.index}]);
  await clickModelCommand(f.page,'Create','Hole');const hud=f.page.getByRole('dialog',{name:'Hole',exact:true});await hud.waitFor();
  await hud.getByLabel('Type',{exact:true}).selectOption('through');await hud.getByLabel('Copies',{exact:true}).selectOption('row');
  for(const [label,value]of [['Diameter',2],['Count',3],['Step X',10],['Step Y',0],['Centre X',5],['Centre Y',0]])await hud.getByLabel(label,{exact:true}).fill(String(value));
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});await capture('08-Through-Hole-row-typed-preview');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(union);await hud.waitFor({state:'hidden'});
  const actual=await capture('09-actual-Hole-row-before-assert');assert.equal(actual.doc.nodes[6].face,top.nativeName.split('+')[0]);return actual.doc;
}
async function cornerFinish(holes,targets){
  f.phase='11-real-four-outer-vertical-R1';assert.equal(targets.length,4);assert.equal(new Set(targets.map(t=>t.index)).size,4);
  await f.page.keyboard.press('Escape');await publicView(f,'Iso');await selectionFilter(f,'Edges');
  const expected=[];
  for(let i=0;i<targets.length;i++){
    const target=targets[i],pixel=await visibleEdge(f,target,targets);
    if(i===0&&continuationFile){
      const current=f.report.observations.findLast(item=>item.label==='real-edge-visibility'),observed=current.attempts.at(-1);
      const original={world:[60,-20,5],pixel:[707.3480131918337,584.1737160095995],eye:[147.64002129424364,-201.12849040075747,178.07067249112268],body:0,edge:1};
      assert.deepEqual(target.world,original.world);assert.equal(target.index,original.edge);
      f.report.observations.push({label:'first-corner-original-failure-camera-comparison-before-real-click',originalEvidence:'/tmp/barocss-d539-studio01/receipt.json:real-edge-visibility',original,
        current:{world:target.world,pixel:observed.pixel,eye:observed.eye,hit:observed.hit},
        pixelDistance:Math.hypot(observed.pixel[0]-original.pixel[0],observed.pixel[1]-original.pixel[1]),
        maximumEyeComponentDifference:Math.max(...observed.eye.map((value,index)=>Math.abs(value-original.eye[index]))),authority:'Root compares original/current camera and real pointer; no camera or selection injection'});
      await f.persist();
    }
    f.report.observations.push({label:`original-current-corner-${i+1}-before-pick`,target});
    if(i)await f.page.keyboard.down('Shift');try{await f.page.mouse.click(...pixel);}finally{if(i)await f.page.keyboard.up('Shift');}
    expected.push({body:0,edge:target.index});await capture(`11-real-corner-pick-${i+1}-before-assert`);
    assert.deepEqual(await f.page.evaluate(()=>window.__studioSelection.selection.edges),expected);
  }
  await clickModelCommand(f.page,'Modify','Fillet');const hud=f.page.getByRole('dialog',{name:'Fillet',exact:true});await hud.waitFor();
  await hud.getByLabel('Fillet type',{exact:true}).selectOption('edge');await hud.getByLabel('Fillet radius mode',{exact:true}).selectOption('constant');
  await hud.getByLabel('Radius',{exact:true}).fill('1');await hud.getByLabel('Section',{exact:true}).selectOption('circular');
  await f.page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});await capture('12-four-R1-typed-preview');
  await hud.getByRole('button',{name:'Apply',exact:true}).click();await f.changed(holes);await hud.waitFor({state:'hidden'});
  const state=await capture('13-actual-finish-A-before-assert');assert.deepEqual(new Set(state.doc.nodes[7].edges),new Set(targets.flatMap(target=>target.nativeNames)));
  authoredA=state.doc;referenceAnchors=structuredClone(state.doc.nodes[7].sigs);return state.doc;
}
async function refusedCollapse(C,acceptedC){
  f.phase='17-source-Width4-Wall3-NodeEditor-Apply';await f.openFeatureEditor(1,'17-invalid-width4');
  await f.editor().getByLabel('Width',{exact:true}).fill('4');await capture('17-invalid-Width4-local-before-Apply');
  await f.editor().getByRole('button',{name:'Apply',exact:true}).click();
  const notice=f.editor().getByRole('status').filter({has: f.page.getByText('Kernel detail',{exact:true})});
  await notice.getByText('Kernel detail',{exact:true}).click();
  await notice.getByText(/leaves no hollow/i).waitFor();
  const reason=await notice.innerText();const refused=await capture('18-invalid-Width4-refused-before-assert');
  assert.match(reason,/leaves no hollow/i);assert.deepEqual(refused.doc,C);assert.deepEqual(refused.worker.bodies,acceptedC.worker.bodies);assert.deepEqual(refused.historyRows,acceptedC.historyRows);
  const journal=await restoreWorkerJournal();assert.deepEqual(journal.errors,[]);assert.equal(journal.ownedWrapperAtRestore,true);assert.equal(journal.wrapperRestored,true);
  assert.equal(journal.requests.length,1,'Exactly one actual Width4 evaluate request');const request=journal.requests[0];
  const replies=journal.failures.filter(reply=>reply.id===request.id);assert.equal(replies.length,1,'Failure reply matches exact actual evaluate request ID');
  const response=replies[0];assert.equal(response.result.ok,false);assert.equal(response.result.error.code,'PARAMETER');assert.match(response.result.error.detail,/leaves no hollow/i);
  assert.equal(request.doc.nodes[0].outline.lengths[0],4);assert.equal(request.doc.nodes[2].thickness,3);
  assert.deepEqual(request.doc.nodes.slice(1),C.nodes.slice(1),'Actual rejected Worker source keeps accepted downstream nodes/provenance');
  assert.deepEqual(request.doc.outputs,C.outputs);assert.deepEqual(request.doc.parameters,C.parameters);
  await writeFile(join(output,'18-actual-rejected-Worker-evaluation-doc.bcad'),JSON.stringify(request.doc));
  const native=await f.inspect('18-separate-native-exact-rejected-Worker-doc',request.doc,{label:'18-exact-Worker-rejected-source',phase:'refusedWidth4',parameters:Cparams});
  await writeFile(join(output,'18-separate-native-refusal.json'),JSON.stringify(native,null,2));
  assert.equal(native.documentJSON,JSON.stringify(request.doc));assert.equal(native.documentSHA256,sha256(JSON.stringify(request.doc)));assert.equal(native.inputUnchanged,true);
  assert.equal(native.ok,false);assert.equal(native.error.code,'PARAMETER');assert.equal(native.error.feature,'n2');assert.match(native.error.message,/leaves no hollow/i);
  f.report.observations.push({label:'actual-NodeEditor-Width4-refusal',actualReason:reason,actualWorkerCode:response.result.error.code,actualWorkerRequestId:request.id,
    requestDocAuthority:request.authority,requestDocKind:'Worker evaluatedPart JSON; stripped nextId is not a saved project Doc',requestDocSha256:sha256(JSON.stringify(request.doc)),nativeRefusalFile:'18-separate-native-refusal.json',separateNativeFeature:native.error.feature,separateNativeAuthority:'Separate native evaluation of exact journal-materialized rejected Worker Doc; Worker FriendlyError itself exposes no feature',
    acceptedDocRetained:true,acceptedBodyRetained:true,historyRetained:true});
  await f.closeEditor();await f.dismissToasts();await f.same(C);await qualify('19-refusal-retains-C',C,Cparams);
}
async function versions(){
  await f.closeEditor();await f.page.getByRole('button',{name:'Model',exact:true}).click();const card=f.page.getByLabel('Versions panel',{exact:true});
  if(!await card.isVisible())await f.page.getByRole('button',{name:'Project and versions',exact:true}).click();await card.waitFor();return card;
}
async function saveReopen(C){
  f.phase='22-own-project-Save-C';let card=await versions();
  const absent=await f.page.evaluate(async name=>{
    const root=await navigator.storage.getDirectory();try{const projects=await root.getDirectoryHandle('projects');await projects.getDirectoryHandle(name);return false;}
    catch(error){if(error.name==='NotFoundError')return true;throw error;}
  },projectName);assert.equal(absent,true,'Never overwrite an existing project');
  await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();
  await card.getByLabel('Project',{exact:true}).waitFor();projectCreated=true;await f.page.locator('.doc-tab input').fill(partName);
  await f.page.getByRole('button',{name:'Save',exact:true}).click();await f.page.getByLabel('Unsaved changes',{exact:true}).waitFor({state:'detached'});
  await card.locator('[aria-label="Project documents"] li[data-active="true"]').filter({hasText:`${partName}.bcad`}).waitFor();
  const saved=await f.page.evaluate(async({projectName,partName})=>{
    const root=await navigator.storage.getDirectory(),project=await(await root.getDirectoryHandle('projects')).getDirectoryHandle(projectName);
    const file=await(await project.getFileHandle(`${partName}.bcad`)).getFile();return {text:await file.text(),size:file.size};
  },{projectName,partName});
  await writeFile(join(output,'22-own-project-saved-C.bcad'),saved.text);assert.deepEqual(JSON.parse(saved.text),C);
  f.report.ownedSave={namespace:`projects/${projectName}`,path:`${partName}.bcad`,bytes:saved.size,sha256:sha256(saved.text),exactAcceptedDoc:true};
  await qualify('22-own-project-Save-exact-C',C,Cparams);
  const context=f.context,page=f.page;await card.getByRole('button',{name:'Close project',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor({state:'detached'});
  await page.reload();assert.equal(f.context,context);assert.equal(page.context(),context);await page.waitForSelector('.viewport[data-renderer="webgpu"]');await f.ready();
  card=await versions();await card.getByLabel('Browser project name',{exact:true}).fill(projectName);await card.getByRole('button',{name:'Project in this browser',exact:true}).click();await card.getByLabel('Project',{exact:true}).waitFor();
  await card.getByRole('button',{name:`Open ${partName}.bcad`,exact:true}).click();await f.same(C);await f.ready();await qualify('23-project-Open-exact-C',C,Cparams);
}
await f.run(async()=>{
  await f.newPage();await f.page.setViewportSize({width:1440,height:900});
  try{
    await installWorkerJournal();
    let holes,holeRead;
    if(continuationFile){
      await f.page.setInputFiles('input[aria-label="Model file"]',continuationFile);await f.same(continuationDoc);await f.ready();
      const initial=await capture('10-continuation-exact-actual-Hole-row-antecedent');
      invariant(initial.doc,Aparams,'HoleRow');holes=initial.doc;holeRead={read:continuationRead};
      f.report.observations.push({label:'first-corner-repeats-failed-world-and-framing',target:continuationRead.display.corners[0],framing:'Same public Iso/Frame-all and unchanged bounded real visibleEdge helper at1440x900; no alternative pointer point'});
    }else{
      await f.page.setInputFiles('input[aria-label="Model file"]',seedFile);await f.same(seedDoc);await f.ready();await capture('00-original-Shell-W80-Wall3-antecedent');
      const base=await numericEdit(2,'Wall',2,seedDoc,'00-setup-Wall2');assert.deepEqual(base,{...seedDoc,nodes:seedDoc.nodes.map((node,i)=>i===2?{...node,thickness:2}:node)});
      const rail=await makeRail(base);await qualify('03-rail-New-two-live-outputs',rail,Aparams,'railNew');
      const united=await unionRail(rail),unionRead=await qualify('06-actual-Union',united,Aparams,'union');
      holes=await holeRow(united,unionRead.read.display.railTop);holeRead=await qualify('10-actual-Hole-row',holes,Aparams,'HoleRow');
    }
    const A=await cornerFinish(holes,holeRead.read.display.corners);await qualify('14-finish-A-W80-Wall2-count3',A,Aparams);
    const B=await numericEdit(1,'Width',90,A,'15-upstream-Width90');await qualify('15-accepted-B-W90-Wall2-count3',B,Bparams);
    const C=await numericEdit(2,'Wall',3,B,'16-upstream-Wall3'),acceptedC=await qualify('16-accepted-C-W90-Wall3-count3',C,Cparams);
    await refusedCollapse(C,acceptedC.state);
    // Failed numeric draft was closed. This is the FIRST document Undo after the refused Apply.
    await f.undo();await f.same(B);await qualify('20-FIRST-document-Undo-exact-B',B,Bparams);
    await f.redo();await f.same(C);await qualify('21-Redo-exact-C',C,Cparams);
    await saveReopen(C);
    const D=await numericEdit(6,'Copies',2,C,'24-postOpen-Copies2');await qualify('25-postOpen-D-W90-Wall3-count2',D,Dparams);
    assert.equal(f.report.reads.length,continuationFile?9:12,'Continuation covers nine remaining bindings; full flow covers twelve');assert.deepEqual(f.report.downloads,[]);
    f.report.nativeCaptures=nativeCache.size;f.report.currentWorkerBindings=f.report.reads.length;f.report.exactWholeDocNativeReuses=f.report.reads.filter(read=>read.reusedFrom!==null).length;
  }finally{
    if(journalWorker){try{await restoreWorkerJournal();}catch(error){f.report.cleanup.push({workerJournalRestoreError:String(error?.message??error)});await f.persist();}}
    if(projectCreated){const cleanup={ownedProject:projectName};try{
      const card=await versions(),close=card.getByRole('button',{name:'Close project',exact:true});if(await close.count())await close.click();
      cleanup.namespace=await f.page.evaluate(async name=>{
        const root=await navigator.storage.getDirectory(),projects=await root.getDirectoryHandle('projects');await projects.removeEntry(name,{recursive:true});
        try{await projects.getDirectoryHandle(name);return 'STILL_PRESENT';}catch(error){if(error.name==='NotFoundError')return 'REMOVED_AND_ABSENT';throw error;}
      },projectName);assert.equal(cleanup.namespace,'REMOVED_AND_ABSENT');
    }finally{f.report.cleanup.push(cleanup);await f.persist();}}
  }
});
