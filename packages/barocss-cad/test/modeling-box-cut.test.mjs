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
const pair=()=>{const m=cad.model(),a=m.sketch.rectangle({min:[-0,0],max:[32,24]}).extrude(8),b=m.sketch.rectangle({min:[8,8],max:[24,16]}).extrude(4);return{m,a,b};};

test('cut overload distinguishes omission from every supplied invalid option without consuming a node',()=>{
 const {a,b}=pair();
 for(const options of [undefined,null,{},[],{axis:'z'},{axis:'x',extra:1},Object.create({axis:'x'}),{get axis(){throw Error('must not invoke getter');}}]){
  refuses(()=>a.cut(b,options),Object.getOwnPropertyDescriptor(options??{},'axis')?.value==='z'?'CAPABILITY':'INPUT','cut');
 }
 refuses(()=>a.cut(),'INPUT','cut');refuses(()=>a.cut(b,{axis:'x'},true),'INPUT','cut');refuses(()=>a.cut(b,undefined,true),'INPUT','cut');
 const result=a.cut(b);assert.ok(Object.isFrozen(result));assert.equal(typeof result.cut,'function');assert.equal(Object.hasOwn(result,'negative'),false);
 const legacy=pair(),outside=legacy.a.cut(legacy.b,{axis:'x'});assert.ok(Object.isFrozen(outside));assert.equal(typeof outside.negative.cut,'function');assert.equal(typeof outside.positive.cut,'function');
});
test('rectangular difference requires owned distinct direct handles and refuses unsupported result operations',()=>{
 const {m,a,b}=pair();
 for(const other of [pair().b,{...b},{node:3,side:'solid'},{family:'orthogonal-cell',native:{}},null,undefined])refuses(()=>a.cut(other),'OWNERSHIP');
 refuses(()=>a.cut(a),'CAPABILITY','cut');const part=a.cut(b);
 refuses(()=>a.cut(b),'CAPABILITY','cut');refuses(()=>part.cut(b),'CAPABILITY','cut');refuses(()=>part.union(a),'CAPABILITY');
 refuses(()=>part.edges({parallelTo:'x'}),'CAPABILITY');refuses(()=>part.split({axis:'z',at:2}),'CAPABILITY');refuses(()=>part.intersect(a),'CAPABILITY');refuses(()=>part.hole({center:[1,1],radius:1}),'CAPABILITY');
 refuses(()=>m.build({part:{...part}}),'OWNERSHIP');assert.equal(CadModelLimits.nodes,6);assert.equal(CadModelLimits.differences,1);
});
test('difference rejects unsupported rectangles and every mixed graph before geometry',()=>{
 for(const create of [m=>m.sketch.polygon([[0,0],[32,0],[32,24],[0,24]]).extrude(8),m=>m.sketch.rectangle({width:31.5,height:24}).extrude(8),m=>m.sketch.rectangle({min:[.5,0],max:[32.5,24]}).extrude(8),m=>m.sketch.rectangle({width:32,height:24}).extrude(8.5),m=>m.sketch.rectangle({min:[-10000,0],max:[1,24]}).extrude(8),m=>m.sketch.rectangle({width:0,height:24}).extrude(8)]){
  const m=cad.model(),a=create(m),b=m.sketch.rectangle({width:8,height:8}).extrude(4);refuses(()=>a.cut(b),'CAPABILITY','cut');
 }
 const act=(operation,a,b)=>operation==='cut'?a.cut(b,{axis:'x'}):operation==='intersect'?a.intersect(b):operation==='union'?a.union(b):operation==='split'?a.split({axis:'x',at:16}):operation==='hole'?a.hole({center:[16,12],radius:1}):a.chamfer(a.edges({parallelTo:'x',at:{y:0,z:'max'}}).one(),1);
 for(const operation of ['cut','intersect','union','split','chamfer','hole']){
  const before=pair();act(operation,before.a,before.b);refuses(()=>before.a.cut(before.b),'CAPABILITY','cut');
  const after=pair();after.a.cut(after.b);refuses(()=>act(operation,after.a,after.b),'CAPABILITY');
 }
});
const document=()=>({format:'barocss-cad-model',schema:1,units:'mm',parameters:{x:8,y:8,w:16,span:8,depth:4},nodes:[
 {kind:'sketch',profile:'rectangle',min:[-0,0],max:[32,24]},{kind:'extrude',sketch:0,height:8},
 {kind:'sketch',profile:'rectangle',min:[{parameter:'x'},{parameter:'y'}],max:[{op:'add',left:{parameter:'x'},right:{parameter:'w'}},{op:'add',left:{parameter:'y'},right:{parameter:'span'}}]},
 {kind:'extrude',sketch:2,height:{parameter:'depth'}},{kind:'difference',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'}}
],outputs:{part:{node:4,side:'negative'}}});
test('strict difference codec rejects malformed fields/references/mixes before the output admission sentinel',()=>{
 const check=(edit,code='INPUT',operation)=>{const d=document();edit(d);refuses(()=>cad.load(signedJson(d)),code,operation);};
 check(()=>{},'INPUT','body');
 for(const field of ['parent','tool'])check(d=>{delete d.nodes[4][field];},'INPUT','cut');
 for(const field of ['axis','left','right','operation'])check(d=>{d.nodes[4][field]='x';},'INPUT','cut');
 for(const field of ['parent','tool']){
  for(const node of [4,5,-1,-0])check(d=>{d.nodes[4][field].node=node;});
  check(d=>{d.nodes[4][field].side='positive';});
 }
 check(d=>{d.nodes[4].tool={...d.nodes[4].parent};},'CAPABILITY','cut');
 check(d=>{d.nodes[0]={kind:'sketch',profile:'polygon',points:[[0,0],[32,0],[0,24]]};},'CAPABILITY','cut');
 for(const edit of [d=>{d.parameters.w=15.5;},d=>{d.parameters.x=.5;},d=>{d.parameters.depth=.5;},d=>{d.nodes[0].min[0]=-10000;d.nodes[0].max[0]=1;}])check(edit,'CAPABILITY','cut');
 check(d=>{d.nodes[2].max[0]={parameter:'missing'};},'PARAMETER');
 check(d=>{d.nodes.push({...d.nodes[4]});},'CAPABILITY');
 for(const node of [{kind:'union',left:{node:1,side:'solid'},right:{node:3,side:'solid'}},{kind:'intersect',left:{node:1,side:'solid'},right:{node:3,side:'solid'}},{kind:'cut',parent:{node:1,side:'solid'},tool:{node:3,side:'solid'},axis:'x'},{kind:'split',parent:{node:1,side:'solid'},axis:'x',at:16},{kind:'hole',parent:{node:1,side:'solid'},center:[16,12],radius:1},{kind:'chamfer',parent:{node:1,side:'solid'},edge:{},distance:1}])check(d=>{d.nodes.push(node);},'CAPABILITY');
 check(d=>{d.nodes.push({kind:'difference',parent:{node:4,side:'solid'},tool:{node:3,side:'solid'}});},'CAPABILITY','cut');
 // Legacy authored cut remains an exact axis-bearing paired node; these refuse before native work.
 check(d=>{d.nodes[4].kind='cut';},'INPUT','cut');
 check(d=>{d.nodes[4].kind='cut';d.nodes[4].axis='x';d.outputs.part.side='solid';},'INPUT','body');
});
test('unchanged graph/dependency helpers preserve ordered difference operands and nested driver prefixes',()=>{
 const d=document(),names=d.nodes.map(refs),k=key(d);assert.deepEqual(names,[[],[],['span','w','x','y'],['depth'],[]]);
 assert.equal(prefix(true,k,k,d.parameters,d.parameters,names),5);
 for(const [changes,expected] of [[{depth:6},3],[{x:40},2],[{y:0,span:24},2]])assert.equal(prefix(true,k,k,{...d.parameters,...changes},d.parameters,names),expected);
 const structural=structuredClone(d);structural.nodes[0].min[0]=0;assert.notEqual(key(structural),k);
 const reverse=structuredClone(d);[reverse.nodes[4].parent,reverse.nodes[4].tool]=[reverse.nodes[4].tool,reverse.nodes[4].parent];assert.notEqual(key(reverse),k);
 assert.equal(prefix(false,k,k,d.parameters,d.parameters,names),0);
});
