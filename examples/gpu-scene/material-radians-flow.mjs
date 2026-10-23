/** #1152: degree authoring through the existing float/multiply material IR. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),at=process.argv.indexOf('--output');
assert(at>=0&&process.argv[at+1],'--output <fresh directory> required');
const output=resolve(process.argv[at+1]);await mkdir(output,{recursive:false});
const pkg=resolve(repo,'packages/barocss-gpu'),manifest=JSON.parse(await readFile(resolve(pkg,'package.json'),'utf8')),published=manifest.publishConfig.exports['.'];
assert.equal(published.import,'./dist/index.js');assert.equal(published.types,'./dist/index.d.ts');
const ordinary=resolve(output,'ordinary-source.mjs');
const bundled=await build({entryPoints:[resolve(pkg,manifest.exports['.'].import)],bundle:true,format:'esm',platform:'node',target:'node22',outfile:ordinary,metafile:true});
assert(Object.keys(bundled.metafile.inputs).some(p=>p.endsWith('/src/material/mesh-material.ts')));
assert(!Object.keys(bundled.metafile.inputs).some(p=>/barocss-(gpu|cad)\/dist\//.test(p)));
const hash=x=>createHash('sha256').update(x).digest('hex');
async function receipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:hash(bytes)};}
const header='@uniform angleDegrees:float(-360,360,90);';
const shader=(ratio,decl=header)=>`// Native π🙂 angle in degrees\r\n@shader #angle {${decl}@fragment {color:mix(#123,#ABC,${ratio});}}`;
const ratio=x=>`clamp((sin(${x})+1)*.5,0,1)`;
const fixtures=[
 {name:'degree-uniform',input:'angleDegrees',values:[-360,-180,-90,0,45,90,180,360]},
 {name:'signed-literal',input:'-90',value:()=>-90,values:[0]},
 {name:'positive-parentheses',input:'(+90)',value:()=>90,values:[0]},
 {name:'range-boundary',input:'angleDegrees',decl:'@uniform angleDegrees:float(-1000,1000,0);',values:[-1000,0,1000]},
 {name:'local-composition',input:'halfAngle',decl:header+'@let halfAngle:float(angleDegrees/2);',value:v=>v/2,values:[-360,-90,90,360]},
 {name:'bare-uniform-name',input:'radians',decl:'@uniform radians:float(-180,180,90);',variable:'radians',values:[-180,-90,0,90,180]},
 {name:'bare-local-name',input:'radians',decl:header+'@let radians:float(angleDegrees);',values:[-90,0,90]},
 {name:'scalar-mix',input:'mix(0,90,clamp(angleDegrees/360,0,1))',value:v=>90*Math.max(0,Math.min(1,v/360)),values:[-360,0,180,360]},
 {name:'nested-explicit',input:'radians(angleDegrees)',controlInput:'(angleDegrees*0.017453292519943295)',value:v=>v*Math.PI/180,values:[-90,0,90]}
];
function evaluate(e,values){switch(e.kind){case'float':return e.value;case'color':return e.linear;case'uniform':return values[e.name];case'unary':return(e.operator==='-'?-1:1)*evaluate(e.value,values);case'binary':{const a=evaluate(e.left,values),b=evaluate(e.right,values);return e.operator==='+'?a+b:e.operator==='-'?a-b:a*b;}case'call':{assert(['sin','cos','mix','clamp'].includes(e.name),'No new runtime call');const a=e.args.map(x=>evaluate(x,values));if(e.name==='clamp')return Math.max(a[1],Math.min(a[2],a[0]));if(e.name==='mix')return a[0].map((v,i)=>v*(1-a[2])+a[1][i]*a[2]);return Math[e.name](a[0]);}}throw Error('Unsupported IR');}
const colors=t=>[17,34,51].map((n,i)=>Math.pow(n/255,2.2)*(1-t)+Math.pow([170,187,204][i]/255,2.2)*t);
// Fourteen definitions charge 238 nodes; the last definition and fragment
// reach exactly 256 without hitting the independent parse-nesting limit.
const budget=n=>{let decl=header;for(let i=0;i<14;i++)decl+=`@let a${i}:float(radians(${Array(8).fill('1').join('+')}));`;decl+=`@let a14:float(radians(${Array(n).fill('1').join('+')}));`;return shader('clamp(radians(angleDegrees),0,1)',decl);};
const depth=n=>{let decl=header+'@let p0:float(angleDegrees);';for(let i=1;i<=n;i++)decl+=`@let p${i}:float(+p${i-1});`;return shader(`clamp(radians(p${n}),0,1)`,decl);};
const invalid=[
 {source:shader(ratio('radians()')),code:'TYPE'},
 {source:shader(ratio('radians(1,2)')),code:'TYPE'},
 {source:shader(ratio('radians(#123)')),code:'TYPE'},
 {source:shader(ratio('radians(angleDegrees+1)'),'@uniform angleDegrees:float(-1000,1000,0);'),code:'RANGE'},
 {source:shader(ratio('radians(angleDegrees*3)')),code:'RANGE'},
 {source:shader(ratio('radians(1001)')),code:'RANGE',token:'1001'},
 {source:shader(ratio('radians(unknown)')),code:'TYPE',token:'unknown'},
 {source:budget(5),code:'BUDGET',token:null},
 {source:depth(13),code:'BUDGET',token:null}
];
const results=[],providers=[['ordinary',await import(pathToFileURL(ordinary))],['emitted',await import(pathToFileURL(resolve(pkg,published.import)))]];
assert.deepEqual(Object.keys(providers[0][1]).sort(),Object.keys(providers[1][1]).sort());
let accepted=0,refused=0,getters=0;
for(const [provider,gpu]of providers){
 let previous;
 for(const fixture of fixtures){
  const source=shader(ratio(`radians(${fixture.input})`),fixture.decl),control=shader(ratio(`(${fixture.controlInput??fixture.input})*0.017453292519943295`),fixture.decl);
  const a=gpu.compileMeshMaterial(source),b=gpu.compileMeshMaterial(control);assert(a.ok,JSON.stringify(a));assert(b.ok,JSON.stringify(b));
  assert.equal(a.material.source,source);assert.equal(a.material.version,0);assert.equal(a.material.profile,'mesh-opaque-fragment-v0');assert(Object.isFrozen(a.material.expression));
  assert.deepEqual(a.material.expression,b.material.expression);
  const lowered=gpu.lowerMeshMaterial(a.material),other=gpu.lowerMeshMaterial(b.material);assert.deepEqual(lowered,other);
  for(const value of fixture.values){const argument=(fixture.value??(v=>v))(value),t=(Math.sin(argument*Math.PI/180)+1)/2,actual=evaluate(a.material.expression,{[fixture.variable??'angleDegrees']:value}),expected=colors(t);actual.forEach((channel,i)=>assert(Math.abs(channel-expected[i])<1e-12));}
  const path=resolve(output,`${provider}-${fixture.name}.source.css`),ir=resolve(output,`${provider}-${fixture.name}.ir.json`);
  await writeFile(path,source);await writeFile(ir,JSON.stringify(a.material));
  const saved=JSON.parse(await readFile(ir,'utf8')),cold=gpu.compileMeshMaterial(await readFile(path,'utf8'));assert(cold.ok);assert.deepEqual(gpu.validateMeshMaterialIR(saved),cold.material);
  saved.expression.kind='forged';assert.deepEqual(gpu.validateMeshMaterialIR(JSON.parse(await readFile(ir,'utf8'))),a.material);
  previous={material:a.material,path,ir,source,bytes:await readFile(ir)};accepted++;
  results.push({provider,name:fixture.name,source:await receipt(path),ir:await receipt(ir)});
 }
 for(const source of[budget(4),depth(12),shader('clamp((cos(radians(angleDegrees))+1)*.5,0,1)'),shader(ratio('angleDegrees'))]){const result=gpu.compileMeshMaterial(source);assert(result.ok,JSON.stringify(result));if(source.includes('cos'))evaluate(result.material.expression,{angleDegrees:90}).forEach((c,i)=>assert(Math.abs(c-colors(.5)[i])<1e-12));if(source===shader(ratio('angleDegrees')))assert.notDeepEqual(result.material.expression,gpu.compileMeshMaterial(shader(ratio('radians(angleDegrees)'))).material.expression);accepted++;}
 for(const fixture of invalid){const result=gpu.compileMeshMaterial(fixture.source);assert(!result.ok,'Expected refusal');assert.equal(result.diagnostics[0].code,fixture.code);const d=result.diagnostics[0];if(fixture.token!==null)assert.equal(fixture.source.slice(d.start,d.end),fixture.token??'radians');assert.equal(await readFile(previous.path,'utf8'),previous.source);assert.deepEqual(await readFile(previous.ir),previous.bytes);refused++;results.push({provider,refusal:fixture.code,diagnostic:d});}
 const forged=JSON.parse(JSON.stringify(previous.material));forged.expression={kind:'float',type:'float',value:.5};assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refused++;
 const accessor={...previous.material};Object.defineProperty(accessor,'source',{enumerable:true,get(){getters++;return previous.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(accessor),e=>e.code==='INPUT');assert.equal(getters,0);refused++;
 assert.deepEqual(gpu.validateMeshMaterialIR(previous.material),previous.material);assert.deepEqual(await readFile(previous.ir),previous.bytes);
}
const report={issue:1152,actualGL:false,accepted,refused,getters,exports:Object.keys(providers[0][1]).length,source:await receipt(resolve(pkg,'src/material/mesh-material.ts')),declarations:await receipt(resolve(pkg,published.types)),ordinary:await receipt(ordinary),emitted:await receipt(resolve(pkg,published.import)),results};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({issue:1152,accepted,refused,getters,exports:report.exports,actualGL:false}));
