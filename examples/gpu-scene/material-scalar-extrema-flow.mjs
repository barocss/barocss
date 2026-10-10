/** #1127: actual min/max source expansion, reconstruction and cold files. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--output');
assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),map=manifest.publishConfig.exports['.'];assert.equal(map.import,'./dist/index.js');assert.equal(map.types,'./dist/index.d.ts');
const src=resolve(output,'ordinary-source.mjs'),built=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,format:'esm',platform:'node',target:'node22',outfile:src,metafile:true});
const graph=Object.keys(built.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/mesh-material.ts')));assert(!graph.some(p=>p.includes('barocss-gpu/dist/')||p.includes('barocss-cad/dist/')));
const hash=x=>createHash('sha256').update(x).digest('hex');async function receipt(path){const x=await readFile(path);return{path,bytes:x.length,sha256:hash(x)};}
const header='@uniform a:float(-1,1,0);@uniform b:float(-1,1,0);';
const shader=(x,decl=header)=>`// Original π🙂 min/max authoring\n@shader #extrema {${decl}@fragment {color:mix(#123,#ABC,clamp(${x},0,1));}}`;
const inline=(kind,a,b)=>kind==='min'?`clamp(${a},-1000,${b})`:`clamp(${a},${b},1000)`;
const fixtures=[];
for(const kind of ['min','max']){
 fixtures.push({name:kind+'-crossed',x:`${kind}(a,b)`,old:inline(kind,'a','b'),values:[{a:-1,b:1},{a:.2,b:.8},{a:1,b:-1},{a:0,b:0}],expected:v=>Math[kind](v.a,v.b)});
 fixtures.push({name:kind+'-literal-boundary',x:`${kind}(-1000,1000)`,old:inline(kind,'-1000','1000'),decl:'',values:[{}],expected:()=>Math[kind](-1000,1000)});
 fixtures.push({name:kind+'-division-mix',x:`${kind}(mix(0,1,elapsed/120),.5)`,old:inline(kind,'mix(0,1,elapsed/120)','.5'),decl:'@uniform elapsed:float(0,120,60);',values:[{elapsed:0},{elapsed:60},{elapsed:120}],expected:v=>Math[kind](v.elapsed/120,.5)});
 fixtures.push({name:kind+'-old-bare-name',x:`${kind}(${kind},a)`,old:inline(kind,kind,'a'),decl:header+`@let ${kind}:float(b);`,values:[{a:-.5,b:.8},{a:.7,b:-.2}],expected:v=>Math[kind](v.b,v.a)});
}
fixtures.push({name:'nested-composition',x:'max(min(abs(a),.8),.2)',old:inline('max',inline('min','clamp(a,0,1000)+clamp(-a,0,1000)','.8'),'.2'),values:[{a:-1,b:0},{a:0,b:0},{a:.5,b:0}],expected:v=>Math.max(Math.min(Math.abs(v.a),.8),.2)});
function evaluate(e,v){switch(e.kind){case'float':return e.value;case'color':return e.linear;case'uniform':return v[e.name];case'unary':return(e.operator==='-'?-1:1)*evaluate(e.value,v);case'binary':{const a=evaluate(e.left,v),b=evaluate(e.right,v);return e.operator==='+'?a+b:e.operator==='-'?a-b:a*b;}case'call':{assert(!['min','max','abs'].includes(e.name),'Unexpanded runtime call');const a=e.args.map(x=>evaluate(x,v));if(e.name==='clamp')return Math.max(a[1],Math.min(a[2],a[0]));if(e.name==='mix')return a[0].map((x,i)=>x*(1-a[2])+a[1][i]*a[2]);if(e.name==='sin')return Math.sin(a[0]);if(e.name==='cos')return Math.cos(a[0]);}}throw Error('Unsupported existing IR');}
const color=x=>{const t=Math.max(0,Math.min(1,x));return[17,34,51].map((n,i)=>Math.pow(n/255,2.2)*(1-t)+Math.pow([170,187,204][i]/255,2.2)*t);};
const balanced=xs=>xs.length===1?xs[0]:'('+balanced(xs.slice(0,xs.length>>1))+'+'+balanced(xs.slice(xs.length>>1))+')';
let depth=header+'@let p0:float(a);';for(let i=1;i<=15;i++)depth+=`@let p${i}:float(+p${i-1});`;
const work=header+'@let x:float('+balanced(Array(42).fill('a'))+');@let y:float(+a);@let spare:float(0);';
const invalid=[];
for(const kind of ['min','max']){
 for(const[label,x,code,decl]of[
  ['arity0',kind+'()','TYPE'],['arity1',kind+'(a)','TYPE'],['arity3',kind+'(a,b,0)','TYPE'],
  ['color',kind+'(#123,b)','TYPE'],['left-range',kind+'(a+1000,b)','RANGE'],['right-range',kind+'(a,b-1000)','RANGE'],
  ['depth',kind+'(p15,b)','BUDGET',depth],
  ['generated-work',kind+'(x,x)','BUDGET',work+(kind==='max'?'@let extra:float(0);':'')]
 ])invalid.push({name:kind+'-'+label,x,code,span:kind,decl});
}
const results=[];
for(const[name,path]of [['ordinary-source',src],['emitted-public',resolve(pkg,map.import)]]){
 const gpu=await import(pathToFileURL(path).href),accepted=[],refusals=[];
 const compile=source=>{const r=gpu.compileMeshMaterial(source);assert.equal(r.ok,true,JSON.stringify(r.diagnostics));assert.equal(r.material.source,source);return r.material;};
 let prior=null;
 for(const f of fixtures){
  const source=shader(f.x,f.decl??header),old=shader(f.old,f.decl??header),material=compile(source),control=compile(old);
  assert.deepEqual(material.expression,control.expression,f.name);assert.deepEqual(material.uniforms,control.uniforms);assert.deepEqual(gpu.lowerMeshMaterial(material),gpu.lowerMeshMaterial(control));assert.equal(material.version,0);assert.equal(material.profile,'mesh-opaque-fragment-v0');
  const file=resolve(output,name+'-'+f.name+'.css'),ir=resolve(output,name+'-'+f.name+'.ir.json');await writeFile(file,source);await writeFile(ir,JSON.stringify(material,null,2)+'\n');
  const reopened=JSON.parse(await readFile(ir,'utf8')),snapshot=JSON.stringify(reopened),cold=gpu.validateMeshMaterialIR(reopened);assert.equal(JSON.stringify(reopened),snapshot);assert.deepEqual(cold,compile(await readFile(file,'utf8')));assert(Object.isFrozen(cold.expression));
  const observations=f.values.map(values=>{const actual=evaluate(cold.expression,values),prediction=color(f.expected(values));actual.forEach((x,i)=>assert(Math.abs(x-prediction[i])<=1e-12));return{values,actualLinear:actual,independentLinear:prediction};});
  reopened.shaderId='mutated';assert.equal(cold.shaderId,'extrema');prior??=cold;accepted.push({name:f.name,file,ir,observations,exactInlineIR:true});
 }
 for(const kind of ['min','max']){
  const decl='@uniform a:float(0,1,.5);@uniform b:float(0,1,.8);';
  const direct=`@shader #direct {${decl}@fragment {color:mix(#123,#ABC,${kind}(a,b));}}`,m=compile(direct);assert.equal(m.expression.args[2].name,'clamp');evaluate(m.expression,{a:.2,b:.8}).forEach((x,i)=>assert(Math.abs(x-color(Math[kind](.2,.8))[i])<=1e-12));accepted.push({name:kind+'-direct-ratio',source:direct});
  compile(shader(kind+'(x,x)',header+'@let x:float('+balanced(Array(41).fill('a'))+');'));accepted.push({name:kind+'-near-work-boundary'});
  // The legacy inline source permits this interval; new syntax intentionally limits it.
  compile(shader(inline(kind,'a+1000','b')));
 }
 const original=JSON.stringify(prior);
 for(const f of invalid){const source=shader(f.x,f.decl??header),r=gpu.compileMeshMaterial(source);assert.equal(r.ok,false,f.name);const d=r.diagnostics[0];assert.equal(d.code,f.code,f.name);assert.equal(source.slice(d.start,d.end),f.span,f.name+' UTF16 token');assert.equal(JSON.stringify(prior),original);refusals.push({name:f.name,diagnostic:d});}
 for(const kind of ['min','max']){const forged=JSON.parse(original);forged.expression.args[2].args[0]={kind:'call',type:'float',name:kind,args:[{kind:'uniform',type:'float',name:'a'},{kind:'uniform',type:'float',name:'b'}]};assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refusals.push({name:'forged-'+kind,code:'IR'});}
 let getters=0;const accessor=JSON.parse(original);Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return prior.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(accessor),e=>e.code==='INPUT');assert.equal(getters,0);assert.equal(JSON.stringify(prior),original);refusals.push({name:'getter',code:'INPUT',getters});
 results.push({provider:name,entry:await receipt(path),exports:Object.keys(gpu).sort(),accepted,refusals,getters});
}
assert.deepEqual(results[0].exports,results[1].exports);assert.equal(results[0].exports.length,54);
const result={ok:true,issue:1127,results,sourceGraph:graph,source:await receipt(resolve(pkg,'src/mesh-material.ts')),declarations:await receipt(resolve(pkg,map.types)),actualGL:false,support:'Actual source/emitted public CPU compiler, original source/IR files and trusted lowering equality. No runtime min/max calls, pixels, consumer adoption or publication.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,accepted:results.reduce((n,r)=>n+r.accepted.length,0),refusals:results.reduce((n,r)=>n+r.refusals.length,0),getters:0,exports:54,actualGL:false}));
