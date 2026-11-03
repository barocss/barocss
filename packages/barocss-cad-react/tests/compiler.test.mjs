import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const rectangle=(key='r')=>({kind:'rectangle',key,min:[0,0],max:[80,60]});
const slab=(key='s',distance=6)=>({kind:'extrude',key,distance,children:[rectangle()]});
const part=(...children)=>({kind:'part',units:'mm',children});
const accepted=result=>{assert.equal(result.ok,true,result.error?.message);return result.value;};
const rejected=(result,code)=>{assert.equal(result.ok,false);assert.equal(result.error.code,code);};
test('profile geometry lowers to native sketch storage without a public Sketch dependency',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler();
 const got=accepted(c.compile(part(slab('s',-6))));assert.equal(got.doc.nodes[0].kind,'sketch');assert.equal(got.doc.nodes[1].height,-6);assert.equal(got.doc.nodes[1].sketch,0);assert.deepEqual(got.doc.outputs,{result:{node:1,side:'solid'}});
 const face={kind:'extrude',distance:6,profile:{kind:'face',nativeName:'n1.top'}};rejected(c.compile(part(face)),'UNSUPPORTED_CAPABILITY');
});
test('forward optional profile/solid refs share geometry; cross-Part tokens do not resolve',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const profile={},solid={};
 const doc=accepted(new CompositionCompiler().compile(part({kind:'difference',children:[{kind:'target',solid},{kind:'tools',children:[{kind:'extrude',distance:8,profile}]}]},{kind:'definitions',children:[{...rectangle(),bind:profile},{...slab(),bind:solid}]}))).doc;
 assert.equal(doc.nodes.filter(x=>x.kind==='sketch').length,2);assert.equal(doc.nodes.at(-1).kind,'difference');
 rejected(new CompositionCompiler().compile(part({kind:'extrude',distance:6,profile})),'MISSING_REFERENCE');
});
test('invalid declarations keep accepted Doc and do not consume native IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),first=accepted(c.compile(part(slab())));
 const failed=c.compile(part({kind:'union',children:[slab(),rectangle()]}));rejected(failed,'TYPE');assert.equal(failed.previous,first);
 const next=accepted(c.compile(part(slab())));assert.equal(next,first);assert.equal(next.doc.nextId,2);
});
test('wrong kinds, mixed operands and cycles fail before replacing accepted geometry',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),token={};
 rejected(c.compile(part({kind:'extrude',distance:6,profile:token,children:[rectangle()]})),'EXCLUSIVE_INPUT');
 rejected(c.compile(part({kind:'extrude',distance:6,children:[slab()]})),'TYPE');
 rejected(c.compile(part({kind:'difference',children:[slab('a'),slab('b')]})),'CARDINALITY');
 rejected(c.compile(part({kind:'difference',bind:token,children:[{kind:'target',solid:token},{kind:'tools',children:[slab()]}]})),'CYCLE');
});
test('committed host identity retains IDs under reorder and props; a new token creates new identity',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');const c=new CompositionCompiler(),a={},b={};
 const model=(reverse=false,token=a)=>part({kind:'union',key:'u',children:(reverse?[['b',b],['a',token]]:[['a',token],['b',b]]).map(([key,identity])=>({...slab(key),identity}))});
 const first=accepted(c.compile(model())),ids=first.doc.nodes.filter(x=>x.kind==='extrude').map(x=>x.id);
 const second=accepted(c.compile(model(true)));assert.deepEqual(second.doc.nodes.filter(x=>x.kind==='extrude').map(x=>x.id),ids.toReversed());
 const third=accepted(c.compile(model(false,{})));assert.notEqual(third.doc.nodes.find(x=>x.kind==='extrude').id,ids[0]);
});
