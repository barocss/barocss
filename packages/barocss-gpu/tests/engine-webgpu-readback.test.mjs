/** Emitted generic readback and targets with controlled handles; no physical pixel proof. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readEngineWebGPUColor } from '../dist/engine-webgpu-readback.js';
import { createEngineWebGPURenderTargets } from '../dist/engine-webgpu-targets.js';
import { EngineWebGPUWaitBudget } from '../dist/engine-webgpu-wait-budget.js';

function deferred() {
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const refusal=promise=>promise.then(()=>({refused:false}),cause=>({refused:true,cause}));
function harness(options={}) {
  const events=[],scopes=[],buffers=[],textures=[],loss=deferred();
  const queueStarted=deferred(),mapStarted=deferred(),popStarted=deferred();
  const cause=Object.hasOwn(options,'cause')?options.cause:{native:'ordinary refusal'};
  let pops=0;
  const fail=stage=>{if(options.failure===stage)throw cause;};
  const color={destroy(){events.push('destroyBorrowedColor');throw new Error('borrowed color destroyed');},createView(){return {};}};
  const commands={submitted:true};
  const device={
    limits:{maxTextureDimension2D:4096,maxBufferSize:16777216},lost:loss.promise,
    destroy(){events.push('destroyDevice');throw new Error('borrowed device destroyed');},
    pushErrorScope(filter){events.push(['push',filter]);scopes.push(filter);},
    async popErrorScope(){
      const filter=scopes.pop();assert.ok(filter);events.push('pop');const index=++pops;
      if(index===1){popStarted.resolve();await options.popGate?.promise;}
      fail('pop'+index);return options.scopeErrors?.[filter]??null;
    },
    createTexture(descriptor){
      const id=textures.length,texture={createView(){return {};},destroy(){events.push(['destroyTexture',id]);}};
      textures.push(texture);events.push(['texture',descriptor]);return texture;
    },
    createBuffer(descriptor){
      events.push(['buffer',descriptor]);fail('allocation');
      const storage=options.range??new ArrayBuffer(descriptor.size+(options.rangeDelta??0));
      const buffer={storage,
        async mapAsync(mode){events.push(['map',mode]);mapStarted.resolve();fail('map');await options.mapGate?.promise;},
        getMappedRange(){events.push('range');fail('range');return storage;},
        unmap(){events.push('unmap');if(Object.hasOwn(options,'unmapCause'))throw options.unmapCause;},
        destroy(){events.push('destroy');if(Object.hasOwn(options,'destroyCause'))throw options.destroyCause;},
      };
      buffers.push(buffer);return buffer;
    },
    createCommandEncoder(){events.push('encoder');fail('encoder');return {
      copyTextureToBuffer(source,destination,extent){events.push(['copy',source,destination,extent]);fail('copy');},
      finish(){events.push('finish');fail('finish');return commands;},
    };},
    queue:{
      submit(input){events.push(['submit',input]);fail('submit');},
      async onSubmittedWorkDone(){events.push('queue');queueStarted.resolve();fail('queue');await options.queueGate?.promise;},
    },
  };
  return {device,color,events,scopes,buffers,textures,loss,options,cause,commands,queueStarted,mapStarted,popStarted};
}
const read=(h,width=3,height=2,format='rgba8unorm',budget)=>
  readEngineWebGPUColor(h.device,h.color,width,height,format,budget);
function released(h,owned=1,pops=3,unmaps=owned) {
  assert.equal(h.events.filter(x=>x==='unmap').length,unmaps);
  assert.equal(h.events.filter(x=>x==='destroy').length,owned);
  assert.equal(h.events.filter(x=>x==='pop').length,pops);assert.deepEqual(h.scopes,[]);
  assert.equal(h.events.filter(x=>Array.isArray(x)&&x[0]==='destroyTexture').length,0);
  assert.equal(h.events.includes('destroyBorrowedColor'),false);assert.equal(h.events.includes('destroyDevice'),false);
}
async function withoutUnhandled(operation) {
  const unhandled=[],listener=cause=>unhandled.push(cause);process.on('unhandledRejection',listener);
  try{await operation();await flush();assert.deepEqual(unhandled,[]);}
  finally{process.off('unhandledRejection',listener);}
}
function countSubscriptions(promise) {
  let count=0;const nativeThen=promise.then;
  promise.then=function(...args){count++;return nativeThen.apply(this,args);};
  return ()=>count;
}

for(const width of [3,65])for(const format of ['rgba8unorm','bgra8unorm'])
test(`${format} width ${width} composes actual targets and returns fresh tight top-left RGBA rows`,async()=>{
  const height=2,rowBytes=Math.ceil(width*4/256)*256,padded=new Uint8Array(rowBytes*height);
  padded.fill(251);const expected=new Uint8Array(width*height*4);
  for(let row=0;row<height;row++)for(let x=0;x<width;x++){
    const rgba=[row*40+x%40,70+row,150+x%40,200+row],offset=(row*width+x)*4;
    expected.set(rgba,offset);
    padded.set(format==='bgra8unorm'?[rgba[2],rgba[1],rgba[0],rgba[3]]:rgba,row*rowBytes+x*4);
  }
  const h=harness({range:padded.buffer}),targets=createEngineWebGPURenderTargets(h.device,width,height,format);
  const original=padded.slice(),result=await readEngineWebGPUColor(h.device,targets.color,width,height,format);
  assert.ok(result instanceof Uint8Array);assert.deepEqual(result,expected);assert.deepEqual(padded,original);
  assert.equal(result.byteLength,width*height*4);assert.notEqual(result.buffer,padded.buffer);
  assert.deepEqual(h.events.filter(x=>Array.isArray(x)&&x[0]==='push').map(x=>x[1]),
    ['out-of-memory','internal','validation']);
  assert.deepEqual(h.events.find(x=>Array.isArray(x)&&x[0]==='buffer'),['buffer',{size:rowBytes*height,usage:9}]);
  assert.deepEqual(h.events.find(x=>Array.isArray(x)&&x[0]==='copy'),
    ['copy',{texture:targets.color,origin:{x:0,y:0,z:0}},
      {buffer:h.buffers[0],bytesPerRow:rowBytes,rowsPerImage:height},{width,height,depthOrArrayLayers:1}]);
  assert.deepEqual(h.events.find(x=>Array.isArray(x)&&x[0]==='submit'),['submit',[h.commands]]);
  assert.deepEqual(h.events.find(x=>Array.isArray(x)&&x[0]==='map'),['map',1]);
  assert.ok(h.events.indexOf('queue')<h.events.findIndex(x=>Array.isArray(x)&&x[0]==='map'));
  assert.ok(h.events.indexOf('range')<h.events.indexOf('unmap'));assert.ok(h.events.indexOf('unmap')<h.events.indexOf('destroy'));
  released(h);padded.fill(17);assert.deepEqual(result,expected);
  const second=await readEngineWebGPUColor(h.device,targets.color,width,height,format);
  assert.notEqual(second,result);assert.notEqual(second.buffer,result.buffer);assert.ok(second.every(x=>x===17));
  result[0]=255;assert.equal(second[0],17);released(h,2,6);
  targets.dispose();targets.dispose();
  assert.deepEqual(h.events.filter(x=>Array.isArray(x)&&x[0]==='destroyTexture'),[['destroyTexture',0],['destroyTexture',1]]);
});

test('dimension, format and actual texture limits refuse before loss subscription or graphics',async()=>{
  const h=harness(),count=countSubscriptions(h.loss.promise);
  for(const [width,height,format]of[[0,2,'rgba8unorm'],[3,-1,'rgba8unorm'],[1.5,2,'rgba8unorm'],
    [3,NaN,'rgba8unorm'],[2049,1,'rgba8unorm'],[1,2049,'rgba8unorm'],[3,2,'rgba16float']])
    await assert.rejects(read(h,width,height,format));
  for(const limit of [2,undefined,NaN,Infinity,1.5]){
    h.device.limits.maxTextureDimension2D=limit;await assert.rejects(read(h),RangeError);
  }
  assert.deepEqual(h.events,[]);assert.equal(count(),0);
});
test('positive safe actual buffer limit must cover padded rows before any native work',async()=>{
  const h=harness(),count=countSubscriptions(h.loss.promise);
  for(const limit of [0,-1,undefined,NaN,Infinity,511,1.5]){
    h.device.limits.maxBufferSize=limit;await assert.rejects(read(h),RangeError);
  }
  assert.deepEqual(h.events,[]);assert.equal(count(),0);
});
test('bounded 2048-square admission reaches exactly the 16MiB padded allocation',async()=>{
  const h=harness({failure:'allocation'}),result=await refusal(read(h,2048,2048));
  assert.equal(result.refused,true);assert.equal(result.cause,h.cause);
  assert.deepEqual(h.events.find(x=>Array.isArray(x)&&x[0]==='buffer'),['buffer',{size:16777216,usage:9}]);
  released(h,0);
});
for(const delta of [-1,1])test(`mapped allocation length ${delta<0?'short':'long'} refuses and releases the buffer`,async()=>{
  const h=harness({rangeDelta:delta});await assert.rejects(read(h),RangeError);released(h);
});

for(const stage of ['allocation','encoder','copy','finish','submit','queue','map','range','pop1'])
for(const kind of ['raw','undefined'])test(`${stage} ordinary ${kind} refusal keeps exact identity and attempts all owned cleanup`,async()=>{
  const cause=kind==='raw'?{native:stage}:undefined,h=harness({failure:stage,cause});
  const result=await refusal(read(h));assert.equal(result.refused,true);assert.equal(result.cause,cause);
  released(h,stage==='allocation'?0:1);
});
for(const filter of ['out-of-memory','internal','validation'])test(`${filter} scope result refuses readback after all scope pops`,async()=>{
  const cause={message:filter},h=harness({scopeErrors:{[filter]:cause}});
  await assert.rejects(read(h),error=>error instanceof AggregateError&&error.errors.length===1&&error.errors[0]===cause);
  released(h);
});
for(const cleanup of ['unmap','destroy','both'])test(`successful readback reports ${cleanup} cleanup refusal as an AggregateError once`,async()=>{
  const first={cleanup:'unmap'},second={cleanup:'destroy'},options={};
  if(cleanup!=='destroy')options.unmapCause=first;if(cleanup!=='unmap')options.destroyCause=second;
  const h=harness(options),expected=cleanup==='both'?[first,second]:cleanup==='unmap'?[first]:[second];
  await assert.rejects(read(h),error=>error instanceof AggregateError&&
    error.errors.length===expected.length&&error.errors.every((cause,index)=>cause===expected[index]));
  released(h);const before=h.events.slice();await flush();assert.deepEqual(h.events,before);
});
for(const kind of ['raw','undefined'])test(`primary ${kind} refusal wins over unmap and destroy cleanup refusals`,async()=>{
  const cause=kind==='raw'?{native:'map primary'}:undefined;
  const h=harness({failure:'map',cause,unmapCause:{cleanup:'unmap'},destroyCause:{cleanup:'destroy'}});
  const result=await refusal(read(h));assert.equal(result.refused,true);assert.equal(result.cause,cause);released(h);
});

function clock(t) {
  let now=0;const live=new Set();t.mock.method(performance,'now',()=>now);
  t.mock.timers.enable({apis:['setTimeout']});const set=globalThis.setTimeout,clear=globalThis.clearTimeout;
  t.mock.method(globalThis,'setTimeout',(callback,ms)=>{
    const id=set(()=>{live.delete(id);callback();},ms);live.add(id);return id;
  });
  t.mock.method(globalThis,'clearTimeout',id=>{live.delete(id);clear(id);});
  return {live,advance(ms){now+=ms;t.mock.timers.tick(ms);}};
}
for(const stage of ['queue','map','pop'])for(const terminal of ['loss','deadline'])for(const late of ['resolve','reject'])
test(`${stage} pending ${terminal} retires owners; late ${late} cannot read bytes or resume commands`,async t=>{
  const c=clock(t),gate=deferred(),h=harness({[stage+'Gate']:gate}),budget=new EngineWebGPUWaitBudget();
  const info={reason:'destroyed',message:'controlled readback loss'};c.advance(6000);
  await withoutUnhandled(async()=>{
    const result=refusal(read(h,3,2,'rgba8unorm',budget));await h[stage+'Started'].promise;
    if(terminal==='loss')h.loss.resolve(info);
    else{c.advance(3999);assert.equal(c.live.size,1);c.advance(1);}
    const settled=await result;assert.equal(settled.refused,true);
    assert.equal(settled.cause?.name,terminal==='loss'?'EngineWebGPUDeviceLostError':'EngineWebGPUTimeoutError');
    if(terminal==='loss')assert.equal(settled.cause.cause,info);
    released(h);assert.equal(c.live.size,0);
    if(stage!=='pop')assert.equal(h.events.includes('range'),false);
    const before=h.events.length;
    // Even a refused late cleanup must remain contained and attempt no other stage.
    if(stage==='map'&&late==='resolve')h.options.unmapCause={cleanup:'late unmap refusal'};
    if(late==='resolve')gate.resolve();else gate.reject(new Error('late native refusal'));
    await flush();assert.deepEqual(h.events.slice(before),stage==='map'&&late==='resolve'?['unmap']:[]);
    released(h,1,3,stage==='map'&&late==='resolve'?2:1);assert.equal(c.live.size,0);
  });
});
for(const kind of ['fulfilled','raw','undefined'])test(`already ${kind} device loss refuses before allocation or scopes`,async()=>{
  const h=harness(),cause=kind==='fulfilled'?{reason:'destroyed',message:'already lost'}:
    kind==='raw'?{native:'already rejected'}:undefined;
  await withoutUnhandled(async()=>{
    if(kind==='fulfilled')h.loss.resolve(cause);else h.loss.reject(cause);
    const result=await refusal(read(h));assert.equal(result.refused,true);
    if(kind==='fulfilled'){assert.equal(result.cause?.name,'EngineWebGPUDeviceLostError');assert.equal(result.cause.cause,cause);}
    else assert.equal(result.cause,cause);
    assert.deepEqual(h.events,[]);
  });
});
for(const completion of ['success','failure'])test(`${completion} detaches readback loss callbacks and preserves one native observer across operations`,async()=>{
  const h=harness(completion==='failure'?{failure:'map'}:{}),count=countSubscriptions(h.loss.promise);
  const budget=new EngineWebGPUWaitBudget();
  if(completion==='success')await read(h,3,2,'rgba8unorm',budget);
  else{const result=await refusal(read(h,3,2,'rgba8unorm',budget));assert.equal(result.cause,h.cause);}
  const nextBudget=new EngineWebGPUWaitBudget();
  if(completion==='success')await read(h,3,2,'rgba8unorm',nextBudget);
  else{const result=await refusal(read(h,3,2,'rgba8unorm',nextBudget));assert.equal(result.cause,h.cause);}
  assert.equal(count(),1);const before=h.events.slice();h.loss.resolve({reason:'destroyed',message:'after completion'});await flush();
  assert.deepEqual(h.events,before);assert.doesNotThrow(()=>budget.check('detached first callback'));
  assert.doesNotThrow(()=>nextBudget.check('detached second callback'));released(h,2,6);
});
test('elapsed queue work and later mapping use one shared ten-second deadline',async t=>{
  const c=clock(t),queueGate=deferred(),mapGate=deferred(),h=harness({queueGate,mapGate});
  const result=refusal(read(h));await h.queueStarted.promise;c.advance(6000);queueGate.resolve();
  await h.mapStarted.promise;c.advance(3999);assert.equal(c.live.size,1);c.advance(1);
  const settled=await result;assert.equal(settled.refused,true);assert.equal(settled.cause?.name,'EngineWebGPUTimeoutError');
  released(h);mapGate.resolve();await flush();released(h,1,3,2);assert.equal(c.live.size,0);
});
