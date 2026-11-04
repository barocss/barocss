/** Candidate controlled declaration tests; run only after approved production adoption. No native evaluation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const profile=()=>({kind:'rectangle',key:'section',min:[10,20],max:[20,50]});
const part=(...children)=>({kind:'part',units:'mm',children});
const accepted=r=>{assert.equal(r.ok,true,r.error?.message);return r.value;};
const model=(angle=90,extra={})=>part({kind:'revolve',key:'sector',axis:'y',angle,children:[profile()],...extra});
test('Revolve lowers one closed profile through existing native sketch/revolve nodes without public IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const got=accepted(new CompositionCompiler().compile(model()));
 assert.deepEqual(got.doc.nodes,[{id:'n0',kind:'sketch',profile:'rectangle',min:[10,20],max:[20,50]},{id:'n1',kind:'revolve',sketch:0,axis:'y',angle:90}]);assert.deepEqual(got.doc.outputs,{result:{node:1,side:'solid'}});assert.equal(got.doc.nextId,2);assert.equal(Object.hasOwn(got.doc.nodes[1],'origin'),false);
});
test('Revolve preserves explicit numeric origin and full-angle/axis parameters without a frontend transform',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const origin=[7,9];const got=accepted(new CompositionCompiler().compile(model(360,{axis:'x',origin})));origin[0]=100;
 assert.deepEqual(got.doc.nodes[1],{id:'n1',kind:'revolve',sketch:0,axis:'x',angle:360,origin:[7,9]});
});
test('forward profile and resulting solid references compose with existing Boolean and rigid nodes',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const section={},sector={};
 const got=accepted(new CompositionCompiler().compile(part({kind:'translate',offset:[30,40,5],children:[{kind:'rotate',axis:'z',angle:90,children:[{kind:'difference',children:[{kind:'target',solid:sector},{kind:'tools',children:[{kind:'extrude',distance:8,children:[{kind:'circle',center:[15,25],radius:1}]}]}]}]}]},{kind:'definitions',children:[{kind:'revolve',bind:sector,axis:'y',angle:90,profile:section},{...profile(),bind:section}]})));
 assert.deepEqual(got.doc.nodes.map(n=>n.kind),['sketch','revolve','sketch','extrude','difference','rotate','translate']);assert.equal(got.doc.nodes[1].sketch,0);assert.deepEqual(got.doc.nodes.at(-1).parent,{node:5,side:'solid'});
});
test('new revolve axis/angle/origin guards preserve prior accepted Doc and staged IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),prior=accepted(c.compile(model()));
 const sparse0=[0,0],sparse1=[0,0];delete sparse0[0];delete sparse1[1];
 for(const extra of [{axis:'z'},{angle:0},{angle:-90},{angle:360.001},{angle:NaN},{angle:Infinity},{origin:[0]},{origin:[0,0,0]},{origin:[NaN,0]},{origin:[0,Infinity]},{origin:sparse0},{origin:sparse1}]){
  const bad=c.compile(model(90,extra));assert.equal(bad.ok,false);assert.equal(bad.error.code,'INVALID_PARAMETER');assert.equal(bad.previous,prior);
 }
 assert.equal(accepted(c.compile(model())),prior);assert.equal(prior.doc.nextId,2);
});
test('profile cardinality, exclusive source, wrong-kind and scoped references fail closed',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),prior=accepted(c.compile(model())),missing={};
 for(const [input,code]of [[model(90,{children:[]}),'CARDINALITY'],[model(90,{children:[profile(),{...profile(),key:'section-2'}]}),'CARDINALITY'],[model(90,{profile:missing}),'EXCLUSIVE_INPUT'],[part({kind:'revolve',axis:'y',angle:90,profile:missing}),'MISSING_REFERENCE'],[model(90,{children:[{kind:'extrude',distance:6,children:[profile()]}]}),'TYPE']]){
  const bad=c.compile(input);assert.equal(bad.ok,false);assert.equal(bad.error.code,code);assert.equal(bad.previous,prior);
 }
 assert.equal(accepted(c.compile(model())),prior);
});
test('selected angle updates and return keep mounted profile/revolve IDs and exact initial Doc',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),identity={},decl=angle=>model(angle,{identity}),a=accepted(c.compile(decl(90)));
 for(const angle of [180,360]){const next=accepted(c.compile(decl(angle)));assert.deepEqual(next.doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));assert.equal(next.doc.nodes[1].angle,angle);}
 const back=accepted(c.compile(decl(90)));assert.deepEqual(back.doc,a.doc);
});
