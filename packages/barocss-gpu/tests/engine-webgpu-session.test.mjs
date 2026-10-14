/** Emitted private persistent session with structural handles; no mounted or pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEngineWebGPUSession } from '../dist/engine-webgpu-session.js';
import { renderEngineWebGPUCanvasOnce } from '../dist/engine-webgpu-canvas-once.js';

async function fixture(width=3,height=2,format='rgba8unorm') {
  const {harness,original,deferred}=await import('./engine-webgpu-canvas-once.test.mjs');
  const h=harness();h.device.limits.maxBufferSize=16777216;h.mappedRanges=[];
  const createBuffer=h.device.createBuffer.bind(h.device);
  h.device.createBuffer=descriptor=>{
    const buffer=createBuffer(descriptor),id=h.buffers.length-1;
    buffer.mapAsync=async mode=>{
      h.events.push(['map',mode]);h.options.readMapStarted?.resolve();
      if(Object.hasOwn(h.options,'readMapCause'))throw h.options.readMapCause;
      await h.options.readMapGate?.promise;
    };
    buffer.getMappedRange=()=>{
      h.events.push('range');const storage=new Uint8Array(descriptor.size),rowBytes=Math.ceil(width*4/256)*256;
      storage.fill(251);
      for(let row=0;row<height;row++)for(let x=0;x<width;x++){
        const rgba=[row+1,20+x,70+x,200+row];
        storage.set(format==='bgra8unorm'?[rgba[2],rgba[1],rgba[0],rgba[3]]:rgba,row*rowBytes+x*4);
      }
      h.mappedRanges.push(storage);return storage.buffer;
    };
    buffer.unmap=()=>h.events.push('unmapBuffer:'+id);return buffer;
  };
  const createShader=h.device.createShaderModule.bind(h.device);
  h.device.createShaderModule=(...args)=>{
    const module=createShader(...args),compile=module.getCompilationInfo.bind(module);
    module.getCompilationInfo=async()=>{
      if(Object.hasOwn(h.options,'shaderCause'))throw h.options.shaderCause;
      return compile();
    };return module;
  };
  const createEncoder=h.device.createCommandEncoder.bind(h.device);
  h.device.createCommandEncoder=()=>{
    const encoder=createEncoder(),copy=encoder.copyTextureToTexture.bind(encoder);
    encoder.copyTextureToTexture=(...args)=>{
      if(Object.hasOwn(h.options,'copyCause')){h.events.push(['copy',...args]);throw h.options.copyCause;}
      copy(...args);
    };
    encoder.copyTextureToBuffer=(...args)=>h.events.push(['readcopy',...args]);return encoder;
  };
  const source=original();
  return {h,source,original,deferred,width,height,format,
    mount:(input=source)=>createEngineWebGPUSession(h.device,h.context,input,width,height,format)};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const refusal=promise=>promise.then(()=>({refused:false}),cause=>({refused:true,cause}));
function status(session,state,generation=1) {
  const first=session.getStatus(),second=session.getStatus();
  assert.deepEqual(first,{state,generation});assert.ok(Object.isFrozen(first));assert.notEqual(first,second);
}
function deeplyFrozen(value) {
  if(value===null||typeof value!=='object')return;
  assert.ok(Object.isFrozen(value));for(const child of Object.values(value))deeplyFrozen(child);
}
function cleanup(h,buffers,textures,unconfigure,settled=true) {
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyBuffer:')).length,buffers);
  assert.equal(h.events.filter(x=>typeof x==='string'&&x.startsWith('destroyTexture:')).length,textures);
  assert.equal(h.events.filter(x=>x==='unconfigure').length,unconfigure);
  if(settled)assert.deepEqual(h.scopes,[]);
}
async function withoutUnhandled(operation) {
  const unhandled=[],listener=cause=>unhandled.push(cause);process.on('unhandledRejection',listener);
  try{await operation();await flush();assert.deepEqual(unhandled,[]);}
  finally{process.off('unhandledRejection',listener);}
}

test('initial generation and two accepted updates preserve original IDs and F64 data in fresh deeply frozen copies',async()=>{
  const {h,source,original,mount}=await fixture();source.nodes[0].translation[0]=.123456789012345;
  const first=structuredClone(source),session=await mount();assert.ok(Object.isFrozen(session));status(session,'ready');
  const a=session.getScene(),b=session.getScene();assert.deepEqual(a,first);assert.notEqual(a,b);
  assert.notEqual(a.geometries,b.geometries);deeplyFrozen(a);assert.equal(a.nodes[0].translation[0],.123456789012345);
  source.nodes.length=0;assert.deepEqual(session.getScene(),first);
  for(const generation of [2,3]){
    const next=original();next.id='accepted'+generation;next.nodes[0].translation[0]=generation+.123456789012345;
    const snapshot=structuredClone(next);await session.update(next);status(session,'ready',generation);
    assert.deepEqual(session.getScene(),snapshot);next.geometries[0].positions[0]=.25;
    assert.deepEqual(session.getScene(),snapshot);deeplyFrozen(session.getScene());
  }
  assert.equal(h.buffers.length,15,'Each frame uploads one shared geometry, one camera and two draw buffers');
  assert.equal(h.events.filter(x=>x==='draw').length,6);cleanup(h,10,4,0);
  session.dispose();session.dispose();status(session,'disposed',3);cleanup(h,15,6,1);
  assert.throws(()=>session.getScene(),/disposed/);
});

test('deferred update retains the accepted frame and source until presentation admission and refuses concurrent operations',async()=>{
  const {h,original,deferred,mount}=await fixture(),session=await mount(),old=session.getScene();
  const gate=deferred(),started=deferred(),popGate=deferred(),popStarted=deferred();
  h.options.compilation=gate;h.options.compilationStarted=started;
  h.options.offscreenPopGate=popGate;h.options.offscreenPopStarted=popStarted;
  const next=original();next.id='candidate';const snapshot=structuredClone(next),pending=session.update(next);
  await started.promise;status(session,'busy');cleanup(h,0,0,0,false);assert.equal(h.scopes.length,3);
  assert.deepEqual(session.getScene(),old);
  next.nodes.length=0;const before=h.events.slice();
  await assert.rejects(session.update(original()),/busy/);await assert.rejects(session.readPixels(),/busy/);
  assert.deepEqual(h.events,before);gate.resolve();await popStarted.promise;
  status(session,'busy');cleanup(h,0,0,0,false);assert.equal(h.buffers.length,10);assert.equal(h.textures.length,4);
  assert.deepEqual(session.getScene(),old);assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='copy').length,1);
  popGate.resolve();await pending;status(session,'ready',2);
  assert.deepEqual(session.getScene(),snapshot);cleanup(h,5,2,0);session.dispose();cleanup(h,10,4,1);
});

test('invalid original update refuses before graphics and preserves accepted generation and source',async()=>{
  const {h,original,mount}=await fixture(),session=await mount(),accepted=session.getScene(),bad=original();
  bad.nodes[1].geometryId='missing';const before=h.events.slice();await assert.rejects(session.update(bad));
  status(session,'ready');assert.deepEqual(session.getScene(),accepted);assert.deepEqual(h.events,before);
  session.dispose();cleanup(h,5,2,1);
});
test('offscreen refusal retains the accepted frame and can accept a later original update',async()=>{
  const {h,original,mount}=await fixture(),session=await mount(),accepted=session.getScene(),cause={native:'shader refusal'};
  h.options.shaderCause=cause;const result=await refusal(session.update(original()));
  assert.equal(result.refused,true);assert.equal(result.cause,cause);status(session,'ready');
  assert.deepEqual(session.getScene(),accepted);cleanup(h,0,0,0);
  delete h.options.shaderCause;await session.update(original());status(session,'ready',2);
  cleanup(h,5,2,0);session.dispose();cleanup(h,10,4,1);
});

for(const kind of ['raw','undefined'])test(`presentation ${kind} refusal retires both frames and leaves last accepted source unavailable`,async()=>{
  const {h,original,mount}=await fixture(),session=await mount(),accepted=session.getScene();
  const cause=kind==='raw'?{native:'presentation refusal'}:undefined;h.options.copyCause=cause;
  const next=original();next.id='refusedCandidate';const result=await refusal(session.update(next));
  assert.equal(result.refused,true);assert.equal(result.cause,cause);status(session,'unavailable');
  assert.deepEqual(session.getScene(),accepted);cleanup(h,10,4,1);
  const before=h.events.slice();
  for(const operation of [()=>session.update(original()),()=>session.readPixels()]){
    const rejected=await refusal(operation());assert.equal(rejected.refused,true);assert.equal(rejected.cause,cause);
  }
  assert.deepEqual(h.events,before);delete h.options.copyCause;
  const nextLease=await renderEngineWebGPUCanvasOnce(h.device,h.context,original(),3,2,'rgba8unorm');
  nextLease.dispose();session.dispose();session.dispose();cleanup(h,15,6,2);
});

test('readPixels returns fresh tight top-left RGBA copies and serializes updates while mapping is pending',async()=>{
  const {h,deferred,original,mount}=await fixture(3,2,'bgra8unorm'),session=await mount(),accepted=session.getScene();
  const gate=deferred(),started=deferred();h.options.readMapGate=gate;h.options.readMapStarted=started;
  const pending=session.readPixels();await started.promise;status(session,'busy');const before=h.events.slice();
  await assert.rejects(session.update(original()),/busy/);await assert.rejects(session.readPixels(),/busy/);
  assert.deepEqual(h.events,before);gate.resolve();const first=await pending;status(session,'ready');
  const expected=new Uint8Array([1,20,70,200,1,21,71,200,1,22,72,200,2,20,70,201,2,21,71,201,2,22,72,201]);
  assert.deepEqual(first,expected);h.mappedRanges[0].fill(0);assert.deepEqual(first,expected);
  const second=await session.readPixels();assert.deepEqual(second,expected);assert.notEqual(first.buffer,second.buffer);
  first[0]=255;assert.equal(second[0],1);assert.deepEqual(session.getScene(),accepted);
  const readCopies=h.events.filter(x=>Array.isArray(x)&&x[0]==='readcopy');
  assert.equal(readCopies.length,2);assert.equal(readCopies[0][1].texture,h.textures[0]);
  assert.equal(readCopies[0][2].bytesPerRow,256);assert.equal(h.events.filter(x=>x==='range').length,2);
  cleanup(h,2,0,0);session.dispose();cleanup(h,7,2,1);
});
test('readback raw and undefined refusals release only readback ownership and preserve the ready frame',async()=>{
  const {h,mount}=await fixture(),session=await mount(),accepted=session.getScene();
  for(const cause of [{native:'mapping refusal'},undefined]){
    h.options.readMapCause=cause;const result=await refusal(session.readPixels());
    assert.equal(result.refused,true);assert.equal(result.cause,cause);status(session,'ready');
    assert.deepEqual(session.getScene(),accepted);
  }
  cleanup(h,2,0,0);session.dispose();cleanup(h,7,2,1);
});

test('source, dimensions, format and actual positive buffer caps admit before claim or GPU work',async()=>{
  const {h,source,original}=await fixture(),bad=original();bad.nodes[1].materialId='missing';
  await assert.rejects(createEngineWebGPUSession(h.device,h.context,bad,3,2,'rgba8unorm'));
  for(const [width,height,format]of[[0,2,'rgba8unorm'],[2049,2,'rgba8unorm'],[3,1.5,'rgba8unorm'],[3,2,'rgba16float']])
    await assert.rejects(createEngineWebGPUSession(h.device,h.context,source,width,height,format));
  for(const limit of [0,511,NaN]){
    h.device.limits.maxBufferSize=limit;
    await assert.rejects(createEngineWebGPUSession(h.device,h.context,source,3,2,'rgba8unorm'),RangeError);
  }
  h.device.limits.maxBufferSize=16777216;h.device.limits.maxTextureDimension2D=2;
  await assert.rejects(createEngineWebGPUSession(h.device,h.context,source,3,2,'rgba8unorm'),RangeError);
  assert.deepEqual(h.events,[]);h.device.limits.maxTextureDimension2D=4096;
  const lease=await renderEngineWebGPUCanvasOnce(h.device,h.context,source,3,2,'rgba8unorm');lease.dispose();
});
test('accepted plus candidate plus reserved readback obeys the 64MiB logical cap before update graphics',async()=>{
  const {h,original,mount}=await fixture(2048,2048),session=await mount(),before=h.events.slice();
  await assert.rejects(session.update(original()),cause=>cause instanceof RangeError&&cause.message.includes('64MiB'));
  status(session,'ready');assert.deepEqual(h.events,before);cleanup(h,0,0,0);session.dispose();cleanup(h,5,2,1);
});

test('one-shot and session claims exclude each other and an old owner cannot release a newer claim',async()=>{
  const {h,original,mount}=await fixture(),session=await mount();
  const once=()=>renderEngineWebGPUCanvasOnce(h.device,h.context,original(),3,2,'rgba8unorm');
  let before=h.events.slice();await assert.rejects(once(),/claimed/);await assert.rejects(mount(),/claimed/);
  assert.deepEqual(h.events,before);session.dispose();const lease=await once();before=h.events.slice();
  await assert.rejects(mount(),/claimed/);assert.deepEqual(h.events,before);lease.dispose();
  const next=await mount();session.dispose();lease.dispose();before=h.events.slice();
  await assert.rejects(once(),/claimed/);assert.deepEqual(h.events,before);next.dispose();
});
test('held device loss retires resources and preserves original history; cleanup diagnostic is reported once on dispose',async()=>{
  const {h,mount}=await fixture(),session=await mount(),accepted=session.getScene(),cleanupCause=new Error('unconfigure refused');
  h.options.unconfigureError=cleanupCause;
  await withoutUnhandled(async()=>{h.loss.resolve({reason:'destroyed',message:'held loss'});await flush();});
  status(session,'lost');assert.deepEqual(session.getScene(),accepted);cleanup(h,5,2,1);
  delete h.options.unconfigureError;
  assert.throws(()=>session.dispose(),cause=>cause instanceof AggregateError&&cause.errors.length===1&&cause.errors[0]===cleanupCause);
  session.dispose();status(session,'disposed');cleanup(h,5,2,1);assert.throws(()=>session.getScene(),/disposed/);
  const healthy=await fixture();const lease=await renderEngineWebGPUCanvasOnce(healthy.h.device,h.context,healthy.source,3,2,'rgba8unorm');lease.dispose();
});

for(const stage of ['compilation','offscreenPopGate'])for(const terminal of ['loss','dispose'])
test(`${terminal} during ${stage} retires accepted resources but holds the context claim until candidate unwind`,async()=>{
  const {h,original,deferred,mount}=await fixture(),session=await mount(),gate=deferred(),started=deferred();
  const signal=stage==='compilation'?'compilationStarted':'offscreenPopStarted';h.options[stage]=gate;h.options[signal]=started;
  const healthy=await fixture(),info={reason:'destroyed',message:'active update loss'};
  await withoutUnhandled(async()=>{
    const result=refusal(session.update(original()));await started.promise;
    const undefinedLoss=terminal==='loss'&&stage==='offscreenPopGate';
    if(terminal==='dispose')session.dispose();
    else{if(undefinedLoss)h.loss.reject(undefined);else h.loss.resolve(info);await Promise.resolve();}
    const blocked=await refusal(renderEngineWebGPUCanvasOnce(healthy.h.device,h.context,healthy.source,3,2,'rgba8unorm'));
    assert.equal(blocked.refused,true);assert.match(blocked.cause?.message??'',/claimed/);assert.deepEqual(healthy.h.events,[]);
    const settled=await result;assert.equal(settled.refused,true);
    if(undefinedLoss)assert.equal(settled.cause,undefined);
    else if(terminal==='loss'){assert.equal(settled.cause?.name,'EngineWebGPUDeviceLostError');assert.equal(settled.cause.cause,info);}
    else assert.match(settled.cause?.message??'',/disposed/);
    status(session,terminal==='loss'?'lost':'disposed');
    cleanup(h,stage==='compilation'?5:10,stage==='compilation'?2:4,1);
    const before=h.events.slice();
    if(stage==='compilation')gate.reject(new Error('late compilation refusal'));else gate.resolve();
    await flush();assert.deepEqual(h.events,before);
    const lease=await renderEngineWebGPUCanvasOnce(healthy.h.device,h.context,healthy.source,3,2,'rgba8unorm');lease.dispose();
    session.dispose();session.dispose();
  });
});

test('pre-settled undefined device loss refuses initial session before graphics and releases its claim',async()=>{
  const {h,mount}=await fixture();
  await withoutUnhandled(async()=>{
    h.loss.reject(undefined);const result=await refusal(mount());assert.equal(result.refused,true);assert.equal(result.cause,undefined);
    assert.deepEqual(h.events,[]);const healthy=await fixture();
    const lease=await renderEngineWebGPUCanvasOnce(healthy.h.device,h.context,healthy.source,3,2,'rgba8unorm');lease.dispose();
  });
});
test('update deadline refuses pending compilation without changing ready source or resuming late GPU commands',async t=>{
  let now=0;t.mock.method(performance,'now',()=>now);t.mock.timers.enable({apis:['setTimeout']});
  const {h,original,deferred,mount}=await fixture(),session=await mount(),accepted=session.getScene(),gate=deferred(),started=deferred();
  h.options.compilation=gate;h.options.compilationStarted=started;
  await withoutUnhandled(async()=>{
    const result=refusal(session.update(original()));await started.promise;now=10000;t.mock.timers.tick(10000);
    const settled=await result;assert.equal(settled.refused,true);assert.equal(settled.cause?.name,'EngineWebGPUTimeoutError');
    status(session,'ready');assert.deepEqual(session.getScene(),accepted);cleanup(h,0,0,0);
    const before=h.events.slice();gate.reject(new Error('late timed-out compilation'));await flush();assert.deepEqual(h.events,before);
    delete h.options.compilation;delete h.options.compilationStarted;await session.update(original());status(session,'ready',2);
    session.dispose();cleanup(h,10,4,1);
  });
});
