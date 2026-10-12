import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { recessedPlate,provePlate,proveNative,proveBuffers,work,nativeBodyHash } from './modeling-box-cut-fixture.mjs';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));assert.ok(process.env.CAD_MODEL_GPU_MODULE);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE??new URL('../dist/index.js',import.meta.url).pathname);
const {cad,CadModelError}=await import(pathToFileURL(entry).href);
const gpuEntry=resolve(process.env.CAD_MODEL_GPU_MODULE),{prepareAxisBoxBooleanBuffers}=await import(pathToFileURL(gpuEntry).href);
const directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR??new URL('./modeling-box-cut-evidence',import.meta.url).pathname);mkdirSync(directory,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const flow={status:'running',modelCalls:0,cpuPreparations:0,stages:[],fullTransitiveNativeCoverage:'NOT_MEASURED',entrySHA256:hash(readFileSync(entry)),gpuEntrySHA256:hash(readFileSync(gpuEntry))};
const write=()=>writeFileSync(resolve(directory,'source-flow.json'),JSON.stringify(flow,null,2)+'\n');
const disk=()=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);};
const stage=(label,action)=>{disk();assert.ok(++flow.modelCalls<=6);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,...(result?{recomputation:result.recomputation}:{})});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
const transfer=(filename,snapshot,buffers)=>{
 if(!process.env.CAD_MODEL_TRANSPORT_DIR)return;
 const output=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(output,{recursive:true});
 const text=JSON.stringify({text:snapshot.save(),parameters:snapshot.parameters,features:snapshot.features,bodies:snapshot.bodies,bodySHA256:nativeBodyHash(snapshot),
  ...(buffers?{buffers:{...buffers,positions:Array.from(buffers.positions),normals:Array.from(buffers.normals),indices:Array.from(buffers.indices)}}:{})})+'\n';
 assert.ok(Buffer.byteLength(text)<=3*1024*1024);writeFileSync(resolve(output,filename),text);
 return{bytes:Buffer.byteLength(text),sha256:hash(text),scope:buffers?'actual native result and complete CPU buffers; not editor transport':'actual native result only; no additional tessellation'};
};
try{
 const initial=stage('underside recess depth4',recessedPlate(cad).build),initialText=initial.save();
 work(initial,[],[0,1,2,3,4]);flow.baseline=provePlate(initial,5632,46);assert.equal(flow.baseline.occupiedCells,17);
 flow.initialBodySHA256=nativeBodyHash(initial);assert.ok(Object.is(initial.bodies.part.native.a.shell.origin[0],-0));
 writeFileSync(resolve(directory,'initial.cad-model.json'),initialText);write();
 disk();flow.cpuPreparations++;write();const buffers=prepareAxisBoxBooleanBuffers(initial.bodies.part.native,{basis:'authored-xyz-matches-rhyup',mmToSceneUnit:1,translate:[0,0,0]});
 flow.cpu=proveBuffers(initial.bodies.part.native,buffers);flow.transfer=transfer('baseline-native.json',initial,buffers);write();
 const deeper=stage('depth4 to6',()=>initial.withParameters({depth:6})),deeperText=deeper.save(),deeperHash=nativeBodyHash(deeper);
 work(deeper,[0,1,2],[3,4],initial);flow.deeper=provePlate(deeper,5376,46);
 const window=stage('depth6 to8 through-window',()=>deeper.withParameters({depth:8})),windowText=window.save(),windowHash=nativeBodyHash(window);
 work(window,[0,1,2],[3,4],deeper);flow.window=provePlate(window,5120,32);flow.windowTransfer=transfer('window-native.json',window);write();
 stage('native two-body difference followed by single-shape refusal',()=>{
  assert.throws(()=>window.withParameters({toolY:0,toolSpanY:24}),error=>{
   assert.ok(error instanceof CadModelError);assert.equal(error.code,'SELECTION');assert.equal(error.operation,'cut');
   flow.disconnected=proveNative(error.cause,3072,12,2);deepFrozen(error.cause);flow.disconnectedRefusal=errorData(error);return true;
  });assert.equal(window.save(),windowText);assert.equal(nativeBodyHash(window),windowHash);
 });
 stage('native empty difference followed by single-shape refusal',()=>{
  assert.throws(()=>window.withParameters({toolX:0,toolY:0,toolWidth:32,toolSpanY:24}),error=>{
   assert.ok(error instanceof CadModelError);assert.equal(error.code,'SELECTION');assert.equal(error.operation,'cut');
   flow.empty=proveNative(error.cause,0,0,0);deepFrozen(error.cause);flow.emptyRefusal=errorData(error);return true;
  });assert.equal(window.save(),windowText);assert.equal(nativeBodyHash(window),windowHash);
 });
 const restored=stage('same accepted through-window recovery after both refusals',()=>window.withParameters({depth:4}));
 work(restored,[0,1,2],[3,4],window);flow.restored=provePlate(restored,5632,46);assert.equal(restored.save(),initialText);
 flow.editedBodySHA256=nativeBodyHash(restored);assert.equal(flow.editedBodySHA256,flow.initialBodySHA256);writeFileSync(resolve(directory,'edited.cad-model.json'),restored.save());
 for(const [snapshot,text,bodyHash] of [[initial,initialText,flow.initialBodySHA256],[deeper,deeperText,deeperHash],[window,windowText,windowHash]]){assert.equal(snapshot.save(),text);assert.equal(nativeBodyHash(snapshot),bodyHash);deepFrozen(snapshot);}
 flow.futureReuseAfterBothRefusals=true;flow.oldAndNewSnapshotsIndependent=true;assert.equal(flow.modelCalls,6);assert.equal(flow.cpuPreparations,1);
 flow.status='passed';flow.actualEditorGPU='UNRUN_DIFFERENCE_PREVIEW_UNAVAILABLE';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
