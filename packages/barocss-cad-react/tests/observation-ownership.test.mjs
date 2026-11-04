/** Actual hosts with controlled EnginePort/Viewer. Caller mutation tests are not an organic native-consumer bug claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const declaration=width=>({kind:'part',units:'mm',children:[{kind:'extrude',key:'solid',distance:30,children:[{kind:'rectangle',key:'profile',min:[0,0],max:[width,20]}]}]});
const result=revision=>({ok:true,revision,wallTime:0,bodies:[{key:'b1',volume:6000,mass:16.2,centroid:[5,10,15],mesh:{positions:new Float64Array([0,0,0,10,0,0,0,20,0]),normals:new Float32Array([0,0,1,0,0,1,0,0,1]),indices:new Uint32Array([0,1,2]),bounds:{min:[0,0,0],max:[10,20,30]}}}]});
async function settled(predicate){for(let i=0;i<30;i++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}assert.fail('controlled host did not settle');}
async function rig(t,snapshot=()=>({controlledSink:true})){
 const{ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),requests=[],failures=new Set(),shown=[];
 const engine={evaluate(doc,revision){return new Promise(resolve=>requests.push({doc,revision,resolve}));},restart(){return true;},dispose(){},onFailure(fn){failures.add(fn);return()=>failures.delete(fn);},onMasses(){return()=>{};}};
 const host=new ModelHost({engine,ownership:'borrowed',sink:{show:async(bodies,owner,current)=>{if(current())shown.push(owner);},snapshot,dispose(){}},ownsSink:false,massPolicy:{merge:b=>b}});
 t.after(()=>host.dispose());host.connect();const compiler=new CompositionCompiler();host.complete(compiler.compile(declaration(10)).value);
 const answer=result(requests[0].revision);requests[0].resolve(answer);await settled(()=>host.read().status==='ready');
 return{host,requests,failures,shown,answer,compiler};
}
test('currentDocument is a detached nested copy and cannot mutate later JSON, fingerprint or submitted engine input',async t=>{
 const f=await rig(t),before=f.host.read(),doc=structuredClone(before.currentDocument),submitted=structuredClone(f.requests[0].doc);
 const observed=f.host.read();observed.currentDocument.nodes[0].max[0]=999;observed.currentDocument.parameters.callerValue=17;
 observed.currentDocument.outputs.extra={node:0,side:'solid'};observed.currentDocument.nodes.push({...observed.currentDocument.nodes[0]});
 const after=f.host.read();assert.deepEqual(after.currentDocument,doc);assert.equal(after.documentJSON,before.documentJSON);
 assert.equal(after.fingerprint,before.fingerprint);assert.deepEqual(f.requests[0].doc,submitted);assert.equal(after.status,'ready');
});
test('submitted array mutation cannot add or remove owned request records',async t=>{
 const f=await rig(t),before=structuredClone(f.host.read().submitted),observed=f.host.read();
 observed.submitted.splice(0,1);observed.submitted.push({fingerprint:'caller',revision:-1});
 assert.deepEqual(f.host.read().submitted,before);assert.equal(f.requests.length,1);
});
test('submitted entries are detached as well as their containing array',async t=>{
 const f=await rig(t),before=structuredClone(f.host.read().submitted),observed=f.host.read();
 observed.submitted[0].fingerprint='caller changed';observed.submitted[0].revision=-1;
 assert.deepEqual(f.host.read().submitted,before);assert.equal(f.host.read().status,'ready');
});
for(const field of ['centroid','bounds min','bounds max']){
 test(`native ${field} observation cannot mutate the owned body or later diagnostics`,async t=>{
  const f=await rig(t),before=structuredClone(f.host.read().native),body=structuredClone(f.answer.bodies[0]),observed=f.host.read();
  if(field==='centroid')observed.native.centroid[0]=999;
  else observed.native.bounds[field==='bounds min'?'min':'max'][0]=999;
  assert.deepEqual(f.host.read().native,before);assert.deepEqual(f.answer.bodies[0],body);assert.equal(f.host.read().status,'ready');
 });
}
test('adapter outer observation mutation cannot change host status, error, owner or freshness',async t=>{
 const f=await rig(t),before=f.host.read(),observed=f.host.read();
 observed.adapter.phase='failed';observed.adapter.error=new Error('Caller only');observed.adapter.desired=null;observed.adapter.freshNative=false;
 const after=f.host.read();assert.equal(after.status,'ready');assert.equal(after.error,null);assert.equal(after.adapter.phase,before.adapter.phase);
 assert.equal(after.adapter.desired,before.adapter.desired);assert.equal(after.adapter.freshNative,true);assert.equal(after.nativeOwner,before.nativeOwner);
});
test('frozen Owner identities remain shared across reads and continue to guard stale/current completions',async t=>{
 const f=await rig(t),before=f.host.read(),again=f.host.read(),owner=before.nativeOwner;
 assert.equal(Object.isFrozen(owner),true);assert.equal(again.nativeOwner,owner);assert.equal(again.renderedOwner,owner);assert.equal(again.adapter.desired,owner);
 assert.throws(()=>{owner.fingerprint='caller changed';},TypeError);
 f.host.dirty();assert.equal(f.host.read().status,'pending');assert.equal(f.host.read().native,null);
 f.host.complete(f.compiler.compile(declaration(12)).value);const pending=f.requests[1];
 f.host.dirty();f.host.invalid(new Error('New declaration invalid'));pending.resolve(result(pending.revision));await settled(()=>f.host.read().ignored>0);
 assert.equal(f.host.read().status,'failed');assert.equal(f.shown.length,1);assert.equal(f.host.read().renderedOwner,owner);
});
test('uncloneable custom sink observations and adapter error payloads retain their declared extension identity',async t=>{
 const callback=()=>42,extension={callback,weak:new WeakMap()},f=await rig(t,()=>extension);
 const failure={title:'Extension failure',hint:'Keep the error payload',detail:'Controlled event',callback};
 for(const notify of f.failures)notify(failure);
 const observed=f.host.read();assert.equal(observed.status,'failed');assert.match(observed.error,/Extension failure/);
 assert.equal(observed.viewer,extension);assert.equal(observed.viewer.callback(),42);assert.equal(observed.adapter.error,failure);
 assert.equal(f.host.read().viewer,extension);assert.equal(f.host.read().adapter.error,failure);
});
function viewer(){
 const loads=[],pending=[];return{loads,pending,attachPointerControls(){return{dispose(){}};},attachKeyboardControls(){return{dispose(){}};},
 loadDisplayMeshes(input){loads.push(input);},readPixels(){return new Promise(resolve=>pending.push(resolve));},
 getState(){return{status:'ready',camera:{controlled:true},displayMeshes:loads.at(-1)};},dispose(){}};
}
const displayBody={key:'b1',mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array()}};
const owner=revision=>Object.freeze({hostEpoch:1,declaration:revision,evaluationRevision:revision,fingerprint:String(revision)});
test('ExistingViewerHost returns detached pixel diagnostics while preserving mounted/frame Owner identity',async t=>{
 const{ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer(),sink=new ExistingViewerHost(v),current=owner(1);
 t.after(()=>sink.dispose());const work=sink.show([displayBody],current,()=>true);v.pending[0](new Uint8Array([0,0,0,255,200,200,200,255]));await work;
 const before=structuredClone(sink.snapshot().pixels),observed=sink.snapshot();
 observed.pixels.bytes=-1;observed.pixels.nonBackgroundPixels=-1;observed.pixels.sha256='caller changed';
 const after=sink.snapshot();assert.deepEqual(after.pixels,before);assert.equal(after.mountedOwner,current);assert.equal(after.frameOwner,current);
});
test('Viewer observation copies preserve current=== and stale-frame ownership rather than cloning Owner tokens',async t=>{
 const{ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer(),sink=new ExistingViewerHost(v),a=owner(1),b=owner(2);let current=a;
 t.after(()=>sink.dispose());const old=sink.show([displayBody],a,()=>current===a);current=b;const fresh=sink.show([displayBody],b,()=>current===b);
 v.pending[0](new Uint8Array([0,0,0,255]));await old;assert.equal(sink.snapshot().frameOwner,null);assert.equal(sink.snapshot().mountedOwner,b);
 v.pending[1](new Uint8Array([0,0,0,255,200,200,200,255]));await fresh;assert.equal(sink.snapshot().frameOwner,b);
 assert.equal(sink.snapshot().frameOwner,sink.snapshot().mountedOwner);
});

test('an older read keeps its detached request history and document across a later completed declaration',async t=>{
 const f=await rig(t),old=f.host.read(),saved={submitted:structuredClone(f.host.read().submitted),doc:structuredClone(f.host.read().currentDocument),native:structuredClone(f.host.read().native)};
 f.host.complete(f.compiler.compile(declaration(12)).value);const request=f.requests[1];request.resolve(result(request.revision));await settled(()=>f.host.read().status==='ready');
 assert.equal(f.host.read().submitted.length,2);assert.deepEqual(old.submitted,saved.submitted);
 assert.deepEqual(old.currentDocument,saved.doc);assert.deepEqual(old.native,saved.native);assert.equal(old.status,'ready');
});
test('ViewerHost preserves a caller-provided mutable Owner identity without freezing or copying it',async t=>{
 const{ExistingViewerHost}=await loadSource(t,'src/viewer.ts',{stubViewer:true}),v=viewer(),sink=new ExistingViewerHost(v),caller={...owner(1)};
 t.after(()=>sink.dispose());const work=sink.show([displayBody],caller,()=>true);v.pending[0](new Uint8Array([0,0,0,255]));await work;
 assert.equal(Object.isFrozen(caller),false);assert.equal(sink.snapshot().mountedOwner,caller);assert.equal(sink.snapshot().frameOwner,caller);
 caller.fingerprint='caller-owned token';assert.equal(sink.snapshot().frameOwner,caller);assert.equal(sink.snapshot().frameOwner.fingerprint,'caller-owned token');
});
