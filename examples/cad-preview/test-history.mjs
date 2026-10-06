import test from 'node:test';import assert from 'node:assert/strict';
import * as cad from '../../packages/barocss-cad/dist/index.js';import * as gpu from '../../packages/barocss-gpu/dist/index.js';
import {createProjectHistory,historyLimits} from './history.mjs';import {createPreviewController} from './pipeline.mjs';
import {fixtures,objectFixtures,parameterFixture} from './fixtures.mjs';
function setup(){const listeners=new Map();let reject=false,updates=0,mounts=0;const rendering={...gpu,mountMesh(){mounts++;return{update(){updates++;return reject?{ok:false,error:new Error('History draw failed')}:{ok:true};},readPixels:()=>Uint8Array.of(7),dispose(){}};}};
 const host=createPreviewController({addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},cad,rendering),f=fixtures[0];assert(host.apply(f.source,{surfaceId:f.id,countU:f.countU,countV:f.countV,options:f.options}).ok);return{host,listeners,fail:v=>reject=v,updates:()=>updates,mounts:()=>mounts};}
const source=h=>h.snapshot().source;
test('history captures completed outer actions once with final editable primitive ownership',()=>{
 const{host,updates,mounts}=setup();assert.equal(host.historyState().count,1);
 for(const kind of ['sheet','quarter-wall']){
  let n=host.historyState().count;assert(host.createPrimitive({kind,size:100,height:100},source(host)).ok);assert.equal(host.historyState().count,++n);
  assert(host.updateDimensions({size:128.5,height:76.625},source(host)).ok);assert.equal(host.historyState().count,++n);const first=host.projectState();
  assert(host.updateDimensions({size:140.25,height:90.75},source(host)).ok);assert.equal(host.historyState().count,++n);const second=host.projectState();
  const pose={...host.snapshot().options.camera,eye:[5,4,7],target:[-0,0,0],fovYDegrees:45.12345678901234};assert(host.setCamera(pose).ok);
  const before=host.historyState(),revision=host.snapshot().revision,calls=updates();assert(host.undo(source(host)).ok);assert.equal(updates(),calls+1);
  assert.deepEqual(host.projectState(),{...first,options:{...first.options,camera:pose}});assert.equal(host.primitiveState().size,128.5);assert.equal(host.snapshot().revision,revision+1);assert.equal(host.historyState().count,n);
  assert(host.redo(source(host)).ok);assert.deepEqual(host.projectState(),{...second,options:{...second.options,camera:pose}});assert.equal(host.historyState().cursor,before.cursor);assert.equal(host.historyState().count,n);
  const file=host.projectState();assert(host.loadProject(file,source(host)).ok);assert.equal(host.historyState().count,++n);assert.equal(host.primitiveState().kind,kind);
  const stable=host.historyState();host.projectState();host.snapshot();host.objects();host.inspection();assert(host.inspectObject('profile').ok);assert(host.setCamera(pose).ok);assert.deepEqual(host.historyState(),stable);
 }
 assert.equal(mounts(),1);
});
test('history failures retain cursor redo accepted primitive and pending data; source byte limit preflights adoption',()=>{
 const{host,fail,listeners,updates}=setup();assert(host.createPrimitive({kind:'sheet',size:100,height:100},source(host)).ok);assert(host.updateDimensions({size:120,height:80},source(host)).ok);assert(host.undo(source(host)).ok);
 const before=host.snapshot(),owner=host.primitiveState(),history=host.historyState();
 assert.equal(host.redo(source(host)+' pending').ok,false);assert.equal(host.undo(source(host)+' pending').ok,false);assert.deepEqual(host.historyState(),history);
 fail(true);const calls=updates();assert.equal(host.redo(source(host)).ok,false);assert.equal(updates(),calls+1);assert.deepEqual(host.historyState(),history);assert.deepEqual(host.snapshot(),before);assert.deepEqual(host.primitiveState(),owner);fail(false);
 for(const record of [{...host.projectState(),primitive:{kind:'quarter-wall',size:100,height:100}},{...host.projectState(),source:'invalid native'},{...host.projectState(),cachedProof:true}])assert.equal(host.loadProject(record,source(host)).ok,false);
 const f=fixtures[0],tooLarge=f.source+'/*'+'\n'.repeat(160000)+'*/';assert(cad.compileCadModel(tooLarge,{sourceVersion:0}).ok);const previousUpdates=updates();assert.equal(host.apply(tooLarge,{surfaceId:f.id,countU:17,countV:9,options:f.options}).ok,false);assert.equal(updates(),previousUpdates);assert.deepEqual(host.historyState(),history);assert.deepEqual(host.snapshot(),before);
 assert(host.createPrimitive({kind:'quarter-wall',size:100,height:100},source(host)).ok);assert.equal(host.historyState().redoCount,0);assert.equal(host.redo(source(host)).ok,false);
 const retained=host.snapshot(),retainedOwner=host.primitiveState(),retainedHistory=host.historyState();listeners.get('webglcontextlost')();assert.equal(host.undo(source(host)).ok,false);assert.equal(host.redo(source(host)).ok,false);assert.equal(host.historyState().cursor,retainedHistory.cursor);assert.equal(host.historyState().canUndo,false);assert.deepEqual(host.snapshot(),retained);assert.deepEqual(host.primitiveState(),retainedOwner);host.dispose();assert.equal(host.undo(source(host)).ok,false);
});
test('bounded history owns prepared data counts and target copies and deterministically evicts oldest states',()=>{
 const{host}=setup(),ledger=createProjectHistory(gpu),record=host.projectState();let getters=0;assert.throws(()=>ledger.commit({get text(){getters++;return 'foreign';}}));assert.equal(getters,0);
 assert.throws(()=>ledger.prepare({...record,extra:1}));assert.throws(()=>ledger.prepare({...record,options:{...record.options,translate:[0,NaN,0]}}));
 const prepared=ledger.prepare(record);assert(Object.isFrozen(prepared));ledger.commit(prepared);assert.throws(()=>ledger.commit(prepared));assert.throws(()=>ledger.move(99));assert.throws(()=>ledger.target(-1));
 const signed={...record,options:{...record.options,translate:[-0,0,0]}};ledger.commit(ledger.prepare(signed));ledger.move(0);const target=ledger.target(1);assert(Object.is(target.record.options.translate[0],-0));target.record.options.translate[0]=99;assert(Object.is(ledger.target(1).record.options.translate[0],-0));
 const f=fixtures[0];for(let i=0;i<25;i++)assert(host.apply(f.source+`/* ${i} */`,{surfaceId:f.id,countU:17,countV:9,options:f.options}).ok);
 const state=host.historyState();assert.equal(state.count,20);assert.equal(state.undoCount,19);assert(state.bytes<=state.maxBytes);assert.equal(state.maxBytes,8*1024*1024);assert.equal(historyLimits.states,20);
 state.cursor=-100;assert.equal(host.historyState().cursor,19);for(let i=0;i<19;i++)assert(host.undo(source(host)).ok);assert(source(host).endsWith('/* 5 */'));const bounded=host.snapshot();assert.equal(host.undo(source(host)).ok,false);assert.deepEqual(host.snapshot(),bounded);for(let i=0;i<19;i++)assert(host.redo(source(host)).ok);assert(source(host).endsWith('/* 24 */'));
});
test('manual v0/v1 source typed fixture and Show histories restore selected objects without stale primitive identity',()=>{
 const{host}=setup();for(const f of objectFixtures){let n=host.historyState().count;assert(host.apply(f.source,{sourceVersion:f.sourceVersion,surfaceId:'wall',countU:f.countU,countV:f.countV,options:f.options}).ok);assert.equal(host.historyState().count,++n);
 assert(host.showSurface('oblique_wall').ok);assert.equal(host.historyState().count,++n);assert(host.undo(source(host)).ok);assert.equal(host.snapshot().packet.surfaceId,'wall');assert.equal(host.inspectedId,'wall');assert(host.redo(source(host)).ok);assert.equal(host.snapshot().packet.surfaceId,'oblique_wall');assert.equal(host.primitiveState(),undefined);}
 const f=parameterFixture;assert(host.apply(f.source,{sourceVersion:1,surfaceId:'wall',countU:17,countV:9,options:f.options}).ok);const count=host.historyState().count,old=host.projectState();assert(host.applyParameters({vector:[0,0,40]},source(host)).ok);assert.equal(host.historyState().count,count+1);assert(host.undo(source(host)).ok);assert.deepEqual(host.projectState(),old);
});
