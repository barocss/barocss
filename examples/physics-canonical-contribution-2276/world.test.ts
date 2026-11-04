import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld } from '../../packages/barocss-physics/src/index.js';
import { createPhysicsRecorder } from '../../packages/barocss-physics/src/replay.js';
import { ContactPairAccumulator } from '../../packages/barocss-physics/src/contact-contribution.js';
import type { PhysicsModel, WorldOptions } from '../../packages/barocss-physics/src/types.js';

const options: WorldOptions = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1/120, broadPhase: 'direct' };
function model(): PhysicsModel {
  return { format:'barocss-physics-model',version:1,revision:'canonical-contribution01',
    frame:{id:'world',basis:'right-handed-xyz',rotation:'local-to-world-xyzw'},
    units:{length:'m',mass:'kg',time:'s',angle:'rad'},gravityMps2:[0,-9.81,0],
    bodies:[{id:'floor',kind:'static',initial:{positionM:[0,-.1,0],orientationXYZW:[0,0,0,1]}},
      {id:'ball',kind:'dynamic',massKg:1,inertia:{kind:'primitive-com',about:'com',frame:'body-local'},
        initial:{positionM:[0,.2,0],orientationXYZW:[0,0,0,1],velocityMps:[1,0,0],angularVelocityRadps:[0,0,0]}}],
    colliders:[{id:'floor.shape',bodyId:'floor',geometry:{kind:'box',halfExtentsM:[2,.1,2]},
      local:{positionM:[0,0,0],orientationXYZW:[0,0,0,1]},material:{restitution:0,friction:{static:.5,dynamic:.3}},
      sensor:false,ccd:false,filter:{categoryBits:1,maskBits:65535}},
      {id:'ball.shape',bodyId:'ball',geometry:{kind:'sphere',radiusM:.2},
        local:{positionM:[0,0,0],orientationXYZW:[0,0,0,1]},material:{restitution:0,friction:{static:.5,dynamic:.3}},
        sensor:false,ccd:false,filter:{categoryBits:1,maskBits:65535}}],
    joints:[],cloths:[],fluids:[],sourceBindings:[] };
}

test('actual applied contribution failure preserves accepted World/recording and exact retry', () => {
  const a=createPhysicsWorld(model(),options), control=createPhysicsWorld(model(),options);
  const recorder=createPhysicsRecorder(a), clean=createPhysicsRecorder(control);
  const before=a.getState(), saved=recorder.saveRecording(), original=ContactPairAccumulator.prototype.finish;
  let injected=0;
  // Test-only replacement of an existing internal method; no production hook.
  ContactPairAccumulator.prototype.finish=function() {
    const candidate=original.call(this);
    assert.ok(candidate.some(pair=>pair.anyNonzero));
    injected++;
    throw new Error('canonical-after-actual-application');
  };
  try {
    assert.throws(()=>recorder.step(),/canonical-after-actual-application/);
    assert.equal(injected,1);
    assert.deepEqual(a.getState(),before);
    assert.deepEqual(recorder.saveRecording(),saved);
  } finally { ContactPairAccumulator.prototype.finish=original; }
  try {
    for(let i=0;i<3;i++) assert.deepEqual(recorder.step(),clean.step());
    assert.deepEqual(recorder.saveRecording(),clean.saveRecording());
  } finally { recorder.dispose(); clean.dispose(); a.dispose(); control.dispose(); }
});

test('persistent World preserves accepted warm cache via exact failed-step retry continuation', () => {
  const input=model();
  const persistent: PhysicsModel={...input,bodies:input.bodies.map(body=>body.kind==='dynamic'
    ? {...body,initial:{...body.initial,positionM:[0,.25,0] as const,velocityMps:[0,0,0] as const}} : body),
    colliders:input.colliders.map(collider=>({...collider,
      geometry:collider.bodyId==='ball'?{kind:'box' as const,halfExtentsM:[.25,.25,.25] as const}:collider.geometry,
      material:{restitution:0,friction:{static:0,dynamic:0}}}))};
  const selected: WorldOptions={...options,profile:'rigid-persistent-box-v1'};
  const a=createPhysicsWorld(persistent,selected), b=createPhysicsWorld(persistent,selected);
  const recorder=createPhysicsRecorder(a), clean=createPhysicsRecorder(b);
  const original=ContactPairAccumulator.prototype.finish;
  try {
    assert.deepEqual(recorder.step(),clean.step()); // accepted cache exists before injected attempt
    const before=a.getState(), saved=recorder.saveRecording(); let injected=0;
    ContactPairAccumulator.prototype.finish=function(){
      const candidate=original.call(this);assert.ok(candidate.some(pair=>pair.anyNonzero));injected++;
      throw new Error('persistent-after-warm-application');
    };
    try {
      assert.throws(()=>recorder.step(),/persistent-after-warm-application/);assert.equal(injected,1);
      assert.deepEqual(a.getState(),before);assert.deepEqual(recorder.saveRecording(),saved);
    } finally {ContactPairAccumulator.prototype.finish=original;}
    for(let i=0;i<3;i++)assert.deepEqual(recorder.step(),clean.step());
    assert.deepEqual(recorder.saveRecording(),clean.saveRecording());
  } finally {ContactPairAccumulator.prototype.finish=original;recorder.dispose();clean.dispose();a.dispose();b.dispose();}
});

test('direct canonical World keeps old state/wire shape and failed command retry', () => {
  const a=createPhysicsWorld(model(),options), b=createPhysicsWorld(model(),options);
  try {
    const before=a.getState();
    assert.throws(()=>a.step([{kind:'impulse',bodyId:'ball',impulseNs:[100000,0,0]}]));
    assert.deepEqual(a.getState(),before);
    const state=a.step(); assert.deepEqual(state,b.step());
    assert.equal('schemaVersion' in state,false); assert.equal('pairWrenches' in state,false);
    assert.ok(state.contacts.length>0); assert.ok('normalImpulseNs' in state.contacts[0]);
  } finally { a.dispose(); b.dispose(); }
});
