import assert from 'node:assert/strict';
import {kernelCases,simple,eligiblePairs} from './literal-cases.mjs';
import {rawHex,describeThrown} from './archive.mjs';
const copied=structuredClone;
function requireReference(reply,id){assert.equal(reply.resolved,true,id);assert.equal(reply.executionFailure,false,id);assert.deepEqual(reply.violations,[],id);}
function expected(m,key){return e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message===m.FULL_PAIR_ERRORS[key];}
function kernelError(m,code,key){return e=>e instanceof m.FullPairPositionReferenceError&&e.code===code&&e.message===m.MESSAGES[key];}
function parsedBox(m,id,kind,positionM,halfExtentsM=[.25,.25,.25]){return m.parseBody({id,kind,shape:{kind:'box',halfExtentsM},positionM,...(kind==='dynamic'?{massKg:1,velocityMps:[0,0,0]}:{}),restitution:0});}
export async function policyControls(m,here,reference){
 const receipts=[];let solverCalls=0,phaseCalls=0,validationCalls=0,applyCalls=0,geometryBuilderCalls=0;
 for(const item of kernelCases()){
  const problem=copied(item.problem),before=copied(problem);solverCalls++;
  const result=m.solveFullPairPosition(problem);assert.equal(result.status,item.status,item.id);assert.deepEqual(problem,before);
  validationCalls++;const detached=m.validateFullPairResult(problem,result);assert.deepEqual(detached,result);
  const reply=await reference.ask({op:'kernel',scope:'full-pair',problem,result});requireReference(reply,item.id);
  if(item.status==='NUMERIC_UNSAFE'){assert.equal(result.reason,'near-dependent-independent');assert.equal(reply.referenceStatus,'SOLVED');}
  if(item.status==='INFEASIBLE')assert.equal(reply.referenceStatus,'INFEASIBLE');
  if(result.translations){detached.translations[0].u[0]=999;assert.notDeepEqual(detached,result);}
  receipts.push({id:item.id,problem,result,reference:reply,inputRetained:true});
 }
 const workProblem=simple(),limits={...m.DEFAULT_LIMITS,iterations:0};solverCalls++;
 const work=m.runFullPairCore(workProblem,limits);assert.equal(work.status,'WORK_LIMIT');assert.equal(work.reason,'budget:iterations');assert.equal(work.counters.iterations,0);
 const workRef=await reference.ask({op:'kernel',scope:'full-pair',problem:workProblem,result:work});requireReference(workRef,'L15-core-budget0');
 receipts.push({id:'L15-core-budget0',problem:workProblem,limits,result:work,reference:workRef,guardOnly:true});
 for(const [id,edit,code,key] of [
  ['37-rows',q=>q.rows=Array.from({length:37},()=>copied(q.rows[0])),'PROFILE_LIMIT','limit'],
  ['10-bodies',q=>q.bodies=Array.from({length:10},(_,i)=>({id:'b'+i,inverseMass:1})),'PROFILE_LIMIT','limit'],
  ['empty',q=>q.bodies=[],'INVALID_INPUT','empty'],['normal',q=>q.rows[0].normal=[2,0,0],'INVALID_INPUT','normal'],
  ['sparse',q=>delete q.rows[0],'INVALID_INPUT','input'],['extra',q=>q.rows[0].extra=0,'INVALID_INPUT','input'],
  ['bad-endpoint',q=>q.rows[0].aId='missing','INVALID_INPUT','endpoints'],['duplicate-id',q=>q.bodies[1].id='a','INVALID_INPUT','ids'],
  ...[-1,5e-7,2000000,Number.MIN_VALUE].map(v=>['mass-'+v,q=>q.bodies[0].inverseMass=v,'INVALID_INPUT','mass']),
  ...[-10.0001,10.0001].map(v=>['bound-'+v,q=>q.rows[0].boundM=v,'INVALID_INPUT','bound'])
 ]){const q=simple();edit(q);validationCalls++;assert.throws(()=>m.validateFullPairProblem(q),kernelError(m,code,key));receipts.push({id,code,message:m.MESSAGES[key],admissionOnly:true});}
 for(const field of ['inverseMass','normal','boundM']){
  const q=simple();let reads=0;const owner=field==='inverseMass'?q.bodies[0]:q.rows[0];Object.defineProperty(owner,field,{enumerable:true,get(){reads++;throw new Error('must not invoke');}});
  validationCalls++;assert.throws(()=>m.validateFullPairProblem(q),kernelError(m,'INVALID_INPUT','input'));assert.equal(reads,0);receipts.push({id:'accessor-'+field,reads});
 }
 const marker=new Error('1399-reflection-marker'),proxy=new Proxy(simple(),{ownKeys(){throw marker;}});validationCalls++;assert.throws(()=>m.validateFullPairProblem(proxy),e=>e===marker);receipts.push({id:'unknown-proxy',identity:true});
 const q=simple();solverCalls++;const genuine=m.solveFullPairPosition(q);
 for(const [id,edit] of [['translations-null',r=>r.translations=null],['u-null',r=>r.translations[0].u[0]=null],['lambda-hole',r=>delete r.lambdaKgM[0]],['margin-null',r=>r.primalMarginsM[0]=null],['objective-nonfinite',r=>r.objectiveKgM2=NaN],['certificate-null',r=>r.certificate=null],['margin-missing',r=>r.primalMarginsM.pop()],['wrong-id',r=>r.translations[0].id='wrong'],['false-infeasible',r=>{r.ok=false;r.status='INFEASIBLE';r.translations=r.lambdaKgM=r.primalMarginsM=r.objectiveKgM2=r.certificate=null;r.infeasibilityCertificate=null;}]] ){
  const r=copied(genuine);edit(r);validationCalls++;assert.throws(()=>m.validateFullPairResult(q,r),kernelError(m,'NUMERIC_LIMIT','result'));receipts.push({id,malformedResultOnly:true});
 }
 for(const n of [1,2,9]){
  const bodies=Array.from({length:n},(_,i)=>parsedBox(m,'b'+i,i===n-1?'static':'dynamic',[i===n-1?-0:i,0,0]));
  const problem={bodies:bodies.map(b=>({id:b.id,inverseMass:b.inverseMass})),rows:[]};solverCalls++;const r=m.solveFullPairPosition(problem),before=copied(bodies);applyCalls++;const out=m.applyFullPairTranslationsOnce(bodies,problem,r);
  assert.deepEqual(bodies,before);assert.equal(out.applications,1);assert.ok(Object.is(out.bodies.at(-1).positionM[0],-0));out.bodies.at(-1).positionM[0]=999;assert.deepEqual(bodies,before);receipts.push({id:'L13-static-copy-'+n,staticNegativeZeroHeld:true});
 }
 const b36=Array.from({length:9},(_,i)=>parsedBox(m,'b'+i,i===8?'static':'dynamic',[0,0,0])),before36=copied(b36),pairs36=eligiblePairs(b36);phaseCalls++;
 const full=m.runFullPairPositionPhase(b36,pairs36,{solve:q=>{solverCalls++;return m.solveFullPairPosition(q);}});
 assert.equal(full.stats.rows,36);assert.equal(full.stats.solverCalls,1);assert.equal(full.stats.workingApplicationCount,1);assert.equal(full.attempt.result.status,'SOLVED');
 const fullRef=await reference.ask({op:'world',scene:'PURE-36-GUARD',stepIndex:0,config:{},preBodies:full.attempt.preBodies,preRawHex:rawHex(full.attempt.preBodies),problem:full.attempt.problem,rowSelections:full.attempt.rowSources,result:full.attempt.result,hypBodies:full.attempt.hypotheticalBodies,hypRawHex:rawHex(full.attempt.hypotheticalBodies)});requireReference(fullRef,'pure36');
 assert.equal(fullRef.metrics.heldBitsMatch,true);assert.equal(fullRef.metrics.roundedFinalMatches,true);receipts.push({id:'genuine-full36-phase',stats:full.stats,attempt:full.attempt,reference:fullRef,notWorld:true});
 const far=[parsedBox(m,'a','dynamic',[0,0,0],[1,1,1]),parsedBox(m,'b','static',[13,0,0],[1,1,1]),parsedBox(m,'c','static',[-13,0,0],[1,1,1])];let farSolve=0,farAttempt;const saved=copied(far);phaseCalls++;
 assert.throws(()=>m.runFullPairPositionPhase(far,eligiblePairs(far),{solve:q=>{farSolve++;return m.solveFullPairPosition(q);},observeAttempt:x=>{farAttempt=x;}}),expected(m,'RANGE'));assert.equal(farSolve,0);assert.deepEqual(far,saved);assert.equal(farAttempt.pairObservations.length,2);receipts.push({id:'L12-far-full-scan',solverCalls:farSolve,attempt:farAttempt});
 for(const distance of [2,2.0000000000001]){
  const bodies=[parsedBox(m,'a','dynamic',[0,0,0],[1,1,1]),parsedBox(m,'b','static',[distance,0,0],[1,1,1])],pairs=eligiblePairs(bodies),build=m.buildFullPairProblem(bodies,pairs);geometryBuilderCalls++;
  assert.equal(build.problem.rows.length,1);assert.ok(Object.is(build.problem.rows[0].boundM,build.rowSources[0].selection.boundM));receipts.push({id:'L11-fresh-unclamped-'+distance,build});
 }
 return {receipts,pureSolverCalls:solverCalls,purePhaseCalls:phaseCalls,directApplyCalls:applyCalls,directGeometryBuilderCalls:geometryBuilderCalls,directGuardValidationCalls:validationCalls,validationAccounting:{directGuardCountOnly:true,includesPhaseAndCoreInternalInvocations:false,coreWorkCountersExcludeSeparateValidators:true},longWorldCalls:0,allInputsAuthoredBeforeExecution:true};
}
