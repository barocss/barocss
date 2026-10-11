import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundleAdvancedShader } from './build-advanced-shader.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(app, 'evidence/contour-shader-consumer.json');
const preset = JSON.parse(await readFile(resolve(app, 'scripts/snippets/contour-shader.json'), 'utf8'));
if (preset.sourceProfile !== '7e96b959746a3fee957644fd1b5ccaf79c992c6c') throw Error('Unexpected contour source profile');
const scene = {
  format:'barocss-gpu-engine-scene',version:0,id:'advanced_uv_scene',
  coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[0,0,0],
  camera:{eye:[0,0,3],target:[0,0,0],up:[0,1,0],fovYDegrees:45,near:.1,far:10},
  geometries:[{format:'barocss-gpu-triangle-geometry',version:0,id:'advanced_uv_quad',
    coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',
    positions:[-1,-1,0,1,-1,0,1,1,0,-1,1,0],normals:[0,0,1,0,0,1,0,0,1,0,0,1],
    uvs:[0,0,1,0,1,1,0,1],indices:[0,1,2,0,2,3]}],
  materials:[{id:'advanced_uv_material',type:'unlit',colorSpace:'linear',color:[1,1,1]}],
  nodes:[{id:'advanced_uv_node',type:'mesh',parentId:null,translation:[0,0,0],rotationXYZW:[0,0,0,1],
    scale:[1,1,1],visible:true,geometryId:'advanced_uv_quad',materialId:'advanced_uv_material'}],
};
const consumerText = `
import assert from 'node:assert/strict';
import {
 compileEngineUVRepeatingMaterial,validateEngineUVRepeatingMaterialIR,lowerEngineUVRepeatingMaterial,
 prepareEngineUVRepeatingMaterialBindings,evaluateAuthoredMaterial,
 AuthoredMaterialEvaluationError,MeshMaterialError,EngineMaterialBindingsError,
} from '@barocss/gpu';
const source=${JSON.stringify(preset.source)};
const scene=${JSON.stringify(scene)};
const originalScene=structuredClone(scene);
const frozen=value=>{if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(frozen)}};
const compiled=compileEngineUVRepeatingMaterial(source);
if(!compiled.ok){const error=new Error('Contour compiler refused');error.diagnostics=compiled.diagnostics;throw error}
assert.equal(compiled.material.profile,'engine-opaque-uv-repeating-fragment-v0');
assert.equal(compiled.material.shaderId,'contour_bands');assert.equal(compiled.material.source,source);
const uniforms=[
 {name:'frequency',type:'float',min:1,max:8,default:3},
 {name:'bands',type:'float',min:2,max:12,default:6},
 {name:'phase',type:'float',min:0,max:6.283185307179586,default:0},
 {name:'contrast',type:'float',min:0,max:1,default:.8},
];
assert.deepEqual(compiled.material.uniforms,uniforms);frozen(compiled.material);
const originalMaterial=structuredClone(compiled.material);
const material=validateEngineUVRepeatingMaterialIR(compiled.material);
assert.deepEqual(material,compiled.material);assert.notStrictEqual(material,compiled.material);frozen(material);
let nodes=0,depth=0;const calls=new Set(),inputs=new Set();
function visit(node,level=1){
 nodes++;depth=Math.max(depth,level);
 if(node.kind==='call'){calls.add(node.name);node.args.forEach(child=>visit(child,level+1))}
 if(node.kind==='binary'){visit(node.left,level+1);visit(node.right,level+1)}
 if(node.kind==='unary')visit(node.value,level+1);
 if(node.kind==='input')inputs.add(node.name);
}
visit(material.expression);
if(nodes>128||depth>16){const error=new Error('Contour final canonical IR exceeds selected target');error.canonicalExpression={nodes,depth};throw error}
assert.deepEqual([...inputs].sort(),['uv_u','uv_v']);
assert.ok(['fract','sin','cos','clamp','mix'].every(name=>calls.has(name)));
const lowered=lowerEngineUVRepeatingMaterial(material);
assert.equal(lowered.inputDeclarations,'in vec2 v_engine_uv;');
assert.deepEqual(lowered.uniformLayout,uniforms.map((value,index)=>({...value,glslName:'mat_u_'+index})));
assert.ok(lowered.expression.includes('fract(')&&lowered.expression.includes('clamp('));frozen(lowered);
const companion={format:'barocss-gpu-engine-uv-repeating-material-bindings',version:0,sceneId:scene.id,
 bindings:[{materialId:'advanced_uv_material',material,uniforms:{}}]};
const beforeCompanion=structuredClone(companion);
let accepted=prepareEngineUVRepeatingMaterialBindings(scene,companion);
const acceptedReference=accepted,acceptedSnapshot=structuredClone(accepted);
assert.deepEqual(accepted.scene.scene,scene);assert.notStrictEqual(accepted.scene.scene,scene);
assert.equal(accepted.scene.draws.length,1);assert.equal(accepted.scene.geometries[0].vertexCount,4);
assert.equal(accepted.scene.geometries[0].triangleCount,2);
assert.deepEqual(accepted.scene.scene.geometries[0].uvs,[0,0,1,0,1,1,0,1]);
assert.deepEqual(accepted.resolvedBindings[0].binding.uniforms,{frequency:3,bands:6,phase:0,contrast:.8});
assert.deepEqual(accepted.loweredBindings[0].lowered,lowered);
frozen(accepted.materialBindings);frozen(accepted.resolvedBindings);frozen(accepted.loweredBindings);
const witnesses=[
 {name:'origin_defaults',uv:[0,0],uniforms:{},elevation:.75,band:.5,line:0,
  expected:[.542928650094916,.5095745193322695,.2967345772872111]},
 {name:'origin_phase_pi',uv:[0,0],uniforms:{phase:Math.PI},elevation:.25,band:.5,line:0,
  expected:[.18344104308423873,.19648962044510687,.12265443888568288]},
 {name:'negative_uv_peak',uv:[-.25,0],uniforms:{},elevation:1,band:0,line:.8,
  expected:[.1450450369937845,.13724595652065458,.08158740422147488]},
];
const samples=witnesses.map(witness=>{
 const request={material,uniforms:witness.uniforms,uv:witness.uv},before=structuredClone(request);
 const sample=evaluateAuthoredMaterial(request);
 sample.linearRGB.forEach((value,index)=>assert.ok(Number.isFinite(value)&&Math.abs(value-witness.expected[index])<1e-12));
 assert.equal(sample.profile,'binary64-linear-rgb-v0');assert.equal(sample.source,source);
 assert.deepEqual(sample.uniforms,{frequency:3,bands:6,phase:witness.uniforms.phase??0,contrast:.8});
 assert.deepEqual(sample.uv,witness.uv);assert.notStrictEqual(sample.uv,witness.uv);
 assert.deepEqual(sample.material,material);assert.notStrictEqual(sample.material,material);
 assert.deepEqual(request,before);frozen(sample);
 return {name:witness.name,uv:witness.uv,overrides:witness.uniforms,
  analyticBasis:{elevation:witness.elevation,band:witness.band,line:witness.line},
  expectedLinearRGB:witness.expected,linearRGB:sample.linearRGB};
});
const badSource=source.replace('sin(','unknown(');
assert.notEqual(badSource,source);
const refusedSource=compileEngineUVRepeatingMaterial(badSource);
assert.equal(refusedSource.ok,false);assert.equal(refusedSource.diagnostics[0].code,'SYNTAX');
assert.equal(refusedSource.diagnostics[0].start,badSource.indexOf('unknown'));
assert.equal(refusedSource.diagnostics[0].end,badSource.indexOf('unknown')+7);
let uniformError;
try{evaluateAuthoredMaterial({material,uniforms:{contrast:2},uv:[0,0]})}catch(error){uniformError=error}
assert.ok(uniformError instanceof AuthoredMaterialEvaluationError);assert.equal(uniformError.code,'UNIFORM');
assert.ok(uniformError.cause instanceof MeshMaterialError);assert.equal(uniformError.cause.code,'UNIFORM');
let bindingError;
try{
 const candidate=prepareEngineUVRepeatingMaterialBindings(scene,{...companion,
  bindings:[{materialId:'advanced_uv_material',material,uniforms:{contrast:2}}]});
 accepted=candidate;
}catch(error){bindingError=error}
assert.ok(bindingError instanceof EngineMaterialBindingsError);assert.equal(bindingError.code,'MATERIAL');
assert.ok(bindingError.cause instanceof MeshMaterialError);assert.equal(bindingError.cause.code,'UNIFORM');
assert.strictEqual(accepted,acceptedReference);assert.deepEqual(accepted,acceptedSnapshot);
assert.deepEqual(scene,originalScene);assert.deepEqual(companion,beforeCompanion);assert.deepEqual(compiled.material,originalMaterial);
export const receipt={
 source,sourceUTF8Bytes:new TextEncoder().encode(source).length,materialProfile:material.profile,
 declaredUniforms:uniforms,canonicalExpression:{nodes,depth,scope:'Public final expanded IR occurrences; not private compiler accounting'},
 lowered,completeScene:scene,completeCompanion:companion,
 admittedQuad:{vertices:4,triangles:2,draws:1},resolvedUniforms:accepted.resolvedBindings[0].binding.uniforms,
 samples,refusals:[{stage:'compile',diagnostic:refusedSource.diagnostics[0]},
  {stage:'evaluate',code:uniformError.code,causeCode:uniformError.cause.code},
  {stage:'bind',code:bindingError.code,causeCode:bindingError.cause.code}],
 acceptedCPUReferenceAndValueRetained:true,callerInputsUnchanged:true,freshFrozenPublicCopies:true,
 actualGL:false,pixelParity:'not checked',
 scope:'Selected public contour compile/reconstruction/lowering/fullquad binding/three analytic CPU RGB witnesses and two genuine input refusals. No browser, host clock, old gallery or publication check.',
};
`;
let previous;
try { previous=JSON.parse(await readFile(evidence,'utf8')); }
catch(error) { if(error.code!=='ENOENT')throw error; }
const attempts=previous?.attempts?[...previous.attempts]:[];
const sourceSHA256=createHash('sha256').update(preset.source).digest('hex');
let provenance;
try {
 const bundle=await bundleAdvancedShader(app,'node',consumerText,'contour-shader');
 provenance=bundle.provenance;
 if(provenance.sourcePin!==preset.sourceProfile||provenance.ownDistInputs!==0)throw Error('Unexpected contour provenance');
 const {receipt}=await import('data:text/javascript;base64,'+Buffer.from(bundle.result.outputFiles[0].text).toString('base64'));
 attempts.push({status:'passed',sourceSHA256,source:preset.source,canonicalExpression:receipt.canonicalExpression});
 await writeFile(evidence,JSON.stringify({status:'passed',nodeVersion:process.version,sourceSHA256,provenance,attempts,...receipt},null,2)+'\n');
 console.log(JSON.stringify({status:'passed',samples:receipt.samples.length,nodes:receipt.canonicalExpression.nodes,depth:receipt.canonicalExpression.depth,ownSourceInputs:provenance.ownSourceInputs,actualGL:false}));
} catch(error) {
 const failure={name:error.name,message:error.message,stack:error.stack,
  diagnostics:error.diagnostics,canonicalExpression:error.canonicalExpression};
 attempts.push({status:'failed',sourceSHA256,source:preset.source,failure});
 await writeFile(evidence,JSON.stringify({status:'failed',nodeVersion:process.version,provenance,attempts,firstFailure:previous?.firstFailure??failure,actualGL:false},null,2)+'\n');
 console.error(JSON.stringify({status:'failed',name:error.name,message:error.message,diagnostics:error.diagnostics,canonicalExpression:error.canonicalExpression}));
 process.exitCode=1;
}
