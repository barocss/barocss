import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {here,root,bundle,validateSource} from './bundle.mjs';
import {loadArchive,selectRecords,rawBodies,digest} from './archive.mjs';
import {compareMeasurement,requireReference,originalResiduals} from './compare.mjs';
import {controls} from './controls.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
assert.equal(process.version,'v22.22.0');await validateSource();
const parentRoot=resolve(process.argv[2]??'/Users/user/.codex/worktrees/physics-multi-hinge/barocss'),out=resolve(process.argv[3]??'/tmp/physics-1294-canonical');await mkdir(out,{recursive:true});
const input=await loadArchive(parentRoot,root),records=selectRecords(input),oracle=observer(resolve(here,'reference.py')),reports=[],audits=[],controlRows=[];let context=null,projectionCalls=0;
try{
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));
  const control={graph,...await controls(m,oracle,input,records)};controlRows.push(control);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(control,null,2)+'\n');
  const observations=[],rawBefore=[],rawAfter=[];
  for(const record of records.filter(r=>r.archiveGraph===graph)){
   context={graph,step:record.step,group:record.group,origin:record.origin,rawSha256:record.rawSha256};const saved=structuredClone(record),beforeRaw=rawBodies(record.state.bodies),measurement=m.inspectPair(record.config,record.state);
   const beforeReference=requireReference(await oracle.ask({state:record.state,config:record.config,dt:1/120}),`${graph} step${record.step} group${record.group} ${record.origin} before`),beforeCompared=compareMeasurement(measurement,beforeReference);
   projectionCalls++;const output=m.projectOnce(record.config,record.state,1/120),projected=structuredClone(output);assert.deepEqual(record,saved,'single detached evaluation retains archived/caller input');assert.deepEqual(rawBodies(record.state.bodies),beforeRaw,'original archived raw13 bits unchanged');assert.deepEqual(rawBodies(projected.before),beforeRaw,'parse/joint metadata then exact raw13 restoration');
   let afterReference=null,afterCompared=null;
   if(projected.ok){const state={bodies:projected.after,joints:[projected.returned]};afterReference=requireReference(await oracle.ask({state,config:record.config,dt:1/120}),`${graph} step${record.step} group${record.group} ${record.origin} after`);afterCompared=compareMeasurement(projected.afterMeasurement,afterReference);
    output.after[0].positionM[0]=999;output.returned.angleRad=999;assert.deepEqual(record,saved,'mutating returned copies cannot change archived/caller input');assert.deepEqual(output.before,projected.before,'before/after Body copies cannot alias');
   }
   const afterRaw=rawBodies(projected.after),observation={...context,config:record.config,archivedState:record.state,originalMeasurement:measurement,originalResiduals:originalResiduals(measurement,record.state.joints[0].angleRad),beforeReference,beforeCompared,projection:projected,afterReference,afterCompared,
    beforeRawSha256:digest(beforeRaw),afterRawSha256:digest(afterRaw),beforeRawHex:beforeRaw.toString('hex'),afterRawHex:afterRaw.toString('hex'),hypotheticalPoseChanged:!beforeRaw.equals(afterRaw),diagnosticAgreement:beforeCompared.agree&&(!projected.ok||afterCompared.agree),projectionInvocations:1,worldCreated:false,worldStepped:false,historicalReplay:false,historicalCauseEstablished:false,physicalModelGO:false};
   observations.push(observation);rawBefore.push(beforeRaw);rawAfter.push(afterRaw);await writeFile(resolve(out,`${graph}-partial-report.json.gz`),gzipSync(JSON.stringify({graph,observations,projectionCallsCompleted:observations.length})));
  }
  assert.equal(observations.length,8);const report={graph,observations,diagnosticAgreement:observations.every(o=>o.diagnosticAgreement),projectionInvocations:8,physicalModelGO:false,worldCreated:false,worldStepped:false,historicalCauseEstablished:false};reports.push(report);
  await writeFile(resolve(out,`${graph}-before.f64le`),Buffer.concat(rawBefore));await writeFile(resolve(out,`${graph}-after.f64le`),Buffer.concat(rawAfter));await writeFile(resolve(out,`${graph}-report.json.gz`),gzipSync(JSON.stringify(report)));
  console.log(JSON.stringify({graph,records:8,diagnosticAgreement:report.diagnosticAgreement,results:observations.map(o=>({step:o.step,group:o.group,origin:o.origin,archivedResidual:o.originalResiduals.reportedAngleDifferenceRad,returnedAngle:o.projection.returned?.angleRad??null,afterResidual:o.afterReference?.raw.reportedAngleDifferenceRad??null}))}));
 }
 for(const graph of ['source-repeat','compiled-dependencies']){const a=reports[0].observations,b=reports.find(r=>r.graph===graph).observations;for(let i=0;i<a.length;i++){const {graph:ag,...first}=a[i],{graph:bg,...second}=b[i];assert.deepEqual(second,first,'exact original-helper source-repeat/compiled diagnostic raw/output/reference/error parity');}}
 const {graph:cg,...firstControl}=controlRows[0];for(const control of controlRows.slice(1)){const {graph,...next}=control;assert.deepEqual(next,firstControl,'source-repeat/compiled control parity');}
 assert.equal(projectionCalls,24);assert.equal(reports.reduce((n,r)=>n+r.observations.length,0),24);
 const summary={base:'6bd3376d6943a8d84b83ca62b0031a9ec8927bea',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,parentNative:'0de27c51574e2da6b09966c7ef0c28435d9c9592',validatedSourcePins:Object.keys(input.pins).length,validatedArtifactHashes:26,validatedArchiveFiles:input.files.size,selectedRecords:24,projectionCalls,worldCreated:false,worldStepped:false,motorDriven:false,physicalModelGO:false,historicalCauseEstablished:false,sourceRepeatCompiledEqual:true,diagnosticAgreement:reports.every(r=>r.diagnosticAgreement),graphAudits:audits,controlRows,referenceStderr:oracle.stderr(),results:reports.map(r=>({graph:r.graph,diagnosticAgreement:r.diagnosticAgreement,records:r.observations.map(o=>({step:o.step,group:o.group,origin:o.origin,archivedResidual:o.originalResiduals,returned:o.projection.returned,afterRawResidual:o.afterReference?.raw.reportedAngleDifferenceRad??null,afterNormalizedResidual:o.afterReference?.normalized.reportedAngleDifferenceRad??null,detachedOriginalNumericLimit:o.projection.ok?null:{code:o.projection.code,message:o.projection.message}}))}))};
 await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({diagnosticAgreement:summary.diagnosticAgreement,projectionCalls,worldStepped:false}));
}catch(error){await writeFile(resolve(out,'execution-failure.json'),JSON.stringify({context,name:error.name,code:error.code??null,message:error.message,reference:error.reference??null,projectionCallsCompleted:projectionCalls,classification:'execution failure; not physical NO-GO'},null,2)+'\n');throw error;}finally{oracle.close();}
