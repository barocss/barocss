/** Emitted EngineScene/Canvas/error-scope composition; structural handles, not a GPU device. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';
import { renderCheckedEngineWebGPUOnce } from '../dist/engine-webgpu-checked-once.js';

function original() {
  const mesh = id => ({id,type:'mesh',parentId:null,translation:[0,0,0],
    rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId:'tri',materialId:'red'});
  return {format:'barocss-gpu-engine-scene',version:0,id:'scene',
    coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,0,0],
    camera:{eye:[0,0,5],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:100},
    geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'tri',
      coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
      positions:[0,0,0,1,0,0,0,1,0],normals:[0,0,1,0,0,1,0,0,1],
      uvs:[0,0,1,0,0,1],indices:[0,1,2]}],
    materials:[{id:'red',type:'unlit',colorSpace:'linear',color:[1,0,0]}],nodes:[mesh('a'),mesh('b')]};
}
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return {promise,resolve};
}
function harness(options = {}) {
  const events = [], stack = [], owned = [], queueStarted = deferred(), popStarted = deferred();
  let pushes = 0, pops = 0, waits = 0, submits = 0;
  function resource(kind) {
    let destroyed = false;
    const value = {createView(){return{};},destroy(){
      assert.equal(destroyed,false,'resource destroyed twice');destroyed=true;events.push('destroy:'+kind);
    }};
    owned.push(value);return value;
  }
  const device = {
    limits:{maxTextureDimension2D:4096},
    destroy(){throw new Error('borrowed device destroyed');},
    pushErrorScope(filter){events.push(['push',filter]);if (++pushes === options.failPush)throw options.cause;stack.push(filter);},
    async popErrorScope(){const filter = stack.pop();assert.ok(filter,'pop without a matching push');
      events.push(['pop',filter]);const index = ++pops;
      if(index===1){popStarted.resolve();await options.popGate?.promise;}
      if(options.rejectPops?.includes(index))throw options.cause;
      return options.errors?.[filter] ?? null;},
    createShaderModule(){events.push('shader');return{async getCompilationInfo(){return{messages:[]};}};},
    createBindGroupLayout(){return{};},createPipelineLayout(){return{};},
    async createRenderPipelineAsync(){return{};},
    createBuffer(){return resource('buffer');},createTexture(){return resource('texture');},createBindGroup(){return{};},
    queue:{writeBuffer(){},submit(){events.push('submit');if(++submits===options.failSubmit)throw options.cause;},
      async onSubmittedWorkDone(){events.push('wait');if(++waits===1){queueStarted.resolve();
        if(options.rejectQueue)throw options.cause;await options.queueGate?.promise;}events.push('completed');}},
    createCommandEncoder(){return{beginRenderPass(){return{setPipeline(){},setBindGroup(){},setVertexBuffer(){},
      setIndexBuffer(){},drawIndexed(){events.push('draw');},end(){}};},
      copyTextureToTexture(){events.push('copy');},finish(){return{};}};},
  };
  const context = {configure(){events.push('configure');},unconfigure(){events.push('unconfigure');},
    getCurrentTexture(){events.push('backing');return{destroy(){throw new Error('borrowed backing destroyed');}};}};
  return{device,context,events,stack,owned,options,queueStarted,popStarted};
}
const render = h => renderEngineWebGPUCanvasOnce(h.device,h.context,original(),64,64,'rgba8unorm');
function checkNoPresentation(h) {
  for(const marker of ['configure','backing','copy','unconfigure'])assert.equal(h.events.includes(marker),false,marker);
}
function checkReleased(h, buffers = 5, textures = 2) {
  assert.equal(h.events.filter(x=>x==='destroy:buffer').length,buffers);
  assert.equal(h.events.filter(x=>x==='destroy:texture').length,textures);
  assert.deepEqual(h.stack,[]);
}
const scopeOrder = ['out-of-memory','internal','validation'];

test('offscreen queue and all scope results are admitted before the first Canvas operation',async()=>{
  const h=harness(),input=original(),snapshot=structuredClone(input);
  const lease=await renderEngineWebGPUCanvasOnce(h.device,h.context,input,64,64,'bgra8unorm');
  assert.deepEqual(input,snapshot);
  assert.deepEqual(h.events.filter(x=>Array.isArray(x)&&x[0]==='push'),scopeOrder.map(x=>['push',x]));
  assert.deepEqual(h.events.filter(x=>Array.isArray(x)&&x[0]==='pop'),[...scopeOrder].reverse().map(x=>['pop',x]));
  const configure=h.events.indexOf('configure'),lastPop=h.events.findLastIndex(x=>Array.isArray(x)&&x[0]==='pop');
  assert.ok(h.events.indexOf('completed')<lastPop && lastPop<configure);
  assert.equal(h.events.filter(x=>x==='wait').length,2);
  assert.equal(lease.drawCount,2);assert.equal(lease.geometryCount,1);
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroy:')).length,0);
  lease.dispose();lease.dispose();checkReleased(h);
});

test('pending offscreen completion and pending scope pop both prevent any Canvas presentation',async()=>{
  const queueGate=deferred(),popGate=deferred(),h=harness({queueGate,popGate}),pending=render(h);
  await h.queueStarted.promise;checkNoPresentation(h);
  assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='pop').length,0);
  const before=h.events.length;await assert.rejects(render(h),/already claimed/);assert.equal(h.events.length,before);
  queueGate.resolve();await h.popStarted.promise;checkNoPresentation(h);
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroy:')).length,0);
  popGate.resolve();const lease=await pending;lease.dispose();checkReleased(h);
});

for(const filter of scopeOrder)test(`${filter} device error refuses before Canvas and releases the candidate`,async()=>{
  const error={message:'actual '+filter},h=harness({errors:{[filter]:error}});
  await assert.rejects(render(h),cause=>cause instanceof AggregateError&&cause.errors.length===1&&cause.errors[0]===error);
  checkNoPresentation(h);checkReleased(h);
  delete h.options.errors;
  const lease=await render(h);lease.dispose();checkReleased(h,10,4);
});

test('all surfaced device errors retain their original scope objects in pop order',async()=>{
  const errors=Object.fromEntries(scopeOrder.map(x=>[x,{message:x}])),h=harness({errors});
  await assert.rejects(render(h),cause=>cause instanceof AggregateError&&
    cause.errors.every((error,index)=>error===errors[[...scopeOrder].reverse()[index]])&&cause.errors.length===3);
  checkNoPresentation(h);checkReleased(h);
});

for(const [label,options,pops,buffers,textures] of [
  ['first push',{failPush:1},0,0,0],['second push',{failPush:2},1,0,0],['third push',{failPush:3},2,0,0],
  ['render submit',{failSubmit:1},3,5,2],['offscreen queue',{rejectQueue:true},3,5,2],
  ['scope pop',{rejectPops:[1,2]},3,5,2],
])test(`${label} rejection retains cause identity and attempts every pushed scope`,async()=>{
  const cause=new Error(label),h=harness({...options,cause,errors:{internal:{message:'secondary GPU error'}}});
  await assert.rejects(render(h),error=>error===cause);
  assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='pop').length,pops);
  checkNoPresentation(h);checkReleased(h,buffers,textures);
});

test('undefined pop rejection is an ordinary refusal, not an admitted frame',async()=>{
  const h=harness({rejectPops:[1],cause:undefined});let refused=false;
  try{await render(h);}catch(cause){refused=true;assert.equal(cause,undefined);}
  assert.equal(refused,true);checkNoPresentation(h);checkReleased(h);
});

test('direct checked helper refuses invalid originals and extents before owning scopes',async()=>{
  const h=harness(),bad=original();bad.nodes[1].geometryId='missing';
  await assert.rejects(renderCheckedEngineWebGPUOnce(h.device,bad,64,64,'rgba8unorm'));
  await assert.rejects(renderCheckedEngineWebGPUOnce(h.device,original(),0,64,'rgba8unorm'),RangeError);
  await assert.rejects(renderCheckedEngineWebGPUOnce(h.device,original(),64,64,'rgba16float'),TypeError);
  h.device.limits.maxTextureDimension2D=32;
  await assert.rejects(renderCheckedEngineWebGPUOnce(h.device,original(),64,64,'rgba8unorm'),RangeError);
  assert.deepEqual(h.events,[]);
});
