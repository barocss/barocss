import assert from 'node:assert/strict';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
import { fixtures } from '../physics-rigid-engine-reference/fixtures.mjs';
import { controls as originalControls } from '../physics-rigid-contact-reference/controls.mjs';
const snapshot=w=>[w.getState(),w.getWarmCacheStats(),w.getGlobalContactStats(),w.getCoupledPositionStats(),w.getWarmCacheSnapshot(),w.getCoupledPositionAttempt()];
function copyChecks(w) { const expected=snapshot(w),copy=snapshot(w);copy[0].bodies[0].positionM[0]=99;copy[1].coldPoints=99;copy[2].patches=99;copy[3].rows=99;if(copy[4][0])copy[4][0][1].normalNs=99;if(copy[5]){copy[5].workingBodies[0].positionM[0]=99;copy[5].problem.bodies[0].inverseMass=99;}assert.deepEqual(snapshot(w),expected);return expected; }
export async function controls(m,scene,reference) {
  const original=originalControls(m,scene),rejected=[];
  for(const [name,edit] of Object.entries({basic:c=>delete c.contactMode,joints:c=>c.joints=[],broadPhase:c=>c.broadPhase='aabb',large:c=>{c.sceneMode='large-v1';c.broadPhase='aabb';},sphere:c=>c.bodies[0].shape={kind:'sphere',radiusM:.25},kinematic:c=>{const b=c.bodies[0];b.kind='kinematic';delete b.massKg;delete b.velocityMps;},sensor:c=>c.bodies.at(-1).sensor=true,ccd:c=>c.bodies[0].ccd=true,filter:c=>c.bodies[0].collisionFilter={categoryBits:1,maskBits:1},sleeping:c=>c.bodies[0].sleeping=true,restitution:c=>c.bodies[0].restitution=.5})) {const c=fixture(scene);edit(c);assert.throws(()=>m.createCandidateWorld(c),e=>e instanceof m.PhysicsError&&e.code==='INVALID_CONFIG');rejected.push(name);}
  const input=fixtures().find(f=>f.id==='STACK2_CONTROL').input,w=m.createCandidateWorld(input);
  assert.deepEqual(w.getCoupledPositionStats(),m.zeroCoupledStats());assert.equal('getProjectionStats' in w,false);
  const initial=w.getState(),state=w.step(1/120),saved=copyChecks(w),g=w.getGlobalContactStats(),c=w.getCoupledPositionStats(),warm=w.getWarmCacheStats();
  assert.equal(g.globalSweeps,64);assert.equal(g.pointUpdates,g.points*64);assert.equal(g.positionSweeps,1);assert.equal(g.positionTests,3);assert.equal(c.tests,3);assert.equal(g.positionHits,c.rows);assert.equal(c.enumeratedMasks,2**c.rows);assert.equal(warm.testedPatches,g.patches);assert.equal(warm.reusedPoints+warm.coldPoints,g.points);
  const geometry=await reference.ask({state,initial});assert.equal(geometry.ok,true,JSON.stringify(geometry));
  for(const [code,invoke] of [['INVALID_STEP',()=>w.step(1/100)],['INVALID_COMMAND',()=>w.step(1/120,[{kind:'force',bodyId:'missing',forceN:[0,0,0]}])],['NUMERIC_LIMIT',()=>w.step(1/120,[{kind:'impulse',bodyId:'b0',impulseNs:[10000,0,0]}])]]) {assert.throws(invoke,e=>e instanceof m.PhysicsError&&e.code===code);assert.deepEqual(snapshot(w),saved);}
  w.dispose();w.dispose();for(const getter of ['getState','getWarmCacheStats','getGlobalContactStats','getCoupledPositionStats','getWarmCacheSnapshot','getCoupledPositionAttempt'])assert.throws(()=>w[getter](),e=>e instanceof m.PhysicsError&&e.code==='DISPOSED');
  const injectedReceipts=[];
  for(const [name,inject,message] of [
    ['profile',()=>{throw new m.PositionReferenceError('PROFILE_LIMIT','injected profile');},m.COUPLED_ERRORS.PROFILE_LIMIT],
    ['input',()=>{throw new m.PositionReferenceError('INVALID_INPUT','injected input');},m.COUPLED_ERRORS.INVALID_INPUT],
    ['infeasible',()=>({ok:false,status:'INFEASIBLE',worldStepped:false}),m.COUPLED_ERRORS.INFEASIBLE],
    ['null-margin',p=>{const r=m.solvePosition(p);r.primalMarginsM[0]=null;return r;},m.COUPLED_ERRORS.RESULT],
    ['nonfinite',p=>{const r=m.solvePosition(p);r.translations[0].u[0]=NaN;return r;},m.COUPLED_ERRORS.RESULT],
  ]) {
    let enabled=false;const attempts=[];const world=m.createCandidateWorld(input,{solve:p=>enabled?inject(p):m.solvePosition(p),observeAttempt:a=>attempts.push(a)});
    world.step(1/120);const prior=copyChecks(world);enabled=true;assert.throws(()=>world.step(1/120),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message===message);assert.deepEqual(snapshot(world),prior);assert.equal(attempts.length,2);assert.ok(attempts[1].error);enabled=false;
    const control=m.createCandidateWorld(input);control.step(1/120);assert.deepEqual(world.step(1/120),control.step(1/120));assert.deepEqual(snapshot(world),snapshot(control));
    injectedReceipts.push({name,code:'NUMERIC_LIMIT',message,priorRetained:true,cacheStateExactAfterResume:true,attempt:attempts[1]});world.dispose();control.dispose();
  }
  const combinedConfig={fixedStepSeconds:1/30,gravityMps2:[0,0,0],contactMode:'persistent-box-v1',bodies:[
    {id:'a',kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[0,0,0],velocityMps:[300,0,0],massKg:1,restitution:0},
    {id:'wall',kind:'static',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[9.75,0,0],restitution:0}]};
  const combinedAttempts=[],combined=m.createCandidateWorld(combinedConfig,{observeAttempt:a=>combinedAttempts.push(a)}),combinedBefore=snapshot(combined);
  assert.throws(()=>combined.step(1/30),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message===m.COUPLED_ERRORS.RESULT);assert.deepEqual(snapshot(combined),combinedBefore);assert.equal(combinedAttempts.length,1);
  const combinedAttempt=combinedAttempts[0];assert.equal(combinedAttempt.workingBodies[0].positionM[0],10);assert.ok(combinedAttempt.solution.translations[0].u[0]>0);assert.ok(Math.hypot(...combinedAttempt.solution.translations[0].u)<=10);
  injectedReceipts.push({name:'combined-final-movement',code:'NUMERIC_LIMIT',message:m.COUPLED_ERRORS.RESULT,priorRetained:true,freeMovementM:10,coupledSolution:combinedAttempt.solution,attempt:combinedAttempt,phaseError:null,outerWorldRefusal:true});combined.dispose();
  const marker=new Error('Unexpected observer failure');let throwObserver=false;const unexpected=m.createCandidateWorld(input,{observeAttempt:()=>{if(throwObserver)throw marker;}});unexpected.step(1/120);const prior=snapshot(unexpected);throwObserver=true;assert.throws(()=>unexpected.step(1/120),e=>e===marker);assert.deepEqual(snapshot(unexpected),prior);unexpected.dispose();
  let primitiveEnabled=false;const primitive=m.createCandidateWorld(input,{solve:p=>{if(primitiveEnabled)throw null;return m.solvePosition(p);}});primitive.step(1/120);const primitiveBefore=snapshot(primitive);primitiveEnabled=true;let primitiveThrown=false;try{primitive.step(1/120);}catch(e){primitiveThrown=true;assert.strictEqual(e,null);}assert.equal(primitiveThrown,true);assert.deepEqual(snapshot(primitive),primitiveBefore);primitive.dispose();
  return {original,rejected,twoBox:{input,initial,state,global:g,coupled:c,warm,geometry},copiedStatsAndCache:true,refusalAllStateRetained:true,injectedReceipts,unexpectedObserverPropagation:true,primitiveSolverErrorPropagates:true,legacyProjectionGetterRemoved:true};
}
