import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {here,root,GRAPHS,bundle,validateSource,verifyEmitted} from './bundle.mjs';
import {loadInputs,rawBodies,digest} from './archive.mjs';
import {controls} from './controls.mjs';
import {literalCandidateControls,orbitalLossCandidateControl} from './reference-controls.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
const parentRoot=resolve(process.argv[2]??'/Users/user/.codex/worktrees/physics-multi-hinge/barocss'),out=resolve(process.argv[3]??'/tmp/physics-1309-canonical');
await mkdir(out,{recursive:true});let context=null,oracle=null,candidateCalls=0;const reports=[],audits=[],receipts=[];
function finiteData(value){if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string'||typeof value==='boolean')return true;if(Array.isArray(value))return value.every(finiteData);if(value&&typeof value==='object')return Object.values(value).every(finiteData);return false;}
function compareDiagnostics(output,reference){
 assert.ok(reference&&typeof reference==='object'&&typeof reference.ok==='boolean'&&reference.resolved===true&&reference.executionFailure===false,'reference execution/protocol failure');
 assert.ok(finiteData(reference.metrics)&&finiteData(reference.reference),'reference null/nonfinite numeric response');
 let maximum=0;const d=output.diagnostics;
 for(const [name,view]of [['before',reference.reference.before.raw],['after',reference.reference.after.raw]]){
  for(const key of ['relativeAngleRad','anchorGapM','axisDeviationRad','quaternionNormError','limitExcessRad','energyJ']){assert.equal(typeof d[name][key],'number');assert.equal(typeof view[key],'number');maximum=Math.max(maximum,Math.abs(d[name][key]-view[key]));}
  for(const key of ['anchorAM','anchorBM','centerOfMassM','linearMomentumVectorKgMps','angularMomentumVectorKgM2ps']){assert.equal(d[name][key].length,3);assert.equal(view[key].length,3);for(let i=0;i<3;i++)maximum=Math.max(maximum,Math.abs(d[name][key][i]-view[key][i]));}
 }
 assert.equal(d.lawEvaluations,1);assert.equal(d.velocityBitsUnchanged,true);assert.equal(d.angularVelocityBitsUnchanged,true);
 assert.deepEqual(Object.keys(output.poseReport).sort(),['finalAngleRad','jointId','targetAngleRad']);
 return {maximumDifference:maximum,agree:maximum<=1e-12};
}
function comparable(row){const {graph,archiveGraph,...rest}=row;return rest;}
try{
 assert.equal(process.version,'v22.22.0');const source=await validateSource(),emitted=await verifyEmitted(out),input=await loadInputs(parentRoot,root);
 let frozenPrefix=null; // Once the first graph fails, later graphs consume exactly that prefix.
 for(const graph of GRAPHS){
  context={graph,phase:'bundle'};const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));oracle=observer(resolve(here,'reference.py'));
  context={graph,phase:'refusal-controls'};const control=await controls(m,oracle,input);receipts.push(control);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(control,null,2)+'\n');
  const selected=input.records.filter(row=>row.archiveGraph===graph),cases=[...literalCandidateControls.map(row=>({kind:'analytical',name:row.name,input:structuredClone(row.input),expected:structuredClone(row.expected)})),...selected.map(row=>({kind:'archived',name:`${row.step}/${row.group}/${row.origin}`,input:{config:structuredClone(row.config),state:structuredClone(row.state),dt:1/120},record:row})),{kind:'analytical-inconsistent',name:orbitalLossCandidateControl.name,input:structuredClone(orbitalLossCandidateControl.input),expectedPhysicalNoGo:true}];
  const observations=[],beforeRaw=[],afterRaw=[];let failure=null;
  const limit=frozenPrefix??cases.length;
  for(let index=0;index<limit;index++){
   const item=cases[index],request=item.input,pristine=structuredClone(request),rawBefore=rawBodies(request.state.bodies);context={graph,index,kind:item.kind,name:item.name};let output=null,reference=null,compared=null,refusal=null;
   candidateCalls++;
   try{output=m.projectCoupledHingeCandidate(request.config,request.state,request.dt);}catch(error){if(error instanceof m.PhysicsError&&error.code==='NUMERIC_LIMIT')refusal={name:error.name,code:error.code,message:error.message,outputUnavailable:true};else throw error;}
   assert.deepEqual(request,pristine,'candidate retains complete copied input carrier');assert.deepEqual(rawBodies(request.state.bodies),rawBefore,'candidate retains raw13 input bits');
   let rawAfter=null,velocityBitsUnchanged=null;
   if(output){
    rawAfter=rawBodies(output.bodies);velocityBitsUnchanged=output.bodies.every((body,i)=>['velocityMps','angularVelocityRadps'].every(field=>body[field].every((value,k)=>Object.is(value,request.state.bodies[i][field][k]))));assert.equal(velocityBitsUnchanged,true);
    const actual=structuredClone(output);reference=await oracle.ask({...pristine,output:actual,beforeRawHex:rawBefore.toString('hex'),afterRawHex:rawAfter.toString('hex')});compared=compareDiagnostics(actual,reference);
    // Mutate the actual returned copy once, without a second law invocation.
    const detachedAnchor=structuredClone(output.diagnostics.after.anchorAM);output.bodies[0].positionM[0]=999;output.poseReport.finalAngleRad=999;output.diagnostics.before.anchorAM[0]=999;assert.deepEqual(request,pristine,'returned mutations cannot reach inputs');assert.deepEqual(output.diagnostics.after.anchorAM,detachedAnchor,'body/diagnostic copies cannot alias');output=actual;
   }
   const passed=output!==null&&reference.ok===true&&reference.resolved===true&&compared.agree;
   const observation={...context,archiveGraph:item.record?.archiveGraph??null,step:item.record?.step??null,group:item.record?.group??null,origin:item.record?.origin??null,literalExpected:item.expected??null,pretrialPredictedNoGo:item.expectedPhysicalNoGo===true,input:pristine,output,refusal,reference,compared,velocityBitsUnchanged,beforeRawHex:rawBefore.toString('hex'),beforeRawSha256:digest(rawBefore),afterRawHex:rawAfter?.toString('hex')??null,afterRawSha256:rawAfter?digest(rawAfter):null,passed,lawInvocations:1,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false};
   observations.push(observation);beforeRaw.push(rawBefore);if(rawAfter)afterRaw.push(rawAfter);
   await writeFile(resolve(out,`${graph}-partial-report.json.gz`),gzipSync(JSON.stringify({graph,observations,failure:passed?null:observation})));
   await writeFile(resolve(out,`${graph}-before.f64le`),Buffer.concat(beforeRaw));await writeFile(resolve(out,`${graph}-after.f64le`),Buffer.concat(afterRaw));
   if(!passed){failure=observation;if(frozenPrefix===null)frozenPrefix=index+1;break;}
  }
  if(frozenPrefix!==null)assert.equal(observations.length,frozenPrefix,'repeat consumes exact first-failure prefix');
  const report={graph,observations,failure,detachedPoseOnlyGO:failure===null&&observations.length===cases.length,completedArchivedRecords:observations.filter(row=>row.kind==='archived').length,completedAnalyticalCases:observations.filter(row=>row.kind.startsWith('analytical')).length,successfulCandidateCalls:observations.filter(row=>row.output!==null).length,worldCreated:false,worldStepped:false,publicEngineGO:false};reports.push(report);await writeFile(resolve(out,`${graph}-report.json.gz`),gzipSync(JSON.stringify(report)));console.log(JSON.stringify({graph,observations:observations.length,detachedPoseOnlyGO:report.detachedPoseOnlyGO,firstFailure:failure?{kind:failure.kind,name:failure.name,refusal:failure.refusal,violations:failure.reference?.violations??null}:null}));
  oracle.close();oracle=null;
 }
 assert.equal(new Set(audits.map(row=>row.sourcePath)).size,3,'actual distinct bundle files');
 for(const report of reports.slice(1)){assert.deepEqual(report.observations.map(comparable),reports[0].observations.map(comparable),'source-repeat/genuine-compiled exact output/reference/refusal/raw prefix parity');assert.equal(report.detachedPoseOnlyGO,reports[0].detachedPoseOnlyGO);}
 for(const control of receipts.slice(1))assert.deepEqual(control,receipts[0],'exact control parity');
 const archived=reports.reduce((sum,row)=>sum+row.completedArchivedRecords,0);if(reports[0].detachedPoseOnlyGO)assert.equal(archived,24);
 const summary={issue:1309,base:'63d20195a9d980a31930c682ed56e8be87d5a11f',measuredSource:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,sourcePins:Object.keys(source).length,emittedLedgerSha256:emitted.sha256,parent:{native:'0de27c51574e2da6b09966c7ef0c28435d9c9592',pins:Object.keys(input.pins).length,artifacts:26,files:input.files.size},diagnosticParent:input.diagnostic,selectedRecords:24,completedArchivedRecords:archived,completedAnalyticalCases:reports.reduce((sum,row)=>sum+row.completedAnalyticalCases,0),candidateCalls,expectedOriginalBoundsRefusalCalls:receipts.length,detachedPoseOnlyGO:reports.every(row=>row.detachedPoseOnlyGO),sourceRepeatCompiledEqual:true,firstFailure:reports[0].failure,graphAudits:audits,controls:receipts,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false,publicEngineGO:false,historicalCauseEstablished:false,worldVelocityMotorLawQualified:false};await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({detachedPoseOnlyGO:summary.detachedPoseOnlyGO,completedArchivedRecords:archived,candidateCalls,sourceRepeatCompiledEqual:true}));
}catch(error){await writeFile(resolve(out,'execution-failure.json'),JSON.stringify({context,name:error?.name??null,code:error?.code??null,message:error?.message??String(error),candidateCalls,classification:'execution failure; no physical GO or tuning'},null,2)+'\n');throw error;}finally{oracle?.close();}
