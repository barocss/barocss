/** #1149: complete native Source0 Surface edits composed with selected CPU meshes.
 * Run after affected CAD/GPU builds: node examples/gpu-scene/source-native-surface-edit-mesh-flow.mjs
 * --fixtures <native1147-input-directory> --output <new-directory>.
 * Private fixture contents are caller-owned inputs, never embedded in this example.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function option(name){const i=process.argv.indexOf(name);assert(i>=0&&process.argv[i+1],name+' required');return resolve(process.argv[i+1]);}
const output=option('--output'),fixtureRoot=option('--fixtures');
await mkdir(output,{recursive:false});
const sha=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};}
// Example-only emission preserves native -0. This is not a public storage codec.
function nativeJSON(v){
 if(typeof v==='number'){assert(Number.isFinite(v));return Object.is(v,-0)?'-0':JSON.stringify(v);}
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(ArrayBuffer.isView(v))return '['+Array.from(v,nativeJSON).join(',')+']';
 if(Array.isArray(v))return '['+v.map(nativeJSON).join(',')+']';
 return '{'+Object.entries(v).map(([k,n])=>JSON.stringify(k)+':'+nativeJSON(n)).join(',')+'}';
}
const clone=v=>JSON.parse(nativeJSON(v));
// Pinned request / complete original / complete candidate hashes, in that order.
const fixtures=[
 [
  "actual_degree5_u_v_native_coordinates",
  "18863dd92f2fb93584888301f7de77b7237ba6e277d387b821cbc418abbad83b",
  "583b5ab3b6fd62a40a980c03254bb85cc346f9ce99238c86bedfc0ec90e420a8",
  "ceb2a5843e2edd9bd3e313959ab155230c086073385a022ff33f57bb262d3ad8",
  true,
  0
 ],
 [
  "actual_16_by_16_256_poles_1024_fields",
  "3054b9931c7b9d7a81418d44815c5d57b2817838987acf47b7d90e36e79d54e5",
  "a64ad0ee7d3a70c3bc068ee76a85510662540bfc65d222b9c72e17fe8db075ed",
  "669974116a82e074a025c2d7988402424f899aacb0521076cca92e2a4a237ed1",
  true,
  0
 ],
 [
  "exact_noop_unusual_spelling_minus_zero",
  "5e685da8ad810f4b0afe20f1c51975203191721fdad9378319ce6b05c5d7b6ee",
  "a1c86419cbf490fb955edbd7e08389d2de4249ea3180f8ca41c8be95ac39e2cc",
  "a1c86419cbf490fb955edbd7e08389d2de4249ea3180f8ca41c8be95ac39e2cc",
  true,
  0
 ],
 [
  "real_zero_sign_edit_index_bits",
  "8a264feb12817f0da55b81b3fbe14032b7f210b0ff41a5c3eb8eeba0c490b818",
  "a1c86419cbf490fb955edbd7e08389d2de4249ea3180f8ca41c8be95ac39e2cc",
  "dc2dcf656dfe4f34e349ef287ceb0b0b1e100cb686ed62daf089c0d5ceb2afa0",
  true,
  0
 ],
 [
  "cold_candidate_reedit",
  "f27ba96e165851851ebe1e1ee54bb332e9f43076ac60f5546656b0e9e92d9c7c",
  "ceb2a5843e2edd9bd3e313959ab155230c086073385a022ff33f57bb262d3ad8",
  "f0b96bd6a9efba8580cf6932970b0e5ee7a5d89a80b77477a258c9b5199de70d",
  true,
  0
 ],
 [
  "actual_u_and_v_c0_refusal_union",
  "fb85163c492c47ea3802328b8b2ba47968d1ea9c01a5ce6a4d10cd23c7da3434",
  "0e54a40ea17deb7fabc5c97903074b1e5944af6713b9f9384791ca382a026532",
  "86805f67a20ef3130fff8d2b08a8378e32823548daa6b831277a390f6bef4203",
  true,
  10
 ],
 [
  "tiny_u_domain_native_d1_arithmetic",
  "8549ca472fa60cdc45851a2943339af98dd04528fd76b3f4c66e6abae299fbca",
  "e514beb20134c9520be01486a5aa3252b727cdcdc75c28255130f80a9f81bc1a",
  "ea772a8fad2c956c16f62cb01fe594ba94629e3d93d4ff3f71322c0671f0b81b",
  false,
  null
 ],
 [
  "actual_loft_surface_edit_preserves_curve_siblings",
  "c255d56bd66566c48836808c87606f3b1f8ca279361c1ab1a53012379f076663",
  "537b0478c2221a2aa05410186c66e31dd1d413057cf2d9318d1fd19826834ef0",
  "1ca674c8913607a6d126f977d1c438e63d10a0ba6a94578e16a378ecd3225501",
  true,
  0
 ]
];
const inputs=[];
for(const[name,requestHash,originalHash,candidateHash,accepted,d1Refusals]of fixtures){
 const paths=['authored-request.json','complete-original.source0.css','complete-candidate.source0.css'].map(s=>resolve(fixtureRoot,name+'.'+s));
 const bytes=await Promise.all(paths.map(p=>readFile(p)));
 [requestHash,originalHash,candidateHash].forEach((hash,i)=>assert.equal(sha(bytes[i]),hash,name+' pinned input '+i));
 const request=JSON.parse(bytes[0]);assert.equal(request.source,bytes[1].toString());assert.equal(request.sourceVersion,0);assert.equal(request.surfaceId,name==='actual_loft_surface_edit_preserves_curve_siblings'?'recipe_surface':'target_surface');
 inputs.push({name,request,expected:bytes[2].toString(),accepted,d1Refusals,files:await Promise.all(paths.map(receipt))});
}
const options={mmToSceneUnit:.001,translate:[0,0,0],color:[.6,.4,.8],background:[.05,.07,.1]};
const grid={countU:9,countV:9,revision:0};
const manifests={};
for(const name of ['cad','gpu']){
 const root=resolve(repo,'packages/barocss-'+name),manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 assert.equal(manifest.publishConfig.exports['.'].import,'./dist/index.js');manifests[name]={root,manifest};
}
const ordinary=resolve(output,'ordinary-source.mjs');
const sourceCode=['cad','gpu'].map(name=>`import * as ${name} from ${JSON.stringify(resolve(manifests[name].root,manifests[name].manifest.exports['.'].import))};`).join('\n')+'\nexport {cad,gpu};';
const built=await build({stdin:{contents:sourceCode,resolveDir:repo,sourcefile:'surface-edit-mesh-source.mjs'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(built.metafile.inputs);
assert(graph.some(p=>p.endsWith('/src/source-surface-control-net-wide.ts')));
assert(graph.some(p=>p.endsWith('/src/mesh-packet.ts')));
assert(!graph.some(p=>p.includes('barocss-cad/dist/')||p.includes('barocss-gpu/dist/')));
const providers=[{name:'ordinary-source',...await import(pathToFileURL(ordinary).href),files:[await receipt(ordinary)]}];
const emitted={name:'emitted-public',files:[]};
for(const name of ['cad','gpu']){
 const{root,manifest}=manifests[name],entry=resolve(root,manifest.publishConfig.exports['.'].import);
 emitted[name]=await import(pathToFileURL(entry).href);
 emitted.files.push(await receipt(entry),await receipt(resolve(root,manifest.publishConfig.exports['.'].types)));
}
providers.push(emitted);
function unchangedSurfaceShape(before,after){
 for(const key of ['kind','id','degreeU','degreeV','knotsU','knotsV'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(after.controlPoints.map(row=>row.length),before.controlPoints.map(row=>row.length));
 assert.deepEqual(after.weights.map(row=>row.length),before.weights.map(row=>row.length));
}
function sameMesh(a,b){for(const key of ['packet','options','positions','normals','indices'])assert.deepEqual(a[key],b[key],key+' mesh agreement');}
function verifyNativeEdit(cad,request,edit){
 const original=cad.compileCadModel(request.source,{sourceVersion:0}),candidate=cad.compileCadModel(edit.source,{sourceVersion:0});
 assert.equal(original.ok,true);assert.equal(candidate.ok,true);
 assert.deepEqual(original.model,edit.originalModel);assert.deepEqual(candidate.model,edit.model);
 assert.equal(candidate.model.name,original.model.name);assert.equal(candidate.model.version,0);assert.equal(candidate.model.lengthUnit,'mm');
 assert.deepEqual(candidate.model.objects.map(o=>[o.id,o.kind]),original.model.objects.map(o=>[o.id,o.kind]));
 for(const object of original.model.objects)if(object.id!==request.surfaceId)assert.deepEqual(candidate.model.objects.find(o=>o.id===object.id),object,'Unselected native object bits');
 const before=original.model.objects.find(o=>o.id===request.surfaceId),after=candidate.model.objects.find(o=>o.id===request.surfaceId);
 assert.equal(before.kind,'surface');assert.deepEqual(after,edit.surface);unchangedSurfaceShape(before,after);
 assert.notStrictEqual(edit.request,request);assert.notStrictEqual(edit.originalModel,edit.model);assert.notStrictEqual(edit.surface,after);
 const requested=new Map(request.edits.poleEdits.map(p=>[p.uIndex+':'+p.vIndex,p]));
 for(let u=0;u<before.controlPoints.length;u++)for(let v=0;v<before.controlPoints[u].length;v++){
  const pole=requested.get(u+':'+v);
  for(const[field,axis]of [['xMM',0],['yMM',1],['zMM',2]])assert(Object.is(after.controlPoints[u][v][axis],pole&&Object.hasOwn(pole,field)?pole[field]:before.controlPoints[u][v][axis]),'Requested or retained native pole bits');
  assert(Object.is(after.weights[u][v],pole&&Object.hasOwn(pole,'weight')?pole.weight:before.weights[u][v]),'Requested or retained weight bits');
 }
 let candidateText=request.source;
 for(const patch of [...edit.patches].reverse()){
  assert.equal(request.source.slice(patch.startUTF16,patch.endUTF16),patch.originalText);
  candidateText=candidateText.slice(0,patch.startUTF16)+patch.replacementText+candidateText.slice(patch.endUTF16);
 }
 assert.equal(candidateText,edit.source,'Only retained scalar patches replace original source');
 if(edit.report.noOp){assert.equal(edit.source,request.source);assert.equal(edit.patches.length,0);}
 assert.equal(edit.report.directCounts.surfacePointEvaluationCount,18);
 assert.equal(edit.report.directCounts.surfaceDerivativeEvaluationCount,18);
 assert.equal(edit.report.quality.geometricValidity,'not-certified');
 assert(!Object.isFrozen(edit));assert(!Object.isFrozen(edit.surface));
 return{original,candidate};
}
// Independent verifier: native UV evaluations and incident triangle area vectors.
// This never creates production normals or changes a refused packet.
function verifyMesh(cad,gpu,value){
 const{edit,tessellation,packet,mesh,compiled}=value;
 assert.equal(packet.version,0);assert.equal(packet.surfaceId,edit.surface.id);assert.equal(packet.revision,0);
 assert.equal(packet.lengthUnit,'mm');assert.equal(packet.coordinateSystem,'right-handed-y-up');assert.equal(packet.winding,'ccw');
 assert.equal(packet.positions.length,243);assert.equal(packet.indices.length,384);assert.equal(packet.parameters.length,162);
 assert.deepEqual(tessellation.report.grid,{countU:9,countV:9});
 for(const[key,expected]of [['vertexCount',81],['triangleCount',128],['cellCount',64],['probeCount',320]])assert.equal(tessellation.report[key],expected);
 assert.equal(tessellation.report.normalMethod,'area-weighted-incident-triangle');assert.equal(tessellation.report.certified,false);
 assert.deepEqual(tessellation.report.domain,edit.report.domain);
 const normals=Array.from({length:81},()=>[0,0,0]);
 for(let vertex=0;vertex<81;vertex++){
  const u=packet.parameters[2*vertex],v=packet.parameters[2*vertex+1];
  assert.deepEqual(packet.positions.slice(3*vertex,3*vertex+3),cad.evaluateSurface(edit.surface,u,v),'Original native UV evaluation');
 }
 for(let i=0;i<packet.indices.length;i+=3){
  const vertices=packet.indices.slice(i,i+3),p=vertices.map(vertex=>packet.positions.slice(3*vertex,3*vertex+3));
  const a=p[1].map((x,j)=>x-p[0][j]),b=p[2].map((x,j)=>x-p[0][j]);
  const vector=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  assert(Math.hypot(...vector)>0);
  for(const vertex of vertices)for(let axis=0;axis<3;axis++)normals[vertex][axis]+=vector[axis];
 }
 for(let vertex=0;vertex<81;vertex++){
  const length=Math.hypot(...normals[vertex]);assert(length>0);
  for(let axis=0;axis<3;axis++)assert.equal(packet.normals[3*vertex+axis],normals[vertex][axis]/length,'Triangle-derived normal');
 }
 assert(mesh.positions instanceof Float32Array);assert(mesh.normals instanceof Float32Array);assert(mesh.indices instanceof Uint16Array);
 assert.deepEqual(Array.from(mesh.positions),packet.positions.map((x,i)=>Math.fround(x*.001+options.translate[i%3])));
 assert.deepEqual(Array.from(mesh.normals),packet.normals.map(Math.fround));assert.deepEqual(Array.from(mesh.indices),packet.indices);
 assert.equal(compiled.ok,true);assert.equal(compiled.ast,null);assert.equal(compiled.ir.schemaVersion,1);
 assert.equal(compiled.ir.pipeline,'indexed-mesh');assert.equal(compiled.execution.kind,'indexed-mesh');
 assert.deepEqual(compiled.ir.draws[0].packet,packet);sameMesh(compiled.execution.mesh,mesh);
 assert(Object.isFrozen(packet));assert(Object.isFrozen(packet.positions));assert(Object.isFrozen(packet.parameters));
 assert.notStrictEqual(packet,tessellation.packet);assert.notStrictEqual(packet.positions,tessellation.packet.positions);
 assert.notStrictEqual(mesh.positions.buffer,compiled.execution.mesh.positions.buffer);
 const raw=clone(tessellation.packet),copied=gpu.validatePreviewPacket(raw),bits=nativeJSON(copied);
 raw.positions[0]=999;assert.equal(nativeJSON(copied),bits,'Validated GPU packet does not alias mutable caller');
 const spare=gpu.prepareMesh(packet,options);spare.positions[0]=999;spare.normals[0]=999;spare.indices[0]=65535;
 assert.deepEqual(mesh.positions,compiled.execution.mesh.positions,'Typed buffers have independent ownership');
}
const results=[];
for(const provider of providers){
 const{cad,gpu,name}=provider;
 for(const fn of ['editSourceSurfaceControlNetWide','validateSourceSurfaceControlNetWideEdit','compileCadModel','evaluateSurface','tessellateSurface'])assert.equal(typeof cad[fn],'function',name+' public '+fn);
 for(const fn of ['validatePreviewPacket','prepareMesh','compileGpu'])assert.equal(typeof gpu[fn],'function',name+' public '+fn);
 const accepted=[],refusals=[],dir=resolve(output,name);await mkdir(dir);let current;
 const acceptedPaths=['accepted.source0.css','accepted.edit.json','accepted.packet.json'].map(file=>resolve(dir,file));
 function prepare(request){
  const caller=clone(request),edit=cad.editSourceSurfaceControlNetWide(request);assert.deepEqual(request,caller);
  const owned=cad.validateSourceSurfaceControlNetWideEdit(edit);assert.deepEqual(owned,edit.report);assert.notStrictEqual(owned,edit.report);assert(!Object.isFrozen(owned));
  const ownedBits=nativeJSON(edit.report);owned.observations[0].afterPointMM[0]+=1;assert.equal(nativeJSON(edit.report),ownedBits,'Owned report is an independent mutable copy');
  verifyNativeEdit(cad,request,edit);
  const tessellation=cad.tessellateSurface(edit.surface,grid),packet=gpu.validatePreviewPacket(tessellation.packet);
  const mesh=gpu.prepareMesh(packet,options),compiled=gpu.compileGpu({kind:'mesh',packet,options});
  const value={edit,tessellation,packet,mesh,compiled};verifyMesh(cad,gpu,value);return value;
 }
 async function accept(value){
  // All native/packet/compiler stages have succeeded before accepted variables/files change.
  await writeFile(acceptedPaths[0],value.edit.source);await writeFile(acceptedPaths[1],nativeJSON(value.edit)+'\n');await writeFile(acceptedPaths[2],nativeJSON(value.tessellation.packet)+'\n');current=value;
 }
 async function saveAndCold(label,value){
  const paths=[label+'.source0.css',label+'.edit.json',label+'.packet.json'].map(file=>resolve(dir,file));
  await writeFile(paths[0],value.edit.source);await writeFile(paths[1],nativeJSON(value.edit)+'\n');await writeFile(paths[2],nativeJSON(value.tessellation.packet)+'\n');
  const source=await readFile(paths[0],'utf8'),edit=JSON.parse(await readFile(paths[1],'utf8')),raw=JSON.parse(await readFile(paths[2],'utf8'));
  assert.deepEqual(cad.validateSourceSurfaceControlNetWideEdit(edit),value.edit.report);
  const coldModel=cad.compileCadModel(source,{sourceVersion:0});assert.equal(coldModel.ok,true);assert.deepEqual(coldModel.model,value.edit.model);
  const surface=coldModel.model.objects.find(o=>o.id===value.edit.surface.id),tessellation=cad.tessellateSurface(surface,grid);assert.deepEqual(tessellation,value.tessellation);
  const packet=gpu.validatePreviewPacket(raw),mesh=gpu.prepareMesh(packet,options),compiled=gpu.compileGpu({kind:'mesh',packet,options});
  sameMesh(mesh,value.mesh);assert.equal(compiled.ok,true);sameMesh(compiled.execution.mesh,value.mesh);
  assert.notStrictEqual(mesh.positions.buffer,value.mesh.positions.buffer);
  edit.surface.controlPoints[0][0][0]+=1;assert.deepEqual(coldModel.model,value.edit.model,'Cold Model does not alias saved edit');
  raw.positions[0]+=1;assert.deepEqual(packet,value.packet,'Cold validated packet does not alias saved caller');
  return paths;
 }
 for(const input of inputs.filter(row=>row.accepted)){
  const value=prepare(input.request);assert.equal(value.edit.source,input.expected,input.name+' pinned complete candidate');
  assert.equal(value.edit.report.directCounts.derivativeRefusalCount,input.d1Refusals);
  const paths=await saveAndCold(input.name,value);await accept(value);
  accepted.push({name:input.name,patches:value.edit.patches.length,noOp:value.edit.report.noOp,domain:value.tessellation.report.domain,nativeD1Refusals:input.d1Refusals,tessellation:value.tessellation.report,files:await Promise.all(paths.map(receipt))});
 }
 const coldSource=await readFile(resolve(dir,inputs[0].name+'.source0.css'),'utf8');
 const reeditRequest={source:coldSource,sourceVersion:0,surfaceId:'target_surface',edits:{poleEdits:[{uIndex:0,vIndex:0,xMM:20000.125}]}};
 const reedit=prepare(reeditRequest);assert.equal(reedit.edit.surface.degreeU,5);assert.equal(reedit.edit.surface.degreeV,5);assert.equal(reedit.edit.surface.controlPoints[0][0][0],20000.125);
 const reeditPaths=await saveAndCold('cold-degree5-reedit',reedit);await accept(reedit);
 accepted.push({name:'cold-degree5-reedit',patches:reedit.edit.patches.length,tessellation:reedit.tessellation.report,files:await Promise.all(reeditPaths.map(receipt))});
 const retained=nativeJSON(current),retainedState=current,saved=await Promise.all(acceptedPaths.map(p=>readFile(p)));
 async function refused(label,action,errorClass,code=null,message=null){
  let error;try{action();}catch(e){error=e;}
  assert(error instanceof errorClass,label+' actual public error class');if(code!==null)assert.equal(error.code,code,label);if(message!==null)assert.equal(error.message,message,label);
  assert.strictEqual(current,retainedState);assert.equal(nativeJSON(current),retained);
  for(let i=0;i<acceptedPaths.length;i++)assert.deepEqual(await readFile(acceptedPaths[i]),saved[i]);
  refusals.push({name:label,error:error.name,code:error.code??null,message:error.message,cause:error.cause?.message??null,priorAcceptedSourceEditPacketAndFilesRetained:true});
 }
 const tiny=inputs.find(input=>!input.accepted);
 await refused('native-valid-tiny-domain-triangle',()=>{
  const edit=cad.editSourceSurfaceControlNetWide(tiny.request);assert.equal(edit.source,tiny.expected);assert.deepEqual(cad.validateSourceSurfaceControlNetWideEdit(edit),edit.report);
  return cad.tessellateSurface(edit.surface,grid);
 },RangeError,null,'Collapsed or nonfinite preview triangle');
 const source=current.edit.source;
 await refused('native-invalid-weight',()=>prepare({source,sourceVersion:0,surfaceId:'target_surface',edits:{poleEdits:[{uIndex:0,vIndex:0,weight:0}]}}),cad.SourceSurfaceControlNetWideError,'NATIVE');
 await refused('absent-native-surface',()=>prepare({...reeditRequest,surfaceId:'absent_surface'}),cad.SourceSurfaceControlNetWideError,'TARGET');
 const altered=clone(current.edit);altered.surface.controlPoints[0][0][0]+=1;
 await refused('altered-owned-native-candidate',()=>cad.validateSourceSurfaceControlNetWideEdit(altered),cad.SourceSurfaceControlNetWideError,'OWNED');
 const index=clone(current.packet);index.indices[0]=81;
 await refused('packet-index-out-of-range',()=>gpu.validatePreviewPacket(index),RangeError);
 let getters=0;const accessor=clone(current.packet);
 Object.defineProperty(accessor,'positions',{enumerable:true,get(){getters++;return current.packet.positions;}});
 await refused('packet-positions-getter',()=>gpu.validatePreviewPacket(accessor),RangeError);assert.equal(getters,0);
 await refused('positive-scale-Float32-underflow',()=>gpu.prepareMesh(current.packet,{...options,mmToSceneUnit:Number.MIN_VALUE}),RangeError,null,'Native Surface coordinate underflows in Float32 display');
 assert.equal(accepted.length,8);assert.equal(refusals.length,7);
 results.push({provider:name,files:provider.files,accepted,refusals,getters,cadExports:Object.keys(cad).sort(),gpuExports:Object.keys(gpu).sort(),finalSource:current.edit.source,finalEdit:current.edit,finalPacket:current.packet,finalMesh:current.mesh});
}
for(const key of ['cadExports','gpuExports','finalSource','finalEdit','finalPacket','finalMesh'])assert.deepEqual(results[0][key],results[1][key],'Source/emitted '+key);
const cadClosure=[];for(const entry of(await readdir(resolve(manifests.cad.root,'dist'))).sort())if(entry.endsWith('.js'))cadClosure.push(await receipt(resolve(manifests.cad.root,'dist',entry)));
const result={ok:true,issue:1149,inputs:inputs.map(({name,files})=>({name,files})),options,grid,results,sourceGraph:graph,cadClosure,actualGL:false,
 support:'Complete Source0 native Surface scalar edits and selected fixed 9x9 approximate CPU packet/Float32 execution. Whole source/F64/UV/weights/IDs/siblings remain native authority. Normals are D0 triangle-derived; no analytic D1, adaptive/global error, live recipe/topology, editor, browser, renderer, publication or file-system crash atomicity certificate.'};
await writeFile(resolve(output,'actual-result.json'),nativeJSON(result)+'\n');
console.log(JSON.stringify({ok:true,accepted:16,refusals:14,getters:0,cadExports:results[0].cadExports.length,gpuExports:results[0].gpuExports.length,actualGL:false}));
