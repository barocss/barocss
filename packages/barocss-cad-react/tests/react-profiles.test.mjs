/** Ordinary ReactDOM registration only; no geometry/Worker/Viewer certificate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {loadSource} from './compile.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});globalThis.window=dom.window;globalThis.document=dom.window.document;Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;const h=React.createElement;
async function setup(t){const api=await loadSource(t,'src/index.ts'),div=document.createElement('div');document.body.append(div);const root=createRoot(div),complete=[],errors=[],events=[];const lifecycle={dirty(){events.push('dirty');},invalid(error){errors.push(error);events.push('invalid');},complete(value){complete.push(value);},detached(){events.push('detached');}};const render=children=>React.act(async()=>root.render(h(api.Part,{admission:'synchronous',lifecycle},children)));t.after(async()=>{await React.act(async()=>root.unmount());div.remove();});return{...api,render,complete,errors,events};}
const profile=(f,radius=6)=>h(f.Profile,null,h(f.Outer,null,h(f.Rectangle,{min:[0,0],max:[60,40]})),h(f.Voids,null,h(f.Circle,{center:[30,20],radius})));
test('ordinary nested wrappers and leaf radius state update composite geometry without orphan native nodes',async t=>{
 const f=await setup(t);let setRadius;
 function BoredProfile(){const[radius,set]=React.useState(6);setRadius=set;return profile(f,radius);}
 function Plate(){return h(React.Fragment,null,h(f.Extrude,{distance:8},h(BoredProfile)));}
 await f.render(h(Plate));assert.equal(f.errors.length,0);const a=f.complete.at(-1);assert.equal(a.doc.nodes.length,2);assert.deepEqual(a.doc.nodes[0].holes[0][0].start,[36,20]);
 await React.act(async()=>setRadius(8));assert.deepEqual(f.complete.at(-1).doc.nodes[0].holes[0][0].start,[38,20]);assert.deepEqual(f.complete.at(-1).doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));await React.act(async()=>setRadius(6));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('forward ordinary refs through Definitions/Outer/Voids bind descriptor sources without materializing them',async t=>{
 const f=await setup(t);
 function Shared(){const outline=React.useRef(null),bore=React.useRef(null),result=React.useRef(null);return h(React.Fragment,null,h(f.Extrude,{distance:8,profile:result}),h(f.Definitions,null,h(f.Profile,{ref:result},h(f.Outer,{profile:outline}),h(f.Voids,{profiles:[bore]})),h(f.Rectangle,{ref:outline,min:[0,0],max:[60,40]}),h(f.Circle,{ref:bore,center:[30,20],radius:6})));}
 await f.render(h(Shared));assert.equal(f.errors.length,0);const got=f.complete.at(-1);assert.equal(got.doc.nodes.length,2);assert.equal(got.doc.nextId,2);assert.deepEqual(Object.values(got.sourceIds),['n0','n1']);
});
test('Loop child order follows realized keyed segments while its own mounted feature ID remains stable',async t=>{
 const f=await setup(t),starts={a:[0,0],b:[60,0],c:[60,40],d:[0,40]},view=keys=>h(f.Extrude,{distance:8},h(f.Loop,null,keys.map(key=>h(f.LineSegment,{key,start:starts[key]}))));
 await f.render(view(['a','b','c','d']));const a=f.complete.at(-1);await f.render(view(['c','d','a','b']));const b=f.complete.at(-1);assert.equal(f.errors.length,0);assert.deepEqual(b.doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));assert.deepEqual(b.doc.nodes[0].segments.map(s=>s.start),[starts.c,starts.d,starts.a,starts.b]);
});
test('one full ArcSegment is a closed-loop descriptor and works as an explicit void',async t=>{
 const f=await setup(t);await f.render(h(f.Extrude,{distance:8},h(f.Profile,null,h(f.Outer,null,h(f.Rectangle,{min:[0,0],max:[60,40]})),h(f.Voids,null,h(f.Loop,null,h(f.ArcSegment,{start:[36,20],center:[30,20],direction:'ccw'}))))));
 assert.equal(f.errors.length,0);assert.equal(f.complete.at(-1).doc.nodes.length,2);assert.deepEqual(f.complete.at(-1).doc.nodes[0].holes,[[{kind:'arc',start:[36,20],center:[30,20],direction:'ccw'}]]);
});
test('invalid latest slot graph retains prior checkpoint and valid recovery preserves IDs',async t=>{
 const f=await setup(t),view=voids=>h(f.Extrude,{distance:8},h(f.Profile,null,h(f.Outer,null,h(f.Rectangle,{min:[0,0],max:[60,40]})),h(f.Voids,null,voids)));
 await f.render(view(h(f.Circle,{center:[30,20],radius:6})));const a=f.complete.at(-1),count=f.complete.length,start=f.events.length;
 await f.render(view(null));assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'CARDINALITY');assert.ok(f.events.slice(start).includes('dirty'));assert.ok(f.events.slice(start).includes('invalid'));
 await f.render(view(h(f.Circle,{center:[30,20],radius:6})));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('segment/profile/solid kinds and duplicate slots are distinct runtime contracts',async t=>{
 const f=await setup(t);await f.render(h(f.Extrude,{distance:8},h(f.Loop,null,h(f.Circle,{center:[0,0],radius:2}))));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'TYPE');
 await f.render(h(f.Extrude,{distance:8},h(f.Profile,null,h(f.Outer,null,h(f.Rectangle,{min:[0,0],max:[60,40]})),h(f.Voids,{key:'a'},h(f.Circle,{center:[30,20],radius:6})),h(f.Voids,{key:'b'},h(f.Circle,{center:[15,20],radius:3})))));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'CARDINALITY');
});
