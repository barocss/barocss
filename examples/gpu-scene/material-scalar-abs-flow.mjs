/** #1124: bounded authoring expansion through actual source and emitted public APIs. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),i=process.argv.indexOf('--output');
assert(i>=0&&process.argv[i+1],'--output <fresh directory> required');
const output=resolve(process.argv[i+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8'));
const map=manifest.publishConfig.exports['.'];assert.equal(map.import,'./dist/index.js');assert.equal(map.types,'./dist/index.d.ts');
const sourceBundle=resolve(output,'ordinary-source.mjs');
const built=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,format:'esm',platform:'node',target:'node22',outfile:sourceBundle,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/material/mesh-material.ts')));assert(!graph.some(p=>p.includes('barocss-gpu/dist/')||p.includes('barocss-cad/dist/')),'Ordinary source used a dist fallback');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};}
const providers=[['ordinary-source',sourceBundle],['emitted-public',resolve(pkg,map.import)]];
const header='@uniform phase:float(-1,1,0);';
const shader=(x,decl=header)=>`@shader #absolute {${decl}@fragment {color:mix(#123,#ABC,clamp(${x},0,1));}}`;
const expansion=x=>`clamp(${x},0,1000)+clamp(-(${x}),0,1000)`;
const fixtures=[
 {name:'signed-phase',arg:'phase',decl:header,values:[-1,-.25,0,.25,1].map(phase=>({phase})),value:v=>v.phase},
 {name:'trig-wave',arg:'sin(phase)',decl:header,values:[-1,0,.5,1].map(phase=>({phase})),value:v=>Math.sin(v.phase)},
 {name:'zero',arg:'-0',decl:'',values:[{}],value:()=>-0},
 {name:'nested',arg:'abs(phase)',inline:expansion('('+expansion('phase')+')'),decl:header,values:[{phase:-.5},{phase:0},{phase:.5}],value:v=>v.phase},
 {name:'literal-boundary',arg:'-1000',decl:'',values:[{}],value:()=>-1000},
 {name:'division-mix',arg:'mix(-1,1,elapsed/120)',decl:'@uniform elapsed:float(0,120,60);',values:[{elapsed:0},{elapsed:60},{elapsed:120}],value:v=>-1+2*(v.elapsed/120)},
 {name:'existing-local-abs',arg:'abs',decl:header+'@let abs:float(phase);',values:[{phase:-.5},{phase:.5}],value:v=>v.phase},
 {name:'existing-uniform-abs',arg:'abs',decl:'@uniform abs:float(-1,1,0);',values:[{abs:-1},{abs:0},{abs:1}],value:v=>v.abs},
];
function evaluate(e,v){switch(e.kind){case'float':return e.value;case'color':return e.linear;case'uniform':return v[e.name];case'unary':return(e.operator==='-'?-1:1)*evaluate(e.value,v);case'binary':{const a=evaluate(e.left,v),b=evaluate(e.right,v);return e.operator==='+'?a+b:e.operator==='-'?a-b:a*b;}case'call':{const a=e.args.map(x=>evaluate(x,v));assert.notEqual(e.name,'abs','New runtime node escaped expansion');if(e.name==='clamp')return Math.max(a[1],Math.min(a[2],a[0]));if(e.name==='mix')return a[0].map((x,i)=>x*(1-a[2])+a[1][i]*a[2]);if(e.name==='sin')return Math.sin(a[0]);if(e.name==='cos')return Math.cos(a[0]);}}throw Error('Unexpected existing IR node');}
const expected=x=>{const t=Math.min(1,Math.abs(x));return[17,34,51].map((n,i)=>Math.pow(n/255,2.2)*(1-t)+Math.pow([170,187,204][i]/255,2.2)*t);};
const balanced=xs=>xs.length===1?xs[0]:'('+balanced(xs.slice(0,xs.length>>1))+'+'+balanced(xs.slice(xs.length>>1))+')';
let deep='@uniform phase:float(-1,1,0);@let p0:float(phase);';for(let n=1;n<=14;n++)deep+=`@let p${n}:float(+p${n-1});`;
const invalid=[
 ['arity0','abs()','TYPE','abs'],['arity2','abs(phase,phase)','TYPE','abs'],['color','abs(#123)','TYPE','abs'],
 ['interval','abs(phase+1000)','RANGE','abs'],['work','abs(a)','BUDGET','abs',header+'@let a:float('+balanced(Array(60).fill('phase'))+');'],
 ['depth','abs(p14)','BUDGET','abs',deep],
];
const results=[];
for(const[name,path]of providers){
 const gpu=await import(pathToFileURL(path).href);const exports=Object.keys(gpu).sort();
 const accepted=[],refusals=[];let prior=null;
 const compile=source=>{const r=gpu.compileMeshMaterial(source);assert.equal(r.ok,true,JSON.stringify(r.diagnostics));assert.equal(r.material.source,source);return r.material;};
 for(const f of fixtures){
  const source=shader('abs('+f.arg+')',f.decl),old=shader(f.inline??expansion(f.arg),f.decl);
  const material=compile(source),control=compile(old);
  assert.deepEqual(material.expression,control.expression,f.name+' canonical old IR');assert.deepEqual(material.uniforms,control.uniforms);
  assert.deepEqual(gpu.lowerMeshMaterial(material),gpu.lowerMeshMaterial(control));
  assert.equal(material.version,0);assert.equal(material.profile,'mesh-opaque-fragment-v0');
  const sourcePath=resolve(output,name+'-'+f.name+'.css'),irPath=resolve(output,name+'-'+f.name+'.ir.json');
  await writeFile(sourcePath,source);await writeFile(irPath,JSON.stringify(material,null,2)+'\n');
  const reopened=JSON.parse(await readFile(irPath,'utf8')),snapshot=JSON.stringify(reopened),cold=gpu.validateMeshMaterialIR(reopened);
  assert.equal(JSON.stringify(reopened),snapshot);assert.deepEqual(cold,compile(await readFile(sourcePath,'utf8')));assert(Object.isFrozen(cold)&&Object.isFrozen(cold.expression));
  const observations=f.values.map(values=>{const actual=evaluate(cold.expression,values),prediction=expected(f.value(values));actual.forEach((x,i)=>assert(Math.abs(x-prediction[i])<=1e-12));return{values,actualLinear:actual,independentLinear:prediction};});
  reopened.shaderId='caller_changed';assert.equal(cold.shaderId,'absolute');
  prior??=cold;accepted.push({name:f.name,sourcePath,irPath,observations,canonicalInlineIR:true});
 }
 // Tight abs interval supports a ratio directly; inline control requires its explicit clamp.
 const direct='@shader #direct {'+header+'@fragment {color:mix(#123,#ABC,abs(phase));}}';
 const directMaterial=compile(direct);assert.deepEqual(directMaterial.expression.args[2],compile(shader('abs(phase)')).expression.args[2].args[0]);
 evaluate(directMaterial.expression,{phase:-.5}).forEach((x,i)=>assert(Math.abs(x-expected(-.5)[i])<=1e-12));accepted.push({name:'direct-bounded-ratio',source:direct});
 // Near-work-boundary local verifies an accepted expanded authoring expression.
 const near=shader('abs(a)',header+'@let a:float('+balanced(Array(40).fill('phase'))+');');compile(near);accepted.push({name:'expanded-work-near-boundary'});
 const original=JSON.stringify(prior);
 for(const[label,x,code,span,decl]of invalid){const source=shader(x,decl??header),r=gpu.compileMeshMaterial(source);assert.equal(r.ok,false,label);const d=r.diagnostics[0];assert.equal(d.code,code,label);assert.equal(source.slice(d.start,d.end),span,label+' UTF16 token');refusals.push({name:label,diagnostic:d});assert.equal(JSON.stringify(prior),original);}
 // abs-specific interval gate: same large input is still legal in old clamp arithmetic.
 compile(shader(expansion('phase+1000')));
 const forged=JSON.parse(original);forged.expression.args[2].args[0]={kind:'call',type:'float',name:'abs',args:[{kind:'uniform',type:'float',name:'phase'}]};assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refusals.push({name:'forged-runtime-abs',code:'IR'});
 let getters=0;const accessor=JSON.parse(original);Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return prior.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(accessor),e=>e.code==='INPUT');assert.equal(getters,0);refusals.push({name:'getter',code:'INPUT',getters});
 assert.equal(JSON.stringify(prior),original);
 results.push({provider:name,entry:await receipt(path),exports,accepted,refusals,getters});
}
assert.deepEqual(results[0].exports,results[1].exports);
const result={ok:true,issue:1124,results,sourceGraph:graph,source:await receipt(resolve(pkg,'src/material/mesh-material.ts')),declarations:await receipt(resolve(pkg,map.types)),actualGL:false,support:'Actual public source/emitted compiler and cold source/IR files; existing IR/lowering equality and bounded CPU fixture observations. No renderer, pixels, consumer adoption or publication.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ok:true,accepted:results.reduce((n,r)=>n+r.accepted.length,0),refusals:results.reduce((n,r)=>n+r.refusals.length,0),getters:0,exports:54,actualGL:false}));
