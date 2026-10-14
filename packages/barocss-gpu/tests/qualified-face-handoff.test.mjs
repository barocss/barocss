/** #1922 actual emitted renderer/API graph over structural GL transport, not a device receipt. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import * as gpu from '../dist/index.js';
import {build} from 'esbuild';
const cadBundle=await build({entryPoints:[new URL('../../barocss-cad/src/index.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',target:'node22'});
const {tessellateSurface}=await import('data:text/javascript;base64,'+Buffer.from(cadBundle.outputFiles[0].text).toString('base64'));

const source = await readFile(new URL('../../../examples/gpu-scene/qualified-face-scene-flow.mjs', import.meta.url), 'utf8');
const saved = JSON.parse(Buffer.from(source.match(/warped:'([^']+)'/)[1], 'base64').toString());
const camera = {eye:[3,2,4],target:[0,0,0],up:[0,1,0],fovYDegrees:60,near:0.1,far:100};
const original = {format:'barocss-gpu-qualified-face-scene',version:0,profile:'source-qualified-forward-face-v0',
  sourceVersion:0,basis:'authored-xyz-matches-rhyup',assets:saved.assets.slice(0,2).map((a,i)=>({...a,color:i?[0,1,0]:[1,0,0]})),
  countU:17,countV:17,camera,mmToSceneUnit:0.12,translate:[-0.6,-0.6,-0.6],background:[0.05,0.07,0.1]};
const frame = {version:0,scene:{version:2,entries:original.assets.map(a=>({kind:'surface',
  ref:{modelId:a.sourceId,geometryId:a.face.topology.face.surfaceId},color:a.color,
  packet:tessellateSurface(a.face.geometry.objects.find(o=>o.id===a.face.topology.face.surfaceId),{countU:17,countV:17,revision:0}).packet}))},
  options:{camera,mmToSceneUnit:0.12,translate:[-0.6,-0.6,-0.6],background:[0.05,0.07,0.1]},particles:null,materials:[]};

function transport() {
  const log=[],live=new Set(),bindings=new Map(),listeners=new Set();let id=0,presentations=0,lost=false;
  const faults={};
  const step=(name,value)=>{log.push({name,value});if(Object.hasOwn(faults,name))throw faults[name];};
  const gl={NO_ERROR:0,COMPILE_STATUS:'compile',LINK_STATUS:'link',FRAMEBUFFER_COMPLETE:'complete',
    get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;},
    isContextLost(){step('isContextLost');return lost;},getError(){step('getError');return 0;},
    getShaderParameter(){return true;},getProgramParameter(){return true;},getShaderInfoLog(){return "";},getProgramInfoLog(){return "";},getUniformLocation(){return {};},
    getParameter(key){if(key==='MAX_TEXTURE_SIZE'||key==='MAX_RENDERBUFFER_SIZE')return 4096;
      if(key==='MAX_VIEWPORT_DIMS')return [4096,4096];return bindings.get(key)??null;},
    checkFramebufferStatus(){return 'complete';},
    useProgram(v){step('useProgram',v);bindings.set('CURRENT_PROGRAM',v);},
    bindVertexArray(v){step('bindVertexArray',v);bindings.set('VERTEX_ARRAY_BINDING',v);},
    bindFramebuffer(k,v){step('bindFramebuffer',v);if(k!=='DRAW_FRAMEBUFFER')bindings.set('READ_FRAMEBUFFER_BINDING',v);
      if(k!=='READ_FRAMEBUFFER')bindings.set('DRAW_FRAMEBUFFER_BINDING',v);},
    blitFramebuffer(){step('blitFramebuffer');presentations++;},readPixels(){step('readPixels');},
  };
  for(const kind of ['Program','Shader','VertexArray','Buffer','Framebuffer','Texture','Renderbuffer']){
    gl['create'+kind]=()=>{step('create'+kind);const h={kind,id:++id};live.add(h);return h;};
    gl['delete'+kind]=h=>{step('delete'+kind,h);assert(live.delete(h),'no duplicate/foreign deletion');};
  }
  for(const name of ['shaderSource','compileShader','attachShader','detachShader','linkProgram','bindBuffer','bufferData',
    'enableVertexAttribArray','vertexAttribPointer','bindTexture','texParameteri','texStorage2D','bindRenderbuffer',
    'renderbufferStorage','framebufferTexture2D','framebufferRenderbuffer','viewport','disable','enable','depthFunc',
    'lineWidth','depthMask','colorMask','clearColor','clearDepth','clear','uniform1f','uniform1i','uniform3fv','uniformMatrix4fv','drawElements','pixelStorei'])
    gl[name]=(...values)=>step(name,values);
  const proxy=new Proxy(gl,{get(target,key){if(key in target)return Reflect.get(target,key);if(typeof key==='string'&&/^[A-Z_0-9]+$/.test(key))return key;
    throw Error('Unimplemented structural GL operation: '+String(key));}});
  class Canvas {
    width=256;height=256;
    getContext(kind){assert.equal(kind,'webgl2');step('getContext');return proxy;}
    addEventListener(kind,fn){step('addEventListener');listeners.add(fn);}
    removeEventListener(kind,fn){step('removeEventListener');listeners.delete(fn);}
  }
  const canvas=new Canvas();
  return {canvas,Canvas,log,live,listeners,faults,get presentations(){return presentations;},lose(){lost=true;}};
}
function owner() {
  const t=transport();globalThis.HTMLCanvasElement=t.Canvas;
  t.previous=gpu.mountQualifiedFaceScene(t.canvas,structuredClone(original));
  t.oldHandles=new Set(t.live);t.oldScene=t.previous.getScene();t.log.length=0;return t;
}
const handoff=gpu.handoffQualifiedFaceToPrimitiveViewport;
function terminal(t){assert.deepEqual(t.previous.getScene(),t.oldScene);assert.throws(()=>t.previous.readPixels(),e=>e.code==='DISPOSED');}

test('emitted QualifiedFace -> PrimitiveViewport admission, retirement, complete mount and failure flow', async()=>{
  const priorCanvas=globalThis.HTMLCanvasElement;
  try {
    assert.equal(typeof handoff,'function');assert.equal(gpu.preparePrimitiveViewportMountFrame,undefined,'internal CPU seam stays private');
    const declarations=await readFile(new URL('../dist/qualified-face-scene-renderer.d.ts',import.meta.url),'utf8');
    assert.match(declarations,/QualifiedFacePrimitiveViewportHandoffResult/);assert.match(declarations,/'atomic' \| 'dispose-remount'/);
    let reads=0;const forged=new Proxy(Object.create(gpu.QualifiedFaceSceneRenderer.prototype),{get(){reads++;throw Error('foreign getter');}});
    assert.equal(handoff(forged,frame,'dispose-remount').stage,'preflight');assert.equal(reads,0);
    assert.equal(handoff(null,frame,'dispose-remount').stage,'preflight');
    const t=owner(),initial=t.presentations;
    const poison=new Proxy({}, {getPrototypeOf(){throw Error('candidate must not be touched');}});
    assert.equal(handoff(t.previous,poison,'atomic').stage,'preflight');assert.equal(t.log.length,0);
    const bad=structuredClone(frame);bad.options.camera.near=-1;
    const refusal=handoff(t.previous,bad,'dispose-remount');assert.equal(refusal.stage,'preflight');assert(refusal.error instanceof RangeError);
    assert.equal(t.log.length,0);assert.deepEqual(t.previous.getScene(),t.oldScene);assert.equal(t.presentations,initial);
    let inner;const candidate=new Proxy(frame,{getPrototypeOf(value){inner=handoff(t.previous,frame,'dispose-remount');return Object.getPrototypeOf(value);}});
    const admitted=gpu.preparePrimitiveSceneFrame(frame,'viewport-v2').frame;
    t.previous.dispose=()=>{throw Error('caller lifecycle override');};t.previous.getScene=()=>{throw Error('caller snapshot override');};
    const result=handoff(t.previous,candidate,'dispose-remount');
    assert.equal(inner.stage,'preflight');assert.match(inner.error.message,/in progress/);
    assert.equal(result.ok,true,result.ok?'ready':result.stage+': '+result.error.stack);assert.equal(result.stage,'ready');assert(Object.isFrozen(result));
    assert(result.viewport instanceof gpu.PrimitiveViewport);assert.deepEqual(result.viewport.frame,admitted);
    assert.deepEqual(result.previousScene,t.oldScene);assert(Object.isFrozen(result.previousScene.assets[0].face));
    assert.notStrictEqual(result.previousScene,t.oldScene);assert.equal(t.presentations,initial+1);
    assert(t.oldHandles.size>0);for(const h of t.oldHandles)assert(!t.live.has(h),'old resource retired');
    const firstNew=t.log.findIndex(r=>r.name==='getContext'),lastOld=Math.max(...t.log.map((r,i)=>r.name.startsWith('delete')&&t.oldHandles.has(r.value)?i:-1));
    assert(firstNew>lastOld,'all old deletion before successor context/allocation');
    assert.throws(()=>gpu.QualifiedFaceSceneRenderer.prototype.readPixels.call(t.previous),e=>e.code==='DISPOSED');
    const before=t.log.length;assert.equal(handoff(t.previous,frame,'dispose-remount').error.code,'DISPOSED');assert.equal(t.log.length,before);
    result.viewport.dispose();assert.equal(t.live.size,0);assert.equal(t.listeners.size,0);

    const cleanup=owner(),cause=new Error('old delete refusal');cleanup.faults.deleteProgram=cause;
    const stopped=handoff(cleanup.previous,frame,'dispose-remount');assert.equal(stopped.stage,'retirement');
    assert.equal(stopped.error.code,'GPU');assert(stopped.error.cause.errors.includes(cause));
    assert(!cleanup.log.some(r=>r.name==='getContext'||r.name.startsWith('create')));terminal(cleanup);
    assert.equal(cleanup.live.size,1,'refused old program unresolved, every other handle attempted');
    delete cleanup.faults.deleteProgram;

    for(const fault of ['createBuffer','blitFramebuffer']){
      const failed=owner(),marker=new Error(fault+' refused');failed.faults[fault]=marker;
      const next=handoff(failed.previous,frame,'dispose-remount');assert.equal(next.stage,'mount');assert.strictEqual(next.error,marker);
      terminal(failed);assert.equal(failed.live.size,0);assert.equal(failed.listeners.size,0);
      const noRepeat=failed.log.length;assert.equal(handoff(failed.previous,frame,'dispose-remount').error.code,'DISPOSED');assert.equal(failed.log.length,noRepeat);
      delete failed.faults[fault];const recovered=gpu.mountPrimitiveViewportFrame(failed.canvas,frame);recovered.dispose();assert.equal(failed.live.size,0);
    }
    const foreignRealm=owner();globalThis.HTMLCanvasElement=class OtherCanvas {};
    assert.equal(handoff(foreignRealm.previous,frame,'dispose-remount').stage,'preflight');
    assert.equal(foreignRealm.log.length,0,'foreign realm refused before old graphics or retirement');
    globalThis.HTMLCanvasElement=foreignRealm.Canvas;foreignRealm.previous.dispose();assert.equal(foreignRealm.live.size,0);
    const unavailable=owner();unavailable.lose();const oldCount=unavailable.live.size;
    assert.equal(handoff(unavailable.previous,frame,'dispose-remount').error.code,'CONTEXT');assert.equal(unavailable.live.size,oldCount);
    unavailable.previous.dispose();assert.equal(unavailable.live.size,0);
    const resized=owner();resized.canvas.width=128;assert.equal(handoff(resized.previous,frame,'dispose-remount').stage,'preflight');
    assert(!resized.log.some(r=>r.name.startsWith('delete')));resized.previous.dispose();assert.equal(resized.live.size,0);
    assert.deepEqual(frame.scene.entries.map(e=>e.packet.surfaceId),original.assets.map(a=>a.face.topology.face.surfaceId));
  } finally {
    if(priorCanvas===undefined)delete globalThis.HTMLCanvasElement;else globalThis.HTMLCanvasElement=priorCanvas;
  }
});
