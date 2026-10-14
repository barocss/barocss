/** Registered emitted presentation-scope regression; no adapter or retained-pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';
import { presentCheckedEngineWebGPUColor } from '../dist/engine-webgpu-checked-present.js';

// Loaded after the registered parent module finishes; reuse its actual structural fixture.
async function fixture(options={},failure='') {
  const {harness,original,deferred}=await import('./engine-webgpu-canvas-once.test.mjs');
  return {h:harness(failure,options),original,deferred};
}
const render=(h,original)=>renderEngineWebGPUCanvasOnce(h.device,h.context,original(),64,64,'rgba8unorm');
function released(h) {
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyBuffer:')).length,5);
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyTexture:')).length,2);
  assert.equal(h.events.filter(x=>x==='unconfigure').length,1);
  assert.deepEqual(h.scopes,[]);
}

test('presentation pop blocks success and retains frame/configuration/context claim',async()=>{
  const {h,original,deferred}=await fixture();
  h.options.presentPopGate=deferred();h.options.presentPopStarted=deferred();
  let settled=false;const pending=render(h,original).then(value=>{settled=true;return value;});
  await h.options.presentPopStarted.promise;
  assert.equal(settled,false);assert.ok(h.events.some(x=>Array.isArray(x)&&x[0]==='copy'));
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroy')).length,0);
  assert.equal(h.events.includes('unconfigure'),false);
  const before=h.events.length;await assert.rejects(render(h,original),/already claimed/);
  assert.equal(h.events.length,before);
  h.options.presentPopGate.resolve();const lease=await pending;
  assert.equal(settled,true);lease.dispose();lease.dispose();released(h);
});

for(const filter of ['validation','internal','out-of-memory'])test(`presentation ${filter} error refuses the lease and releases all owned resources`,async()=>{
  const error={message:filter},{h,original}=await fixture({presentErrors:{[filter]:error}});
  await assert.rejects(render(h,original),cause=>cause instanceof AggregateError&&
    cause.errors.length===1&&cause.errors[0]===error&&cause.message.includes('presentation'));
  assert.equal(h.events.filter(x=>x==='pop').length,6);released(h);
  // The copy was submitted: this refusal is not a retained-pixel assertion.
  assert.ok(h.events.some(x=>Array.isArray(x)&&x[0]==='copy'));
  delete h.options.presentErrors;
  const lease=await render(h,original);lease.dispose();assert.deepEqual(h.scopes,[]);
});

for(const [label,options,presentationPops] of [
  ['first presentation push',{presentPushAt:1},0],
  ['second presentation push',{presentPushAt:2},1],
  ['third presentation push',{presentPushAt:3},2],
  ['presentation pop',{presentRejectPops:[1,2]},3],
])test(`${label} preserves the ordinary cause and attempts all pushed scopes`,async()=>{
  const cause=new Error(label),{h,original}=await fixture({...options,presentCause:cause,
    presentErrors:{internal:{message:'secondary validation'}}});
  await assert.rejects(render(h,original),error=>error===cause);
  assert.equal(h.events.filter(x=>x==='pop').length,3+presentationPops);released(h);
});

for(const failure of ['copy','submit','queue'])test(`${failure} presentation rejection still pops the three presentation scopes`,async()=>{
  const {h,original}=await fixture({},failure);
  await assert.rejects(render(h,original),cause=>cause===h.error);
  assert.equal(h.events.filter(x=>x==='pop').length,6);released(h);
});

test('undefined presentation pop rejection refuses rather than returning success',async()=>{
  const {h,original}=await fixture({presentRejectPops:[1],presentCause:undefined});let refused=false;
  try{await render(h,original);}catch(cause){refused=true;assert.equal(cause,undefined);}
  assert.equal(refused,true);released(h);
});

test('direct checked presentation rejects extents before owning scopes or touching borrowed textures',async()=>{
  const {h}=await fixture();
  for(const [width,height]of[[0,64],[64,2049],[1.5,64]])
    await assert.rejects(presentCheckedEngineWebGPUColor(h.device,h.context,h.destination,width,height),RangeError);
  h.device.limits.maxTextureDimension2D=32;
  await assert.rejects(presentCheckedEngineWebGPUColor(h.device,h.context,h.destination,64,64),RangeError);
  assert.deepEqual(h.events,[]);
});
