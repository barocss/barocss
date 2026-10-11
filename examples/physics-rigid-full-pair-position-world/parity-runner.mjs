import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat,link} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {bundle,verifyFreeze,here,root} from './bundle.mjs';
import {policyControls} from './policy-controls.mjs';
import {worldControls} from './world-controls.mjs';
import {referenceControls} from './reference-controls.mjs';
import {runNineStart} from './kernel-consumer.mjs';
import {createContinuationRecorder} from './continuation-archive.mjs';
import {runScene} from './consumer.mjs';
import {describeThrown,sha} from './archive.mjs';
const out=resolve(process.argv[2]),preserved=here+'/evidence/native-partial-610e2581',completed=here+'/evidence/continuation-9ca19dd4';await mkdir(out,{recursive:true});const reports=[],audits=[],guards=[],starts=[],budget={bytes:141448108};let reference,geometry;let fixedBytes=0;
const partialPrefix='examples/physics-rigid-full-pair-position-world/evidence/native-partial-610e2581/';
const partialManifestBytes=execFileSync('git',['show','533ac85faaf5b09c3ae0a394a6e9a8a10cc3cdbf:'+partialPrefix+'manifest.json'],{cwd:root,maxBuffer:2*1024*1024});
assert.equal(sha(partialManifestBytes),'876fb6450fa913681eba45a79512340b8991a2e3af6bbc833ae9dcf7102493fd');
const partialManifest=JSON.parse(partialManifestBytes);for(const item of partialManifest.artifacts){const data=await readFile(here+'/'+item.path);assert.equal(data.length,item.bytes);assert.equal(sha(data),item.sha256);const blob=execFileSync('git',['show','533ac85faaf5b09c3ae0a394a6e9a8a10cc3cdbf:examples/physics-rigid-full-pair-position-world/'+item.path],{cwd:root,maxBuffer:100*1024*1024});assert.ok(data.equals(blob),'immutable partial Git artifact: '+item.path);}
const completedPrefix='examples/physics-rigid-full-pair-position-world/evidence/continuation-9ca19dd4/';
const completedManifestBytes=execFileSync('git',['show','b7c95308:'+completedPrefix+'manifest.json'],{cwd:root,maxBuffer:2*1024*1024});assert.equal(sha(completedManifestBytes),'8a1681d5581de8876c7dd3e2446e1410a99d72164f0edf4672ba44d0182c5129');
for(const item of JSON.parse(completedManifestBytes).artifacts){const data=await readFile(here+'/'+item.path);assert.equal(data.length,item.bytes);assert.equal(sha(data),item.sha256);const blob=execFileSync('git',['show','b7c95308:examples/physics-rigid-full-pair-position-world/'+item.path],{cwd:root,maxBuffer:100*1024*1024});assert.ok(data.equals(blob),'immutable completed Git artifact '+item.path);}
const controlBytes=gunzipSync(await readFile(completed+'/source-controls.json.gz')),oldControls=JSON.parse(controlBytes),repeatControlBytes=gunzipSync(await readFile(completed+'/source-repeat-controls.json.gz')),repeatControls=JSON.parse(repeatControlBytes);assert.ok(controlBytes.equals(repeatControlBytes),'completed controls persisted byte parity');
const startBytes=gunzipSync(await readFile(completed+'/source-nine-start.json.gz')),oldStart=JSON.parse(startBytes),oldGraph=JSON.parse(await readFile(completed+'/source-graph.json'));assert.equal(oldStart.kernelGO,true);assert.equal(oldGraph.audit.bundleSha256,'767aa27845a63f267581814cc588806828ac3ab1e16120a01373f723775d3dbb');audits.push(oldGraph.audit);guards.push({graph:'source',reusedImmutableSourceReceipts:true,...oldControls});starts.push({graph:'source',...oldStart});
for(const scene of ['ALIGNED','OFFSET','YAW']){const report=JSON.parse(gunzipSync(await readFile(completed+'/source-'+scene+'-summary.json.gz')));assert.equal(report.graph,'source');assert.equal(report.scene,scene);assert.equal(report.baseNumericalGO,false);assert.equal(report.failure.kind,'independent-quality');reports.push(report);for(const suffix of ['.jsonl.gz','.f64le.gz','-summary.json.gz'])await link(completed+'/source-'+scene+suffix,out+'/source-'+scene+suffix);}
await link(completed+'/source-controls.json.gz',out+'/source-controls.json.gz');await link(completed+'/source-nine-start.json.gz',out+'/source-nine-start.json.gz');await link(completed+'/source-graph.json',out+'/source-graph.json');
const save=async(name,value)=>{const data=gzipSync(JSON.stringify(value));await fixedStoredBudget(data);await writeFile(out+'/'+name+'.json.gz',data);fixedBytes+=data.length;};
async function fixedStoredBudget(candidate){const unique=new Map();for(const dir of [out,preserved,completed,here+'/evidence/initial-types-failure'])for(const name of await readdir(dir)){if(name.endsWith('.jsonl.gz')||name.endsWith('.f64le.gz')||name.includes('emergency'))continue;const info=await stat(dir+'/'+name);unique.set(info.dev+':'+info.ino,info.size);}const bytes=[...unique.values()].reduce((a,b)=>a+b,0)+(candidate?.length??0);assert.ok(bytes<=20*1024*1024,'whole unique fixed evidence exceeds20MiB');return bytes;}
function partialReportOf(error){try{return error?.partialReport??null;}catch{return null;}}
try{
 const freeze=await verifyFreeze(),emittedBytes=await readFile(out+'/emitted-pre-consumer.json'),emitted=JSON.parse(emittedBytes);
 assert.equal(emitted.beforeNumericalConsumer,true);assert.equal(emitted.node,process.version);assert.equal(emitted.measuredSource,freeze.measuredHead);assert.equal(emitted.currentConsumerHead,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());assert.equal(emitted.sourceFreezeSha256,sha(await readFile(here+'/source-freeze.json')));assert.equal(emitted.originalEmittedLedgerSha256,'af132c319b00c2612c30f20acb964961c0ac6f79499fb1c351f78e44e838f541');
 assert.ok(Array.isArray(emitted.files)&&emitted.files.length>0);assert.equal(emitted.files.length,emitted.fileCount);assert.equal(new Set(emitted.files.map(x=>x.path)).size,emitted.files.length);
 const actualPaths=execFileSync('rg',['--files','--hidden','--no-ignore','packages/barocss-cad/dist','packages/barocss-physics/dist'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(emitted.files.map(x=>x.path).sort(),actualPaths);
 for(const name of ['build','types']){const bytes=await readFile(out+'/'+(emitted[name+'ReceiptPath']??name+'.receipt.json')),r=JSON.parse(bytes);assert.equal(sha(bytes),emitted[name+'ReceiptSha256']);assert.equal(r.exitCode,0);assert.equal(r.beforeHead,name==='build'?emitted.actualBuildHead:emitted.actualTypesHead);assert.equal(r.measuredSource,emitted[name+'MeasuredSource']);}
 for(const prefix of ['packages/barocss-cad/dist/','packages/barocss-physics/dist/'])assert.ok(emitted.files.some(x=>x.path.startsWith(prefix)));
 for(const x of emitted.files){assert.ok(x.path.startsWith('packages/barocss-cad/dist/')||x.path.startsWith('packages/barocss-physics/dist/'));assert.equal(x.actualPath,root+'/'+x.path);const bytes=await readFile(x.actualPath);assert.equal(bytes.length,x.bytes);assert.equal(sha(bytes),x.sha256);}
 const originalEmittedBytes=await readFile(preserved+'/emitted-pre-consumer.json');assert.equal(sha(originalEmittedBytes),emitted.originalEmittedLedgerSha256);const originalEmitted=JSON.parse(originalEmittedBytes);assert.deepEqual(emitted.files,originalEmitted.files);for(const key of ['actualBuildHead','actualTypesHead','buildMeasuredSource','typesMeasuredSource','buildReceiptSha256','typesReceiptSha256'])assert.equal(emitted[key],originalEmitted[key],'unchanged actual native provenance '+key);
 const emittedLedgerSha256=sha(emittedBytes);
 for(const graph of ['source-repeat','compiled-dependencies']){
  reference=observer(here+'/reference.py');geometry=observer(here+'/../physics-rigid-contact-reference/geometry-reference.py');
  try{
   const b=await bundle(graph,out);await fixedStoredBudget();audits.push(b.audit);if(graph==='source-repeat')assert.equal(b.audit.bundleSha256,oldGraph.audit.bundleSha256,'physical source bundle is unchanged');const m=await import(pathToFileURL(b.path));
   const guard=graph==='source-repeat'?repeatControls:{policy:await policyControls(m,here,reference),world:await worldControls(m),reference:await referenceControls(reference,m)};guards.push({graph,reusedImmutableControls:graph==='source-repeat',...guard});await save(graph+'-controls',guard);assert.ok(Buffer.from(JSON.stringify(guard)).equals(controlBytes),'persisted control bytes differ');
   const start=await runNineStart(m,reference,here,(name,value)=>save(graph+'-'+name,value));starts.push({graph,...start});await save(graph+'-nine-start',start);if(start.kernelGO)assert.ok(Buffer.from(JSON.stringify(start)).equals(startBytes),'persisted start bytes differ');
   console.log(JSON.stringify({graph,kernelGO:start.kernelGO,kernelStatus:start.result.status,disposition:start.disposition}));
   if(start.kernelGO)for(const scene of ['ALIGNED','OFFSET','YAW']){
    const first=reports.find(r=>r.graph==='source'&&r.scene===scene),factory=(output,name,storedBudget)=>createContinuationRecorder(output,name,storedBudget,{mode:'parity',canonicalName:'source-'+scene,canonicalEvidence:first.evidence}),report=await runScene(m,reference,geometry,graph,scene,out,budget,first.attemptedSteps,factory);reports.push(report);await save(graph+'-'+scene+'-summary',report);
    console.log(JSON.stringify({graph,scene,attemptedSteps:report.attemptedSteps,acceptedSteps:report.acceptedSteps,solverCalls:report.solverCalls,failure:report.failure,baseNumericalGO:report.baseNumericalGO}));
    if(first){for(const key of ['attemptedSteps','acceptedSteps','solverCalls','failure'])assert.deepEqual(report[key],first[key]);for(const key of ['decodedRecordSha256','rawSha256','rawBytes','records'])assert.equal(report.evidence[key],first.evidence[key],scene+' '+key);}
   }
   assert.equal(reference.stderr(),'');assert.equal(geometry.stderr(),'');
  }finally{reference?.close();geometry?.close();reference=geometry=undefined;}
 }
 const allNineStartGO=starts.length===3&&starts.every(x=>x.kernelGO),baseNumericalGO=allNineStartGO&&reports.length===9&&reports.every(x=>x.baseNumericalGO);
 await save('summary',{continuation:true,missingStagesOnly:true,completedSourceProofHead:'b7c95308',sourceWorldReplayed:false,sourceRepeatControlsReplayed:false,sourceControlStartComparison:'exact-persisted-JSON-bytes; original native signed-zero bits not reconstructed',originalInterruptedProofHead:'533ac85faaf5b09c3ae0a394a6e9a8a10cc3cdbf',originalPartialTraceStoredBytes:48319583+1420907,completedSourceTraceStoredBytes:91707618,sourcePassedControlsNineReused:true,sourceALIGNEDOriginalPrefixVerifiedByCompletedFlow:true,uniqueStoredDataBudget:true,issue:1399,base:freeze.base,measuredHead:freeze.measuredHead,node:process.version,emittedLedgerSha256,audits,guards:guards.map(x=>({graph:x.graph,policy:x.policy.receipts.length,world:x.world.stepCalls,reference:x.reference.receipts?.length??null})),starts,reports,allNineStartGO,sourceRepeatCompiledParity:allNineStartGO&&reports.length===9,baseNumericalGO,physicalDisposition:baseNumericalGO?'PRIVATE_FULL_PAIR_WORLD_BASE_GO':allNineStartGO?'NUMERICAL_NO_GO_WORLD':'NUMERICAL_NO_GO_NINE_START',mainTraceCompressedBytes:budget.bytes,newFixedCompressedJsonBytesOnly:fixedBytes,uniqueFixedStoredBytesBeforeFinalSummary:await fixedStoredBudget(),mainTraceBudgetBytes:280*1024*1024,fixedEvidenceReserveBytes:20*1024*1024,viewerExecuted:false,publicEngineQualified:false,releaseQualified:false});
}catch(error){await save('execution-failure',{classification:'EXECUTION_FAILURE',...describeThrown(error),completedReports:reports,starts,audits,partialReport:partialReportOf(error)});throw error;}finally{reference?.close();geometry?.close();}
