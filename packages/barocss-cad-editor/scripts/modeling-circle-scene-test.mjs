// Genuine provider transfer, CPU adapter/scene/raycast only. No native evaluation or GPU pixels.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
export const root=resolve(import.meta.dirname,'../../..'),output=resolve(process.env.EVIDENCE_DIR??'/tmp/cad-1683-circle-scene');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const gpu=resolve(output,'circle-gpu-entry.ts');writeFileSync(gpu,['engine-scene','engine-camera-ray','engine-raycast','kernel-face-preview'].map(n=>`export * from ${JSON.stringify(resolve(root,'packages/barocss-gpu/src/'+n+'.ts'))};`).join('\n'));
const entry=['modeling-circle','modeling-scene','modeling-controller'].map(n=>`export * from ${JSON.stringify(resolve(root,'packages/barocss-cad-editor/src/'+n+'.ts'))};`).join('\n')+`\nexport {raycastEngineScene} from ${JSON.stringify(gpu)};`;
const bundle=await require('esbuild').build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,alias:{'@barocss/gpu':gpu},
 plugins:[{name:'forbid-native-runtime',setup(build){build.onResolve({filter:/^@barocss\/cad$/},()=>{throw new Error('CPU replay must not import native CAD runtime');});}}]});
writeFileSync(resolve(output,'circle-scene.mjs'),bundle.outputFiles[0].text);export const api=await import(pathToFileURL(resolve(output,'circle-scene.mjs')));
export const bytes=readFileSync(resolve(import.meta.dirname,'fixtures/modeling-circle/baseline-native.json'));
export const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,81412);assert.equal(sha256,'7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8');
export const baseline=JSON.parse(bytes),native=baseline.bodies.post.native;
assert.equal(baseline.bodySHA256,'0ef11c21a5392f29d5c94c69c5eb4acda7e4418c12e5afc6f3e619355fbe417b');
assert.deepEqual(baseline.preview.report.native,native.parent.report);assert.equal(baseline.preview.packet.positions.length,294);assert.equal(baseline.preview.packet.indices.length,192);
/** Changed revisions/roles are explicit display-context replay, never newly evaluated geometry. */
export function component(role='post',revision=0,taskToken='circle_context'){
 const preview=structuredClone(baseline.preview);preview.packet.surfaceId=preview.report.meshId='modeling_circle_'+role;preview.packet.revision=preview.report.revision=revision;
 return api.projectModelingCircle(native,preview,role,{documentId:'cad_model',bodyId:native.parent.bundle.topology.id,documentRevision:String(revision),
 kernelResultRevision:String(revision),topologyRevision:String(revision),taskToken});
}
export function reply(revision=0,taskToken='circle_context',text=baseline.text){const data=JSON.parse(text),components=Object.keys(data.outputs).map(role=>component(role,revision,taskToken));
 const outcomes=components.map(c=>({role:c.role,solidId:c.solidId,family:c.family,status:'solid'}));
 return{ok:true,text,display:{profile:'model-body-faces',documentId:'cad_model',revision,taskToken,components,outcomes},summary:{documentId:'cad_model',revision,source:'model',
 parameters:data.parameters,features:structuredClone(baseline.features),outputs:outcomes.map(o=>({name:o.role,solidId:o.solidId,family:o.family,volumeMM3:null}))}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const before=structuredClone(baseline),packet=reply().display,c=packet.components[0],scene=api.prepareModelingScene(packet,1,'post');
 assert.deepEqual(baseline,before,'projection must not mutate genuine transfer');
 assert.deepEqual(c.qualification,native.certificate);assert.deepEqual(c.lineage.topology,native.parent.bundle.topology);assert.deepEqual(c.lineage.geometry,native.world.model);
 assert.deepEqual(c.mesh.chunks.flatMap(v=>v.positionsMM),baseline.preview.packet.positions);assert.deepEqual(c.mesh.chunks.flatMap(v=>v.normals),baseline.preview.packet.normals);
 assert.deepEqual(c.mesh.chunks.flatMap(v=>v.parametersUV),baseline.preview.packet.parameters);assert.equal(c.preview.packet.coordinateSystem,'right-handed-y-up');
 assert.equal(c.adapterBasis,'authored-xyz-despite-original-y-up-label');assert.equal(c.preview.report.solid,false);assert.equal(c.preview.report.native.solid,false);
 const g=scene.scene.geometries[0];assert.equal(g.positions.length,294);assert.equal(g.indices.length,192);assert.deepEqual(g.indices,baseline.preview.packet.indices);assert.deepEqual(g.uvs,baseline.preview.packet.parameters);
 for(let i=0;i<98;i++){const xyz=baseline.preview.packet.positions.slice(i*3,i*3+3),n=baseline.preview.packet.normals.slice(i*3,i*3+3);
  assert.deepEqual(g.positions.slice(i*3,i*3+3),[xyz[0],xyz[2],-xyz[1]]);assert.deepEqual(g.normals.slice(i*3,i*3+3),[n[0],n[2],-n[1]]);}
 for(const [i,chunk]of c.mesh.chunks.entries()){const reference={...c.mesh.context,faceToken:chunk.faceToken,nativeFaceId:chunk.nativeFaceId},binding=api.resolveModelingFaceReference(scene,reference);
  assert.deepEqual(binding.vertexRange,c.preview.faceRanges[i].vertexRange);assert.deepEqual(binding.indexRange,c.preview.faceRanges[i].indexRange);
  for(const key of Object.keys(reference))assert.equal(api.resolveModelingFaceReference(scene,{...reference,[key]:'stale'}),null);}
 const ray=(x,y,z,dx,dy,dz)=>({format:'barocss-gpu-engine-ray',version:0,coordinateSystem:'right-handed-y-up',positionUnit:'scene',origin:[x,y,z],direction:[dx,dy,dz],near:0,far:200});
 const faceFor=hit=>c.preview.faceRanges.find(f=>hit.triangleIndex*3>=f.indexRange[0]&&hit.triangleIndex*3<f.indexRange[1]);
 const top=api.raycastEngineScene(scene.scene,ray(2,30,3,0,-1,0)),bottom=api.raycastEngineScene(scene.scene,ray(2,-30,3,0,1,0));
 assert.ok(top);assert.ok(bottom);assert.equal(faceFor(top).role,'top-cap');assert.equal(faceFor(bottom).role,'bottom-cap');
 assert.ok(Math.abs(top.point[1]-6)<1e-10);assert.ok(Math.abs(bottom.point[1])<1e-10);assert.ok(top.normal[1]>.999);assert.ok(bottom.normal[1]<-.999);
 assert.equal(api.raycastEngineScene(scene.scene,ray(5.9,30,-.9,0,-1,0)),null,'supporting-square corner is outside sampled disk');
 for(const [x,z,dx,dz]of [[30,3,-1,0],[-30,3,1,0],[2,30,0,-1],[2,-30,0,1]]){const hit=api.raycastEngineScene(scene.scene,ray(x,3,z,dx,0,dz));assert.ok(hit);assert.equal(faceFor(hit).role,'wall');}
 let picked;for(let y=8;y<192&&!picked;y+=8)for(let x=8;x<192&&!picked;x+=8)picked=api.pickModelingScene(scene,200,200,x,y);
 assert.ok(picked);assert.equal(picked.family,'stored-rational-circle-prism');assert.equal(picked.approximate,true);assert.equal(picked.provenance.faceId,picked.reference.nativeFaceId);
 assert.deepEqual(picked.lineage.topology,native.parent.bundle.topology);assert.throws(()=>api.resolveModelingFaceReference(structuredClone(scene),picked.reference),/original accepted/);
 assert.throws(()=>api.pickModelingScene(structuredClone(scene),200,200,100,100),/original accepted/);
 const changes=[
  ['coordinated collapsed cap UVs',c=>{
   const before=structuredClone(c);
   for(let i=0;i<2;i++){
    const range=c.preview.faceRanges[i],center=range.capSampling.centerUV;
    c.preview.edgeProvenance[i].uses[0].sampledUVs=c.preview.edgeProvenance[i].uses[0].sampledUVs.map(()=>[...center]);
    for(let v=range.vertexRange[0];v<range.vertexRange[1];v++)c.preview.packet.parameters.splice(v*2,2,...center);
    c.mesh.chunks[i].parametersUV=c.preview.packet.parameters.slice(range.vertexRange[0]*2,range.vertexRange[1]*2);
   }
   for(const key of ['positions','normals','indices'])assert.deepEqual(c.preview.packet[key],before.preview.packet[key]);
   assert.deepEqual(c.qualification,before.qualification);assert.deepEqual(c.lineage,before.lineage);
   assert.deepEqual(c.preview.faceRanges,before.preview.faceRanges);
  }],
  ['mesh/native ID collision',c=>{c.preview.packet.surfaceId=c.preview.report.meshId=c.solidId;}],
  ['copied endpoint-germ cycle',c=>c.qualification.vertexLinks[0].cycle.reverse()],
  ['reordered ranges',c=>c.preview.faceRanges.reverse()],['gapped vertex ranges',c=>c.preview.faceRanges[1].vertexRange[0]++],
  ['overlapping vertex ranges',c=>c.preview.faceRanges[1].vertexRange[0]--],['gapped index ranges',c=>c.preview.faceRanges[1].indexRange[0]+=3],
  ['missing face',c=>c.preview.faceRanges.pop()],['cross-face index',c=>c.preview.packet.indices[0]=17],['reversed cap triangle',c=>c.preview.packet.indices.splice(0,3,0,1,2)],
  ['degenerate triangle',c=>c.preview.packet.indices[1]=0],['wall index order',c=>c.preview.packet.indices.splice(96,6,34,36,35,35,36,37)],
  ['changed cap UV',c=>c.preview.packet.parameters[2]+=.125],['changed retained cap sampled UV',c=>c.preview.edgeProvenance[0].uses[0].sampledUVs[1][0]+=.01],
  ['changed cap center UV',c=>c.preview.faceRanges[0].capSampling.centerUV[0]+=.1],['changed wall UV',c=>c.preview.packet.parameters[68]=.25],
  ['changed wall panel order',c=>c.preview.faceRanges[2].wallPanels.reverse()],['changed wall panel normal',c=>c.preview.faceRanges[2].wallPanels[0].normal[0]*=-1],
  ['changed actual normal',c=>c.preview.packet.normals[2]=1],['missing ring endpoint',c=>c.preview.edgePaths[0].points.pop()],['missing ring',c=>c.preview.edgePaths.splice(1,1)],
  ['missing seam use',c=>c.preview.edgeProvenance[2].uses.pop()],['same seam sense',c=>c.preview.edgeProvenance[2].uses[1].sense='forward'],
  ['wrong seam face',c=>c.preview.edgeProvenance[2].uses[1].faceId=c.lineage.topology.faces[0].id],['changed seam UV',c=>c.preview.edgeProvenance[2].uses[1].sampledUVs[0][0]=4],
  ['missing native loop use',c=>c.lineage.topology.loops[2].uses.pop()],['native surface mismatch',c=>c.lineage.topology.faces[0].surfaceId='wrong'],
  ['native Source0 model identity',c=>c.lineage.source.modelId='wrong'],['missing native source object',c=>c.lineage.source.objectIds.pop()],
  ['native report flags',c=>c.preview.report.native.solid=true],['sampled report flags',c=>c.preview.report.topologyCertified=true],
  ['qualification flags',c=>c.qualification.solid=false],['invented certified volume',c=>c.qualification.volumeMM3={numerator:'1',denominator:'1'}],
  ['qualification native ID',c=>c.qualification.wallProof.seamEdgeId='wrong'],['changed packet bound',c=>c.preview.packet.bounds.max[2]++],
  ['changed report bound',c=>c.preview.report.boundsMM.min[1]--],['changed sampled area',c=>c.preview.report.areasMM2.wall++],
  ['changed source domain',c=>c.preview.report.native.domains.wallSurface.u[1]=5],['changed face domain',c=>c.preview.faceRanges[2].domain.u[1]=5],
  ['changed original label',c=>c.preview.packet.coordinateSystem='part-xyz'],['wrong adapter basis',c=>c.adapterBasis='right-handed-y-up'],
  ['double rotation',c=>{for(const chunk of c.mesh.chunks){chunk.positionsMM=chunk.positionsMM.flatMap((v,i,a)=>i%3?[]:[v,a[i+2],-a[i+1]]);}}],
  ['missing raw chunk',c=>c.mesh.chunks.pop()],['raw UV laundering',c=>c.mesh.chunks[0].parametersUV.fill(0)],['raw winding repair',c=>c.mesh.chunks[0].indices.reverse()],
  ['raw face ID',c=>c.mesh.chunks[0].nativeFaceId='wrong'],['native frame',c=>c.mesh.nativeFrame='right-handed-y-up'],
  ['stale context',c=>c.mesh.context.taskToken='stale'],['wrong context body',c=>c.mesh.context.bodyId='wrong'],['stale preview revision',c=>c.preview.packet.revision++],
  ['family laundering',c=>c.family='stored-rational-plate-hole'],['missing native certificate proof',c=>c.qualification.vertexLinks.pop()],
 ];
 for(const [name,mutate]of changes){const invalid=structuredClone(packet);mutate(invalid.components[0]);assert.throws(()=>api.prepareModelingScene(invalid,1,'post'),undefined,name);}
 const hidden=structuredClone(packet);hidden.components.push(component('hidden'));hidden.outcomes.push({role:'hidden',solidId:c.solidId,family:c.family,status:'solid'});
 assert.equal(api.prepareModelingScene(hidden).selectedOutput,'hidden');assert.equal(api.prepareModelingScene(hidden,1,'post').selectedOutput,'post');
 hidden.components[1].preview.edgeProvenance[2].uses.pop();assert.throws(()=>api.prepareModelingScene(hidden,1,'post'),'hidden invalid output must refuse');
 let getterCalls=0;const getter=structuredClone(packet);Object.defineProperty(getter.components[0].preview.packet,'positions',{enumerable:true,get(){getterCalls++;return[];}});
 assert.throws(()=>api.prepareModelingScene(getter));assert.equal(getterCalls,0);
 const badNative=structuredClone(native);badNative.parent.bundle.topology.loops[2].uses.pop();assert.throws(()=>api.preflightModelingCircle(badNative));
 const nativeGetter={};Object.defineProperty(nativeGetter,'parent',{enumerable:true,get(){getterCalls++;return native.parent;}});assert.throws(()=>api.preflightModelingCircle(nativeGetter));assert.equal(getterCalls,0);
 const result={ok:true,transferBytes:bytes.length,transferSHA256:sha256,bodySHA256:baseline.bodySHA256,vertices:98,triangles:64,faces:3,
 closedRingPaths:2,sameWallOppositeSeamUses:2,malformed:changes.length+2,coordinatedCapUVMutationRejection:true,axisConversions:1,consumerNativeCalls:0,
 rays:['top cap center','bottom cap center','outside sampled disk miss','four wall directions'],
 scope:'Genuine fixed-k4 baseline CPU array/provenance/raycast replay with display-only context metadata updates; no changed-state native sampling, browser, GPU pixels or physical Save/Open'};
 writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
