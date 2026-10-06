import test from 'node:test';
import assert from 'node:assert/strict';
import * as cad from '../../packages/barocss-cad/dist/index.js';
import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import {fixtures,objectFixtures} from './fixtures.mjs';
import {createPreviewController} from './pipeline.mjs';
import {parseProject,serializeProject,validateProject,projectByteLimit} from './project.mjs';
function setup(){
 const listeners=new Map();let fail=false,updates=0;
 const rendering={...gpu,mountMesh(){return{update(){updates++;return fail?{ok:false,error:new Error('Project draw failed')}:{ok:true};},readPixels:()=>Uint8Array.of(7),dispose(){}};}};
 const host=createPreviewController({addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},cad,rendering),f=fixtures[0];
 assert(host.apply(f.source,{surfaceId:f.id,countU:f.countU,countV:f.countV,options:f.options}).ok);
 return{host,listeners,setFail:v=>fail=v,updates:()=>updates};
}
test('project accepted record preserves full binary64 and negative zero without cached proof',()=>{
 const {host}=setup();assert(host.createPrimitive({kind:'quarter-wall',size:42.375,height:76.625},host.snapshot().source).ok);
 const file=host.projectState();file.options.translate[1]=-0;file.options.camera.target[0]=-0;file.options.color[0]=0.12345678901234568;
 const text=serializeProject(file,gpu),loaded=parseProject(text,gpu);
 assert(Object.is(loaded.options.translate[1],-0));assert(Object.is(loaded.options.camera.target[0],-0));assert.deepEqual(loaded,file);
 assert(!Object.hasOwn(file,'revision'));assert(!Object.hasOwn(file,'model'));assert(host.loadProject(loaded,host.snapshot().source).ok);
 assert.deepEqual(host.projectState(),loaded);assert(host.updateDimensions({size:55.125,height:90.75},host.snapshot().source).ok);assert.deepEqual(host.snapshot().options.camera,loaded.options.camera);
 const owned=host.projectState();owned.options.color[0]=1;assert.notEqual(host.projectState().options.color[0],1);
});
test('project strict file, data, metadata and native guards retain accepted state',()=>{
 const {host,updates}=setup();const before=host.snapshot(),record=host.projectState();let calls=0;
 const accessor={...record};Object.defineProperty(accessor,'source',{enumerable:true,get(){calls++;return record.source;}});
 const foreign={...record,constructor:1},sparse={...record,options:{...record.options,translate:new Array(3)}};
 for(const bad of [accessor,foreign,sparse,{...record,version:2},{...record,format:'other'},{...record,sourceVersion:2},{...record,source:''},{...record,extra:1},{...record,grid:{countU:65,countV:9}},{...record,options:{...record.options,mmToSceneUnit:NaN}},{...record,options:{...record.options,translate:[0,Infinity,0]}},{...record,primitive:{kind:'sheet',size:100,height:100}},{...record,source:'invalid source'},{...record,surfaceId:'unknown'}]){
  assert.equal(host.loadProject(bad,before.source).ok,false);assert.deepEqual(host.snapshot(),before);assert.equal(updates(),0);
 }
 assert.equal(calls,0);
 for(const text of ['', '{', 'null', '{"__proto__":{}}',' '.repeat(projectByteLimit+1),serializeProject(record,gpu).replace('"version":1','"version":1e999')])assert.throws(()=>parseProject(text,gpu));
 const cycle={...record};cycle.options=cycle;assert.throws(()=>validateProject(cycle,gpu));
 const sym={...record};sym[Symbol('x')]=0;assert.throws(()=>validateProject(sym,gpu));
 const hidden={...record};Object.defineProperty(hidden,'hidden',{value:0});assert.throws(()=>validateProject(hidden,gpu));
 assert.equal(host.loadProject(record,before.source+' pending').ok,false);assert.deepEqual(host.snapshot(),before);
});
test('project load is one atomic apply; ownership survives failed draw/loss/dispose and manual disables update',()=>{
 const {host,setFail,listeners,updates}=setup();assert(host.createPrimitive({kind:'sheet',size:128.5,height:76.625},host.snapshot().source).ok);
 const saved=host.projectState(),before=host.snapshot(),owner=host.primitiveState(),count=updates();
 setFail(true);assert.equal(host.loadProject(saved,before.source).ok,false);assert.equal(updates(),count+1);assert.deepEqual(host.snapshot(),before);assert.deepEqual(host.primitiveState(),owner);setFail(false);
 assert(host.loadProject(saved,before.source).ok);assert.equal(updates(),count+2);assert.equal(host.snapshot().revision,before.revision+1);assert.deepEqual(host.projectState(),saved);
 const manual={...saved,primitive:null};assert(host.loadProject(manual,host.snapshot().source).ok);assert.equal(host.primitiveState(),undefined);assert.equal(host.updateDimensions({size:100,height:100},host.snapshot().source).ok,false);
 const f=objectFixtures[1];const multi={...manual,sourceVersion:f.sourceVersion,source:f.source,surfaceId:'arc',primitive:null};assert.equal(host.loadProject(multi,host.snapshot().source).ok,false);
 assert(host.loadProject(saved,host.snapshot().source).ok);const current=host.snapshot();listeners.get('webglcontextlost')();assert.equal(host.loadProject(saved,current.source).ok,false);assert.deepEqual(host.snapshot(),current);assert.deepEqual(host.primitiveState(),owner);host.dispose();assert.equal(host.loadProject(saved,current.source).ok,false);
});
