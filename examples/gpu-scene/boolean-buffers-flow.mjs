import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareCoplanarBooleanBuffers} from '../../packages/barocss-gpu/dist/index.js';

const args = process.argv.slice(2);
function argument(name) { const i = args.indexOf(name); assert.ok(i >= 0 && args[i+1], `Missing ${name}`); return resolve(args[i+1]); }
const directory = argument('--meshes'), output = argument('--output');
const settings = {mmToSceneUnit: 0.05, translate: [0.25,-0.5,0.75]};
const cases = ['cross_union','containment_hole','strip_two_components','reverse_containment_empty','authored_corner_edited'];
const results = [];
let refusalCount = 0, getterCalls = 0;
function refused(action, label) { assert.throws(action, RangeError, label); refusalCount++; }
for (const name of cases) {
  const file = resolve(directory, `${name}.owned-mesh.json`), bytes = await readFile(file);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const input = JSON.parse(bytes), before = structuredClone(input);
  const prepared = prepareCoplanarBooleanBuffers(input, settings);
  assert.equal(prepared.schema, 'barocss-gpu-coplanar-boolean-buffers');
  assert.equal(prepared.version, 0);
  assert.equal(prepared.coordinateSystem, 'right-handed-authored-xyz');
  assert.deepEqual(prepared.native, before); // includes all F64/sign bits and complete source lineage
  assert.notEqual(prepared.native, input);
  assert.ok(Object.isFrozen(prepared.native.region) && Object.isFrozen(prepared.native.mesh.positionsMM));
  assert.deepEqual([...prepared.positions], input.mesh.positionsMM.map((n,i) => Math.fround(n * settings.mmToSceneUnit + settings.translate[i%3])));
  assert.deepEqual([...prepared.normals], input.mesh.normals.map(Math.fround));
  assert.deepEqual([...prepared.indices], input.mesh.indices);
  assert.deepEqual([...prepared.boundaryIndices], input.boundaryPaths.flatMap(path => path.vertexIndices));
  const internal = new Set(input.triangulation.internalEdges.map(edge => [...edge.vertexIndices].sort((a,b)=>a-b).join(',')));
  for (const path of input.boundaryPaths) assert.ok(!internal.has([...path.vertexIndices].sort((a,b)=>a-b).join(',')));
  assert.equal(prepared.indices.length/3, input.report.triangleCount);
  assert.equal(prepared.boundaryIndices.length/2, input.report.boundaryCount);
  if (!prepared.positions.length) {
    assert.equal(prepared.bounds, null);
    assert.equal(prepared.normals.length + prepared.indices.length + prepared.boundaryIndices.length, 0);
  } else {
    for (let axis=0; axis<3; axis++) {
      const values = [...prepared.positions].filter((_,i)=>i%3===axis);
      assert.equal(prepared.bounds.min[axis], Math.min(...values));
      assert.equal(prepared.bounds.max[axis], Math.max(...values));
    }
  }
  const second = prepareCoplanarBooleanBuffers(input, settings);
  if (prepared.positions.length) {
    const original = second.positions[0]; prepared.positions[0] = 123;
    assert.equal(second.positions[0], original);
    assert.deepEqual(prepared.native, before);
    prepared.positions[0] = original;
  }
  assert.deepEqual(input, before);
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), hash);
  results.push({name,file,sha256:hash,meshId:input.mesh.id,evaluationId:input.mesh.binding.evaluationId,
    components:input.report.componentCount,holes:input.report.holeCount,vertices:prepared.positions.length/3,
    triangles:prepared.indices.length/3,boundaries:prepared.boundaryIndices.length/2,
    internalEdges:input.report.internalEdgeCount,bridges:input.report.bridgeCount,materialAreaUV:input.report.materialAreaUV,
    bounds:prepared.bounds,originalPreserved:true});
  if (name === 'containment_hole') {
    const prior = [...prepared.positions], nativePrior = structuredClone(prepared.native);
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,mmToSceneUnit:0}),'zero scale');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,mmToSceneUnit:-1}),'negative scale');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,mmToSceneUnit:Infinity}),'infinite scale');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,translate:[1001,0,0]}),'unsafe translate');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,axis:'y-up'}),'foreign options');
    const getterOptions = {...settings}; Object.defineProperty(getterOptions,'translate',{enumerable:true,get(){getterCalls++;return [0,0,0];}});
    refused(()=>prepareCoplanarBooleanBuffers(input,getterOptions),'options getter');
    const getterMesh = {...input}; Object.defineProperty(getterMesh,'mesh',{enumerable:true,get(){getterCalls++;return input.mesh;}});
    refused(()=>prepareCoplanarBooleanBuffers(getterMesh,settings),'native getter');
    const corrupt = structuredClone(input); corrupt.mesh.indices[0] = 64;
    refused(()=>prepareCoplanarBooleanBuffers(corrupt,settings),'native triangle tamper');
    const corruptBoundary = structuredClone(input); corruptBoundary.boundaryPaths[0].interval[0] += 0.1;
    refused(()=>prepareCoplanarBooleanBuffers(corruptBoundary,settings),'native boundary tamper');
    refused(()=>prepareCoplanarBooleanBuffers({...input,version:1},settings),'foreign profile');
    refused(()=>prepareCoplanarBooleanBuffers(input.mesh,settings),'partial geometry');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,mmToSceneUnit:1e308}),'conversion overflow');
    refused(()=>prepareCoplanarBooleanBuffers(input,{...settings,mmToSceneUnit:Number.MIN_VALUE,translate:[0,0,0]}),'Float32 underflow');
    refused(()=>prepareCoplanarBooleanBuffers(input,{mmToSceneUnit:1e-12,translate:[100,100,100]}),'Float32 topology collapse');
    assert.deepEqual([...prepared.positions],prior); assert.deepEqual(prepared.native,nativePrior); assert.deepEqual(input,before);
  }
}
assert.equal(getterCalls,0);
assert.deepEqual(results.map(r=>r.materialAreaUV),[24,32,18,0,4.75]);
assert.ok(results[1].bridges > 0 && results[1].holes === 1 && results[2].components === 2);
await mkdir(output,{recursive:true});
const summary = {schema:'barocss-gpu-boolean-buffer-flow',version:0,node:process.version,cases:results,refusalCount,getterCalls,
  gate:'compiled-public-CPU-API-and-authentic-saved-files-only',browserRun:false,glRun:false,rendererSupport:false};
await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
