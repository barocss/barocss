/** #1146: actual literal-edge ramps, canonical lowering and cold files. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--output');
assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),map=manifest.publishConfig.exports['.'];
assert.equal(map.import,'./dist/index.js');assert.equal(map.types,'./dist/index.d.ts');
const src=resolve(output,'ordinary-source.mjs'),built=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,format:'esm',platform:'node',target:'node22',outfile:src,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/material/mesh-material.ts')));assert(!graph.some(p=>p.includes('barocss-gpu/dist/')||p.includes('barocss-cad/dist/')));
const hash=x=>createHash('sha256').update(x).digest('hex');async function receipt(path){const x=await readFile(path);return{path,bytes:x.length,sha256:hash(x)};}
const header='@uniform amount:float(-1,2,.5);';
const shader=(x,decl=header)=>`// Original π🙂 eased material amount\n@shader #ramp {${decl}@fragment {color:mix(#123,#ABC,${x});}}`;
const fixtures=[
 {name:'unit',lo:'0',hi:'1',x:'amount',values:[-1,0,.25,.5,.75,1,2]},
 {name:'signed-offset',lo:'-1',hi:'1',x:'amount',values:[-1,0,.5,1,2]},
 {name:'parenthesized',lo:'(+0)',hi:'(1)',x:'amount',values:[0,.5,1]},
 {name:'reciprocal-boundary',lo:'0',hi:'.001',x:'amount',values:[0,.00025,.0005,.001,2]},
 {name:'maximum-width',lo:'-1000',hi:'1000',x:'amount',values:[-1,0,.5,2]},
 {name:'constant-local-edges',lo:'edge',hi:'1',x:'amount',extra:'@let edge:float(0);',edge0:0,values:[0,.5,1]},
 {name:'bare-name',lo:'0',hi:'1',x:'smoothstep',decl:'@uniform smoothstep:float(0,1,.5);',variable:'smoothstep',values:[0,.25,1]},
 {name:'composition',lo:'0',hi:'1',x:'max(min(abs(amount/2),1),0)',values:[-1,0,1,2],input:v=>Math.max(Math.min(Math.abs(v/2),1),0)},
 {name:'scalar-mix',lo:'0',hi:'1',x:'mix(0,1,clamp(amount,0,1))',values:[-1,.25,1,2],input:v=>Math.max(0,Math.min(1,v))}
];
function evaluate(e,v){switch(e.kind){case'float':return e.value;case'color':return e.linear;case'uniform':return v[e.name];case'unary':return(e.operator==='-'?-1:1)*evaluate(e.value,v);case'binary':{const a=evaluate(e.left,v),b=evaluate(e.right,v);return e.operator==='+'?a+b:e.operator==='-'?a-b:a*b;}case'call':{assert(['clamp','mix','sin','cos'].includes(e.name),'Unexpanded runtime call');const a=e.args.map(x=>evaluate(x,v));if(e.name==='clamp')return Math.max(a[1],Math.min(a[2],a[0]));if(e.name==='mix')return a[0].map((x,i)=>x*(1-a[2])+a[1][i]*a[2]);return Math[e.name](a[0]);}}throw Error('Unsupported existing IR');}
const color=t=>[17,34,51].map((n,i)=>Math.pow(n/255,2.2)*(1-t)+Math.pow([170,187,204][i]/255,2.2)*t);
const eased=(v,a,b)=>{if(v<=a)return 0;if(v>=b)return 1;const t=(v-a)/(b-a);return 3*t*t-2*t*t*t;};
const balanced=xs=>xs.length===1?xs[0]:'('+balanced(xs.slice(0,xs.length>>1))+'+'+balanced(xs.slice(xs.length>>1))+')';
let depth=header+'@let p0:float(amount);';for(let i=1;i<=9;i++)depth+=`@let p${i}:float(+p${i-1});`;
const invalid=[
 ['arity0','smoothstep()','TYPE'],['arity1','smoothstep(0)','TYPE'],['arity2','smoothstep(0,1)','TYPE'],['arity4','smoothstep(0,1,amount,0)','TYPE'],
 ['color-edge','smoothstep(#123,1,amount)','TYPE'],['color-input','smoothstep(0,1,#123)','TYPE'],['dynamic-left','smoothstep(amount,1,amount)','TYPE'],['dynamic-right','smoothstep(0,amount,amount)','TYPE'],
 ['arithmetic-edge','smoothstep(0+0,1,amount)','TYPE'],['equal','smoothstep(1,1,amount)','RANGE'],['reversed','smoothstep(1,0,amount)','RANGE'],['narrow','smoothstep(0,.0009,amount)','RANGE'],
 ['input-range','smoothstep(0,1,amount+1000)','RANGE'],['intermediate','smoothstep(-1000,-999.999,amount)','RANGE'],
 ['generated-work',`smoothstep(0,1,${balanced(Array(38).fill('amount'))})`,'BUDGET'],['generated-depth','smoothstep(0,1,p9)','BUDGET',depth]
];
const results=[];
for(const[name,path]of [['ordinary-source',src],['emitted-public',resolve(pkg,map.import)]]){
 const gpu=await import(pathToFileURL(path).href),accepted=[],refusals=[];
 const compile=source=>{const r=gpu.compileMeshMaterial(source);assert.equal(r.ok,true,JSON.stringify(r.diagnostics));assert.equal(r.material.source,source);return r.material;};
 let prior;
 for(const f of fixtures){
  const decl=(f.decl??header)+(f.extra??''),source=shader(`smoothstep(${f.lo},${f.hi},${f.x})`,decl);
  const low=f.edge0??Number(f.lo.replace(/[()+]/g,'')),high=Number(f.hi.replace(/[()+]/g,'')),inverse=1/(high-low);
  const t=`clamp((${f.x}-${f.lo})*${inverse},0,1)`,control=shader('clamp(t*t*(3-2*t),0,1)',decl+`@let t:float(${t});`);
  const material=compile(source),old=compile(control);assert.deepEqual(material.expression,old.expression,f.name);assert.deepEqual(gpu.lowerMeshMaterial(material),gpu.lowerMeshMaterial(old));
  assert.equal(material.version,0);assert.equal(material.profile,'mesh-opaque-fragment-v0');
  const file=resolve(output,name+'-'+f.name+'.css'),ir=resolve(output,name+'-'+f.name+'.ir.json');await writeFile(file,source);await writeFile(ir,JSON.stringify(material,null,2)+'\n');
  const reopened=JSON.parse(await readFile(ir,'utf8')),snapshot=JSON.stringify(reopened),cold=gpu.validateMeshMaterialIR(reopened);assert.equal(JSON.stringify(reopened),snapshot);assert.deepEqual(cold,compile(await readFile(file,'utf8')));assert(Object.isFrozen(cold.expression));
  const observations=f.values.map(value=>{const values={[f.variable??'amount']:value},actual=evaluate(cold.expression,values),prediction=color(eased(f.input?f.input(value):value,low,high));actual.forEach((x,i)=>assert(Math.abs(x-prediction[i])<=1e-12,f.name));return{values,actualLinear:actual,independentLinear:prediction};});
  reopened.shaderId='mutated';assert.equal(cold.shaderId,'ramp');prior??=cold;accepted.push({name:f.name,source:await receipt(file),ir:await receipt(ir),observations,exactInlineIR:true});
 }
 compile(shader(`smoothstep(0,1,${balanced(Array(37).fill('amount'))})`));accepted.push({name:'near-work-boundary-37-terms'});
 compile(shader('smoothstep(0,1,smoothstep(0,1,amount))'));accepted.push({name:'two-nested-ramps'});
 const original=JSON.stringify(prior),priorFile=resolve(output,name+'-accepted.json');await writeFile(priorFile,original);const priorBytes=await readFile(priorFile);
 for(const[label,x,code,decl]of invalid){const source=shader(x,decl??header),r=gpu.compileMeshMaterial(source);assert.equal(r.ok,false,label);const d=r.diagnostics[0];assert.equal(d.code,code,label);assert.equal(source.slice(d.start,d.end),'smoothstep',label+' UTF16 token');assert.equal(JSON.stringify(prior),original);assert.deepEqual(await readFile(priorFile),priorBytes);refusals.push({name:label,diagnostic:d});}
 const forged=JSON.parse(original);forged.expression.args[2]={kind:'call',type:'float',name:'smoothstep',args:[{kind:'float',type:'float',value:0},{kind:'float',type:'float',value:1},{kind:'uniform',type:'float',name:'amount'}]};assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refusals.push({name:'forged-runtime-call',code:'IR'});
 let getters=0;const accessor=JSON.parse(original);Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return prior.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(accessor),e=>e.code==='INPUT');assert.equal(getters,0);assert.equal(JSON.stringify(prior),original);refusals.push({name:'getter',code:'INPUT',getters});
 results.push({provider:name,entry:await receipt(path),exports:Object.keys(gpu).sort(),accepted,refusals,getters});
}
assert.deepEqual(results[0].exports,results[1].exports);assert.equal(results[0].exports.length,54);
const result={ok:true,issue:1146,results,sourceGraph:graph,source:await receipt(resolve(pkg,'src/material/mesh-material.ts')),declarations:await receipt(resolve(pkg,map.types)),actualGL:false,support:'Actual source/emitted CPU compiler, original source/IR files and exact trusted lowering. No runtime smoothstep call, pixels, consumer adoption or publication.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,accepted:results.reduce((n,r)=>n+r.accepted.length,0),refusals:results.reduce((n,r)=>n+r.refusals.length,0),getters:0,exports:54,actualGL:false}));
