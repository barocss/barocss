/** Closed-profile declaration contracts only; no native geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const part=(...children)=>({kind:'part',units:'mm',children});
const rectangle=()=>({kind:'rectangle',min:[0,0],max:[60,40]});
const circle=(radius=6)=>({kind:'circle',center:[30,20],radius});
const composition=(radius=6)=>({kind:'profile',key:'profile',children:[{kind:'outer',children:[rectangle()]},{kind:'voids',children:[circle(radius)]}]});
const plate=(radius=6)=>part({kind:'extrude',key:'plate',distance:8,children:[composition(radius)]});
const accepted=r=>{assert.equal(r.ok,true,r.error?.message);return r.value;};
const rejects=(c,model,code,prior)=>{const r=c.compile(model);assert.equal(r.ok,false);assert.equal(r.error.code,code);if(prior)assert.equal(r.previous,prior);};
test('Profile consumes exact outer and circle descriptors without orphan sketches or IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),value=accepted(new CompositionCompiler().compile(plate()));
 assert.deepEqual(value.doc.nodes,[{id:'n0',kind:'sketch',profile:'rectangle',min:[0,0],max:[60,40],holes:[[{kind:'arc',start:[36,20],center:[30,20],direction:'ccw'}]]},{id:'n1',kind:'extrude',sketch:0,height:8}]);assert.equal(value.doc.nextId,2);assert.deepEqual(Object.values(value.sourceIds),['n0','n1']);
});
test('Loop preserves ordered mixed line/arc fields and copies them before immutable emission',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),start=[20,10],center=[10,10],model=part({kind:'extrude',distance:8,children:[{kind:'loop',children:[{kind:'line-segment',start:[0,0]},{kind:'line-segment',start:[20,0]},{kind:'arc-segment',start,center,direction:'ccw'},{kind:'line-segment',start:[0,10]}]}]});
 const got=accepted(new CompositionCompiler().compile(model));start[0]=999;center[1]=999;assert.deepEqual(got.doc.nodes[0],{id:'n0',kind:'sketch',profile:'loop',segments:[{kind:'line',start:[0,0]},{kind:'line',start:[20,0]},{kind:'arc',start:[20,10],center:[10,10],direction:'ccw'},{kind:'line',start:[0,10]}]});assert.equal(Object.isFrozen(got.doc.nodes[0].segments[2].center),true);
});
test('forward object references compose a Profile while separately consumed sources materialize only on demand',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),outline={},voidSource={},profile={};
 const model=part({kind:'union',children:[{kind:'extrude',distance:8,profile},{kind:'extrude',distance:4,profile:voidSource}]},{kind:'definitions',children:[{kind:'profile',bind:profile,children:[{kind:'outer',profile:outline},{kind:'voids',profiles:[voidSource]}]},{...rectangle(),bind:outline},{...circle(),bind:voidSource}]});
 const got=accepted(new CompositionCompiler().compile(model));assert.deepEqual(got.doc.nodes.map(n=>n.kind),['sketch','extrude','sketch','extrude','union']);assert.equal(got.doc.nodes[0].profile,'rectangle');assert.equal(got.doc.nodes[0].holes.length,1);assert.equal(got.doc.nodes[2].profile,'circle');assert.equal(got.doc.nextId,5);
});
test('new profile vocabulary feeds existing Extrude.profile and Revolve without adding a sketch-only prop',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),profile={};
 for(const op of [{kind:'extrude',distance:8},{kind:'revolve',axis:'y',angle:90}]){const doc=accepted(new CompositionCompiler().compile(part({...op,profile},{kind:'definitions',children:[{...composition(),bind:profile}]}))).doc;assert.equal(doc.nodes.length,2);assert.equal(doc.nodes[1].sketch,0);assert.equal(doc.nodes[0].holes.length,1);}
});
test('slot cardinality, exclusive refs and incompatible source kinds refuse before replacing accepted data',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),prior=accepted(c.compile(plate())),token={};
 const wrap=children=>part({kind:'extrude',distance:8,children:[{kind:'profile',children}]});
 const outer={kind:'outer',children:[rectangle()]},voids={kind:'voids',children:[circle()]};
 for(const [model,code]of [[wrap([]),'CARDINALITY'],[wrap([voids]),'CARDINALITY'],[wrap([outer,{...outer,key:'other'}]),'CARDINALITY'],[wrap([outer,voids,{...voids,key:'other'}]),'CARDINALITY'],[wrap([rectangle()]),'CARDINALITY'],[wrap([{kind:'outer',children:[]}]),'CARDINALITY'],[wrap([outer,{kind:'voids',children:[]}]),'CARDINALITY'],[wrap([outer,{kind:'voids',profiles:[]}]),'CARDINALITY'],[wrap([{kind:'outer',profile:token,children:[rectangle()]}]),'EXCLUSIVE_INPUT'],[wrap([outer,{kind:'voids',profiles:[token],children:[circle()]}]),'EXCLUSIVE_INPUT'],[wrap([{kind:'outer',children:[{kind:'extrude',distance:8,children:[rectangle()]}]}]),'TYPE']])rejects(c,model,code,prior);
});
test('descriptor cycles, duplicate bindings, missing and cross-Part tokens fail closed',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),a={},b={},token={};
 const cyclic=part({kind:'extrude',distance:8,profile:a},{kind:'definitions',children:[{kind:'profile',bind:a,children:[{kind:'outer',profile:b}]},{kind:'profile',bind:b,children:[{kind:'outer',profile:a}]}]});rejects(new CompositionCompiler(),cyclic,'CYCLE');
 rejects(new CompositionCompiler(),part({kind:'extrude',distance:8,profile:token}),'MISSING_REFERENCE');
 rejects(new CompositionCompiler(),part({kind:'extrude',distance:8,profile:token},{kind:'definitions',children:[{...composition(),bind:token},{...circle(),bind:token,key:'second'}]}),'DUPLICATE_BINDING');
 const first=new CompositionCompiler();accepted(first.compile(part({kind:'extrude',distance:8,profile:token},{kind:'definitions',children:[{...composition(),bind:token}]})));rejects(new CompositionCompiler(),part({kind:'extrude',distance:8,profile:token}),'MISSING_REFERENCE');
});
test('dense finite segment fields, direction and native declaration count budgets are explicit',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),wrap=children=>part({kind:'extrude',distance:8,children:[{kind:'loop',children}]});
 const prior=accepted(c.compile(plate()));
 const inherited=Array(1);Object.setPrototypeOf(inherited,Object.assign(Object.create(Array.prototype),{0:{kind:'line-segment',start:[0,0]}}));
 const sparseOuter=Array(1),inheritedOuter=Array(1);Object.setPrototypeOf(inheritedOuter,Object.assign(Object.create(Array.prototype),{0:rectangle()}));
 for(const invalid of [wrap(inherited),wrap({0:{kind:'line-segment',start:[0,0]},length:1}),part({kind:'extrude',distance:8,children:[{kind:'profile',children:[{kind:'outer',children:sparseOuter}]}]}),part({kind:'extrude',distance:8,children:[{kind:'profile',children:[{kind:'outer',children:inheritedOuter}]}]})]){
  rejects(c,invalid,'TYPE',prior);assert.equal(c.current,prior);assert.equal(c.current.doc.nextId,2);
 }
 assert.deepEqual(accepted(c.compile(plate())).doc,prior.doc);
 const sparse=[0,0];delete sparse[0];const sparseChildren=[{kind:'line-segment',start:[0,0]},null,{kind:'line-segment',start:[10,10]}];delete sparseChildren[1];
 for(const [segments,code]of [[[],'CARDINALITY'],[Array.from({length:1025},()=>({kind:'line-segment',start:[0,0]})),'CARDINALITY'],[[{kind:'line-segment',start:sparse}],'INVALID_PARAMETER'],[[{kind:'arc-segment',start:[1,0],center:[NaN,0],direction:'ccw'}],'INVALID_PARAMETER'],[[{kind:'arc-segment',start:[1,0],center:[0,0],direction:'left'}],'INVALID_PARAMETER'],[[circle()],'TYPE'],[sparseChildren,'TYPE']])rejects(c,wrap(segments),code);
 const many=Array.from({length:1024},(_,i)=>({kind:'line-segment',start:[i,i%3]}));assert.equal(accepted(c.compile(wrap(many))).doc.nodes[0].segments.length,1024);
});
test('Voids rejects sparse references and oversized lists; nested holed profiles are never flattened',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),wrap=slot=>part({kind:'extrude',distance:8,children:[{kind:'profile',children:[{kind:'outer',children:[rectangle()]},slot]}]});
 const refs=[{}];delete refs[0];rejects(c,wrap({kind:'voids',profiles:refs}),'MISSING_REFERENCE');rejects(c,wrap({kind:'voids',children:Array.from({length:65},()=>circle())}),'CARDINALITY');rejects(c,wrap({kind:'voids',children:[composition()]}),'UNSUPPORTED_CAPABILITY');rejects(c,part({kind:'extrude',distance:8,children:[{kind:'profile',children:[{kind:'outer',children:[composition()]}]}]}),'UNSUPPORTED_CAPABILITY');
});
test('unused profile descriptors emit no native nodes or IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),model=plate();model.children.push({kind:'definitions',children:[{...circle(),key:'unused'}]});const got=accepted(c.compile(model));assert.equal(got.doc.nodes.length,2);assert.equal(got.doc.nextId,2);assert.deepEqual(Object.values(got.sourceIds),['n0','n1']);
});
test('radius updates, rejected descriptors and exact recovery retain staged native IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),a=accepted(c.compile(plate(6))),b=accepted(c.compile(plate(8)));assert.deepEqual(b.doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));rejects(c,plate(NaN),'INVALID_PARAMETER',b);assert.deepEqual(accepted(c.compile(plate(6))).doc,a.doc);assert.equal(c.current.doc.nextId,2);
});
test('existing primitive lowering remains byte-exact after descriptor/materialization separation',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 for(const [producer,expected]of [[rectangle(),{id:'n0',kind:'sketch',profile:'rectangle',min:[0,0],max:[60,40]}],[circle(),{id:'n0',kind:'sketch',profile:'circle',center:[30,20],radius:6}],[{kind:'polygon',points:[[0,0],[10,0],[0,10]]},{id:'n0',kind:'sketch',profile:'polygon',points:[[0,0],[10,0],[0,10]]}]]){
  const got=accepted(new CompositionCompiler().compile(part({kind:'extrude',distance:8,children:[producer]})));const doc={format:'barocss-cad-model',schema:3,units:'mm',nextId:2,parameters:{},nodes:[expected,{id:'n1',kind:'extrude',sketch:0,height:8}],outputs:{result:{node:1,side:'solid'}}};assert.equal(got.fingerprint,JSON.stringify(doc));assert.deepEqual(got.doc,doc);
 }
});
