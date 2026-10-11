import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleCadQuantityFunctions } from './build-cad-quantity-functions.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preset = JSON.parse(await readFile(resolve(app,'scripts/snippets/cad-quantity-functions.json'),'utf8'));
const evidence = resolve(app,'evidence/cad-quantity-functions-consumer.json');
const previous = await readFile(evidence,'utf8').then(JSON.parse).catch(error=>{
  if(error.code==='ENOENT') return null;
  throw error;
});
const failures = previous?.failedCandidates ?? [];
const currentFile = resolve(app,'docs/.vitepress/cache/cad-quantity-functions',preset.sourceProfile,'consumers/current.cad.css');
const consumerText = `
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compileCadModel, surfaceDomain, evaluateSurface, tessellateSurface } from '@barocss/cad';
const source=${JSON.stringify(preset.source)},path=${JSON.stringify(currentFile)};
const ids=['untouched_curve','profile','wall','untouched_surface'];
function ranges(text,value){if(!value||typeof value!=='object')return;if(Object.hasOwn(value,'start')&&Object.hasOwn(value,'endColumn')){assert.ok(value.start>=0&&value.end>=value.start&&value.end<=text.length);const position=offset=>{const prefix=text.slice(0,offset);return [prefix.split('\\n').length,offset-prefix.lastIndexOf('\\n')];};assert.deepEqual(position(value.start),[value.line,value.column]);assert.deepEqual(position(value.end),[value.endLine,value.endColumn]);}else Object.values(value).forEach(v=>ranges(text,v));}
function compile(text,width,factor){
 const options={sourceVersion:3},beforeOptions=structuredClone(options),compiled=compileCadModel(text,options);
 assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));assert.deepEqual(options,beforeOptions);
 assert.equal(compiled.model.version,0);assert.equal(compiled.ir.schemaVersion,3);assert.equal(compiled.ir.sourceVersion,3);
 assert.deepEqual(compiled.model.objects.map(o=>o.id),ids);assert.equal(compiled.constructions.length,1);
 const height=width*factor/2,depth=width/4;
 assert.deepEqual(compiled.ir.parameters.map(p=>[p.id,p.quantityKind,p.value,p.unit]),[['width','length',width,'mm'],['height','length',height,'mm'],['depth','length',depth,'mm']]);
 assert.equal(compiled.ir.functions.length,2);assert.deepEqual(compiled.ir.functions.map(f=>f.id),['scaleLength','half']);
 assert.equal(compiled.ir.calls.length,4);assert.equal(compiled.ir.calls.reduce((n,c)=>n+c.bindings.length,0),7);
 assert.deepEqual(compiled.ir.calls.map(c=>[c.frameId,c.functionId,c.parentFrameId,c.depth]),[[0,'half',null,1],[1,'scaleLength',0,2],[2,'scaleLength',null,1],[3,'scaleLength',null,1]]);
 assert.deepEqual(compiled.ir.calls.map(c=>c.result.value),[width/2,width/2,height,depth]);
 assert.equal(compiled.ir.work.actual.callEntries,4);assert.equal(compiled.ir.work.actual.defaultAdmissionEvaluations,1);
 assert.equal(compiled.ir.work.actual.defaultRuntimeEvaluations,1);assert.equal(compiled.ir.work.actual.maximumCallDepth,2);
 assert.equal(compiled.ir.work.actual.expressionEvaluations,88);assert.equal(compiled.ir.work.preflight.expressionEvaluations,88);
 ranges(text,compiled.ast);ranges(text,compiled.ir);
 const profile=compiled.model.objects[1],wall=compiled.model.objects[2];
 assert.deepEqual(profile.controlPoints,[[0,0,0],[width,0,0]]);
 assert.deepEqual(wall.controlPoints,[[[0,0,0],[0,depth,height]],[[width,0,0],[width,depth,height]]]);
 assert.ok(Object.is(compiled.model.objects[0].controlPoints[0][0],-0));assert.ok(Object.is(compiled.model.objects[3].controlPoints[0][0][2],-0));
 const domain=surfaceDomain(wall);assert.deepEqual(domain,{u:[0,1],v:[0,1]});
 const midpointMM=evaluateSurface(wall,.5,.5);assert.deepEqual(midpointMM,[width/2,depth/2,height/2]);
 const mesh=tessellateSurface(wall,{countU:17,countV:17,revision:0});
 assert.equal(mesh.report.vertexCount,289);assert.equal(mesh.report.triangleCount,512);assert.equal(mesh.report.certified,false);
 return{source:text,compiled,quantitiesMM:{width,height,depth},domain,midpointMM,meshReport:mesh.report,packetBoundsMM:mesh.packet.bounds};
}
const initial=compile(source,100,2),initialBefore=structuredClone(initial);
const widthSource=source.replace('value: 10 cm;','value: 12 cm;');assert.notEqual(widthSource,source);
const width12=compile(widthSource,120,2);
const editedSource=widthSource.replace('factor: scalar = 2','factor: scalar = 1');assert.notEqual(editedSource,widthSource);
const factor1=compile(editedSource,120,1);
await writeFile(path,editedSource);
const physicalSource=await readFile(path,'utf8');assert.equal(physicalSource,editedSource);
const reopened=compile(physicalSource,120,1);assert.deepEqual(reopened,factor1);assert.notStrictEqual(reopened.compiled,factor1.compiled);
const reeditedSource=physicalSource.replace('value: 12 cm;','value: 8 cm;');
const reedited=compile(reeditedSource,80,1);
const cases=[initial,width12,factor1,reopened,reedited];
cases.forEach(value=>{assert.deepEqual(value.compiled.model.objects[0],initial.compiled.model.objects[0]);assert.deepEqual(value.compiled.model.objects[3],initial.compiled.model.objects[3]);});
assert.deepEqual(initial,initialBefore);
const copied=structuredClone(reopened.compiled);reopened.compiled.model.objects[0].weights[0]=99;
assert.deepEqual(factor1.compiled,copied);reopened.compiled=compiledCopy(copied);
function compiledCopy(value){return structuredClone(value);}
let accepted=reedited.compiled;const prior=accepted,beforeAccepted=structuredClone(accepted);
const badSources=[{name:'length supplied to scalar formal',source:reeditedSource.replace('factor: .25','factor: 1 mm'),code:'FUNCTION_TYPE'},
 {name:'global capture in function body',source:reeditedSource.replace('return: $value * $factor;','return: $width * $factor;'),code:'FUNCTION_CAPTURE'}];
const refusals=badSources.map(candidate=>{const result=compileCadModel(candidate.source,{sourceVersion:3});if(result.ok)accepted=result;
 assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,candidate.code);assert.deepEqual(Object.keys(result).sort(),['diagnostics','ok']);
 assert.strictEqual(accepted,prior);assert.deepEqual(accepted,beforeAccepted);ranges(candidate.source,result.diagnostics);
 return{name:candidate.name,source:candidate.source,diagnostics:result.diagnostics};});
export const receipt={source,cases:cases.map((value,index)=>({name:['initial','width12','factor1','fresh-read','reedit-width8'][index],...value})),refusals,
 rawSave:{sourceVersion:3,source:physicalSource,bytes:new TextEncoder().encode(physicalSource).length,sha256:createHash('sha256').update(physicalSource).digest('hex'),freshWholeCompileEqual:true,applicationOwnedFile:true,publicCadDocumentCodec:false},
 allFourObjectRolesAndOrderRetained:true,twoUnrelatedObjectsBitsUnchanged:true,dependentProfileChangesWithWidth:true,
 acceptedReferenceAndValueRetained:true,independentFreshOutputs:true,callerOptionsUnchanged:true,actualGL:false,
 scope:'One selected public Source3 compile, width/default edits, current raw-source physical Save/fresh explicit-dialect compile/re-edit, native wall domain/evaluation/tessellation and genuine function type/capture refusals. No native provider campaign, renderer, editor Save/Open or public Source3 codec.'};
`;
let provenance;
try {
  const bundled = await bundleCadQuantityFunctions(app,'node',consumerText,'cad-quantity-functions');
  provenance = bundled.provenance;
  assert.equal(provenance.sourcePin,preset.sourceProfile);assert.equal(provenance.ownDistInputs,0);
  const {receipt} = await import('data:text/javascript;base64,'+Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const asset=await readFile(resolve(app,'docs/public/examples/cad-quantity-functions.cad.css'));
  assert.equal(asset.toString('utf8'),preset.source);
  const download={path:'/examples/cad-quantity-functions.cad.css',bytes:asset.length,sha256:createHash('sha256').update(asset).digest('hex'),sourceVersion:3,initialSource:true};
  const output={status:'passed',nodeVersion:process.version,provenance,failedCandidates:failures,...receipt,download};
  await writeFile(evidence,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({status:output.status,download,provenance,cases:receipt.cases.map(c=>({name:c.name,quantitiesMM:c.quantitiesMM,midpointMM:c.midpointMM,work:c.compiled.ir.work.actual})),refusals:receipt.refusals.map(r=>r.diagnostics[0].code)}));
} catch(error) {
  await writeFile(evidence,JSON.stringify({status:'failed',provenance,source:preset.source,failedCandidates:[...failures,{source:preset.source,name:error.name,code:error.code,message:error.message,stack:error.stack}]},null,2)+'\n');
  throw error;
}
