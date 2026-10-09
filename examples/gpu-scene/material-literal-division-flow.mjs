/** #1021: compiled public CPU source/IR/lowering/file acceptance, no renderer. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),index=process.argv.indexOf('--output');
assert(index>=0&&process.argv[index+1]&&!process.argv[index+1].startsWith('--'),'--output <unique-directory> required');
const output=resolve(process.argv[index+1]);await mkdir(output,{recursive:true});
const root=resolve(repo,'packages/barocss-gpu'),manifestPath=resolve(root,'package.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const compiledExport=manifest.publishConfig?.exports?.['.']??manifest.exports['.'];
assert.equal(compiledExport.import,'./dist/index.js','Explicit compiled GPU entry required; no source fallback');
assert.equal(compiledExport.types,'./dist/index.d.ts','Explicit compiled GPU declarations required');
const entry=resolve(root,compiledExport.import),sourcePath=resolve(root,'src/mesh-material.ts'),gpu=await import(pathToFileURL(entry).href);
for(const operation of['compileMeshMaterial','validateMeshMaterialIR','lowerMeshMaterial'])assert.equal(typeof gpu[operation],'function',operation);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fileReceipt(path){const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};}
const provider={manifest:await fileReceipt(manifestPath),source:await fileReceipt(sourcePath),compiled:await fileReceipt(entry),publicOperations:['compileMeshMaterial','validateMeshMaterialIR','lowerMeshMaterial'],internalBindingUsed:false};
await writeFile(resolve(output,'provider.json'),JSON.stringify(provider,null,2)+'\n');
const shader=(expression,uniform='@uniform elapsed:float(0,120,60);',locals='')=>`@shader #literal_division { ${uniform} ${locals} @fragment { color:mix(#112233,#AABBCC,clamp(${expression},0,1)); } }`;
const factor='0.0083333333333333332';
const balanced=terms=>terms.length===1?terms[0]:'('+balanced(terms.slice(0,Math.floor(terms.length/2)))+'+'+balanced(terms.slice(Math.floor(terms.length/2)))+')';
const fixtures=[
 {name:'elapsed-ratio',source:shader('elapsed/120'),old:shader('elapsed*'+factor),values:[0,30,60,120],ratio:v=>v/120},
 {name:'left-associative-multiply',source:shader('elapsed/+2*3','@uniform elapsed:float(0,1,0.5);'),old:shader('elapsed*0.5*3','@uniform elapsed:float(0,1,0.5);'),values:[0,.25,.5,1],ratio:v=>v/2*3},
 {name:'signed-exponent',source:shader('-elapsed/-1e2'),old:shader('-elapsed*-0.01'),values:[0,30,60,120],ratio:v=>-v/-1e2,negativeFactor:-.01},
 {name:'reciprocal-boundary',source:shader('elapsed/1e-3','@uniform elapsed:float(0,0.001,0.0005);'),old:shader('elapsed*1000','@uniform elapsed:float(0,0.001,0.0005);'),values:[0,.00025,.0005,.001],ratio:v=>v/1e-3},
 {name:'source-local-repeated',source:shader('rate+rate','@uniform elapsed:float(0,120,60);','@let rate:float(elapsed/120);'),old:shader('rate+rate','@uniform elapsed:float(0,120,60);','@let rate:float(elapsed*'+factor+');'),values:[0,30,60,120],ratio:v=>v/120+v/120},
];
function evaluate(expression,uniforms){switch(expression.kind){case'float':return expression.value;case'color':return expression.linear;case'uniform':return uniforms[expression.name];case'unary':{const value=evaluate(expression.value,uniforms);return expression.operator==='-'?-value:value;}case'binary':{assert(['+','-','*'].includes(expression.operator),'Unexpected division IR/runtime node');const a=evaluate(expression.left,uniforms),b=evaluate(expression.right,uniforms);return expression.operator==='+'?a+b:expression.operator==='-'?a-b:a*b;}case'call':{const values=expression.args.map(arg=>evaluate(arg,uniforms));switch(expression.name){case'clamp':return Math.max(values[1],Math.min(values[2],values[0]));case'mix':return values[0].map((n,i)=>n*(1-values[2])+values[1][i]*values[2]);case'sin':return Math.sin(values[0]);case'cos':return Math.cos(values[0]);}}}throw Error('Unknown trusted material expression');}
const independent=ratio=>{const t=Math.max(0,Math.min(1,ratio)),first=[17,34,51].map(n=>Math.pow(n/255,2.2)),second=[170,187,204].map(n=>Math.pow(n/255,2.2));return first.map((n,i)=>n*(1-t)+second[i]*t);};
const compile=source=>{const result=gpu.compileMeshMaterial(source);assert.equal(result.ok,true,JSON.stringify(result.diagnostics));assert.equal(result.material.source,source);return result.material;};
function walk(expression,visit){visit(expression);if(expression.kind==='unary')walk(expression.value,visit);if(expression.kind==='binary'){walk(expression.left,visit);walk(expression.right,visit);}if(expression.kind==='call')expression.args.forEach(arg=>walk(arg,visit));}
let accepted=null,acceptedSnapshot=null;const cases=[],files=[];
for(const fixture of fixtures){
 const authoredPath=resolve(output,fixture.name+'.source.css'),oldPath=resolve(output,fixture.name+'.old-multiplication.css');await writeFile(authoredPath,fixture.source);await writeFile(oldPath,fixture.old);
 const material=compile(await readFile(authoredPath,'utf8')),old=compile(await readFile(oldPath,'utf8')),lowered=gpu.lowerMeshMaterial(material),oldLowered=gpu.lowerMeshMaterial(old);
 assert.equal(material.version,0);assert.equal(material.profile,'mesh-opaque-fragment-v0');assert.equal(material.shaderId,old.shaderId);assert.deepEqual(material.uniforms,old.uniforms);
 const structural=fixture.negativeFactor===undefined;
 if(structural){assert.deepEqual(material.expression,old.expression,fixture.name+' reciprocal typed IR');assert.deepEqual(lowered,oldLowered,fixture.name+' trusted lowering');}
 else {let signedFactor=false;walk(material.expression,e=>{if(e.kind==='float'&&Object.is(e.value,fixture.negativeFactor))signedFactor=true;});assert(signedFactor,'Canonical signed reciprocal float missing');assert.notDeepEqual(material.expression,old.expression,'Old signed authored literal must retain its unary node');assert.notDeepEqual(lowered.expression,oldLowered.expression,'Signed reciprocal shape difference must be disclosed');}
 walk(material.expression,e=>{if(e.kind==='binary')assert.notEqual(e.operator,'/');});
 const irPath=resolve(output,fixture.name+'.ir.json'),loweredPath=resolve(output,fixture.name+'.lowered.json');await writeFile(irPath,JSON.stringify(material,null,2)+'\n');await writeFile(loweredPath,JSON.stringify(lowered,null,2)+'\n');const reopened=JSON.parse(await readFile(irPath,'utf8')),reopenedBefore=JSON.stringify(reopened),cold=gpu.validateMeshMaterialIR(reopened);assert.deepEqual(cold,material);assert.equal(JSON.stringify(reopened),reopenedBefore);assert(Object.isFrozen(cold)&&Object.isFrozen(cold.expression));assert.deepEqual(gpu.lowerMeshMaterial(cold),lowered);
 const colors=fixture.values.map(elapsed=>{const uniforms=material.uniforms.length?{elapsed}:{},actual=evaluate(material.expression,uniforms),previous=evaluate(old.expression,uniforms),expected=independent(fixture.ratio(elapsed));actual.forEach((n,i)=>{assert(Number.isFinite(n));assert(Math.abs(n-expected[i])<=1e-12,fixture.name+' independent linear channel');assert(Math.abs(n-previous[i])<=1e-12,fixture.name+' old semantic channel');});return{uniforms,actualLinear:actual,independentLinear:expected,oldLinear:previous};});
 if(!accepted){accepted=cold;acceptedSnapshot=JSON.stringify(accepted);}
 reopened.shaderId='caller_mutated';assert.deepEqual(cold,material,'Cold reconstruction aliases caller IR');assert.equal(JSON.stringify(accepted),acceptedSnapshot,'Previously accepted original IR changed');
 cases.push({name:fixture.name,exactReciprocalIRAndLowering:structural,negativeCanonicalFactor:fixture.negativeFactor??null,oldNegativeUnaryShapeDifference:!structural,semanticNumericEquivalent:true,sourceRetained:true,coldReconstruction:true,colors,typedExpression:material.expression});for(const path of[authoredPath,oldPath,irPath,loweredPath])files.push(await fileReceipt(path));
}
// Existing authored grammar is recompiled cold without altered source or IR.
const compatibilitySources=[
 '@shader #old_color { @fragment { color:#112233; } }',
 '@shader #old_local { @uniform elapsed:float(0,1,0.5); @let tint:color(mix(#112233,#AABBCC,clamp(elapsed*0.5+0.25,0,1))); @fragment { color:tint; } }',
];
for(const[name,source]of compatibilitySources.map((source,index)=>['old-compatibility-'+index,source])){const material=compile(source),lowered=gpu.lowerMeshMaterial(material);assert.deepEqual(gpu.validateMeshMaterialIR(JSON.parse(JSON.stringify(material))),material);assert.deepEqual(gpu.lowerMeshMaterial(material),lowered);const path=resolve(output,name+'.source.css');await writeFile(path,source);files.push(await fileReceipt(path));cases.push({name,unchangedAuthoredSource:true,coldReconstruction:true,lowered});}
const invalids=[
 ['zero',shader('elapsed/0'),'RANGE','0'],['negative-zero',shader('elapsed/-0'),'RANGE','-0'],['positive-zero',shader('elapsed/+0'),'RANGE','+0'],
 ['underflow',shader('elapsed/1e-400'),'RANGE','1e-400'],['unsafe-reciprocal',shader('elapsed/1e-4'),'RANGE','1e-4'],
 ['literal-overflow',shader('elapsed/1e309'),'RANGE','1e309'],['literal-bound',shader('elapsed/1001'),'RANGE','1001'],
 ['variable-denominator',shader('elapsed/elapsed'),'SYNTAX','elapsed'],
 ['local-denominator',shader('elapsed/divisor','@uniform elapsed:float(0,120,60);','@let divisor:float(2);'),'SYNTAX','divisor'],
 ['parenthesized-denominator',shader('elapsed/(2)'),'SYNTAX','('],['color-denominator',shader('elapsed/#FFFFFF'),'SYNTAX','#FFFFFF'],
 ['nonnumeric-denominator',shader('elapsed/abc'),'SYNTAX','abc'],['color-numerator',shader('#FFFFFF/2'),'TYPE','/'],
 ['trailing-divisor-token',shader('elapsed/2x'),'SYNTAX','x'],
 ['intermediate-range',shader('elapsed/0.001*2','@uniform elapsed:float(0,1000,500);'),'RANGE','*'],
 ['charged-work',shader(balanced(Array.from({length:63},()=> 'elapsed/120')),'@uniform elapsed:float(0,1,0.5);'),'BUDGET',null],
];
let depths='@let p0:float(elapsed);';for(let i=1;i<=15;i++)depths+=` @let p${i}:float(+p${i-1});`;invalids.push(['generated-multiply-depth',shader('p15/2','@uniform elapsed:float(0,1,0.5);',depths),'BUDGET','/']);
const refusals=[];
for(const[name,source,code,token]of invalids){
 const path=resolve(output,name+'.refused.css');await writeFile(path,source);const result=gpu.compileMeshMaterial(await readFile(path,'utf8'));assert.equal(result.ok,false,name);const diagnostic=result.diagnostics[0];assert.equal(diagnostic.code,code,name);assert(Number.isInteger(diagnostic.start)&&Number.isInteger(diagnostic.end)&&diagnostic.start>=0&&diagnostic.end<=source.length&&diagnostic.end>diagnostic.start,name+' original half-open span');const span=source.slice(diagnostic.start,diagnostic.end);if(token!==null)assert.equal(span,token,name+' original token span');assert.equal(JSON.stringify(accepted),acceptedSnapshot,'Refusal changed accepted source/IR');refusals.push({name,diagnostic,span,halfOpenUTF16:true,acceptedIRRetained:true});files.push(await fileReceipt(path));
}
const raw=JSON.parse(acceptedSnapshot),findMultiply=expression=>{let found=null;walk(expression,e=>{if(!found&&e.kind==='binary'&&e.operator==='*'&&e.right.kind==='float')found=e;});return found;};
for(const[name,mutate]of[
 ['forged-division-operator',expression=>findMultiply(expression).operator='/'],
 ['altered-reciprocal-factor',expression=>findMultiply(expression).right.value=.5],
]){const forged=structuredClone(raw);mutate(forged.expression);assert.throws(()=>gpu.validateMeshMaterialIR(forged),error=>error.code==='IR',name);assert.equal(JSON.stringify(accepted),acceptedSnapshot);refusals.push({name,code:'IR',acceptedIRRetained:true});}
let getterCalls=0;const getter={...raw};Object.defineProperty(getter,'source',{enumerable:true,get(){getterCalls++;return raw.source;}});assert.throws(()=>gpu.validateMeshMaterialIR(getter),error=>error.code==='INPUT');assert.equal(getterCalls,0);assert.equal(JSON.stringify(accepted),acceptedSnapshot);refusals.push({name:'IR-source-accessor',code:'INPUT',getterCalls,acceptedIRRetained:true});
assert.equal(accepted.source,fixtures[0].source);assert(Object.isFrozen(accepted));
const result={schema:'barocss-gpu-material-literal-division-flow',version:0,ok:true,provider,cases,refusals,files,acceptedSource:accepted.source,acceptedIRSHA256:sha(acceptedSnapshot),getterCalls,limits:{sourceBytes:65536,tokens:4096,uniforms:16,locals:16,chargedWork:256,depth:16,denominatorAbs:1000,reciprocalAbs:1000,intermediateAbs:1e6,IRVersion:0,profile:accepted.profile},support:'Public CPU compiler/IR reconstruction/trusted lowering/file acceptance only. Positive/+ reciprocal expressions exactly match old multiplication IR/lowering; negative signed factors are semantic numeric equivalents with disclosed canonical float vs old unary-node shape. No internal binding, DOM, WebGL, clock, performance, renderer/Viewer adoption or publication claim.'};
await writeFile(resolve(output,'actual-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({ok:true,cases:cases.length,refusals:refusals.length,getterCalls,compiledSHA256:provider.compiled.sha256}));
