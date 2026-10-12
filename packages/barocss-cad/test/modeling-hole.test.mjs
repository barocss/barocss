import test from 'node:test';
import { createHash } from 'node:crypto';
import { convexBody, bodyHash } from './modeling-regeneration-fixture.mjs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const path=name=>process.env[name]?pathToFileURL(resolve(process.env[name])).href:null;
const {cad,CadModelError,CadModelLimits}=await import(path('CAD_MODEL_TEST_MODULE')??'../dist/index.js');
if(process.env.CAD_MODEL_TEST_MODULE)assert.ok(process.env.CAD_MODEL_REGENERATION_HELPER_MODULE&&process.env.CAD_MODEL_AUTHORED_HELPER_MODULE);
const {modelingGraphKey:key,modelingNodeParameters:refs,modelingReusablePrefix:prefix}=await import(path('CAD_MODEL_REGENERATION_HELPER_MODULE')??'../dist/modeling-regeneration-internal.js');
const {signedJson}=await import(path('CAD_MODEL_AUTHORED_HELPER_MODULE')??'../dist/xy-affine-prism-feature-document-internal.js');
const refuses=(fn,code,operation)=>assert.throws(fn,e=>e instanceof CadModelError&&e.code===code&&(!operation||e.operation===operation));
const blank=m=>m.sketch.rectangle({width:80,height:40}).extrude(8);

test('through-hole handles admit only owned exact fields and failed options do not consume the hole',()=>{
  const m=cad.model(),stock=blank(m),radius=m.parameter('radius',5),foreign=cad.model().parameter('radius',5);let getters=0;
  for(const options of [null,{},[],{center:[40,20],radius,extra:true},Object.create({center:[40,20],radius})])refuses(()=>stock.hole(options),'INPUT');
  refuses(()=>stock.hole({center:[40],radius}),'BUDGET');
  refuses(()=>stock.hole({get center(){getters++;return[40,20];},radius}),'INPUT');assert.equal(getters,0);
  const expression=m.dimension.scale(radius,.5);
  for(const value of [foreign,{...radius},{...expression}])refuses(()=>stock.hole({center:[40,20],radius:value}),'OWNERSHIP');
  refuses(()=>stock.hole({center:[foreign,20],radius}),'OWNERSHIP');
  refuses(()=>stock.hole({center:[40,foreign],radius}),'OWNERSHIP');
  const hole=stock.hole({center:[m.dimension.add(20,20),20],radius});assert.ok(Object.isFrozen(hole));
  refuses(()=>stock.hole({center:[40,20],radius}),'CAPABILITY');refuses(()=>hole.hole({center:[40,20],radius}),'CAPABILITY');
  refuses(()=>hole.edges({parallelTo:'x'}),'CAPABILITY');refuses(()=>hole.split({axis:'z',at:4}),'CAPABILITY');
  const another=blank(cad.model());refuses(()=>m.build({plate:another}),'OWNERSHIP');
  refuses(()=>m.build({plate:{family:'stored-rational-plate-hole',native:{}}}),'OWNERSHIP');
  assert.equal(CadModelLimits.nodes,6);assert.equal(CadModelLimits.holes,1);
});

