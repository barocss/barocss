/** #1351: complete native Body files -> six derived generic-engine geometries.
 * node examples/gpu-scene/qualified-body-engine-scene-flow.mjs
 *   --output <fresh-directory> --native-dir <1348-original-files>
 *   --cad-package <1348-native-package-with-original-dist>
 * CPU composition only. Native qualification and graphics acceptance are distinct.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
function argument(name) { const i=args.indexOf(name); assert(i>=0&&args[i+1]&&!args[i+1].startsWith('--'),name+' required'); return resolve(args[i+1]); }
const output=argument('--output'), nativeDir=argument('--native-dir'), cadPackage=argument('--cad-package');
await mkdir(output,{recursive:false});
const gpuPackage=resolve(repo,'packages/barocss-gpu');
const sha=value=>createHash('sha256').update(value).digest('hex');
const roles=['lower','upper','cap','base','uMin','uMax'];
const pins={main:{bytes:2783390,sha256:'30013ca3ff2e04b77388a5c7d5ea2fe1f3ea97c6054089f7491e54ef7ffb2165'},edited:{bytes:2806407,sha256:'241b8ebe23c844f3717110b3d856499ec6e1b6e9cfc5a9aa6a2eda1e40e9bfa0'}};
// Private evidence codec: explicit -0 survives JSON.parse; no public serializer.
function json(value) {
 if(typeof value==='number'){assert(Number.isFinite(value));return Object.is(value,-0)?'-0':JSON.stringify(value);}
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(json).join(',')+']';
 return '{'+Object.entries(value).map(([k,v])=>JSON.stringify(k)+':'+json(v)).join(',')+'}';
}
const copy=value=>JSON.parse(json(value));
function ownKeys(value,keys){assert.deepEqual(Object.keys(value).sort(),[...keys].sort());}
async function save(name,value){const text=json(value)+'\n';assert(text.length<=4194304&&Buffer.byteLength(text)<=4194304);await writeFile(resolve(output,name),text);return {bytes:Buffer.byteLength(text),sha256:sha(text)};}
function mapXYZ(values){const result=[];for(let i=0;i<values.length;i+=3)result.push(values[i],values[i+2],-values[i+1]);return result;}
function deriveScene(native){
 assert.equal(native.renderChunks.length,6);assert.deepEqual(native.renderChunks.map(c=>c.role),roles);
 const geometries=[],nodes=[],faces=[];
 native.renderChunks.forEach((chunk,i)=>{
  assert.equal(chunk.positionEncoding,'float32-number');assert.equal(chunk.normalSource,'approximate-triangle-geometry');
  const geometryId='body_face_'+i,nodeId='body_node_'+i;
  geometries.push({format:'barocss-gpu-triangle-geometry',version:0,id:geometryId,coordinateSystem:'right-handed-y-up',positionUnit:'scene',winding:'ccw',positions:mapXYZ(chunk.positionsMM),normals:mapXYZ(chunk.normals),uvs:Array(chunk.authorityIndices.length*2).fill(0),indices:[...chunk.indices]});
  nodes.push({id:nodeId,parentId:null,type:'mesh',geometryId,materialId:'body_material',translation:[0,0,0],rotationXYZW:[0,0,0,1],scale:[1,1,1],visible:true});
  faces.push({geometryId,nodeId,faceId:chunk.faceId,role:chunk.role,orientation:chunk.orientation,authorityIndices:[...chunk.authorityIndices],faceSampleIndices:[...chunk.faceSampleIndices],triangleIndices:[...chunk.triangleIndices],parametersUV:[...chunk.parametersUV],cadQuantizationGapsMM:[...chunk.quantizationGapsMM]});
 });
 return {scene:{format:'barocss-gpu-engine-scene',version:0,id:'qualified_body_scene',coordinateSystem:'right-handed-y-up',positionUnit:'scene',background:[.02,.03,.04],camera:{eye:[40,30,40],target:[0,0,0],up:[0,1,0],fovYDegrees:60,near:.1,far:200},geometries,materials:[{id:'body_material',type:'unlit',colorSpace:'linear',color:[.25,.5,.75]}],nodes},qualification:{version:0,nativeBodyId:native.body.body.id,nativeMeshId:native.packet.meshId,sourceFrame:'authored-xyz-no-axis-conversion',targetFrame:'right-handed-y-up',sceneUnitsPerMillimeter:1,basis:'x,z,-y',textureUV:'derived-zero',faces}};
}
function prepare(gpu,derived){
 const staged=derived.scene.geometries.map(g=>gpu.prepareTriangleGeometry(g));
 const scene=gpu.prepareEngineScene(derived.scene);assert.equal(scene.draws.length,6);assert.equal(scene.bufferBytes,58752);assert.equal(scene.vertexWork,1728);
 assert.equal(staged.reduce((n,g)=>n+g.vertexCount,0),1728);assert.equal(staged.reduce((n,g)=>n+g.triangleCount,0),576);assert.equal(staged.reduce((n,g)=>n+g.bufferBytes,0),58752);
 for(let i=0;i<6;i++){const g=scene.geometries[i];assert.equal(g.indexType,'uint16');assert(g.indices instanceof Uint16Array);assert.deepEqual(g.geometry,staged[i].geometry);assert.deepEqual(g.positions,staged[i].positions);assert.deepEqual(g.normals,staged[i].normals);assert.deepEqual(g.uvs,staged[i].uvs);assert(Object.isFrozen(g.geometry));}
 return scene;
}
function bufferRecord(prepared){return prepared.geometries.map(g=>({positions:Array.from(g.positions),normals:Array.from(g.normals),uvs:Array.from(g.uvs),indices:Array.from(g.indices),indexType:g.indexType,bufferBytes:g.bufferBytes}));}
function nativeStates(native){return native.faceSamples.reduce((s,row)=>{if(row.d1.status==='refused-c0'){s.refused++;assert.equal(row.d1.orientedNormal,null);assert.equal(row.d1.du,null);assert.equal(row.d1.dv,null);}else {assert.equal(row.d1.status,'evaluated');s.evaluated++;}return s;},{evaluated:0,refused:0});}
function observations(native,derived,prepared){
 const faces=[];let negativeZeroMapped=0,zeroCanonicalizations=0;
 native.renderChunks.forEach((chunk,f)=>{
  const nativeToCadChunkGapMM=[],cadChunkToTargetGapScene=[],g=prepared.geometries[f],qualification=derived.qualification.faces[f];
  assert.equal(chunk.indices.length,chunk.authorityIndices.length);assert.deepEqual(qualification.parametersUV,chunk.parametersUV);
  for(let v=0;v<chunk.authorityIndices.length;v++){
   const original=native.packet.positionsMM.slice(3*chunk.authorityIndices[v],3*chunk.authorityIndices[v]+3),quantized=chunk.positionsMM.slice(v*3,v*3+3);
   const first=Math.hypot(original[0]-quantized[0],original[1]-quantized[1],original[2]-quantized[2]);
   assert(Object.is(first,chunk.quantizationGapsMM[v]));nativeToCadChunkGapMM.push(first);
   const expected=[quantized[0],quantized[2],-quantized[1]],actual=Array.from(g.positions.slice(v*3,v*3+3));
   for(let axis=0;axis<3;axis++){assert.equal(actual[axis],Math.fround(expected[axis]));if(Object.is(expected[axis],-0)){negativeZeroMapped++;if(!Object.is(actual[axis],-0))zeroCanonicalizations++;}}
   const second=Math.hypot(expected[0]-actual[0],expected[1]-actual[1],expected[2]-actual[2]);assert.equal(second,0);cadChunkToTargetGapScene.push(second);
   const sample=native.faceSamples[chunk.faceSampleIndices[v]];assert.equal(sample.faceId,chunk.faceId);assert.equal(sample.vertexIndex,chunk.authorityIndices[v]);assert.deepEqual(sample.uv,chunk.parametersUV.slice(v*2,v*2+2));
   assert.equal(g.uvs[v*2],0);assert.equal(g.uvs[v*2+1],0);assert.equal(chunk.indices[v],v);
  }
  // Independent triangle incidence/normal check in actual admitted target buffers.
  for(let t=0;t<g.indices.length;t+=3){
   const points=[0,1,2].map(k=>Array.from(g.positions.slice(g.indices[t+k]*3,g.indices[t+k]*3+3)));
   const a=points[1].map((x,k)=>x-points[0][k]),b=points[2].map((x,k)=>x-points[0][k]);
   const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
   assert(Math.hypot(...cross)>0);const normal=Array.from(g.normals.slice(g.indices[t]*3,g.indices[t]*3+3));assert(cross.reduce((s,x,k)=>s+x*normal[k],0)>0);
   const tri=native.packet.triangles[chunk.triangleIndices[t/3]];assert.equal(tri.faceId,chunk.faceId);assert.deepEqual(tri.vertexIndices,chunk.authorityIndices.slice(t,t+3));
  }
  faces.push({faceId:chunk.faceId,role:chunk.role,nativeToCadChunkGapMM,cadChunkToTargetGapScene});
 });
 assert.deepEqual(nativeStates(native),{evaluated:345,refused:45});
 return {faces,negativeZeroMapped,zeroCanonicalizations,nativeStates:nativeStates(native)};
}
async function sourceBundle(name,entry){
 const path=resolve(output,name+'.mjs');const result=await build({entryPoints:[entry],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true});
 const inputs=Object.keys(result.metafile.inputs);assert(!inputs.some(p=>/barocss-(gpu|cad)\/dist\//.test(p)),'Ordinary source must have no own dist');
 await save(name+'.inputs.json',inputs);return import(pathToFileURL(path).href);
}
const gpuManifest=JSON.parse(await readFile(resolve(gpuPackage,'package.json'),'utf8'));
const cadManifest=JSON.parse(await readFile(resolve(cadPackage,'package.json'),'utf8'));
const gpuSource=await sourceBundle('gpu-source',resolve(gpuPackage,gpuManifest.exports['.'].import));
const cadSource=await sourceBundle('cad-source',resolve(repo,'packages/barocss-cad/src/index.ts'));
const emittedGPUPath=resolve(gpuPackage,gpuManifest.publishConfig.exports['.'].import),emittedCADPath=resolve(cadPackage,cadManifest.publishConfig.exports['.'].import);
assert.equal(sha(await readFile(emittedCADPath)),'f5718e5dea2858944818cdd96674c123917deb11be144331e9ae996a306770b5','Actual immutable CAD native emitted root');
const emittedCADLeaf=resolve(cadPackage,'dist/qualified-translated-strip-body-mesh.js');
assert.equal(sha(await readFile(emittedCADLeaf)),'d6ef40c86869d6f31cc476bc41e134f1bce6e97ce9ffa375e6d32176d49c3535');
const emittedCAD=await import(pathToFileURL(emittedCADPath).href),emittedGPU=await import(pathToFileURL(emittedGPUPath).href);
assert.deepEqual(Object.keys(gpuSource).sort(),Object.keys(emittedGPU).sort());assert.deepEqual(Object.keys(cadSource).sort(),Object.keys(emittedCAD).sort());
for(const [pkg,manifest,names] of [[gpuPackage,gpuManifest,['prepareTriangleGeometry','prepareEngineScene','TriangleGeometryV0','EngineSceneV0']],[cadPackage,cadManifest,['validateQualifiedTranslatedStripBodyMesh','QualifiedTranslatedStripBodyMeshResult']]]){
 const text=await readFile(resolve(pkg,manifest.publishConfig.exports['.'].types),'utf8');for(const name of names)assert(new RegExp('\\b'+name+'\\b').test(text),name+' actual public declaration');
}
// Check actual emitted dependency closure has no own TypeScript fallback.
for(const [name,path] of [['gpu-emitted',emittedGPUPath],['cad-emitted',emittedCADPath]]){
 const compiled=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',write:false,metafile:true,target:'node22'});const inputs=Object.keys(compiled.metafile.inputs);assert(!inputs.some(p=>/barocss-(gpu|cad)\/src\//.test(p)));await save(name+'.inputs.json',inputs);
}
const originals={};
for(const name of ['main','edited']){const bytes=await readFile(resolve(nativeDir,name+'.mesh-result.json'));assert.equal(bytes.length,pins[name].bytes);assert.equal(sha(bytes),pins[name].sha256);const text=bytes.toString('utf8');assert(text.length<=4194304);const native=JSON.parse(text);ownKeys(native,['body','options','packet','edgePaths','faceSamples','renderChunks','proof','report']);originals[name]={bytes,native};await writeFile(resolve(output,name+'.original-native.json'),bytes);}
let accepted=0,refused=0,getterCalls=0,ownedCalls=0;const records=[],refusals=[];
try{
 for(const [provider,gpu,cad] of [['source',gpuSource,cadSource],['emitted',emittedGPU,emittedCAD]]){
  let previous,mainPositions;
  for(const name of ['main','edited']){
   const native=copy(originals[name].native),before=json(native);const report=cad.validateQualifiedTranslatedStripBodyMesh(native);ownedCalls++;assert.deepEqual(report,native.report);assert.notStrictEqual(report,native.report);assert.equal(json(native),before);
   const derived=deriveScene(native),prepared=prepare(gpu,derived),observed=observations(native,derived,prepared);assert.equal(json(native),before);
   ownKeys(derived,['scene','qualification']);assert.equal(Object.keys(derived.scene).length,10);assert.equal(Object.keys(derived.scene.geometries[0]).length,10);
   assert.notStrictEqual(derived.qualification.faces[0].parametersUV,native.renderChunks[0].parametersUV);assert.notStrictEqual(prepared.geometries[0].positions,prepared.geometries[1].positions);
   const state={native:copy(native),scene:copy(prepared.scene),qualification:copy(derived.qualification)},buffers=bufferRecord(prepared);
   await save(provider+'.'+name+'.accepted.json',state);await save(provider+'.'+name+'.buffers.json',buffers);await save(provider+'.'+name+'.observations.json',observed);await save(provider+'.'+name+'.native-report.json',report);
   if(name==='main')mainPositions=buffers.map(g=>g.positions);else assert.notDeepEqual(buffers.map(g=>g.positions),mainPositions,'Genuine upper edit changes actual execution');
   // Independently copied inputs/retained native authority cannot mutate prepared data.
   const originalPosition=prepared.geometries[0].positions[0],originalUV=state.qualification.faces[0].parametersUV[0];
   derived.scene.geometries[0].positions[0]+=1;native.renderChunks[0].parametersUV[0]+=1;
   assert(Object.is(prepared.geometries[0].positions[0],originalPosition));assert(Object.is(state.qualification.faces[0].parametersUV[0],originalUV));assert.equal(json(state.native),before);
   previous={state,prepared,buffers};records.push({provider,name,draws:prepared.draws.length,bufferBytes:prepared.bufferBytes,vertexWork:prepared.vertexWork,observationHash:sha(json(observed)),nativeHash:sha(before)});accepted++;
  }
  const retained=json(previous.state),retainedBuffers=json(bufferRecord(previous.prepared));
  function reject(label,action,expected){let error;try{action();}catch(e){error=e;}assert(error instanceof Error,label+' must genuinely refuse');if(expected)assert.equal(error.code,expected);assert.equal(json(previous.state),retained);assert.equal(json(bufferRecord(previous.prepared)),retainedBuffers);refusals.push({provider,label,name:error.name,code:error.code,cause:error.cause?.name??null});refused++;}
  const make=()=>copy(previous.state.scene.geometries[0]);
  reject('derived range',()=>{const g=make();g.positions[0]=1001;gpu.prepareTriangleGeometry(g);},'GEOMETRY');
  reject('derived nonunit normal',()=>{const g=make();g.normals.splice(0,3,2,0,0);gpu.prepareTriangleGeometry(g);},'GEOMETRY');
  reject('derived reversed triangle',()=>{const g=make();[g.indices[1],g.indices[2]]=[g.indices[2],g.indices[1]];gpu.prepareTriangleGeometry(g);},'GEOMETRY');
  reject('derived collapsed triangle',()=>{const g=make();g.positions.splice(3,3,...g.positions.slice(0,3));gpu.prepareTriangleGeometry(g);},'GEOMETRY');
  reject('late sixth geometry refusal',()=>{const d=deriveScene(previous.state.native);d.scene.geometries[5].positions[0]=1001;prepare(gpu,d);},'GEOMETRY');
  reject('missing scene reference',()=>{const d=deriveScene(previous.state.native);d.scene.nodes[5].geometryId='missing';gpu.prepareEngineScene(d.scene);},'REFERENCE');
  if(provider==='source'){
   reject('changed whole native proof',()=>{const n=copy(previous.state.native);n.proof.eulerCharacteristic=3;cad.validateQualifiedTranslatedStripBodyMesh(n);},'OWNED');
   reject('native accessor',()=>{const n=copy(previous.state.native);Object.defineProperty(n,'packet',{enumerable:true,get(){getterCalls++;throw new Error('getter must not execute');}});cad.validateQualifiedTranslatedStripBodyMesh(n);});assert.equal(getterCalls,0);
  }
 }
 // Cold original full file: source-owned validation once; no producer author replay.
 const coldBytes=await readFile(resolve(output,'main.original-native.json'));assert.equal(sha(coldBytes),pins.main.sha256);const coldNative=JSON.parse(coldBytes.toString());const coldReport=cadSource.validateQualifiedTranslatedStripBodyMesh(coldNative);ownedCalls++;assert.deepEqual(coldReport,coldNative.report);
 const cold=deriveScene(coldNative),coldPrepared=prepare(gpuSource,cold);const saved=JSON.parse(await readFile(resolve(output,'source.main.accepted.json'),'utf8'));assert.deepEqual(cold.scene,saved.scene);assert.deepEqual(cold.qualification,saved.qualification);assert.deepEqual(coldNative,saved.native);
 assert.deepEqual(bufferRecord(coldPrepared),JSON.parse(await readFile(resolve(output,'source.main.buffers.json'),'utf8')));
 // Fresh process reads complete saved originals and invokes actual emitted GPU API.
 const coldCode=`import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {pathToFileURL} from 'node:url';const gpu=await import(pathToFileURL(process.argv[2]).href);const saved=JSON.parse(await readFile(process.argv[3],'utf8'));const prepared=gpu.prepareEngineScene(saved.scene);assert.equal(prepared.draws.length,6);assert.equal(prepared.bufferBytes,58752);const records=prepared.geometries.map(g=>({positions:Array.from(g.positions),normals:Array.from(g.normals),uvs:Array.from(g.uvs),indices:Array.from(g.indices),indexType:g.indexType,bufferBytes:g.bufferBytes}));assert.deepEqual(records,JSON.parse(await readFile(process.argv[4],'utf8')));await writeFile(process.argv[5],JSON.stringify({draws:prepared.draws.length,bufferBytes:prepared.bufferBytes,actualGL:false}));`;
 await writeFile(resolve(output,'cold-emitted.mjs'),coldCode);execFileSync(process.execPath,[resolve(output,'cold-emitted.mjs'),emittedGPUPath,resolve(output,'source.main.accepted.json'),resolve(output,'source.main.buffers.json'),resolve(output,'cold-emitted-result.json')],{stdio:'pipe'});
 assert.deepEqual(JSON.parse(await readFile(resolve(output,'source.main.accepted.json'),'utf8')),JSON.parse(await readFile(resolve(output,'emitted.main.accepted.json'),'utf8')));assert.deepEqual(JSON.parse(await readFile(resolve(output,'source.edited.accepted.json'),'utf8')),JSON.parse(await readFile(resolve(output,'emitted.edited.accepted.json'),'utf8')));
 const result={issue:1351,parent:'aa25a3653922cd50637d5564a7604b2e635a2b44',head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),gpuExports:Object.keys(gpuSource).length,cadExports:Object.keys(cadSource).length,accepted,refused,getterCalls,wholeNativeAdmissions:ownedCalls,records,refusals,pins,actualGL:false,rendererAcceptance:false,lifetimeAcceptance:false,nativeMeshCertificationAdded:false,provider:{cadNative:'84b7389cad5b330917ef3c1560993977d6672a5f',cadAdoption:'aa25a3653922cd50637d5564a7604b2e635a2b44',cadRuntimeSha256:sha(await readFile(emittedCADPath)),gpuRuntimeSha256:sha(await readFile(emittedGPUPath))}};
 await save('actual-result.json',result);console.log(JSON.stringify({accepted,refused,getterCalls,wholeNativeAdmissions:ownedCalls,gpuExports:result.gpuExports,cadExports:result.cadExports,actualGL:false}));
}catch(error){await save('first-failure.json',{name:error.name,message:error.message,code:error.code??null,stack:error.stack,accepted,refused,ownedCalls});throw error;}
