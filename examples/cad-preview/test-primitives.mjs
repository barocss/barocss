import test from 'node:test';import assert from 'node:assert/strict';
import * as cad from '../../packages/barocss-cad/dist/index.js';
import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import {preparePrimitive,dimensionUpdate} from './primitives.mjs';
import {createPreviewController} from './pipeline.mjs';
const near=(a,b)=>a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-9));
test('dimension tools emit actual existing native sheets and rational quarter walls',()=>{
 for(const kind of ['sheet','quarter-wall'])for(const [size,height] of [[100,100],[128.5,76.625],[1,300]]){
  const p=preparePrimitive({kind,size,height}),c=cad.compileConstruction(p.source),s=c.model.objects.find(o=>o.id==='surface');
  assert.equal(c.model.version,0);assert.equal(c.model.objects.length,2);assert.equal(c.constructions[0].inputId,'profile');
  near(cad.evaluateSurface(s,0,0),kind==='sheet'?[0,0,0]:[size,0,0]);near(cad.evaluateSurface(s,1,1),kind==='sheet'?[size,0,height]:[0,size,height]);
  if(kind==='sheet'){const d=cad.evaluateSurfaceD1(s,.37,.41);near(d.du,[size,0,0]);near(d.dv,[0,0,height]);}
  else near(cad.evaluateSurface(s,.5,.5),[size*Math.SQRT1_2,size*Math.SQRT1_2,height/2]);
  assert.equal(p.options.mmToSceneUnit,.01);assert.deepEqual(p.options.translate,[-size*.005,kind==='sheet'?0:-size*.005,-height*.005]);
  assert.equal(cad.exportIGES(c.model,['surface']).report.objects[0].entity,128);
 }
});
test('strict dimension limits reject executable or staged invalid payloads',()=>{
 let getters=0;const accessor={kind:'sheet',height:100,get size(){getters++;return100;}};
 for(const r of [accessor,{kind:'sheet',size:'100',height:100},{kind:'sheet',size:NaN,height:100},{kind:'sheet',size:0,height:100},{kind:'sheet',size:301,height:100},{kind:'solid',size:100,height:100},{kind:'sheet',size:100,height:100,extra:1},null])assert.throws(()=>preparePrimitive(r));
 assert.equal(getters,0);assert.throws(()=>dimensionUpdate({kind:'sheet',size:100,height:100}));
});
test('create/update are atomic and provenance-owned; unrelated source invalidates update',()=>{
 const listeners=new Map(),canvas={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};let reject=false,mounts=0;
 const rendering={...gpu,mountMesh(_canvas,packet){mounts++;let shown=packet;return{update(next){if(reject)return{ok:false,error:new Error('Creation draw failed')};shown=next;return{ok:true};},readPixels:()=>Uint8Array.of(shown.revision),dispose(){}};}};
 const host=createPreviewController(canvas,cad,rendering),p=preparePrimitive({kind:'sheet',size:100,height:100});
 assert(host.apply(p.source,{sourceVersion:1,surfaceId:'surface',countU:p.countU,countV:p.countV,options:p.options}).ok);assert.equal(host.primitiveState(),undefined);
 assert(host.createPrimitive({kind:'sheet',size:100,height:100},host.snapshot().source).ok);const before=host.snapshot(),owner=host.primitiveState();
 assert.equal(host.createPrimitive({kind:'quarter-wall',size:80,height:90},before.source+' pending').ok,false);assert.deepEqual(host.snapshot(),before);assert.deepEqual(host.primitiveState(),owner);
 reject=true;assert.equal(host.updateDimensions({size:120,height:50},before.source).ok,false);assert.deepEqual(host.snapshot(),before);assert.deepEqual(host.primitiveState(),owner);reject=false;
 const camera={...before.options.camera,eye:[5,4,7]};assert(host.setCamera(camera).ok);assert(host.updateDimensions({size:128.5,height:76.625},host.snapshot().source).ok);assert.deepEqual(host.snapshot().options.camera,camera);assert.equal(host.primitiveState().size,128.5);assert.equal(mounts,1);
 const ownedSource=host.snapshot().source;assert(host.apply(ownedSource,{sourceVersion:1,surfaceId:'surface',...host.snapshot().report.grid,options:host.snapshot().options}).ok);assert.equal(host.primitiveState(),undefined);assert.equal(host.updateDimensions({size:90,height:100},ownedSource).ok,false);
 assert(host.createPrimitive({kind:'quarter-wall',size:100,height:100},host.snapshot().source).ok);listeners.get('webglcontextlost')();assert.equal(host.updateDimensions({size:120,height:130},host.snapshot().source).ok,false);host.dispose();assert.equal(host.createPrimitive({kind:'sheet',size:100,height:100},host.snapshot().source).ok,false);
});
