import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { unionBracket,proveBracket,proveNative,proveBuffers,work,nativeBodyHash } from './modeling-union-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));assert.ok(process.env.CAD_MODEL_GPU_MODULE);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE??new URL('../dist/index.js',import.meta.url).pathname);
const {cad,CadModelError,AxisBoxSolidBooleanError}=await import(pathToFileURL(entry).href);
const gpuEntry=resolve(process.env.CAD_MODEL_GPU_MODULE),{prepareAxisBoxBooleanBuffers}=await import(pathToFileURL(gpuEntry).href);
const directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR??new URL('./modeling-union-evidence',import.meta.url).pathname);mkdirSync(directory,{recursive:true});
const hash=text=>createHash('sha256').update(text).digest('hex');
const flow={status:'running',modelCalls:0,cpuPreparations:0,stages:[],fullTransitiveNativeCoverage:'NOT_MEASURED',entrySHA256:hash(readFileSync(entry)),gpuEntrySHA256:hash(readFileSync(gpuEntry))};
const write=()=>writeFileSync(resolve(directory,'source-flow.json'),JSON.stringify(flow,null,2)+'\n');
const disk=()=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);};
const stage=(label,action)=>{disk();assert.ok(++flow.modelCalls<=6);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,...(result?{recomputation:result.recomputation}:{})});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try{
 const initial=stage('overlapping L-bracket',unionBracket(cad).build),initialText=initial.save();
 work(initial,[],[0,1,2,3,4]);flow.baseline=proveBracket(initial,3072,14);assert.equal(flow.baseline.occupiedCells,3);
 flow.initialBodySHA256=nativeBodyHash(initial);assert.ok(Object.is(initial.parameters.legMinX,-0)&&Object.is(initial.parameters.legMinY,-0));
 writeFileSync(resolve(directory,'initial.cad-model.json'),initialText);write();
 disk();flow.cpuPreparations++;write();const buffers=prepareAxisBoxBooleanBuffers(initial.bodies.bracket.native,{basis:'authored-xyz-matches-rhyup',mmToSceneUnit:1,translate:[0,0,0]});
 flow.cpu=proveBuffers(initial.bodies.bracket.native,buffers);
 if(process.env.CAD_MODEL_TRANSPORT_DIR){
  const output=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(output,{recursive:true});
  const text=JSON.stringify({text:initialText,parameters:initial.parameters,features:initial.features,bodies:initial.bodies,bodySHA256:flow.initialBodySHA256,
   buffers:{...buffers,positions:Array.from(buffers.positions),normals:Array.from(buffers.normals),indices:Array.from(buffers.indices)}})+'\n';
  assert.ok(Buffer.byteLength(text)<=2*1024*1024);writeFileSync(resolve(output,'baseline-native.json'),text);flow.transfer={bytes:Buffer.byteLength(text),sha256:hash(text),scope:'actual native result and complete CPU buffers; not editor transport'};
 }
 const wide=stage('leg width 8 to 12',()=>initial.withParameters({legWidth:12})),wideText=wide.save(),wideHash=nativeBodyHash(wide);
 work(wide,[0,1],[2,3,4],initial);flow.wide=proveBracket(wide,3584,14);
 const contact=stage('face-contact join',()=>wide.withParameters({legMinY:8})),contactText=contact.save(),contactHash=nativeBodyHash(contact);
 work(contact,[0,1],[2,3,4],wide);flow.faceContact=proveBracket(contact,3584,14);
 stage('edge-only native CONTACT refusal',()=>{
  assert.throws(()=>contact.withParameters({legMinX:32}),error=>{
   assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'union');assert.ok(error.cause instanceof AxisBoxSolidBooleanError);assert.equal(error.cause.code,'CONTACT');
   flow.edgeRefusal=errorData(error);flow.edgeRefusalWork='No completed provider report; qualification work only source-derived, not measured';return true;
  });assert.equal(contact.save(),contactText);assert.equal(nativeBodyHash(contact),contactHash);
 });
 stage('disconnected complete native result followed by single-body refusal',()=>{
  assert.throws(()=>contact.withParameters({legMinX:40}),error=>{
   assert.ok(error instanceof CadModelError);assert.equal(error.code,'SELECTION');assert.equal(error.operation,'union');
   flow.disconnected=proveNative(error.cause,3584,12,2);assert.ok(Object.isFrozen(error.cause));flow.disconnectedRefusal=errorData(error);return true;
  });assert.equal(contact.save(),contactText);assert.equal(nativeBodyHash(contact),contactHash);
 });
 const restored=stage('same accepted face-contact snapshot recovery after both refusals',()=>contact.withParameters({legWidth:8,legMinY:-0}));
 work(restored,[0,1],[2,3,4],contact);flow.restored=proveBracket(restored,3072,14);assert.equal(restored.save(),initialText);
 flow.editedBodySHA256=nativeBodyHash(restored);assert.equal(flow.editedBodySHA256,flow.initialBodySHA256);writeFileSync(resolve(directory,'edited.cad-model.json'),restored.save());
 for(const [snapshot,text,bodyHash] of [[initial,initialText,flow.initialBodySHA256],[wide,wideText,wideHash],[contact,contactText,contactHash]]){assert.equal(snapshot.save(),text);assert.equal(nativeBodyHash(snapshot),bodyHash);}
 flow.futureReuseAfterBothRefusals=true;flow.oldAndNewSnapshotsIndependent=true;assert.equal(flow.modelCalls,6);assert.equal(flow.cpuPreparations,1);
 flow.status='passed';flow.actualEditorGPU='UNRUN_PREVIEW_UNAVAILABLE';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
