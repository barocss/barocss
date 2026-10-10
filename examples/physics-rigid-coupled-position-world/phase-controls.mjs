import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareSolutions } from '../physics-rigid-coupled-position-reference/compare.mjs';
export async function phaseControls(m,linear,here) {
  const cases=JSON.parse(await readFile(resolve(here,'../physics-rigid-coupled-position-reference/linear-controls.json'))),receipts=[];
  for(const c of cases) {
    const problem=structuredClone(c.problem),before=structuredClone(problem),ref=await linear.ask(problem);
    if(c.expectedCode||c.expectedStatus==='INFEASIBLE') {
      const key=c.expectedCode??'INFEASIBLE';
      assert.throws(()=>m.solveCoupledProblem(problem),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message===m.COUPLED_ERRORS[key]);
      receipts.push({id:c.id,code:'NUMERIC_LIMIT',message:m.COUPLED_ERRORS[key],reference:ref});
    } else { const result=m.solveCoupledProblem(problem);assert.equal(compareSolutions(result,ref).agree,true,c.id);receipts.push({id:c.id,result,reference:ref}); }
    assert.deepEqual(problem,before);
  }
  const bodies=Array.from({length:9},(_,i)=>({id:'a'+i,inverseMass:i===0?0:1})),rows=Array.from({length:8},(_,i)=>({aId:'a'+i,bId:'a'+(i+1),normal:[0,1,0],depthM:.001}));
  const eight={bodies,rows},eightResult=m.solveCoupledProblem(eight),eightRef=await linear.ask(eight);assert.equal(compareSolutions(eightResult,eightRef).agree,true);assert.equal(eightResult.enumeratedMasks,256);receipts.push({id:'eight-row-nine-body-limit',result:eightResult,reference:eightRef});
  for(const [id,edit,key] of [
    ['unknown-id',p=>p.rows[0].bId='missing','INVALID_INPUT'],
    ['duplicate-id',p=>p.bodies[1].id=p.bodies[0].id,'INVALID_INPUT'],
    ['mass-upper-bound',p=>p.bodies[1].inverseMass=1000001,'INVALID_INPUT'],
    ['zero-normal',p=>p.rows[0].normal=[0,0,0],'INVALID_INPUT'],
    ['nan-normal',p=>p.rows[0].normal=[NaN,0,0],'INVALID_INPUT'],
    ['nine-rows',p=>p.rows.push(structuredClone(p.rows[0])),'PROFILE_LIMIT'],
  ]) { const p=structuredClone(eight);edit(p);assert.throws(()=>m.solveCoupledProblem(p),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message===m.COUPLED_ERRORS[key]);receipts.push({id,code:'NUMERIC_LIMIT',message:m.COUPLED_ERRORS[key]}); }
  const staticProblem={bodies:[{id:'a',inverseMass:0},{id:'b',inverseMass:0}],rows:[{aId:'a',bId:'b',normal:[1,0,0],depthM:1}]};
  assert.throws(()=>m.solveCoupledProblem(staticProblem),e=>e instanceof m.PhysicsError&&e.message===m.COUPLED_ERRORS.INFEASIBLE);receipts.push({id:'static-static-infeasible',reference:await linear.ask(staticProblem)});
  assert.throws(()=>m.solveCoupledProblem(eight,p=>{const r=m.solvePosition(p);r.translations[1].u[0]=NaN;return r;}),e=>e instanceof m.PhysicsError&&e.message===m.COUPLED_ERRORS.RESULT);
  assert.throws(()=>m.solveCoupledProblem(eight,p=>{const r=m.solvePosition(p);r.primalMarginsM[0]=null;return r;}),e=>e instanceof m.PhysicsError&&e.message===m.COUPLED_ERRORS.RESULT);
  for(const edit of [r=>r.singularMasks=Array(1),r=>r.gram[0][0]=null,r=>r.worldStepped=true])assert.throws(()=>m.solveCoupledProblem(eight,p=>{const r=m.solvePosition(p);edit(r);return r;}),e=>e instanceof m.PhysicsError&&e.message===m.COUPLED_ERRORS.RESULT);
  const marker=new Error('Unexpected private solver failure');assert.throws(()=>m.solveCoupledProblem(eight,()=>{throw marker;}),e=>e===marker);
  const first=m.solveCoupledProblem(eight);first.translations[1].u[0]=99;first.certificate.primalViolationM=99;assert.deepEqual(m.solveCoupledProblem(eight),eightResult);
  const raw=[{id:'a',kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[0,.25,0],velocityMps:[0,0,0],massKg:1,restitution:0},{id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0}];
  const working=raw.map(x=>m.parseBody(x)),saved=structuredClone(working),pairs=[[0,1]],attempts=[];
  const fresh=m.freshPositionProblem(working,pairs);assert.equal(fresh.tests,1);assert.equal(fresh.problem.rows.length,1);assert.ok(Math.abs(fresh.problem.rows[0].depthM)<=1e-12);
  const phase=m.runCoupledPositionPhase(working,pairs,{observeAttempt:a=>{attempts.push(structuredClone(a));a.workingBodies[0].positionM[0]=999;a.problem.bodies[0].inverseMass=999;a.solution.translations[0].u[0]=999;}});
  assert.equal(phase.stats.rows,1);assert.deepEqual(working.map(b=>({...b,positionM:saved.find(s=>s.id===b.id).positionM})),saved);
  const islandBodies=raw.map(x=>m.parseBody(x)),island=new m.FrozenContactIsland(islandBodies,pairs,new Map());
  assert.throws(()=>island.projectPositions(),e=>e instanceof m.PhysicsError&&e.message===m.GLOBAL_PHASE_MESSAGE);assert.throws(()=>island.result(),e=>e instanceof m.PhysicsError&&e.message===m.GLOBAL_PHASE_MESSAGE);island.solve();assert.throws(()=>island.solve(),e=>e instanceof m.PhysicsError&&e.message===m.GLOBAL_PHASE_MESSAGE);island.projectPositions();assert.throws(()=>island.projectPositions(),e=>e instanceof m.PhysicsError&&e.message===m.GLOBAL_PHASE_MESSAGE);
  const observerWorking=raw.map(x=>m.parseBody(x)),observerBefore=structuredClone(observerWorking);assert.throws(()=>m.runCoupledPositionPhase(observerWorking,pairs,{observeAttempt:()=>{throw marker;}}),e=>e===marker);assert.deepEqual(observerWorking,observerBefore);
  const primitiveWorking=raw.map(x=>m.parseBody(x)),primitiveSaved=structuredClone(primitiveWorking),primitiveAttempts=[];let primitiveThrown=false;try{m.runCoupledPositionPhase(primitiveWorking,pairs,{solve:()=>{throw null;},observeAttempt:a=>primitiveAttempts.push(a)});}catch(e){primitiveThrown=true;assert.strictEqual(e,null);}assert.equal(primitiveThrown,true);assert.deepEqual(primitiveWorking,primitiveSaved);assert.equal(primitiveAttempts[0].error.kind,'unexpected-error');
  return {receipts,nonfiniteResultRefused:true,unexpectedSolverPropagates:true,primitiveSolverErrorPropagates:true,copiedOutputs:true,allFreshTouchRows:true,phaseOrder:true,observerCopyIsolation:true,observerThrowsBeforeApply:true,attempts};
}
