// Root executes each scene in a fresh process. Traces are compared only AFTER World returns.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,openSync,readSync,closeSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {model,options,bodyWords} from './model.mjs';
const scene=process.env.STATIONARY_SCENE;
assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
assert.ok(process.env.STATIONARY_WORLD_ENTRY&&process.env.STATIONARY_TRACE_MANIFEST&&process.env.STATIONARY_DURATION_RESULT);
const root=resolve(import.meta.dirname,'../..'),manifest=JSON.parse(readFileSync(resolve(process.env.STATIONARY_TRACE_MANIFEST),'utf8'));
assert.equal(manifest.status,'DERIVED_BODY_TRACES_FROM_COMPLETE_ORIGINAL_3600');assert.equal(manifest.testOnlyNeverEngineInput,true);assert.equal(manifest.newPhysicsCalls,0);assert.equal(manifest.newReferenceCalls,0);
const authority=manifest.scenes[scene],tracePath=resolve(root,authority.trace.path);
assert.equal(authority.frames,1201);assert.equal(authority.strideBytes,936);assert.equal(statSync(tracePath).size,authority.trace.bytes);
const scratch=Buffer.alloc(65536),hash=createHash('sha256'),fd=openSync(tracePath,'r');
try{let n;while((n=readSync(fd,scratch,0,scratch.length,null)))hash.update(scratch.subarray(0,n));}finally{closeSync(fd);}
assert.equal(hash.digest('hex'),authority.trace.sha256);
const api=await import(pathToFileURL(resolve(process.env.STATIONARY_WORLD_ENTRY)));
test('public original '+scene+' 1200 owner-chain states equal paid private body words',()=>{
 const input=model(scene),copy=structuredClone(input),world=api.createPhysicsWorld(input,options),trace=openSync(tracePath,'r'),expected=Buffer.alloc(936),observed=createHash('sha256');let compared=0;
 function compare(state){assert.deepEqual(state.bodies.map(b=>b.id),authority.bodyIds);assert.equal(readSync(trace,expected,0,936,state.stepIndex*936),936);const actual=bodyWords(state);assert.deepEqual(actual,expected,'body words at '+scene+'/'+state.stepIndex);observed.update(actual);compared++;}
 try{compare(world.getState());for(let step=1;step<=1200;step++){const before=world.getState(),beforeCopy=structuredClone(before),state=world.step(step%2?undefined:[]);assert.equal(state.stepIndex,step);assert.equal(state.timeSeconds,step*options.fixedStepSeconds);assert.deepEqual(before,beforeCopy);compare(state);}assert.deepEqual(world.getModel(),copy);const before=world.getState(),commands=new Proxy([],{get(){throw Error('lifetime guard must precede command reads');}});assert.throws(()=>world.step(commands),e=>e instanceof api.PhysicsError&&e.code==='WORLD_LIMIT');assert.deepEqual(world.getState(),before);writeFileSync(process.env.STATIONARY_DURATION_RESULT,JSON.stringify({status:'PUBLIC_1200_BODY_WORDS_CONFIRMED',scene,comparedFrames:compared,bodySha256:observed.digest('hex'),traceSha256:authority.trace.sha256,identity:before.identity,publicOnly:true,newIndependentReferenceCalls:0})+'\n',{flag:'wx'});}finally{closeSync(trace);world.dispose();}
});
