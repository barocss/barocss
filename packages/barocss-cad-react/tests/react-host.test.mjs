/** Real ReactDOM/jsdom realizes components. Complete callbacks are compiler results, not native geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
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
 const lifecycle={dirty(){events.push('dirty');},invalid(e){errors.push(e);},complete(x){complete.push(x);},detached(){events.push('detached');}};
 const render=children=>React.act(async()=>{root.render(h(api.Part,{admission:'synchronous',lifecycle},children));});
 t.after(async()=>{await React.act(async()=>root.unmount());div.remove();});
 return {...api,root,div,render,complete,errors,events,lifecycle};
}
test('normal nested function components, Fragment and leaf hooks automatically recompile without manual calls',async t=>{
 const f=await setup(t);let setWidth;
 function Profile(){const [w,set]=React.useState(80);setWidth=set;return h(f.Rectangle,{min:[0,0],max:[w,60]});}
 function Plate(){return h(React.Fragment,null,h(f.Extrude,{distance:6},h(Profile)));}
 await f.render(h(Plate));assert.equal(f.errors.length,0);assert.equal(f.complete.at(-1).doc.nodes[0].max[0],80);
 const before=f.complete.at(-1);await React.act(async()=>setWidth(100));const after=f.complete.at(-1);
 assert.equal(after.doc.nodes[0].max[0],100);assert.deepEqual(after.doc.nodes.map(x=>x.id),before.doc.nodes.map(x=>x.id));
});
test('forward object profile refs bind after real commit without reading current geometry during render',async t=>{
 const f=await setup(t);
 function Model(){const profile=React.useRef(null);return h(React.Fragment,null,
  h(f.Extrude,{distance:6,profile}),h(f.Definitions,null,h(f.Circle,{ref:profile,center:[0,0],radius:4})));}
 await f.render(h(Model));assert.equal(f.errors.length,0);const doc=f.complete.at(-1).doc;
 assert.deepEqual(doc.nodes.map(n=>n.kind),['sketch','extrude']);assert.equal(doc.nodes[0].profile,'circle');
});
test('keyed child reorder preserves mounted native IDs and a removed/remounted key gets a new ID',async t=>{
 const f=await setup(t);
 const plate=key=>h(f.Extrude,{key,distance:6},h(f.Rectangle,{min:[0,0],max:[10,10]}));
 const view=keys=>h(f.Union,null,keys.map(plate));
 await f.render(view(['a','b']));const first=f.complete.at(-1).doc.nodes.filter(n=>n.kind==='extrude').map(n=>n.id);
 await f.render(view(['b','a']));assert.deepEqual(f.complete.at(-1).doc.nodes.filter(n=>n.kind==='extrude').map(n=>n.id),first.toReversed());
 await f.render(view(['b','c']));assert.notEqual(f.complete.at(-1).doc.nodes.filter(n=>n.kind==='extrude')[1].id,first[0]);
});
test('invalid latest graph reports error and leaves compiler accepted Doc intact; no incomplete complete callback',async t=>{
 const f=await setup(t),profile=h(f.Rectangle,{min:[0,0],max:[10,10]});
 await f.render(h(f.Extrude,{distance:6},profile));const accepted=f.complete.at(-1),count=f.complete.length;
 await f.render(h(f.Extrude,{distance:6},h(f.Union,null,h(f.Extrude,{distance:6},profile),h(f.Extrude,{distance:6},profile))));
 assert.equal(f.complete.length,count);assert.equal(f.errors.at(-1).code,'TYPE');assert.equal(accepted.doc.nodes.length,2);
});
test('StrictMode cleanup and replay retain one valid final native graph; unmount retires lifecycle',async t=>{
 const f=await setup(t);await f.render(h(React.StrictMode,null,h(f.Extrude,{distance:6},h(f.Rectangle,{min:[0,0],max:[10,10]}))));
 assert.equal(f.errors.length,0);assert.equal(f.complete.at(-1).doc.nodes.length,2);
 await React.act(async()=>f.root.render(null));assert.ok(f.events.includes('detached'));
});
test('direct Suspense and portaled geometry fail closed; hidden internal Suspense is explicitly outside admission',async t=>{
 const f=await setup(t),plate=()=>h(f.Extrude,{distance:6},h(f.Rectangle,{min:[0,0],max:[10,10]}));
 await f.render(h(React.Suspense,{fallback:null},plate()));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'UNSUPPORTED_CAPABILITY');
 const target=document.createElement('div');document.body.append(target);t.after(()=>target.remove());
 await f.render(createPortal(plate(),target));assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'UNSUPPORTED_CAPABILITY');
});
test('a wrapper portal into a detached container cannot silently remove one operand from an otherwise valid Union',async t=>{
 const f=await setup(t),detached=document.createElement('div');
 function Plate(){return h(f.Extrude,{distance:6},h(f.Rectangle,{min:[0,0],max:[10,10]}));}
 function DetachedOperand(){return createPortal(h(Plate),detached);}
 await f.render(h(f.Union,null,h(Plate,{key:'a'}),h(Plate,{key:'b'}),h(DetachedOperand,{key:'c'})));
 assert.equal(f.complete.length,0);assert.equal(f.errors.at(-1).code,'UNSUPPORTED_CAPABILITY');
 await f.render(h(f.Union,null,h(Plate,{key:'a'}),h(Plate,{key:'b'})));
 assert.equal(f.complete.at(-1).doc.nodes.filter(n=>n.kind==='extrude').length,2,'normal unmount removes the detached registration before the next checkpoint');
});
