import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleDiscreteMaterial } from './build-discrete-material.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(app, 'evidence/discrete-material-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/discrete-material.json'), 'utf8'));
const previous = await readFile(evidence, 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
const consumerText = `
import assert from 'node:assert/strict';
import {compileDiscreteMeshMaterial,validateDiscreteMeshMaterialIR,lowerDiscreteMeshMaterial,
 evaluateDiscreteAuthoredMaterial,AuthoredMaterialEvaluationError} from '@barocss/gpu';
const source=${JSON.stringify(preset.source)};
const compiled=compileDiscreteMeshMaterial(source);assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
const material=validateDiscreteMeshMaterialIR(compiled.material);
assert.deepEqual(material,compiled.material);assert.notStrictEqual(material,compiled.material);
assert.equal(material.source,source);assert.equal(material.profile,'mesh-opaque-discrete-fragment-v0');
assert.equal(material.shaderId,'threshold_palette');
assert.deepEqual(material.uniforms,[{name:'level',type:'float',min:0,max:1,default:.5}]);
const frozen=v=>{if(v&&typeof v==='object'){assert.ok(Object.isFrozen(v));Object.values(v).forEach(frozen);}};frozen(material);
const lowered=lowerDiscreteMeshMaterial(material);frozen(lowered);
assert.deepEqual(Object.keys(lowered).sort(),['expression','uniformDeclarations','uniformLayout']);
assert.deepEqual(lowered.uniformLayout,[{name:'level',type:'float',min:0,max:1,default:.5,glslName:'mat_u_0'}]);
assert.ok(lowered.expression.includes('?'));assert.ok(!lowered.expression.includes('palette('));
let nodes=0,depth=0;function inspect(n,d=1){nodes++;depth=Math.max(depth,d);if(n.kind==='unary')inspect(n.value,d+1);if(n.kind==='binary'){inspect(n.left,d+1);inspect(n.right,d+1);}if(n.kind==='call')n.args.forEach(v=>inspect(v,d+1));if(n.kind==='select')[n.value,n.threshold,n.below,n.otherwise].forEach(v=>inspect(v,d+1));}inspect(material.expression);assert.ok(nodes<=128);assert.ok(depth<=16);
const endpoints=[[32,48,64],[255,238,221]].map(rgb=>rgb.map(byte=>Math.pow(byte/255,2.2)));
const samples=[.49,.5,.51].map(level=>{const request={material,uniforms:{level}},before=structuredClone(request),sample=evaluateDiscreteAuthoredMaterial(request);const expected=endpoints[level<.5?0:1].map(channel=>channel*(level<.5?.25:.75));sample.linearRGB.forEach((channel,i)=>assert.ok(Math.abs(channel-expected[i])<=1e-12));assert.deepEqual(request,before);frozen(sample);assert.notStrictEqual(sample.material,material);assert.notStrictEqual(sample.uniforms,request.uniforms);const copy=structuredClone(sample);request.uniforms.level=0;assert.deepEqual(sample,copy);return{level,expectedLinearRGB:expected,sample};});
const defaults=evaluateDiscreteAuthoredMaterial({material,uniforms:{}});assert.deepEqual(defaults,samples[1].sample);assert.notStrictEqual(defaults,samples[1].sample);
const rawZeroRequest={material,uniforms:{level:-0}},zeroSample=evaluateDiscreteAuthoredMaterial(rawZeroRequest);assert.ok(Object.is(rawZeroRequest.uniforms.level,-0));assert.ok(Object.is(zeroSample.uniforms.level,0));
let accepted=defaults;const prior=accepted,beforeAccepted=structuredClone(accepted),refusals=[];
for(const [label,candidate,code] of [
 ['mixed branch types',source.replace('#203040,#FFEEDD','1,#FFEEDD'),'TYPE'],
 ['computed threshold',source.replace('select(t,.5,','select(t,.5+.1,'),'SYNTAX']]){
 const refused=compileDiscreteMeshMaterial(candidate);assert.equal(refused.ok,false);assert.equal(refused.diagnostics[0].code,code);assert.strictEqual(accepted,prior);assert.deepEqual(accepted,beforeAccepted);refusals.push({stage:'compile',label,source:candidate,diagnostics:refused.diagnostics});
}
try{accepted=evaluateDiscreteAuthoredMaterial({material,uniforms:{level:2}});assert.fail('Expected UNIFORM refusal');}catch(error){assert.ok(error instanceof AuthoredMaterialEvaluationError);assert.equal(error.code,'UNIFORM');refusals.push({stage:'evaluate',uniforms:{level:2},code:error.code,message:error.message});}
assert.strictEqual(accepted,prior);assert.deepEqual(accepted,beforeAccepted);
const narrowedSource=source.replace('float(0,1,.5)','float(0,.4,.25)'),narrowed=compileDiscreteMeshMaterial(narrowedSource);assert.equal(narrowed.ok,true);
assert.throws(()=>evaluateDiscreteAuthoredMaterial({material:narrowed.material,uniforms:{level:.5}}),error=>error instanceof AuthoredMaterialEvaluationError&&error.code==='UNIFORM');
export const receipt={source,material,lowered,canonicalExpression:{nodes,depth,scope:'Complete final expanded IR; definition/reuse charges are separate'},samples,defaults,zeroEvidence:{request:rawZeroRequest,sample:zeroSample,callerNegativeZeroRetained:true,resolvedUniformPositiveZero:true},refusals,narrowedSourceCurrentLevelRefused:true,acceptedReferenceAndValuesRetained:true,freshFrozenCopies:true,callerInputsUnchanged:true,actualGL:false,scope:'One selected public compile/full-IR reconstruction/lowering/three analytic CPU RGB references/copy isolation/source refusals/uniform refusal; no provider or renderer replay'};
`;
// Preserve genuine Number -0 as JSON -0, not a tagged replacement or authority alias.
function exactJSON(value) {
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw Error('Nonfinite evidence'); return Object.is(value, -0) ? '-0' : String(value); }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(exactJSON).join(',') + ']';
  return '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' + exactJSON(item)).join(',') + '}';
}
let provenance;
const failures = previous?.failedCandidates ?? [];
try {
  const bundled = await bundleDiscreteMaterial(app, 'node', consumerText, 'discrete-material'); provenance = bundled.provenance;
  if (provenance.sourcePin !== preset.sourceProfile || provenance.ownDistInputs !== 0) throw Error('Unexpected discrete source profile');
  const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  const result = { status: 'passed', nodeVersion: process.version, sourceSHA256: createHash('sha256').update(preset.source).digest('hex'), provenance, failedCandidates: failures, ...receipt };
  const text = exactJSON(result) + '\n', reopened = JSON.parse(text);
  if (!Object.is(reopened.zeroEvidence.request.uniforms.level, -0) || !Object.is(reopened.zeroEvidence.sample.uniforms.level, 0)) throw Error('Evidence zero precision lost');
  await writeFile(evidence, text);
  console.log(JSON.stringify({ status: 'passed', nodes: receipt.canonicalExpression.nodes, depth: receipt.canonicalExpression.depth, samples: receipt.samples.map(({ level, sample }) => ({ level, linearRGB: sample.linearRGB })), provenance, negativeZeroArtifactRoundtrip: true }));
} catch (error) {
  const failure = { source: preset.source, nodeVersion: process.version, name: error.name, message: error.message, stack: error.stack };
  await writeFile(evidence, exactJSON({ status: 'failed', provenance: provenance ?? null, failedCandidates: [...failures, failure], actualGL: false }) + '\n');
  throw error;
}
