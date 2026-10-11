// One selected public CPU language flow. No renderer, GL or bounds bridge.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleGeneratedScene } from './build-generated-scene.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePin = '4dcb0ebb67ac25f94a9f9e0b84d921f54ab468e8';
const evidencePath = resolve(app, 'evidence/generated-scene-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/generated-scene.json'), 'utf8'));
const previous = await readFile(evidencePath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const failures = previous?.failedCandidates ?? [];
// Complete independent plain Source2 input, authored from the frozen constants.
// No field or shader is copied from the generated compiler result.
const controlSource = [
  '@scene generated_plate {',
  '  version:2; background:#102030;',
  '  box #plate; sphere #studs_0; sphere #studs_1; sphere #marker_0;',
  '}',
  'box { color:#294560; size:6 .5 3; translate:0 -.6 0; }',
  `sphere { color:#42C8D5; radius:${String(3 * .15)}; translate:0 0 0; }`,
  '#studs_0 { translate:-2 0 0; }',
  '#studs_1 { translate:2 0 0; }',
  '#marker_0 { color:#F6C453; translate:0 1.5 0; }',
].join('\r\n') + '\r\n';

const consumerText = `
import assert from 'node:assert/strict';
import { compileGeneratedAffineSceneSource, compileAffineSceneSource, SceneParameterSourceError, SceneError } from '@barocss/gpu';
const source=${JSON.stringify(preset.source)};
const controlSource=${JSON.stringify(controlSource)};
const ledger={generatedCompilerCalls:0,plainAffineControlCalls:0};
const stages=[];let accepted=null;
function generated(text){ledger.generatedCompilerCalls++;return compileGeneratedAffineSceneSource(text);}
function ids(value){return value.scene.objects.map(object=>object.id);}
function frozen(value){if(value===null||typeof value!=='object')return;assert.equal(Object.isFrozen(value),true);for(const item of Object.values(value))frozen(item);}
function fresh(first,second){if(first===null||typeof first!=='object')return;assert.notStrictEqual(first,second);for(const key of Object.keys(first))fresh(first[key],second[key]);}
function parameter(value,name){const item=value.ast.declarations.find(item=>item.kind==='parameter'&&item.name.text===name);assert.ok(item);return item;}
function repeat(value){const item=value.ast.declarations.find(item=>item.kind==='repeat'&&item.prefix.text==='studs');assert.ok(item);return item;}
function token(text,item){assert.equal(text.slice(item.range.start,item.range.end),item.text);}
function spans(value){
 assert.equal(value.source,value.ast.source);assert.equal(value.ast.range.end,value.source.length);
 for(const item of value.ast.declarations){
  for(const key of ['name','quantity','literal','prefix','type','count','left','operator','right','id'])if(item[key])token(value.source,item[key]);
  if(item.field){token(value.source,item.field.property);item.field.literals.forEach(t=>token(value.source,t));}
  if(item.tokens)item.tokens.forEach(t=>token(value.source,t));
 }
 for(const rule of value.ast.rules){token(value.source,rule.selector);for(const field of rule.declarations){token(value.source,field.property);field.literals.forEach(t=>token(value.source,t));}}
 for(const item of value.parameters){assert.ok(item.definition.start>=0&&item.definition.end<=value.source.length);for(const use of item.uses)assert.ok(use.start>=0&&use.end<=value.source.length);}
}
function edit(text,edits){
 let value=text;const ordered=[...edits].sort((a,b)=>b.start-a.start);
 for(const item of ordered){assert.equal(text.slice(item.start,item.end),item.old);value=value.slice(0,item.start)+item.text+value.slice(item.end);}
 assert.ok(value.startsWith('/* 설계 π 😀:'));assert.equal((value.match(/\\r\\n/g)||[]).length,(text.match(/\\r\\n/g)||[]).length);
 return value;
}
function replaceToken(text,item,next){return edit(text,[{start:item.range.start,end:item.range.end,old:item.text,text:next}]);}
function values(value,used){
 assert.deepEqual(value.parameters.map(p=>[p.name,p.quantity,p.unit,p.value]),[
  ['used','length','scene',used],['limit','length','scene',3],['gain','scalar','dimensionless',.15]]);
 for(const object of value.scene.objects){assert.deepEqual(object.rotateDegrees,[0,0,0]);assert.deepEqual(object.scaleXYZ,[1,1,1]);}
 const plate=value.scene.objects.find(o=>o.id==='plate');assert.equal(plate.type,'box');assert.deepEqual(plate.size,[6,.5,3]);assert.deepEqual(plate.translate,[0,-.6,0]);assert.deepEqual(plate.color,[0x29/255,0x45/255,0x60/255]);
 for(const sphere of value.scene.objects.filter(o=>o.type==='sphere'))assert.equal(sphere.radius,3*.15);
}
function stage(name,text){const value=generated(text);frozen(value);spans(value);accepted=value;stages.push({name,source:text,result:value});return value;}
function refusal(name,text,code){
 const before=structuredClone(accepted),reference=accepted;let error;
 try{const candidate=generated(text);accepted=candidate;}catch(e){error=e;}
 assert.ok(error instanceof SceneParameterSourceError);assert.equal(error.code,code);
 assert.strictEqual(accepted,reference);assert.deepEqual(accepted,before);
 if(code==='SCENE'){assert.ok(error.cause instanceof SceneError);assert.ok(error.cause.diagnostics.length);}
 return{name,source:text,code:error.code,nameOfError:error.name,message:error.message,diagnostics:error.diagnostics,
  cause:error.cause?{name:error.cause.name,message:error.cause.message,diagnostics:error.cause.diagnostics}:null,
  acceptedReferenceAndCompleteValuesRetained:true};
}
export function run(){
 try{
  const initial=stage('initial',source);
  assert.equal(initial.format,'barocss-gpu-generated-affine-scene-source');assert.equal(initial.version,0);assert.equal(initial.profile,'source2-typed-mixed-generation-v0');
  assert.equal(initial.ast.schema,'barocss-gpu-generated-affine-scene-ast');assert.equal(initial.ast.sourceVersion,2);assert.equal(initial.scene.version,2);
  assert.equal(initial.source,source);assert.ok(source.includes('😀')&&source.includes('-0'));values(initial,2);
  assert.deepEqual(ids(initial),['plate','studs_0','studs_1','marker_0']);
  assert.deepEqual(initial.generation.map(p=>[p.nodeId,p.prefix,p.index]),[['studs_0','studs',0],['studs_1','studs',1]]);
  assert.deepEqual(initial.decisions.map(p=>[p.nodeId,p.prefix,p.included]),[['marker_0','marker',true]]);
  assert.deepEqual(initial.scene.objects.find(o=>o.id==='studs_0').translate,[-2,0,0]);
  assert.deepEqual(initial.scene.objects.find(o=>o.id==='studs_1').translate,[2,0,0]);
  assert.deepEqual(initial.scene.objects.find(o=>o.id==='marker_0').translate,[0,1.5,0]);
  assert.deepEqual(initial.scene.objects.find(o=>o.id==='marker_0').color,[0xF6/255,0xC4/255,0x53/255]);
  for(const sphere of initial.scene.objects.filter(o=>o.type==='sphere'&&o.id.startsWith('studs')))assert.deepEqual(sphere.color,[0x42/255,0xC8/255,0xD5/255]);
  const pristine=structuredClone(initial),again=generated(source);assert.deepEqual(again,initial);fresh(initial,again);frozen(again);
  const clone=structuredClone(initial);clone.scene.objects[0].translate[0]=777;clone.ast.rules[0].selector.text='caller_edit';assert.deepEqual(initial,pristine);
  assert.throws(()=>{initial.scene.objects[0].scaleXYZ[0]=999;},TypeError);assert.deepEqual(initial,pristine);
  ledger.plainAffineControlCalls++;const control=compileAffineSceneSource(controlSource);
  assert.deepEqual(initial.scene,control.scene);assert.deepEqual(initial.shaders,control.shaders);assert.notEqual(controlSource,source);
  const used=parameter(initial,'used');assert.equal(used.literal.text,'2scene');
  const excludedSource=replaceToken(source,used.literal,'3scene');
  const excluded=stage('equal-limit-excludes-marker',excludedSource);values(excluded,3);
  assert.deepEqual(ids(excluded),['plate','studs_0','studs_1']);assert.equal(excluded.decisions[0].included,false);
  assert.deepEqual(excluded.ast.rules,initial.ast.rules);assert.deepEqual(excluded.generation,initial.generation);
  assert.ok(excluded.ast.declarations.some(d=>d.kind==='conditional'&&d.prefix.text==='marker'));
  assert.ok(excluded.ast.rules.some(rule=>rule.selector.text==='#marker_0'));
  const restoredSource=replaceToken(excludedSource,parameter(excluded,'used').literal,'2scene');
  assert.equal(restoredSource,source);const restored=stage('restore-marker',restoredSource);assert.deepEqual(restored,initial);fresh(initial,restored);
  const count=repeat(restored).count;assert.equal(count.text,'2');
  const expandedSource=replaceToken(restoredSource,count,'3');
  const expanded=stage('three-studs',expandedSource);values(expanded,2);
  assert.deepEqual(ids(expanded),['plate','studs_0','studs_1','studs_2','marker_0']);
  assert.deepEqual(expanded.generation.map(p=>[p.nodeId,p.index]),[['studs_0',0],['studs_1',1],['studs_2',2]]);
  assert.deepEqual(expanded.scene.objects.find(o=>o.id==='studs_2').translate,[0,0,0]);assert.equal(expanded.decisions[0].included,true);
  const typed=parameter(initial,'used');
  const badType=edit(source,[{start:typed.quantity.range.start,end:typed.quantity.range.end,old:'length',text:'scalar'},{start:typed.literal.range.start,end:typed.literal.range.end,old:'2scene',text:'2'}]);
  const badCount=replaceToken(expandedSource,repeat(expanded).count,'33');
  const marker=excluded.ast.rules.find(rule=>rule.selector.text==='#marker_0');assert.ok(marker);
  const close=marker.range.end-1;assert.equal(excludedSource[close],'}');
  const badFalseShape=edit(excludedSource,[{start:close,end:close,old:'',text:'  radius:-1; '}]);
  const refusals=[refusal('mismatched-predicate-quantities',badType,'TYPE'),refusal('repeat-count33',badCount,'RANGE'),refusal('negative-radius-in-false-marker',badFalseShape,'SCENE')];
  assert.deepEqual(initial,pristine);assert.deepEqual(accepted,expanded);
  return{source,initial,stages,control:{source:controlSource,result:control,completeSceneAndShadersEqual:true,independentInput:true},
   edits:{usedLiteral:used.literal.range,repeatCount:count.range,excludedMarkerRule:marker.range,unicodeUTF16RangesVerified:true,wholeTextAndCRLFPreserved:true},
   ownership:{completeDeepFreeze:true,freshIndependentCompiles:true,callerCloneMutationIsolated:true,authoredMinusZeroTextRetained:true,semanticZerosCanonicalized:true},
   publicCallLedger:{...ledger,scope:'Explicit consumer public entry invocations only',privateLowererCalls:'uninstrumented; no native work counter claim'},
   refusals,acceptedResult:accepted,actualBrowser:false,actualGL:false,publicBoundsBridgeUsed:false,
   qualification:'Selected public mixed-generation CPU compilation and independent complete plain Source2 control. No rendering, bounds admission for generated source, physical/native codec or global shader acceptance.'};
 }catch(error){error.consumerProgress={publicCallLedger:{...ledger},stages,acceptedResult:accepted};throw error;}
}
`;

// Maintainer evidence encoding preserves finite Number values and numeric -0.
// This is not a package source or result codec.
function finiteJSON(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Nonfinite evidence number');
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(finiteJSON).join(',') + ']';
  return '{' + Object.entries(value).filter(([, item]) => item !== undefined)
    .map(([key, item]) => JSON.stringify(key) + ':' + finiteJSON(item)).join(',') + '}';
}
let provenance;
try {
  const bundled = await bundleGeneratedScene(app, 'node', consumerText, 'generated-scene');
  provenance = bundled.provenance;
  if (provenance.sourcePin !== sourcePin || provenance.verifiedBlobs !== 294 || provenance.ownDistInputs !== 0) {
    throw new Error('Unexpected generated Scene provider closure');
  }
  const consumer = await import('data:text/javascript;base64,' + Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const receipt = consumer.run();
  const output = { status: 'passed', nodeVersion: process.version, provenance,
    failedCandidates: failures, ...receipt };
  await mkdir(dirname(evidencePath), { recursive: true });
  const bytes = Buffer.from(finiteJSON(output) + '\n');
  await writeFile(evidencePath, bytes);
  const physicalBytes = await readFile(evidencePath);
  if (!physicalBytes.equals(bytes)) throw new Error('Physical evidence bytes differ after write/read');
  console.log(JSON.stringify({ status: output.status, provenance, ids: receipt.acceptedResult.scene.objects.map(o => o.id),
    radius: receipt.initial.scene.objects.find(o => o.type === 'sphere').radius,
    publicCallLedger: receipt.publicCallLedger, refusals: receipt.refusals.map(r => r.code),
    evidenceArtifact: { bytes: physicalBytes.length, sha256: createHash('sha256').update(physicalBytes).digest('hex'),
      physicalWriteReadEqual: true, nativeCodec: false }, actualGL: false }));
} catch (error) {
  await mkdir(dirname(evidencePath), { recursive: true });
  const failed = { name: error.name, code: error.code, message: error.message,
    stack: error.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '[bundled consumer]'),
    diagnostics: error.diagnostics, cause: error.cause ? { name: error.cause.name, message: error.cause.message } : null,
    consumerProgress: error.consumerProgress };
  await writeFile(evidencePath, finiteJSON({ status: 'failed', nodeVersion: process.version, provenance,
    source: preset.source, controlSource, failedCandidates: [...failures, failed] }) + '\n');
  throw error;
}
