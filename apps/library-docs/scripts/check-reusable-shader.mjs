import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleReusableShader } from './build-reusable-shader.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(app, 'evidence/reusable-shader-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/reusable-shader.json'), 'utf8'));
const previous = await readFile(evidence, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const scene = {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'advanced_uv_scene',
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0, 0, 0],
  camera: { eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: 0.1, far: 10 },
  geometries: [{ format: 'barocss-gpu-triangle-geometry', version: 0, id: 'advanced_uv_quad',
    coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', winding: 'ccw',
    positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1], indices: [0, 1, 2, 0, 2, 3] }],
  materials: [{ id: 'advanced_uv_material', type: 'unlit', colorSpace: 'linear', color: [1, 1, 1] }],
  nodes: [{ id: 'advanced_uv_node', type: 'mesh', parentId: null, translation: [0, 0, 0],
    rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1], visible: true,
    geometryId: 'advanced_uv_quad', materialId: 'advanced_uv_material' }],
};
const consumerText = `
import assert from 'node:assert/strict';
import { compileEngineUVRepeatingMaterial, validateEngineUVRepeatingMaterialIR,
 lowerEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings,
 evaluateAuthoredMaterial, AuthoredMaterialEvaluationError, MeshMaterialError } from '@barocss/gpu';
const source=${JSON.stringify(preset.source)}, scene=${JSON.stringify(scene)};
const compiled=compileEngineUVRepeatingMaterial(source);
assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
const material=validateEngineUVRepeatingMaterialIR(compiled.material);
assert.deepEqual(material,compiled.material);assert.notStrictEqual(material,compiled.material);
assert.equal(material.source,source);assert.equal(material.profile,'engine-opaque-uv-repeating-fragment-v0');
assert.equal(material.shaderId,'function_palette');
const declared=${JSON.stringify(preset.controls.map(({ name, min, max, default: value }) => ({ name, type: 'float', min, max, default: value })))};
assert.deepEqual(material.uniforms,declared);
const frozen=value=>{if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(frozen);}};
frozen(material);
const lowered=lowerEngineUVRepeatingMaterial(material);frozen(lowered);
assert.equal(lowered.inputDeclarations,'in vec2 v_engine_uv;');
assert.deepEqual(lowered.uniformLayout,declared.map((u,i)=>({...u,glslName:'mat_u_'+i})));
assert.ok(!lowered.expression.includes('pow('));assert.ok(!lowered.expression.includes('ease('));assert.ok(!lowered.expression.includes('palette('));
let nodes=0,depth=0;
function inspect(node,d=1){nodes++;depth=Math.max(depth,d);if(node.kind==='call')node.args.forEach(c=>inspect(c,d+1));if(node.kind==='binary'){inspect(node.left,d+1);inspect(node.right,d+1);}if(node.kind==='unary')inspect(node.value,d+1);}
inspect(material.expression);assert.ok(nodes<=128);assert.ok(depth<=16);assert.equal(Object.hasOwn(material,'functions'),false);
const companion={format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,sceneId:scene.id,bindings:[{materialId:'advanced_uv_material',material,uniforms:{}}]};
const beforeScene=structuredClone(scene),beforeCompanion=structuredClone(companion);
const prepared=prepareEngineUVRepeatingMaterialBindings(scene,companion);
assert.deepEqual(prepared.scene.scene,scene);assert.notStrictEqual(prepared.scene.scene,scene);
assert.deepEqual(scene,beforeScene);assert.deepEqual(companion,beforeCompanion);
assert.equal(prepared.scene.draws.length,1);assert.equal(prepared.scene.geometries[0].vertexCount,4);assert.equal(prepared.scene.geometries[0].triangleCount,2);
assert.deepEqual(prepared.scene.scene.geometries[0].uvs,[0,0,1,0,1,1,0,1]);
assert.deepEqual(prepared.loweredBindings[0].lowered,lowered);
frozen(prepared.materialBindings);frozen(prepared.resolvedBindings);frozen(prepared.loweredBindings);
const defaults=Object.fromEntries(declared.map(u=>[u.name,u.default]));
assert.deepEqual(prepared.resolvedBindings[0].binding.uniforms,defaults);
const palette=[[18,42,74],[246,196,83]].map(c=>c.map(b=>Math.pow(b/255,2.2)));
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
function reference(uv,overrides){const {frequency,tilt,phase,strength}={...defaults,...overrides},[u,v]=uv.map(x=>x-Math.floor(x));const wave=Math.sin((u+v*tilt)*frequency*2*Math.PI+phase)*.5+.5,eased=wave*wave,ratio=eased*strength;return{wave,eased,ratio,linearRGB:mix(palette[0],palette[1],ratio)};}
const witnesses=[{name:'origin_defaults',uv:[0,0],uniforms:{}},{name:'gold_peak',uv:[1/12,0],uniforms:{}},{name:'navy_phase',uv:[0,0],uniforms:{phase:3*Math.PI/2}}];
const immutableSamples=[];
const samples=witnesses.map(w=>{const request={material,uv:[...w.uv],uniforms:{...w.uniforms}},before=structuredClone(request);const sample=evaluateAuthoredMaterial(request),expected=reference(w.uv,w.uniforms);sample.linearRGB.forEach((x,i)=>assert.ok(Math.abs(x-expected.linearRGB[i])<=1e-12));assert.deepEqual(request,before);assert.notStrictEqual(sample.material,material);assert.notStrictEqual(sample.uv,request.uv);assert.notStrictEqual(sample.uniforms,request.uniforms);assert.notStrictEqual(sample.material.uniforms,material.uniforms);frozen(sample);const snapshot=structuredClone(sample);request.uv[0]=99;request.uniforms.strength=0;assert.deepEqual(sample,snapshot);immutableSamples.push(sample);return{...w,reference:expected,sample:{format:sample.format,version:sample.version,profile:sample.profile,colorSpace:sample.colorSpace,uvUnit:sample.uvUnit,uniforms:sample.uniforms,uv:sample.uv,linearRGB:sample.linearRGB}};});
let accepted=immutableSamples[0];const prior=accepted,beforeAccepted=structuredClone(accepted);
let error;try{accepted=evaluateAuthoredMaterial({material,uv:[0,0],uniforms:{strength:2}});}catch(e){error=e;}
assert.ok(error instanceof AuthoredMaterialEvaluationError);assert.equal(error.code,'UNIFORM');assert.ok(error.cause instanceof MeshMaterialError);assert.equal(error.cause.code,'UNIFORM');assert.strictEqual(accepted,prior);assert.deepEqual(accepted,beforeAccepted);
const badRangeSource=source.replace('palette(ease(wave)*strength)','palette(2)'),badRange=compileEngineUVRepeatingMaterial(badRangeSource);
assert.equal(badRange.ok,false);assert.equal(badRange.diagnostics[0].code,'RANGE');assert.deepEqual(accepted,beforeAccepted);
const captureSource=source.replace('pow(t,2)','pow(t+phase,2)'),capture=compileEngineUVRepeatingMaterial(captureSource);
assert.equal(capture.ok,false);assert.equal(capture.diagnostics[0].code,'TYPE');assert.deepEqual(accepted,beforeAccepted);
export const receipt={source,materialProfile:material.profile,shaderId:material.shaderId,declaredUniforms:declared,canonicalExpression:{nodes,depth,scope:'Public final expanded IR; compiler also charges definitions/reuse'},lowered,completeScene:scene,completeCompanion:companion,admittedQuad:{vertices:4,triangles:2,draws:1,originalUVs:scene.geometries[0].uvs},resolvedUniforms:defaults,samples,refusals:[{stage:'compile',candidate:'palette(2)',source:badRangeSource,diagnostic:badRange.diagnostics[0]},{stage:'compile',candidate:'function captures phase',source:captureSource,diagnostic:capture.diagnostics[0]},{stage:'evaluate',uniforms:{strength:2},code:error.code,causeName:error.cause.name,causeCode:error.cause.code,message:error.message}],acceptedImmutableReferenceAndValueRetained:true,callerInputsUnchanged:true,freshFrozenPublicCopies:true,actualGL:false,pixelParity:'not checked',scope:'One selected public compile/reconstruction/lowering/full-quad binding/three analytic binary64 RGB evaluations and genuine argument-range/pure-body-capture/uniform refusals; no renderer or provider suite'};
`;
let provenance;
const failures = previous?.failedCandidates ?? [];
try {
  const bundled = await bundleReusableShader(app, 'node', consumerText, 'reusable-shader');
  provenance = bundled.provenance;
  if (provenance.sourcePin !== preset.sourceProfile || provenance.ownDistInputs !== 0) throw Error('Unexpected reusable source profile');
  const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(bundled.result.outputFiles[0].text).toString('base64'));
  await writeFile(evidence, JSON.stringify({ status: 'passed', nodeVersion: process.version,
    sourceSHA256: createHash('sha256').update(preset.source).digest('hex'), provenance, failedCandidates: failures, ...receipt }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'passed', nodes: receipt.canonicalExpression.nodes, depth: receipt.canonicalExpression.depth,
    samples: receipt.samples.map(sample => ({ name: sample.name, linearRGB: sample.sample.linearRGB })), provenance }));
} catch (error) {
  const failure = { source: preset.source, sourceSHA256: createHash('sha256').update(preset.source).digest('hex'),
    nodeVersion: process.version, name: error.name, message: error.message, stack: error.stack };
  await writeFile(evidence, JSON.stringify({ status: 'failed', provenance, failedCandidates: [...failures, failure], actualGL: false }, null, 2) + '\n');
  throw error;
}
