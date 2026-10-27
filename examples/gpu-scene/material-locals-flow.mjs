import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const arg=process.argv.indexOf('--output');
assert(arg>=0&&process.argv[arg+1],'--output <directory> required');
const output=resolve(process.argv[arg+1]);await mkdir(output,{recursive:true});
const root=resolve(repo,'packages/barocss-gpu');
const manifest=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
// (R6: the package's TypeScript sources bundled, as the other flows do: Node does not load them as they are.)
const bundle=async(from,name)=>{const outfile=resolve(output,name);await build({entryPoints:[from],bundle:true,platform:'node',format:'esm',target:'node22',outfile,logLevel:'warning'});return outfile;};
const entry=await bundle(resolve(root,manifest.exports['.'].import),'gpu-source.mjs'),bindingEntry=await bundle(resolve(root,'src/material/mesh-material.ts'),'mesh-material-source.mjs');
const sha=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
const gpu=await import(pathToFileURL(entry).href);
const {validateMeshMaterialBinding}=await import(pathToFileURL(bindingEntry).href);
const uniform='@uniform amount:float(0,1,0.25);';
const model=(declarations,expression,uniforms='')=>`@shader #locals { ${uniforms} ${declarations} @fragment { color:${expression}; } }`;
const compile=source=>{const result=gpu.compileMeshMaterial(source);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));assert.equal(result.material.source,source);return result.material;};
const fade='clamp(amount,0,1)',tint=`mix(#112233,#AABBCC,${fade})`;
const repeatedFade='clamp(((amount*0.5)+(amount*0.5)),0,1)',repeatedTint=`mix(#112233,#AABBCC,${repeatedFade})`;
const maxDeclarations=Array.from({length:16},(_,i)=>`@let d${i}:float(0);`).join(' ');
const fixtures=[
 {name:'float-color',source:model('@let fade:float(clamp(amount,0,1)); @let tint:color(mix(#112233,#AABBCC,fade));','tint',uniform),inline:model('',tint,uniform)},
 {name:'chain-repeated',source:model('@let scale:float(amount*0.5); @let fade:float(clamp(scale+scale,0,1)); @let tint:color(mix(#112233,#AABBCC,fade));','mix(tint,tint,0.5)',uniform),inline:model('',`mix(${repeatedTint},${repeatedTint},0.5)`,uniform)},
 {name:'literal',source:model('@let tint:color(#FFFFFF);','tint'),inline:model('','#FFFFFF')},
 {name:'sixteen-unused',source:model(maxDeclarations,'#FFFFFF'),inline:model('','#FFFFFF')},
];
const receipts=[];
for(const fixture of fixtures){
 const material=compile(fixture.source),inline=compile(fixture.inline);
 assert.deepEqual(material.expression,inline.expression);assert.deepEqual(material.uniforms,inline.uniforms);
 assert.equal(Object.hasOwn(material,'locals'),false);
 const lowered=gpu.lowerMeshMaterial(material);assert.deepEqual(lowered,gpu.lowerMeshMaterial(inline));
 await writeFile(resolve(output,fixture.name+'.source.css'),fixture.source);
 await writeFile(resolve(output,fixture.name+'.ir.json'),JSON.stringify(material,null,2)+'\n');
 const reopened=JSON.parse(await readFile(resolve(output,fixture.name+'.ir.json'),'utf8'));
 assert.deepEqual(gpu.validateMeshMaterialIR(reopened),material);
 const caller={material:reopened,uniforms:material.uniforms.length?{amount:0.75}:{}};
 const input=JSON.stringify(caller),binding=validateMeshMaterialBinding(caller);
 assert.equal(JSON.stringify(caller),input);assert(Object.isFrozen(binding.material.expression));
 if(material.uniforms.length){caller.uniforms.amount=1;assert.equal(binding.uniforms.amount,0.75);assert.equal(validateMeshMaterialBinding({material,uniforms:{}}).uniforms.amount,0.25);assert.equal(lowered.uniformLayout.length,1);assert.equal(lowered.uniformLayout[0].name,'amount');}
 reopened.shaderId='changed';assert.deepEqual(binding.material,material);assert.deepEqual(gpu.lowerMeshMaterial(binding.material),lowered);
 await writeFile(resolve(output,fixture.name+'.lowered.json'),JSON.stringify(lowered,null,2)+'\n');
 receipts.push({name:fixture.name,equivalentTypedIR:true,equivalentTrustedLowering:true,originalSource:true,reopened:true,copiedBinding:true});
}
const invalids=[
 ['unknown',model('','missing'),'TYPE','missing'],
 ['forward',model('@let a:float(b); @let b:float(0);','#FFFFFF'),'TYPE','b'],
 ['self',model('@let a:float(a);','#FFFFFF'),'TYPE','a'],
 ['cycle',model('@let a:float(b); @let b:float(a);','#FFFFFF'),'TYPE','b'],
 ['type',model('@let tint:float(#FFFFFF);','tint'),'TYPE','float'],
 ['duplicate',model('@let a:float(0); @let a:float(1);','#FFFFFF'),'TYPE','a'],
 ['uniform-collision',model('@let amount:float(0);','#FFFFFF',uniform),'TYPE','amount'],
 ['function-collision',model('@let sin:float(0);','#FFFFFF'),'TYPE','sin'],
 ['type-name-collision',model('@let color:float(0);','#FFFFFF'),'TYPE','color'],
 ['name-length',model('@let '+ 'a'.repeat(33)+':float(0);','#FFFFFF'),'SYNTAX','a'.repeat(33)],
 ['declaration-type',model('@let a:vector(0);','#FFFFFF'),'SYNTAX','vector'],
 ['uniform-order',model('@let a:float(0); '+uniform,'#FFFFFF'),'SYNTAX','uniform'],
 ['seventeen',model(maxDeclarations+' @let d16:float(0);','#FFFFFF'),'BUDGET','d16'],
];
let expansions='@let e0:float(1);';for(let i=1;i<=7;i++)expansions+=` @let e${i}:float(e${i-1}+e${i-1});`;
invalids.push(['expanded-work',model(expansions,'#FFFFFF'),'BUDGET',null]);
let depths='@let p0:float(0);';for(let i=1;i<=15;i++)depths+=` @let p${i}:float(+p${i-1});`;
invalids.push(['expanded-depth',model(depths,'mix(#FFFFFF,#000000,+p15)'),'BUDGET','+']);
const refusals=[];
for(const[name,source,code,token]of invalids){
 const result=gpu.compileMeshMaterial(source);assert.equal(result.ok,false,name);assert.equal(result.diagnostics[0].code,code,name);
 const diagnostic=result.diagnostics[0],span=source.slice(diagnostic.start,diagnostic.end);
 assert(span.length>0,name+' source range');if(token!==null)assert.equal(span,token,name);
 await writeFile(resolve(output,name+'.refused.css'),source);refusals.push({name,diagnostic,span});
}
const accepted=compile(fixtures[0].source),before=JSON.stringify(accepted);
assert.throws(()=>validateMeshMaterialBinding({material:accepted,uniforms:{amount:0.5,fade:0.5}}),e=>e.code==='UNIFORM');refusals.push({name:'local-external-binding',code:'UNIFORM'});
for(const[name,mutate]of[
 ['source',v=>{v.source=v.source.replace('clamp(amount,0,1)','clamp(amount*0.5,0,1)');}],
 ['expression',v=>{v.expression.args[0].hex='#000000';}],
 ['extra-locals',v=>{v.locals={fade:0.5};}],
]){const forged=structuredClone(accepted);mutate(forged);assert.throws(()=>gpu.validateMeshMaterialIR(forged),e=>e.code==='IR');refusals.push({name:'forged-'+name,code:'IR'});}
let getterCalls=0;const getter={...accepted};Object.defineProperty(getter,'source',{enumerable:true,get(){getterCalls++;return accepted.source;}});
assert.throws(()=>gpu.validateMeshMaterialIR(getter),e=>e.code==='INPUT');assert.equal(getterCalls,0);refusals.push({name:'getter',code:'INPUT'});
assert.equal(JSON.stringify(accepted),before);
const result={ok:true,entry,entrySha256:await sha(entry),bindingEntry,bindingEntrySha256:await sha(bindingEntry),version:accepted.version,profile:accepted.profile,cases:receipts,refusals,getterCalls,limits:'16 source-ordered compile-time float/color locals; definitions plus full expansions share256-work budget/depth16. No local IR/uniform/runtime shape. Public CPU compiler/IR/lowering with separate internal binding witness; renderer/consumer adoption unrun.'};
await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ok:true,cases:receipts.length,refusals:refusals.length,getterCalls,entrySha256:result.entrySha256}));
