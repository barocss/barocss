/** Controlled replies prove ownership and cleanup, not Worker/native geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const doc={format:'barocss-cad-model',schema:3,units:'mm',parameters:{},nodes:[],outputs:{},nextId:0};
function port(){const pending=[],failures=new Set(),masses=new Set();let disposed=0,restarted=0;return {
 pending,failures,masses,get disposed(){return disposed;},get restarted(){return restarted;},
 evaluate(d,revision){return new Promise(resolve=>pending.push({d,revision,resolve}));},restart(){restarted++;return true;},dispose(){disposed++;},
 onFailure(fn){failures.add(fn);return()=>failures.delete(fn);},onMasses(fn){masses.add(fn);return()=>masses.delete(fn);}
};}
const input=fingerprint=>({doc,fingerprint,admission:'supported-synchronous-model'});
// One controlled displayable output satisfies the existing bounded single-output contract. No native physics claim.
const success=revision=>({ok:true,revision,bodies:[{key:'b1',volume:1,mass:1,mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array(),bounds:{min:[0,0,0],max:[1,1,1]}}}],wallTime:0});
test('latest invalidation retires an older evaluation even when no replacement request is sent',async t=>{
 const {EngineAdapter}=await loadSource(t,'src/adapter.ts'),engine=port(),adapter=new EngineAdapter({engine,ownership:'borrowed'});adapter.connect();t.after(()=>adapter.dispose());
 const first=adapter.submit(input('a'));adapter.invalid(new Error('latest graph invalid'));assert.equal((await first).kind,'stale');engine.pending[0].resolve(success(1));await Promise.resolve();assert.equal(adapter.state.freshNative,false);assert.equal(adapter.state.phase,'invalid');
});
test('newest request wins; matching revision still needs the current declaration owner',async t=>{
 const {EngineAdapter}=await loadSource(t,'src/adapter.ts'),engine=port(),adapter=new EngineAdapter({engine,ownership:'borrowed'});adapter.connect();t.after(()=>adapter.dispose());
 const first=adapter.submit(input('a')),second=adapter.submit(input('b'));engine.pending[1].resolve(success(2));const outcome=await second;assert.equal(outcome.kind,'accepted',outcome.error?.message);engine.pending[0].resolve(success(1));assert.equal((await first).kind,'stale');assert.equal(adapter.state.desired.fingerprint,'b');assert.equal(adapter.state.freshNative,true);assert.equal(adapter.state.freshPresentation,false);
});
test('borrowed disposal releases subscriptions and retires work without terminating caller engine',async t=>{
 const {EngineAdapter}=await loadSource(t,'src/adapter.ts'),engine=port(),adapter=new EngineAdapter({engine,ownership:'borrowed'});assert.equal(engine.failures.size,0);adapter.connect();assert.equal(engine.failures.size,1);
 const job=adapter.submit(input('a'));adapter.dispose();assert.equal((await job).kind,'stale');assert.equal(engine.disposed,0);assert.equal(engine.failures.size,0);assert.equal(engine.masses.size,0);adapter.dispose();
});
test('owned disposal happens once and worker failure invalidates native freshness',async t=>{
 const {EngineAdapter}=await loadSource(t,'src/adapter.ts'),engine=port(),adapter=new EngineAdapter({engine,ownership:'owned'});adapter.connect();const job=adapter.submit(input('a'));engine.pending[0].resolve(success(1));const outcome=await job;assert.equal(outcome.kind,'accepted',outcome.error?.message);assert.equal(adapter.state.freshNative,true);
 for(const fail of engine.failures)fail({title:'lost',hint:'restart',detail:'controlled failure'});assert.equal(adapter.state.phase,'failed');assert.equal(adapter.state.freshNative,false);adapter.dispose();adapter.dispose();assert.equal(engine.disposed,1);
});
test('connection rollback preserves registration failure when an unsubscribe also throws',async t=>{
 const {EngineAdapter}=await loadSource(t,'src/adapter.ts'),engine=port(),primary=new Error('controlled mass registration failure');let attempted=0;
 engine.onFailure=()=>()=>{attempted++;throw new Error('controlled rollback failure');};engine.onMasses=()=>{throw primary;};
 const adapter=new EngineAdapter({engine,ownership:'borrowed'});assert.throws(()=>adapter.connect(),error=>error===primary);assert.equal(attempted,1);adapter.dispose();assert.equal(attempted,1,'failed connection drains registered cleanup once');assert.equal(engine.disposed,0);
});
