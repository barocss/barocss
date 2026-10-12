import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const path=name=>process.env[name]?pathToFileURL(resolve(process.env[name])).href:null;
const {cad,CadModelError,CadModelLimits}=await import(path('CAD_MODEL_TEST_MODULE')??'../dist/index.js');
if(process.env.CAD_MODEL_TEST_MODULE)assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE&&process.env.CAD_MODEL_AUTHORED_HELPER_MODULE);
const {modelingGraphKey:key,modelingNodeParameters:refs,modelingReusablePrefix:prefix}=await import(path('CAD_MODEL_REGENERATION_HELPER_MODULE')??'../dist/modeling-regeneration-internal.js');
const {signedJson}=await import(path('CAD_MODEL_AUTHORED_HELPER_MODULE')??'../dist/xy-affine-prism-feature-document-internal.js');
const refuses=(fn,code,operation)=>assert.throws(fn,e=>e instanceof CadModelError&&e.code===code&&(!operation||e.operation===operation));
const pair=()=>{const m=cad.model(),a=m.sketch.rectangle({width:32,height:8}).extrude(8),b=m.sketch.rectangle({width:8,height:24}).extrude(8);return{m,a,b};};

test('union requires exact owned distinct handles and refusals do not consume its slot',()=>{
 const {m,a,b}=pair(),foreign=pair().a;
 for(const value of [foreign,{...b},{node:3,side:'solid'},{family:'orthogonal-cell',native:{}},null,undefined])refuses(()=>a.union(value),'OWNERSHIP');
 refuses(()=>a.union(a),'CAPABILITY');const result=a.union(b);assert.ok(Object.isFrozen(result));
 refuses(()=>a.union(b),'CAPABILITY');refuses(()=>result.union(a),'CAPABILITY');
 refuses(()=>result.edges({parallelTo:'x'}),'CAPABILITY');refuses(()=>result.split({axis:'z',at:4}),'CAPABILITY');
 refuses(()=>result.hole({center:[4,4],radius:1}),'CAPABILITY');
 refuses(()=>m.build({bracket:{...result}}),'OWNERSHIP');
 assert.equal(CadModelLimits.nodes,6);assert.equal(CadModelLimits.unions,1);
});

test('union admits only authored integer rectangles and refuses mixed operation graphs atomically',()=>{
 for(const create of [m=>m.sketch.polygon([[0,0],[32,0],[32,8],[0,8]]).extrude(8),m=>m.sketch.rectangle({width:31.5,height:8}).extrude(8),m=>m.sketch.rectangle({min:[.5,0],max:[32.5,8]}).extrude(8),m=>m.sketch.rectangle({width:32,height:8}).extrude(8.5),m=>m.sketch.rectangle({min:[-10000,0],max:[1,8]}).extrude(8)]){
  const m=cad.model(),a=create(m),b=m.sketch.rectangle({width:8,height:24}).extrude(8);refuses(()=>a.union(b),'CAPABILITY');
 }
 for(const operation of ['cut','intersect','split','chamfer','hole']){
  const {a,b}=pair();
  const act=()=>operation==='cut'?a.cut(b,{axis:'x'}):operation==='intersect'?a.intersect(b):operation==='split'?a.split({axis:'x',at:16}):operation==='hole'?a.hole({center:[16,4],radius:1}):a.chamfer(a.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
  act();refuses(()=>a.union(b),'CAPABILITY');
 }
 for(const operation of ['cut','intersect','split','chamfer','hole']){
  const {a,b}=pair();a.union(b);
  const act=()=>operation==='cut'?a.cut(b,{axis:'x'}):operation==='intersect'?a.intersect(b):operation==='split'?a.split({axis:'x',at:16}):operation==='hole'?a.hole({center:[16,4],radius:1}):a.chamfer(a.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
  refuses(act,'CAPABILITY');
 }
});
const document=()=>({format:'barocss-cad-model',schema:1,units:'mm',parameters:{x:-0,w:8,h:8},nodes:[
 {kind:'sketch',profile:'rectangle',min:[0,0],max:[32,8]},{kind:'extrude',sketch:0,height:8},
 {kind:'sketch',profile:'rectangle',min:[{parameter:'x'},-0],max:[{op:'add',left:{parameter:'x'},right:{parameter:'w'}},24]},
 {kind:'extrude',sketch:2,height:{parameter:'h'}},{kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'}}
],outputs:{bracket:{node:4,side:'negative'}}});
test('union codec validates all parents, dimensions and exact fields before output sentinel or geometry',()=>{
 const check=(edit,code='INPUT',operation)=>{const d=document();edit(d);refuses(()=>cad.load(signedJson(d)),code,operation);};
 check(()=>{},'INPUT','body');
 for(const field of ['left','right'])check(d=>{delete d.nodes[4][field];});
 check(d=>{d.nodes[4].mode='union';});
 for(const side of ['left','right']){
  for(const node of [4,5,-1,-0])check(d=>{d.nodes[4][side].node=node;});
  check(d=>{d.nodes[4][side].side='negative';});
 }
 check(d=>{d.nodes[4].right={...d.nodes[4].left};},'CAPABILITY','union');
 check(d=>{d.nodes[0]={kind:'sketch',profile:'polygon',points:[[0,0],[32,0],[0,8]]};},'CAPABILITY','union');
 for(const edit of [d=>{d.parameters.w=8.5;},d=>{d.parameters.x=.5;},d=>{d.parameters.h=.5;},d=>{d.nodes[0].min[0]=-10000;d.nodes[0].max[0]=1;}])check(edit,'CAPABILITY','union');
 check(d=>{d.nodes[2].max[0]={parameter:'missing'};},'PARAMETER');
 check(d=>{d.nodes.push({...d.nodes[4]});},'CAPABILITY');
 for(const node of [{kind:'intersect',left:{node:1,side:'solid'},right:{node:3,side:'solid'}},{kind:'cut',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'},axis:'x'},{kind:'split',parent:{node:1,side:'solid'},axis:'x',at:16},{kind:'hole',parent:{node:1,side:'solid'},center:[16,4],radius:1},{kind:'chamfer',parent:{node:1,side:'solid'},edge:{},distance:1}])check(d=>{d.nodes.push(node);},'CAPABILITY');
 check(d=>{d.nodes.push({kind:'chamfer',parent:{node:4,side:'solid'},edge:{},distance:1});},'CAPABILITY');
 check(d=>{d.nodes.push({kind:'union',left:{node:4,side:'solid'},right:{node:3,side:'solid'}});},'CAPABILITY','union');
 const d=document();assert.ok(signedJson(d).includes('"x":-0'));check(()=>{},'INPUT','body');
});
test('unchanged signed graph and dependency traversal track union parent edits and no-op prefixes',()=>{
 const d=document(),names=d.nodes.map(refs),k=key(d);
 assert.deepEqual(names,[[],[],['w','x'],['h'],[]]);
 assert.equal(prefix(true,k,k,d.parameters,d.parameters,names),5);
 for(const [changes,expected] of [[{w:12},2],[{x:0},2],[{h:16},3]])assert.equal(prefix(true,k,k,{...d.parameters,...changes},d.parameters,names),expected);
 const structural=structuredClone(d);structural.nodes[2].min[1]=0;assert.notEqual(key(structural),k);
 const reverse=structuredClone(d);[reverse.nodes[4].left,reverse.nodes[4].right]=[reverse.nodes[4].right,reverse.nodes[4].left];assert.notEqual(key(reverse),k);
 assert.equal(prefix(false,k,k,d.parameters,d.parameters,names),0);
});
