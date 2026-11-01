// The runner injects three one-shot faults into selected provider copies only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicsWorld} from '@barocss/physics';
import {createPhysicsRecorder,restorePhysicsRecording} from '@barocss/physics/replay';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
for(const profile of ['rigid-discrete-v1','rigid-persistent-box-v1','rigid-large-v1'])for(const phase of ['frame-preflight','before-output','log-encoding','before-commit'])test(`${profile} injected ${phase} preserves state,log and next20steps`,()=>{
 const large=profile==='rigid-large-v1',persistent=profile==='rigid-persistent-box-v1';
 const parts=[dynamicPart('ball',persistent?{kind:'box',halfExtentsM:[.1,.1,.1]}:{kind:'sphere',radiusM:.1},{positionM:[0,.1,0]},1,{friction:{static:.5,dynamic:.3}}),staticPart('floor',{kind:'box',halfExtentsM:[2,.1,2]},{positionM:[0,-.1,0]}, {friction:{static:.5,dynamic:.3}})];
 const model=makeModel({parts}),options={profile,fixedStepSeconds:1/120,broadPhase:large?'aabb':'direct'};
 const a=createPhysicsWorld(model,options),b=createPhysicsWorld(model,options),ra=createPhysicsRecorder(a),rb=createPhysicsRecorder(b);
 let restored;
 try{
  for(let i=0;i<(large?180:24);i++){assert.deepEqual(ra.step(),rb.step());}
  const state=a.getState(),log=ra.saveRecording();if(large)assert.ok(state.bodies.some(b=>b.sleeping),'fault must start from sleeping state');globalThis.__p2Fault=phase;
  assert.throws(()=>ra.step([{kind:'impulse',bodyId:'ball',impulseNs:[.01,0,0]}]),e=>e.message===`injected-${phase}`);
  assert.equal(globalThis.__p2Fault,null);assert.deepEqual(a.getState(),state);assert.deepEqual(ra.saveRecording(),log);
  for(let i=0;i<20;i++){const command=i===0?[{kind:'impulse',bodyId:'ball',impulseNs:[.01,0,0]}]:[];assert.deepEqual(ra.step(command),rb.step(command));}
  restored=restorePhysicsRecording(ra.saveRecording(),{model,options,providerDigest:a.getState().identity.providerDigest});assert.deepEqual(restored.world.getState(),a.getState());assert.deepEqual(restored.recorder.step(),ra.step());
 }finally{globalThis.__p2Fault=null;ra.dispose();rb.dispose();a.dispose();b.dispose();restored?.recorder.dispose();restored?.world.dispose();}
});

for(const profile of ['rigid-discrete-v1','rigid-persistent-box-v1','rigid-large-v1'])test(`${profile} failed recorder output preparation must not strand World ownership`,()=>{
 const model=makeModel({parts:[dynamicPart('ball',{kind:'sphere',radiusM:.1},{positionM:[0,2,0]})]}),options={profile,fixedStepSeconds:1/120,broadPhase:profile==='rigid-large-v1'?'aabb':'direct'};
 const world=createPhysicsWorld(model,options),before=world.getState();let recorder;
 try{globalThis.__p2Fault='attach-output';assert.throws(()=>createPhysicsRecorder(world),e=>e.message==='injected-attach-output');assert.equal(globalThis.__p2Fault,null);assert.deepEqual(world.getState(),before);recorder=createPhysicsRecorder(world);assert.equal(recorder.step().stepIndex,1);}finally{globalThis.__p2Fault=null;recorder?.dispose();world.dispose();}
});