test('through-hole ancestry and mixed operations refuse before append or native work',()=>{
  for(const create of [m=>m.sketch.polygon([[0,0],[80,0],[80,40],[0,40]]).extrude(8),m=>m.sketch.rectangle({min:[1,0],max:[81,40]}).extrude(8),m=>m.sketch.rectangle({width:80.5,height:40}).extrude(8),m=>m.sketch.rectangle({width:80,height:40}).extrude(8.5)]) {
    const m=cad.model(),stock=create(m);refuses(()=>stock.hole({center:[40,20],radius:5}),'CAPABILITY');
  }
  for(const operation of ['split','chamfer','intersect','cut']) {
    const m=cad.model(),stock=blank(m);
    if(operation==='split')stock.split({axis:'x',at:40});
    if(operation==='chamfer')stock.chamfer(stock.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
    if(operation==='intersect'||operation==='cut'){const tool=m.sketch.rectangle({width:16,height:40}).extrude(8);operation==='cut'?stock.cut(tool,{axis:'x'}):stock.intersect(tool);}
    refuses(()=>stock.hole({center:[40,20],radius:5}),'CAPABILITY');
  }
  const m=cad.model(),stock=blank(m);stock.hole({center:[40,20],radius:5});
  refuses(()=>stock.split({axis:'x',at:40}),'CAPABILITY');
  refuses(()=>stock.chamfer(stock.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1),'CAPABILITY');
});

const document=()=>({format:'barocss-cad-model',schema:1,units:'mm',parameters:{x:40,y:20,r:5},nodes:[
  {kind:'sketch',profile:'rectangle',min:[0,0],max:[80,40]},{kind:'extrude',sketch:0,height:8},
  {kind:'hole',parent:{node:1,side:'solid'},center:[{parameter:'x'},{parameter:'y'}],radius:{parameter:'r'}},
],outputs:{plate:{node:2,side:'negative'}}});

test('hole codec exactness, ancestry and dimension admission precede the output sentinel',()=>{
  const check=(edit,code='INPUT',operation)=>{const d=document();edit(d);refuses(()=>cad.load(signedJson(d)),code,operation);};
  check(()=>{},'INPUT','body'); // Valid hole intent reaches the deliberately invalid output side without geometry.
  for(const field of ['center','radius','parent'])check(d=>{delete d.nodes[2][field];});
  check(d=>{d.nodes[2].depth=8;});check(d=>{d.nodes[2].center=[40];},'BUDGET');check(d=>{d.nodes[2].center=[40,20,0];},'BUDGET');
  for(const position of [0,1])check(d=>{d.nodes[2].center[position]={parameter:'missing'};},'PARAMETER');
  check(d=>{d.nodes[2].radius={parameter:'missing'};},'PARAMETER');
  check(d=>{d.nodes[2].parent.node=2;});check(d=>{d.nodes[2].parent.node=3;});check(d=>{d.nodes[2].parent.side='negative';});
  check(d=>{d.nodes[0]={kind:'sketch',profile:'polygon',points:[[0,0],[80,0],[0,40]]};},'CAPABILITY');
  check(d=>{d.nodes[0].min=[1,0];},'CAPABILITY');check(d=>{d.nodes[1].height=8.5;},'CAPABILITY');
  check(d=>{d.nodes.push({...d.nodes[2]});},'CAPABILITY');
  check(d=>{d.nodes.push({kind:'split',parent:{node:1,side:'solid'},axis:'x',at:40});},'CAPABILITY');
  check(d=>{d.nodes.push({kind:'chamfer',parent:{node:1,side:'solid'},edge:{},distance:1});},'CAPABILITY');
  const signed=document();signed.nodes[0].min=[-0,0];assert.ok(signedJson(signed).includes('"min":[-0,0]'));
  refuses(()=>cad.load(signedJson(signed)),'INPUT','body');
});

test('unchanged dependency and signed structural-key helpers account for all hole dimensions',()=>{
  const d=document(),node=d.nodes[2];node.center[0]={op:'add',left:{parameter:'x'},right:{op:'scale',value:{parameter:'shift'},factor:.5}};
  d.parameters.shift=0;assert.deepEqual(refs(node),['r','shift','x','y']);const names=d.nodes.map(refs),k=key(d);
  assert.equal(prefix(true,k,k,d.parameters,d.parameters,names),3);
  for(const parameter of ['r','x','y'])assert.equal(prefix(true,k,k,{...d.parameters,[parameter]:d.parameters[parameter]+1},d.parameters,names),2);
  assert.equal(prefix(true,k,k,{...d.parameters,shift:-0},d.parameters,names),2);
  const other=structuredClone(d);other.nodes[2].center[0].right.factor=-0;const positive=structuredClone(other);positive.nodes[2].center[0].right.factor=0;
  assert.notEqual(key(other),key(positive));assert.equal(prefix(true,key(other),key(positive),d.parameters,d.parameters,names),0);
});

test('executable convex migration unwraps the original payload and preserves historical hash semantics',()=>{
  const native=Object.freeze({certificate:Object.freeze({volumeMM3:Object.freeze({numerator:'4096',denominator:'1'})})});
  const wrapped={bodies:{part:Object.freeze({family:'convex-planar',native})}};
  assert.equal(convexBody(wrapped,'part'),native);
  assert.throws(()=>convexBody({bodies:{part:{family:'stored-rational-plate-hole',native}}},'part'));
  const historical='{"part":{"certificate":{"volumeMM3":{"denominator":"1","numerator":"4096"}}}}';
  assert.equal(bodyHash(wrapped),createHash('sha256').update(historical).digest('hex'));
});
