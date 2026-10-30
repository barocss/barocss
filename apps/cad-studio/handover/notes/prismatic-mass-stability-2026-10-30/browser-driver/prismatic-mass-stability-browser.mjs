// D343: source-only preparation until root freezes every source writer.
// D343_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/prismatic-mass-stability-browser.mjs /absolute/artifacts
// Public author API seeds; actual mouse/command/editor UI mutates. Hooks only observe.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'vite';
assert.equal(process.env.D343_SOURCE_FROZEN,'1','Root must freeze all source writers before D343 generation');
assert.ok(process.env.PW_DIR&&process.env.CHROME&&process.argv[2],'PW_DIR, CHROME and artifact directory required');
const app=resolve(import.meta.dirname,'..'),repo=resolve(app,'../..'),output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'RUNNING',qualification:'NATIVE_NUMERIC_AND_ACTUAL_UI_FLOW',visualReview:'ROOT_MUST_VIEW_SCREENSHOTS',profiles:[],states:[],native:[],oracles:[],facePicks:[],refusals:[],errors:[],consoleErrors:[],changes:[],downloads:[],files:[],cleanup:[],
 limits:['Actual mouse top-cap selection uses a read-only world projection; no select/pick mutation hooks.',
 'Independent Fraction interval/midpoint uses original native endpoints plus represented distance. Kernel/Model/public/Studio mass are asserted; native B-rep quadrature is recorded separately.',
 'Z-upright provider only. X/Y and generic transformed providers are separate; no global central-inertia or exact pi claim.',
 'Tiny Float32 bounds and pixels cannot resolve the normal interval. Screenshot review proves UI presence only.',
 'Mass queries preserve authored source nodes; the added Offset profile remains an owned snapshot with no live face association claim.',
 'Successful Offset Apply clears geometry picks; Undo/Redo proves exact recipes and records selection without claiming restoration of the original face pick.',
 'Native geometry success does not replace root screenshot review.']};
