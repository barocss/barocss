/** Actual emitted leaf composition with structural handles; no adapter or pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';
import './engine-webgpu-checked-once.test.mjs';

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
    materials:[{id:'red',type:'unlit',colorSpace:'linear',color:[1,0,0]}],
    nodes:[mesh('a'),mesh('b')]};
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(failure = '', options = {}) {
  const events = [], buffers = [], textures = [], error = new Error(failure || 'device failure');
  let attemptBuffers = 0, attemptSubmits = 0, attemptWaits = 0;
  const queueStarted = deferred();
  const fail = stage => { if (failure === stage) throw error; };
  const destination = { destroy() { throw new Error('borrowed Canvas texture destroyed'); } };
  const device = {
    limits:{maxTextureDimension2D:4096},
    destroy() { throw new Error('caller device destroyed'); },
    pushErrorScope(filter){events.push(['push',filter]);},
    async popErrorScope(){events.push('pop');return null;},
    createShaderModule() { attemptBuffers = 0; attemptSubmits = 0; attemptWaits = 0; events.push('shader'); return {
      async getCompilationInfo() { fail('shader'); await options.compilation?.promise; return {messages:[]}; },
    }; },
    createBindGroupLayout(){return{};},createPipelineLayout(){return{};},
    async createRenderPipelineAsync(){return{};},
    createBuffer(desc) {
      if (attemptBuffers++ === 2) fail('buffer');
      const id = buffers.length, buffer = {destroy(){events.push('destroyBuffer:'+id);}};
      buffers.push(buffer); events.push(['buffer',desc.size]); return buffer;
    },
    createTexture(desc) {
      const id = textures.length, texture = {createView(){return{};},
        destroy(){events.push('destroyTexture:'+id);}};
      textures.push(texture); events.push(['texture',desc.format]); return texture;
    },
    createBindGroup(){return{};},
    queue:{writeBuffer(){},submit(){events.push('submit');
      if (++attemptSubmits === 2) fail('submit');},
      async onSubmittedWorkDone(){events.push('wait');
        if (++attemptWaits === 2) { queueStarted.resolve();fail('queue');await options.completion?.promise; }
        events.push('completed');}},
    createCommandEncoder(){return{
      beginRenderPass(){return{setPipeline(){},setBindGroup(){},setVertexBuffer(){},
        setIndexBuffer(){},drawIndexed(){events.push('draw');},end(){events.push('end');}};},
      copyTextureToTexture(from,to,extent){events.push(['copy',from,to,extent]);fail('copy');},
      finish(){return{};},
    };},
  };
  const context = {
    configure(desc){events.push(['configure',desc]);fail('configure');},
    unconfigure(){events.push('unconfigure');if(options.unconfigureError)throw options.unconfigureError;},
    getCurrentTexture(){events.push('backing');fail('backing');return destination;},
  };
  return {device,context,events,buffers,textures,error,destination,queueStarted,options};
}
function cleanup(h, buffers, textures, unconfigure) {
  assert.equal(h.events.filter(x => typeof x === 'string' && x.startsWith('destroyBuffer:')).length, buffers);
  assert.equal(h.events.filter(x => typeof x === 'string' && x.startsWith('destroyTexture:')).length, textures);
  assert.equal(h.events.filter(x => x === 'unconfigure').length, unconfigure);
}
const render = (h, source = original(), width = 64, height = 64, format = 'rgba8unorm') =>
  renderEngineWebGPUCanvasOnce(h.device,h.context,source,width,height,format);

test('one admitted original snapshot draws shared geometry and retains owners until queue completion and dispose', async () => {
  const completion = deferred(), h = harness('',{completion}), source = original();
  const snapshot = structuredClone(source), pending = render(h,source);
  await h.queueStarted.promise;
  assert.deepEqual(source,snapshot);
  assert.equal(h.events.filter(x => x === 'draw').length,2);
  assert.equal(h.events.filter(x => x === 'submit').length,2);
  const config = h.events.find(x => Array.isArray(x) && x[0] === 'configure')[1];
  assert.deepEqual(config,{device:h.device,format:'rgba8unorm',alphaMode:'opaque',usage:18});
  const copy = h.events.find(x => Array.isArray(x) && x[0] === 'copy');
  assert.deepEqual(copy,['copy',{texture:h.textures[0]},{texture:h.destination},
    {width:64,height:64,depthOrArrayLayers:1}]);
  assert.ok(h.events.indexOf('end') < h.events.findIndex(x => Array.isArray(x) && x[0] === 'configure'));
  cleanup(h,0,0,0);
  const before = h.events.length;
  await assert.rejects(render(h),/already claimed/);
  assert.equal(h.events.length,before);
  completion.resolve();
  const lease = await pending;
  assert.ok(Object.isFrozen(lease));assert.equal(lease.drawCount,2);assert.equal(lease.geometryCount,1);
  cleanup(h,0,0,0);
  lease.dispose();lease.dispose();cleanup(h,5,2,1);
  const next = await render(h,original(),32,24,'bgra8unorm');
  next.dispose();cleanup(h,10,4,2);
});

test('caller mutations during shader compilation do not change the admitted draw snapshot', async () => {
  const compilation = deferred(), h = harness('',{compilation}), source = original();
  const pending = render(h,source);
  source.nodes.length = 0;source.geometries.length = 0;source.materials.length = 0;
  const before = h.events.length;
  await assert.rejects(render(h),/already claimed/);assert.equal(h.events.length,before);
  compilation.resolve();
  const lease = await pending;
  assert.equal(lease.drawCount,2);assert.equal(lease.geometryCount,1);
  lease.dispose();cleanup(h,5,2,1);
});

test('original source, exact format and bounded extents refuse before graphics or configuration', async () => {
  const h = harness(), bad = original();bad.nodes[1].geometryId = 'missing';
  await assert.rejects(render(h,bad));
  for (const [width,height,format] of [[0,64,'rgba8unorm'],[64,2049,'rgba8unorm'],
    [1.5,64,'rgba8unorm'],[64,64,'rgba16float']])
    await assert.rejects(render(h,original(),width,height,format));
  h.device.limits.maxTextureDimension2D = 32;
  await assert.rejects(render(h),RangeError);assert.deepEqual(h.events,[]);
});

for (const [failure,buffers,textures,unconfigure] of [
  ['shader',0,0,0],['buffer',2,2,0],['configure',5,2,0],
  ['backing',5,2,1],['copy',5,2,1],['submit',5,2,1],['queue',5,2,1],
]) test(`${failure} refusal cleans acquired owners and preserves the original failure`, async () => {
  const h = harness(failure,{unconfigureError:new Error('secondary cleanup refusal')});
  await assert.rejects(render(h),cause => cause === h.error);
  cleanup(h,buffers,textures,unconfigure);
  // Reacquisition must reach the same actual failure rather than a stale context claim.
  await assert.rejects(render(h),cause => cause === h.error);
  cleanup(h,buffers*2,textures*2,unconfigure*2);
});

test('surface cleanup error is reported after releasing frame and claim, once', async () => {
  const cause = new Error('unconfigure refused'), h = harness('',{unconfigureError:cause});
  const lease = await render(h);
  assert.throws(() => lease.dispose(),error => error instanceof AggregateError && error.errors[0] === cause);
  lease.dispose();cleanup(h,5,2,1);
  delete h.options.unconfigureError;
  const next = await render(h);next.dispose();cleanup(h,10,4,2);
});
