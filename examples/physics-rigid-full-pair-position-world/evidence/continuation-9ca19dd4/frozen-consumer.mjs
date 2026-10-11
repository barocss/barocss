import assert from 'node:assert/strict';
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
import {rawBodies,rawHex,describeThrown,capture,recorder} from './archive.mjs';
function resolved(reply,label){if(reply.resolved!==true||reply.executionFailure!==false)throw new Error('Independent '+label+' unresolved: '+JSON.stringify(reply));}
export async function runScene(m,reference,geometry,graph,scene,out,budget,maxStep=1200,recorderFactory=recorder){
 const config=fixture(scene),stages=[],attempts=[],world=m.createCandidateWorld(config,{observeAttempt:a=>attempts.push(a),observeStepAttempt:a=>stages.push(a)}),initial=world.getState(),writer=await recorderFactory(out,graph+'-'+scene,budget);
 let baseline=null,failure=null,executionError,hasExecutionError=false,attemptedSteps=0,acceptedSteps=0,solverCalls=0;
 try{
  const initialReference=await geometry.ask({state:initial,initial,timeSeconds:0,referenceAt8s:null});if(initialReference.ok!==true||initialReference.metrics?.referencePrecisionResolved!==true)throw new Error('Independent initial geometry unresolved');if(initialReference.violations.length)failure={kind:'independent-quality',step:0,reference:initialReference};
  await writer.write({kind:'initial',scene,state:initial,reference:initialReference},[rawBodies(initial.bodies)]);
  for(let step=1;!failure&&step<=maxStep;step++){
   stages.length=0;attempts.length=0;const before=capture(world);let state,producerError,producerRefused=false;attemptedSteps++;
   try{state=world.step(1/120);}catch(e){if(!(e instanceof m.PhysicsError))throw e;producerRefused=true;producerError=describeThrown(e);assert.deepEqual(capture(world),before,'complete previous accepted transaction retained');}
   const attempt=attempts.at(-1)??null;let reply=null,referenceFailure=null;
   if(attempt?.result!==null&&attempt?.result!==undefined){
    solverCalls++;
    reply=await reference.ask({op:'world',scene,stepIndex:step,config,preBodies:attempt.preBodies,preRawHex:rawHex(attempt.preBodies),problem:attempt.problem,rowSelections:attempt.rowSources,result:attempt.result,hypBodies:attempt.hypotheticalBodies,hypRawHex:attempt.hypotheticalBodies?rawHex(attempt.hypotheticalBodies):null});resolved(reply,'full-pair world');
    if(reply.violations.length)referenceFailure={kind:'independent-full-pair',step,reply};
    if(!producerRefused&&(!Number.isFinite(reply.metrics.maxHypDepthRawM)||!Number.isFinite(reply.metrics.maxHypDepthNormalizedM)||reply.metrics.maxHypDepthRawM>1e-12||reply.metrics.maxHypDepthNormalizedM>1e-12))referenceFailure??={kind:'independent-final-closure',step,reply};
   }
   const finalStage=stages.findLast(x=>x.stage==='closure-ready');let ledgerReference=null;
   if(finalStage){const l=finalStage.ledger;ledgerReference=await reference.ask({op:'step-ledger',scene,stepIndex:step,outcome:producerRefused?'attempted-final':'accepted',ledger:l,raw:{before:rawHex(l.beforeBodies),free:rawHex(l.freeBodies),velocity:rawHex(l.velocityBodies),final:rawHex(l.finalBodies)}});resolved(ledgerReference,'ledger');if(ledgerReference.violations.length)referenceFailure??={kind:'independent-phase-accounting',step,reply:ledgerReference};}
   let quality=null;
   if(!producerRefused){
    acceptedSteps++;assert.equal(state.stepIndex,step);assert.equal(state.timeSeconds,step*(1/120));if(step===960)baseline=state;
    quality=await geometry.ask({state,initial,timeSeconds:state.timeSeconds,referenceAt8s:baseline});if(quality.ok!==true||quality.metrics?.referencePrecisionResolved!==true)throw new Error('Independent geometry unresolved');if(quality.violations.length)referenceFailure??={kind:'independent-quality',step,reply:quality};
    const saved=capture(world),g=saved.global,s=saved.position;assert.equal(g.assemblyTests,36);assert.equal(g.globalSweeps,64);assert.equal(g.pointUpdates,g.points*64);assert.equal(g.positionSweeps,1);assert.equal(g.positionTests,36);assert.equal(g.positionHits,s.hits);assert.equal(s.tests,36);assert.equal(s.rows,36);assert.equal(s.signedPreQueries,36);assert.equal(s.solverCalls,1);assert.equal(s.postPairTests,36);assert.equal(s.workingApplicationCount,1);assert.equal(state.pairStats.eligiblePairs,36);assert.equal(state.pairStats.candidatePairs,36);assert.deepEqual(saved.ledger,finalStage.ledger);
   }
   failure=referenceFailure??(producerRefused?{kind:'producer-refusal',attemptedStep:step,acceptedStep:before.state.stepIndex,...producerError,priorAcceptedRetained:true}:null);
   const after=capture(world),raw=[rawBodies(before.state.bodies)];for(const stage of stages)for(const key of ['freeBodies','velocityBodies','finalBodies'])if(stage.ledger[key])raw.push(rawBodies(stage.ledger[key]));if(attempt){if(attempt.preBodies.length)raw.push(rawBodies(attempt.preBodies));if(attempt.hypotheticalBodies)raw.push(rawBodies(attempt.hypotheticalBodies));}raw.push(rawBodies(after.state.bodies));
   await writer.write({kind:'step',scene,step,before,after,stages,attempt,reference:reply,ledgerReference,quality,producerRefused,producerError:producerError??null,failure},raw);
  }
 }catch(e){hasExecutionError=true;executionError=e;failure={kind:'execution-failure',...describeThrown(e)};await writer.emergency({kind:'execution-failure',scene,attemptedSteps,accepted:capture(world),acceptedRawHex:rawHex(world.getState().bodies),stages,attempts,failure});}finally{world.dispose();}
 const evidence=await writer.finish(),report={graph,scene,attemptedSteps,acceptedSteps,solverCalls,failure,baseNumericalGO:failure===null&&acceptedSteps===1200,evidence,viewerExecuted:false};
 if(hasExecutionError){const error=new Error('Full-pair world consumer execution failed');error.cause=executionError;error.partialReport=report;throw error;}return report;
}
