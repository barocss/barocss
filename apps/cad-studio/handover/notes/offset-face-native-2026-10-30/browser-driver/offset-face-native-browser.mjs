// D342: source-only preparation until root freezes every source writer.
// D342_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/offset-face-native-browser.mjs /absolute/artifacts
// Public author API seeds; actual mouse/command/editor UI mutates. Hooks only observe.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'vite';
assert.equal(process.env.D342_SOURCE_FROZEN,'1','Root must freeze all source writers before D342 generation');
assert.ok(process.env.PW_DIR&&process.env.CHROME&&process.argv[2],'PW_DIR, CHROME and artifact directory required');
const app=resolve(import.meta.dirname,'..'),repo=resolve(app,'../..'),output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'RUNNING',qualification:'NATIVE_NUMERIC_AND_ACTUAL_UI_FLOW',visualReview:'ROOT_MUST_VIEW_SCREENSHOTS',profiles:[],states:[],native:[],oracles:[],facePicks:[],refusals:[],errors:[],consoleErrors:[],changes:[],downloads:[],files:[],cleanup:[],
 limits:['Actual mouse top-cap selection uses a read-only world projection; no select/pick mutation hooks.',
 'Independent Fraction oracle uses original native endpoints plus represented distance; display mass/bounds are separate evidence.',
 'Signed other caps, repeated command closure and generic drafted/curved continuation are separate focused-test scopes.',
 'Integer cylinder is an existing support control with rounded analytic pi, not exact rational circle mass or a generic curved certificate.',
 'The added profile is an owned native snapshot under existing node semantics; original parameter binding is retained, no live face association is claimed.',
 'Successful Offset Apply clears geometry picks; Undo/Redo proves exact recipes and records selection without claiming restoration of the original face pick.',
 'Native geometry success does not replace root screenshot review.']};