let phase='public seed preparation',server,browser,context,page,inspectorBundle;
const persist=()=>writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const generator=`import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part,Location} from '../../packages/barocss-cad-model/src/api/index.ts';
const source=part('D343 translated cylinder').cylinder({r:3,h:5.00009}).moved(Location.at([.1234567,-.2345678,.3456789])).box({w:12,d:7,h:5,x:80,y:-3,z:1});
assert.equal(source.bodies().length,2);writeFileSync(process.argv[2],JSON.stringify(source.doc,null,2));`;
const inspector=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {partSnapshot,bodyKeyOf} from '../../packages/barocss-cad-model/src/engine/part.ts';
import {brepMassProperties,massPropertiesOf,checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D343 native and provider read',doc),view=evaluateDoc(doc,0),snapshot=partSnapshot(doc);assert.equal(view.ok,true,JSON.stringify(view));
function quadrature(brep){try{return brepMassProperties(brep,1);}catch(e){return {error:e instanceof Error?e.message:String(e)};}}
const bodies=partBreps(doc).map(({key,brep})=>{const displayed=view.bodies.find(b=>b.key===key),output=snapshot.outputs.find(o=>bodyKeyOf(o.id,doc.nodes)===key);assert.ok(output);return {key,ref:displayed.ref??null,brep,check:checkBrep(brep,{strict:true}),kernelRepresentation:output.representation,kernelMass:massPropertiesOf(output,1),nativeQuadrature:quadrature(brep),
 modelMass:{volume:displayed.volume,centroid:displayed.centroid},publicMass:p.body(key).mass({density:1}),publicNames:p.body(key).select().faces().names().sort(),nativeNames:brep.faces.map(f=>f.name),
 structure:{nativeSolidCount:brep.bodies.filter(b=>b.kind==='solid').length,nativeShellCount:brep.shells.length,nativeClosedShellCount:brep.shells.filter(s=>s.closed).length},
 displayBodyIndex:view.bodies.findIndex(b=>b.key===key),displayFaces:displayed.mesh.faces.map((f,index)=>({index,name:f.name,kind:f.kind,normal:f.normal,centroid:f.centroid}))};});assert.equal(JSON.stringify(doc),before,'Provider queries cannot change authored document');console.log(JSON.stringify({bodies}));`;
const independentOracle="\"\"\"Independent exact stored-interval cylinder authority. Product imports: zero.\"\"\"\nimport json,math,sys\nfrom fractions import Fraction as F\n\ndef q(v):return F.from_float(v) if isinstance(v,float) else F(v)\ndef emit(x):return {'numerator':str(x.numerator),'denominator':str(x.denominator),'value':float(x)}\ndef normal_bounds(b):\n values=[q(v['point'][2]) for v in b['vertices']];return min(values),max(values)\ndef tangent_bounds(b):\n points=[p for edge in b['edges'] for p in edge['curve']['controlPoints']]\n return [[min(q(p[k]) for p in points),max(q(p[k]) for p in points)] for k in range(2)]\nif __name__=='__main__':\n data=json.load(sys.stdin);original=data['original'];actual=data['actual'];ob=original['brep'];b=actual['brep'];lo,old=normal_bounds(ob);intended=old+q(data['distance']);hi=q(float(intended));gap=hi-lo;assert gap>0\n assert any(all(q(p[2])==old for row in f['surface'].get('controlPoints',[]) for p in row) and f['surface'].get('controlPoints') for f in ob['faces']),'Original selected cap has exact constant normal coefficients'\n actualLo,actualHi=normal_bounds(b);assert (actualLo,actualHi)==(lo,hi),'Actual native endpoints equal original authority plus once-rounded distance'\n if data['distance']==-5.00009:assert lo==q(.3456789) and hi==q(.34567890000000023) and gap==F(1,4503599627370496),'Captured physical residue is the exact four-ulp interval'\n assert len(b['bodies'])==1 and b['bodies'][0]['kind']=='solid';assert len(b['shells'])==1 and b['shells'][0]['closed'];assert actual['check']['valid']\n caps=[]\n for face in b['faces']:\n  poles=[p for row in face['surface']['controlPoints'] for p in row];assert all(lo<=q(p[2])<=hi for p in poles),'All normal coefficients lie inside actual interval'\n  if all(p[2]==poles[0][2] for p in poles):caps.append({'name':face.get('name'),'level':poles[0][2]})\n assert {q(c['level']) for c in caps}=={lo,hi},'Two exact native cap levels required; no old exposed cap'\n assert all(q(c['level'])!=old for c in caps),'Old cap cannot remain exposed'\n beforeFoot=tangent_bounds(ob);afterFoot=tangent_bounds(b)\n assert all(abs(x-y)<=q(1e-7) for a,c in zip(beforeFoot,afterFoot) for x,y in zip(a,c)),'Native tangent boundary footprint unchanged'\n midpoint=(lo+hi)/2;ulp=q(math.nextafter(float(midpoint),math.inf))-q(float(midpoint));tolerance=8*ulp;volumeGuide=math.pi*9*float(gap);pipelines=[]\n for name,mass in [('kernelMassPropertiesOf',actual['kernelMass']),('publicPart',actual['publicMass']),('actualModelEvaluate',actual['modelMass']),('actualStudioModel',data['studio']['target'])]:\n  assert mass['volume']>0 and math.isfinite(mass['volume']),(name,'positive finite volume');z=q(mass['centroid'][2]);assert lo<=z<=hi,(name,'centroid outside exact physical interval',mass['centroid'][2]);assert abs(z-midpoint)<=tolerance,(name,'normal midpoint')\n  assert abs(mass['volume']/volumeGuide-1)<1e-10,(name,'rounded circle analytic volume guide')\n  assert abs(mass['centroid'][0]-.1234567)<=1e-7 and abs(mass['centroid'][1]+.2345678)<=1e-7,(name,'tangent centroid')\n  pipelines.append({'name':name,'volume':mass['volume'],'centroid':mass['centroid'],'normalError':emit(z-midpoint),'withinExactStoredInterval':True})\n assert data['studio']['target']['key']==actual['key'];assert actual['kernelMass']['method']=='closed-form'\n quadrature=actual['nativeQuadrature'];quadratureReport={'observed':quadrature,'scope':'Separate B-rep quadrature provider; not repaired or certified by the two longitudinal formulas'}\n if 'volume' in quadrature:quadratureReport['relativeVolumeDifferenceToRoundedCircleGuide']=quadrature['volume']/volumeGuide-1\n print(json.dumps({'status':'PASS','expected':{'lower':emit(lo),'oldCap':emit(old),'intendedUpperBeforeRounding':emit(intended),'storedUpper':emit(hi),'gap':emit(gap),'normalMidpoint':emit(midpoint),'normalToleranceEightMidpointUlps':emit(tolerance),'circleVolumeRoundedPiGuide':volumeGuide},'pipelines':pipelines,'nativeCaps':caps,'nativeStructure':{'solidCount':sum(v['kind']=='solid' for v in b['bodies']),'shellCount':len(b['shells'])},'tangentFootprint':[[emit(v) for v in r] for r in afterFoot],'nativeQuadrature':quadratureReport,'scope':'Z-upright closed-form mass only; no central inertia, generic transformed provider, exact pi, Float32 interval or global mass claim'},indent=2))\n";
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
async function readNative(label){
 const accepted=await doc(),file=join(output,`${label}-native-read.bcad`);await writeFile(file,JSON.stringify(accepted));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:24*1024*1024});await writeFile(join(output,`${label}-native.stderr.txt`),run.stderr??'');await writeFile(join(output,`${label}-native.raw.json`),run.stdout??'');assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);
 assert.equal(result.bodies.length,2);const witness=report.witness?result.bodies.find(b=>b.key===report.witness.key):result.bodies.find(b=>Math.abs(b.kernelMass.volume-420)<1e-7&&b.kernelMass.centroid.every((v,i)=>Math.abs(v-[86,.5,3.5][i])<1e-7)),target=result.bodies.find(b=>b!==witness);assert.ok(witness&&target);
 close(witness.kernelMass.volume,420,'Witness volume');witness.kernelMass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));report.witness??={key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames};assert.deepEqual({key:witness.key,publicNames:witness.publicNames,nativeNames:witness.nativeNames},report.witness);
 for(const b of result.bodies){assert.equal(b.check.valid,true,JSON.stringify(b.check));assert.deepEqual(b.check.issues,[]);assert.equal(b.structure.nativeSolidCount,1,'Each Model body contains one actual native solid');assert.equal(b.brep.bodies.length,1);assert.equal(b.structure.nativeShellCount,1);assert.equal(b.structure.nativeClosedShellCount,1);assert.equal(new Set(b.nativeNames).size,b.nativeNames.length);assert.equal(new Set(b.publicNames).size,b.publicNames.length);}
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
async function massProof(original,actual,distance,label){
 const studio=await captureStudioMass(actual,label),input={original,actual,distance,studio};await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
 const run=spawnSync('python3',[join(output,'mass-oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:12*1024*1024});await writeFile(join(output,`${label}-oracle.stdout.json`),run.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);const verified=JSON.parse(run.stdout);report.oracles.push({label,verified});await persist();return verified;
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
const inputs=['apps/cad-studio/test/prismatic-mass-stability-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/Hud.tsx','apps/cad-studio/src/ui/NodeEditor.tsx','apps/cad-studio/vite.config.ts',
 'packages/barocss-cad-model/src/app/profileCommands.ts','packages/barocss-cad-model/src/app/nativeOffsetFace.ts','packages/barocss-cad-model/src/app/editFields.ts','packages/barocss-cad-model/src/engine/evaluate.ts','packages/barocss-cad-model/src/app/faceProfile.ts','packages/barocss-cad-model/src/sketch/plane.ts','packages/barocss-cad/src/brep/solid-mass.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files){const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort();assert.ok(names.length<=4096);const hashes={};for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));await writeFile(join(output,`source-${label}.json`),JSON.stringify({count:names.length,hashes},null,2));return hashes;}
let frozenFiles=inputs;
try{
 report.sourceBefore=await capsule('before-generation',inputs);report.sourceBeforeCount=Object.keys(report.sourceBefore).length;
 for(const[file,label]of [['/tmp/d343-plan/plan.md','plan.md'],['/tmp/d343-kernel/receipt.md','kernel-receipt.md'],['/tmp/d342-nearfull/receipt.md','historical-consumer-receipt.md']]){const bytes=await readFile(file);await writeFile(join(output,label),bytes);report.referenceSources??=[];report.referenceSources.push({file,label,sha256:hash(bytes),scope:'Previous source/baseline reference, not this browser qualification'});}
 await writeFile(join(output,'mass-oracle.py'),independentOracle);report.oracleSource={file:'mass-oracle.py',sha256:hash(independentOracle),productionImports:0};
 const buildInputs=[];async function compile(label,contents){const sourcefile=`d343-${label}.ts`,virtual=resolve(app,sourcefile);const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});await writeFile(join(output,`${label}.ts`),contents);await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin has no disk input. Save exact source/hash separately and exclude it explicitly.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));const file=join(output,`${label}.mjs`);await writeFile(file,built.outputFiles[0].contents);report.generatorSources??=[];report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual});return file;}
 const seedBundle=await compile('seed-generator',generator);inspectorBundle=await compile('native-inspector',inspector);const seedFile=join(output,'seed.bcad');const run=spawnSync(process.execPath,[seedBundle,seedFile],{encoding:'utf8'});
 await writeFile(join(output,'seed.stdout.txt'),run.stdout??'');await writeFile(join(output,'seed.stderr.txt'),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs];report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);report.sourceFrozenCount=Object.keys(report.sourceFrozen).length;for(const[file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start';server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});});await server.listen();const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-translated-cylinder-source');const original=await readNative('01-original');await pickTop(original,'02-original-top');const distance=-5.00009;await openOffset(distance);assert.equal(await hud().getByLabel('Offset',{exact:true}).inputValue(),'-5.00009');await acceptedPreview(seed.doc,'03-captured-inward-preview');
 const accepted=await applyOffset(seed.doc,'04-captured-inward-applied');assert.equal(accepted.nodes.at(-1).kind,'difference');const generatedNodes=accepted.nodes.slice(seed.doc.nodes.length);assert.equal(generatedNodes[1].height,5.00009);assert.equal(generatedNodes[1].from,-5.00009);assert.equal(generatedNodes[0].plane.origin[2],Math.max(...original.brep.vertices.map(v=>v.point[2])));report.capturedRequest={numericOffset:distance,hudValue:'-5.00009',generatedNodes,sourcePrefixUnchanged:true,scope:'Actual raw existing sketch/extrude/difference recipe, with unrounded height/from and original native cap coordinate'};const thin=await readNative('04-captured-thin');await massProof(original,thin,distance,'04-captured-thin');await isoSnapshot('04-thin-ui-presence-only');report.profiles.push({kind:'captured-upright-translated-cylinder',radius:3,sourceHeight:5.00009,distance,visualScope:'UI accepted state/renderer presence only; Float32 pixels cannot prove positive normal interval'});
 await undo(seed.doc,'05-undo-exact-source');await redo(accepted,'06-redo-exact-thin-recipe');const redone=await readNative('06-redone-thin');await massProof(original,redone,distance,'06-redone-thin');assert.deepEqual(redone.nativeNames,thin.nativeNames);assert.deepEqual(redone.publicNames,thin.publicNames);
 const saved=await save('captured-thin');await freshOpen(saved,'07-thin-fresh-open');const reopened=await readNative('07-reopened-thin');await massProof(original,reopened,distance,'07-reopened-thin');assert.deepEqual(reopened.nativeNames,thin.nativeNames);assert.deepEqual(reopened.publicNames,thin.publicNames);assert.deepEqual((await doc()).nodes.slice(0,seed.doc.nodes.length),seed.doc.nodes);await isoSnapshot('08-reopened-thin-ui-presence-only');
 await freshOpen(seed,'09-visible-control-source');const controlOriginal=await readNative('09-visible-original');await pickTop(controlOriginal,'10-control-top');await openOffset(2);await acceptedPreview(seed.doc,'11-visible-control-preview');await applyOffset(seed.doc,'12-visible-control-applied');const control=await readNative('12-visible-control');await massProof(controlOriginal,control,2,'12-visible-control');await isoSnapshot('13-visible-control-iso');report.profiles.push({kind:'ordinary-visible-translated-cylinder',radius:3,sourceHeight:5.00009,distance:2});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.changes,[]);report.sourceAfter=await capsule('after-browser',frozenFiles);report.sourceAfterCount=Object.keys(report.sourceAfter).length;assert.deepEqual(report.sourceAfter,report.sourceFrozen);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack??String(error);process.exitCode=1;if(page)try{await snapshot('failure');}catch(e){report.captureFailure=e.stack??String(e);}}
finally{for(const[resource,label]of[[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]){if(!resource)continue;try{await resource.close();report.cleanup.push(`${label}_CLOSED`);}catch(e){report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try{report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles);report.sourceAfterCleanupCount=Object.keys(report.sourceAfterCleanup).length;if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);}catch(e){report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist();console.log(JSON.stringify({status:report.status,qualification:report.qualification,visualReview:report.visualReview,phase,failure:report.failure,output}));}
