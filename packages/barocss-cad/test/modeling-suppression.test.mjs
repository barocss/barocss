import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { cad, CadModelError, CadModelLimits } = await import(process.env.CAD_MODEL_TEST_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_TEST_MODULE)).href : '../dist/index.js');
if (process.env.CAD_MODEL_TEST_MODULE) assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE && process.env.CAD_MODEL_AUTHORED_HELPER_MODULE);
const { modelingGraphKey: key, modelingNodeParameters: refs, modelingReusablePrefix: prefix } = await import(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE)).href : '../dist/modeling-regeneration-internal.js');
const { signedJson } = await import(process.env.CAD_MODEL_AUTHORED_HELPER_MODULE ? pathToFileURL(resolve(process.env.CAD_MODEL_AUTHORED_HELPER_MODULE)).href : '../dist/xy-affine-prism-feature-document-internal.js');
const refuses = (fn, code, operation) => assert.throws(fn, e => e instanceof CadModelError && e.code === code && (!operation || e.operation === operation));
const blank = m => m.sketch.rectangle({ width: 32, height: 24 }).extrude(8);
const edge = (s, y) => s.edges({ parallelTo: 'x', at: { y, z: 'max' } }).one();

test('named finish options are strict, unique and failure-atomic before append', () => {
  const m = cad.model(), a = blank(m), e = edge(a,0);
  for (const name of ['', '__proto__', 'constructor', 'not a name', '마감', 'a'.repeat(49), true]) refuses(() => a.chamfer(e,1,{name}), 'INPUT');
  for (const options of [{}, {name:'front',suppressed:true}, {name:'front',extra:1}, null, Object.create({name:'front'})]) refuses(() => a.chamfer(e,1,options), 'INPUT');
  let calls=0; refuses(() => a.chamfer(e,1,{get name(){calls++;return 'front';}}), 'INPUT'); assert.equal(calls,0);
  const first = a.chamfer(e,1,{name:'front'}), next = edge(first,24);
  refuses(() => first.chamfer(next,2,{name:'front'}), 'INPUT');
  refuses(() => first.chamfer(e,2,{name:'back'}), 'OWNERSHIP');
  refuses(() => first.chamfer({...next},2,{name:'back'}), 'OWNERSHIP');
  const second=first.chamfer(next,2,{name:'back'}); assert.ok(Object.isFrozen(second));
  refuses(() => second.chamfer(edge(second,24),1,{name:'third'}), 'CAPABILITY');
  const halves=second.split({axis:'x',at:16});
  refuses(() => halves.negative.chamfer(halves.positive.edges({}).one(),1,{name:'other'}), 'OWNERSHIP');
  assert.equal(CadModelLimits.nodes,6);assert.equal(CadModelLimits.chamfers,2);
  for (const name of ['f','f'.repeat(48)]) {
    const named=cad.model();named.parameter(name,1);const stock=blank(named);
    assert.ok(Object.isFrozen(stock.chamfer(edge(stock,0),1,{name}))); // Separate numeric and feature namespaces.
  }
});

const document = () => ({format:'barocss-cad-model',schema:1,units:'mm',parameters:{distance:1},nodes:[
  {kind:'sketch',profile:'rectangle',min:[0,0],max:[32,24]}, {kind:'extrude',sketch:0,height:8},
  {kind:'chamfer',parent:{node:1,side:'solid'},edge:{parallelTo:'x',at:{y:0,z:'max'}},distance:{parameter:'distance'},name:'front',suppressed:false},
  {kind:'chamfer',parent:{node:2,side:'solid'},edge:{parallelTo:'x',at:{y:24,z:'max'}},distance:2,name:'back',suppressed:true},
],outputs:{part:{node:3,side:'positive'}}});

test('paired named metadata is exact and disabled native intent remains fully admitted', () => {
  const check=(edit,code,operation)=>{const d=document();edit(d);refuses(()=>cad.load(signedJson(d)),code,operation);};
  check(()=>{},'INPUT','body'); // Both named nodes pass admission; output side intentionally invalid.
  check(d=>{delete d.nodes[2].name;},'INPUT','chamfer');
  check(d=>{delete d.nodes[2].suppressed;},'INPUT','chamfer');
  check(d=>{d.nodes[3].name='front';},'INPUT','chamfer');
  check(d=>{d.nodes[3].name='__proto__';},'INPUT');
  for(const value of [0,1,'true',null,{}])check(d=>{d.nodes[3].suppressed=value;},'INPUT');
  check(d=>{d.nodes[3].extra=true;},'INPUT');
  check(d=>{d.nodes[3].distance={parameter:'missing'};},'PARAMETER');
  check(d=>{d.nodes[3].edge.at.y={parameter:'missing'};},'PARAMETER');
  check(d=>{d.nodes[3].parent.node=3;},'INPUT');
  check(d=>{d.nodes[3].parent.node=4;},'INPUT');
  check(d=>{d.nodes[3].parent.side='negative';},'INPUT');
  check(d=>{d.nodes[3].parent.node=1;},'CAPABILITY');
  check(d=>{d.nodes[1].name='extrusion';d.nodes[1].suppressed=true;},'INPUT');
  refuses(()=>cad.load(signedJson(document()).replace('"name":"front"','"name":"front","name":"front"')),'FORMAT');
});

test('actual unchanged authored writer preserves all legacy unnamed file bytes', () => {
  for(const file of ['cut','minimal','rectangle','reedited','serial']) {
    const text=readFileSync(new URL('./modeling-evidence/'+file+'.cad-model.json',import.meta.url),'utf8'), d=JSON.parse(text);
    assert.equal(signedJson(d)+'\n',text);
    for(const n of d.nodes.filter(n=>n.kind==='chamfer'))assert.deepEqual(Object.keys(n).sort(),['distance','edge','kind','parent']);
    d.outputs={invalid:{node:0,side:'solid'}};refuses(()=>cad.load(signedJson(d)),'INPUT','body');
  }
  const d=document();for(const n of d.nodes.filter(n=>n.kind==='chamfer')){delete n.name;delete n.suppressed;}
  refuses(()=>cad.load(signedJson(d)),'INPUT','body');
});

test('unchanged cache helpers bind boolean/name state but keep dimensions and no-op identity separate', () => {
  const d=document(), before=key(d), names=d.nodes.map(refs);
  assert.deepEqual(names,[[],[],['distance'],[]]);
  const noop=structuredClone(d);noop.nodes[2].suppressed=false;noop.nodes[3].suppressed=true;
  assert.equal(key(noop),before);assert.equal(prefix(true,key(noop),before,d.parameters,d.parameters,names),4);
  for(const edit of [x=>{x.nodes[2].suppressed=true;},x=>{x.nodes[3].name='different';}]) {
    const next=structuredClone(d);edit(next);assert.notEqual(key(next),before);assert.equal(prefix(true,key(next),before,d.parameters,d.parameters,names),0);
  }
  const signed=structuredClone(d);signed.parameters.distance=0;
  assert.equal(prefix(true,key(signed),key(signed),{distance:-0},signed.parameters,names),2);
  assert.deepEqual(d.parameters,{distance:1});assert.equal(d.nodes[2].suppressed,false);
});
