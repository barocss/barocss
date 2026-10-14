/** Actual emitted waits/Canvas pipeline with controlled application clock; not real GPU time. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { EngineWebGPUWaitBudget } from '../dist/engine-webgpu-wait-budget.js';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';

function clock(t) {
  let now=0;const live=new Set();
  t.mock.method(performance,'now',()=>now);
  t.mock.timers.enable({apis:['setTimeout']});
  const set=globalThis.setTimeout,clear=globalThis.clearTimeout;
  t.mock.method(globalThis,'setTimeout',(callback,ms)=>{
    const id=set(()=>{live.delete(id);callback();},ms);live.add(id);return id;
  });
  t.mock.method(globalThis,'clearTimeout',id=>{live.delete(id);clear(id);});
  return {live,advance(ms){now+=ms;t.mock.timers.tick(ms);},elapse(ms){now+=ms;}};
}
function deferred() {
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return{promise,resolve,reject};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const timeout=error=>error?.name==='EngineWebGPUTimeoutError'&&error.message.includes('10s');
async function fixture(options={}) {
  const {harness,original}=await import('./engine-webgpu-canvas-once.test.mjs');
  const h=harness('',options);
  return {h,render:()=>renderEngineWebGPUCanvasOnce(h.device,h.context,original(),64,64,'rgba8unorm')};
}
test('successful and rejected waits clear timers and preserve ordinary rejection identity',async t=>{
  const c=clock(t),budget=new EngineWebGPUWaitBudget();
  assert.equal(await budget.wait(Promise.resolve('ready'),'success'),'ready');assert.equal(c.live.size,0);
  const cause={original:true};await assert.rejects(budget.wait(Promise.reject(cause),'ordinary'),error=>error===cause);
  assert.equal(c.live.size,0);
  let refused=false;try{await budget.wait(Promise.reject(undefined),'undefined');}catch(error){refused=true;assert.equal(error,undefined);}
  assert.equal(refused,true);assert.equal(c.live.size,0);
});
test('late settlement checks monotonic deadline even before the timer callback is scheduled',async t=>{
  const c=clock(t),d=deferred(),budget=new EngineWebGPUWaitBudget();
  const pending=budget.wait(d.promise,'delayed scheduling');const rejected=assert.rejects(pending,timeout);
  c.elapse(10000);d.resolve('too late');await rejected;assert.equal(c.live.size,0);
});
test('all stage waits share one operation deadline instead of granting another ten seconds',async t=>{
  const c=clock(t),budget=new EngineWebGPUWaitBudget(),first=deferred();
  const ready=budget.wait(first.promise,'first');c.advance(9000);first.resolve('first');await ready;
  const second=deferred(),pending=budget.wait(second.promise,'second'),rejected=assert.rejects(pending,timeout);
  c.advance(999);assert.equal(c.live.size,1);c.advance(1);await rejected;
  second.reject(new Error('late ignored'));await flush();assert.equal(c.live.size,0);
});

for(const [stage,key,started,buffers,textures,configured,pops]of[
  ['compilation','compilation','compilationStarted',0,0,false,3],
  ['pipeline','pipeline','pipelineStarted',0,0,false,3],
  ['offscreen queue','renderCompletion','renderQueueStarted',5,2,false,3],
  ['offscreen scope','offscreenPopGate','offscreenPopStarted',5,2,false,3],
  ['presentation queue','completion','queueStarted',5,2,true,6],
  ['presentation scope','presentPopGate','presentPopStarted',5,2,true,6],
])for(const late of ['resolve','reject'])test(`${stage} deadline retires owners; late ${late} cannot resume GPU work`,async t=>{
  const c=clock(t),gate=deferred(),signal=deferred(),options={[key]:gate,[started]:signal};
  const {h,render}=await fixture(options),unhandled=[];
  const onUnhandled=reason=>unhandled.push(reason);process.on('unhandledRejection',onUnhandled);
  try{
    const pending=render(),rejected=assert.rejects(pending,timeout);
    const stageSignal=started==='queueStarted'?h.queueStarted.promise:signal.promise;
    await stageSignal;c.advance(10000);await rejected;
    assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyBuffer:')).length,buffers);
    assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyTexture:')).length,textures);
    assert.equal(h.events.includes('unconfigure'),configured);
    assert.equal(h.events.filter(x=>x==='pop').length,pops);assert.deepEqual(h.scopes,[]);
    assert.equal(c.live.size,0);
    const before=h.events.length;
    if(late==='resolve')gate.resolve({});else gate.reject(new Error('late native refusal'));
    await flush();
    // Native work may complete after expiry. That is not a resumed application GPU stage.
    const lateEvents=h.events.slice(before);
    const driverCompletion=late==='resolve'&&(key==='renderCompletion'||key==='completion');
    assert.deepEqual(lateEvents,driverCompletion?['completed']:[],'No new GPU commands follow expiry');
    assert.deepEqual(unhandled,[]);
    delete h.options[key];
    const lease=await render();lease.dispose();assert.deepEqual(h.scopes,[]);assert.equal(c.live.size,0);
  }finally{process.off('unhandledRejection',onUnhandled);}
});

test('Canvas shares elapsed compilation time with its later presentation deadline',async t=>{
  const c=clock(t),compilation=deferred(),compilationStarted=deferred(),completion=deferred();
  const {h,render}=await fixture({compilation,compilationStarted,completion});
  const pending=render(),rejected=assert.rejects(pending,timeout);
  await compilationStarted.promise;c.advance(6000);compilation.resolve({});await h.queueStarted.promise;
  c.advance(3999);assert.equal(h.events.includes('unconfigure'),false);
  c.advance(1);await rejected;assert.equal(h.events.includes('unconfigure'),true);
  assert.equal(h.events.filter(x=>x==='pop').length,6);completion.resolve({});await flush();assert.equal(c.live.size,0);
});
