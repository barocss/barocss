/** Ordinary ReactDOM realizes the declarations. No native/Worker/GPU proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {loadSource} from './compile.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const h=React.createElement,points=width=>[[0,0],[width,0],[width,50],[10,50],[0,40]];
async function setup(t){
 const api=await loadSource(t,'src/index.ts'),div=document.createElement('div');document.body.append(div);const root=createRoot(div),complete=[],errors=[],events=[];
 const lifecycle={dirty(){events.push('dirty');},invalid(error){errors.push(error);events.push('invalid');},complete(model){complete.push(model);},detached(){events.push('detached');}};
 const render=children=>React.act(async()=>root.render(h(api.Part,{admission:'synchronous',lifecycle},children)));
 t.after(async()=>{await React.act(async()=>root.unmount());div.remove();});return{...api,render,complete,errors,events};
}
test('ordinary Polygon wrapper leaf state recalculates props and restores exact Doc with stable IDs',async t=>{
 const f=await setup(t);let setWidth;
 function Outline(){const[width,set]=React.useState(60);setWidth=set;return h(f.Polygon,{points:points(width)});}
 function Plate(){return h(React.Fragment,null,h(f.Extrude,{distance:8},h(Outline)));}
 await f.render(h(Plate));assert.equal(f.errors.length,0);const a=f.complete.at(-1);assert.equal(a.doc.nodes[0].profile,'polygon');
 await React.act(async()=>setWidth(80));assert.equal(f.complete.at(-1).doc.nodes[0].points[1][0],80);assert.deepEqual(f.complete.at(-1).doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));
 await React.act(async()=>setWidth(60));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('an ordinary ref-forwarding wrapper binds a forward Polygon source in Definitions',async t=>{
 const f=await setup(t);
 function Outline({ref,width}){return h(f.Polygon,{ref,points:points(width)});}
 function Shared(){const profile=React.useRef(null);return h(React.Fragment,null,h(f.Extrude,{distance:8,profile}),h(f.Definitions,null,h(Outline,{ref:profile,width:60})));}
 await f.render(h(Shared));assert.equal(f.errors.length,0);assert.deepEqual(f.complete.at(-1).doc.nodes.map(n=>n.kind),['sketch','extrude']);assert.deepEqual(f.complete.at(-1).doc.nodes[0].points,points(60));
});
test('keyed Polygon branches retain both profile and solid IDs through reorder and remount',async t=>{
 const f=await setup(t),view=keys=>h(f.Union,null,keys.map(key=>h(f.Extrude,{key,distance:key==='a'?8:10},h(f.Polygon,{points:points(60)}))));
 await f.render(view(['a','b']));const a=f.complete.at(-1).doc.nodes;const profileIds=a.filter(n=>n.kind==='sketch').map(n=>n.id),solidIds=a.filter(n=>n.kind==='extrude').map(n=>n.id);
 await f.render(view(['b','a']));const b=f.complete.at(-1).doc.nodes;assert.deepEqual(b.filter(n=>n.kind==='sketch').map(n=>n.id),profileIds.toReversed());assert.deepEqual(b.filter(n=>n.kind==='extrude').map(n=>n.id),solidIds.toReversed());
 await f.render(view(['b','c']));const c=f.complete.at(-1).doc.nodes;assert.equal(c[0].id,profileIds[1]);assert.notEqual(c[2].id,profileIds[0]);assert.notEqual(c[3].id,solidIds[0]);assert.equal(f.errors.length,0);
});
test('invalid latest Polygon sends dirty/invalid, retains accepted Doc, then recovers without consuming IDs',async t=>{
 const f=await setup(t),view=outline=>h(f.Extrude,{distance:8},h(f.Polygon,{points:outline}));await f.render(view(points(60)));const a=f.complete.at(-1),count=f.complete.length,start=f.events.length;
 const sparse=points(60);delete sparse[1][0];await f.render(view(sparse));assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'INVALID_PARAMETER');assert.ok(f.events.slice(start).includes('dirty'));assert.ok(f.events.slice(start).includes('invalid'));
 await f.render(view(points(80)));assert.equal(f.complete.at(-1).doc.nodes[0].points[1][0],80);assert.deepEqual(f.complete.at(-1).doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));
 await f.render(view(points(60)));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('Polygon cannot replace a solid operand or hide duplicate profile reference ownership',async t=>{
 const f=await setup(t);await f.render(h(f.Translate,{offset:[0,0,0]},h(f.Polygon,{points:points(60)})));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'TYPE');
 function Duplicate(){const profile=React.useRef(null);return h(React.Fragment,null,h(f.Extrude,{distance:8,profile}),h(f.Definitions,null,h(f.Polygon,{ref:profile,points:points(60)}),h(f.Polygon,{ref:profile,points:points(80)})));}
 await f.render(h(Duplicate));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'DUPLICATE_BINDING');
});
