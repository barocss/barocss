import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bundle,here,root} from './bundle.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {fields,sha} from '../physics-rigid-contact-diagnostic/raw.mjs';
import {runScene} from '../physics-rigid-contact-reference/producer.mjs';
import {controls} from '../physics-rigid-position-reference/controls.mjs';
const out=resolve(process.argv[2]??'/tmp/physics-1197-canonical');
await mkdir(out,{recursive:true});
const geometry=observer(resolve(here,'../physics-rigid-contact-reference/geometry-reference.py'));
const controlGeometry=observer(resolve(here,'../physics-rigid-position-reference/control-reference.py'));
const baselineDirectory=resolve(here,'../physics-rigid-position-reference/evidence/native-26a4966a');
const reports=[],audits=[],controlRows=[],results=[];
try {
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph==='source-repeat'?'source':graph,out);audits.push(built.audit);
    const original=await import(pathToFileURL(built.modulePath));
    controlRows.push({graph,...await controls(original,'OFFSET',controlGeometry)});
    const recorder=new original.DiagnosticRecorder();
    const projection=[];
    const module={...original,createCandidateWorld(config) {
      const world=original.createDiagnosticWorld(config,recorder);
      projection.push(world.getProjectionStats());
      return {...world,step(dt,commands) {
        const state=world.step(dt,commands);projection.push(world.getProjectionStats());return state;
      }};
    }};
    const report=await runScene(module,geometry,graph,'OFFSET',out);
    const traces=recorder.snapshot();assert.equal(traces.length,3489);
    const copy=recorder.snapshot();copy[0].state.bodies[0].positionM[0]=999;
    assert.deepEqual(recorder.snapshot(),traces);
    const baseline=JSON.parse(gunzipSync(await readFile(resolve(baselineDirectory,`${graph}-OFFSET-report.json.gz`))));
    const raw=fields(report.states,report.ids);
    assert.deepEqual(raw,gunzipSync(await readFile(resolve(baselineDirectory,`${graph}-OFFSET-fields.f64le.gz`))));
    assert.deepEqual(JSON.parse(JSON.stringify(report.states)),baseline.states);
    assert.deepEqual(report.observations,baseline.observations);
    assert.deepEqual(projection,baseline.projectionStats);
    assert.deepEqual(report.failure,baseline.failure);
    assert.equal(report.acceptedSnapshots,496);assert.equal(report.failure.step,495);
    const traceRaw=fields(traces.map(f=>f.state),report.ids);
    const full={...report,projectionStats:projection,traces,originalParity:true,traceCopyIsolation:true,traceRawSha256:sha(traceRaw)};
    reports.push(full);
    await writeFile(resolve(out,`${graph}-OFFSET-accepted.f64le.gz`),gzipSync(raw));
    await writeFile(resolve(out,`${graph}-OFFSET-trace.f64le.gz`),gzipSync(traceRaw));
    await writeFile(resolve(out,`${graph}-OFFSET-report.json.gz`),gzipSync(JSON.stringify(full)));
    results.push({graph,acceptedSnapshots:496,traceFrames:3489,acceptedRawSha256:sha(raw),traceRawSha256:sha(traceRaw),firstFailure:report.failure,originalParity:true});
    console.log(JSON.stringify({graph,acceptedSnapshots:496,traceFrames:3489,rawSha256:sha(raw),traceRawSha256:sha(traceRaw)}));
  }
  for(const other of reports.slice(1)) {
    assert.equal(reports[0].traceRawSha256,other.traceRawSha256);
    assert.deepEqual(reports[0].traces,other.traces);
  }
  await writeFile(resolve(out,'summary.json'),JSON.stringify({base:'63aeed09c67ffdbc481756bd727d687007993c2a',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,audits,controlRows,results,acceptedRawParity:true,traceGraphParity:true,physicalModelGO:false,refinementExecuted:false,costMeasured:false,browserExecuted:false,referenceStderr:geometry.stderr(),controlReferenceStderr:controlGeometry.stderr()},null,2)+'\n');
} finally {geometry.close();controlGeometry.close();}
