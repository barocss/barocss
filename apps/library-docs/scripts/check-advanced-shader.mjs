import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleAdvancedShader } from './build-advanced-shader.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/advanced-shader.json'), 'utf8'));
if (preset.sourceProfile !== '7e96b959746a3fee957644fd1b5ccaf79c992c6c' || typeof preset.source !== 'string') throw Error('Unexpected advanced shader input profile');
// Complete consumer geometry. This is the same quad used by the browser host.
const scene = {
  format: 'barocss-gpu-engine-scene', version: 0, id: 'advanced_uv_scene',
  coordinateSystem: 'right-handed-y-up', positionUnit: 'scene', background: [0,0,0],
  camera: { eye:[0,0,3], target:[0,0,0], up:[0,1,0], fovYDegrees:45, near:.1, far:10 },
  geometries: [{ format:'barocss-gpu-triangle-geometry', version:0, id:'advanced_uv_quad', coordinateSystem:'right-handed-y-up', positionUnit:'scene', winding:'ccw', positions:[-1,-1,0,1,-1,0,1,1,0,-1,1,0], normals:[0,0,1,0,0,1,0,0,1,0,0,1], uvs:[0,0,1,0,1,1,0,1], indices:[0,1,2,0,2,3] }],
  materials: [{ id:'advanced_uv_material', type:'unlit', colorSpace:'linear', color:[1,1,1] }],
  nodes: [{ id:'advanced_uv_node', type:'mesh', parentId:null, translation:[0,0,0], rotationXYZW:[0,0,0,1], scale:[1,1,1], visible:true, geometryId:'advanced_uv_quad', materialId:'advanced_uv_material' }],
};
const consumerText = `
import assert from 'node:assert/strict';
import { compileEngineUVRepeatingMaterial, validateEngineUVRepeatingMaterialIR, lowerEngineUVRepeatingMaterial, prepareEngineUVRepeatingMaterialBindings, evaluateAuthoredMaterial, AuthoredMaterialEvaluationError, MeshMaterialError } from '@barocss/gpu';
const source = ${JSON.stringify(preset.source)};
const scene = ${JSON.stringify(scene)};
const originalScene = structuredClone(scene);
const deepFrozen = value => {
  if(value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value),'Expected deeply frozen public value');
    Object.values(value).forEach(deepFrozen);
  }
};
const nearRGB = (actual,expected) => {
  assert.equal(actual.length,3);
  actual.forEach((value,index) => assert.ok(Number.isFinite(value) && Math.abs(value-expected[index]) <= 1e-12,'Independent linear RGB reference channel '+index+': '+value));
};
const compiled = compileEngineUVRepeatingMaterial(source);
assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
assert.equal(compiled.material.format,'barocss-gpu-engine-uv-repeating-material');
assert.equal(compiled.material.profile,'engine-opaque-uv-repeating-fragment-v0');
assert.equal(compiled.material.version,0);
assert.equal(compiled.material.shaderId,'warped_plasma');
assert.equal(compiled.material.source,source);
const declared = [
  {name:'scale',type:'float',min:2,max:12,default:6},
  {name:'warp',type:'float',min:0,max:3,default:1.5},
  {name:'phase',type:'float',min:0,max:6.283185307179586,default:0},
  {name:'glow',type:'float',min:0,max:1,default:.65},
];
assert.deepEqual(compiled.material.uniforms,declared);
deepFrozen(compiled.material);
const originalMaterial = structuredClone(compiled.material);
const reconstructed = validateEngineUVRepeatingMaterialIR(compiled.material);
assert.deepEqual(reconstructed,compiled.material);
assert.notStrictEqual(reconstructed,compiled.material);
assert.notStrictEqual(reconstructed.expression,compiled.material.expression);
deepFrozen(reconstructed);
const lowered = lowerEngineUVRepeatingMaterial(reconstructed);
assert.equal(lowered.inputDeclarations,'in vec2 v_engine_uv;');
assert.deepEqual(lowered.uniformLayout,declared.map((uniform,index) => ({...uniform,glslName:'mat_u_'+index})));
assert.equal(lowered.uniformDeclarations,'uniform float mat_u_0;\\nuniform float mat_u_1;\\nuniform float mat_u_2;\\nuniform float mat_u_3;');
assert.ok(lowered.expression.includes('v_engine_uv.x') && lowered.expression.includes('v_engine_uv.y'));
assert.ok(lowered.expression.includes('fract(') && lowered.expression.includes('sin(') && lowered.expression.includes('cos('));
assert.ok(!lowered.expression.includes('pow(') && !lowered.expression.includes('sparks') && !lowered.expression.includes('@let'));
deepFrozen(lowered);
// Count public canonical expression occurrences, including reused subtrees.
// This is not the parser's private definition/expansion accounting counter.
let canonicalNodes=0,canonicalDepth=0;
const callNames = new Set(), inputNames = new Set();
function inspect(node,depth=1){
  canonicalNodes++; canonicalDepth=Math.max(canonicalDepth,depth);
  if(node.kind==='call'){callNames.add(node.name);node.args.forEach(child=>inspect(child,depth+1));}
  if(node.kind==='binary'){inspect(node.left,depth+1);inspect(node.right,depth+1);}
  if(node.kind==='unary')inspect(node.value,depth+1);
  if(node.kind==='input')inputNames.add(node.name);
}
inspect(reconstructed.expression);
assert.ok(canonicalNodes<=256); assert.ok(canonicalDepth<=16);
assert.deepEqual([...inputNames].sort(),['uv_u','uv_v']);
assert.ok(['fract','sin','cos','mix','clamp'].every(name=>callNames.has(name)));
const companion = {format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,sceneId:'advanced_uv_scene',bindings:[{materialId:'advanced_uv_material',material:reconstructed,uniforms:{}}]};
const originalCompanion = structuredClone(companion);
const prepared = prepareEngineUVRepeatingMaterialBindings(scene,companion);
assert.deepEqual(prepared.scene.scene,scene);
assert.notStrictEqual(prepared.scene.scene,scene);
assert.equal(prepared.scene.draws.length,1);
assert.equal(prepared.scene.draws[0].id,'advanced_uv_node');
assert.equal(prepared.scene.geometries.length,1);
assert.equal(prepared.scene.geometries[0].vertexCount,4);
assert.equal(prepared.scene.geometries[0].triangleCount,2);
assert.deepEqual(prepared.scene.scene.geometries[0].uvs,[0,0,1,0,1,1,0,1]);
assert.deepEqual(prepared.materialBindings,companion);
assert.notStrictEqual(prepared.materialBindings,companion);
assert.notStrictEqual(prepared.materialBindings.bindings[0].material,reconstructed);
assert.deepEqual(prepared.resolvedBindings[0].binding.uniforms,{scale:6,warp:1.5,phase:0,glow:.65});
assert.deepEqual(prepared.loweredBindings[0].lowered,lowered);
assert.equal(prepared.materialBindings.bindings[0].material.source,source);
deepFrozen(prepared.materialBindings);
deepFrozen(prepared.resolvedBindings);
deepFrozen(prepared.loweredBindings);
// Analytic references use authored byte palettes and two linear color mixes.
// They do not implement a second shader interpreter or assert pixel parity.
const witnesses = [
  {label:'origin_defaults',uv:[0,0],uniforms:{},expected:[0.6096973954577036,0.08528053627791318,0.1797623672494805],basis:{plasma:.75,sparks:.08125}},
  {label:'quiet_diagonal',uv:[.25,.5],uniforms:{},expected:[0.5751808385934188,0.015429232882438406,0.13796712509915787],basis:{plasma:.75,sparks:0}},
  {label:'origin_phase_pi',uv:[0,0],uniforms:{phase:Math.PI},expected:[0.25770079038888927,0.077032723568125,0.114582730358885],basis:{plasma:.25,sparks:.08125}},
];
const samples=witnesses.map(witness=>{
  const request={material:reconstructed,uniforms:witness.uniforms,uv:witness.uv};
  const originalRequest=structuredClone(request);
  const sample=evaluateAuthoredMaterial(request);
  nearRGB(sample.linearRGB,witness.expected);
  assert.equal(sample.profile,'binary64-linear-rgb-v0');assert.equal(sample.colorSpace,'linear-rgb');assert.equal(sample.uvUnit,'dimensionless');
  assert.equal(sample.source,source);assert.deepEqual(sample.material,reconstructed);assert.notStrictEqual(sample.material,reconstructed);
  assert.deepEqual(sample.uv,witness.uv);assert.notStrictEqual(sample.uv,witness.uv);
  assert.deepEqual(sample.uniforms,{scale:6,warp:1.5,phase:witness.uniforms.phase??0,glow:.65});
  assert.deepEqual(request,originalRequest);deepFrozen(sample);
  return {label:witness.label,request:originalRequest,analyticBasis:witness.basis,expectedLinearRGB:witness.expected,sample};
});
const accepted=samples[0].sample,acceptedSnapshot=structuredClone(accepted);
const badSource=source.replace('sin(','unknown(');
assert.notEqual(badSource,source);
const refusedSource=compileEngineUVRepeatingMaterial(badSource);
assert.equal(refusedSource.ok,false);assert.equal(refusedSource.diagnostics[0].code,'SYNTAX');
assert.equal(refusedSource.diagnostics[0].start,badSource.indexOf('unknown'));
assert.equal(refusedSource.diagnostics[0].end,badSource.indexOf('unknown')+7);
let uniformError;
try{evaluateAuthoredMaterial({material:reconstructed,uniforms:{glow:2},uv:[0,0]});}catch(error){uniformError=error;}
assert.ok(uniformError instanceof AuthoredMaterialEvaluationError);
assert.equal(uniformError.code,'UNIFORM');assert.ok(uniformError.cause instanceof MeshMaterialError);assert.equal(uniformError.cause.code,'UNIFORM');
assert.deepEqual(accepted,acceptedSnapshot);assert.strictEqual(samples[0].sample,accepted);
assert.deepEqual(compiled.material,originalMaterial);assert.deepEqual(scene,originalScene);assert.deepEqual(companion,originalCompanion);
export const receipt = {
  stage:'Selected advanced authored material CPU compile/reconstruct/lower/complete-scene bind/evaluate',
  actualGL:false,shaderExecution:false,pixelParity:'not checked',
  source,sourceUTF8Bytes:new TextEncoder().encode(source).length,
  materialProfile:reconstructed.profile,canonicalExpression:{nodes:canonicalNodes,depth:canonicalDepth,scope:'Expanded public final IR occurrences; private parser definition accounting not measured'},
  declaredUniforms:declared,lowered,
  completeScene:scene,completeCompanion:companion,
  admittedQuad:{vertices:prepared.scene.geometries[0].vertexCount,triangles:prepared.scene.geometries[0].triangleCount,draws:prepared.scene.draws.length,originalUVs:prepared.scene.scene.geometries[0].uvs},
  resolvedUniforms:prepared.resolvedBindings[0].binding.uniforms,
  samples,refusals:[{stage:'compile',diagnostic:refusedSource.diagnostics[0]},{stage:'evaluate',code:uniformError.code,causeName:uniformError.cause.name,causeCode:uniformError.cause.code,message:uniformError.message}],
  acceptedCPUReferenceAndValueRetained:true,sourceAndCallerInputsUnchanged:true,sourceIndependentPublicCopies:true,
  limits:'No renderer, host clock, display conversion, browser retention, old gallery replay, full suite or publication check in this consumer',
};
`;
const evidence = resolve(app, 'evidence/advanced-shader-consumer.json');
let provenance;
try {
  const bundle = await bundleAdvancedShader(app, 'node', consumerText);
  provenance = bundle.provenance;
  if (provenance.sourcePin !== preset.sourceProfile || provenance.ownDistInputs !== 0) throw Error('Unexpected advanced shader provenance');
  const { receipt } = await import('data:text/javascript;base64,' + Buffer.from(bundle.result.outputFiles[0].text).toString('base64'));
  await writeFile(evidence,JSON.stringify({status:'passed',nodeVersion:process.version,sourceSHA256:createHash('sha256').update(preset.source).digest('hex'),provenance,...receipt},null,2)+'\n');
  console.log(JSON.stringify({status:'passed',samples:receipt.samples.length,canonicalNodes:receipt.canonicalExpression.nodes,canonicalDepth:receipt.canonicalExpression.depth,ownSourceInputs:provenance.ownSourceInputs,ownDistInputs:provenance.ownDistInputs,actualGL:false}));
} catch (error) {
  await writeFile(evidence,JSON.stringify({status:'failed',nodeVersion:process.version,provenance,firstFailure:error instanceof Error?{name:error.name,message:error.message,stack:error.stack}:String(error),actualGL:false},null,2)+'\n');
  throw error;
}
