/** #1159: authored linear workplanes composed with selected native world-Curve CPU previews.
 * After the affected GPU build: node examples/gpu-scene/workplane-world-curve-preview-flow.mjs
 * --fixtures <native1148-input-directory> --output <new-directory>.
 * Authored local intent remains separate from generated child Source0 and samples.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function option(name){const i=process.argv.indexOf(name);assert(i>=0&&process.argv[i+1],name+' required');return resolve(process.argv[i+1]);}
const output=option('--output'),fixtureRoot=option('--fixtures');await mkdir(output,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};}
// Example-only owned-result/preview emission preserves -0, separate from authored codec.
function nativeJSON(v){if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(nativeJSON).join(',')+']';return '{'+Object.entries(v).map(([k,n])=>JSON.stringify(k)+':'+nativeJSON(n)).join(',')+'}';}
const clone=v=>JSON.parse(nativeJSON(v));
// Pinned native request / authored codec hashes; explicit caller-order world selectors.
const fixtures=[
 [
  "actual_oblique_line_polyline_rectangle",
  "8c7156826103e2bcadc7e3d056971ef9191f196b20e2a3619f454f0d2cf375ed",
  "56442e0df9339628a6907d4a66af1b9da6155609a9ade67cf448e95f72a8c0ac",
  [
   "world_line_profile",
   "world_poly_profile",
   "world_rectangle_profile"
  ],
  9
 ],
 [
  "authored_point_upsert_stable_world_ids",
  "ebb3f7176cbcb3975dfa2a9543e1573657a2d2c5a3133ce27499ad8c8ba1cab9",
  "9a06be62e4a748298d6a308e7fa30210bf1403a42c44fd1ea7d33b3a452970da",
  [
   "world_line_profile",
   "world_poly_profile",
   "world_rectangle_profile"
  ],
  9
 ],
 [
  "plane_orientation_update_zero_local_edits",
  "fd9ba01ddb18d4bc02e8e4b3e09811699f2bd7f92dea8371d5f90aa4e91e33f6",
  "6d25d6cc3a2b7666feba3c7c1550ba2bce835e96b82d7211090df3b1d2dc3f37",
  [
   "world_line_profile",
   "world_poly_profile",
   "world_rectangle_profile"
  ],
  9
 ],
 [
  "actual_64_point_polyline_127_observations",
  "8d690e0b5e0ac94b229df1d6876af868046a06aa24f12e15696e88c678ba4b7a",
  "b0923c59e07b53b5b87014e53dcba5d816d6dd4135d4621da803345853bfddfc",
  [
   "world_maximum_polyline"
  ],
  129
 ],
 [
  "empty_actual_children_sources_bindings",
  "3037826ff0d2b5eb3dea8110b3bc9b70175881cc5535c98edfd1c1b316da0789",
  "547a06c8b62f56dc75d0bc0e081ef904f8ff29833a577eec5ccc8813b2860ad4",
  [],
  9
 ],
 [
  "actual_eight_profiles_aggregate_bound",
  "ef556c1f82bbb4f3e9d05df9daa4064334c65d151e4ac09d307e06873084e590",
  "d392c09d213258f46dab62bf1d159b04eb9311d3e4b82eefc37c1eb891acfb58",
  [
   "world_eight_line_0",
   "world_eight_line_1",
   "world_eight_line_2",
   "world_eight_line_3"
  ],
  9
 ]
];
const inputs=[];
for(const[name,requestHash,authoredHash,ids,count]of fixtures){
 const paths=['authored-request.json','authored-workplane.json'].map(s=>resolve(fixtureRoot,name+'.'+s)),bytes=await Promise.all(paths.map(p=>readFile(p)));
 [requestHash,authoredHash].forEach((hash,i)=>assert.equal(sha(bytes[i]),hash,name+' pinned input '+i));
 inputs.push({name,request:JSON.parse(bytes[0]),authored:bytes[1].toString(),ids,count,files:await Promise.all(paths.map(receipt))});
}
const manifests={};for(const name of ['cad','gpu']){const root=resolve(repo,'packages/barocss-'+name),manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));assert.equal(manifest.publishConfig.exports['.'].import,'./dist/index.js');manifests[name]={root,manifest};}
const ordinary=resolve(output,'ordinary-source.mjs'),sourceCode=['cad','gpu'].map(name=>`import * as ${name} from ${JSON.stringify(resolve(manifests[name].root,manifests[name].manifest.exports['.'].import))};`).join('\n')+'\nexport {cad,gpu};';
const built=await build({stdin:{contents:sourceCode,resolveDir:repo,sourcefile:'workplane-world-preview-source.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/workplane-sketch-document.ts')));assert(graph.some(p=>p.endsWith('/src/uniform-curve-preview.ts')));assert(!graph.some(p=>p.includes('barocss-cad/dist/')||p.includes('barocss-gpu/dist/')));
const providers=[{name:'ordinary-source',...await import(pathToFileURL(ordinary).href),files:[await receipt(ordinary)]}];
const emitted={name:'emitted-public',files:[]};for(const name of ['cad','gpu']){const{root,manifest}=manifests[name],entry=resolve(root,manifest.publishConfig.exports['.'].import);emitted[name]=await import(pathToFileURL(entry).href);emitted.files.push(await receipt(entry),await receipt(resolve(root,manifest.publishConfig.exports['.'].types)));}providers.push(emitted);
function select(native,ids){
 if(!Array.isArray(ids)||ids.length>4||new Set(ids).size!==ids.length)throw new RangeError('Example selection requires at most four unique current world IDs');
 if(native.profiles.length===0){if(ids.length!==0)throw new RangeError('Empty authored document requires empty selection');return [];}
 if(ids.length===0)throw new RangeError('Nonempty authored document requires one to four selected world IDs');
 return ids.map(id=>{const child=native.profiles.find(profile=>profile.worldCurveId===id);if(!child)throw new RangeError('Example selection world ID is absent from current authored document: '+id);return child;});
}
function matrixPoint(matrix,point){return [0,1,2].map(axis=>{const row=matrix.slice(axis*4,axis*4+4);return row[0]*point[0]+row[1]*point[1]+row[2]*point[2]+row[3];});}
function verifyNative(cad,native){
 assert.equal(native.document.format,'barocss-workplane-sketch');assert.equal(native.document.version,0);assert.equal(native.document.lengthUnit,'mm');assert.equal(native.document.localSketch.workplane,'xy');
 assert.equal(native.planeReport.accepted,true);assert.equal(native.planeReport.tolerance,1e-9);assert.equal(native.report.quality.exactRigidFrameCertified,false);
 assert.deepEqual(native.local.document,native.document.localSketch);assert.deepEqual(native.report.worldCurveIds,native.profiles.map(p=>p.worldCurveId));
 assert(!Object.isFrozen(native));assert(!Object.isFrozen(native.document));assert.notStrictEqual(native.request.document,native.document);
 for(const profile of native.profiles){
  const local=profile.local.evaluation.curve,world=profile.affine.geometry;
  assert.deepEqual(profile.affine.original,local);assert.deepEqual(profile.affine.matrix,native.matrix);assert.notEqual(local.id,world.id);assert.equal(world.id,profile.worldCurveId);
  for(const key of ['kind','degree','weights','knots'])assert.deepEqual(world[key],local[key]);assert.equal(world.controlPoints.length,local.controlPoints.length);
  const compiled=cad.compileCadModel(profile.affine.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,profile.affine.model);
  assert.deepEqual(compiled.model.objects.find(o=>o.id===profile.worldCurveId),world);
  const intent=native.document.localSketch.profiles.find(p=>p.id===profile.profileId);
  if(intent.kind==='rectangle'){
   const closing=native.worldPointBindings.find(b=>b.profileId===profile.profileId&&b.isClosing);
   assert(closing);assert.equal(closing.poleIndex,4);assert.equal(closing.parameter,4);assert.equal(closing.pointId,intent.cornerIds[0]);
   assert.deepEqual(world.controlPoints[4],world.controlPoints[0]);assert.deepEqual(local.controlPoints[4],local.controlPoints[0]);assert(profile.affine.report.derivativeRefusalCount>0);
  }
 }
}
function verifyPreview(cad,native,child,preview){
 assert.equal(preview.format,'barocss-gpu-uniform-curve-preview');assert.equal(preview.version,1);assert.equal(preview.profile,'native-selected-uniform-curve-v1');assert.equal(preview.sourceVersion,0);
 assert.equal(preview.source,child.affine.source);assert.equal(preview.curveId,child.worldCurveId);assert.deepEqual(preview.model,child.affine.model);
 const world=child.affine.geometry,local=child.local.evaluation.curve,samples=cad.sampleCurve(world,preview.count),localSamples=cad.sampleCurve(local,preview.count);
 assert.deepEqual(preview.parameters,samples.map(s=>s.parameter));assert.deepEqual(preview.pointsMM,samples.map(s=>s.point));assert.deepEqual(preview.parameters,localSamples.map(s=>s.parameter));
 let maximumMappedDifferenceMM=0;
 for(let i=0;i<samples.length;i++){
  const expected=matrixPoint(native.matrix,localSamples[i].point),actual=cad.evaluateCurve(world,preview.parameters[i]);assert.deepEqual(actual,preview.pointsMM[i]);
  const difference=Math.hypot(...expected.map((x,j)=>x-actual[j]));assert(difference<=1e-7,'Observed local/matrix/world D0 agreement');maximumMappedDifferenceMM=Math.max(maximumMappedDifferenceMM,difference);
 }
 assert(Object.isFrozen(preview));assert(Object.isFrozen(preview.model));assert(Object.isFrozen(preview.pointsMM));assert.notStrictEqual(preview.model,child.affine.model);
 return{worldCurveId:child.worldCurveId,count:preview.count,domain:[preview.parameters[0],preview.parameters.at(-1)],poles:world.controlPoints.length,knots:world.knots.length,maximumMappedDifferenceMM,nativeD1Refusals:child.affine.report.derivativeRefusalCount};
}
const results=[];
for(const provider of providers){
 const{cad,gpu,name}=provider;
 for(const fn of ['evaluateWorkplaneSketchDocument','updateWorkplaneSketchDocument','validateWorkplaneSketchDocument','serializeWorkplaneSketchDocument','parseWorkplaneSketchDocument','sampleCurve','evaluateCurve','compileCadModel'])assert.equal(typeof cad[fn],'function',name+' public '+fn);
 for(const fn of ['prepareSelectedUniformCurvePreview','validateSelectedUniformCurvePreview'])assert.equal(typeof gpu[fn],'function',name+' public '+fn);
 const dir=resolve(output,name);await mkdir(dir);const accepted=[],refusals=[];let current;
 const acceptedPaths=['accepted.authored-workplane.json','accepted.native.json','accepted.previews.json'].map(p=>resolve(dir,p));
 function prepare(request,ids,count){
  const before=clone(request),native=request.edit===null?cad.evaluateWorkplaneSketchDocument(request.document):cad.updateWorkplaneSketchDocument(request.document,request.edit);assert.deepEqual(request,before);
  const report=cad.validateWorkplaneSketchDocument(native);assert.deepEqual(report,native.report);assert.notStrictEqual(report,native.report);assert(!Object.isFrozen(report));
  const reportBits=nativeJSON(native.report);report.worldCurveIds.push('example_mutation');assert.equal(nativeJSON(native.report),reportBits,'Report does not alias owned native result');
  verifyNative(cad,native);
  const children=select(native,ids),observations=[];
  const previews=children.map(child=>{
   const preview=gpu.prepareSelectedUniformCurvePreview({source:child.affine.source,curveId:child.worldCurveId,count}),validated=gpu.validateSelectedUniformCurvePreview(preview);
   assert.deepEqual(validated,preview);assert.notStrictEqual(validated,preview);observations.push(verifyPreview(cad,native,child,preview));return preview;
  });
  assert.deepEqual(previews.map(p=>p.curveId),ids);return{native,selection:[...ids],count,previews,observations};
 }
 async function accept(value){const authored=cad.serializeWorkplaneSketchDocument(value.native.document);await writeFile(acceptedPaths[0],authored);await writeFile(acceptedPaths[1],nativeJSON(value.native)+'\n');await writeFile(acceptedPaths[2],nativeJSON(value.previews)+'\n');current=value;}
 async function saveAndCold(label,value){
  const paths=[label+'.authored-workplane.json',label+'.native.json',label+'.previews.json'].map(p=>resolve(dir,p));
  await writeFile(paths[0],cad.serializeWorkplaneSketchDocument(value.native.document));await writeFile(paths[1],nativeJSON(value.native)+'\n');await writeFile(paths[2],nativeJSON(value.previews)+'\n');
  const document=cad.parseWorkplaneSketchDocument(await readFile(paths[0],'utf8')),owned=JSON.parse(await readFile(paths[1],'utf8')),previews=JSON.parse(await readFile(paths[2],'utf8'));
  assert.deepEqual(document,value.native.document);assert.deepEqual(cad.validateWorkplaneSketchDocument(owned),value.native.report);
  const cold=prepare({document,edit:null},value.selection,value.count);
  for(const key of ['document','matrix','profiles','worldPointBindings'])assert.deepEqual(cold.native[key],value.native[key],'Cold authored regeneration '+key);
  assert.deepEqual(cold.previews,value.previews);
  for(let i=0;i<previews.length;i++){
   const rebuilt=gpu.validateSelectedUniformCurvePreview(previews[i]);assert.deepEqual(rebuilt,value.previews[i]);assert.notStrictEqual(rebuilt,value.previews[i]);
   const bits=nativeJSON(rebuilt);previews[i].pointsMM[0][0]+=1;assert.equal(nativeJSON(rebuilt),bits,'Cold preview frozen independent copy');
  }
  const bits=nativeJSON(cold.native);document.plane.originMM[0]+=1;owned.document.plane.originMM[0]+=1;assert.equal(nativeJSON(cold.native),bits,'Mutable native result independent of callers');
  for(let i=0;i<value.previews.length;i++){
   const path=resolve(dir,label+'.preview_'+i+'.json');await writeFile(path,nativeJSON(value.previews[i])+'\n');paths.push(path);
  }
  return paths;
 }
 for(const input of inputs){
  const value=prepare(input.request,input.ids,input.count);assert.equal(cad.serializeWorkplaneSketchDocument(value.native.document),input.authored,'Pinned authored codec bytes');
  if(input.name==='actual_eight_profiles_aggregate_bound'){assert.equal(value.native.profiles.length,8);assert.equal(value.previews.length,4);}
  if(input.name==='actual_64_point_polyline_127_observations'){assert.equal(value.previews[0].count,129);assert.equal(value.previews[0].model.objects[0].controlPoints.length,64);}
  if(input.name==='empty_actual_children_sources_bindings'){assert.equal(value.native.profiles.length,0);assert.deepEqual(value.previews,[]);}
  if(input.request.edit!==null){
   assert.deepEqual(value.native.document.worldBindings,input.request.document.worldBindings);
   if(input.request.edit.localEdits.length===0)assert.deepEqual(value.native.document.localSketch,input.request.document.localSketch);
   else for(const before of input.request.document.localSketch.profiles)if(!input.request.edit.localEdits.some(e=>e.kind==='upsert'&&e.profile.id===before.id))assert.deepEqual(value.native.document.localSketch.profiles.find(p=>p.id===before.id),before);
  }
  const paths=await saveAndCold(input.name,value);await accept(value);accepted.push({name:input.name,profiles:value.native.profiles.length,selection:value.selection,observations:value.observations,files:await Promise.all(paths.map(receipt))});
 }
 const primary=inputs[0],coldDocument=cad.parseWorkplaneSketchDocument(await readFile(resolve(dir,primary.name+'.authored-workplane.json'),'utf8'));
 const line=clone(coldDocument.localSketch.profiles.find(p=>p.kind==='line'));line.points[1].xy[0]+=.25;
 const reedit=prepare({document:coldDocument,edit:{plane:null,localEdits:[{kind:'upsert',profile:line}],worldBindings:null}},primary.ids,9);
 assert.deepEqual(reedit.native.document.worldBindings,coldDocument.worldBindings);assert.equal(reedit.native.document.localSketch.profiles[0].points[1].xy[0],10.25);
 for(const profile of coldDocument.localSketch.profiles.filter(p=>p.id!==line.id))assert.deepEqual(reedit.native.document.localSketch.profiles.find(p=>p.id===profile.id),profile);
 const reeditPaths=await saveAndCold('cold-primary-line-reedit',reedit);await accept(reedit);accepted.push({name:'cold-primary-line-reedit',profiles:3,selection:reedit.selection,observations:reedit.observations,files:await Promise.all(reeditPaths.map(receipt))});
 const retained=nativeJSON(current),retainedState=current,saved=await Promise.all(acceptedPaths.map(p=>readFile(p)));
 async function refused(label,action,errorClass,code=null,details={}){
  let error;try{action();}catch(e){error=e;}assert(error instanceof errorClass,label+' actual error class');if(code!==null)assert.equal(error.code,code,label);
  assert.strictEqual(current,retainedState);assert.equal(nativeJSON(current),retained);for(let i=0;i<acceptedPaths.length;i++)assert.deepEqual(await readFile(acceptedPaths[i]),saved[i]);
  refusals.push({name:label,error:error.name,code:error.code??null,message:error.message,cause:error.cause?.message??null,...details,priorAcceptedVariablesAndAuthoredNativePreviewFilesRetained:true});
 }
 await refused('foreign-world-selector',()=>prepare(primary.request,['foreign_world'],9),RangeError);
 await refused('duplicate-world-selector',()=>prepare(primary.request,[primary.ids[0],primary.ids[0]],9),RangeError);
 const removedEdit={plane:null,localEdits:[{kind:'remove',profileId:'poly_profile'}],worldBindings:primary.request.document.worldBindings.filter(b=>b.profileId!=='poly_profile')};
 await refused('stale-world-selector-after-real-removal',()=>prepare({document:primary.request.document,edit:removedEdit},['world_poly_profile'],9),RangeError);
 const whole=inputs.find(input=>input.name==='actual_eight_profiles_aggregate_bound');
 await refused('five-world-selectors',()=>prepare(whole.request,[...whole.ids,'world_eight_line_4'],9),RangeError);
 await refused('sample-count130',()=>prepare(primary.request,primary.ids,130),gpu.UniformCurvePreviewError,'BUDGET');
 const badFrame=clone(primary.request);badFrame.document.plane.uAxis[0]*=2;
 await refused('improper-native-frame',()=>prepare(badFrame,primary.ids,9),cad.WorkplaneSketchDocumentError,'FRAME');
 const missing=clone(primary.request);missing.document.worldBindings.pop();
 await refused('missing-native-binding',()=>prepare(missing,primary.ids,9),cad.WorkplaneSketchDocumentError,'BINDING');
 const altered=clone(current.native);altered.profiles[0].affine.source+='\n/* altered owned source */';
 await refused('altered-whole-owned-world-source',()=>cad.validateWorkplaneSketchDocument(altered),cad.WorkplaneSketchDocumentError,'OWNED');
 const late=JSON.parse(await readFile(resolve(dir,primary.name+'.previews.json'),'utf8'));late[2].pointsMM[0][0]+=1;let successfulPrefix=0;
 await refused('third-saved-preview-reconstruction',()=>{for(const preview of late){gpu.validateSelectedUniformCurvePreview(preview);successfulPrefix++;}},gpu.UniformCurvePreviewError,'RECONSTRUCTION',{successfulPrefix:2});assert.equal(successfulPrefix,2);
 let getters=0;const child=current.native.profiles[0],accessor={curveId:child.worldCurveId,count:9};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return child.affine.source;}});
 await refused('preview-source-accessor',()=>gpu.prepareSelectedUniformCurvePreview(accessor),gpu.UniformCurvePreviewError,'INPUT');assert.equal(getters,0);
 assert.equal(accepted.length,7);assert.equal(refusals.length,10);
 results.push({provider:name,files:provider.files,accepted,refusals,getters,finalNative:current.native,finalPreviews:current.previews,cadExports:Object.keys(cad).sort(),gpuExports:Object.keys(gpu).sort()});
}
for(const key of ['cadExports','gpuExports','finalNative','finalPreviews'])assert.deepEqual(results[0][key],results[1][key],'Source/emitted '+key);
const cadClosure=[];for(const entry of(await readdir(resolve(manifests.cad.root,'dist'))).sort())if(entry.endsWith('.js'))cadClosure.push(await receipt(resolve(manifests.cad.root,'dist',entry)));
const result={ok:true,issue:1159,inputs:inputs.map(({name,ids,count,files})=>({name,ids,count,files})),results,sourceGraph:graph,cadClosure,actualGL:false,
 support:'Original linear authored workplane document/local intent/proper numerical frame/native world children and selected uniform CPU D0 previews. Retained native parameters/F64/IDs/source and C0 reports; local affine observations within1e-7mm are not global certificates. No Arc/mixed intent, axis conversion, angular sampling, Float32, rendering, editor, topology, constraints, release or filesystem crash atomicity proof.'};
await writeFile(resolve(output,'actual-result.json'),nativeJSON(result)+'\n');console.log(JSON.stringify({ok:true,accepted:14,refusals:20,getters:0,cadExports:results[0].cadExports.length,gpuExports:results[0].gpuExports.length,actualGL:false}));
