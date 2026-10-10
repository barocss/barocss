import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {here,root,GRAPHS,bundle,validateSource,verifyEmitted} from './bundle.mjs';
import {loadInputs,rawBodies,digest} from './archive.mjs';
import {controls} from './controls.mjs';
import {firstPhysicalCase,literalCases} from './literal-cases.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
const parentRoot=resolve(process.argv[2]??'/Users/user/.codex/worktrees/physics-multi-hinge/barocss'),out=resolve(process.argv[3]??'/tmp/physics-1349-canonical');
await mkdir(out,{recursive:true});let context=null,oracle=null,physicalCalls=0;const reports=[],audits=[],receipts=[];
const scalarKeys=['relativeAngleRad','anchorGapM','axisDeviationRad','quaternionNormError','limitExcessRad','energyJ'];
const vectorKeys=['anchorAM','anchorBM','centerOfMassM','linearMomentumVectorKgMps','orbitalAngularMomentumVectorKgM2ps','spinAngularMomentumVectorKgM2ps','angularMomentumVectorKgM2ps','anchorVelocityAMps','anchorVelocityBMps','anchorRelativeVelocityMps','relativeAngularVelocityRadps'];
function finiteNumber(value,label){assert.ok(typeof value==='number'&&Number.isFinite(value),`finite numeric protocol: ${label}`);return value;}
function dense(value,size,label){assert.ok(Array.isArray(value)&&value.length===size&&Reflect.ownKeys(value).length===size+1&&Array.from({length:size},(_,i)=>Object.hasOwn(value,i)).every(Boolean),`dense protocol: ${label}`);}
function numericTree(value,label){if(typeof value==='number')return finiteNumber(value,label);if(typeof value==='boolean'||typeof value==='string')return value;if(Array.isArray(value)){dense(value,value.length,label);value.forEach((v,i)=>numericTree(v,`${label}.${i}`));return value;}assert.ok(value&&typeof value==='object',`non-null protocol: ${label}`);for(const [key,v]of Object.entries(value))numericTree(v,`${label}.${key}`);return value;}
function compareQuantity(actual,expected,label,absolute,relative=0){
 if(Array.isArray(expected)){dense(expected,expected.length,`reference.${label}`);assert.ok(Array.isArray(actual),`numeric array protocol: ${label}`);dense(actual,actual.length,label);if(actual.length!==expected.length)return {maximum:0,agree:false,shapeDifference:true};let maximum=0,agree=true;expected.forEach((v,i)=>{const c=compareQuantity(actual[i],v,`${label}.${i}`,absolute,relative);maximum=Math.max(maximum,c.maximum);agree=agree&&c.agree;});return {maximum,agree};}
 const a=finiteNumber(actual,label),b=finiteNumber(expected,`reference.${label}`),difference=Math.abs(a-b);return {maximum:difference,agree:difference<=Math.max(absolute,relative*Math.abs(b))};
}
function compareOutput(input,output,reply,literalExpected){
 assert.ok(reply&&typeof reply==='object'&&typeof reply.ok==='boolean'&&reply.resolved===true&&reply.executionFailure===false,'reference execution/protocol failure');
 numericTree(reply.metrics,'metrics');
 for(const key of ['precisionMaxDifference','scalarRepeatMaxDifferenceRad','expectedPositionErrorM','expectedQuaternionError','expectedLinearVelocityErrorMps','expectedAngularVelocityErrorRadps','objectiveErrorJ','diagnosticMeasurementError','diagnosticCorrectionError','rawNormalizedGeometryDifference','rawComChangeM','normalizedComChangeM','rawLinearMomentumChangeKgMps','normalizedLinearMomentumChangeKgMps','rawAngularMomentumChangeKgM2ps','normalizedAngularMomentumChangeKgM2ps'])finiteNumber(reply.metrics[key],`metrics.${key}`);
 for(const key of ['coefficientAgreementFailed','inertiaBitsAgree','branchAgreement','actualFrameCertificatePassed','changedComponentsAgree','identityBitsPreserved'])assert.equal(typeof reply.metrics[key],'boolean',`boolean metric: ${key}`);
 assert.ok(reply.metrics.precisionMaxDifference<=1e-25&&reply.metrics.scalarRepeatMaxDifferenceRad<=1e-12,'independent reference precision must resolve');
 assert.ok(Array.isArray(reply.violations));const ref=reply.reference,certificate=reply.certificate?.expected;assert.ok(ref&&certificate,'reference expected model/certificate required');
 assert.equal(certificate.primalZero,true);assert.equal(certificate.stationarityZero,true);assert.equal(certificate.stopKktPassed,true);assert.ok(certificate.rank===11||certificate.rank===12);assert.equal(certificate.rowCount,certificate.rank);
 dense(output.bodies,2,'bodies');dense(ref.expectedBodies,2,'reference bodies');dense(ref.nativeInertiaKgM2,2,'reference native inertia');
 const comparisons={},failures=[];let agree=true;
 function compare(name,actual,expected,absolute,relative=0){const c=compareQuantity(actual,expected,name,absolute,relative);comparisons[name]=c;agree=agree&&c.agree;if(!c.agree)failures.push(name);}
 for(let i=0;i<2;i++){
  assert.equal(output.bodies[i].id,input.state.bodies[i].id);assert.equal(ref.expectedBodies[i].id,input.state.bodies[i].id);
  compare(`position${i}`,output.bodies[i].positionM,ref.expectedBodies[i].positionM,1e-12);compare(`orientation${i}`,output.bodies[i].orientation,ref.expectedBodies[i].orientation,1e-12);
  compare(`velocity${i}`,output.bodies[i].velocityMps,ref.expectedBodies[i].velocityMps,1e-10);compare(`angularVelocity${i}`,output.bodies[i].angularVelocityRadps,ref.expectedBodies[i].angularVelocityRadps,1e-9);
  assert.ok(Object.is(output.bodies[i].inertiaKgM2,ref.nativeInertiaKgM2[i]),'original binary inertia bits');
 }
 assert.deepEqual(Object.keys(output.poseReport).sort(),['finalAngleRad','jointId','targetAngleRad']);assert.equal(output.poseReport.jointId,ref.poseReport.jointId);compare('poseReport.finalAngle',output.poseReport.finalAngleRad,ref.poseReport.finalAngleRad,1e-12);compare('poseReport.targetAngle',output.poseReport.targetAngleRad,ref.poseReport.targetAngleRad,1e-12);
 const d=output.diagnostics,p=d.projection,expectedProjection=ref.projection;
 assert.deepEqual(Object.keys(d).sort(),['poseStage','before','after','velocityCorrections','projection','changedComponents','identityVelocityBitsPreserved','poseLawEvaluations','sourceStepIndex','sourceTimeSeconds'].sort());
 numericTree(d,'diagnostics');assert.equal(d.poseLawEvaluations,1);assert.equal(d.poseStage.lawEvaluations,1);assert.equal(d.poseStage.velocityBitsUnchanged,true);assert.equal(d.poseStage.angularVelocityBitsUnchanged,true);assert.equal(d.sourceStepIndex,input.state.stepIndex);assert.equal(d.sourceTimeSeconds,input.state.timeSeconds);
 for(const name of ['before','after']){for(const key of scalarKeys)compare(`${name}.${key}`,d[name][key],ref[name].raw[key],1e-12);for(const key of vectorKeys)compare(`${name}.${key}`,d[name][key],ref[name].raw[key],key.endsWith('Mps')?1e-10:key==='relativeAngularVelocityRadps'?1e-9:1e-12);}
 for(const key of ['dimensionlessA','dimensionlessB','dimensionlessH','dimensionlessX0'])compare(`projection.${key}`,p[key],expectedProjection[key],1e-12,1e-12);
 for(const key of ['physicalA','physicalB','physicalH','physicalX0','columnScales','rowDivisors','centerOfMassOriginM','originalOriginM','physicalStopRow','dimensionlessStopRow'])compare(`projection.${key}`,p[key],expectedProjection[key],1e-12,1e-12);
 compare('projection.objectiveJ',p.objectiveJ,expectedProjection.objectiveJ,1e-10);compare('projection.rankSufficientMarginKgM2',p.rankSufficientMarginKgM2,expectedProjection.rankSufficientMarginKgM2,1e-12);
 assert.deepEqual(p.dofOrder,expectedProjection.dofOrder);if(JSON.stringify(p.rowIds)!==JSON.stringify(expectedProjection.rowIds)){agree=false;failures.push('independent selected row labels');}
 const branchAgreement=p.stopKind===expectedProjection.stopKind&&p.result.activeStop===certificate.activeStop&&p.result.identity===certificate.identity;
 if(!branchAgreement){agree=false;failures.push('independent active/identity branch');}
 if(literalExpected&&(p.stopKind!==literalExpected.stopKind||p.result.activeStop!==literalExpected.activeStop)){agree=false;failures.push('frozen literal branch');}
 const actualChanged=output.bodies.map((body,i)=>[...body.velocityMps,...body.angularVelocityRadps].map((v,k)=>!Object.is(v,[...input.state.bodies[i].velocityMps,...input.state.bodies[i].angularVelocityRadps][k])));
 assert.deepEqual(d.changedComponents,actualChanged);const identityBitsPreserved=actualChanged.every(row=>row.every(changed=>!changed));assert.equal(d.identityVelocityBitsPreserved,p.result.identity&&identityBitsPreserved);if(p.result.identity)assert.equal(identityBitsPreserved,true);
 assert.ok(reply.certificate.actualFrame&&typeof reply.certificate.actualFrame==='object','rounded output-frame certificate is separate and required');
 return {agree,comparisons,failures,branchAgreement,identityBitsPreserved,expectedExactRank:certificate.rank,actualFrameCertificateSeparate:true};
}
function comparable(row){const {graph,archiveGraph,...rest}=row;return rest;}
function poseProof(pose){const {filesMap,...proof}=pose;return proof;}
async function persist(graph,observations,failure,before,after){await writeFile(resolve(out,`${graph}-partial-report.json.gz`),gzipSync(JSON.stringify({graph,observations,failure})));await writeFile(resolve(out,`${graph}-before.f64le`),Buffer.concat(before));await writeFile(resolve(out,`${graph}-after.f64le`),Buffer.concat(after));}
try{
 assert.equal(process.version,'v22.22.0');
 // Validate the published actual emitted ledger before any bundle, oracle or control.
 const source=await validateSource(),emitted=await verifyEmitted(out),input=await loadInputs(parentRoot,root),frozenInputs=JSON.parse(await readFile(resolve(here,'input-freeze.json')));
 assert.equal(literalCases.length,22);assert.deepEqual(JSON.parse(JSON.stringify(literalCases)),frozenInputs.literalCases);assert.deepEqual(JSON.parse(JSON.stringify(firstPhysicalCase)),frozenInputs.firstPhysicalCase);
 assert.ok(Object.is(literalCases[1].input.state.bodies[0].velocityMps[1],-0));assert.ok(Object.is(literalCases[1].input.state.bodies[1].angularVelocityRadps[0],-0));
 let frozenPrefix=null;
 for(const graph of GRAPHS){
  context={graph,phase:'bundle'};const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));oracle=observer(resolve(here,'reference.py'));
  context={graph,phase:'guards'};const control=await controls(m,oracle,input);receipts.push(control);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(control,null,2)+'\n');
  const selected=input.records.filter(row=>row.archiveGraph===graph);assert.equal(selected.length,8);
  const cases=[{kind:'original-counterexample',...structuredClone(firstPhysicalCase)},...selected.map(record=>({kind:'archived',name:`${record.step}/${record.group}/${record.origin}`,input:{config:structuredClone(record.config),state:structuredClone(record.state),dt:1/120},record})),...literalCases.map(row=>({kind:'literal',...structuredClone(row)}))];assert.equal(cases.length,31);
  const observations=[],beforeRaw=[],afterRaw=[];let failure=null;const limit=frozenPrefix??cases.length;
  for(let index=0;index<limit;index++){
   const item=cases[index],request=item.input,pristine=structuredClone(request),rawBefore=rawBodies(request.state.bodies);context={graph,index,kind:item.kind,name:item.name};let output=null,reference=null,compared=null,refusal=null;physicalCalls++;
   try{output=m.projectHingePoseVelocityReference(request.config,request.state,request.dt);}catch(error){if(error instanceof m.PhysicsError&&error.code==='NUMERIC_LIMIT')refusal={name:error.name,code:error.code,message:error.message,outputUnavailable:true};else throw error;}
   assert.deepEqual(request,pristine,'complete input carrier retained');assert.deepEqual(rawBodies(request.state.bodies),rawBefore,'raw13 input bits retained');
   let rawAfter=null;
   if(output){
    rawAfter=rawBodies(output.bodies);const actual=structuredClone(output);reference=await oracle.ask({...pristine,output:actual,beforeRawHex:rawBefore.toString('hex'),afterRawHex:rawAfter.toString('hex')});compared=compareOutput(pristine,actual,reference,item.expectedBranch);
    // Exercise copied returns without a second law invocation.
    const anchor=structuredClone(output.diagnostics.after.anchorAM),matrix=structuredClone(output.diagnostics.projection.dimensionlessA),certificate=structuredClone(output.diagnostics.projection.result.certificate);
    output.bodies[0].positionM[0]=999;output.poseReport.finalAngleRad=999;output.diagnostics.before.anchorAM[0]=999;output.diagnostics.poseStage.before.anchorAM[0]=999;output.diagnostics.projection.physicalA[0][0]=999;output.diagnostics.projection.result.y[0]=999;
    assert.deepEqual(output.diagnostics.after.anchorAM,anchor,'body and diagnostic arrays detached');assert.deepEqual(output.diagnostics.projection.dimensionlessA,matrix,'physical/dimensionless arrays detached');assert.deepEqual(output.diagnostics.projection.result.certificate,certificate,'result/certificate detached');assert.deepEqual(request,pristine,'returned mutations cannot reach caller');assert.deepEqual(rawBodies(request.state.bodies),rawBefore);output=actual;
   }
   const passed=output!==null&&reference.ok===true&&compared.agree;
   const observation={...context,archiveGraph:item.record?.archiveGraph??null,step:item.record?.step??null,group:item.record?.group??null,origin:item.record?.origin??null,expectedBranch:item.expectedBranch??null,input:pristine,output,refusal,reference,compared,beforeRawHex:rawBefore.toString('hex'),beforeRawSha256:digest(rawBefore),afterRawHex:rawAfter?.toString('hex')??null,afterRawSha256:rawAfter?digest(rawAfter):null,passed,classification:passed?'PASS':refusal?'NUMERICAL_REFUSAL':'NUMERICAL_NO_GO',physicalCalls:1,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false};
   observations.push(observation);beforeRaw.push(rawBefore);if(rawAfter)afterRaw.push(rawAfter);await persist(graph,observations,passed?null:observation,beforeRaw,afterRaw);
   if(!passed){failure=observation;if(frozenPrefix===null)frozenPrefix=index+1;break;}
  }
  if(frozenPrefix!==null)assert.equal(observations.length,frozenPrefix,'same first-failure prefix');
  const report={graph,observations,failure,detachedPoseVelocityMomentumGO:failure===null&&observations.length===31,completedArchivedRecords:observations.filter(row=>row.kind==='archived').length,completedLiterals:observations.filter(row=>row.kind==='literal').length,successfulPhysicalCalls:observations.filter(row=>row.output!==null).length,worldCreated:false,worldStepped:false,publicEngineGO:false};reports.push(report);await writeFile(resolve(out,`${graph}-report.json.gz`),gzipSync(JSON.stringify(report)));console.log(JSON.stringify({graph,observations:observations.length,detachedPoseVelocityMomentumGO:report.detachedPoseVelocityMomentumGO,firstFailure:failure?{name:failure.name,classification:failure.classification,refusal:failure.refusal,violations:failure.reference?.violations??null,comparisons:failure.compared?.failures??null}:null}));oracle.close();oracle=null;
 }
 assert.equal(new Set(audits.map(row=>row.sourcePath)).size,3);for(const report of reports.slice(1)){assert.deepEqual(report.observations.map(comparable),reports[0].observations.map(comparable),'live/raw/source-repeat/genuine-compiled prefix parity');assert.equal(report.detachedPoseVelocityMomentumGO,reports[0].detachedPoseVelocityMomentumGO);}for(const control of receipts.slice(1))assert.deepEqual(control,receipts[0],'exact guard/reference parity');
 const numericalGO=reports.every(row=>row.detachedPoseVelocityMomentumGO);if(numericalGO){assert.equal(physicalCalls,93);assert.equal(reports.reduce((n,row)=>n+row.completedArchivedRecords,0),24);}
 const summary={issue:1349,base:'d6b552f98f4a509611ffce42a65080db063fdda0',measuredSource:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,sourcePins:Object.keys(source).length,emittedLedgerSha256:emitted.sha256,emittedFiles:emitted.ledger.emitted.length,poseParent:poseProof(input.pose),diagnosticParent:input.diagnostic,parentArchive:{native:'0de27c51574e2da6b09966c7ef0c28435d9c9592',pins:Object.keys(input.pins).length,artifacts:26,files:input.files.size},declaredCasesPerGraph:31,physicalCalls,completedArchivedRecords:reports.reduce((n,row)=>n+row.completedArchivedRecords,0),detachedPoseVelocityMomentumGO:numericalGO,sourceRepeatCompiledEqual:true,firstFailure:reports[0].failure,graphAudits:audits,controls:receipts,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false,worldVelocityMotorLawQualified:false,publicEngineGO:false,viewerGO:false,costGO:false,releaseGO:false};await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');await writeFile(resolve(out,'executed-bundle-hashes.json'),JSON.stringify(audits.map(({graph,sourcePath,bundleBytes,bundleSha256})=>({graph,path:sourcePath,bytes:bundleBytes,sha256:bundleSha256})),null,2)+'\n');console.log(JSON.stringify({detachedPoseVelocityMomentumGO:numericalGO,physicalCalls,sourceRepeatCompiledEqual:true}));
}catch(error){await writeFile(resolve(out,'execution-failure.json'),JSON.stringify({context,name:error?.name??null,code:error?.code??null,message:error?.message??String(error),physicalCalls,classification:'EXECUTION_FAILURE',physicalGONotEstablished:true},null,2)+'\n');throw error;}finally{oracle?.close();}
