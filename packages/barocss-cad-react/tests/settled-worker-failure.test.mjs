/** Actual ModelHost/EngineAdapter, controlled EnginePort events and sink. No native Worker/GPU proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';

function engine(){
 const requests=[],failures=new Set();let restarted=0;
 return{requests,failures,get restarted(){return restarted;},
  evaluate(doc,revision){return new Promise((resolve,reject)=>requests.push({doc,revision,resolve,reject}));},
  restart(){restarted++;return true;},dispose(){},onFailure(fn){failures.add(fn);return()=>failures.delete(fn);},onMasses(){return()=>{};},
  fail(error){for(const notify of failures)notify(error);},
 };
}
const model=width=>({kind:'part',units:'mm',children:[{kind:'extrude',key:'solid',distance:6,children:[{kind:'rectangle',key:'profile',min:[0,0],max:[width,60]}]}]});
const result=revision=>({ok:true,revision,wallTime:0,bodies:[{key:'b1',volume:1,mass:1,mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array(),bounds:{min:[0,0,0],max:[1,1,1]}}}]});
const failure={title:'Worker unavailable',hint:'Retry the current model.',detail:'Controlled Worker failure sentinel'};
async function settled(predicate){for(let i=0;i<30;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('controlled host did not settle');}
async function rig(t){
 const{ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),client=engine(),shown=[];
 const host=new ModelHost({engine:client,ownership:'borrowed',sink:{show:async(b,owner,current)=>{if(current())shown.push(owner);},snapshot:()=>({}),dispose(){}},ownsSink:false,massPolicy:{merge:b=>b}});
 t.after(()=>host.dispose());host.connect();const compiled=new CompositionCompiler().compile(model(80)).value;
 return{host,client,shown,compiled,compile:width=>new CompositionCompiler().compile(model(width)).value};
}

test('settled successful host reports a later EnginePort failure as failed with a useful message and no automatic restart',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.requests[0].resolve(result(f.client.requests[0].revision));await settled(()=>f.host.read().status==='ready');
 const accepted=f.host.read().documentJSON,owner=f.host.read().renderedOwner;
 f.client.fail(failure);const state=f.host.read();
 assert.equal(state.adapter.phase,'failed');assert.equal(state.status,'failed');
 assert.match(state.error,/Worker unavailable/);assert.match(state.error,/Retry the current model/);assert.match(state.error,/Controlled Worker failure sentinel/);
 assert.doesNotMatch(state.error,/\[object Object\]/);assert.equal(state.native,null);
 assert.equal(state.documentJSON,accepted);assert.equal(state.renderedOwner,owner);
 assert.equal(f.client.requests.length,1);assert.equal(f.client.restarted,0);
});
test('in-flight EnginePort failure stays visible while a late result cannot publish a frame',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.fail(failure);
 f.client.requests[0].resolve(result(f.client.requests[0].revision));await settled(()=>f.host.read().ignored>0);
 assert.equal(f.host.read().status,'failed');assert.match(f.host.read().error,/Controlled Worker failure sentinel/);
 assert.equal(f.shown.length,0);assert.equal(f.client.requests.length,1);assert.equal(f.client.restarted,0);
});
test('current native FriendlyError refusal is readable instead of object string coercion',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);const request=f.client.requests[0];
 request.resolve({ok:false,revision:request.revision,wallTime:0,error:{title:'Current model refused',hint:'Fix this declaration.',detail:'Controlled refusal detail'}});
 await settled(()=>f.host.read().status==='failed');
 assert.match(f.host.read().error,/Current model refused/);assert.match(f.host.read().error,/Fix this declaration/);assert.match(f.host.read().error,/Controlled refusal detail/);
 assert.doesNotMatch(f.host.read().error,/\[object Object\]/);assert.equal(f.shown.length,0);
});
test('current per-submit Error rejection retains its message',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.requests[0].reject(new Error('Current submission rejected'));
 await settled(()=>f.host.read().status==='failed');assert.match(f.host.read().error,/Current submission rejected/);assert.equal(f.shown.length,0);
});
test('a current compiler error retains precedence over an older Worker failure',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.fail(failure);f.host.invalid(new Error('Current declaration invalid'));
 assert.equal(f.host.read().status,'failed');assert.equal(f.host.read().error,'Current declaration invalid');
 f.client.requests[0].resolve(result(f.client.requests[0].revision));await settled(()=>f.host.read().ignored>0);
 assert.equal(f.host.read().error,'Current declaration invalid');assert.equal(f.shown.length,0);
});
test('explicit caller restart plus identical complete checkpoint recovers without replacing the host or compiled identity',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.requests[0].resolve(result(f.client.requests[0].revision));await settled(()=>f.host.read().status==='ready');
 const before=f.host.read(),host=f.host;f.client.fail(failure);
 assert.equal(f.client.restart(),true);f.host.dirty();f.host.complete(f.compiled);
 assert.equal(f.host,host);assert.equal(f.client.requests.length,2);assert.equal(f.host.read().status,'pending');assert.equal(f.host.read().error,null);
 const request=f.client.requests[1];request.resolve(result(request.revision));await settled(()=>f.host.read().status==='ready');
 assert.equal(f.host.read().documentJSON,before.documentJSON);assert.equal(f.host.read().fingerprint,before.fingerprint);
 assert.equal(f.client.restarted,1);assert.equal(f.shown.length,2);
});
test('disposal removes the failure subscription and captured old callbacks cannot revive the host',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);const notify=[...f.client.failures][0];f.host.dispose();
 assert.equal(f.client.failures.size,0);notify(failure);f.client.requests[0].resolve(result(f.client.requests[0].revision));
 await settled(()=>f.host.read().ignored>0);assert.equal(f.host.read().status,'disposed');assert.equal(f.shown.length,0);assert.equal(f.client.restarted,0);
});

test('an empty current Error message still reports failed with a readable fallback',async t=>{
 const f=await rig(t);f.host.complete(f.compiled);f.client.requests[0].reject(new Error(''));
 await settled(()=>f.host.read().status==='failed');assert.equal(f.host.read().status,'failed');assert.equal(f.host.read().error,'Error');
});
