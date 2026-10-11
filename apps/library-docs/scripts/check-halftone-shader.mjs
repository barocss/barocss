import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleAdvancedShader } from './build-advanced-shader.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/halftone-shader.json'), 'utf8'));
const evidence = resolve(app, 'evidence/halftone-shader-consumer.json');
const pin = '7e96b959746a3fee957644fd1b5ccaf79c992c6c';
if (preset.sourceProfile !== pin) throw new Error('Unexpected halftone profile');
let failedCandidates = [];
try {
  const previous = JSON.parse(await readFile(evidence, 'utf8'));
  failedCandidates = previous.failedCandidates ?? [];
  if (previous.status === 'failed' && !failedCandidates.some(entry => entry.source === previous.source)) {
    failedCandidates.push({ source: previous.source, firstFailure: previous.firstFailure });
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
failedCandidates = failedCandidates.map(entry => ({ ...entry, firstFailure: {
  ...entry.firstFailure,
  stack: entry.firstFailure?.stack?.replace(/data:text\/javascript;base64,[^\s)]+/g,'[bundled consumer]'),
} }));

const scene = {
  format:'barocss-gpu-engine-scene',version:0,id:'advanced_uv_scene',
  coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,0,0],
  camera:{eye:[0,0,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:10},
  geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'advanced_uv_quad',coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:[-1,-1,0,1,-1,0,1,1,0,-1,1,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3]}],
  materials:[{id:'advanced_uv_material',type:'unlit',colorSpace:'linear',color:[1,1,1]}],
  nodes:[{id:'advanced_uv_node',type:'mesh',parentId:null,translation:[0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true,geometryId:'advanced_uv_quad',materialId:'advanced_uv_material'}],
};
const consumerText = `
import assert from 'node:assert/strict';
import {compileEngineUVRepeatingMaterial,validateEngineUVRepeatingMaterialIR,lowerEngineUVRepeatingMaterial,prepareEngineUVRepeatingMaterialBindings,evaluateAuthoredMaterial,AuthoredMaterialEvaluationError,MeshMaterialError} from '@barocss/gpu';
const source=${JSON.stringify(preset.source)};
const scene=${JSON.stringify(scene)};
const sceneBefore=structuredClone(scene);
const compiled=compileEngineUVRepeatingMaterial(source);
assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
assert.equal(compiled.material.shaderId,'halftone_dots');
assert.equal(compiled.material.profile,'engine-opaque-uv-repeating-fragment-v0');
assert.equal(compiled.material.source,source);
const declared=[{name:'density',type:'float',min:2,max:12,default:6},{name:'size',type:'float',min:0,max:.8,default:.4},{name:'phase',type:'float',min:0,max:6.283185307179586,default:0},{name:'ink',type:'float',min:0,max:1,default:.9}];
assert.deepEqual(compiled.material.uniforms,declared);
const material=validateEngineUVRepeatingMaterialIR(compiled.material);
assert.deepEqual(material,compiled.material);assert.notStrictEqual(material,compiled.material);
assert.notStrictEqual(material.expression,compiled.material.expression);
const lower=lowerEngineUVRepeatingMaterial(material);
assert.equal(lower.inputDeclarations,'in vec2 v_engine_uv;');
assert.deepEqual(lower.uniformLayout,declared.map((u,i)=>({...u,glslName:'mat_u_'+i})));
assert.ok(lower.expression.includes('clamp(')&&lower.expression.includes('fract(')&&lower.expression.includes('cos('));
assert.ok(!lower.expression.includes('pow('));
let nodes=0,depth=0;
const calls=new Set();
function inspect(n,d=1){nodes++;depth=Math.max(depth,d);if(n.kind==='call'){calls.add(n.name);n.args.forEach(c=>inspect(c,d+1));}if(n.kind==='binary'){inspect(n.left,d+1);inspect(n.right,d+1);}if(n.kind==='unary')inspect(n.value,d+1);}
inspect(material.expression);assert.ok(nodes<=128);assert.ok(depth<=16);
assert.ok(['mix','clamp','fract','cos'].every(name=>calls.has(name)));
const companion={format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,sceneId:scene.id,bindings:[{materialId:'advanced_uv_material',material,uniforms:{}}]};
const companionBefore=structuredClone(companion);
const prepared=prepareEngineUVRepeatingMaterialBindings(scene,companion);
assert.deepEqual(prepared.scene.scene,scene);assert.notStrictEqual(prepared.scene.scene,scene);
assert.equal(prepared.scene.draws.length,1);assert.equal(prepared.scene.geometries[0].vertexCount,4);assert.equal(prepared.scene.geometries[0].triangleCount,2);
assert.deepEqual(prepared.scene.scene.geometries[0].uvs,[0,0,1,0,1,1,0,1]);
assert.deepEqual(prepared.loweredBindings[0].lowered,lower);
assert.deepEqual(prepared.resolvedBindings[0].binding.uniforms,{density:6,size:.4,phase:0,ink:.9});
assert.notStrictEqual(prepared.materialBindings.bindings[0].material,material);
const frozen=value=>{if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(frozen);}};
frozen(material);frozen(lower);frozen(prepared.materialBindings);frozen(prepared.resolvedBindings);
// Independent analytic witnesses, not a second expression interpreter.
const paper=[243,234,215].map(v=>(v/255)**2.2),inkColor=[24,47,67].map(v=>(v/255)**2.2);
const witnesses=[
 {label:'spot_center',uv:[0,0],uniforms:{},cosineSum:2,field:2.4,dotMask:1,ratio:.9},
 {label:'between_spots',uv:[1/12,1/12],uniforms:{},cosineSum:-2,field:-1.6,dotMask:0,ratio:0},
 {label:'phase_shifted_soft_edge',uv:[0,0],uniforms:{phase:Math.PI/2},cosineSum:1,field:1.4,dotMask:.5,ratio:.45},
];
const samples=witnesses.map(w=>{
 const request={material,uniforms:w.uniforms,uv:w.uv};const before=structuredClone(request);
 const sample=evaluateAuthoredMaterial(request);const expected=paper.map((v,i)=>v*(1-w.ratio)+inkColor[i]*w.ratio);
 sample.linearRGB.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<=1e-12,'Analytic '+w.label+' RGB '+i+': '+v+' expected '+expected[i]));
 assert.equal(sample.profile,'binary64-linear-rgb-v0');assert.equal(sample.source,source);
 assert.deepEqual(request,before);assert.notStrictEqual(sample.material,material);assert.notStrictEqual(sample.uv,w.uv);frozen(sample);
 return {...w,expectedLinearRGB:expected,sample};
});
let accepted=samples[0].sample;const acceptedBefore=structuredClone(accepted),acceptedReference=accepted;
const badSource=source.replace('smoothstep(', 'unknown(');
const refused=compileEngineUVRepeatingMaterial(badSource);
assert.equal(refused.ok,false);assert.equal(refused.diagnostics[0].code,'SYNTAX');
assert.equal(refused.diagnostics[0].start,badSource.indexOf('unknown'));
let uniformError;
try{const candidate=evaluateAuthoredMaterial({material,uniforms:{density:13},uv:[0,0]});accepted=candidate;}catch(error){uniformError=error;}
assert.ok(uniformError instanceof AuthoredMaterialEvaluationError);assert.equal(uniformError.code,'UNIFORM');
assert.ok(uniformError.cause instanceof MeshMaterialError);assert.equal(uniformError.cause.code,'UNIFORM');
assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,acceptedBefore);
assert.deepEqual(scene,sceneBefore);assert.deepEqual(companion,companionBefore);
export const receipt={source,sourceUTF8Bytes:new TextEncoder().encode(source).length,materialProfile:material.profile,canonicalExpression:{nodes,depth,scope:'Public final expanded IR occurrences, not private definition budget usage'},declaredUniforms:declared,lowered:lower,completeScene:scene,completeCompanion:companion,admittedQuad:{vertices:4,triangles:2,draws:1},samples,refusals:[{stage:'compile',diagnostic:refused.diagnostics[0]},{stage:'evaluate',code:uniformError.code,causeCode:uniformError.cause.code}],acceptedCPUReferenceAndValueRetained:true,sourceIndependentPublicCopies:true,callerInputsUnchanged:true,actualGL:false,pixelParity:'not checked'};
`;
let provenance;
try {
  const bundle = await bundleAdvancedShader(app,'node',consumerText,'halftone-shader');
  provenance=bundle.provenance;
  if(provenance.sourcePin!==pin||provenance.ownDistInputs!==0) throw Error('Unexpected provenance');
  const {receipt}=await import('data:text/javascript;base64,'+Buffer.from(bundle.result.outputFiles[0].text).toString('base64'));
  await writeFile(evidence,JSON.stringify({status:'passed',nodeVersion:process.version,sourceSHA256:createHash('sha256').update(preset.source).digest('hex'),provenance,failedCandidates,...receipt},null,2)+'\n');
  console.log(JSON.stringify({status:'passed',samples:receipt.samples.length,...receipt.canonicalExpression,ownSourceInputs:provenance.ownSourceInputs,ownDistInputs:provenance.ownDistInputs,actualGL:false}));
} catch(error) {
  const firstFailure=error instanceof Error?{name:error.name,message:error.message,stack:error.stack?.replace(/data:text\/javascript;base64,[^\s)]+/g,'[bundled consumer]')}:String(error);
  await writeFile(evidence,JSON.stringify({status:'failed',nodeVersion:process.version,source:preset.source,provenance,failedCandidates,firstFailure,actualGL:false},null,2)+'\n');
  console.error(JSON.stringify({status:'failed',firstFailure}));
  process.exitCode=1;
}
