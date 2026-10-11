import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {bundle,verifyFreeze,here,root} from './bundle.mjs';
import {policyControls} from './policy-controls.mjs';
import {worldControls} from './world-controls.mjs';
import {referenceControls} from './reference-controls.mjs';
import {runNineStart} from './kernel-consumer.mjs';
import {runScene} from './consumer.mjs';
import {describeThrown,sha} from './archive.mjs';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});const reports=[],audits=[],guards=[],starts=[],budget={bytes:0};let reference,geometry;let fixedBytes=0;
const save=async(name,value)=>{const data=gzipSync(JSON.stringify(value));if(fixedBytes+data.length>20*1024*1024)throw new Error('full-pair world fixed evidence budget exceeded');await writeFile(out+'/'+name+'.json.gz',data);fixedBytes+=data.length;};
try{
 const freeze=await verifyFreeze(),emittedBytes=await readFile(out+'/emitted-pre-consumer.json'),emitted=JSON.parse(emittedBytes);
 assert.equal(emitted.beforeNumericalConsumer,true);assert.equal(emitted.node,process.version);assert.equal(emitted.measuredSource,freeze.measuredHead);assert.equal(emitted.currentConsumerHead,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());assert.equal(emitted.sourceFreezeSha256,sha(await readFile(here+'/source-freeze.json')));
 assert.ok(Array.isArray(emitted.files)&&emitted.files.length>0);assert.equal(emitted.files.length,emitted.fileCount);assert.equal(new Set(emitted.files.map(x=>x.path)).size,emitted.files.length);
 const actualPaths=execFileSync('rg',['--files','--hidden','--no-ignore','packages/barocss-cad/dist','packages/barocss-physics/dist'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(emitted.files.map(x=>x.path).sort(),actualPaths);
 for(const name of ['build','types']){const bytes=await readFile(out+'/'+(emitted[name+'ReceiptPath']??name+'.receipt.json')),r=JSON.parse(bytes);assert.equal(sha(bytes),emitted[name+'ReceiptSha256']);assert.equal(r.exitCode,0);assert.equal(r.beforeHead,name==='build'?emitted.actualBuildHead:emitted.actualTypesHead);assert.equal(r.measuredSource,emitted[name+'MeasuredSource']);}
 for(const prefix of ['packages/barocss-cad/dist/','packages/barocss-physics/dist/'])assert.ok(emitted.files.some(x=>x.path.startsWith(prefix)));
 for(const x of emitted.files){assert.ok(x.path.startsWith('packages/barocss-cad/dist/')||x.path.startsWith('packages/barocss-physics/dist/'));assert.equal(x.actualPath,root+'/'+x.path);const bytes=await readFile(x.actualPath);assert.equal(bytes.length,x.bytes);assert.equal(sha(bytes),x.sha256);}
 const emittedLedgerSha256=sha(emittedBytes);
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  reference=observer(here+'/reference.py');geometry=observer(here+'/../physics-rigid-contact-reference/geometry-reference.py');
  try{
   const b=await bundle(graph,out);audits.push(b.audit);const m=await import(pathToFileURL(b.path));
   const guard={policy:await policyControls(m,here,reference),world:await worldControls(m),reference:await referenceControls(reference,m)};guards.push({graph,...guard});await save(graph+'-controls',guard);if(graph!=='source')assert.deepEqual(guard,{policy:guards[0].policy,world:guards[0].world,reference:guards[0].reference});
   const start=await runNineStart(m,reference,here,(name,value)=>save(graph+'-'+name,value));starts.push({graph,...start});await save(graph+'-nine-start',start);if(graph!=='source')assert.deepEqual(start,Object.fromEntries(Object.entries(starts[0]).filter(([k])=>k!=='graph')));
   console.log(JSON.stringify({graph,kernelGO:start.kernelGO,kernelStatus:start.result.status,disposition:start.disposition}));
   if(start.kernelGO)for(const scene of ['ALIGNED','OFFSET','YAW']){
    const first=reports.find(r=>r.graph==='source'&&r.scene===scene),report=await runScene(m,reference,geometry,graph,scene,out,budget,first?first.attemptedSteps:1200);reports.push(report);await save(graph+'-'+scene+'-summary',report);
    console.log(JSON.stringify({graph,scene,attemptedSteps:report.attemptedSteps,acceptedSteps:report.acceptedSteps,solverCalls:report.solverCalls,failure:report.failure,baseNumericalGO:report.baseNumericalGO}));
    if(first){for(const key of ['attemptedSteps','acceptedSteps','solverCalls','failure'])assert.deepEqual(report[key],first[key]);for(const key of ['decodedRecordSha256','rawSha256','rawBytes','records'])assert.equal(report.evidence[key],first.evidence[key],scene+' '+key);}
   }
   assert.equal(reference.stderr(),'');assert.equal(geometry.stderr(),'');
  }finally{reference?.close();geometry?.close();reference=geometry=undefined;}
 }
 const allNineStartGO=starts.length===3&&starts.every(x=>x.kernelGO),baseNumericalGO=allNineStartGO&&reports.length===9&&reports.every(x=>x.baseNumericalGO);
 await save('summary',{issue:1399,base:freeze.base,measuredHead:freeze.measuredHead,node:process.version,emittedLedgerSha256,audits,guards:guards.map(x=>({graph:x.graph,policy:x.policy.receipts.length,world:x.world.stepCalls,reference:x.reference.receipts?.length??null})),starts,reports,allNineStartGO,sourceRepeatCompiledParity:true,baseNumericalGO,physicalDisposition:baseNumericalGO?'PRIVATE_FULL_PAIR_WORLD_BASE_GO':allNineStartGO?'NUMERICAL_NO_GO_WORLD':'NUMERICAL_NO_GO_NINE_START',mainTraceCompressedBytes:budget.bytes,fixedCompressedJsonBytes:fixedBytes,mainTraceBudgetBytes:280*1024*1024,fixedEvidenceReserveBytes:20*1024*1024,viewerExecuted:false,publicEngineQualified:false,releaseQualified:false});
}catch(error){await save('execution-failure',{classification:'EXECUTION_FAILURE',...describeThrown(error),completedReports:reports,starts,audits,partialReport:error.partialReport??null});throw error;}finally{reference?.close();geometry?.close();}
