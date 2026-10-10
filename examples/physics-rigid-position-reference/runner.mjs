import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bundle,here,root} from './bundle.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {runScene} from '../physics-rigid-contact-reference/producer.mjs';
import {controls} from './controls.mjs';
const out=resolve(process.argv[2]??'/tmp/physics-1191-canonical');
await mkdir(out,{recursive:true});
const geometry=observer(resolve(here,'../physics-rigid-contact-reference/geometry-reference.py'));
const controlGeometry=observer(resolve(here,'control-reference.py'));
const reports=[],audits=[],controlRows=[];
try {
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph==='source-repeat'?'source':graph,out);audits.push(built.audit);
    const original=await import(pathToFileURL(built.modulePath));
    for(const scene of ['ALIGNED','OFFSET','YAW']) {
      controlRows.push({graph,scene,...await controls(original,scene,controlGeometry)});
      const projection=[];
      const module={...original,createCandidateWorld(config) {
        const world=original.createCandidateWorld(config);
        projection.push(world.getProjectionStats());
        return {...world,step(dt,commands) {
          const state=world.step(dt,commands);const stats=world.getProjectionStats();
          assert.equal(stats.sweeps,32);assert.equal(stats.tests,1152);projection.push(stats);
          return state;
        }};
      }};
      const report=await runScene(module,geometry,graph,scene,out);
      assert.equal(projection.length,report.acceptedSnapshots);
      report.projectionStats=projection;reports.push(report);
      await writeFile(resolve(out,`${graph}-${scene}-report.json.gz`),gzipSync(JSON.stringify(report)));
      console.log(JSON.stringify({graph,scene,acceptedSnapshots:report.acceptedSnapshots,rawSha256:report.rawSha256,failure:report.failure}));
    }
  }
  for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const rows=reports.filter(r=>r.scene===scene);
    for(const other of rows.slice(1)) {
      assert.deepEqual(rows[0].states,other.states);
      assert.equal(rows[0].rawSha256,other.rawSha256);
      assert.deepEqual(rows[0].projectionStats,other.projectionStats);
      assert.deepEqual(rows[0].observations,other.observations);
      assert.deepEqual(rows[0].failure,other.failure);
    }
  }
  const baseNumericalGO=reports.every(r=>r.numericalGO);
  await writeFile(resolve(out,'summary.json'),JSON.stringify({base:'8df9b338c9f18e1bb295ef8bf80e5fa7dfcb787a',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,graphAudits:audits,controlRows,sourceCompiledDependencyParity:true,baseNumericalGO,fullModelGO:false,results:reports.map(({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})=>({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})),refinementExecuted:false,costMeasured:false,browserExecuted:false,referenceStderr:geometry.stderr(),controlReferenceStderr:controlGeometry.stderr()},null,2)+'\n');
  if(baseNumericalGO) console.log('Base GO only; conditional refinement/cost/browser remain required.');
} finally {geometry.close();controlGeometry.close();}
