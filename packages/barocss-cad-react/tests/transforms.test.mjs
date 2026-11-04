/** Controlled transform compiler contract; no native math or geometry evaluation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './compile.mjs';
const slab=()=>({kind:'extrude',key:'s',distance:6,children:[{kind:'rectangle',key:'p',min:[0,0],max:[80,60]}]});
const part=(...children)=>({kind:'part',units:'mm',children});
const ok=x=>{assert.equal(x.ok,true,x.error?.message);return x.value;};
test('nested rigid operators lower only existing native parent and authored parameters',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const compiled=ok(new CompositionCompiler().compile(part({kind:'translate',key:'t',offset:[30,40,5],children:[{kind:'rotate',key:'r',axis:'z',angle:90,pivot:[0,0,0],children:[slab()]}]})));
 assert.deepEqual(compiled.doc.nodes.map(n=>n.kind),['sketch','extrude','rotate','translate']);assert.deepEqual(compiled.doc.nodes[2],{id:'n2',kind:'rotate',parent:{node:1,side:'solid'},axis:'z',angle:90,pivot:[0,0,0]});assert.deepEqual(compiled.doc.nodes[3],{id:'n3',kind:'translate',parent:{node:2,side:'solid'},offset:[30,40,5]});
});
test('forward solid reference is scoped and zero angle preserves omission of optional pivot',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const source={},c=new CompositionCompiler(),compiled=ok(c.compile(part({kind:'rotate',axis:'z',angle:0,solid:source},{kind:'definitions',children:[{...slab(),bind:source}]})));
 assert.equal(compiled.doc.nodes.at(-1).angle,0);assert.equal(Object.hasOwn(compiled.doc.nodes.at(-1),'pivot'),false);
 const missing=new CompositionCompiler().compile(part({kind:'translate',offset:[0,0,0],solid:source}));assert.equal(missing.ok,false);assert.equal(missing.error.code,'MISSING_REFERENCE');
});
test('mixed or incompatible transform operands and invalid values retain the prior accepted Doc',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const c=new CompositionCompiler(),prior=ok(c.compile(part(slab())));
 for(const bad of [{kind:'translate',offset:[0,0,0],solid:{},children:[slab()]},{kind:'rotate',axis:'z',angle:90,children:[{kind:'circle',center:[0,0],radius:3}]},{kind:'rotate',axis:'z',angle:NaN,children:[slab()]}]){const failed=c.compile(part(bad));assert.equal(failed.ok,false);assert.equal(failed.previous,prior);}
 assert.equal(ok(c.compile(part(slab()))),prior);
});
test('authored transform update/return preserves mounted feature IDs and restores exact native Doc',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const c=new CompositionCompiler(),identity={},model=dx=>part({kind:'translate',identity,key:'t',offset:[dx,40,5],children:[slab()]});
 const a=ok(c.compile(model(30))),b=ok(c.compile(model(50))),returned=ok(c.compile(model(30)));assert.deepEqual(a.doc.nodes.map(n=>n.id),b.doc.nodes.map(n=>n.id));assert.notEqual(a.fingerprint,b.fingerprint);assert.deepEqual(returned.doc,a.doc);
});
test('Translate refuses a sparse offset at each coordinate and preserves accepted IDs',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const c=new CompositionCompiler(),prior=ok(c.compile(part(slab())));
 for(const hole of [0,1,2]){const offset=[1,2,3];delete offset[hole];const failed=c.compile(part({kind:'translate',offset,children:[slab()]}));assert.equal(failed.ok,false);assert.equal(failed.error.code,'INVALID_PARAMETER');assert.equal(failed.previous,prior);}
 assert.equal(ok(c.compile(part(slab()))),prior);
});
test('Rotate refuses a sparse explicit pivot at each coordinate without substituting default pivot',async t=>{
 const {CompositionCompiler}=await loadSource(t,'src/compiler.ts');
 const c=new CompositionCompiler(),prior=ok(c.compile(part(slab())));
 for(const hole of [0,1,2]){const pivot=[1,2,3];delete pivot[hole];const failed=c.compile(part({kind:'rotate',axis:'z',angle:90,pivot,children:[slab()]}));assert.equal(failed.ok,false);assert.equal(failed.error.code,'INVALID_PARAMETER');assert.equal(failed.previous,prior);}
 assert.equal(ok(c.compile(part(slab()))),prior);
});
