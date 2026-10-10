import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { bundle,here,root,sha,verifyFreeze } from './bundle.mjs';
import { observer } from '../physics-rigid-contact-diagnostic/observer.mjs';
import { phaseControls } from './phase-controls.mjs';
import { controls } from './controls.mjs';
import { featureControls } from './feature-controls.mjs';
import { describeThrown } from './error-record.mjs';
import { runScene } from './consumer.mjs';
const out=resolve(process.argv[2]??resolve(here,'evidence/native'));await mkdir(out,{recursive:true});
let geometry,controlGeometry,linear;const reports=[],audits=[],controlRows=[];
const save=async(path,value)=>writeFile(resolve(out,path),gzipSync(JSON.stringify(value)));
try {
  const frozen=await verifyFreeze(),emitted=[];
  for(const path of execFileSync('rg',['--files','packages/barocss-physics/dist','packages/barocss-cad/dist'],{cwd:root,encoding:'utf8'}).trim().split('\n').sort())emitted.push({path,sha256:sha(await readFile(resolve(root,path)))});
  await writeFile(resolve(out,'emitted-freeze.json'),JSON.stringify({preTrial:true,node:process.version,emitted},null,2)+'\n');
  geometry=observer(resolve(here,'../physics-rigid-contact-reference/geometry-reference.py'));controlGeometry=observer(resolve(here,'../physics-rigid-position-reference/control-reference.py'));linear=observer(resolve(here,'../physics-rigid-coupled-position-reference/linear-reference.py'));
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.modulePath));
    const phase=await phaseControls(m,linear,here),feature=await featureControls(m,here);await save(graph+'-phase-controls.json.gz',phase);await save(graph+'-feature-controls.json.gz',feature);controlRows.push({graph,phase,feature});
    for(const scene of ['ALIGNED','OFFSET','YAW']) {
      const control=await controls(m,scene,controlGeometry);await save(graph+'-'+scene+'-controls.json.gz',control);controlRows.push({graph,scene,control});
      const report=await runScene(m,geometry,linear,graph,scene,out);reports.push(report);
      console.log(JSON.stringify({graph,scene,acceptedSnapshots:report.acceptedSnapshots,attemptedSteps:report.attemptedSteps,rawSha256:report.acceptedRawSha256,failure:report.failure,baseNumericalGO:report.baseNumericalGO}));
    }
  }
  for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const rows=reports.filter(r=>r.scene===scene);
    for(const r of rows.slice(1))for(const key of ['states','attempts','attemptOutcomes','observations','stats','linearReferences','failure','acceptedRawSha256','workingRawSha256','attemptedAcceptedRawSha256'])assert.deepEqual(r[key],rows[0][key],scene+' '+key);
  }
  const graphControls=controlRows.filter(r=>!r.scene);for(const row of graphControls.slice(1)){assert.deepEqual(row.phase,graphControls[0].phase);assert.deepEqual(row.feature,graphControls[0].feature);}
  for(const scene of ['ALIGNED','OFFSET','YAW']){const rows=controlRows.filter(r=>r.scene===scene);for(const row of rows.slice(1))assert.deepEqual(row.control,rows[0].control);}
  const baseNumericalGO=reports.every(r=>r.baseNumericalGO);
  await save('summary.json.gz',{base:frozen.base,measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,graphAudits:audits,sourceRepeatCompiledParity:true,baseNumericalGO,physicalDisposition:baseNumericalGO?'BASE_GO':'NUMERICAL_NO_GO',fullModelGO:false,refinementExecuted:false,costMeasured:false,browserExecuted:false,results:reports.map(({graph,scene,acceptedSnapshots,attemptedSteps,acceptedRawSha256,workingRawSha256,attemptedAcceptedRawSha256,failure,baseNumericalGO})=>({graph,scene,acceptedSnapshots,attemptedSteps,acceptedRawSha256,workingRawSha256,attemptedAcceptedRawSha256,failure,baseNumericalGO})),stderr:{geometry:geometry.stderr(),controls:controlGeometry.stderr(),linear:linear.stderr()}});
  if(baseNumericalGO)console.log('Base GO. Conditional refinement/cost/Chrome require their separate freeze before execution.');
} catch(error) {
  await save('execution-failure.json.gz',{classification:'EXECUTION_FAILURE',...describeThrown(error),completedReports:reports.length,audits});throw error;
} finally {geometry?.close();controlGeometry?.close();linear?.close();}
