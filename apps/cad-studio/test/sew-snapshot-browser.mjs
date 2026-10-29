// D339: source preparation only until the root freezes all writers.
// D339_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/sew-snapshot-browser.mjs /absolute/artifacts
// One Chrome process; serial contexts. UI mutates; window hooks only observe.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'vite';
assert.equal(process.env.D339_SOURCE_FROZEN,'1','Root must freeze all writers before D339 execution');
assert.ok(process.env.PW_DIR&&process.env.CHROME&&process.argv[2],'PW_DIR, CHROME and artifact directory required');
const app=resolve(import.meta.dirname,'..'),repo=resolve(app,'../..'),output=resolve(process.argv[2]);
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'RUNNING',backend:'webgpu',states:[],refusals:[],geometry:[],files:[],downloads:[],errors:[],consoleErrors:[],changes:[],cleanup:[],
 limits:['Preview proof is shown mesh volume and HUD status; accepted native mass and centroid are separate.',
 'Six coincident planar surfaces only; no arbitrary curved closure or tolerance repair claim.',
 'Source hashes prove provenance, not geometry. Save semantic equality does not imply raw byte identity.',
 'Tolerance is numeric only. Parameter binding attempts belong to separate focused tests.']};
let phase='public seed preparation',server,browser,context,page,inspectorBundle;
const persist=()=>writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const oracleBytes=await readFile('/tmp/d339-plan/oracle.json'),oracle=JSON.parse(oracleBytes);
const surfaces=oracle.orderedControlPoints.map(controlPoints=>({degreeU:oracle.degreeU,degreeV:oracle.degreeV,knotsU:oracle.knotsU,knotsV:oracle.knotsV,controlPoints,weights:oracle.weights}));
const sourceNames=['bottom','top','ymin','ymax','xmin','xmax'];
const fixtureCSS=`@model d339 { version:0; length-unit:mm;\n${surfaces.map((s,i)=>` @surface #${sourceNames[i]} { type:nurbs; degree-u:${s.degreeU}; degree-v:${s.degreeV}; knots-u:${JSON.stringify(s.knotsU)}; knots-v:${JSON.stringify(s.knotsV)}; control-points:${JSON.stringify(s.controlPoints)}; weights:${JSON.stringify(s.weights)}; }`).join('\n')}
 @curve #hole { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[50,0,5],[50,10,5],[50,10,10],[50,0,10],[50,0,5]]; weights:[1,1,1,1,1]; }
}`;
const generator=`import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {emptyDirect,importSource} from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness=part('D339 witness').parameter('unrelated',2).box({w:12,d:7,h:5,x:80,y:-3,z:1});
const direct=importSource(emptyDirect(),${JSON.stringify(fixtureCSS)},'D339');
assert.ok(direct.objects.every(o=>!o.trims)); assert.equal(direct.objects.length,7);
const ui={...witness.doc,direct};
const api=part('D339 public facade',ui).sew(${JSON.stringify(surfaces)},{tol:.01});
assert.equal(api.bodies().length,2); assert.deepEqual(api.doc.direct,direct);
writeFileSync(process.argv[2],JSON.stringify(ui,null,2)+'\\n');
writeFileSync(process.argv[3],JSON.stringify(api.doc,null,2)+'\\n');`;
// Native-document read only. No private geometry construction or UI injection.
const inspector=`import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D339 native read',doc),breps=partBreps(doc),meshes=p.meshes();
const result=p.bodies().map(key=>{
 const b=breps.find(x=>x.key===key).brep,mesh=meshes.find(x=>x.key===key),check=checkBrep(b);
 assert.deepEqual(check.issues,[]);assert.equal(b.bodies.length,1);assert.equal(b.bodies[0].kind,'solid');assert.ok(b.shells.every(s=>s.closed));
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let i=0;i<mesh.positions.length;i++){const k=i%3;bounds.min[k]=Math.min(bounds.min[k],mesh.positions[i]);bounds.max[k]=Math.max(bounds.max[k],mesh.positions[i]);}
 return {key,mass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),faces:p.body(key).select().faces().list(),nativeNames:b.faces.map(f=>f.name).sort(),
 nativeFaces:b.faces.map(f=>({name:f.name,sense:f.sense,surface:Object.fromEntries(['degreeU','degreeV','knotsU','knotsV','controlPoints','weights'].map(k=>[k,f.surface[k]]))})),
 topology:{bodies:b.bodies.length,shells:b.shells.length,closedShells:b.shells.filter(s=>s.closed).length,vertices:b.vertices.length,edges:b.edges.length,faces:b.faces.length,euler:b.vertices.length-b.edges.length+b.faces.length},bounds,closed:true,valid:true,issues:check.issues};
});console.log(JSON.stringify(result));`;
const doc = () => page.evaluate(()=>window.__studioDoc);
const panel = () => page.getByRole('complementary',{name:'Direct geometry',exact:true});
const hud = () => page.getByRole('dialog',{name:'Sew',exact:true});
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
async function save(label) {
 phase=`native Save ${label}`; await ready(); const before=await doc();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save',exact:true}).click()]);
 const file=join(output,`${label}.bcad`); await download.saveAs(file); const bytes=await readFile(file); assert.deepEqual(JSON.parse(bytes),before);
 report.files.push({file,sha256:hash(bytes),semanticEquality:true,byteIdentityClaim:false}); return {file,doc:before};
}
const ids=['obj_1','obj_2','obj_3','obj_4','obj_5','obj_6'];
async function selectOrdered(selected=ids){for(let i=0;i<selected.length;i++)await select(selected[i],i>0);}
async function openSew(selected=ids,tol=.01){
 await selectOrdered(selected);await panel().getByLabel('Gap',{exact:true}).fill(String(tol));
 await panel().getByRole('button',{name:'Sew into a body',exact:true}).click();await hud().waitFor();
 assert.equal(await hud().getByLabel('Tolerance (0: automatic)',{exact:true}).inputValue(),String(tol));
}
async function selection(){return page.locator('.ol.direct.sel').allTextContents();}
async function preview(original,label,selected){
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});
 await page.waitForFunction(()=>Math.abs((window.__studioSection?.().shownVolume??0)-14820)<1e-6,null,{timeout:60000});
 assert.deepEqual(await doc(),original);assert.deepEqual(await selection(),selected);
 const state=await snapshot(label);assert.equal(state.bodies.bodies.length,1);close(state.bodies.bodies[0].volume,420,'Accepted witness during preview');
 assert.ok(Math.abs(state.shown.shownVolume-14820)<1e-6,'Preview sewn box + witness mesh volume');
}
async function geometry(label,expectedNames=null){
 const current=await doc(),file=join(output,`${label}-native-read.bcad`);await writeFile(file,JSON.stringify(current));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:8*1024*1024});
 await writeFile(join(output,`${label}-geometry.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const bodies=JSON.parse(run.stdout);assert.equal(bodies.length,2);
 const witness=bodies.find(b=>Math.abs(b.mass.volume-420)<1e-7),box=bodies.find(b=>b!==witness);assert.ok(witness&&box);
 close(witness.mass.volume,420,'Witness volume');witness.mass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));
 report.witness??={key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames};
 assert.deepEqual({key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames},report.witness);
 assert.ok(Math.abs(box.mass.volume-14400)<1e-6,'Sewn volume');box.mass.centroid.forEach((v,i)=>close(v,oracle.centroid[i],'Sewn centroid'));
 for(const kind of ['min','max'])box.bounds[kind].forEach((v,i)=>close(v,oracle.bounds[kind][i],`Sewn ${kind} ${i}`));
 assert.deepEqual(box.topology,{bodies:1,shells:1,closedShells:1,vertices:8,edges:12,faces:6,euler:2});
 assert.equal(box.nativeNames.length,6);assert.equal(box.publicNames.length,6);
 for(let i=0;i<6;i++){
  assert.equal(box.nativeNames.filter(n=>n.endsWith(`.surface${i}`)).length,1);
  assert.deepEqual(box.nativeFaces.find(f=>f.name.endsWith(`.surface${i}`)).surface,surfaces[i],'Native face retains the ordered authored surface');
  const face=box.faces.find(f=>f.name.endsWith(`.surface${i}`));assert.ok(face,`Public face for ordered input ${i}`);
  close(face.area,oracle.orderedFaceAreas[i],`Face ${i} area`);face.normal.forEach((v,k)=>close(v,oracle.orderedOutwardNormals[i][k],`Face ${i} normal`));
  face.centroid.forEach((v,k)=>close(v,oracle.orderedFaceCentroids[i][k],`Face ${i} centroid`));
 }
 close(box.faces.reduce((sum,f)=>sum+f.area,0),4080,'Surface area');
 const names={publicNames:box.publicNames,nativeNames:box.nativeNames,key:box.key};if(expectedNames)assert.deepEqual(names,expectedNames);
 const result={label,bodies,geometryTolerance:1e-7,volumeTolerance:1e-6,route:'Public Model Part mass/faces/meshes and partBreps/checkBrep native read'};
 report.geometry.push(result);await writeFile(join(output,`${label}-geometry.json`),JSON.stringify(result,null,2));await persist();return names;
}
async function editTolerance(index,value){
 await page.locator(`.history .hs[data-node-index="${index}"]`).click();await editor().waitFor();
 assert.equal(await editor().getByLabel('Tolerance parameter',{exact:true}).count(),0,'Sew tolerance has no parameter binding');
 await editor().getByLabel('Tolerance',{exact:true}).fill(String(value));const before=await doc();
 await editor().getByRole('button',{name:'Apply',exact:true}).click();await changed(before);await editor().waitFor({state:'hidden'});
 const after=await doc(),old=before.nodes[index],next=after.nodes[index];
 assert.deepEqual(next.surfaces,old.surfaces);assert.deepEqual(next.names,old.names);assert.equal(next.id,old.id);
 const oldOther={...old},newOther={...next};delete oldOther.tolerance;delete newOther.tolerance;
 assert.deepEqual(newOther,oldOther);assert.equal(next.tolerance,value||undefined);
 return after;
}
async function undo(expected,label) {phase=label; await page.keyboard.press('Meta+z'); await same(expected); return snapshot(label);}
async function redo(expected,label) {phase=label; await page.keyboard.press('Meta+Shift+z'); await same(expected); return snapshot(label);}
const inputs=['apps/cad-studio/test/sew-snapshot-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/DirectInspector.tsx','apps/cad-studio/src/ui/DirectPanel.tsx',
 'apps/cad-studio/src/state/useCommandPreview.ts','apps/cad-studio/vite.config.ts','packages/barocss-cad/src/api/spec.ts','packages/barocss-cad/src/api/part.ts','packages/barocss-cad/src/api/kernel.ts',
 'packages/barocss-cad/src/api/surface-snapshot.ts','packages/barocss-cad/src/brep/sew-solid.ts','packages/barocss-cad-model/src/engine/sew.ts','packages/barocss-cad-model/src/app/sewCommand.ts',
 'packages/barocss-cad-model/src/app/commands.ts','packages/barocss-cad-model/src/api/studio.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/chat/features.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files){
 const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort();assert.ok(names.length<=4096);
 const hashes={};for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));
 await writeFile(join(output,`source-${label}.json`),JSON.stringify({count:names.length,hashes},null,2));return hashes;
}
let frozenFiles=inputs;
try{
 report.sourceBefore=await capsule('before-generation',inputs);report.sourceBeforeCount=Object.keys(report.sourceBefore).length;
 await writeFile(join(output,'oracle.json'),oracleBytes);report.oracle={sha256:hash(oracleBytes),scope:'Independent planning arithmetic; actual native/UI evidence remains separate'};
 const buildInputs=[];
 async function compile(label,contents){
  const sourcefile=`d339-${label}.ts`,virtual=resolve(app,sourcefile);
  const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});
  await writeFile(join(output,`${label}.ts`),contents);await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin has no disk file; exact source and hash are saved separately.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));
  const file=join(output,`${label}.mjs`);await writeFile(file,built.outputFiles[0].contents);
  report.generatorSources??=[];report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual});return file;
 }
 const seedBundle=await compile('seed-generator',generator);inspectorBundle=await compile('native-inspector',inspector);
 const seedFile=join(output,'seed.bcad'),apiFile=join(output,'facade.bcad');const run=spawnSync(process.execPath,[seedBundle,seedFile,apiFile],{encoding:'utf8'});
 await writeFile(join(output,'seed.stdout.txt'),run.stdout??'');await writeFile(join(output,'seed.stderr.txt'),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))},apiSeed={file:apiFile,doc:JSON.parse(await readFile(apiFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs];report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);report.sourceFrozenCount=Object.keys(report.sourceFrozen).length;
 for(const[file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start';server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
 server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});});await server.listen();
 const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');
 browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-ui-seed');
 phase='actual Sew preview Cancel';await openSew();const selected=await selection();await preview(seed.doc,'02-preview',selected);
 await hud().getByRole('button',{name:'Cancel',exact:true}).click();await same(seed.doc);assert.deepEqual(await selection(),selected);await snapshot('03-cancel');
 phase='actual Sew retry Apply';await openSew();await preview(seed.doc,'04-retry-preview',selected);
 await hud().getByRole('button',{name:'Apply',exact:true}).click();await ready(2);const accepted=await doc(),index=accepted.nodes.length-1,node=accepted.nodes[index];
 assert.equal(node.kind,'sew');assert.deepEqual(node.surfaces,surfaces);assert.equal(node.tolerance,.01);
 assert.deepEqual(node.names,ids.map(id=>byId(seed.doc,id).name));
 assert.deepEqual(accepted.direct,{...seed.doc.direct,objects:seed.doc.direct.objects.map(o=>ids.includes(o.id)?{...o,hidden:true}:o)});
 assert.equal(await page.locator('.ol.direct.sel').count(),0);const names=await geometry('05-applied');await snapshot('05-applied');
 await undo(seed.doc,'06-undo-visible-sources');await redo(accepted,'07-redo-hidden-sources');await geometry('07-redo',names);
 phase='history tolerance .02';await editTolerance(index,.02);await geometry('08-tolerance02',names);await snapshot('08-tolerance02');
 phase='history tolerance auto';const auto=await editTolerance(index,0);await geometry('09-tolerance-auto',names);await snapshot('09-tolerance-auto');
 const saved=await save('ui-accepted');await freshOpen(saved,'10-ui-fresh-open');await geometry('10-ui-fresh-open',names);
 assert.deepEqual((await doc()).nodes[index],auto.nodes[index]);await page.locator(`.history .hs[data-node-index="${index}"]`).click();
 assert.equal(await editor().getByLabel('Tolerance',{exact:true}).inputValue(),'0');assert.equal(await editor().getByLabel('Tolerance parameter',{exact:true}).count(),0);await snapshot('11-reeditable-auto');await editor().getByRole('button',{name:'Close editor',exact:true}).click();
 phase='show original source';const beforeShow=await doc(),object=byId(beforeShow,'obj_1');await page.locator('.ol.direct.hidden-obj').filter({hasText:new RegExp(`${object.name}$`)}).click();await changed(beforeShow);
 assert.equal(byId(await doc(),'obj_1').hidden,false);assert.deepEqual((await doc()).nodes,beforeShow.nodes);await geometry('12-source-shown',names);await snapshot('12-source-shown');
 phase='move original source';await select('obj_1');await panel().getByLabel('ΔX',{exact:true}).fill('7');await panel().getByLabel('ΔZ',{exact:true}).fill('5');const beforeMove=await doc();
 await panel().getByRole('button',{name:'Move',exact:true}).click();await changed(beforeMove);const moved=await doc();assert.notDeepEqual(moved.direct,beforeMove.direct);assert.deepEqual(moved.nodes,beforeMove.nodes);await geometry('13-source-moved',names);await snapshot('13-source-moved');
 phase='delete original source';await select('obj_1');await page.keyboard.press('Delete');await changed(moved);const deleted=await doc();assert.equal(byId(deleted,'obj_1'),undefined);assert.deepEqual(deleted.nodes,moved.nodes);await geometry('14-source-deleted',names);await snapshot('14-source-deleted');
 // Actual public Trim gives a known last history item and a late trimmed Sew member.
 await freshOpen(seed,'15-refusal-seed');await select('obj_6');await select('obj_7',true);await panel().getByLabel('Trim keeps',{exact:true}).selectOption('outside');
 await panel().getByRole('button',{name:'Trim by the curve',exact:true}).click();await changed(seed.doc);const trimmed=await doc();assert.equal(byId(trimmed,'obj_6').trims[0].uv.length,160);
 phase='open five surfaces refusal';await openSew(ids.slice(0,5));const fiveSelection=await selection(),downloads=report.downloads.length;
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='refused',null,{timeout:60000});
 const detail=hud().getByText('Kernel detail',{exact:true});if(await detail.count())await detail.click();
 assert.equal(await hud().getByRole('button',{name:'Apply',exact:true}).isDisabled(),true);await same(trimmed);assert.deepEqual(await selection(),fiveSelection);assert.equal(report.downloads.length,downloads);
 report.refusals.push({kind:'open-five-surfaces',actualHudText:await hud().textContent(),documentUnchanged:true,visibilityUnchanged:true,selectionUnchanged:true,noDownload:true});await snapshot('16-open-five-refusal');
 await hud().getByRole('button',{name:'Cancel',exact:true}).click();await undo(seed.doc,'17-open-five-no-undo-entry');await redo(trimmed,'18-redo-public-trim');
 phase='late member trimmed context refusal';await selectOrdered();await panel().getByRole('button',{name:'Sew into a body',exact:true}).waitFor();const trimSelection=await selection();
 await panel().getByRole('button',{name:'Sew into a body',exact:true}).click();await page.locator('.toast[role="alert"]').waitFor();assert.match(await page.locator('.toast[role="alert"]').textContent(),/trim|whole surface/i);
 assert.equal(await hud().count(),0);await same(trimmed);assert.deepEqual(await selection(),trimSelection);assert.equal(report.downloads.length,downloads);
 report.refusals.push({kind:'trimmed-last-member',actualToast:await page.locator('.toast[role="alert"]').textContent(),documentUnchanged:true,visibilityUnchanged:true,selectionUnchanged:true,noDownload:true});await snapshot('19-trimmed-refusal');
 await undo(seed.doc,'20-trimmed-no-undo-entry');if(await page.locator('.toast[role="alert"]').count())await page.locator('.toast[role="alert"]').getByRole('button',{name:'Dismiss',exact:true}).click();
 phase='valid retry after refusal';await openSew();await preview(seed.doc,'21-valid-retry-preview',await selection());await hud().getByRole('button',{name:'Apply',exact:true}).click();await ready(2);await geometry('22-valid-retry');await snapshot('22-valid-retry');
 // A separate facade file has owned recipes and no selected-source hiding context.
 await freshOpen(apiSeed,'23-public-facade-open');const apiNode=apiSeed.doc.nodes.at(-1),apiIndex=apiSeed.doc.nodes.length-1;
 assert.equal(apiNode.kind,'sew');assert.deepEqual(apiNode.surfaces,surfaces);assert.equal(apiNode.tolerance,.01);assert.deepEqual(apiSeed.doc.direct,seed.doc.direct);const apiNames=await geometry('23-public-facade-open');
 const apiSaved=await save('facade-accepted');await freshOpen(apiSaved,'24-facade-fresh-open');await geometry('24-facade-fresh-open',apiNames);
 await page.locator(`.history .hs[data-node-index="${apiIndex}"]`).click();assert.equal(await editor().getByLabel('Tolerance',{exact:true}).inputValue(),'0.01');assert.equal(await editor().getByLabel('Tolerance parameter',{exact:true}).count(),0);await snapshot('25-facade-reeditable');
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.changes,[]);
 report.sourceAfter=await capsule('after-browser',frozenFiles);report.sourceAfterCount=Object.keys(report.sourceAfter).length;assert.deepEqual(report.sourceAfter,report.sourceFrozen);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack??String(error);process.exitCode=1;if(page)try{await snapshot('failure');}catch(e){report.captureFailure=e.stack??String(e);}}
finally{
 for(const[resource,label]of[[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]){if(!resource)continue;try{await resource.close();report.cleanup.push(`${label}_CLOSED`);}catch(e){report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try{report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles);report.sourceAfterCleanupCount=Object.keys(report.sourceAfterCleanup).length;if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);}catch(e){report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist();console.log(JSON.stringify({status:report.status,phase,failure:report.failure,output}));
}
