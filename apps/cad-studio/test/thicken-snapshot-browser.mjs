// D338: source preparation only until the root freezes all writers.
// D338_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/thicken-snapshot-browser.mjs /absolute/artifacts
// One Chrome WebGPU process; serial fresh contexts. UI writes; window hooks only observe.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createServer } from 'vite';

assert.equal(process.env.D338_SOURCE_FROZEN, '1', 'Root must freeze and qualify source before D338 execution');
assert.ok(process.env.PW_DIR && process.env.CHROME && process.argv[2], 'PW_DIR, CHROME and artifact directory are required');
const app = resolve(import.meta.dirname, '..'), repo = resolve(app, '../..'), output = resolve(process.argv[2]);
await mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { status:'RUNNING', backend:'webgpu', states:[], refusals:[], geometry:[], files:[], downloads:[], errors:[], consoleErrors:[], changes:[], cleanup:[],
  limits:['Preview proof is shown mesh volume and HUD status; accepted native mass is separate.',
    'The flat profile has an independent analytic oracle. Curved fold refusal makes no curved mass claim.',
    'Native save semantic equality is checked. Hashes prove provenance, not geometry or byte identity.'] };
let phase = 'public seed preparation', server, browser, context, page, inspectorBundle;
const persist = () => writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const surface = {degreeU:1,degreeV:1,knotsU:[-2,-2,6,6],knotsV:[1,1,7,7],controlPoints:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]],weights:[[1,1],[1,1]]};
const fixtureCSS = `@model d338 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3],[25,-1,3],[25,9,3],[15,9,3],[15,-1,3]]; weights:[1,1,1,1,1]; }
 @surface #fold { type:nurbs; degree-u:2; degree-v:1; knots-u:[0,0,0,1,1,1]; knots-v:[0,0,1,1]; control-points:[[[10,0,0],[10,10,0]],[[10,0,10],[10,10,10]],[[0,0,10],[0,10,10]]]; weights:[[1,1],[${Math.SQRT1_2},${Math.SQRT1_2}],[1,1]]; }
}`;
const generator = `import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {part,param} from '../../packages/barocss-cad-model/src/api/index.ts';
import {emptyDirect,importSource} from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness=part('D338 witness').parameter('wall',2).box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.ok(Math.abs(witness.mass({density:1}).volume-420)<1e-7);
const direct=importSource(emptyDirect(),${JSON.stringify(fixtureCSS)},'D338');
assert.ok(direct.objects.every(o=>!o.trims));
const ui={...witness.doc,direct};
const api=part('D338 public facade',ui).thicken(${JSON.stringify(surface)},{t:param('wall')});
assert.equal(api.bodies().length,2);
writeFileSync(process.argv[2],JSON.stringify(ui,null,2)+'\\n');
writeFileSync(process.argv[3],JSON.stringify(api.doc,null,2)+'\\n');`;
// Public native-document reading only. No private geometry construction or injected mutation.
const inspector = `import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')), p=part('D338 native read',doc);
const breps=partBreps(doc), meshes=p.meshes();
const result=p.bodies().map(key=>{
 const b=breps.find(x=>x.key===key).brep, mesh=meshes.find(x=>x.key===key);
 const check=checkBrep(b); assert.deepEqual(check.issues,[]);
 assert.equal(b.bodies.length,1); assert.equal(b.bodies[0].kind,'solid'); assert.ok(b.shells.every(x=>x.closed));
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let i=0;i<mesh.positions.length;i++) { const k=i%3; bounds.min[k]=Math.min(bounds.min[k],mesh.positions[i]); bounds.max[k]=Math.max(bounds.max[k],mesh.positions[i]); }
 return {key,mass:p.body(key).mass({density:1}),names:p.body(key).select().faces().names().sort(),faces:p.body(key).select().faces().list(),bounds,closed:true,valid:true,issues:check.issues};
});
console.log(JSON.stringify(result));`;
const doc = () => page.evaluate(()=>window.__studioDoc);
const panel = () => page.getByRole('complementary',{name:'Direct geometry',exact:true});
const hud = () => page.getByRole('dialog',{name:'Thicken',exact:true});
const editor = () => page.locator('.node-editor');
const byId = (state,id) => state.direct.objects.find(o=>o.id===id);
function close(actual,expected,label) { assert.ok(Math.abs(actual-expected)<=1e-7,`${label}: ${actual} vs ${expected}`); }
async function ready(expectedCount=null) {
 await page.waitForFunction(count=>{const s=window.__studioBodies?.();return window.__studioFresh===true&&s?.fresh&&s.massReady&&(count===null||s.bodies.length===count);},expectedCount,{timeout:60000});
}
async function same(expected) {
 await page.waitForFunction(value=>JSON.stringify(window.__studioDoc)===value,JSON.stringify(expected),{timeout:60000});
 await ready(); assert.deepEqual(await doc(),expected);
}
async function changed(before) {
 await page.waitForFunction(value=>JSON.stringify(window.__studioDoc)!==value,JSON.stringify(before),{timeout:60000}); await ready();
}
async function snapshot(label) {
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=await page.evaluate(label=>({label,doc:window.__studioDoc,bodies:window.__studioBodies?.(),shown:window.__studioSection?.(),selection:window.__studioSelection,
  directSelection:[...document.querySelectorAll('.ol.direct.sel')].map(x=>x.textContent),hud:document.querySelector('.hud')?.textContent??null,hudStatus:document.querySelector('.hud .status')?.textContent??null,
  editor:document.querySelector('.node-editor')?.textContent??null,feedback:[...document.querySelectorAll('.toast')].map(x=>x.textContent)}),label);
 report.states.push(state); await writeFile(join(output,`${label}.json`),JSON.stringify(state,null,2));
 await writeFile(join(output,`${label}.html`),await page.content()); await page.screenshot({path:join(output,`${label}.png`),fullPage:true}); await persist(); return state;
}
async function freshPage() {
 if(context) {await context.close(); report.cleanup.push('CONTEXT_CLOSED');}
 context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1}); page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.stack??String(e)));
 page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
 page.on('download',d=>report.downloads.push({phase,suggestedFilename:d.suggestedFilename()})); page.on('dialog',d=>d.accept());
 await page.goto(server.resolvedUrls.local[0]); await page.waitForSelector('.viewport[data-renderer="webgpu"]',{timeout:30000}); await ready();
}
async function freshOpen(saved,label) {
 phase=`fresh Open ${label}`; await freshPage(); await page.setInputFiles('input[aria-label="Model file"]',saved.file); await same(saved.doc); return snapshot(label);
}
async function select(id,shift=false) {
 const object=byId(await doc(),id); assert.ok(object&&!object.hidden);
 const escaped=object.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const row=page.locator('.ol.direct').filter({hasText:new RegExp(`${escaped}$`)}); assert.equal(await row.count(),1);
 await row.click({modifiers:shift?['Shift']:[]}); await panel().waitFor();
}
async function openThicken(id,t=2,side='normal') {
 await select(id); await panel().getByLabel('Thickness',{exact:true}).fill(String(t));
 await panel().getByLabel('Thicken side',{exact:true}).selectOption(side);
 await panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(); await hud().waitFor();
 assert.equal(await hud().getByLabel('Thickness',{exact:true}).inputValue(),String(t));
 assert.equal(await hud().getByLabel('Side',{exact:true}).inputValue(),side);
}
async function preview(original,label) {
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});
 await page.waitForFunction(()=>Math.abs((window.__studioSection?.().shownVolume??0)-2820)<1e-7,null,{timeout:60000});
 assert.deepEqual(await doc(),original,'Preview preserves accepted document');
 const state=await snapshot(label); close(state.shown.shownVolume-420,2400,'Actual preview plate mesh volume');
 assert.equal(state.bodies.bodies.length,1,'Preview does not replace accepted mass'); close(state.bodies.bodies[0].volume,420,'Accepted witness during preview');
}
async function save(label) {
 phase=`native Save ${label}`; await ready(); const before=await doc();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save',exact:true}).click()]);
 const file=join(output,`${label}.bcad`); await download.saveAs(file); const bytes=await readFile(file); assert.deepEqual(JSON.parse(bytes),before);
 report.files.push({file,sha256:hash(bytes),semanticEquality:true,byteIdentityClaim:false}); return {file,doc:before};
}
async function geometry(label,expectedVolume=2400,z=4,zmin=3,zmax=5,expectedNames=null) {
 const current=await doc(), file=join(output,`${label}-native-read.bcad`); await writeFile(file,JSON.stringify(current));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:8*1024*1024});
 await writeFile(join(output,`${label}-geometry.stderr.txt`),run.stderr??''); assert.equal(run.status,0,run.stderr);
 const bodies=JSON.parse(run.stdout); assert.equal(bodies.length,2);
 const witness=bodies.find(b=>Math.abs(b.mass.volume-420)<1e-7), plate=bodies.find(b=>b!==witness); assert.ok(witness&&plate);
 close(witness.mass.volume,420,'Witness volume'); witness.mass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));
 report.witness??={key:witness.key,names:witness.names}; assert.deepEqual({key:witness.key,names:witness.names},report.witness);
 close(plate.mass.volume,expectedVolume,'Plate volume'); plate.mass.centroid.forEach((v,i)=>close(v,[30,9,z][i],'Plate centroid'));
 for(const [kind,want] of [['min',[10,-6,zmin]],['max',[50,24,zmax]]])plate.bounds[kind].forEach((v,i)=>close(v,want[i],`Plate ${kind} ${i}`));
 assert.ok(plate.names.length>0); assert.equal(new Set(plate.names).size,plate.names.length); assert.ok(plate.names.every(n=>/\.facet\d+$/.test(n)));
 if(expectedNames)assert.deepEqual(plate.names,expectedNames);
 const result={label,bodies,tolerance:1e-7,route:'Public Model Part mass/faces/meshes and native partBreps/checkBrep read'};
 report.geometry.push(result); await writeFile(join(output,`${label}-geometry.json`),JSON.stringify(result,null,2)); await persist(); return plate;
}
async function historyEdit(index,label,value) {
 await page.locator(`.history .hs[data-node-index="${index}"]`).click(); await editor().waitFor();
 const control=editor().getByLabel(label,{exact:true}); if(label==='Side')await control.selectOption(value); else await control.fill(String(value));
 const before=await doc(); await editor().getByRole('button',{name:'Apply',exact:true}).click(); await changed(before); await editor().waitFor({state:'hidden'});
}
async function undo(expected,label) {phase=label; await page.keyboard.press('Meta+z'); await same(expected); return snapshot(label);}
async function redo(expected,label) {phase=label; await page.keyboard.press('Meta+Shift+z'); await same(expected); return snapshot(label);}
const inputs=['apps/cad-studio/test/thicken-snapshot-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/DirectInspector.tsx','apps/cad-studio/src/ui/DirectPanel.tsx',
 'apps/cad-studio/src/state/useCommandPreview.ts','apps/cad-studio/vite.config.ts','packages/barocss-cad/src/api/spec.ts','packages/barocss-cad/src/api/part.ts','packages/barocss-cad/src/api/kernel.ts',
 'packages/barocss-cad/src/api/surface-snapshot.ts','packages/barocss-cad/src/brep/thicken-solid.ts','packages/barocss-cad/src/blend/offset-cavity.ts',
 'packages/barocss-cad-model/src/engine/thicken.ts','packages/barocss-cad-model/src/app/thickenCommand.ts','packages/barocss-cad-model/src/app/commands.ts',
 'packages/barocss-cad-model/src/api/studio.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/chat/features.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files) {
 const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort(); assert.ok(names.length<=4096);
 const hashes={}; for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));
 await writeFile(join(output,`source-${label}.json`),JSON.stringify(hashes,null,2)); return hashes;
}
let frozenFiles=inputs;
try {
 report.sourceBefore=await capsule('before-generation',inputs);
 for(const name of ['independent-oracle.py','independent-oracle.json']) {const bytes=await readFile(`/tmp/d338-plan/${name}`); await writeFile(join(output,name),bytes);}
 const buildInputs=[];
 async function compile(label,contents) {
  const sourcefile=`d338-${label}.ts`, virtual=resolve(app,sourcefile);
  const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});
  await writeFile(join(output,`${label}.ts`),contents); await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin has no disk file. Its exact contents are saved above and hashed separately.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));
  const file=join(output,`${label}.mjs`); await writeFile(file,built.outputFiles[0].contents);
  report.generatorSources??=[]; report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual}); return file;
 }
 const seedBundle=await compile('seed-generator',generator); inspectorBundle=await compile('native-inspector',inspector);
 const seedFile=join(output,'seed.bcad'), apiFile=join(output,'facade.bcad');
 const run=spawnSync(process.execPath,[seedBundle,seedFile,apiFile],{encoding:'utf8'});
 await writeFile(join(output,'seed.stdout.txt'),run.stdout??''); await writeFile(join(output,'seed.stderr.txt'),run.stderr??''); assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))}, apiSeed={file:apiFile,doc:JSON.parse(await readFile(apiFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs]; report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);
 for(const [file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start'; server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
 server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});}); await server.listen();
 const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
 browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']}); report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-ui-seed');
 phase='actual DirectPanel preview Cancel'; await openThicken('obj_1'); await preview(seed.doc,'02-preview');
 await hud().getByRole('button',{name:'Cancel',exact:true}).click(); await same(seed.doc); await snapshot('03-cancel');
 phase='actual DirectPanel retry Apply'; await openThicken('obj_1'); await preview(seed.doc,'04-retry-preview');
 await hud().getByRole('button',{name:'Apply',exact:true}).click(); await ready(2); const accepted=await doc(), index=accepted.nodes.length-1, node=accepted.nodes[index];
 assert.equal(node.kind,'thicken'); assert.deepEqual(node.surface,surface); assert.equal(node.thickness,2); assert.equal(node.side,undefined); assert.deepEqual(accepted.direct,seed.doc.direct);
 assert.equal(await page.locator('.ol.direct.sel').count(),0,'Successful Apply clears direct selection');
 const plate=await geometry('05-applied'); await snapshot('05-applied');
 await undo(seed.doc,'06-undo'); await redo(accepted,'07-redo'); await geometry('07-redo',2400,4,3,5,plate.names);
 phase='history thickness 3'; await historyEdit(index,'Thickness',3); const edited=await doc(); assert.equal(edited.nodes[index].thickness,3); assert.equal(edited.nodes[index].id,node.id);
 await geometry('08-thickness3',3600,4.5,3,6,plate.names); await snapshot('08-thickness3');
 phase='history Side Both'; await historyEdit(index,'Side','both'); const both=await doc(); assert.equal(both.nodes[index].side,'both'); assert.deepEqual(both.nodes[index].surface,surface); assert.equal(both.nodes[index].id,node.id);
 await geometry('09-both',3600,3,1.5,4.5,plate.names); await snapshot('09-both');
 const saved=await save('ui-accepted'); await freshOpen(saved,'10-ui-fresh-open'); await geometry('10-ui-fresh-open',3600,3,1.5,4.5,plate.names);
 await page.locator(`.history .hs[data-node-index="${index}"]`).click(); assert.equal(await editor().getByLabel('Thickness',{exact:true}).inputValue(),'3'); assert.equal(await editor().getByLabel('Side',{exact:true}).inputValue(),'both');
 await snapshot('11-reeditable'); await editor().getByRole('button',{name:'Close editor',exact:true}).click();
 phase='source move independent snapshot'; await select('obj_1'); await panel().getByLabel('ΔX',{exact:true}).fill('7'); await panel().getByLabel('ΔZ',{exact:true}).fill('5');
 const beforeMove=await doc(); await panel().getByRole('button',{name:'Move',exact:true}).click(); await changed(beforeMove); const moved=await doc(); assert.notDeepEqual(moved.direct,beforeMove.direct); assert.deepEqual(moved.nodes,beforeMove.nodes);
 await geometry('12-source-moved',3600,3,1.5,4.5,plate.names); await snapshot('12-source-moved');
 phase='source deletion independent snapshot'; await select('obj_1'); await page.locator('.ol.direct.sel').click(); await page.keyboard.press('Delete'); await changed(moved); const deleted=await doc(); assert.equal(byId(deleted,'obj_1'),undefined); assert.deepEqual(deleted.nodes,moved.nodes);
 await geometry('13-source-deleted',3600,3,1.5,4.5,plate.names); await snapshot('13-source-deleted');
 // A fresh public seed isolates refusal history. Trim is authored by the actual UI.
 await freshOpen(seed,'14-refusal-seed'); await select('obj_1'); await select('obj_2',true); await panel().getByLabel('Trim keeps',{exact:true}).selectOption('outside');
 await panel().getByRole('button',{name:'Trim by the curve',exact:true}).click(); await changed(seed.doc); const trimmed=await doc(); assert.equal(byId(trimmed,'obj_1').trims[0].uv.length,160);
 await select('obj_1'); const selected=await page.locator('.ol.direct.sel').allTextContents();
 phase='context trimmed refusal'; const refusalDownloads=report.downloads.length; await panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(); await page.locator('.toast[role="alert"]').waitFor();
 assert.match(await page.locator('.toast[role="alert"]').textContent(),/trim|whole surface/i); assert.equal(await hud().count(),0); await same(trimmed); assert.deepEqual(await page.locator('.ol.direct.sel').allTextContents(),selected);
 assert.equal(report.downloads.length,refusalDownloads); report.refusals.push({kind:'trimmed-context',documentUnchanged:true,selectionUnchanged:true,noDownload:true}); await snapshot('15-trimmed-refusal');
 await undo(seed.doc,'16-trim-refusal-no-undo-entry'); await redo(trimmed,'17-trim-redo');
 if(await page.locator('.toast[role="alert"]').count())await page.locator('.toast[role="alert"]').getByRole('button',{name:'Dismiss',exact:true}).click();
 phase='quarter fold refusal'; await openThicken('obj_3',12,'normal'); const foldSelection=await page.locator('.ol.direct.sel').allTextContents();
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='refused',null,{timeout:60000});
 const kernelDetail=hud().getByText('Kernel detail',{exact:true}); if(await kernelDetail.count())await kernelDetail.click();
 assert.match(await hud().textContent(),/OFFSET_FOLDS/); assert.equal(await hud().getByRole('button',{name:'Apply',exact:true}).isDisabled(),true); await same(trimmed);
 assert.deepEqual(await page.locator('.ol.direct.sel').allTextContents(),foldSelection); assert.equal(report.downloads.length,refusalDownloads);
 report.refusals.push({kind:'quarter-fold',diagnostic:'OFFSET_FOLDS',actualHudText:await hud().textContent(),codeEvidence:'Actual displayed diagnostic only; structured facade and raw Core codes are separate focused-test evidence',documentUnchanged:true,selectionUnchanged:true,noDownload:true}); await snapshot('18-fold-refusal');
 await hud().getByRole('button',{name:'Cancel',exact:true}).click(); await undo(seed.doc,'19-fold-no-undo-entry');
 phase='valid flat retry after refusals'; await openThicken('obj_1'); await preview(seed.doc,'20-valid-retry-preview'); await hud().getByRole('button',{name:'Apply',exact:true}).click(); await ready(2); await geometry('21-valid-retry'); await snapshot('21-valid-retry');
 // Separate public facade file proves named t binding and native editable options.
 await freshOpen(apiSeed,'22-public-facade-open'); const apiNode=apiSeed.doc.nodes.at(-1); assert.equal(apiNode.kind,'thicken'); assert.deepEqual(apiNode.surface,surface); assert.deepEqual(apiNode.thickness,{parameter:'wall'});
 const apiPlate=await geometry('22-public-facade-open'); const apiIndex=apiSeed.doc.nodes.length-1;
 await page.locator(`.history .hs[data-node-index="${apiIndex}"]`).click(); assert.equal(await editor().getByLabel('Thickness parameter',{exact:true}).inputValue(),'wall'); assert.equal(await editor().getByLabel('Thickness',{exact:true}).isDisabled(),true); assert.equal(await editor().getByLabel('Side',{exact:true}).inputValue(),'normal');
 await snapshot('23-facade-binding-editor'); await editor().getByRole('button',{name:'Close editor',exact:true}).click();
 const apiSaved=await save('facade-accepted'); await freshOpen(apiSaved,'24-facade-fresh-open'); await geometry('24-facade-fresh-open',2400,4,3,5,apiPlate.names);
 await page.locator(`.history .hs[data-node-index="${apiIndex}"]`).click(); assert.equal(await editor().getByLabel('Thickness parameter',{exact:true}).inputValue(),'wall'); assert.equal(await editor().getByLabel('Side',{exact:true}).inputValue(),'normal'); await snapshot('25-facade-reopen-editor');
 assert.deepEqual(report.errors,[]); assert.deepEqual(report.consoleErrors,[]); assert.deepEqual(report.changes,[]);
 report.sourceAfter=await capsule('after-browser',frozenFiles); assert.deepEqual(report.sourceAfter,report.sourceFrozen); report.status='PASS';
} catch(error) {
 report.status='FAIL'; report.failure=error.stack??String(error); process.exitCode=1;
 if(page)try {await snapshot('failure');} catch(e) {report.captureFailure=e.stack??String(e);}
} finally {
 for(const [resource,label]of [[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]) {if(!resource)continue; try {await resource.close();report.cleanup.push(`${label}_CLOSED`);} catch(e) {report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try {report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles); if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);} catch(e) {report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist(); console.log(JSON.stringify({status:report.status,phase,failure:report.failure,output}));
}
