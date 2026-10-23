/** #1164: bounded integer powers lowered to existing repeated products. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--source');
assert(at>=0&&process.argv[at+1],'--source <fresh directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const ordinary=resolve(output,'ordinary-source.mjs');
const bundled=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,format:'esm',platform:'node',target:'node22',outfile:ordinary,metafile:true});
const graph=Object.keys(bundled.metafile.inputs);assert(graph.some(p=>p.endsWith('/src/material/mesh-material.ts')));assert(!graph.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:hash(bytes)};}
const header='@uniform strength:float(0,1,.5);';
const shader=(x,decl=header)=>`// Native source π🙂\r\n@shader #fade {${decl}@fragment {color:mix(#000,#FFF,${x});}}`;
const product=(base,n)=>{let p=`(${base})`;for(let i=1;i<n;i++)p=`(${p}*(${base}))`;return p;};
const fixtures=Array.from({length:7},(_,i)=>({name:'power-'+(i+2),base:'strength',n:i+2}));
fixtures.push(
 {name:'expression-base',base:'strength*.5+.25',n:3,value:v=>v*.5+.25},
 {name:'signed-base-even',base:'-strength',n:2,value:v=>-v},
 {name:'signed-base-odd',base:'-strength',n:3,value:v=>-v},
 {name:'function-base',base:'sin(strength)',n:3,value:v=>Math.sin(v)},
 {name:'local-base',base:'halfStrength',n:3,decl:header+'@let halfStrength:float(strength*.5);',value:v=>v*.5},
 {name:'nested-base',base:'pow(strength,2)',controlBase:'(strength*strength)',n:3,value:v=>v*v},
 {name:'bare-uniform',base:'pow',n:3,decl:'@uniform pow:float(0,1,.5);',variable:'pow'},
 {name:'bare-local',base:'pow',n:3,decl:header+'@let pow:float(strength);'},
 {name:'decimal-exponent',base:'strength',n:2,spelling:'2.0'},
 {name:'exponent-spelling',base:'strength',n:2,spelling:'2e0'},
 {name:'literal-zero',base:'0',n:8,value:()=>0},
 {name:'literal-one',base:'1',n:8,value:()=>1}
);
const budget=n=>shader(`clamp(pow(strength,${n}),0,1)`,header+Array.from({length:15},(_,i)=>`@let a${i}:float(pow(1,8));`).join(''));
const depth=n=>{let d=header+'@let p0:float(strength);';for(let i=1;i<=n;i++)d+=`@let p${i}:float(+p${i-1});`;return shader(`clamp(pow(p${n},2),0,1)`,d);};
function evaluate(e,values){switch(e.kind){case'float':return e.value;case'color':return e.linear;case'uniform':return values[e.name];case'unary':return(e.operator==='-'?-1:1)*evaluate(e.value,values);case'binary':{const a=evaluate(e.left,values),b=evaluate(e.right,values);return e.operator==='+'?a+b:e.operator==='-'?a-b:a*b;}case'call':{assert(['sin','cos','mix','clamp'].includes(e.name),'No new runtime intrinsic');const a=e.args.map(x=>evaluate(x,values));if(e.name==='clamp')return Math.max(a[1],Math.min(a[2],a[0]));if(e.name==='mix')return a[0].map((v,i)=>v*(1-a[2])+a[1][i]*a[2]);return Math[e.name](a[0]);}}throw Error('Unsupported IR');}
const invalid=[
 ...['pow()','pow(strength)','pow(strength,2,3)','pow(#123,2)','pow(strength,strength)','pow(strength,2+1)','pow(strength,-2)','pow(strength,+2)','pow(strength,(2))'].map(x=>({source:shader(`clamp(${x},0,1)`),code:'TYPE',token:'pow'})),
 ...[0,1,9,2.5].map(n=>({source:shader(`clamp(pow(strength,${n}),0,1)`),code:'RANGE',token:'pow'})),
 {source:shader('clamp(pow(strength,1001),0,1)'),code:'RANGE',token:'1001'},
 {source:shader('clamp(pow(unknown,2),0,1)'),code:'TYPE',token:'unknown'},
 {source:shader('clamp(pow(1000,3),0,1)'),code:'RANGE',token:'pow'},
 {source:shader('pow(strength,2)','@uniform strength:float(-1,1,0);'),code:'RANGE',token:'mix'},
 {source:shader('pow(strength,n)',header+'@let n:float(3);'),code:'TYPE',token:'pow'},
 {source:budget(6),code:'BUDGET'},
 {source:depth(13),code:'BUDGET'}
];
const providers=[['ordinary',await import(pathToFileURL(ordinary))],['emitted',await import(pathToFileURL(resolve(pkg,published.import)))]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());assert.equal(Object.keys(providers[0][1]).length,54);
const results=[];let accepted=0,refused=0,getters=0;
for(const[provider,gpu]of providers){
 let previous;
 for(const f of fixtures){
  const source=shader(`clamp(pow(${f.base},${f.spelling??f.n}),0,1)`,f.decl),control=shader(`clamp(${product(f.controlBase??f.base,f.n)},0,1)`,f.decl);
  const a=gpu.compileMeshMaterial(source),b=gpu.compileMeshMaterial(control);assert(a.ok,JSON.stringify(a));assert(b.ok,JSON.stringify(b));
  assert.equal(a.material.version,0);assert.equal(a.material.profile,'mesh-opaque-fragment-v0');assert.equal(a.material.source,source);assert(Object.isFrozen(a.material.expression));
  assert.deepEqual(a.material.expression,b.material.expression);assert.deepEqual(gpu.lowerMeshMaterial(a.material),gpu.lowerMeshMaterial(b.material));assert(!gpu.lowerMeshMaterial(a.material).expression.includes('pow('));
  for(const v of[0,.25,.5,.75,1]){const expected=Math.max(0,Math.min(1,Math.pow((f.value??(x=>x))(v),f.n)));evaluate(a.material.expression,{[f.variable??'strength']:v}).forEach(x=>assert(Math.abs(x-expected)<1e-12));}
  const path=resolve(output,provider+'-'+f.name+'.source.css'),ir=resolve(output,provider+'-'+f.name+'.ir.json');await writeFile(path,source);await writeFile(ir,JSON.stringify(a.material));
  const saved=JSON.parse(await readFile(ir,'utf8')),cold=gpu.compileMeshMaterial(await readFile(path,'utf8'));assert(cold.ok);const owned=gpu.validateMeshMaterialIR(saved);assert.deepEqual(owned,cold.material);assert.notStrictEqual(owned,saved);assert(Object.isFrozen(owned.expression));
  saved.expression.kind='forged';assert.deepEqual(gpu.validateMeshMaterialIR(JSON.parse(await readFile(ir,'utf8'))),a.material);
  previous={material:a.material,path,ir,source,bytes:await readFile(ir)};accepted++;results.push({provider,name:f.name,n:f.n,source:await receipt(path),ir:await receipt(ir)});
 }
 for(const[name,source]of[['work256',budget(5)],['depth16',depth(12)],['intermediate-million',shader('clamp(pow(1000,2),0,1)')]]){const a=gpu.compileMeshMaterial(source);assert(a.ok,JSON.stringify(a));accepted++;results.push({provider,name});}
 for(const f of invalid){const a=gpu.compileMeshMaterial(f.source);assert(!a.ok,'Expected '+f.code);const d=a.diagnostics[0];assert.equal(d.code,f.code);if(f.token)assert.equal(f.source.slice(d.start,d.end),f.token);assert.equal(await readFile(previous.path,'utf8'),previous.source);assert.deepEqual(await readFile(previous.ir),previous.bytes);assert.deepEqual(gpu.validateMeshMaterialIR(previous.material),previous.material);refused++;results.push({provider,refusal:f.code,diagnostic:d});}
 const forged=JSON.parse(JSON.stringify(previous.material));forged.expression={kind:'float',type:'float',value:.5};assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refused++;
 const accessor={...previous.material};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return previous.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(accessor),e=>e.code==='INPUT');assert.equal(getters,0);refused++;
 assert.deepEqual(await readFile(previous.ir),previous.bytes);
}
const report={issue:1164,actualGL:false,accepted,refused,getters,exports:Object.keys(providers[0][1]).length,graph,source:await receipt(resolve(pkg,'src/material/mesh-material.ts')),declarations:await receipt(resolve(pkg,published.types)),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results};
assert.equal(report.declarations.sha256,'1a053e26308500aada122107823add113842a9ab0e4ba28ada51c65bf1012944','Existing declarations unchanged');
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({issue:1164,accepted,refused,getters,exports:report.exports,actualGL:false}));
