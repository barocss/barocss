/** #1111: recorded whole native Boolean results to actual CPU buffers only. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const args=process.argv.slice(2),index=args.indexOf('--output');
assert(index>=0&&args[index+1],'--output <unique-directory> required');
const output=resolve(args[index+1]),repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const recorded='/Users/user/.barocss-ai/v3/evidence-axis-box-boolean-cad/demo-output';
await mkdir(output,{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
function nativeJSON(value){
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value)||ArrayBuffer.isView(value))return '['+Array.from(value,nativeJSON).join(',')+']';
 return '{'+Object.entries(value).map(([key,item])=>JSON.stringify(key)+':'+nativeJSON(item)).join(',')+'}';
}
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
const published=manifest.publishConfig.exports['.'];assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const compiledPath=resolve(pkg,published.import),typesPath=resolve(pkg,published.types),sourcePath=resolve(output,'ordinary-source-api.mjs');
await build({entryPoints:[resolve(pkg,'src/index.ts')],bundle:true,platform:'node',format:'esm',target:'es2022',outfile:sourcePath});
const sourceAPI=await import(pathToFileURL(sourcePath)),compiledAPI=await import(pathToFileURL(compiledPath));
const exports=Object.keys(compiledAPI).sort(),types=await readFile(typesPath,'utf8');
assert.deepEqual(Object.keys(sourceAPI).sort(),exports);assert.equal(exports.length,54);
const declarationNames=['prepareAxisBoxBooleanBuffers','AxisBoxBooleanBufferError','AxisBoxBooleanBufferOptions','PreparedAxisBoxBooleanBuffers','AxisBoxBooleanPanelRange','AxisBoxBooleanBufferDiagnosticCode'];
for(const name of declarationNames)assert(types.includes(name),name+' missing from actual root declarations');
const options={basis:'authored-xyz-matches-rhyup',mmToSceneUnit:.125,translate:[.5,-.25,-.75]},optionsBits=nativeJSON(options);
const fixtures=[];
for(const name of ['union','cavity','sever','empty']){
 const path=resolve(recorded,name+'.owned-boolean.json'),bytes=await readFile(path),native=JSON.parse(bytes),bits=nativeJSON(native);
 const coldPath=resolve(output,name+'.original-native.json');await writeFile(coldPath,bits+'\n');
 assert.equal(nativeJSON(JSON.parse(await readFile(coldPath,'utf8'))),bits);
 const sources=[{label:'operand-a',source:native.a.source},{label:'operand-b',source:native.b.source},...native.sources.map(s=>({label:s.sourceId,source:s.source}))],files=[];
 for(const source of sources){const path=resolve(output,name+'.'+source.label+'.source0.css');await writeFile(path,source.source);assert.equal(await readFile(path,'utf8'),source.source);files.push({path,sha256:hash(source.source)});}
 assert(native.originalModels.every(model=>model.version===0&&model.lengthUnit==='mm'&&model.objects.some(o=>o.id==='unused_degree5'&&o.kind==='curve')),'Original unused Curve lost');
 if(name==='cavity'){assert.equal(native.panels.length,60);assert.deepEqual(native.shells.map(s=>s.role).sort(),['cavity','outer']);assert.equal(native.report.volumeMM3,208);}
 if(name==='sever')assert.equal(native.bodies.length,2);
 if(name==='empty'){assert.equal(native.report.solid,false);assert.equal(native.panels.length,0);assert.equal(native.bodies.length,0);assert.equal(native.shells.length,0);}
 fixtures.push({name,native,bits,coldPath,recordedPath:path,recordedSHA256:hash(bytes),files});
}
function verify(prepared,input){
 const count=input.panels.length;
 assert.deepEqual(Object.keys(prepared).sort(),['schema','version','profile','coordinateSystem','native','options','positions','normals','indices','panels','bounds','report'].sort());
 assert.equal(prepared.schema,'barocss-gpu-axis-box-boolean-buffers');assert.equal(prepared.version,0);
 assert.equal(prepared.profile,'native-integer-axis-box-boolean-panels-v0');assert.equal(prepared.coordinateSystem,'right-handed-y-up');
 assert.equal(nativeJSON(prepared.native),nativeJSON(input));assert.notStrictEqual(prepared.native,input);assert(Object.isFrozen(prepared.native));
 assert.equal(nativeJSON(prepared.options),optionsBits);assert.notStrictEqual(prepared.options,options);assert(Object.isFrozen(prepared.options));
 assert(prepared.positions instanceof Float32Array);assert(prepared.normals instanceof Float32Array);assert(prepared.indices instanceof Uint16Array);
 assert.equal(prepared.positions.length,12*count);assert.equal(prepared.normals.length,12*count);assert.equal(prepared.indices.length,6*count);assert.equal(prepared.panels.length,count);
 const sourceBytes=Buffer.byteLength(input.a.source)+Buffer.byteLength(input.b.source)+input.sources.reduce((n,s)=>n+Buffer.byteLength(s.source),0);
 assert.deepEqual(prepared.report,{nativeValidationCalls:1,tessellateSurfaceCalls:count,sourceCompilationCalls:0,vertexCount:4*count,triangleCount:2*count,
  geometryBytes:prepared.positions.byteLength+prepared.normals.byteLength+prepared.indices.byteLength,sourceBytes,maximumPanels:72,maximumGeometryBytes:7776});
 const vertices=new Map(input.vertices.map(v=>[v.id,v.pointMM])),sources=new Map(input.sources.map(s=>[s.sourceId,s]));
 for(let i=0;i<count;i++){
  const panel=input.panels[i],range=prepared.panels[i],source=sources.get(panel.sourceId),shells=input.shells.filter(s=>s.panelIds.includes(panel.id));
  assert.equal(shells.length,1);assert.equal(shells[0].bodyId,panel.bodyId);assert(input.bodies.find(b=>b.id===panel.bodyId).shellIds.includes(shells[0].id));
  const ids=[0,3,1,2].map(n=>panel.vertexIds[n]),face=panel.bundle.topology.face;
  assert.deepEqual(source.model,panel.bundle.geometry);assert.equal(source.panelId,panel.id);assert.equal(source.model.objects.length,5);
  assert.deepEqual(range,{panelId:panel.id,bodyId:panel.bodyId,shellId:shells[0].id,sourceId:panel.sourceId,modelId:source.model.name,surfaceId:face.surfaceId,faceId:face.id,
   vertexOffset:i*4,indexOffset:i*6,vertexCount:4,indexCount:6,nativeVertexIdsInBufferOrder:ids,lineage:panel.lineage});
  assert(Object.isFrozen(range));assert(Object.isFrozen(range.lineage));assert.notStrictEqual(range.lineage,panel.lineage);
  for(let vertex=0;vertex<4;vertex++)for(let axis=0;axis<3;axis++){
   const at=i*12+vertex*3+axis,raw=vertices.get(ids[vertex])[axis];
   assert.equal(prepared.positions[at],Math.fround(raw*options.mmToSceneUnit+options.translate[axis]));
   assert(prepared.normals[at]===(axis===panel.axis?panel.sign:0),'Outward/cavity normal differs');
  }
  assert.deepEqual(Array.from(prepared.indices.slice(i*6,i*6+6)),[0,2,1,2,3,1].map(n=>n+i*4));
 }
 if(count===0){assert.equal(prepared.bounds,null);assert.equal(prepared.native.report.solid,false);}
 else{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<prepared.positions.length;i++){const axis=i%3;min[axis]=Math.min(min[axis],prepared.positions[i]);max[axis]=Math.max(max[axis],prepared.positions[i]);}
  assert.deepEqual(prepared.bounds,{min,max});
 }
}
const receipts=[],refusals=[],acceptedFiles=[];
for(const [provider,api] of [['ordinary-source',sourceAPI],['compiled-public',compiledAPI]]){
 for(const fixture of fixtures){
  const input=JSON.parse(fixture.bits),callerBits=nativeJSON(input),prepared=api.prepareAxisBoxBooleanBuffers(input,options);verify(prepared,input);
  const snapshot=nativeJSON(prepared),file=resolve(output,provider+'.'+fixture.name+'.prepared.json');
  await writeFile(file,snapshot+'\n');assert.equal(nativeJSON(JSON.parse(await readFile(file,'utf8'))),snapshot);acceptedFiles.push({file,sha256:hash(snapshot+'\n')});
  const cold=JSON.parse(await readFile(fixture.coldPath,'utf8')),reopened=compiledAPI.prepareAxisBoxBooleanBuffers(cold,options);verify(reopened,cold);
  assert.equal(nativeJSON(reopened),snapshot,'Cold compiled-public output differs');assert.notStrictEqual(prepared.positions.buffer,reopened.positions.buffer);
  for(const saved of fixture.files)assert.equal(hash(await readFile(saved.path)),saved.sha256,'Original/generated source file changed');
  assert.equal(nativeJSON(input),callerBits);assert.equal(nativeJSON(options),optionsBits);
  input.a.source='caller mutation';input.originalModels[0].name='caller mutation';
  assert.equal(nativeJSON(prepared.native),fixture.bits,'Owned native aliases caller');assert.equal(nativeJSON(reopened),snapshot);
  if(prepared.positions.length){prepared.positions[0]=999;prepared.normals[0]=999;prepared.indices[0]=65535;assert.equal(nativeJSON(reopened),snapshot);assert.equal(nativeJSON(prepared.native),fixture.bits);}
  receipts.push({provider,name:fixture.name,recordedPath:fixture.recordedPath,recordedSHA256:fixture.recordedSHA256,preparedSHA256:hash(snapshot),report:reopened.report,
   bodies:reopened.native.bodies.map(b=>b.id),shells:reopened.native.shells.map(s=>({id:s.id,bodyId:s.bodyId,role:s.role})),panels:reopened.panels,
   nativeAndSourcesRetained:true,coldPublicReprepareEqual:true,independentTypedBuffers:true,callerMutationIsolated:true});
 }
 const union=fixtures.find(f=>f.name==='union'),fresh=()=>JSON.parse(union.bits);
 function refuse(name,input,candidateOptions,code){
  let caught=null;try{api.prepareAxisBoxBooleanBuffers(input,candidateOptions);}catch(error){caught=error;}
  assert(caught instanceof api.AxisBoxBooleanBufferError,name+' requires public error');assert.equal(caught.code,code,name+': '+caught.message);
  if(name==='wrong-explicit-basis')assert.equal(caught.cause,undefined,'Direct basis check must not invent a cause');
  else assert(caught.cause instanceof Error,name+' requires real child cause');assert(caught.message.length<=1024);
  refusals.push({provider,name,code:caught.code,message:caught.message,cause:caught.cause?{name:caught.cause.name,message:caught.cause.message}:null});
 }
 const changedSource=fresh();changedSource.sources[0].source+=' !';refuse('changed-generated-source',changedSource,options,'NATIVE');
 const changedBody=fresh();changedBody.panels[0].bodyId='missing_body';refuse('changed-body-binding',changedBody,options,'NATIVE');
 const foreign=JSON.parse(await readFile(resolve(recorded,'a.actual-shell.json'),'utf8'));refuse('foreign-shell-family',foreign,options,'NATIVE');
 refuse('wrong-explicit-basis',fresh(),{...options,basis:'unknown'},'INPUT');
 let getters=0;const accessor={...options};Object.defineProperty(accessor,'mmToSceneUnit',{enumerable:true,get(){getters++;return .125;}});
 refuse('options-accessor',fresh(),accessor,'INPUT');assert.equal(getters,0);
 const nativeAccessor=fresh();Object.defineProperty(nativeAccessor,'a',{enumerable:true,get(){getters++;return union.native.a;}});
 refuse('native-accessor',nativeAccessor,options,'INPUT');assert.equal(getters,0);
 refuse('unsafe-float32-scale',fresh(),{...options,mmToSceneUnit:1e-50,translate:[0,0,0]},'CONVERSION');
 refuse('translated-triangle-collapse',fresh(),{...options,mmToSceneUnit:1e-20,translate:[1,1,1]},'CONVERSION');
 for(const fixture of fixtures)assert.equal(nativeJSON(fixture.native),fixture.bits,'Accepted native input changed after refusal');
 for(const saved of acceptedFiles)assert.equal(hash(await readFile(saved.file)),saved.sha256,'Accepted file changed after refusal');
}
assert.deepEqual(receipts.filter(r=>r.provider==='ordinary-source').map(({provider,...r})=>r),receipts.filter(r=>r.provider==='compiled-public').map(({provider,...r})=>r),'Source/compiled accepted outputs differ');
assert.deepEqual(refusals.filter(r=>r.provider==='ordinary-source').map(({provider,...r})=>r),refusals.filter(r=>r.provider==='compiled-public').map(({provider,...r})=>r),'Source/compiled refusals differ');
const result={actualSourceAPI:true,actualGL:false,successfulRenderer:false,scope:'Whole native integer axis-box Boolean CPU panel buffers; no producer replay, renderer, device or Viewer proof',
 providers:{ordinaryGPU:{path:sourcePath,sha256:hash(await readFile(sourcePath))},compiledGPU:{path:compiledPath,sha256:hash(await readFile(compiledPath))},
 declarations:{path:typesPath,sha256:hash(types),requiredNames:declarationNames},publicExports:exports,publicExportCount:exports.length,publishConfigExports:manifest.publishConfig.exports},cases:receipts,refusals};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({actualSourceAPI:true,actualGL:false,successfulRenderer:false,cases:receipts.length,refusals:refusals.length}));
