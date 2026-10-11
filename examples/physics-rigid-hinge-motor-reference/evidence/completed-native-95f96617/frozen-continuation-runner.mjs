import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {bundle,verifyFreeze,here,root,sha} from './bundle.mjs';
import {observer} from './observer.mjs';
import {createRecorder} from './archive.mjs';
import {describeThrown} from './recording-base.mjs';
import {consumeCases,completeSavedCase2} from './consumer.mjs';
import {loadSavedPrefix} from './saved-prefix.mjs';
import {providerProvenance} from './fixtures.mjs';
import {runControls} from './controls.mjs';
import {runReferenceControls} from './reference-controls.mjs';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});const reports=[],graphs=[],controls=[],protocols=[],budget={bytes:0};let reference,currentWriter,lastRecord=null;
async function fixedBudget(candidate){const files=new Map();for(const name of await readdir(out)){if(name.endsWith('.jsonl.gz')||name.endsWith('.f64le.gz')||name.includes('emergency'))continue;const s=await stat(out+'/'+name);if(s.isFile())files.set(s.dev+':'+s.ino,s.size);}const bytes=[...files.values()].reduce((a,b)=>a+b,0)+(candidate?.length??0);assert.ok(bytes<=8*1024*1024,'hinge motor fixed evidence budget exceeded');return bytes;}
async function save(name,value){const data=gzipSync(Buffer.from(JSON.stringify(value)+'\n'));await fixedBudget(data);await writeFile(out+'/'+name+'.json.gz',data,{flag:'wx'});}
function exactData(a,b,label){assert.ok(Buffer.from(JSON.stringify(a)).equals(Buffer.from(JSON.stringify(b))),label+' exact persisted bytes');}
try{
 const freeze=await verifyFreeze(),ledgerBytes=await readFile(out+'/emitted-pre-consumer.json'),ledger=JSON.parse(ledgerBytes);assert.equal(ledger.beforeNumericalConsumer,true);assert.equal(ledger.node,process.version);assert.equal(ledger.continuationSource,freeze.measuredHead);assert.equal(ledger.consumerHead,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());assert.equal(ledger.sourceFreezeSha256,freeze.sourceFreezeSha256);
 const paths=execFileSync('rg',['--files','--hidden','--no-ignore','packages/barocss-cad/dist','packages/barocss-physics/dist'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort();assert.equal(ledger.files.length,ledger.fileCount);assert.ok(ledger.fileCount>0);assert.deepEqual(ledger.files.map(r=>r.path).sort(),paths);assert.equal(new Set(paths).size,paths.length);
 for(const prefix of ['packages/barocss-cad/dist/','packages/barocss-physics/dist/'])assert.ok(ledger.files.some(row=>row.path.startsWith(prefix)));
 for(const item of ledger.files){assert.equal(item.actualPath,root+'/'+item.path);const data=await readFile(item.actualPath);assert.equal(data.length,item.bytes);assert.equal(sha(data),item.sha256);}
 for(const gate of ['build','types']){const data=await readFile(here+'/'+ledger[gate+'ReceiptPath']),receipt=JSON.parse(data);assert.equal(sha(data),ledger[gate+'ReceiptSha256']);assert.equal(receipt.exitCode,0);assert.equal(receipt.beforeHead,ledger[gate+'Head']);assert.equal(receipt.measuredSource,ledger.measuredSource);}
 const saved=await loadSavedPrefix();await save('saved-prefix-origins',saved.origin);
 const genuine=JSON.parse(await readFile(here+'/genuine-before-receipt.json')),before=await readFile(root+'/'+genuine.path);assert.equal(before.length,genuine.fullBytes);assert.equal(sha(before),genuine.fullSha256);const blob=execFileSync('git',['show',genuine.providerNative+':'+genuine.path],{cwd:root,maxBuffer:1024*1024});assert.ok(before.equals(blob));const genuineBeforeRaw=before.subarray(genuine.firstRecordOffset,genuine.firstRecordOffset+genuine.firstRecordBytes);assert.equal(genuineBeforeRaw.length,208);assert.equal(sha(genuineBeforeRaw),genuine.firstRecordSha256);
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const built=await bundle(graph,out);await fixedBudget();graphs.push(built.audit);if(graph==='source-repeat')assert.equal(built.audit.bundleSha256,graphs[0].bundleSha256);const m=await import(pathToFileURL(built.path));reference=observer(here+'/reference.py',{stdinPath:out+'/'+graph+'-reference.requests.jsonl',stdoutPath:out+'/'+graph+'-reference.stdout.log',stderrPath:out+'/'+graph+'-reference.stderr.log',exitPath:out+'/'+graph+'-reference.exit.json'});let graphFailure=null;
  try{
   const first=reports[0],writer=await createRecorder(out,graph+'-flow',budget,graph==='source'?{mode:'source'}:{mode:'parity',canonicalName:'source-flow',canonicalEvidence:first.evidence});currentWriter=writer;
   const writeRecord=async(record,raw=[])=>{lastRecord=record;await writer.write(record,raw);};
   let result;
   if(graph==='source'){
    const rawOf=record=>[...['source','angular','motor','free','projected'].map(k=>record.rawFrames[k]).filter(Boolean).map(v=>Buffer.from(v.hex,'hex')),Buffer.from(record.commandsRaw.hex,'hex')];
    await writeRecord(saved.genuineRecord,rawOf(saved.genuineRecord));
    const rest=await completeSavedCase2(request=>reference.ask(request),saved.restRecord,{writeRecord,authenticatedProof:saved.authenticatedProof});
    const remaining=rest.passed?await consumeCases(m,request=>reference.ask(request),{genuineBeforeRaw,limit:14,beginIndex:2,writeRecord}):null;
    const observations=[saved.genuineRecord,rest,...(remaining?.observations??[])];
    const counts={declaredCases:14,candidateCalls:observations.length,attemptedCases:observations.length,returnedOutputs:0,matchedReturns:0,matchedCaps:0,earlierKnownRefusals:0,motorCalls:0,projectionCalls:0,observerCalls:0,callCountsComplete:true};
    for(const record of observations){counts.returnedOutputs+=record.output!==null?1:0;counts.observerCalls+=record.callbackCount;if(record.calls){counts.motorCalls+=record.calls.motorCalls;counts.projectionCalls+=record.calls.projectionCalls;}else counts.callCountsComplete=false;if(record.passed){if(record.expectedDisposition==='RETURN')counts.matchedReturns++;else counts.matchedCaps++;}else if(record.error!==null&&record.error.message!==`${record.input.config.joints[0].id} exceeded motor reaction limit`)counts.earlierKnownRefusals++;}
    const failure=observations.find(r=>!r.passed)??null;
    result={observations,failure,counts,providerProvenance:providerProvenance,stagedReportSemanticsGO:failure===null&&observations.length===14&&counts.matchedReturns===12&&counts.matchedCaps===2,matchedCapMeansAcceptedOutput:false,worldGO:false,worldCreated:false,worldStepped:false,parent93Replayed:false};
    await save('source-call-origins',{historicalNativeCalls:2,historicalSuccessfulReferences:1,historicalFailedReferenceAttempts:1,newNativeCaseCounts:remaining?.counts??null,newSavedRestReferenceCalls:1,reusedSuccessfulGenuineNativeCalls:1,reusedSuccessfulGenuineReferenceCalls:1,reusedPendingRestNativeCalls:1,logicalCounts:counts,logicalCountsIncludeHistoricalCalls:true,originalFailureRetained:true});
   }else result=await consumeCases(m,request=>reference.ask(request),{genuineBeforeRaw,limit:first.observations.length,writeRecord});await save(graph+'-cases-complete',{graph,...result,evidencePending:true});
   console.log(JSON.stringify({graph,cases:result.observations.length,counts:result.counts,stagedReportSemanticsGO:result.stagedReportSemanticsGO,failure:result.failure?.name??null}));
   if(first)exactData(result,Object.fromEntries(Object.entries(first).filter(([key])=>!['graph','evidence'].includes(key))),'case consumer');
   const native=await runControls(m,{genuineBeforeRaw,writeRecord});controls.push({graph,...native});await save(graph+'-controls',native);if(graph!=='source')exactData(native,Object.fromEntries(Object.entries(controls[0]).filter(([key])=>key!=='graph')),'native controls');
   let protocolIndex=0;const protocol=await runReferenceControls(async request=>{const reply=await reference.ask(request);await writeRecord({kind:'reference-control',index:protocolIndex++,request,reply},[]);return reply;},{askRaw:async line=>{const reply=await reference.askRaw(line);await writeRecord({kind:'reference-control-raw',index:protocolIndex++,line,reply},[]);return reply;}});protocols.push({graph,...protocol});await save(graph+'-reference-controls',protocol);if(graph!=='source')exactData(protocol,Object.fromEntries(Object.entries(protocols[0]).filter(([key])=>key!=='graph')),'reference controls');assert.equal(reference.stderr(),'');await reference.close();reference=null;const evidence=await writer.finish();currentWriter=null;const report={graph,...result,evidence};reports.push(report);await save(graph+'-summary',report);if(first)for(const key of ['records','decodedRecordSha256','rawBytes','rawSha256'])assert.equal(evidence[key],first.evidence[key]);
  }catch(error){graphFailure={value:error};throw error;}finally{if(reference){try{await reference.close();}catch(closeError){if(graphFailure){try{await save(graph+'-reference-close-failure',{primary:describeThrown(graphFailure.value),secondary:describeThrown(closeError)});}catch(persistenceError){console.error(JSON.stringify({secondaryPersistenceFailure:describeThrown(persistenceError),originalPrimaryPreserved:true}));}}else throw closeError;}finally{reference=null;}}}
 }
 const stagedReportSemanticsGO=reports.length===3&&reports.every(r=>r.stagedReportSemanticsGO);
 await save('summary',{issue:1179,continuationAfterExecutionFailure:true,historicalConsumerHead:'cd24a151b834f3362d78449fa1f667a3d03fd9b3',historicalSourceHead:ledger.measuredSource,base:freeze.base,measuredHead:freeze.measuredHead,consumerHead:ledger.consumerHead,node:process.version,sourceFreezeSha256:freeze.sourceFreezeSha256,emittedLedgerSha256:sha(ledgerBytes),graphs,reports,controls,protocols,sourceRepeatCompiledParity:true,stagedReportSemanticsGO,physicalDisposition:stagedReportSemanticsGO?'HINGE_MOTOR_REPORT_SEMANTICS_GO':'NUMERICAL_NO_GO_STAGED_HINGE',genuineBeforeReceipt:genuine,normalMainStoredBytes:budget.bytes,fixedUniqueBytesBeforeSummary:await fixedBudget(),mainBudgetBytes:64*1024*1024,fixedBudgetBytes:8*1024*1024,emergencyDecodedRecordBudgetBytes:2*1024*1024,expectedCapMeansAcceptedWorld:false,worldCreated:false,worldStepped:false,parent93Replayed:false,viewerExecuted:false,publicEngineQualified:false,releaseQualified:false});
}catch(error){try{if(currentWriter)await currentWriter.emergency({kind:'execution-failure',lastCompletedSafeRecord:lastRecord,error:describeThrown(error)});await save('execution-failure',{classification:'EXECUTION_FAILURE',error:describeThrown(error),completedReports:reports,graphs,controls,protocols});}catch(archiveError){console.error(JSON.stringify({archiveFailure:describeThrown(archiveError),primaryFailure:describeThrown(error)}));}throw error;}
