import assert from 'node:assert/strict';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';
import { fixtures } from '../physics-rigid-engine-reference/fixtures.mjs';
import { controls as originalControls } from '../physics-rigid-contact-reference/controls.mjs';
export async function controls(module, scene, reference) {
  const original = originalControls(module, scene);
  const {createCandidateWorld, PhysicsError} = module;
  const rejected = [];
  const edits = {
    basic: c => delete c.contactMode,
    joints: c => c.joints = [],
    broadPhase: c => c.broadPhase = 'aabb',
    large: c => { c.sceneMode = 'large-v1'; c.broadPhase = 'aabb'; },
    sphere: c => c.bodies[0].shape = {kind:'sphere',radiusM:.25},
    kinematic: c => { const b=c.bodies[0]; b.kind='kinematic'; delete b.massKg; delete b.velocityMps; },
    sensor: c => c.bodies.at(-1).sensor = true,
    ccd: c => c.bodies[0].ccd = true,
    filter: c => c.bodies[0].collisionFilter = {categoryBits:1,maskBits:1},
    sleeping: c => c.bodies[0].sleeping = true,
  };
  for (const [name,edit] of Object.entries(edits)) {
    const c=fixture(scene); edit(c);
    assert.throws(()=>createCandidateWorld(c),e=>e instanceof PhysicsError&&e.code==='INVALID_CONFIG',name);
    rejected.push(name);
  }
  const input=fixtures().find(f=>f.id==='STACK2_CONTROL').input;
  const world=createCandidateWorld(input), initial=world.getState();
  assert.deepEqual(world.getProjectionStats(),{sweeps:0,tests:0,hits:0});
  const state=world.step(1/120), stats=world.getProjectionStats();
  assert.equal(stats.sweeps,32); assert.equal(stats.tests,96);
  const geometry=await reference.ask({state,initial});
  assert.equal(geometry.ok,true,JSON.stringify(geometry));
  const copied=world.getProjectionStats(); copied.tests=-1;
  const publicCopy=world.getState(); publicCopy.bodies[0].positionM[1]=-99;
  assert.deepEqual(world.getProjectionStats(),stats); assert.deepEqual(world.getState(),state);
  for (const [code,invoke] of [
    ['INVALID_STEP',()=>world.step(1/100)],
    ['INVALID_COMMAND',()=>world.step(1/120,[{kind:'force',bodyId:'missing',forceN:[0,0,0]}])],
    ['NUMERIC_LIMIT',()=>world.step(1/120,[{kind:'impulse',bodyId:'b0',impulseNs:[10000,0,0]}])],
  ]) {
    assert.throws(invoke,e=>e instanceof PhysicsError&&e.code===code,code);
    assert.deepEqual(world.getState(),state); assert.deepEqual(world.getProjectionStats(),stats);
  }
  world.dispose();world.dispose();
  assert.throws(()=>world.getProjectionStats(),e=>e instanceof PhysicsError&&e.code==='DISPOSED');
  return {original,rejected,twoBox:{input,initial,state,stats,geometry},copiedStats:true,refusalStateAndStatsRetained:true};
}
