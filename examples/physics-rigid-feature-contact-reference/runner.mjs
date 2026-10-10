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
import {featureControls} from './feature-controls.mjs';
const out=resolve(process.argv[2]??'/tmp/physics-1234-canonical');
await mkdir(out,{recursive:true});
const geometry=observer(resolve(here,'../physics-rigid-contact-reference/geometry-reference.py'));
const controlGeometry=observer(resolve(here,'../physics-rigid-position-reference/control-reference.py'));
const reports=[],audits=[],controlRows=[];
try {
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph,out);audits.push(built.audit);
    const original=await import(pathToFileURL(built.modulePath));const featureControlRow={graph,...await featureControls(original,here)};await writeFile(resolve(out,`${graph}-feature-controls.json`),JSON.stringify(featureControlRow,null,2)+'\n');
    for(const scene of ['ALIGNED','OFFSET','YAW']) {
      const controlRow={graph,scene,...await controls(original,scene,controlGeometry)};controlRows.push(controlRow);await writeFile(resolve(out,`${graph}-${scene}-controls.json`),JSON.stringify(controlRow,null,2)+'\n');
      const projection=[], warm=[], global=[];
      const module={...original,createCandidateWorld(config) {
        const world=original.createCandidateWorld(config);
        projection.push(world.getProjectionStats()); warm.push(world.getWarmCacheStats()); global.push(world.getGlobalContactStats());
        return {...world,step(dt,commands) {
          const before=[world.getState(),world.getProjectionStats(),world.getWarmCacheStats(),world.getGlobalContactStats()];
          let state;
          try {state=world.step(dt,commands);} catch(error) {
            if(error instanceof original.PhysicsError) assert.deepEqual([world.getState(),world.getProjectionStats(),world.getWarmCacheStats(),world.getGlobalContactStats()],before,'typed campaign refusal must retain accepted transaction');
            throw error;
          }
          const g=world.getGlobalContactStats();
          for(const value of Object.values(g)) assert.ok(Number.isInteger(value)&&value>=0);
          assert.equal(g.assemblyTests,36); assert.equal(g.globalSweeps,64);
          assert.equal(g.pointUpdates,g.points*64);assert.equal(g.patches,g.facePatches+g.edgePatches);assert.ok(g.points<=4*g.facePatches+g.edgePatches); assert.equal(g.positionSweeps,8); assert.equal(g.positionTests,288);
          assert.equal(state.pairStats.eligiblePairs,36); assert.equal(state.pairStats.candidatePairs,36);
          const w=world.getWarmCacheStats(); assert.equal(w.testedPatches,g.patches); assert.equal(w.reusedPoints+w.coldPoints,g.points);assert.ok(w.coldPoints>=g.edgePatches);
          global.push(g);
          const stats=world.getProjectionStats();
          assert.equal(stats.sweeps,32);assert.equal(stats.tests,1152);projection.push(stats);warm.push(world.getWarmCacheStats());
          return state;
        }};
      }};
      const report=await runScene(module,geometry,graph,scene,out);
      assert.equal(projection.length,report.acceptedSnapshots);assert.equal(warm.length,report.acceptedSnapshots);assert.equal(global.length,report.acceptedSnapshots);
      report.projectionStats=projection;report.warmCacheStats=warm;report.globalContactStats=global;reports.push(report);
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
      assert.deepEqual(rows[0].warmCacheStats,other.warmCacheStats);
      assert.deepEqual(rows[0].globalContactStats,other.globalContactStats);
      assert.deepEqual(rows[0].observations,other.observations);
      assert.deepEqual(rows[0].failure,other.failure);
    }
  }
  const baseNumericalGO=reports.every(r=>r.numericalGO);
  await writeFile(resolve(out,'summary.json'),JSON.stringify({base:'4885bd13c1117afa4cc209c164293cdd5ec1d67b',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,graphAudits:audits,controlRows,sourceCompiledDependencyParity:true,baseNumericalGO,fullModelGO:false,results:reports.map(({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})=>({graph,scene,acceptedSnapshots,rawBytes,rawSha256,failure,numericalGO})),refinementExecuted:false,costMeasured:false,browserExecuted:false,referenceStderr:geometry.stderr(),controlReferenceStderr:controlGeometry.stderr()},null,2)+'\n');
  if(baseNumericalGO) console.log('Base GO only; conditional refinement/cost/browser remain required.');
} finally {geometry.close();controlGeometry.close();}
