import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {here,root,bundle,verifySource,verifyEmitted,digest} from './bundle.mjs';
import {verifyParent} from './freeze.mjs';
import {openReference} from './observer.mjs';
import {runReferenceControls} from './reference-controls.mjs';
const out=resolve(process.argv[2]??'/tmp/physics-1298-canonical');
const reports=[],audits=[];let oracle=null,context=null,partial=null;
const save=(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n');
function episodeTime(rows){for(const row of rows)if(row.request?.diagnostic?.hit!==null&&row.request?.diagnostic?.hit!==undefined)return row.request.previousState.timeSeconds+row.request.diagnostic.hitTimeSeconds;return null;}
function errorData(error){return {name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};}
try{
 await mkdir(out,{recursive:true});assert.equal(process.version,'v22.22.0');const sourceFreeze=await verifySource(),parent=await verifyParent(),emittedFreeze=await verifyEmitted(out);
 oracle=openReference(resolve(here,'reference.py'));const referenceControls=await runReferenceControls(data=>oracle.ask(data));await save('oracle-controls.json',referenceControls);
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const built=await bundle(graph,out);audits.push(built.audit);const api=await import(pathToFileURL(built.path));
  partial={graph,structural:api.runStructuralControls(api),cases:[],halfComparison:null,transactions:null,rest:null,bounds:null,disposals:[],firstFailure:null};
  const rawRows=[];const register=(label,world)=>{const capture=api.captureWorld(world);rawRows.push({label,...capture});return capture;};
  function create(config){const before=structuredClone(config),recorder=api.attemptRecorder(),world=api.createCapsuleFaceCandidateWorld(config,{observeAttempt:recorder.observeAttempt});assert.deepEqual(config,before);assert.equal(world.getCapsuleFaceStepDiagnostics(),null);return {world,recorder,config:structuredClone(config),initial:api.referenceInputFor(config),records:[],constructorInputUnchanged:true};}
  async function step(harness,label,{mutate=false}={}){
   const before=register(label+'-before',harness.world),attemptCount=harness.recorder.attempts.length;let accepted=null,caught=null;
   context={graph,label,prior:before};harness.recorder.setMode(mutate?'mutate':'record');
   try{accepted=harness.world.step(harness.config.fixedStepSeconds);}catch(error){caught=error;}
   const actual=register(label+'-after',harness.world),attempt=harness.recorder.attempts.length>attemptCount?harness.recorder.last():null;
   if(caught){api.assertUnchanged(harness.world,before,'allacceptedstate/diag/rawbits onrefusal');if(!(caught instanceof api.PhysicsError)||!['NUMERIC_LIMIT','INITIAL_OVERLAP'].includes(caught.code))throw caught;}
   if(mutate&&caught){const error=new Error('Copied observer mutation changed step outcome');error.code='OBSERVER_COPY_FAILURE';error.refusal=errorData(caught);throw error;}
   if(accepted){assert.deepEqual(accepted,actual.state);assert.equal(actual.state.stepIndex,before.state.stepIndex+1);assert.equal(actual.state.timeSeconds,actual.state.stepIndex*harness.config.fixedStepSeconds);assert.equal(actual.diagnostic.acceptedStepIndex,actual.state.stepIndex);assert.equal(actual.diagnostic.stepSeconds,harness.config.fixedStepSeconds);assert.deepEqual(actual.state.pairStats,{eligiblePairs:8,candidatePairs:8,aabbTests:0});if(attempt)assert.deepEqual(attempt,{workingState:actual.state,diagnostics:actual.diagnostic},'detached attempted snapshot matches commit');}
   const state=accepted?actual.state:attempt?.workingState,diagnostic=accepted?actual.diagnostic:attempt?.diagnostics;
   let request=null,reference=null;
   if(state&&diagnostic){request={initial:structuredClone(harness.initial),stepIndex:state.stepIndex,previousState:before.state,state,diagnostic,outcome:accepted?'accepted':'attempted-refused',...(caught?{refusal:errorData(caught)}:{}),rawStateHex:api.rawState(state).toString('hex')};reference=await oracle.ask(request);if(reference.executionFailure||reference.resolved!==true){const error=new Error('Independent world observer execution failed');error.code='REFERENCE_EXECUTION';error.reference=reference;throw error;}}
   const physicalFailure=!!caught||reference?.ok===false;
   const row={label,previousAccepted:before,attempt,accepted:accepted?actual:null,acceptedAfterRefusal:accepted?null:actual,refusal:caught?errorData(caught):null,request,reference,physicalFailure,originalEightPassState:state?.pairStats??null,observerMutationControl:mutate,physicalLabel:'only original-size selected negative-X face; angular/friction unqualified'};
   harness.records.push(row);partial.cases.push(row);if(physicalFailure&&!partial.firstFailure)partial.firstFailure={label,refusal:row.refusal,violations:reference?.violations??null,attemptAvailable:!!attempt,priorAcceptedStep:before.state.stepIndex,attemptedStep:state?.stepIndex??before.state.stepIndex+1};
   await save(graph+'-partial-report.json',partial);context={graph,label,record:row};return row;
  }
  const full=create(api.worldCases[0].config),active=[full];let stopped=false;
  try{
   const first=await step(full,'original-full-step1');stopped=first.physicalFailure;
   if(!stopped){
    partial.getterCopies=api.getterCopyControls(full.world);partial.diagnosticRefusals=api.diagnosticControls(api,first.accepted.diagnostic);
    const halfConfig=structuredClone(full.config);halfConfig.fixedStepSeconds=1/240;const halves=create(halfConfig);active.push(halves);
    const h1=await step(halves,'original-half-step1');stopped=h1.physicalFailure;
    if(!stopped){const h2=await step(halves,'original-half-step2');stopped=h2.physicalFailure;
     if(!stopped){
      const fullState=first.accepted.state,halfState=h2.accepted.state;
      assert.equal(fullState.stepIndex,1);assert.equal(halfState.stepIndex,2);assert.ok(Math.abs(fullState.timeSeconds-halfState.timeSeconds)<=1e-12);
      for(let i=0;i<2;i++){const a=structuredClone(fullState.bodies[i]),b=structuredClone(halfState.bodies[i]);for(const key of ['positionM','velocityMps']){assert.ok(Math.hypot(...a[key].map((v,k)=>v-b[key][k]))<=1e-12);delete a[key];delete b[key];}assert.deepEqual(a,b,'full/half fixedbodymetadata exact');}
      const firstFull=episodeTime([first]),firstHalf=episodeTime([h1,h2]);assert.ok(firstFull!==null&&firstHalf!==null);assert.ok(Math.abs(firstFull-firstHalf)<=1e-12);
      const reply=await oracle.ask({op:'episode',full:first.request,halves:[h1.request,h2.request]});if(reply.executionFailure||reply.resolved!==true){const error=new Error('Independent episode observer execution failed');error.code='REFERENCE_EXECUTION';error.reference=reply;throw error;}
      partial.halfComparison={fullCursor:1,halfCursor:2,fullElapsed:fullState.timeSeconds,halfElapsed:halfState.timeSeconds,firstFullAbsoluteContactTime:firstFull,firstHalfAbsoluteContactTime:firstHalf,fullStepLocalCCD:fullState.ccdHits,halfStepLocalCCD:[h1.accepted.state.ccdHits,h2.accepted.state.ccdHits],fullEvents:fullState.events,halfEvents:[h1.accepted.state.events,h2.accepted.state.events],wholeStateEqualityClaimed:false,reference:reply};
      if(reply.ok===false){partial.firstFailure={label:'full-two-half-episode',violations:reply.violations};stopped=true;}
     }
    }
    if(!stopped){partial.transactions=api.transactionControls(api,full.world,full.recorder);const rest=await step(full,'original-one-stationary-copy-control',{mutate:true});partial.rest=rest;stopped=rest.physicalFailure;if(!stopped)assert.equal(episodeTime(full.records),episodeTime([first]),'touchingrest never replaces first episode time');}
   }
   if(!stopped){for(const test of api.worldCases.slice(1)){const h=create(test.config);active.push(h);const row=await step(h,test.name);if(row.physicalFailure){stopped=true;break;}}}
   // The original numeric bound is an error/transaction control, not a further physicalcase.
   if(!stopped)partial.bounds=api.originalBoundsControl(api,api.attemptRecorder());
  }finally{for(const h of active)partial.disposals.push(api.disposeControls(api,h.world));}
  const bytes=Buffer.concat(rawRows.map(r=>api.rawState(r.state))),numeric=Buffer.concat(rawRows.map(r=>Buffer.from(r.allNumericHex,'hex')));
  const report={...partial,verdict:partial.firstFailure?'PHYSICAL_NO_GO':'GO',privateSelectedCapsuleFaceWorldGO:!partial.firstFailure,fullWorldCCDGO:false,configurableCapsuleSweepGO:false,rigidAngularResponseMeasured:false,contactFrictionMeasured:false,physicalCampaignCount:1,rawRows,rawSha256:digest(bytes),rawBytes:bytes.length,allNumericSha256:digest(numeric),allNumericBytes:numeric.length,sourceAliases:false};reports.push(report);
  await writeFile(resolve(out,`${graph}-raw13.f64.bin`),bytes);await writeFile(resolve(out,`${graph}-all-numbers.f64.bin`),numeric);await save(graph+'-report.json',report);console.log(JSON.stringify({graph,verdict:report.verdict,physicalCaseSteps:report.cases.length,firstFailure:report.firstFailure,rawSha256:report.rawSha256}));
 }
 const {graph,...first}=reports[0];for(const report of reports.slice(1)){const {graph,...next}=report;assert.deepEqual(next,first,'exact live source/repeat/genuinecompiled fields/errors/rawbits/diagnostics/prefix parity');}
 await save('summary.json',{issue:1298,base:sourceFreeze.base,measuredSource:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,sourceFreezeSha256:digest(await readFile(resolve(here,'source-freeze.json'))),emittedLedgerSha256:emittedFreeze.ledgerSha256,parent,graphs:audits,verdict:reports[0].verdict,privateSelectedCapsuleFaceWorldGO:reports.every(r=>r.privateSelectedCapsuleFaceWorldGO),firstFailure:reports[0].firstFailure,sourceRepeatCompiledParity:true,wholeFullHalfStateEqualityClaimed:false,fullWorldCCDGO:false,configurableCapsuleSweepGO:false,rigidAngularResponseMeasured:false,contactFrictionMeasured:false,referenceControls:{face:referenceControls.faceReceipts.length,world:referenceControls.worldReceipts.length,syntheticWorldControlsNotActualWorldEvidence:true},rawSha256:reports[0].rawSha256,stderr:oracle.stderr()});
}catch(error){await mkdir(out,{recursive:true});await save('execution-failure.json',{classification:'harness/reference/control execution failure; not physicalNO-GO',context,firstFailure:errorData(error),stack:error?.stack??null,reference:error?.reference??null,completedGraphs:reports.length,partial});throw error;}finally{oracle?.close();}
