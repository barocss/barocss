/** Emitted private device-loss/Canvas graph with structural handles; no adapter or pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { observeEngineWebGPUDeviceLoss } from '../dist/engine-webgpu-device-loss.js';
import { EngineWebGPUWaitBudget } from '../dist/engine-webgpu-wait-budget.js';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';

// The parent registers this module before exporting its shared fixture.
async function fixture(options={},failure='') {
  const {harness,original,deferred}=await import('./engine-webgpu-canvas-once.test.mjs');
  const h=harness(failure,options),source=original();
  return {h,source,deferred,render:()=>renderEngineWebGPUCanvasOnce(h.device,h.context,source,64,64,'rgba8unorm')};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const refusal=promise=>promise.then(
  ()=>({refused:false}),cause=>({refused:true,cause}));
const lossInfo=()=>({reason:'destroyed',message:'controlled borrowed device loss'});
function lossError(cause,info) {
  return cause instanceof Error && cause.name==='EngineWebGPUDeviceLostError' && cause.cause===info;
}
function released(h,buffers=5,textures=2,configured=1,pops=6) {
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyBuffer:')).length,buffers);
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyTexture:')).length,textures);
  assert.equal(h.events.filter(x=>x==='unconfigure').length,configured);
  assert.equal(h.events.filter(x=>x==='pop').length,pops);
  assert.deepEqual(h.scopes,[]);
}
function subscriptionCount(promise) {
  let count=0;const nativeThen=promise.then;
  promise.then=function(...args){count++;return nativeThen.apply(this,args);};
  return ()=>count;
}
async function withoutUnhandled(operation) {
  const unhandled=[],listener=cause=>unhandled.push(cause);
  process.on('unhandledRejection',listener);
  try { await operation();await flush();assert.deepEqual(unhandled,[]); }
  finally { process.off('unhandledRejection',listener); }
}

for(const [stage,key,started,buffers,textures,configured,pops]of[
  ['compilation','compilation','compilationStarted',0,0,0,3],
  ['pipeline','pipeline','pipelineStarted',0,0,0,3],
  ['offscreen queue','renderCompletion','renderQueueStarted',5,2,0,3],
  ['offscreen scope','offscreenPopGate','offscreenPopStarted',5,2,0,3],
  ['presentation queue','completion','queueStarted',5,2,1,6],
  ['presentation scope','presentPopGate','presentPopStarted',5,2,1,6],
])for(const late of ['resolve','reject'])test(`${stage} loss retires owners; late ${late} cannot resume GPU commands`,async()=>{
  const {h,source,deferred,render}=await fixture(),gate=deferred(),signal=deferred();
  h.options[key]=gate;h.options[started]=signal;
  const snapshot=structuredClone(source),info=lossInfo();
  await withoutUnhandled(async()=>{
    const result=refusal(render());
    await (started==='queueStarted'?h.queueStarted.promise:signal.promise);
    h.loss.resolve(info);
    const settled=await result;assert.equal(settled.refused,true);assert.ok(lossError(settled.cause,info));
    released(h,buffers,textures,configured,pops);assert.deepEqual(source,snapshot);
    const before=h.events.length;
    if(late==='resolve')gate.resolve({});else gate.reject(new Error('late native refusal'));
    await flush();
    // Submitted native work can finish after loss; that event does not resume a GPU stage.
    const driverCompletion=late==='resolve'&&(key==='renderCompletion'||key==='completion');
    assert.deepEqual(h.events.slice(before),driverCompletion?['completed']:[]);
    const retry=await refusal(render());assert.equal(retry.refused,true);assert.equal(retry.cause,settled.cause);
    assert.equal(h.events.length,before+(driverCompletion?1:0),'The context claim is retired before terminal refusal');
  });
});

test('ready held lease loss releases frame, configuration and claim; historical counters and double dispose remain valid',async()=>{
  const {h,render}=await fixture(),lease=await render(),info=lossInfo();
  assert.equal(lease.drawCount,2);assert.equal(lease.geometryCount,1);
  h.loss.resolve(info);await flush();released(h);
  assert.equal(lease.drawCount,2);assert.equal(lease.geometryCount,1);
  const retry=await refusal(render());assert.equal(retry.refused,true);assert.ok(lossError(retry.cause,info));
  released(h);
  // A healthy borrowed device can claim this context before explicit disposal of the lost lease.
  const healthy=await fixture();
  const next=await renderEngineWebGPUCanvasOnce(healthy.h.device,h.context,healthy.source,64,64,'rgba8unorm');
  next.dispose();const before=h.events.slice();lease.dispose();lease.dispose();
  assert.deepEqual(h.events,before);released(h,5,2,2,6);
});

test('held lease loss retains asynchronous cleanup refusal for the next dispose once',async()=>{
  const cleanupCause=new Error('controlled unconfigure refusal');
  const {h,render}=await fixture({unconfigureError:cleanupCause}),lease=await render();
  await withoutUnhandled(async()=>{h.loss.resolve(lossInfo());await flush();});
  released(h);
  assert.throws(()=>lease.dispose(),cause=>cause instanceof AggregateError&&
    cause.errors.length===1&&cause.errors[0]===cleanupCause);
  lease.dispose();lease.dispose();released(h);
  const retry=await refusal(render());assert.equal(retry.refused,true);
  assert.equal(retry.cause?.name,'EngineWebGPUDeviceLostError');
});

for(const disposition of ['dispose','failure'])test(`ordinary ${disposition} retires the Canvas callback before later native loss`,async()=>{
  const {h,render}=await fixture({},disposition==='failure'?'shader':'');
  let lease;
  if(disposition==='dispose'){lease=await render();lease.dispose();released(h);}
  else{const result=await refusal(render());assert.equal(result.refused,true);assert.equal(result.cause,h.error);released(h,0,0,0,3);}
  const before=h.events.slice();
  await withoutUnhandled(async()=>{h.loss.resolve(lossInfo());await flush();});
  assert.deepEqual(h.events,before);lease?.dispose();assert.deepEqual(h.events,before);
});

test('repeated operations on one borrowed device install exactly one native loss observer',async()=>{
  const {h,render}=await fixture(),count=subscriptionCount(h.loss.promise);
  const first=await render();first.dispose();
  const second=await render();second.dispose();
  assert.equal(count(),1);released(h,10,4,2,12);
  const before=h.events.slice();h.loss.resolve(lossInfo());await flush();
  assert.deepEqual(h.events,before);assert.equal(count(),1);
});

test('fulfilled loss shares one bounded terminal Error, retires callbacks and contains callback throws',async()=>{
  const {h}=await fixture(),count=subscriptionCount(h.loss.promise),received=[],detached=[];
  const detach=observeEngineWebGPUDeviceLoss(h.device,cause=>detached.push(cause));detach();detach();
  observeEngineWebGPUDeviceLoss(h.device,cause=>{received.push(cause);throw new Error('observer refused');});
  observeEngineWebGPUDeviceLoss(h.device,cause=>received.push(cause));
  const info={reason:'destroyed',message:'x'.repeat(10000)};
  await withoutUnhandled(async()=>{h.loss.resolve(info);await flush();});
  assert.equal(count(),1);assert.deepEqual(detached,[]);assert.equal(received.length,2);
  assert.equal(received[0],received[1]);assert.ok(lossError(received[0],info));
  assert.ok(received[0].message.length<1024,'Loss message remains bounded');
  let terminalCalled=false;
  const unsubscribe=observeEngineWebGPUDeviceLoss(h.device,cause=>{
    terminalCalled=true;assert.equal(cause,received[0]);
  });
  assert.equal(terminalCalled,true);unsubscribe();unsubscribe();assert.equal(count(),1);
});

for(const kind of ['raw','undefined'])test(`rejected native loss preserves ${kind} reason for current and terminal observers`,async()=>{
  const {h}=await fixture(),reason=kind==='raw'?{native:'exact rejection'}:undefined,received=[];
  observeEngineWebGPUDeviceLoss(h.device,cause=>received.push(cause));
  observeEngineWebGPUDeviceLoss(h.device,cause=>received.push(cause));
  await withoutUnhandled(async()=>{h.loss.reject(reason);await flush();});
  assert.equal(received.length,2);assert.equal(received[0],reason);assert.equal(received[1],reason);
  let terminalCalled=false;
  observeEngineWebGPUDeviceLoss(h.device,cause=>{terminalCalled=true;assert.equal(cause,reason);});
  assert.equal(terminalCalled,true);
});

for(const kind of ['fulfilled','raw','undefined'])test(`already ${kind} native loss refuses Canvas before graphics and preserves the original source`,async()=>{
  const {h,source,render}=await fixture(),snapshot=structuredClone(source);
  const cause=kind==='fulfilled'?lossInfo():kind==='raw'?{native:'already refused'}:undefined;
  await withoutUnhandled(async()=>{
    if(kind==='fulfilled')h.loss.resolve(cause);else h.loss.reject(cause);
    const result=await refusal(render());assert.equal(result.refused,true);
    if(kind==='fulfilled')assert.ok(lossError(result.cause,cause));else assert.equal(result.cause,cause);
    assert.deepEqual(h.events,[]);assert.deepEqual(source,snapshot);
    const again=await refusal(render());assert.equal(again.refused,true);assert.equal(again.cause,result.cause);
    assert.deepEqual(h.events,[]);
  });
});

for(const kind of ['raw','undefined'])test(`in-flight Canvas cancellation preserves rejected native ${kind} loss and observes late shader rejection`,async()=>{
  const {h,deferred,render}=await fixture(),gate=deferred(),started=deferred();
  h.options.compilation=gate;h.options.compilationStarted=started;
  const cause=kind==='raw'?{native:'in-flight refusal'}:undefined;
  await withoutUnhandled(async()=>{
    const result=refusal(render());await started.promise;h.loss.reject(cause);
    const settled=await result;assert.equal(settled.refused,true);assert.equal(settled.cause,cause);
    released(h,0,0,0,3);const before=h.events.slice();
    gate.reject(new Error('late shader refusal'));await flush();assert.deepEqual(h.events,before);
  });
});

function clock(t) {
  const live=new Set();t.mock.timers.enable({apis:['setTimeout']});
  const set=globalThis.setTimeout,clear=globalThis.clearTimeout;
  t.mock.method(globalThis,'setTimeout',(callback,ms)=>{
    const id=set(()=>{live.delete(id);callback();},ms);live.add(id);return id;
  });
  t.mock.method(globalThis,'clearTimeout',id=>{live.delete(id);clear(id);});
  return {live,tick:ms=>t.mock.timers.tick(ms)};
}
for(const kind of ['raw','undefined'])test(`private budget ${kind} cancellation retires every timer and keeps first refusal`,async t=>{
  const c=clock(t),{deferred}=await fixture(),first=deferred(),second=deferred(),budget=new EngineWebGPUWaitBudget();
  const reason=kind==='raw'?{native:'first cancellation'}:undefined;
  const a=refusal(budget.wait(first.promise,'first')),b=refusal(budget.wait(second.promise,'second'));
  assert.equal(c.live.size,2);budget.cancel(reason);budget.cancel(new Error('second cancellation'));
  assert.equal(c.live.size,0);
  for(const result of await Promise.all([a,b])){assert.equal(result.refused,true);assert.equal(result.cause,reason);}
  let refused=false;
  try{budget.check('later stage');}catch(cause){refused=true;assert.equal(cause,reason);}
  assert.equal(refused,true);
  await withoutUnhandled(async()=>{
    first.reject(new Error('late first refusal'));second.resolve('late second result');
    const result=await refusal(budget.wait(Promise.reject(new Error('late third refusal')),'third'));
    assert.equal(result.refused,true);assert.equal(result.cause,reason);
  });
  assert.equal(c.live.size,0);
});
test('private budget timeout remains the first refusal after subsequent cancellation',async t=>{
  const c=clock(t),{deferred}=await fixture(),gate=deferred(),budget=new EngineWebGPUWaitBudget();
  const result=refusal(budget.wait(gate.promise,'deadline'));c.tick(10000);
  const settled=await result;assert.equal(settled.refused,true);assert.equal(settled.cause?.name,'EngineWebGPUTimeoutError');
  budget.cancel({native:'later cancellation'});
  assert.throws(()=>budget.check('after timeout'),cause=>cause===settled.cause);
  gate.resolve('late completion');await flush();assert.equal(c.live.size,0);
});
