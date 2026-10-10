import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
import { compareSolutions } from '../physics-rigid-coupled-position-reference/compare.mjs';
import { describeThrown } from './error-record.mjs';
import { poseBytes,rawLayout } from './pose-archive.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const capture=w=>({state:w.getState(),global:w.getGlobalContactStats(),warm:w.getWarmCacheStats(),coupled:w.getCoupledPositionStats(),cache:w.getWarmCacheSnapshot(),attempt:w.getCoupledPositionAttempt()});
export async function runScene(m,geometry,linear,graph,scene,out) {
  const config=fixture(scene),attempts=[],workingRaw=[],states=[],acceptedRaw=[],observations=[],stats=[],linearReferences=[],attemptedAcceptedRaw=[],attemptOutcomes=[];let baseline=null,failure=null,executionError,hasExecutionError=false;
  const world=m.createCandidateWorld(config,{observeAttempt:a=>{attempts.push(a);workingRaw.push(poseBytes(a.workingBodies));}}),initial=world.getState(),ids=initial.bodies.map(b=>b.id);
  try {
    for(let step=0;step<=1200;step++) {
      let state;
      if(step===0) state=initial;
      else {
        const before=capture(world),attemptBefore=attempts.length;
        try { state=world.step(1/120); }
        catch(e) {
          if(!(e instanceof m.PhysicsError)) throw e;
          assert.deepEqual(capture(world),before,'typed refusal retains accepted state/cache/counters/log/cursor');
          attemptedAcceptedRaw.push(poseBytes(before.state.bodies,ids));attemptOutcomes.push({attemptedStep:step,acceptedStep:before.state.stepIndex,outcome:'typed-refusal',phaseReached:attempts.length>attemptBefore});
          failure={kind:'producer-refusal',attemptedStep:step,acceptedStep:before.state.stepIndex,code:e.code,message:e.message,priorAcceptedRetained:true};
          if(attempts.length>attemptBefore) {
            const attempt=attempts.at(-1),reference=await linear.ask(attempt.problem);linearReferences.push({attemptedStep:step,reference,candidateStatus:attempt.error});
          }
          break;
        }
        assert.equal(attempts.length,attemptBefore+1);
        const attempt=attempts.at(-1),reference=await linear.ask(attempt.problem),comparison=compareSolutions(attempt.solution,reference);
        linearReferences.push({attemptedStep:step,reference,comparison});
        if(!comparison.agree)failure={kind:'independent-coupled-certificate',step,comparison,reference};
        attemptedAcceptedRaw.push(poseBytes(state.bodies,ids));attemptOutcomes.push({attemptedStep:step,acceptedStep:state.stepIndex,outcome:'accepted',phaseReached:true});
        const g=world.getGlobalContactStats(),c=world.getCoupledPositionStats(),w=world.getWarmCacheStats();
        assert.equal(g.assemblyTests,36);assert.equal(g.globalSweeps,64);assert.equal(g.pointUpdates,g.points*64);assert.equal(g.patches,g.facePatches+g.edgePatches);assert.ok(w.coldPoints>=g.edgePatches);assert.equal(w.testedPatches,g.patches);assert.equal(w.reusedPoints+w.coldPoints,g.points);
        assert.equal(c.tests,36);assert.equal(c.hits,c.rows);assert.ok(c.rows<=8);assert.equal(c.enumeratedMasks,2**c.rows);assert.equal(g.positionSweeps,1);assert.equal(g.positionTests,36);assert.equal(g.positionHits,c.rows);assert.equal(state.pairStats.eligiblePairs,36);assert.equal(state.pairStats.candidatePairs,36);
        const acceptedAttempt=world.getCoupledPositionAttempt();assert.deepEqual(acceptedAttempt,attempt);stats.push({global:g,warm:w,coupled:c});
      }
      assert.equal(state.stepIndex,step);assert.equal(state.timeSeconds,step*(1/120));
      states.push(state);acceptedRaw.push(poseBytes(state.bodies,ids));
      if(failure)break;
      if(step===960)baseline=state;
      const reference=await geometry.ask({state,initial,timeSeconds:state.timeSeconds,referenceAt8s:baseline});observations.push(reference);
      if(reference.ok!==true||reference.metrics===null||reference.metrics?.referencePrecisionResolved!==true)throw new Error('Independent geometry reference is unresolved: '+JSON.stringify(reference));
      if(reference.violations.length) {failure={kind:'independent-quality',step,timeSeconds:state.timeSeconds,reference};break;}
    }
  } catch(error) { executionError=error;hasExecutionError=true;failure={kind:'execution-failure',...describeThrown(error)}; } finally {world.dispose();}
  const acceptedBytes=Buffer.concat(acceptedRaw),workingBytes=Buffer.concat(workingRaw),attemptedAcceptedBytes=Buffer.concat(attemptedAcceptedRaw);
  const report={graph,scene,config,ids,rawLayout,states,attempts,attemptOutcomes,observations,stats,linearReferences,attemptedAcceptedRawBytes:attemptedAcceptedBytes.length,attemptedAcceptedRawSha256:digest(attemptedAcceptedBytes),acceptedSnapshots:states.length,attemptedSteps:attempts.length,acceptedRawBytes:acceptedBytes.length,acceptedRawSha256:digest(acceptedBytes),workingRawBytes:workingBytes.length,workingRawSha256:digest(workingBytes),failure,baseNumericalGO:failure===null&&states.length===1201,refinementExecuted:false,costMeasured:false,browserExecuted:false};
  await writeFile(out+'/'+graph+'-'+scene+'-attempted-accepted.f64le.gz',gzipSync(attemptedAcceptedBytes));
  await writeFile(out+'/'+graph+'-'+scene+'-accepted.f64le.gz',gzipSync(acceptedBytes));await writeFile(out+'/'+graph+'-'+scene+'-working.f64le.gz',gzipSync(workingBytes));await writeFile(out+'/'+graph+'-'+scene+'-report.json.gz',gzipSync(JSON.stringify(report)));
  if(hasExecutionError)throw executionError;
  return report;
}
