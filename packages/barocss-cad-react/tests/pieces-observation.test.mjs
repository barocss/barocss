/** Forward original optional Model metadata; no native body-count inference. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const model={kind:'part',units:'mm',children:[{kind:'extrude',distance:8,children:[{kind:'rectangle',min:[0,0],max:[10,10]}]}]};
const response=(revision,pieces)=>({ok:true,revision,wallTime:0,bodies:[{key:'b1',volume:1600,mass:1.6,...(pieces===undefined?{}:{pieces}),mesh:{positions:new Float64Array([0,0,0]),normals:new Float32Array([0,0,1]),indices:new Uint32Array(),bounds:{min:[0,0,0],max:[30,10,8]}}}]});
async function ready(host){for(let i=0;i<30;i++){if(host.read().status==='ready')return;await new Promise(r=>setImmediate(r));}assert.fail('controlled host did not settle');}
test('one logical Model row with pieces2 remains accepted and read copies the present truth',async t=>{
 const {ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),requests=[],engine={evaluate(doc,revision){return new Promise(resolve=>requests.push({doc,revision,resolve}));},restart(){return true;},dispose(){},onFailure(){return()=>{};},onMasses(){return()=>{};}},shown=[];
 const host=new ModelHost({engine,ownership:'borrowed',sink:{show:async(bodies)=>shown.push(bodies),snapshot:()=>({}),dispose(){}},ownsSink:false,massPolicy:{merge:b=>b}});t.after(()=>host.dispose());host.connect();host.complete(new CompositionCompiler().compile(model).value);const original=response(requests[0].revision,2);requests[0].resolve(original);await ready(host);assert.equal(host.read().native.pieces,2);assert.equal(original.bodies[0].pieces,2);assert.equal(shown.length,1);host.dirty();assert.equal(host.read().native,null);
});
test('absent pieces stays absent; it is never replaced by an invented pieces1',async t=>{
 const {ModelHost,CompositionCompiler}=await loadSource(t,'tests/model-host-entry.ts'),engine={evaluate:async(doc,revision)=>response(revision),restart(){return true;},dispose(){},onFailure(){return()=>{};},onMasses(){return()=>{};}},host=new ModelHost({engine,ownership:'borrowed',sink:{show:async()=>{},snapshot:()=>({}),dispose(){}},ownsSink:false,massPolicy:{merge:b=>b}});t.after(()=>host.dispose());host.connect();host.complete(new CompositionCompiler().compile(model).value);await ready(host);assert.equal(Object.hasOwn(host.read().native,'pieces'),false);
});
