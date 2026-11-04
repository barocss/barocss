// Root executes against explicit actual source-root or canonical dist root/replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {model,options,bodyWords,rename} from './model.mjs';
assert.ok(process.env.STATIONARY_WORLD_ENTRY&&process.env.STATIONARY_REPLAY_ENTRY,'Explicit qualified root/replay paths required');
const api=await import(pathToFileURL(resolve(process.env.STATIONARY_WORLD_ENTRY))),replay=await import(pathToFileURL(resolve(process.env.STATIONARY_REPLAY_ENTRY)));
const fails=(call,code)=>assert.throws(call,error=>error instanceof api.PhysicsError&&error.code===code);
function unchanged(world,before){assert.deepEqual(world.getState(),before);}

test('public01 original authored models, identity/copies and opaque IDs/order',()=>{
 for(const scene of ['ALIGNED','OFFSET','YAW']){const input=model(scene),before=structuredClone(input),world=api.createPhysicsWorld(input,options);assert.deepEqual(world.getModel(),before);assert.equal(world.getState().identity.profile,options.profile);assert.equal(world.getState().bodies.length,9);const got=world.getState();got.bodies[0].positionM[0]=99;input.bodies[0].initial.positionM[0]=88;assert.deepEqual(world.getModel(),before);assert.equal(world.getState().stepIndex,0);world.dispose();}
 const input=rename(model()),world=api.createPhysicsWorld(input,options),state=world.step([]);assert.deepEqual(state.bodies.map(b=>b.id),input.bodies.map(b=>b.id));assert.equal(state.contacts.length,8);for(const c of state.contacts){assert.equal(input.colliders.find(x=>x.id===c.colliderAId).bodyId,c.bodyAId);assert.equal(input.colliders.find(x=>x.id===c.colliderBId).bodyId,c.bodyBId);}world.dispose();
});
test('public02 structural refusal bank including authored subnormal tilt',()=>{
 const changes=[m=>m.bodies.pop(),m=>m.bodies[0].massKg=2,m=>m.colliders[0].geometry.halfExtentsM[0]=.3,m=>m.bodies[0].inertia={kind:'sphere-isotropic',about:'com',frame:'body-local',kgM2:1},m=>m.bodies[8].initial.positionM[1]=-.11,m=>m.colliders[8].geometry.halfExtentsM[1]=.2,m=>m.colliders[0].material.friction.dynamic=0,m=>m.colliders[0].material.restitution=.1,m=>m.gravityMps2[0]=Number.MIN_VALUE,m=>m.colliders[0].filter.maskBits=1,m=>m.colliders[0].sensor=true,m=>m.colliders[0].ccd=true,m=>m.bodies[0].initial.velocityMps[0]=Number.MIN_VALUE,m=>m.bodies[0].initial.angularVelocityRadps[2]=Number.MIN_VALUE,m=>m.bodies[0].initial.orientationXYZW=[Number.MIN_VALUE,0,0,1],m=>m.bodies[0].initial.orientationXYZW=[0,0,Number.MIN_VALUE,1],m=>m.bodies[1].id=m.bodies[0].id,m=>m.units.length='mm',m=>m.colliders[0].bodyId='missing'];
 for(const change of changes){const input=model();change(input);fails(()=>api.createPhysicsWorld(input,options),'INVALID_CONFIG');}
 for(const change of [o=>o.fixedStepSeconds=1/60,o=>o.broadPhase='aabb']){const o={...options};change(o);fails(()=>api.createPhysicsWorld(model(),o),'INVALID_CONFIG');}
 const input=model();Object.defineProperty(input.bodies[0].initial,'positionM',{enumerable:true,get(){throw Error('getter must not execute');}});fails(()=>api.createPhysicsWorld(input,options),'INVALID_CONFIG');
 const yaw=model('YAW');for(const b of yaw.bodies.filter(b=>b.kind==='dynamic'))b.initial.orientationXYZW=b.initial.orientationXYZW.map(v=>-v);const w=api.createPhysicsWorld(yaw,options);w.step();w.dispose();
});
test('public03 command refusals retain state and subsequent empty continuation',()=>{
 const subject=api.createPhysicsWorld(model(),options),control=api.createPhysicsWorld(model(),options),before=subject.getState();
 const commands=[{kind:'force',bodyId:'b0',forceN:[0,0,0]},{kind:'impulse',bodyId:'b0',impulseNs:[0,0,0]},{kind:'torque',bodyId:'b0',torqueNm:[0,0,0]},{kind:'angularImpulse',bodyId:'b0',angularImpulseNms:[0,0,0]},{kind:'kinematicTarget',bodyId:'b0',positionM:[0,0,0]}];
 for(const command of commands){const input=[structuredClone(command)],copy=structuredClone(input);fails(()=>subject.step(input),'INVALID_COMMAND');assert.deepEqual(input,copy);unchanged(subject,before);}
 fails(()=>subject.step([{kind:'force',bodyId:'missing',forceN:[0,0,0]}]),'INVALID_COMMAND');assert.deepEqual(bodyWords(subject.step([])),bodyWords(control.step([])));subject.dispose();control.dispose();
});
test('public04 live contact/events/stats/query observations and read ownership',()=>{
 const w=api.createPhysicsWorld(model(),options),initial=w.getState();assert.deepEqual(initial.contacts,[]);const first=w.step(),second=w.step([]);assert.equal(first.contacts.length,8);assert.ok(first.events.every(e=>e.phase==='begin'&&e.kind==='contact'));assert.ok(second.events.every(e=>e.phase==='stay'));assert.deepEqual(first.pairStats,{eligiblePairs:36,candidatePairs:36,aabbTests:0});assert.deepEqual(first.joints,[]);assert.deepEqual(first.ccdHits,[]);assert.ok(first.contacts.some(c=>c.penetrationM>0),'actual free-pose floor penetration');for(const c of first.contacts){assert.ok(c.penetrationM>=0);assert.ok(c.normalImpulseNs>=0);assert.deepEqual(c.tangentImpulseOnBNs,[0,0,0]);}const momentum=[0,0,0];for(const b of first.bodies.filter(b=>b.kind==='dynamic'))for(let axis=0;axis<3;axis++)momentum[axis]+=b.velocityMps[axis]-initial.bodies.find(x=>x.id===b.id).velocityMps[axis]-model().gravityMps2[axis]/120;const external=[0,0,0];for(const c of first.contacts){const a=first.bodies.find(b=>b.id===c.bodyAId),b=first.bodies.find(b=>b.id===c.bodyBId);if((a.kind==='static')!==(b.kind==='static'))for(let axis=0;axis<3;axis++)external[axis]+=(b.kind==='dynamic'?1:-1)*c.normalAtoB[axis]*c.normalImpulseNs;}for(let axis=0;axis<3;axis++)assert.ok(Math.abs(momentum[axis]-external[axis])<=1e-10,'rounded normal summary global linear momentum');const step=w.getState().stepIndex;const q=w.query({kind:'overlap-sphere',centerM:[0,.25,0],radiusM:.1,includeSensors:false});assert.ok(q.colliderIds.includes('col-b0'));assert.equal(w.getState().stepIndex,step);w.dispose();w.dispose();fails(()=>w.step(),'DISPOSED');
});
test('public05 structurally admitted unsupported pose refuses transactionally without fallback',()=>{
 const input=model();input.bodies[0].initial.positionM[0]=4;const w=api.createPhysicsWorld(input,options),before=w.getState();fails(()=>w.step([]),'NUMERIC_LIMIT');unchanged(w,before);w.dispose();
});
test('public06 recorder/root identity, binary restore and continuation; no1200 recording claim',()=>{
 const w=api.createPhysicsWorld(model('YAW'),options),r=replay.createPhysicsRecorder(w);fails(()=>w.step([]),'WORLD_OWNED');for(let i=0;i<4;i++)r.step([]);const recording=r.saveRecording(),encoded=replay.serializePhysicsRecording(recording),decoded=replay.deserializePhysicsRecording(encoded);const restored=replay.restorePhysicsRecording(decoded,{model:recording.model,options:recording.options,providerDigest:recording.identity.providerDigest});assert.deepEqual(bodyWords(restored.world.getState()),bodyWords(w.getState()));assert.deepEqual(bodyWords(restored.recorder.step([])),bodyWords(r.step([])));restored.recorder.dispose();r.dispose();assert.deepEqual(bodyWords(restored.world.step([])),bodyWords(w.step([])));restored.world.dispose();w.dispose();
});
test('public07 recording rejects nonempty commands before physics and stale/corrupt identity',()=>{
 const w=api.createPhysicsWorld(model(),options),r=replay.createPhysicsRecorder(w);r.step([]);const snapshot=r.saveRecording(),expected={model:snapshot.model,options:snapshot.options,providerDigest:snapshot.identity.providerDigest},bad=structuredClone(snapshot);bad.frames[0].commands=[{kind:'force',bodyId:'b0',forceN:[0,0,0]}];fails(()=>replay.restorePhysicsRecording(bad,expected),'INVALID_SNAPSHOT');fails(()=>replay.restorePhysicsRecording(snapshot,{...expected,providerDigest:'sha256:'+'0'.repeat(64)}),'STALE_SNAPSHOT');const bytes=replay.serializePhysicsRecording(snapshot);fails(()=>replay.deserializePhysicsRecording(bytes.subarray(0,bytes.length-1)),'INVALID_SNAPSHOT');r.dispose();w.dispose();
});
test('public08 exact512 recording bound retains log/state; permanent detach continuation',()=>{
 const w=api.createPhysicsWorld(model(),options),r=replay.createPhysicsRecorder(w);for(let i=0;i<512;i++)r.step([]);const before=w.getState(),saved=r.saveRecording();fails(()=>r.step([]),'WORLD_LIMIT');unchanged(w,before);assert.deepEqual(r.saveRecording(),saved);r.dispose();assert.equal(w.step([]).stepIndex,513);w.dispose();
});
test('public09 focused existing caps and profile behavior remain separate',()=>{
 const one=model();one.bodies=one.bodies.slice(0,1);one.colliders=one.colliders.slice(0,1);const old={profile:'rigid-persistent-box-v1',fixedStepSeconds:1/120,broadPhase:'direct'};const w=api.createPhysicsWorld(one,old);w.step([{kind:'force',bodyId:'b0',forceN:[0,0,0]}]);w.dispose();const five=model();five.bodies=five.bodies.slice(0,5);five.colliders=five.colliders.slice(0,5);fails(()=>api.createPhysicsWorld(five,old),'INVALID_CONFIG');for(const o of [{profile:'rigid-discrete-v1',fixedStepSeconds:1/120,broadPhase:'direct'},{profile:'rigid-large-v1',fixedStepSeconds:1/120,broadPhase:'aabb'}]){const x=api.createPhysicsWorld(one,o);x.step([]);x.dispose();}
});
