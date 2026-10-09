import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareBooleanShellBuffers,prepareCoplanarBooleanBuffers} from '../../packages/barocss-gpu/dist/index.js';

const args=process.argv.slice(2);
function argument(name){const i=args.indexOf(name);assert.ok(i>=0&&args[i+1],`Missing ${name}`);return resolve(args[i+1]);}
const directory=argument('--meshes'),planarFile=argument('--planar'),output=argument('--output');
const settings={mmToSceneUnit:0.05,translate:[0.25,-0.5,0.75]};
const names=['cross_union','containment_hole','strip_two_components','reverse_containment_empty','cross_union_distance_edit'];
const results=[],accepted=new Map();let refusalCount=0,getterCalls=0;
function refused(action,label){assert.throws(action,RangeError,label);refusalCount++;}
function bounds(positions){if(!positions.length)return null;return{min:[0,1,2].map(axis=>Math.min(...positions.filter((_,i)=>i%3===axis))),max:[0,1,2].map(axis=>Math.max(...positions.filter((_,i)=>i%3===axis)))};}
function signedZeros(value){if(typeof value==='number')return Number(Object.is(value,-0));if(value&&typeof value==='object')return Object.values(value).reduce((n,child)=>n+signedZeros(child),0);return 0;}
for(const name of names){
  const file=resolve(directory,`${name}.owned-extrusion-mesh.json`),bytes=await readFile(file),hash=createHash('sha256').update(bytes).digest('hex');
  const native=JSON.parse(bytes),before=structuredClone(native),prepared=prepareBooleanShellBuffers(native,settings);
  assert.equal(prepared.schema,'barocss-gpu-boolean-shell-buffers');assert.equal(prepared.version,0);assert.equal(prepared.coordinateSystem,'right-handed-authored-xyz');
  assert.deepEqual(prepared.native,before);assert.notEqual(prepared.native,native);
  assert.ok(Object.isFrozen(prepared.native.extrusion)&&Object.isFrozen(prepared.native.mesh.positionsMM)&&Object.isFrozen(prepared.native.edgePaths));
  assert.deepEqual([...prepared.positions],native.mesh.positionsMM.map((n,i)=>Math.fround(n*settings.mmToSceneUnit+settings.translate[i%3])));
  assert.deepEqual([...prepared.normals],native.mesh.normals.map(Math.fround));assert.deepEqual([...prepared.indices],native.mesh.indices);
  const originalEdgePoints=native.edgePaths.flatMap(path=>path.samples.flatMap(sample=>sample.curveD1.point));
  assert.deepEqual([...prepared.edgePositions],originalEdgePoints.map((n,i)=>Math.fround(n*settings.mmToSceneUnit+settings.translate[i%3])));
  assert.deepEqual([...prepared.edgeIndices],native.edgePaths.flatMap((_,i)=>[3*i,3*i+1,3*i+1,3*i+2]));
  assert.deepEqual(prepared.bounds,bounds([...prepared.positions]));assert.deepEqual(prepared.edgeBounds,bounds([...prepared.edgePositions]));
  assert.equal(prepared.edgePositions.length/9,native.report.edgePathCount);
  const trueIds=new Set(native.edgePaths.map(path=>path.edgeId));
  for(const face of native.faceRanges){
    for(const internal of face.internalEdges)assert.ok(!trueIds.has(internal.id));
    assert.deepEqual(prepared.native.faceRanges.find(f=>f.faceId===face.faceId),face);
  }
  for(let i=0;i<native.edgePaths.length;i++){
    const path=native.edgePaths[i];assert.equal(path.adjacentFaces.length,2);
    assert.deepEqual(prepared.native.edgePaths[i].adjacentFaces,path.adjacentFaces);
    assert.equal(path.samples.length,3);assert.deepEqual(prepared.native.edgePaths[i].samples.map(s=>s.parameter),path.samples.map(s=>s.parameter));
  }
  const second=prepareBooleanShellBuffers(native,settings);
  if(prepared.positions.length){const old=second.positions[0];prepared.positions[0]=123;assert.equal(second.positions[0],old);prepared.positions[0]=old;}
  if(prepared.edgePositions.length){const old=second.edgePositions[0];prepared.edgePositions[0]=123;assert.equal(second.edgePositions[0],old);prepared.edgePositions[0]=old;}
  assert.deepEqual(prepared.native,before);assert.deepEqual(native,before);
  assert.equal(signedZeros(prepared.native),signedZeros(before));
  assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash);
  accepted.set(name,prepared);
  results.push({name,file,sha256:hash,meshId:native.mesh.id,binding:native.mesh.binding,vertices:prepared.positions.length/3,triangles:prepared.indices.length/3,
    paths:prepared.edgePositions.length/9,edgeSegments:prepared.edgeIndices.length/2,faces:native.faceRanges.length,shells:native.shellRanges.length,
    nativeSignedZeros:signedZeros(before),originalPreserved:true,bounds:prepared.bounds,edgeBounds:prepared.edgeBounds});
  if(name==='containment_hole'){
    const prior=structuredClone(prepared.native),priorMesh=[...prepared.positions],priorEdges=[...prepared.edgePositions];
    refused(()=>prepareBooleanShellBuffers(native,{...settings,mmToSceneUnit:0}),'zero scale');
    refused(()=>prepareBooleanShellBuffers(native,{...settings,mmToSceneUnit:-1}),'negative scale');
    refused(()=>prepareBooleanShellBuffers(native,{...settings,translate:[1001,0,0]}),'scene limits');
    refused(()=>prepareBooleanShellBuffers(native,{...settings,axis:'y-up'}),'foreign options');
    const optionsGetter={...settings};Object.defineProperty(optionsGetter,'translate',{enumerable:true,get(){getterCalls++;return[0,0,0];}});
    refused(()=>prepareBooleanShellBuffers(native,optionsGetter),'options getter');
    const nativeGetter={...native};Object.defineProperty(nativeGetter,'mesh',{enumerable:true,get(){getterCalls++;return native.mesh;}});
    refused(()=>prepareBooleanShellBuffers(nativeGetter,settings),'native getter');
    const badTriangle=structuredClone(native);badTriangle.mesh.indices[0]=384;
    refused(()=>prepareBooleanShellBuffers(badTriangle,settings),'native triangle');
    const badFace=structuredClone(native);badFace.faceRanges[0].surfaceId='forged_surface';
    refused(()=>prepareBooleanShellBuffers(badFace,settings),'face identity');
    const badPath=structuredClone(native);badPath.edgePaths[0].samples[1].parameter+=0.01;
    refused(()=>prepareBooleanShellBuffers(badPath,settings),'native path interval');
    const badSource=structuredClone(native);badSource.extrusion.sources[0].source+='\n';
    refused(()=>prepareBooleanShellBuffers(badSource,settings),'native source');
    refused(()=>prepareBooleanShellBuffers(native.mesh,settings),'partial native profile');
    refused(()=>prepareBooleanShellBuffers({...native,version:1},settings),'foreign schema');
    refused(()=>prepareBooleanShellBuffers(native,{...settings,mmToSceneUnit:1e308}),'overflow');
    refused(()=>prepareBooleanShellBuffers(native,{mmToSceneUnit:Number.MIN_VALUE,translate:[0,0,0]}),'Float32 underflow');
    refused(()=>prepareBooleanShellBuffers(native,{mmToSceneUnit:1e-12,translate:[100,100,100]}),'Float32 collapse');
    assert.deepEqual(prepared.native,prior);assert.deepEqual([...prepared.positions],priorMesh);assert.deepEqual([...prepared.edgePositions],priorEdges);assert.deepEqual(native,before);
  }
}
const old=accepted.get('cross_union'),edited=accepted.get('cross_union_distance_edit');
const capPoints=(prepared,kind)=>prepared.native.faceRanges.filter(f=>f.kind===kind).flatMap(f=>prepared.native.mesh.positionsMM.slice(f.vertexStart*3,(f.vertexStart+f.vertexCount)*3));
assert.deepEqual(capPoints(old,'bottom-cap'),capPoints(edited,'bottom-cap'));assert.notDeepEqual(capPoints(old,'top-cap'),capPoints(edited,'top-cap'));
assert.deepEqual(old.native.extrusion.region,edited.native.extrusion.region);
assert.notDeepEqual([...old.positions],[...edited.positions]);
const planarBytes=await readFile(planarFile),planar=JSON.parse(planarBytes),planarBefore=structuredClone(planar),oldApi=prepareCoplanarBooleanBuffers(planar,settings);
assert.equal(oldApi.schema,'barocss-gpu-coplanar-boolean-buffers');assert.deepEqual(oldApi.native,planarBefore);
assert.deepEqual([...oldApi.positions],planar.mesh.positionsMM.map((n,i)=>Math.fround(n*settings.mmToSceneUnit+settings.translate[i%3])));
assert.deepEqual([...oldApi.boundaryIndices],planar.boundaryPaths.flatMap(path=>path.vertexIndices));assert.deepEqual(oldApi.bounds,bounds([...oldApi.positions]));
refused(()=>prepareBooleanShellBuffers(planar,settings),'planar profile is not Shell');refused(()=>prepareCoplanarBooleanBuffers(old.native,settings),'Shell profile is not planar');
assert.equal(getterCalls,0);assert.deepEqual(results.map(r=>r.vertices),[48,48,48,0,48]);assert.deepEqual(results.map(r=>r.triangles),[28,32,24,0,28]);
assert.equal(results[1].paths,24);assert.equal(results[2].shells,2);assert.equal(results[3].bounds,null);assert.equal(results[3].edgeBounds,null);
const summary={schema:'barocss-gpu-shell-buffer-flow',version:0,node:process.version,cases:results,refusalCount,getterCalls,
  planarControl:{file:planarFile,sha256:createHash('sha256').update(planarBytes).digest('hex'),vertices:oldApi.positions.length/3,triangles:oldApi.indices.length/3,boundaries:oldApi.boundaryIndices.length/2},
  distanceEditPassed:true,gate:'compiled-public-CPU-API-and-authentic-saved-files-only',browserRun:false,glRun:false,rendererSupport:false};
await mkdir(output,{recursive:true});await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