let phase='public seed preparation',server,browser,context,page,inspectorBundle;
const persist=()=>writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const generator=`import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part,param,sketch} from '../../packages/barocss-cad-model/src/api/index.ts';
const addWitness=p=>p.box({w:12,d:7,h:5,x:80,y:-3,z:1});
const main=addWitness(part('D342 fractional cap').parameter('height',5).parameter('offsetDistance',3).box({w:20.00003,d:10,h:param('height'),x:.1234567,y:-.2345678,z:.3456789}));
const draft=addWitness(part('D342 drafted refusal').extrude(sketch().rectangle({w:20,d:10}),{h:5,draft:5}));
const cylinder=addWitness(part('D342 integer circle control').cylinder({r:3,h:5}));
for(const[file,p]of [[process.argv[2],main],[process.argv[3],draft],[process.argv[4],cylinder]]){assert.equal(p.bodies().length,2);writeFileSync(file,JSON.stringify(p.doc,null,2));}`;
const inspector=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {brepMassProperties,brepSurfaceArea,checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D342 native read',doc),view=evaluateDoc(doc,0);assert.equal(view.ok,true,JSON.stringify(view));
const bodies=partBreps(doc).map(({key,brep})=>({key,ref:view.bodies.find(b=>b.key===key).ref??null,brep,mass:brepMassProperties(brep,1),area:brepSurfaceArea(brep),check:checkBrep(brep,{strict:true}),
 structure:{bodyKinds:brep.bodies.map(b=>b.kind),nativeSolidCount:brep.bodies.filter(b=>b.kind==='solid').length,nativeShellCount:brep.shells.length,nativeClosedShellCount:brep.shells.filter(s=>s.closed).length},
 publicMass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),publicFaces:p.body(key).select().faces().list(),nativeNames:brep.faces.map(f=>f.name),
 displayBodyIndex:view.bodies.findIndex(b=>b.key===key),displayFaces:view.bodies.find(b=>b.key===key).mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))}));console.log(JSON.stringify({bodies}));`;
const independentOracle="\"\"\"Independent Fraction native-endpoint box oracle. No production imports.\"\"\"\nimport json,sys\nfrom fractions import Fraction as F\n\ndef q(v):return F.from_float(v) if isinstance(v,float) else F(v)\ndef encoded(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}\ndef bounds(b):\n p=[list(map(q,v['point'])) for v in b['vertices']]\n return [min(v[k] for v in p) for k in range(3)],[max(v[k] for v in p) for k in range(3)]\ndef face_points(b,face):\n vs={v['id']:list(map(q,v['point'])) for v in b['vertices']};es={e['id']:e for e in b['edges']};cs={c['id']:c for c in b['coedges']};ls={l['id']:l for l in b['loops']};ids=set()\n for lid in face['loops']:\n  for cid in ls[lid]['coedges']:ids.update(es[cs[cid]['edge']]['vertices'])\n return [vs[i] for i in sorted(ids)]\ndef nonzero_area(points):\n if len(points)<3:return False\n a=points[0]\n for i in range(1,len(points)):\n  u=[x-y for x,y in zip(points[i],a)]\n  for j in range(i+1,len(points)):\n   v=[x-y for x,y in zip(points[j],a)]\n   if any([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]):return True\n return False\nif __name__=='__main__':\n data=json.load(sys.stdin);original=data['original']['brep'];actual=data['actual']['brep'];lo,hi=bounds(original);old=hi[2];hi[2]+=q(data['distance']);widths=[b-a for a,b in zip(lo,hi)]\n assert all(v>0 for v in widths)\n volume=widths[0]*widths[1]*widths[2];centroid=[(a+b)/2 for a,b in zip(lo,hi)];area=2*(widths[0]*widths[1]+widths[0]*widths[2]+widths[1]*widths[2]);linear=q(1e-7);mass_tol=q(1e-7)\n nativeSolids=[b for b in actual['bodies'] if b['kind']=='solid'];assert len(actual['bodies'])==len(nativeSolids)==1,'One Model body must contain exactly one native solid'\n assert len(actual['shells'])==1 and actual['shells'][0]['closed'],'One closed native shell required'\n actualLo,actualHi=bounds(actual)\n assert all(abs(a-b)<=linear for a,b in zip(actualLo,lo)) and all(abs(a-b)<=linear for a,b in zip(actualHi,hi)),'Native result bounds must preserve original tangent endpoints and intended cap'\n pipelines=[]\n for name,mass in [('nativeCore',data['actual']['mass']),('publicPart',data['actual']['publicMass']),('actualStudioModel',data['studio']['target'])]:\n  assert abs(q(mass['volume'])-volume)<=mass_tol,(name,'volume',mass['volume'],float(volume))\n  assert len(mass['centroid'])==3 and all(abs(q(a)-b)<=linear for a,b in zip(mass['centroid'],centroid)),(name,'centroid')\n  pipelines.append({'name':name,'actualVolume':mass['volume'],'actualCentroid':mass['centroid'],'sameOriginalNativeEndpointOracle':True,'volumeError':encoded(q(mass['volume'])-volume),'centroidErrors':[encoded(q(a)-b) for a,b in zip(mass['centroid'],centroid)]})\n assert data['studio']['target']['key']==data['actual']['key'],'Studio mass target is mapped by the actual native body key'\n assert abs(q(data['actual']['area'])-area)<=q(1e-6),'Native boundary surface area'\n supports=[(k,value) for k in range(3) for value in [lo[k],hi[k]]];faces=[];seen=set()\n for face in actual['faces']:\n  points=face_points(actual,face);assert nonzero_area(points),'No zero-area native boundary face'\n  signature=tuple(sorted(tuple(p) for p in points));assert signature not in seen,'No duplicate native boundary face';seen.add(signature)\n  boundaryResiduals=[max(abs(p[k]-value) for p in points) for k,value in supports];boundaryBest=min(boundaryResiduals)\n  assert boundaryBest<=linear,('Native face boundary is on no intended support',face.get('name'),float(boundaryBest))\n  s=face['surface'];assert 'controlPoints' in s,'Box has native surface support'\n  poles=[list(map(q,p)) for row in s['controlPoints'] for p in row];surfaceResiduals=[max(abs(p[k]-value) for p in poles) for k,value in supports];surfaceBest=min(surfaceResiduals)\n  assert surfaceBest<=linear,('Native face support plane is wrong',face.get('name'),float(surfaceBest))\n  oldLedge=all(abs(p[2]-old)<=linear for p in points);assert not oldLedge,('Old selected cap remains exposed',face.get('name'))\n  faces.append({'id':face['id'],'name':face.get('name'),'boundarySupportResidual':encoded(boundaryBest),'surfaceSupportResidual':encoded(surfaceBest),'oldCapExposed':oldLedge})\n print(json.dumps({'status':'PASS','expected':{'min':list(map(encoded,lo)),'max':list(map(encoded,hi)),'volume':encoded(volume),'centroid':list(map(encoded,centroid)),'surfaceArea':encoded(area),'oldCap':encoded(old)},'nativeStructure':{'bodies':len(actual['bodies']),'solidCount':len(nativeSolids),'shellCount':len(actual['shells']),'closedShellCount':sum(s['closed'] for s in actual['shells']),'vertices':len(actual['vertices']),'edges':len(actual['edges']),'faces':len(actual['faces'])},'massPipelines':pipelines,'studioTargetIdentity':{'key':data['studio']['target']['key'],'ref':data['actual'].get('ref')},'faceSupports':faces,'linearTolerance':1e-7,'massTolerance':1e-7,'scope':'Actual stored native original endpoints + represented distance, Fraction arithmetic; native support planes/boundary vertices plus native Core, public Part and accepted Studio Model mass; not display mesh or rounded UI text'},indent=2))\n";
const doc = () => page.evaluate(()=>window.__studioDoc);
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
async function save(label) {
 phase=`native Save ${label}`; await ready(); const before=await doc();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save',exact:true}).click()]);
 const file=join(output,`${label}.bcad`); await download.saveAs(file); const bytes=await readFile(file); assert.deepEqual(JSON.parse(bytes),before);
 report.files.push({file,sha256:hash(bytes),semanticEquality:true,byteIdentityClaim:false}); return {file,doc:before};
}
async function undo(expected,label) {phase=label; await page.keyboard.press('Meta+z'); await same(expected); return snapshot(label);}
async function redo(expected,label) {phase=label; await page.keyboard.press('Meta+Shift+z'); await same(expected); return snapshot(label);}
const hud=()=>page.getByRole('dialog',{name:'Offset face',exact:true});
const editor=()=>page.locator('.node-editor');
async function readNative(label){
 const accepted=await doc(),file=join(output,`${label}-native-read.bcad`);await writeFile(file,JSON.stringify(accepted));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:24*1024*1024});await writeFile(join(output,`${label}-native.stderr.txt`),run.stderr??'');await writeFile(join(output,`${label}-native.raw.json`),run.stdout??'');assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);
 assert.equal(result.bodies.length,2);const witness=report.witness?result.bodies.find(b=>b.key===report.witness.key):result.bodies.find(b=>Math.abs(b.mass.volume-420)<1e-7&&b.mass.centroid.every((v,i)=>Math.abs(v-[86,.5,3.5][i])<1e-7)),target=result.bodies.find(b=>b!==witness);assert.ok(witness&&target);
 close(witness.mass.volume,420,'Witness volume');witness.mass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));report.witness??={key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames};assert.deepEqual({key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames},report.witness);
 for(const b of result.bodies){assert.equal(b.check.valid,true,JSON.stringify(b.check));assert.deepEqual(b.check.issues,[]);assert.equal(b.structure.nativeSolidCount,1,'Each Model body contains one actual native solid');assert.equal(b.brep.bodies.length,1);assert.equal(b.structure.nativeShellCount,1);assert.equal(b.structure.nativeClosedShellCount,1);assert.equal(new Set(b.nativeNames).size,b.nativeNames.length);assert.equal(new Set(b.publicNames).size,b.publicNames.length);assert.ok(b.publicFaces.every(f=>f.area>0));}
 close(witness.publicMass.volume,420,'Public Part witness volume');witness.publicMass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Public Part witness centroid'));
 const sourceRecipeHash=hash(JSON.stringify(accepted)),evidence={label,sourceRecipeHash,...result};report.native.push(evidence);await writeFile(join(output,`${label}-native.json`),JSON.stringify(evidence,null,2));await persist();return {...target,sourceRecipeHash};
}
async function captureStudioMass(actual,label){
 await ready(2);const accepted=await doc(),state=await page.evaluate(()=>window.__studioBodies?.());assert.equal(hash(JSON.stringify(accepted)),actual.sourceRecipeHash,'Native and accepted Studio mass refer to the same recipe');
 assert.ok(state?.fresh&&state.massReady);assert.equal(state.bodies.length,2);const targets=state.bodies.filter(b=>b.key===actual.key),witnesses=state.bodies.filter(b=>b.key===report.witness.key);assert.equal(targets.length,1);assert.equal(witnesses.length,1);assert.notEqual(actual.key,report.witness.key);
 const target=targets[0],witness=witnesses[0];assert.equal(target.centroid?.length,3);close(witness.volume,420,'Actual Studio witness volume');assert.equal(witness.centroid?.length,3);witness.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Actual Studio witness centroid'));
 const result={label,target,witness,targetNativeRef:actual.ref,sourceRecipeHash:actual.sourceRecipeHash,route:'Existing read-only __studioBodies accepted Model mass keyed to the actual native body; excludes preview mesh and rounded UI text',rawState:state};
 report.studioMass??=[];report.studioMass.push(result);await writeFile(join(output,`${label}-studio-mass.json`),JSON.stringify(result,null,2));await persist();assert.deepEqual(await doc(),accepted,'Mass observation does not change the accepted recipe');return result;
}
async function boxGeometry(original,actual,distance,label){
 const studio=await captureStudioMass(actual,label),input={original,actual,distance,studio};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
 const run=spawnSync('python3',[join(output,'box-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:12*1024*1024});await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);const verified=JSON.parse(run.stdout);report.oracles.push({label,verified});await persist();return verified;
}
async function pickTop(target,label){
 phase=`actual viewport cap pick ${label}`;await page.getByRole('group',{name:'Views',exact:true}).getByRole('button',{name:'Top',exact:true}).click();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const faces=target.displayFaces.filter(f=>f.kind==='plane'&&Math.abs(f.normal[2]-1)<1e-9);assert.equal(faces.length,1,'One displayed positive Z cap for this profile');const face=faces[0],point=face.centroid;
 const pixel=await page.evaluate(point=>window.__studioScreenOf?.(point),point);assert.ok(pixel?.length===2&&pixel.every(Number.isFinite),'Read-only world point projects onto actual viewport');
 await page.mouse.click(pixel[0],pixel[1]);await page.waitForFunction(({body,face})=>{const s=window.__studioSelection?.selection;return s?.faces.length===1&&s.faces[0].body===body&&s.faces[0].face===face&&s.bodies.length===0&&s.edges.length===0;},{body:target.displayBodyIndex,face:face.index},{timeout:10000});
 const actual=await page.evaluate(()=>window.__studioSelection.selection);report.facePicks.push({label,point,pixel,targetBodyKey:target.key,nativeAndDisplayedName:face.name,expected:{body:target.displayBodyIndex,face:face.index},actual,route:'Real page.mouse.click after read-only __studioScreenOf projection'});await snapshot(`${label}-selected-top`);
}
async function openOffset(distance){
 await page.keyboard.press('Space');await page.locator('.palette input').fill('Offset face');await page.keyboard.press('Enter');await hud().waitFor();await hud().getByLabel('Offset',{exact:true}).fill(String(distance));
}
async function isoSnapshot(label){await page.getByRole('group',{name:'Views',exact:true}).getByRole('button',{name:'Iso',exact:true}).click();return snapshot(label);}
async function acceptedPreview(original,label){
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='preview',null,{timeout:60000});assert.deepEqual(await doc(),original,'Preview leaves accepted recipe unchanged');assert.equal(await hud().getByRole('button',{name:'Apply',exact:true}).isDisabled(),false);await snapshot(label);
}
async function acceptedOffsetSelection(label){
 const record={label,witnessKey:report.witness.key,policy:'Successful Offset Apply clears old geometry indices; it does not remap a face onto reordered bodies'};report.acceptedSelections??=[];report.acceptedSelections.push(record);
 try{await page.waitForFunction(()=>{const s=window.__studioSelection?.selection;return s&&['faces','edges','bodies','vertices'].every(key=>(s[key]?.length??0)===0);},null,{timeout:10000});}
 finally{
  const observed=await page.evaluate(()=>({selection:window.__studioSelection?.selection,bodyOrder:window.__studioBodies?.().bodies.map(b=>b.key)??[]}));
  record.actual=observed;record.picks=Object.fromEntries(['faces','edges','bodies','vertices'].map(key=>[key,observed.selection?.[key]??[]]));
  const indices=[...record.picks.bodies,...['faces','edges','vertices'].flatMap(key=>record.picks[key].map(pick=>pick.body))];record.selectedBodyKeys=indices.map(index=>observed.bodyOrder[index]??null);record.witnessAliased=record.selectedBodyKeys.includes(report.witness.key);record.pass=!!observed.selection&&Object.values(record.picks).every(picks=>picks.length===0)&&!record.witnessAliased;await persist();
 }
 assert.ok(record.pass,'Accepted Offset clears faces/edges/bodies/vertices and cannot alias the witness after body reordering');
}
async function applyOffset(original,label){
 phase=`actual Apply ${label}`;await hud().getByRole('button',{name:'Apply',exact:true}).click();await changed(original);await hud().waitFor({state:'hidden'});await acceptedOffsetSelection(label);const after=await doc();assert.deepEqual(after.nodes.slice(0,original.nodes.length),original.nodes,'Existing source and bindings are an unchanged recipe prefix');assert.deepEqual(after.parameters,original.parameters);assert.equal(after.nodes.length,original.nodes.length+3);assert.equal(after.nodes[original.nodes.length].kind,'sketch');assert.equal(after.nodes[original.nodes.length+1].kind,'extrude');await snapshot(label);return after;
}
async function editDistance(index,value,parameter=null){
 phase=`existing extrusion editor ${value}`;await page.locator(`.history .hs[data-node-index="${index}"]`).click();await editor().waitFor();const before=await doc();
 await editor().getByLabel('Distance',{exact:true}).fill(String(value));if(parameter)await editor().getByLabel('Distance parameter',{exact:true}).selectOption(parameter);
 await editor().getByRole('button',{name:'Apply',exact:true}).click();await changed(before);await editor().waitFor({state:'hidden'});const after=await doc();assert.deepEqual(after.parameters,before.parameters);
 const {height:oldHeight,...oldOther}=before.nodes[index],{height:newHeight,...newOther}=after.nodes[index];assert.notDeepEqual(newHeight,oldHeight);assert.deepEqual(newOther,oldOther);assert.deepEqual(newHeight,parameter?{parameter}:value);assert.deepEqual(after.nodes.slice(0,index),before.nodes.slice(0,index));assert.deepEqual(after.nodes.slice(index+1),before.nodes.slice(index+1));return after;
}
const inputs=['apps/cad-studio/test/offset-face-native-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/Hud.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','apps/cad-studio/vite.config.ts',
 'packages/barocss-cad-model/src/app/profileCommands.ts','packages/barocss-cad-model/src/app/nativeOffsetFace.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/engine/evaluate.ts','packages/barocss-cad-model/src/app/faceProfile.ts','packages/barocss-cad-model/src/sketch/plane.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files){const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort();assert.ok(names.length<=4096);const hashes={};for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));await writeFile(join(output,`source-${label}.json`),JSON.stringify({count:names.length,hashes},null,2));return hashes;}
let frozenFiles=inputs;
try{
 report.sourceBefore=await capsule('before-generation',inputs);report.sourceBeforeCount=Object.keys(report.sourceBefore).length;
 for(const[file,label]of [['/tmp/d342-plan/plan.md','plan.md'],['/tmp/d342-probe/receipt.md','baseline-receipt.md']]){const bytes=await readFile(file);await writeFile(join(output,label),bytes);report.referenceSources??=[];report.referenceSources.push({file,label,sha256:hash(bytes),scope:'Previous source/baseline reference, not this browser qualification'});}
 await writeFile(join(output,'box-oracle.py'),independentOracle);report.oracleSource={file:'box-oracle.py',sha256:hash(independentOracle),productionImports:0};
 const buildInputs=[];async function compile(label,contents){const sourcefile=`d342-${label}.ts`,virtual=resolve(app,sourcefile);const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});await writeFile(join(output,`${label}.ts`),contents);await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin has no disk input. Save exact source/hash separately and exclude it explicitly.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));const file=join(output,`${label}.mjs`);await writeFile(file,built.outputFiles[0].contents);report.generatorSources??=[];report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual});return file;}
 const seedBundle=await compile('seed-generator',generator);inspectorBundle=await compile('native-inspector',inspector);const seedFile=join(output,'seed.bcad'),draftFile=join(output,'draft.bcad'),cylinderFile=join(output,'cylinder.bcad');const run=spawnSync(process.execPath,[seedBundle,seedFile,draftFile,cylinderFile],{encoding:'utf8'});
 await writeFile(join(output,'seed.stdout.txt'),run.stdout??'');await writeFile(join(output,'seed.stderr.txt'),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))},draft={file:draftFile,doc:JSON.parse(await readFile(draftFile,'utf8'))},cylinder={file:cylinderFile,doc:JSON.parse(await readFile(cylinderFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs];report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);report.sourceFrozenCount=Object.keys(report.sourceFrozen).length;for(const[file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start';server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});});await server.listen();const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-translated-fractional-seed');const original=await readNative('01-original');await pickTop(original,'02-native-cap');await openOffset(2);await acceptedPreview(seed.doc,'03-outward-preview');
 const accepted=await applyOffset(seed.doc,'04-outward-applied'),addedIndex=seed.doc.nodes.length+1;assert.equal(accepted.nodes.at(-1).kind,'union');const moved=await readNative('04-outward');await boxGeometry(original,moved,2,'04-outward');await isoSnapshot('04-outward-native-authority-iso');report.profiles.push({kind:'translated-fractional-box',distance:2});
 await undo(seed.doc,'05-undo-original');await redo(accepted,'06-redo-accepted');const redoNative=await readNative('06-redo');await boxGeometry(original,redoNative,2,'06-redo');assert.deepEqual(redoNative.nativeNames,moved.nativeNames);assert.deepEqual(redoNative.publicNames,moved.publicNames);
 const saved=await save('outward-accepted');await freshOpen(saved,'07-outward-fresh-open');const reopened=await readNative('07-reopened');await boxGeometry(original,reopened,2,'07-reopened');assert.deepEqual(reopened.nativeNames,moved.nativeNames);assert.deepEqual(reopened.publicNames,moved.publicNames);await pickTop(reopened,'08-reopened-cap');
 const edited=await editDistance(addedIndex,3,'offsetDistance');assert.deepEqual(edited.nodes.slice(0,seed.doc.nodes.length),seed.doc.nodes);await snapshot('09-distance3-parameter-bound');const editedNative=await readNative('09-edited');await boxGeometry(original,editedNative,3,'09-edited');assert.deepEqual(editedNative.nativeNames,moved.nativeNames);assert.deepEqual(editedNative.publicNames,moved.publicNames);
 const editedSaved=await save('distance3-bound');await freshOpen(editedSaved,'10-edited-fresh-open');const finalNative=await readNative('10-final');await boxGeometry(original,finalNative,3,'10-final');assert.deepEqual(finalNative.nativeNames,editedNative.nativeNames);assert.deepEqual(finalNative.publicNames,editedNative.publicNames);await pickTop(finalNative,'11-edited-cap');
 await page.locator(`.history .hs[data-node-index="${addedIndex}"]`).click();assert.equal(await editor().getByLabel('Distance',{exact:true}).inputValue(),'3');assert.equal(await editor().getByLabel('Distance',{exact:true}).isDisabled(),true);assert.equal(await editor().getByLabel('Distance parameter',{exact:true}).inputValue(),'offsetDistance');await snapshot('12-distance-reeditable');await editor().getByRole('button',{name:'Close editor',exact:true}).click();
 await freshOpen(seed,'13-inward-seed');const inwardOriginal=await readNative('13-inward-original');await pickTop(inwardOriginal,'14-inward-cap');await openOffset(-1);await acceptedPreview(seed.doc,'15-inward-preview');const inward=await applyOffset(seed.doc,'16-inward-applied');assert.equal(inward.nodes.at(-1).kind,'difference');const inwardNative=await readNative('16-inward');await boxGeometry(inwardOriginal,inwardNative,-1,'16-inward');report.profiles.push({kind:'translated-fractional-box',distance:-1});
 // A real source edit establishes the previous Undo item before the unsupported command attempt.
 await freshOpen(draft,'17-drafted-seed');const draftIndex=draft.doc.nodes.findIndex(n=>n.kind==='extrude');await editDistance(draftIndex,6);const beforeRefusal=await doc(),draftNative=await readNative('18-drafted-height6');await pickTop(draftNative,'19-drafted-cap');const selectionBefore=await page.evaluate(()=>window.__studioSelection.selection);await openOffset(2);
 await page.waitForFunction(()=>document.querySelector('.hud .status')?.textContent==='refused',null,{timeout:60000});const detail=hud().getByText('Kernel detail',{exact:true});if(await detail.count())await detail.click();const refusalText=await hud().textContent();assert.match(refusalText,/right prism|draft|nonprism|cap|Offset face/i);assert.equal(await hud().getByRole('button',{name:'Apply',exact:true}).isDisabled(),true);await same(beforeRefusal);assert.deepEqual(await page.evaluate(()=>window.__studioSelection.selection),selectionBefore);report.refusals.push({kind:'drafted-cap5degrees',actualHudText:refusalText,documentUnchanged:true,selectionUnchanged:true});await snapshot('20-drafted-refusal');await hud().getByRole('button',{name:'Cancel',exact:true}).click();await same(beforeRefusal);await undo(draft.doc,'21-draft-refusal-no-undo-entry');report.profiles.push({kind:'drafted-cap5-refusal'});
 await freshOpen(seed,'22-valid-retry-seed');const retryOriginal=await readNative('22-retry-original');await pickTop(retryOriginal,'23-retry-cap');await openOffset(2);await acceptedPreview(seed.doc,'24-valid-retry-preview');await applyOffset(seed.doc,'25-valid-retry-applied');await boxGeometry(retryOriginal,await readNative('25-valid-retry'),2,'25-valid-retry');
 await freshOpen(cylinder,'26-integer-cylinder-seed');const cylinderOriginal=await readNative('26-cylinder-original');await pickTop(cylinderOriginal,'27-cylinder-cap');await openOffset(2);await acceptedPreview(cylinder.doc,'28-cylinder-preview');await applyOffset(cylinder.doc,'29-cylinder-applied');const cylinderResult=await readNative('29-cylinder-result');const cylinderStudio=await captureStudioMass(cylinderResult,'29-cylinder'),cylinderPipelines=[['nativeCore',cylinderResult.mass],['publicPart',cylinderResult.publicMass],['actualStudioModel',cylinderStudio.target]];for(const[name,mass]of cylinderPipelines){close(mass.volume,Math.PI*9*7,`${name} integer cylinder rounded analytic volume guide`);mass.centroid.forEach((v,i)=>close(v,[0,0,3.5][i],`${name} cylinder centroid`));}report.massPipelines??=[];report.massPipelines.push({label:'29-cylinder',expected:{volume:Math.PI*9*7,centroid:[0,0,3.5]},targetKey:cylinderResult.key,targetNativeRef:cylinderResult.ref,actual:Object.fromEntries(cylinderPipelines),scope:'Same rounded analytic integer-cylinder guide for native Core, public Part and accepted Studio Model mass; no exact pi certification'});report.profiles.push({kind:'integer-cylinder-control',radius:3,initialHeight:5,distance:2,analyticGuide:Math.PI*9*7,scope:'Existing integer circle support and actual one-native-solid/shell control; not exact pi or generic curved certificate'});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.changes,[]);report.sourceAfter=await capsule('after-browser',frozenFiles);report.sourceAfterCount=Object.keys(report.sourceAfter).length;assert.deepEqual(report.sourceAfter,report.sourceFrozen);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack??String(error);process.exitCode=1;if(page)try{await snapshot('failure');}catch(e){report.captureFailure=e.stack??String(e);}}
finally{for(const[resource,label]of[[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]){if(!resource)continue;try{await resource.close();report.cleanup.push(`${label}_CLOSED`);}catch(e){report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try{report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles);report.sourceAfterCleanupCount=Object.keys(report.sourceAfterCleanup).length;if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);}catch(e){report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist();console.log(JSON.stringify({status:report.status,qualification:report.qualification,visualReview:report.visualReview,phase,failure:report.failure,output}));}
