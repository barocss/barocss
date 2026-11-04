/** Candidate ordinary ReactDOM registration tests, not native/Worker proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {loadSource} from './compile.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const h=React.createElement;
async function setup(t){
 const api=await loadSource(t,'src/index.ts'),div=document.createElement('div');document.body.append(div);const root=createRoot(div),complete=[],errors=[],events=[];
 const lifecycle={dirty(){events.push('dirty');},invalid(error){errors.push(error);events.push('invalid');},complete(model){complete.push(model);},detached(){events.push('detached');}};
 const render=children=>React.act(async()=>root.render(h(api.Part,{admission:'synchronous',lifecycle},children)));
 t.after(async()=>{await React.act(async()=>root.unmount());div.remove();});return{...api,render,complete,errors,events};
}
const section=f=>h(f.Rectangle,{min:[10,20],max:[20,50]});
test('normal wrapper leaf angle state lowers current parameters and restores exact profile/revolve Doc',async t=>{
 const f=await setup(t);let setAngle;
 function Sector(){const [angle,set]=React.useState(90);setAngle=set;return h(f.Revolve,{axis:'y',angle},section(f));}
 await f.render(h(Sector));const a=f.complete.at(-1);assert.deepEqual(a.doc.nodes.map(n=>n.kind),['sketch','revolve']);assert.equal(f.errors.length,0);
 for(const angle of [180,360]){await React.act(async()=>setAngle(angle));assert.equal(f.complete.at(-1).doc.nodes[1].angle,angle);assert.deepEqual(f.complete.at(-1).doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));}
 await React.act(async()=>setAngle(90));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('forward React profile and Revolve solid refs resolve through Definitions and transform composition',async t=>{
 const f=await setup(t);
 function Shared(){const profile=React.useRef(null),solid=React.useRef(null);return h(React.Fragment,null,h(f.Translate,{offset:[30,40,5]},h(f.Rotate,{axis:'z',angle:90,solid})),h(f.Definitions,null,h(f.Revolve,{ref:solid,axis:'y',angle:90,profile}),h(f.Rectangle,{ref:profile,min:[10,20],max:[20,50]})));}
 await f.render(h(Shared));assert.equal(f.errors.length,0);const doc=f.complete.at(-1).doc;assert.deepEqual(doc.nodes.map(n=>n.kind),['sketch','revolve','rotate','translate']);assert.equal(doc.nodes[1].sketch,0);assert.deepEqual(doc.nodes[2].parent,{node:1,side:'solid'});
});
test('keyed revolved operands retain mounted IDs on ordinary Union reorder',async t=>{
 const f=await setup(t),model=keys=>h(f.Union,null,keys.map(key=>h(f.Revolve,{key,axis:'y',angle:key==='a'?90:180},section(f))));
 await f.render(model(['a','b']));const before=f.complete.at(-1).doc.nodes.filter(n=>n.kind==='revolve').map(n=>n.id);await f.render(model(['b','a']));assert.deepEqual(f.complete.at(-1).doc.nodes.filter(n=>n.kind==='revolve').map(n=>n.id),before.toReversed());assert.equal(f.errors.length,0);
});
test('invalid latest angle/origin sends dirty-invalid without completing over accepted Doc',async t=>{
 const f=await setup(t),model=(angle,origin)=>h(f.Revolve,{axis:'y',angle,...(origin===undefined?{}:{origin})},section(f));await f.render(model(90));const prior=f.complete.at(-1),count=f.complete.length,events=f.events.length;
 await f.render(model(0));assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'INVALID_PARAMETER');const sparse=[0,0];delete sparse[1];await f.render(model(90,sparse));assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'INVALID_PARAMETER');assert.ok(f.events.slice(events).includes('dirty'));assert.ok(f.events.slice(events).includes('invalid'));
 await f.render(model(90));assert.deepEqual(f.complete.at(-1).doc,prior.doc);assert.equal(f.complete.at(-1).doc.nextId,prior.doc.nextId);
});
