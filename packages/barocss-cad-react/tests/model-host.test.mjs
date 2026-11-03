/** Existing document reader + controlled engine/sink. No native/GPU execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
function engine(){const requests=[],failures=new Set(),masses=new Set();return {
 requests,failures,masses,disposed:0,evaluate(doc,revision){return new Promise(resolve=>requests.push({doc,revision,resolve}));},restart(){return true;},dispose(){this.disposed++;},onFailure(fn){failures.add(fn);return()=>failures.delete(fn);},onMasses(fn){masses.add(fn);return()=>masses.delete(fn);}
};}
const model=width=>({kind:'part',units:'mm',children:[{kind:'extrude',key:'solid',distance:6,children:[{kind:'rectangle',key:'profile',min:[0,0],max:[width,60]}]}]});
const result=revision=>({ok:true,revision,wallTime:0,bodies:[{key:'b1',volume:1,mass:1,mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array(),bounds:{min:[0,0,0],max:[1,1,1]}}}]});
async function settled(predicate){for(let i=0;i<30;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('controlled host did not settle');}
test('constructor acquires no client subscription; connect and owned/borrowed cleanup are explicit',async t=>{
 const {ModelHost}=await loadSource(t,'tests/model-host-entry.ts'),client=engine();let sinkDisposed=0;
 const sink={show:async()=>{},snapshot:()=>({}),dispose(){sinkDisposed++;}},massPolicy={merge:b=>b};
 const host=new ModelHost({engine:client,ownership:'borrowed',sink,ownsSink:false,massPolicy});assert.equal(client.failures.size,0);host.connect();assert.equal(client.failures.size,1);host.dispose();host.dispose();assert.equal(client.disposed,0);assert.equal(sinkDisposed,0);assert.equal(client.failures.size,0);
 const owned=new ModelHost({engine:client,ownership:'owned',sink,ownsSink:true,massPolicy});owned.connect();owned.dispose();assert.equal(client.disposed,1);assert.equal(sinkDisposed,1);
});
test('props compile checkpoints dedupe and current native owner is separate from Viewer frame readiness',async t=>{
 const {ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),client=engine(),shown=[];
 const sink={show:async(b,owner,current)=>{assert.equal(current(),true);shown.push(owner);},snapshot:()=>({}),dispose(){}},host=new ModelHost({engine:client,ownership:'borrowed',sink,ownsSink:false,massPolicy:{merge:b=>b}});t.after(()=>host.dispose());host.connect();const compiler=new CompositionCompiler(),compiled=compiler.compile(model(80)).value;
 host.dirty();host.complete(compiled);assert.equal(client.requests.length,1);client.requests[0].resolve(result(1));await settled(()=>host.read().status==='ready');assert.equal(shown.length,1);assert.equal(host.read().adapter.freshPresentation,false);assert.equal(host.read().nativeOwner,host.read().renderedOwner);
 host.dirty();assert.equal(host.read().native,null);host.complete(compiled);assert.equal(client.requests.length,1);assert.equal(host.read().status,'ready');
});
test('a latest invalid declaration prevents an older result from reaching the Viewer sink',async t=>{
 const {ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),client=engine(),shown=[];
 const host=new ModelHost({engine:client,ownership:'borrowed',sink:{show:async(...x)=>shown.push(x),snapshot:()=>({}),dispose(){}},ownsSink:false,massPolicy:{merge:b=>b}});t.after(()=>host.dispose());host.connect();host.complete(new CompositionCompiler().compile(model(80)).value);host.dirty();host.invalid(new Error('current graph invalid'));client.requests[0].resolve(result(1));await settled(()=>host.read().ignored>0);assert.equal(shown.length,0);assert.equal(host.read().status,'failed');assert.equal(host.read().native,null);
});
test('consumer startup failure immediately releases its new Viewer sink before unmount',async t=>{
 const {connectHost}=await loadSource(t,'examples/connect-host.ts'),client=engine(),primary=new Error('controlled startup connection failure');let sinkDisposed=0;
 client.onMasses=()=>{throw primary;};const sink={show:async()=>{},snapshot:()=>({}),dispose(){sinkDisposed++;}};
 assert.throws(()=>connectHost(client,{merge:b=>b},sink),error=>error===primary);assert.equal(sinkDisposed,1);assert.equal(client.failures.size,0);assert.equal(client.disposed,0,'borrowed client remains caller owned');
});
