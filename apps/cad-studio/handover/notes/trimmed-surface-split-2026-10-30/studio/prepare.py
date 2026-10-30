from pathlib import Path
root=Path('/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b')
old=(root/'apps/cad-studio/test/thicken-snapshot-browser.mjs').read_text()
helpers=old[old.index('const doc ='):old.index('async function openThicken')]
helpers=helpers.replace("const hud = () => page.getByRole('dialog',{name:'Thicken',exact:true});\n",'').replace("const editor = () => page.locator('.node-editor');\n",'')
# Existing snapshots also capture shown state; no hook mutation is used.
save=old[old.index('async function save('):old.index('async function geometry(')]
undo=old[old.index('async function undo('):old.index('const inputs=')]
verifier=Path('/tmp/d340-studio/material-verifier.py').read_text()
script=r'''// D340: root must freeze all source writers before generation or browser execution.
// D340_SOURCE_FROZEN=1 PW_DIR=/absolute/playwright CHROME=/absolute/chrome \
//   node test/trimmed-surface-split-browser.mjs /absolute/artifacts
// One Chrome WebGPU process; serial contexts. Public UI mutates; hooks only observe.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {createServer} from 'vite';
assert.equal(process.env.D340_SOURCE_FROZEN,'1','Root must freeze all writers before D340 execution');
assert.ok(process.env.PW_DIR&&process.env.CHROME&&process.argv[2],'PW_DIR, CHROME and artifact directory required');
const app=resolve(import.meta.dirname,'..'),repo=resolve(app,'../..'),output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={status:'RUNNING',qualification:'NUMERIC_AND_UI_FLOW_ONLY',visualReview:'ROOT_MUST_VIEW_SCREENSHOTS',profiles:[],states:[],material:[],refusals:[],errors:[],consoleErrors:[],changes:[],downloads:[],files:[],cleanup:[],
 limits:['Surface material area and centroid are distinct from closed-solid mass.',
 'Independent oracle receives actual original stored160 UV values and represented binary64 cut; ideal240 is not substituted.',
 'Child evaluator comparisons are local trim-vertex observations only. Whole-child coefficient/Jacobian certificates require separate native tests.',
 'Numeric/UI success does not prove visual quality. Root must inspect screenshots for missing regions or overlap.',
 'One original affine support and one stored simple loop only; no repeated-operation or generic curved trim acceptance.']};
let phase='public seed preparation',server,browser,context,page,inspectorBundle;
const persist=()=>writeFile(join(output,'receipt.json'),JSON.stringify({...report,phase},null,2));
const fixtureCSS=`@model d340 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,3]]]; weights:[[1,1],[1,1]]; }
 @curve #u-loop { type:nurbs; degree:1; knots:[0,0,1,2,3,4,5,6,7,8,8]; control-points:[[15,-1,3],[35,-1,3],[35,15,3],[29,15,3],[29,5,3],[21,5,3],[21,15,3],[15,15,3],[15,-1,3]]; weights:[1,1,1,1,1,1,1,1,1]; }
}`;
const unsupportedCSS=`@model warped { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1; knots-u:[-2,-2,6,6]; knots-v:[1,1,7,7]; control-points:[[[10,-6,3],[10,24,3]],[[50,-6,3],[50,24,4]]]; weights:[[1,1],[1,1]]; }
 @curve #loop { type:nurbs; degree:1; knots:[0,0,1,2,3,4,4]; control-points:[[15,-1,3.0208333333333335],[25,-1,3.0625],[25,9,3.1875],[15,9,3.0625],[15,-1,3.0208333333333335]]; weights:[1,1,1,1,1]; }
}`;
const generator=`import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {emptyDirect,importSource} from '../../packages/barocss-cad-model/src/engine/direct.ts';
const witness=part('D340 witness').box({w:12,d:7,h:5,x:80,y:-3,z:1});
for(const [file,source]of [[process.argv[2],${JSON.stringify(fixtureCSS)}],[process.argv[3],${JSON.stringify(unsupportedCSS)}]]){
 const direct=importSource(emptyDirect(),source,'D340');assert.ok(direct.objects.every(o=>!o.trims));
 writeFileSync(file,JSON.stringify({...witness.doc,direct},null,2)+'\\n');}`;
const inspector=`import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {compileCadModel,surfaceEvaluator} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D340 witness read',doc);
assert.equal(p.bodies().length,1);const key=p.bodies()[0],mass=p.body(key).mass({density:1});
const objects=doc.direct.objects.filter(o=>o.trims?.length&&!o.hidden).map(o=>{
 const compiled=compileCadModel(doc.direct.sources[o.source],{sourceVersion:0});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
 const surface=compiled.model.objects.find(s=>s.id===o.geometry);assert.equal(surface?.kind,'surface');
 const evaluate=surfaceEvaluator(surface),domain={u:[surface.knotsU[surface.degreeU],surface.knotsU[surface.knotsU.length-surface.degreeU-1]],v:[surface.knotsV[surface.degreeV],surface.knotsV[surface.knotsV.length-surface.degreeV-1]]};
 const observations=o.trims.flatMap(loop=>loop.uv.map(([u,v])=>({uv:[u,v],actualWorld:evaluate(u,v),authorityWorld:[20+5*u,-11+5*v,3]})));
 return {...o,domain,surface,observations};
});console.log(JSON.stringify({witness:{key,mass,names:p.body(key).select().faces().names().sort()},objects}));`;
'''
import json
script+='const independentVerifier='+json.dumps(verifier)+';\n'+helpers+save+undo
script+=r'''async function dismissNotice(){const toast=page.locator('.toast[role="alert"]');if(await toast.count())await toast.getByRole('button',{name:'Dismiss',exact:true}).click();await toast.waitFor({state:'hidden'});}
async function trim(keep,label){
 phase=`actual Trim ${keep}`;await select('obj_1');await select('obj_2',true);await panel().getByLabel('Trim keeps',{exact:true}).selectOption(keep);
 const before=await doc();await panel().getByRole('button',{name:'Trim by the curve',exact:true}).click();await changed(before);const state=await doc();
 assert.equal(byId(state,'obj_1').trims.length,1);assert.equal(byId(state,'obj_1').trims[0].uv.length,160);assert.equal(byId(state,'obj_1').trims[0].keep,keep);assert.deepEqual(state.nodes,before.nodes);await snapshot(label);return state;
}
async function split(trimmed,axis,parameter,label){
 phase=`actual Split ${axis} ${parameter}`;await select('obj_1');await panel().getByLabel('Surface direction',{exact:true}).selectOption(axis);await panel().getByLabel(`At ${axis}`,{exact:true}).fill(String(parameter));
 await panel().getByRole('button',{name:'Split',exact:true}).click();await changed(trimmed);const state=await doc(),added=state.direct.objects.filter(o=>!trimmed.direct.objects.some(old=>old.id===o.id));
 assert.deepEqual(byId(state,'obj_1'),{...byId(trimmed,'obj_1'),hidden:true},'Hidden original retains exact trim/source/name');assert.deepEqual(state.nodes,trimmed.nodes);
 assert.ok(added.length>0);assert.ok(added.every(o=>!o.hidden&&o.trims?.length>0));
 for(const object of trimmed.direct.objects.filter(o=>o.id!=='obj_1'))assert.deepEqual(byId(state,object.id),object,'Unrelated objects unchanged');
 await snapshot(label);return {state,added};
}
async function material(trimmed,splitResult,axis,parameter,label,counts){
 const file=join(output,`${label}-native-read.bcad`);await writeFile(file,JSON.stringify(splitResult.state));
 const run=spawnSync(process.execPath,[inspectorBundle,file],{encoding:'utf8',maxBuffer:16*1024*1024});await writeFile(join(output,`${label}-native.stderr.txt`),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const observed=JSON.parse(run.stdout),w=observed.witness;close(w.mass.volume,420,'Witness volume');w.mass.centroid.forEach((v,i)=>close(v,[86,.5,3.5][i],'Witness centroid'));
 report.witness??={key:w.key,names:w.names};assert.deepEqual({key:w.key,names:w.names},report.witness);
 const children=splitResult.added.map(o=>{const actual=observed.objects.find(x=>x.id===o.id);assert.ok(actual);const range=actual.domain[axis];const side=range[1]<=parameter?'lower':range[0]>=parameter?'upper':null;assert.ok(side,'Child native domain must lie on one side');return {...actual,side};});
 assert.deepEqual(['lower','upper'].map(side=>children.filter(c=>c.side===side).length),counts);
 assert.deepEqual(children.map(c=>c.side),[...children.map(c=>c.side)].sort((a,b)=>a==='lower'&&b==='upper'?-1:a==='upper'&&b==='lower'?1:0),'Lower components precede upper components');
 const expectedName=new RegExp(` · ${axis} (lower|upper) · region \\d+$`);assert.ok(children.every(c=>expectedName.test(c.name)));
 let maxVertexError=0,vertices=0;
 for(const child of children)for(const sample of child.observations){vertices++;for(let i=0;i<3;i++){const error=Math.abs(sample.actualWorld[i]-sample.authorityWorld[i]);maxVertexError=Math.max(maxVertexError,error);assert.ok(error<=1e-7,'Local actual-child evaluator / original authority');}}
 const original=byId(trimmed,'obj_1').trims[0],input={uv:original.uv,domain:{u:[-2,6],v:[1,7]},axis,parameter,keep:original.keep,children:children.map(c=>({id:c.id,side:c.side,trims:c.trims}))};
 await writeFile(join(output,`${label}-oracle-input.json`),JSON.stringify(input,null,2));
 const oracle=spawnSync('python3',[join(output,'material-verifier.py'),join(output,'oracle.py')],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:16*1024*1024});
 await writeFile(join(output,`${label}-oracle.stdout.json`),oracle.stdout??'');await writeFile(join(output,`${label}-oracle.stderr.txt`),oracle.stderr??'');assert.equal(oracle.status,0,oracle.stderr);
 const verified=JSON.parse(oracle.stdout),evidence={label,counts,verified,localNativeObservations:{vertices,maxCoordinateError:maxVertexError,tolerance:1e-7,scope:'Stored trim vertices only; not whole-child regularity or embedding certification'},
 children:children.map(c=>({id:c.id,name:c.name,source:c.source,geometry:c.geometry,domain:c.domain,trims:c.trims})),sourceSharing:children.map(c=>({id:c.id,source:c.source,geometry:c.geometry}))};
 report.material.push(evidence);await writeFile(join(output,`${label}-material.json`),JSON.stringify(evidence,null,2));await persist();return evidence;
}
async function refuse(label,action,pattern){
 phase=`refusal ${label}`;await dismissNotice();const before=await doc(),selection=await page.locator('.ol.direct.sel').allTextContents(),downloads=report.downloads.length;
 await action();await page.locator('.toast[role="alert"]').waitFor();const notice=await page.locator('.toast[role="alert"]').textContent();assert.match(notice,pattern);await same(before);
 assert.deepEqual(await page.locator('.ol.direct.sel').allTextContents(),selection);assert.equal(report.downloads.length,downloads);
 report.refusals.push({label,notice,documentUnchanged:true,selectionUnchanged:true,noDownload:true});await snapshot(`guard-${label}`);
}
const inputs=['apps/cad-studio/test/trimmed-surface-split-browser.mjs','apps/cad-studio/src/App.tsx','apps/cad-studio/src/ui/DirectPanel.tsx','apps/cad-studio/src/ui/DirectInspector.tsx','apps/cad-studio/vite.config.ts',
 'packages/barocss-cad-model/src/engine/direct.ts','packages/barocss-cad-model/src/engine/trim.ts','packages/barocss-cad/src/index.ts','packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-parameter-split.ts',
 'packages/barocss-cad/src/nurbs/surfaces/surface-parameter-split.ts','packages/barocss-cad/src/brep/planar-arrangement.ts','packages/barocss-cad/dist/index.js'];
async function capsule(label,files){const names=[...new Set(files.map(file=>relative(repo,resolve(repo,file))))].sort();assert.ok(names.length<=4096);const hashes={};for(const file of names)hashes[file]=hash(await readFile(resolve(repo,file)));await writeFile(join(output,`source-${label}.json`),JSON.stringify({count:names.length,hashes},null,2));return hashes;}
let frozenFiles=inputs;
try{
 report.sourceBefore=await capsule('before-generation',inputs);report.sourceBeforeCount=Object.keys(report.sourceBefore).length;
 for(const name of ['oracle.py','oracle.json']){const bytes=await readFile(`/tmp/d340-plan/${name}`);await writeFile(join(output,name),bytes);report.independentSources??=[];report.independentSources.push({name,sha256:hash(bytes)});}
 await writeFile(join(output,'material-verifier.py'),independentVerifier);report.independentSources.push({name:'material-verifier.py',sha256:hash(independentVerifier)});
 const buildInputs=[];async function compile(label,contents){const sourcefile=`d340-${label}.ts`,virtual=resolve(app,sourcefile);const built=await build({stdin:{contents,resolveDir:app,sourcefile,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',write:false,metafile:true});
  await writeFile(join(output,`${label}.ts`),contents);await writeFile(join(output,`${label}-metafile.json`),JSON.stringify(built.metafile,null,2));
  // Virtual stdin is excluded from disk capsules; its exact saved contents and hash remain evidence.
  buildInputs.push(...Object.keys(built.metafile.inputs).map(file=>resolve(file)).filter(file=>file!==virtual));const file=join(output,`${label}.mjs`);await writeFile(file,built.outputFiles[0].contents);report.generatorSources??=[];report.generatorSources.push({label,sha256:hash(contents),virtualInputExcluded:virtual});return file;}
 const seedBundle=await compile('seed-generator',generator);inspectorBundle=await compile('native-inspector',inspector);const seedFile=join(output,'seed.bcad'),warpedFile=join(output,'warped-seed.bcad');
 const run=spawnSync(process.execPath,[seedBundle,seedFile,warpedFile],{encoding:'utf8'});await writeFile(join(output,'seed.stdout.txt'),run.stdout??'');await writeFile(join(output,'seed.stderr.txt'),run.stderr??'');assert.equal(run.status,0,run.stderr);
 const seed={file:seedFile,doc:JSON.parse(await readFile(seedFile,'utf8'))},warped={file:warpedFile,doc:JSON.parse(await readFile(warpedFile,'utf8'))};
 frozenFiles=[...inputs,...buildInputs];report.sourceFrozen=await capsule('frozen-before-browser',frozenFiles);report.sourceFrozenCount=Object.keys(report.sourceFrozen).length;for(const[file,digest]of Object.entries(report.sourceBefore))assert.equal(report.sourceFrozen[file],digest,`Source changed during generation: ${file}`);
 phase='actual Studio start';server=await createServer({root:app,configFile:join(app,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});server.watcher.on('all',(event,file)=>{if(['change','add','unlink'].includes(event))report.changes.push({event,file});});await server.listen();
 const {chromium}=createRequire(join(process.env.PW_DIR,'package.json'))('playwright');browser=await chromium.launch({executablePath:process.env.CHROME,headless:true,args:['--enable-unsafe-webgpu']});report.chromeProcessesLaunched=1;
 await freshOpen(seed,'01-inside-seed');const inside=await trim('inside','02-actual-inside-trim160'),insideSplit=await split(inside,'v',3.7,'03-inside-split-three-regions');await material(inside,insideSplit,'v',3.7,'03-inside',[1,2]);report.profiles.push({keep:'inside',axis:'v',parameter:3.7,counts:[1,2]});
 await undo(inside,'04-undo-exact-original-trim');await redo(insideSplit.state,'05-redo-exact-components');
 const saved=await save('inside-three-regions');await freshOpen(saved,'06-inside-fresh-open');await material(inside,{state:await doc(),added:insideSplit.added},'v',3.7,'06-inside-reopen',[1,2]);
 const component=insideSplit.added[1];await select(component.id);phase='rename one component';const beforeRename=await doc(),renamedName=`${component.name} · editable`;
 await panel().getByLabel('Object name',{exact:true}).fill(renamedName);await panel().getByLabel('Object name',{exact:true}).press('Enter');await changed(beforeRename);const renamed=await doc();assert.deepEqual(byId(renamed,component.id),{...byId(beforeRename,component.id),name:renamedName});assert.deepEqual(renamed.nodes,beforeRename.nodes);await snapshot('07-component-renamed');
 const renamedSaved=await save('inside-renamed');await freshOpen(renamedSaved,'08-renamed-fresh-open');await select(component.id);assert.equal(await panel().getByLabel('Object name',{exact:true}).inputValue(),renamedName);await snapshot('09-renamed-reeditable');
 // Existing consumer refusals continue to see explicit component masks.
 await select(insideSplit.added[0].id);await refuse('component-iges',()=>page.getByRole('button',{name:'Export IGES',exact:true}).click(),/does not preserve surface trims|trim/i);
 await refuse('component-thicken',()=>panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(),/trim|whole surface/i);await select(insideSplit.added[1].id,true);
 await refuse('component-sew',()=>panel().getByRole('button',{name:'Sew into a body',exact:true}).click(),/trim|whole surface/i);
 // Guards add no Undo entry: a native fresh Open has no prior edit; create one rename then guard it.
 await dismissNotice();await select(component.id);const guardBase=await doc();await panel().getByLabel('Object name',{exact:true}).fill(`${renamedName} guard`);await panel().getByLabel('Object name',{exact:true}).press('Enter');await changed(guardBase);const guardEdited=await doc();
 await refuse('rename-then-thicken',()=>panel().getByRole('button',{name:'Thicken into a body',exact:true}).click(),/trim|whole surface/i);await undo(guardBase,'10-guard-no-undo-entry');await redo(guardEdited,'11-redo-rename-after-guard');
 await freshOpen(seed,'12-outside-seed');const outside=await trim('outside','13-actual-outside-trim160'),outsideSplit=await split(outside,'v',3.7,'14-outside-three-regions-with-pocket');await material(outside,outsideSplit,'v',3.7,'14-outside',[2,1]);report.profiles.push({keep:'outside',axis:'v',parameter:3.7,counts:[2,1]});
 const outsideSaved=await save('outside-pocket');await freshOpen(outsideSaved,'15-outside-fresh-open');await material(outside,{state:await doc(),added:outsideSplit.added},'v',3.7,'15-outside-reopen',[2,1]);
 await freshOpen(seed,'16-empty-side-seed');const empty=await trim('inside','17-empty-side-trim160'),emptySplit=await split(empty,'v',5.7,'18-empty-upper-no-object');await material(empty,emptySplit,'v',5.7,'18-empty-upper',[1,0]);report.profiles.push({keep:'inside',axis:'v',parameter:5.7,counts:[1,0]});
 const emptySaved=await save('empty-upper');await freshOpen(emptySaved,'19-empty-upper-fresh-open');await material(empty,{state:await doc(),added:emptySplit.added},'v',5.7,'19-empty-upper-reopen',[1,0]);
 await freshOpen(warped,'20-warped-seed');const warpedTrim=await trim('inside','21-warped-actual-trim160');await select('obj_1');await panel().getByLabel('Surface direction',{exact:true}).selectOption('v');await panel().getByLabel('At v',{exact:true}).fill('3.7');
 await refuse('nonaffine-original-split',()=>panel().getByRole('button',{name:'Split',exact:true}).click(),/affine|support|planar|TRIMMED_SURFACE/i);await undo(warped.doc,'22-nonaffine-no-undo-entry');await redo(warpedTrim,'23-redo-warped-trim');report.profiles.push({kind:'nonaffine-original-refusal'});
 await freshOpen(seed,'24-valid-retry-seed');const retry=await trim('inside','25-valid-retry-trim160'),retrySplit=await split(retry,'v',3.7,'26-valid-retry-split');await material(retry,retrySplit,'v',3.7,'26-valid-retry',[1,2]);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.changes,[]);report.sourceAfter=await capsule('after-browser',frozenFiles);report.sourceAfterCount=Object.keys(report.sourceAfter).length;assert.deepEqual(report.sourceAfter,report.sourceFrozen);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack??String(error);process.exitCode=1;if(page)try{await snapshot('failure');}catch(e){report.captureFailure=e.stack??String(e);}}
finally{for(const[resource,label]of[[context,'CONTEXT'],[browser,'BROWSER'],[server,'SERVER']]){if(!resource)continue;try{await resource.close();report.cleanup.push(`${label}_CLOSED`);}catch(e){report.cleanup.push({label,error:e.stack??String(e)});report.status='FAIL';process.exitCode=1;}}
 try{report.sourceAfterCleanup=await capsule('after-cleanup',frozenFiles);report.sourceAfterCleanupCount=Object.keys(report.sourceAfterCleanup).length;if(report.sourceFrozen)assert.deepEqual(report.sourceAfterCleanup,report.sourceFrozen);}catch(e){report.sourceCapsuleFailure=e.stack??String(e);report.status='FAIL';process.exitCode=1;}
 await persist();console.log(JSON.stringify({status:report.status,qualification:report.qualification,visualReview:report.visualReview,phase,failure:report.failure,output}));}
'''
(root/'apps/cad-studio/test/trimmed-surface-split-browser.mjs').write_text(script)
