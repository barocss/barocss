// This entry accepts ONLY explicitly instrumented example-owned provider copies.
import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import {model,options,bodyWords} from './model.mjs';
assert.ok(process.env.STATIONARY_FAULT_WORLD&&process.env.STATIONARY_FAULT_REPLAY);
const api=await import(pathToFileURL(resolve(process.env.STATIONARY_FAULT_WORLD))),replay=await import(pathToFileURL(resolve(process.env.STATIONARY_FAULT_REPLAY)));
for(const point of ['frames','candidate','output','log','commit'])test('transaction '+point+' retains owner/clock/log after known and unknown throws',()=>{
 for(const kind of ['known','error','object','null']){
  const world=api.createPhysicsWorld(model(),options),control=api.createPhysicsWorld(model(),options),r=replay.createPhysicsRecorder(world),c=replay.createPhysicsRecorder(control);r.step([]);c.step([]);
  const before=world.getState(),beforeModel=world.getModel(),log=r.saveRecording(),command=[];
  const value=kind==='known'?new api.PhysicsError('NUMERIC_LIMIT','example injected'):kind==='error'?Error('example unknown'):kind==='object'?{tag:'example unknown'}:null;
  globalThis.__stationaryWorldFault={point,value};let caught=false;try{r.step(command);}catch(error){caught=true;if(kind==='known'){assert.ok(error instanceof api.PhysicsError);assert.equal(error.code,'NUMERIC_LIMIT');assert.equal(error.details.phase,point==='candidate'?'candidate':'prepare-output');assert.deepEqual(error.details.accepted,{stepIndex:1,timeSeconds:1/120});assert.equal(error.details.operation,'record');}else assert.equal(error,value);}
  assert.equal(caught,true);assert.equal(globalThis.__stationaryWorldFault,null);assert.deepEqual(command,[]);assert.deepEqual(world.getState(),before);assert.deepEqual(world.getModel(),beforeModel);assert.deepEqual(r.saveRecording(),log);
  for(let i=0;i<3;i++)assert.deepEqual(bodyWords(r.step([])),bodyWords(c.step([])));const saved=r.saveRecording(),restored=replay.restorePhysicsRecording(saved,{model:saved.model,options:saved.options,providerDigest:saved.identity.providerDigest});assert.deepEqual(bodyWords(restored.world.getState()),bodyWords(world.getState()));assert.deepEqual(bodyWords(restored.recorder.step([])),bodyWords(r.step([])));restored.recorder.dispose();restored.world.dispose();r.dispose();c.dispose();world.dispose();control.dispose();
 }
});
test('candidate/output/commit unowned throw preserves immediate empty continuation',()=>{for(const point of ['candidate','output','commit']){const w=api.createPhysicsWorld(model('YAW'),options),c=api.createPhysicsWorld(model('YAW'),options),before=w.getState(),value={point};globalThis.__stationaryWorldFault={point,value};assert.throws(()=>w.step([]),error=>error===value);assert.deepEqual(w.getState(),before);assert.deepEqual(bodyWords(w.step()),bodyWords(c.step()));w.dispose();c.dispose();}});
