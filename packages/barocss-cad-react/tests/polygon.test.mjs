/** Declaration contracts only. No native geometry or Viewer execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const points=width=>[[0,0],[width,0],[width,50],[10,50],[0,40]];
const polygon=(extra={})=>({kind:'polygon',key:'outline',points:points(60),...extra});
const part=(...children)=>({kind:'part',units:'mm',children});
const plate=(width=60)=>part({kind:'extrude',key:'plate',distance:8,children:[polygon({points:points(width)})]});
const accepted=r=>{assert.equal(r.ok,true,r.error?.message);return r.value;};
test('Polygon lowers exact copied coordinates to existing sketch storage and signed extrusion',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),input=points(60),model=plate();model.children[0].children[0].points=input;
 const value=accepted(new CompositionCompiler().compile(model));input[1][0]=900;input.push([20,20]);
 assert.deepEqual(value.doc.nodes,[{id:'n0',kind:'sketch',profile:'polygon',points:points(60)},{id:'n1',kind:'extrude',sketch:0,height:8}]);
 assert.equal(Object.isFrozen(value.doc.nodes[0].points[0]),true);assert.deepEqual(value.doc.outputs,{result:{node:1,side:'solid'}});
 model.children[0].distance=-8;model.children[0].children[0].points=points(60);assert.equal(accepted(new CompositionCompiler().compile(model)).doc.nodes[1].height,-8);
});
test('Polygon count and every indexed coordinate reject sparse, inherited, nonfinite and malformed data',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),prior=accepted(c.compile(plate()));
 const sparse=points(60);delete sparse[2];const sparseX=points(60);delete sparseX[1][0];const sparseY=points(60);delete sparseY[1][1];
 const inherited=points(60);delete inherited[1];Object.setPrototypeOf(inherited,{1:[60,0]});
 const inheritedX=points(60);delete inheritedX[1][0];Object.setPrototypeOf(inheritedX[1],{0:60});
 for(const invalid of [null,{},[],[[0,0],[1,0]],new Array(1025).fill([0,0]),sparse,sparseX,sparseY,inherited,inheritedX,[[0,0],[1,0],[0,NaN]],[[0,0],[1,Infinity],[0,1]],[[0,0],['1',0],[0,1]],[[0,0],[1,0,3],[0,1]]]){
  const bad=plate();bad.children[0].children[0].points=invalid;const result=c.compile(bad);
  assert.equal(result.ok,false);assert.equal(result.error.code,'INVALID_PARAMETER');assert.equal(result.previous,prior);
 }
 assert.equal(accepted(c.compile(plate())),prior);assert.equal(prior.doc.nextId,2);
});
test('Polygon accepts 3 and 1024 declared points without resampling, deduplication or geometry repair',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 for(const outline of [[[0,0],[10,0],[0,10]],Array.from({length:1024},(_,i)=>[i,i%3])]){
  const model=plate();model.children[0].children[0].points=outline;assert.deepEqual(accepted(new CompositionCompiler().compile(model)).doc.nodes[0].points,outline);
 }
 // Degeneracy/contact/closure is the existing engine's decision, not a new frontend geometric oracle.
 const model=plate();model.children[0].children[0].points=[[0,0],[0,0],[0,0]];assert.deepEqual(accepted(new CompositionCompiler().compile(model)).doc.nodes[0].points,[[0,0],[0,0],[0,0]]);
});
test('Polygon supports forward profile tokens for Extrude and Revolve with the existing source contract',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),token={};
 for(const operation of [{kind:'extrude',distance:8},{kind:'revolve',axis:'y',angle:90}]){
  const doc=accepted(new CompositionCompiler().compile(part({...operation,profile:token},{kind:'definitions',children:[polygon({bind:token})]}))).doc;
  assert.equal(doc.nodes[0].profile,'polygon');assert.equal(doc.nodes[1].sketch,0);
 }
});
test('Polygon input cardinality, token kinds, duplicates and scope remain fail-closed',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),token={},solid={};
 const cases=[
  [part({kind:'extrude',distance:8,profile:token}),'MISSING_REFERENCE'],
  [part({kind:'extrude',distance:8,profile:token,children:[polygon()]}),'EXCLUSIVE_INPUT'],
  [part({kind:'extrude',distance:8,children:[polygon(),polygon({key:'second'})]}),'CARDINALITY'],
  [part({kind:'translate',offset:[0,0,0],solid:token},{kind:'definitions',children:[polygon({bind:token})]}),'TYPE'],
  [part({kind:'extrude',distance:8,profile:solid},{kind:'definitions',children:[{kind:'extrude',bind:solid,distance:8,children:[polygon()]}]}),'TYPE'],
  [part({kind:'extrude',distance:8,profile:token},{kind:'definitions',children:[polygon({bind:token}),polygon({key:'second',bind:token})]}),'DUPLICATE_BINDING'],
 ];
 for(const [model,code]of cases){const result=new CompositionCompiler().compile(model);assert.equal(result.ok,false);assert.equal(result.error.code,code);}
 const first=new CompositionCompiler();accepted(first.compile(part({kind:'extrude',distance:8,profile:token},{kind:'definitions',children:[polygon({bind:token})]})));
 const other=new CompositionCompiler().compile(part({kind:'extrude',distance:8,profile:token}));assert.equal(other.error.code,'MISSING_REFERENCE');
});
test('Polygon props changes and invalid recovery retain IDs and exact returned document',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts'),c=new CompositionCompiler(),a=accepted(c.compile(plate(60))),b=accepted(c.compile(plate(80)));
 assert.deepEqual(b.doc.nodes.map(n=>n.id),a.doc.nodes.map(n=>n.id));const bad=plate();bad.children[0].children[0].points=[];
 const result=c.compile(bad);assert.equal(result.ok,false);assert.equal(result.previous,b);
 assert.deepEqual(accepted(c.compile(plate(60))).doc,a.doc);
});
test('the pre-Polygon combined Rectangle/Circle/Revolve/Boolean/rigid lowerings stay exact',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const model=part({kind:'translate',offset:[30,40,5],children:[{kind:'rotate',axis:'z',angle:90,children:[{kind:'difference',children:[{kind:'target',children:[{kind:'union',children:[{kind:'extrude',distance:6,children:[{kind:'rectangle',min:[0,0],max:[80,60]}]},{kind:'revolve',axis:'y',angle:90,children:[{kind:'rectangle',min:[10,20],max:[20,50]}]}]}]},{kind:'tools',children:[{kind:'extrude',from:-1,distance:8,children:[{kind:'circle',center:[10,10],radius:3}]}]}]}]}]});
 assert.deepEqual(accepted(new CompositionCompiler().compile(model)).doc,{format:'barocss-cad-model',schema:3,units:'mm',nextId:10,parameters:{},nodes:[
  {id:'n0',kind:'sketch',profile:'rectangle',min:[0,0],max:[80,60]},
  {id:'n1',kind:'extrude',sketch:0,height:6},
  {id:'n2',kind:'sketch',profile:'rectangle',min:[10,20],max:[20,50]},
  {id:'n3',kind:'revolve',sketch:2,axis:'y',angle:90},
  {id:'n4',kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'}},
  {id:'n5',kind:'sketch',profile:'circle',center:[10,10],radius:3},
  {id:'n6',kind:'extrude',sketch:5,height:8,from:-1},
  {id:'n7',kind:'difference',parent:{node:4,side:'solid'},tool:{node:6,side:'solid'}},
  {id:'n8',kind:'rotate',parent:{node:7,side:'solid'},axis:'z',angle:90},
  {id:'n9',kind:'translate',parent:{node:8,side:'solid'},offset:[30,40,5]},
 ],outputs:{result:{node:9,side:'solid'}}});
});
