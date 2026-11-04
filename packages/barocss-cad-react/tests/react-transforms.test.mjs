/** Real ReactDOM transform registration; compiler results only, no native geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {loadSource} from './compile.mjs';
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const h=React.createElement;
async function setup(t){
 const api=await loadSource(t,'src/index.ts'),div=document.createElement('div');document.body.append(div);
 const root=createRoot(div),complete=[],errors=[],events=[];
 const lifecycle={dirty(){events.push('dirty');},invalid(error){errors.push(error);events.push('invalid');},complete(result){complete.push(result);},detached(){events.push('detached');}};
 const render=children=>React.act(async()=>{root.render(h(api.Part,{admission:'synchronous',lifecycle},children));});
 t.after(async()=>{await React.act(async()=>root.unmount());div.remove();});
 return {...api,render,complete,errors,events};
}
function slab(f){return h(f.Extrude,{distance:6},h(f.Rectangle,{min:[0,0],max:[80,60]}));}
test('real transform wrappers and leaf state commit Rotate before Translate and restore exact Doc/IDs',async t=>{
 const f=await setup(t);let change;
 function Positioned(){const [state,set]=React.useState({dx:30,angle:90});change=set;return h(f.Translate,{offset:[state.dx,40,5]},h(f.Rotate,{axis:'z',angle:state.angle},slab(f)));}
 await f.render(h(Positioned));const a=f.complete.at(-1);assert.equal(f.errors.length,0);assert.deepEqual(a.doc.nodes.map(n=>n.kind),['sketch','extrude','rotate','translate']);
 assert.deepEqual(a.doc.nodes[2].parent,{node:1,side:'solid'});assert.deepEqual(a.doc.nodes[3].parent,{node:2,side:'solid'});
 await React.act(async()=>change({dx:50,angle:90}));const b=f.complete.at(-1);assert.deepEqual(b.doc.nodes.at(-1).offset,[50,40,5]);
 await React.act(async()=>change({dx:50,angle:180}));const c=f.complete.at(-1);assert.equal(c.doc.nodes.at(-2).angle,180);
 for(const value of [b,c])assert.deepEqual(value.doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));
 await React.act(async()=>change({dx:30,angle:90}));assert.deepEqual(f.complete.at(-1).doc,a.doc);
});
test('real forward solid refs in Definitions feed transforms without requiring manual native IDs',async t=>{
 const f=await setup(t);
 function Shared(){const source=React.useRef(null),rotated=React.useRef(null);return h(React.Fragment,null,
  h(f.Translate,{offset:[30,40,5],solid:rotated}),
  h(f.Definitions,null,h(f.Rotate,{ref:rotated,axis:'z',angle:0,solid:source}),h(f.Extrude,{ref:source,distance:6},h(f.Rectangle,{min:[0,0],max:[80,60]}))));}
 await f.render(h(Shared));assert.equal(f.errors.length,0);const doc=f.complete.at(-1).doc;
 assert.deepEqual(doc.nodes.map(n=>n.kind),['sketch','extrude','rotate','translate']);assert.equal(Object.hasOwn(doc.nodes[2],'pivot'),false);
 assert.deepEqual(doc.nodes[2].parent,{node:1,side:'solid'});assert.deepEqual(doc.nodes[3].parent,{node:2,side:'solid'});assert.deepEqual(doc.outputs,{result:{node:3,side:'solid'}});
});
test('keyed transform reorder preserves mounted operator identity and current parent refs',async t=>{
 const f=await setup(t),model=keys=>h(f.Union,null,keys.map(key=>h(f.Translate,{key,offset:[key==='a'?0:100,0,0]},h(f.Rotate,{axis:'z',angle:90},slab(f)))));
 await f.render(model(['a','b']));const first=f.complete.at(-1).doc,ids=first.nodes.filter(n=>n.kind==='translate').map(n=>n.id);
 await f.render(model(['b','a']));const next=f.complete.at(-1).doc;assert.deepEqual(next.nodes.filter(n=>n.kind==='translate').map(n=>n.id),ids.toReversed());
 for(const node of next.nodes.filter(n=>n.kind==='translate')){assert.equal(next.nodes[node.parent.node].kind,'rotate');assert.equal(node.parent.side,'solid');}
 assert.equal(f.errors.length,0);
});
test('invalid latest transform retires through dirty/invalid lifecycle without completing over prior accepted Doc',async t=>{
 const f=await setup(t),model=offset=>h(f.Translate,{offset},h(f.Rotate,{axis:'z',angle:90},slab(f)));
 await f.render(model([30,40,5]));const accepted=f.complete.at(-1),count=f.complete.length,eventCount=f.events.length;
 const sparse=[30,40,5];delete sparse[1];await f.render(model(sparse));
 assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'INVALID_PARAMETER');assert.ok(f.events.slice(eventCount).includes('dirty'));assert.ok(f.events.slice(eventCount).includes('invalid'));assert.deepEqual(accepted.doc.nodes.at(-1).offset,[30,40,5]);
 await f.render(model([30,40,5]));assert.deepEqual(f.complete.at(-1).doc,accepted.doc);assert.equal(f.complete.at(-1).doc.nextId,accepted.doc.nextId);
});
