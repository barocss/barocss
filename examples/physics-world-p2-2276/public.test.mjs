import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createPhysicsWorld,PhysicsError} from '@barocss/physics';
import * as Replay from '@barocss/physics/replay';
import {admitCadSurfaceProxy,cadProxyPose} from '@barocss/physics/cad-proxy';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
import {canonicalEncode,sha256} from '../../packages/barocss-physics/src/identity.js';
const {createPhysicsRecorder,restorePhysicsRecording,serializePhysicsRecording,deserializePhysicsRecording}=Replay;
const dt=1/120, options={profile:'rigid-discrete-v1',fixedStepSeconds:dt,broadPhase:'direct'};
const part=(id='ball',positionM=[0,2,0])=>dynamicPart(id,{kind:'sphere',radiusM:.1},{positionM});
const model=(parts=[part()],gravityMps2=[0,0,0])=>makeModel({parts,gravityMps2});
const code=c=>e=>e instanceof PhysicsError && e.code===c;
const expected=(w,m,o=options)=>({model:m,options:o,providerDigest:w.getState().identity.providerDigest});
const near=(a,b,t)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} vs ${b} at ${t}`);
const clone=structuredClone;
function open(m=model(),o=options){const world=createPhysicsWorld(m,o);return{world,recorder:createPhysicsRecorder(world)};}
function close(pair){pair.recorder.dispose();pair.world.dispose();}

test('one attached owner; cached direct step cannot bypass; read/query and detached lifecycle',()=>{
 for(const name of ['createPhysicsScene','createPhysicsReplaySession','restorePhysicsReplaySession','serializePhysicsSnapshot','deserializePhysicsSnapshot'])assert.equal(Replay[name],undefined);
 const m=model(),w=createPhysicsWorld(m,options),cached=w.step,r=createPhysicsRecorder(w);
 let inspected=0;const malicious=new Proxy([], {get(){inspected++;throw Error('must not inspect');}});
 assert.throws(()=>cached(malicious),code('WORLD_OWNED'));assert.equal(inspected,0);
 assert.throws(()=>createPhysicsRecorder(w),code('WORLD_OWNED'));
 assert.equal(w.getModel().revision,m.revision);assert.equal(w.getState().stepIndex,0);
 assert.deepEqual(w.query({kind:'overlap-sphere',centerM:[0,2,0],radiusM:.2,includeSensors:true}).colliderIds,['ball.shape']);
 assert.deepEqual(r.step([{kind:'impulse',bodyId:'ball',impulseNs:[1,0,0]}]),w.getState());
 r.dispose();r.dispose();assert.equal(w.step().stepIndex,2);
 for(const action of [()=>r.step(),()=>r.getState(),()=>r.saveRecording()])assert.throws(action,code('DISPOSED'));
 assert.throws(()=>createPhysicsRecorder(w),code('INVALID_SNAPSHOT'));w.dispose();w.dispose();
 const fresh=createPhysicsWorld(m,options),r0=createPhysicsRecorder(fresh);r0.dispose();const r1=createPhysicsRecorder(fresh);fresh.dispose();assert.throws(()=>r1.step(),code('DISPOSED'));r1.dispose();r1.dispose();
 assert.throws(()=>createPhysicsRecorder({}),code('INVALID_SNAPSHOT'));
});

test('accepted log/state are copied; invalid and numerical failures preserve continuation',()=>{
 const m=model(),a=open(m),b=open(m);
 try{
  const commands=[{kind:'force',bodyId:'ball',forceN:[2,0,0]}];const returned=a.recorder.step(commands);b.recorder.step(clone(commands));
  commands[0].forceN[0]=999;returned.bodies[0].positionM[0]=123;
  const before=a.recorder.saveRecording();const edited=a.recorder.saveRecording();edited.frames[0].commands[0].forceN[0]=-999;edited.model.gravityMps2[0]=99;
  for(const bad of [[{kind:'impulse',bodyId:'missing',impulseNs:[1,0,0]}],dt,[{kind:'impulse',bodyId:'ball',impulseNs:[1e5,0,0]}]]){
   assert.throws(()=>a.recorder.step(bad),e=>e instanceof PhysicsError&&['INVALID_COMMAND','NUMERIC_LIMIT'].includes(e.code));
   assert.deepEqual(a.recorder.saveRecording(),before);assert.deepEqual(a.world.getState(),b.world.getState());
  }
  for(let i=0;i<20;i++)assert.deepEqual(a.recorder.step(),b.recorder.step());
 }finally{close(a);close(b);}
});

test('command reflection cannot reenter any lifecycle operation or diverge applied and recorded values',()=>{
 const m=model(),a=open(m);let nested=[];
 const command={kind:'impulse',bodyId:'ball',impulseNs:[2,0,0]};let inspections=0;
 const proxy=new Proxy(command,{getOwnPropertyDescriptor(target,key){inspections++;if(key==='impulseNs')return{value:[2+inspections,0,0],enumerable:true,configurable:true,writable:true};return Reflect.getOwnPropertyDescriptor(target,key);}});
 try{
  const state=a.recorder.step([proxy]);const log=a.recorder.saveRecording();near(state.bodies[0].velocityMps[0],log.frames[0].commands[0].impulseNs[0],1e-12);
  const restored=restorePhysicsRecording(log,expected(a.world,m));try{assert.deepEqual(restored.world.getState(),state);}finally{close(restored);}
  const guarded=new Proxy({kind:'force',bodyId:'ball',forceN:[0,0,0]},{getPrototypeOf(target){
   for(const action of [()=>a.world.step(),()=>a.world.getState(),()=>a.world.query(null),()=>a.world.dispose(),()=>a.recorder.dispose(),()=>a.recorder.saveRecording(),()=>a.recorder.step(),()=>createPhysicsRecorder(a.world)]){
    try{action();nested.push('MISSED');}catch(e){nested.push(e.code);}
   }return Reflect.getPrototypeOf(target);
  }});
  a.recorder.step([guarded]);assert.ok(nested.length>=8);assert.ok(nested.every(c=>c==='REENTRANT_CALL'),JSON.stringify(nested));
 }finally{close(a);}
});

test('frame and aggregate command budgets refuse without advancing or changing log',()=>{
 const a=open();try{for(let i=0;i<512;i++)a.recorder.step();const before=a.recorder.saveRecording();assert.throws(()=>a.recorder.step(),code('WORLD_LIMIT'));assert.deepEqual(a.recorder.saveRecording(),before);}finally{close(a);}
 const parts=Array.from({length:16},(_,i)=>part('b'+i,[i*.5,2,0])),b=open(model(parts));
 const commands=parts.flatMap(p=>[{kind:'force',bodyId:p.body.id,forceN:[0,0,0]},{kind:'impulse',bodyId:p.body.id,impulseNs:[0,0,0]},{kind:'torque',bodyId:p.body.id,torqueNm:[0,0,0]},{kind:'angularImpulse',bodyId:p.body.id,angularImpulseNms:[0,0,0]}]);
 try{for(let i=0;i<64;i++)b.recorder.step(commands);const before=b.recorder.saveRecording();assert.equal(before.frames.reduce((n,f)=>n+f.commands.length,0),4096);assert.throws(()=>b.recorder.step([commands[0]]),code('WORLD_LIMIT'));assert.deepEqual(b.recorder.saveRecording(),before);}finally{close(b);}
});

test('recording byte/model budgets fail before ownership or accepted physical commit',()=>{
 const m=model();m.sourceBindings=Array.from({length:32},(_,i)=>({id:'s'+i,sourceRevision:'r',sourceDigest:'sha256:'+'1'.repeat(64),modelId:'m',occurrenceId:'o',entityIds:['ball'],approximation:{kind:'control-net-box',lossLabel:'x'.repeat(4096)}}));
 const w=createPhysicsWorld(m,options);try{assert.throws(()=>createPhysicsRecorder(w),code('WORLD_LIMIT'));assert.equal(w.step().stepIndex,1);}finally{w.dispose();}
});

for(const profile of ['rigid-persistent-box-v1','rigid-large-v1'])test(profile+' restores contact/cache/events/sleep continuation at unchanged gates',()=>{
 const persistent=profile==='rigid-persistent-box-v1';
 const parts=persistent?[dynamicPart('box',{kind:'box',halfExtentsM:[.25,.25,.25]},{positionM:[0,.25,0]},1,{friction:{static:.5,dynamic:.3}})]:Array.from({length:6},(_,i)=>part('b'+i,[i*.4,.1,0]));
 parts.push(staticPart('floor',{kind:'box',halfExtentsM:[5,.1,5]},{positionM:[0,-.1,0]}, {friction:{static:.5,dynamic:.3}}));
 const m=model(parts,[0,-9.81,0]),o={profile,fixedStepSeconds:dt,broadPhase:persistent?'direct':'aabb'},a=open(m,o);
 try{for(let i=0;i<(persistent?24:180);i++)a.recorder.step();const saved=a.recorder.saveRecording();if(!persistent)assert.ok(saved.finalState.bodies.filter(b=>b.sleeping).length>=5,'fixture must actually exercise sleeping state');const b=restorePhysicsRecording(saved,expected(a.world,m,o));
  try{assert.deepEqual(b.world.getState(),a.world.getState());for(let i=0;i<20;i++){const commands=i===0?[{kind:'impulse',bodyId:persistent?'box':'b0',impulseNs:[.01,0,0]}]:[];assert.deepEqual(b.recorder.step(commands),a.recorder.step(commands));}assert.throws(()=>b.world.step(),code('WORLD_OWNED'));}finally{close(b);}
  console.log(JSON.stringify({profile,frames:saved.frames.length,continued:20,sleeping:saved.finalState.bodies.filter(b=>b.sleeping).length,contacts:saved.finalState.contacts.length,scope:'exact continuation; no stable-stack qualification'}));
 }finally{close(a);}
});

test('wire signed zero and frozen canonical bytes match independent SHA; old wire and malformed bytes refuse',()=>{
 const m=model([part('ball',[-0,2,0])],[-0,0,0]),a=open(m);
 try{const initial=deserializePhysicsRecording(serializePhysicsRecording(a.recorder.saveRecording()));assert.ok(Object.is(initial.finalState.bodies[0].positionM[0],-0));a.recorder.step([{kind:'force',bodyId:'ball',forceN:[-0,0,0]}]);const saved=a.recorder.saveRecording(),bytes=serializePhysicsRecording(saved),decoded=deserializePhysicsRecording(bytes);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,8)),'BCPHREC1');assert.ok(Object.is(decoded.model.gravityMps2[0],-0));assert.ok(Object.is(decoded.model.bodies[0].initial.positionM[0],-0));assert.ok(Object.is(decoded.frames[0].commands[0].forceN[0],-0));assert.deepEqual(decoded,saved);
  for(const bad of [bytes.subarray(0,12),new Uint8Array([...bytes,0]),new TextEncoder().encode(JSON.stringify(saved)),new Uint8Array([...new TextEncoder().encode('BCPHSNP1'),...bytes.subarray(8)]),new Uint8Array(1024*1024+1),new Uint8Array([...bytes.subarray(0,8),255])])assert.throws(()=>deserializePhysicsRecording(bad),code('INVALID_SNAPSHOT'));
  const magic=[66,67,80,72,82,69,67,49],str=x=>[3,1,0,0,0,x.charCodeAt(0)];
  const malformed=[[6,2,0,0,0,...str('b'),0,...str('a'),0],[6,2,0,0,0,...str('x'),0,...str('x'),0],[...Array.from({length:34},()=>[5,1,0,0,0]).flat(),0],[4,0,0,0,0,0,0,248,127],[3,1,0,0,0,255],[5,1,16,0,0],[6,65,0,0,0]];
  for(const bytes of malformed)assert.throws(()=>deserializePhysicsRecording(Uint8Array.from([...magic,...bytes])),e=>code('INVALID_SNAPSHOT')(e)&&e.details.operation==='record'&&e.details.domain==='recording');
  const vectors=JSON.parse(readFileSync(new URL('../../packages/barocss-physics/design/p0/encoding-vectors.json',import.meta.url)));const values=[0,-0,1,'µ',[0,-0],[-0,0],{b:1,a:0}];for(let i=0;i<values.length;i++){const encoded=canonicalEncode(values[i]);assert.equal(Buffer.from(encoded).toString('hex'),vectors.vectors[i].encodedHex);assert.equal(sha256(encoded),vectors.vectors[i].expectedSha256);}
  const encoded=canonicalEncode(saved);assert.equal(sha256(encoded),'sha256:'+createHash('sha256').update(encoded).digest('hex'));
 }finally{close(a);}
});

test('complete shape refusal precedes stale identity; damage never mutates the source World/log',()=>{
 const m=model(),a=open(m);try{
  for(let i=0;i<12;i++)a.recorder.step();const saved=a.recorder.saveRecording(),exp=expected(a.world,m),before=a.world.getState();
  for(const mutate of [r=>r.frames[0].stepIndex=2,r=>r.frames[0].stepIndex=1+5e-13,r=>r.frames[0].commands=[{kind:'force',bodyId:'unknown',forceN:[0,0,0]}],r=>r.finalState.contacts=[{bodyAId:'ball'}],r=>r.finalState.bodies[0].positionM[0]=NaN,r=>r.finalState.stepIndex=99,r=>r.extra=true]){
   const damaged=clone(saved);mutate(damaged);assert.throws(()=>restorePhysicsRecording(damaged,{...exp,providerDigest:'sha256:'+'f'.repeat(64)}),code('INVALID_SNAPSHOT'));assert.deepEqual(a.world.getState(),before);assert.deepEqual(a.recorder.saveRecording(),saved);
  }
  const damaged=clone(saved);damaged.finalState.bodies[0].positionM[0]+=1e-4;assert.throws(()=>restorePhysicsRecording(damaged,exp),code('INVALID_SNAPSHOT'));
  for(const wrong of [{...exp,model:{...m,revision:'changed'}},{...exp,options:{...options,fixedStepSeconds:1/60}},{...exp,providerDigest:'sha256:'+'f'.repeat(64)}])assert.throws(()=>restorePhysicsRecording(saved,wrong),e=>code('STALE_SNAPSHOT')(e)&&e.details.operation==='restore'&&e.details.phase==='identity'&&e.details.domain==='recording');
  const stale=clone(saved);stale.identity.providerDigest='sha256:'+'f'.repeat(64);stale.finalState.identity.providerDigest=stale.identity.providerDigest;assert.throws(()=>restorePhysicsRecording(stale,{...exp,providerDigest:stale.identity.providerDigest}),code('STALE_SNAPSHOT'));
 }finally{close(a);}
});

test('ballistic independent truth and CAD off-origin/stale source gates remain unchanged',()=>{
 const errors=[];for(const h of [1/60,1/120,1/240]){const a=open(model([part()],[0,-9.81,0]),{...options,fixedStepSeconds:h});try{for(let i=0;i<Math.round(1/h);i++)a.recorder.step();const b=a.world.getState().bodies[0];errors.push(Math.abs(b.positionM[1]-(2-9.81/2)));near(b.velocityMps[1],-9.81,1e-11);}finally{close(a);}}
 assert.ok(errors[0]<.083);for(let i=1;i<3;i++){const r=errors[i-1]/errors[i];assert.ok(r>=1.99&&r<=2.01);}console.log(JSON.stringify({metric:'ballistic',errorsM:errors,ratios:[errors[0]/errors[1],errors[1]/errors[2]]}));
 const source=`@model units_fixture { version:0; length-unit:mm; @surface #panel {type:nurbs; degree-u:1; degree-v:1; knots-u:[0,0,1,1]; knots-v:[0,0,1,1]; control-points:[[[20,-30,40],[20,-30,100]],[[120,10,40],[120,10,100]]]; weights:[[1,1],[1,1]];} }`;
 const proxy=admitCadSurfaceProxy(source,{sourceVersion:0,sourceRevision:'cadRev1',modelId:'units_fixture',surfaceId:'panel',kind:'dynamic',proxy:'box',massKg:1,initialOffsetM:[.1,0,0]});
 proxy.collider.geometry.halfExtentsM.forEach((x,i)=>near(x,[.05,.02,.03][i],1e-9));
 const m=makeModel({parts:[{body:proxy.body,collider:proxy.collider}],sourceBindings:[proxy.binding],gravityMps2:[0,0,0]}),a=open(m);
 try{const body=clone(a.world.getState().bodies[0]);body.orientationXYZW=[0,0,Math.SQRT1_2,Math.SQRT1_2];const pose=cadProxyPose(proxy,body,source,'cadRev1');pose.translation.forEach((x,i)=>near(x,[160,-80,0][i],1e-6));
 for(const [text,revision] of [[source+'\n','cadRev1'],[source,'changed']])assert.throws(()=>cadProxyPose(proxy,body,text,revision),code('STALE_SOURCE'));
 const changed=clone(m);changed.sourceBindings[0].sourceRevision='changed';assert.throws(()=>restorePhysicsRecording(a.recorder.saveRecording(),{...expected(a.world,m),model:changed}),code('STALE_SNAPSHOT'));
 console.log(JSON.stringify({metric:'cad-off-origin',translationMm:pose.translation,gateMm:1e-6,sourceAndRevisionStaleRefused:true}));
 }finally{close(a);}
});

test('canonical UTF-8 leading BOM is model data, and must survive save/load unchanged',()=>{
 const m=model();m.revision='\ufeffrevision';const a=open(m);
 try{const recording=a.recorder.saveRecording();const decoded=deserializePhysicsRecording(serializePhysicsRecording(recording));assert.equal(decoded.model.revision,'\ufeffrevision');assert.deepEqual(decoded,recording);}finally{close(a);}
});
