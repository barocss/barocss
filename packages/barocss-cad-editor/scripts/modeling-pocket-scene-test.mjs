// Adapted retained CPU baseline only. No native validation, sampling, browser or GPU work.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
export const root=resolve(import.meta.dirname,'../../..'), output=resolve(process.env.EVIDENCE_DIR??'/tmp/cad-1653-pocket-scene');mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.REPO_DEPS_ROOT??root,'package.json'));
const gpu=resolve(output,'gpu-entry.ts');writeFileSync(gpu,['engine-scene','engine-camera-ray','engine-raycast','kernel-face-preview'].map(n=>`export * from ${JSON.stringify(resolve(root,'packages/barocss-gpu/src/'+n+'.ts'))};`).join('\n'));
globalThis.__unionProjectionValidationStubs=0;
const entry=`export * from '${resolve(root,'packages/barocss-cad-editor/src/modeling-union.ts')}';export * from '${resolve(root,'packages/barocss-cad-editor/src/modeling-scene.ts')}';export * from '${resolve(root,'packages/barocss-cad-editor/src/modeling-controller.ts')}';export {raycastEngineScene} from '${gpu}';export {tessellateConvexPlanarSolid} from '${resolve(root,'packages/barocss-cad/src/convex-planar-solid-mesh.ts')}';`;
const bundle=await require('esbuild').build({stdin:{contents:entry,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,alias:{'@barocss/gpu':gpu},
 plugins:[{name:'explicit-convex-validation-stub',setup(build){build.onResolve({filter:/\/convex-planar-solid\.js$/},()=>({path:'validator',namespace:'stub'}));build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export function validateConvexPlanarSolid(s){globalThis.__unionProjectionValidationStubs++;return s.report;}'}));}}]});
writeFileSync(resolve(output,'scene.mjs'),bundle.outputFiles[0].text);export const api=await import(pathToFileURL(resolve(output,'scene.mjs')));
export const bytes=readFileSync(resolve(import.meta.dirname,'fixtures/modeling-pocket/baseline-native.json'));
export const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(bytes.length,1145275);assert.equal(sha256,'757f1344db56b48a31ffadceb8d1f5fd2b3b2eeb5bfe01ac160b3f7786f723b5');
export const baseline=JSON.parse(bytes),native=baseline.bodies.part.native;
assert.deepEqual(baseline.buffers.native,native);assert.deepEqual(baseline.buffers.options,{basis:'authored-xyz-matches-rhyup',mmToSceneUnit:1,translate:[0,0,0]});
assert.equal(baseline.buffers.report.nativeValidationCalls,1);assert.equal(baseline.buffers.report.tessellateSurfaceCalls,46);
// The original UV arrays were not retained. Copy actual incident native pcurve coefficients.
export const windowTransfer=JSON.parse(readFileSync(resolve(import.meta.dirname,'fixtures/modeling-pocket/window-native.json')));
export function replayPanel(surface,options,transfer=baseline){
 const native=transfer.bodies.part.native;
 const i=native.panels.findIndex(p=>p.bundle.topology.face.surfaceId===surface.id);assert.ok(i>=0);
 const p=native.panels[i],range=transfer.buffers?.panels[i],source=native.sources.find(s=>s.sourceId===p.sourceId);
 assert.deepEqual(surface,source.model.objects.find(o=>o.kind==='surface'));assert.equal(options.countU,2);assert.equal(options.countV,2);
 if(!transfer.buffers){const positions=[0,3,1,2].flatMap(j=>p.bundle.topology.vertices[j].point),normals=Array.from({length:4},()=>[0,1,2].map(a=>a===p.axis?p.sign:0)).flat();return{packet:{positions,normals,parameters:api.modelingUnionPanelUV(p.bundle.topology),indices:[0,2,1,2,3,1]}};}
 assert.equal(range.panelId,p.id);assert.equal(range.vertexOffset,i*4);assert.equal(range.indexOffset,i*6);
 const uv=new Map();for(const use of p.bundle.topology.loop.uses){const edge=p.bundle.topology.edges.find(e=>e.id===use.edgeId);assert.equal(use.sense,'forward');
  for(const [j,value] of [use.pcurve.uv0,use.pcurve.uv1].entries()){if(uv.has(edge.vertexIds[j]))assert.deepEqual(uv.get(edge.vertexIds[j]),value);uv.set(edge.vertexIds[j],value);}}
 const positions=baseline.buffers.positions.slice(i*12,i*12+12),normals=baseline.buffers.normals.slice(i*12,i*12+12),indices=baseline.buffers.indices.slice(i*6,i*6+6).map(x=>x-i*4);
 const parameters=[];
 for(const [j,key] of range.nativeVertexIdsInBufferOrder.entries()){
  const global=native.vertices.find(v=>v.id===key),local=p.bundle.topology.vertices.find(v=>v.point.every((n,a)=>Object.is(n,global.pointMM[a])));
  assert.ok(local);assert.deepEqual(positions.slice(j*3,j*3+3),global.pointMM);assert.deepEqual(normals.slice(j*3,j*3+3),[0,1,2].map(a=>a===p.axis?p.sign:0));parameters.push(...uv.get(local.id));}
 assert.deepEqual(parameters,[0,0,0,1,1,0,1,1]);assert.deepEqual(indices,[0,2,1,2,3,1]);return{packet:{positions,normals,parameters,indices}};
}
export function convex(name,transfer=baseline){const body=transfer.bodies[name].native,mesh=api.tessellateConvexPlanarSolid(body,{maximumFanTriangles:40});
 return{role:name,...Object.fromEntries(['mesh','boundaries','internalDiagonals','report'].map(k=>[k,mesh[k]])),lineage:{kind:'model-output',name,solidId:body.report.solidId,
 graph:{vertices:structuredClone(body.graph.vertices),faces:structuredClone(body.graph.faces),edges:body.graph.edges.map(({id,vertexIds,uses})=>structuredClone({id,vertexIds,uses}))}}};}
export function reply(revision=0,taskToken='pocket_context',text=baseline.text,transfer=baseline){const data=JSON.parse(text),names=Object.keys(data.outputs),native=transfer.bodies.part.native;
 const components=names.map(name=>data.nodes[data.outputs[name].node].kind==='difference'?api.projectModelingUnion(native,name,{documentId:'cad_model',bodyId:native.bodies[0].id,
 documentRevision:String(revision),kernelResultRevision:String(revision),topologyRevision:String(revision),taskToken},(surface,options)=>replayPanel(surface,options,transfer),'difference'):{family:'convex-planar',component:convex(data.outputs[name].node===1?'plate':'tool',transfer)});
 const outcomes=components.map((c,i)=>({role:names[i],solidId:c.family==='orthogonal-cell'?c.solidId:c.component.report.solidId,family:c.family,status:'solid'}));
 return{ok:true,text,display:{profile:'model-body-faces',documentId:'cad_model',revision,taskToken,components,outcomes},summary:{documentId:'cad_model',revision,source:'model',parameters:data.parameters,
 features:structuredClone(transfer.features),outputs:outcomes.map(o=>({name:o.role,solidId:o.solidId,family:o.family,volumeMM3:o.family==='orthogonal-cell'?{numerator:String(native.report.volumeMM3),denominator:'1'}:{...transfer.bodies[o.role].native.certificate.volumeMM3}}))}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const original=reply(),packet=original.display,scene=api.prepareModelingScene(packet,1,'part'),component=packet.components[0];
 assert.equal(scene.scene.geometries.length,1);assert.equal(scene.scene.geometries[0].positions.length,552);assert.equal(scene.scene.geometries[0].indices.length,276);
 assert.deepEqual(component.mesh.chunks.flatMap(c=>c.positionsMM),baseline.buffers.positions);assert.equal(component.lineage.panels.length,46);
 for(const [i,p] of component.lineage.panels.entries()){assert.deepEqual(p.lineage,native.panels[i].lineage);assert.deepEqual(p.topology,native.panels[i].bundle.topology);
  const reference={...component.mesh.context,faceToken:p.id,nativeFaceId:p.id};assert.deepEqual(api.resolveModelingFaceReference(scene,reference).vertexRange,[i*4,i*4+4]);
  for(const key of Object.keys(reference))assert.equal(api.resolveModelingFaceReference(scene,{...reference,[key]:'stale'}),null);}
 const g=scene.scene.geometries[0];for(let i=0;i<184;i++)assert.deepEqual(g.positions.slice(i*3,i*3+3),[baseline.buffers.positions[i*3],baseline.buffers.positions[i*3+2],-baseline.buffers.positions[i*3+1]]);
 const ray=(x,y,z,dx,dy,dz)=>({format:'barocss-gpu-engine-ray',version:0,coordinateSystem:'right-handed-y-up',positionUnit:'scene',origin:[x,y,z],direction:[dx,dy,dz],near:0,far:200});
 const below=api.raycastEngineScene(scene.scene,ray(16,-10,-12,0,1,0));assert.ok(below);assert.equal(below.point[1],4);assert.deepEqual(below.normal,[0,-1,0]);
 const top=api.raycastEngineScene(scene.scene,ray(16,100,-12,0,-1,0));assert.ok(top);assert.equal(top.point[1],8);assert.deepEqual(top.normal,[0,1,0]);
 const inner=api.raycastEngineScene(scene.scene,ray(16,2,-12,-1,0,0));assert.ok(inner);assert.equal(inner.point[0],8);assert.deepEqual(inner.normal,[1,0,0]);
 const windowScene=api.prepareModelingScene(reply(0,'window_context',windowTransfer.text,windowTransfer).display,1,'part');
 for(const [y,dy] of [[-10,1],[100,-1]])assert.equal(api.raycastEngineScene(windowScene.scene,ray(16,y,-12,0,dy,0)),null,'through-window center stays open');
 const rim=api.raycastEngineScene(windowScene.scene,ray(4,100,-4,0,-1,0));assert.ok(rim);assert.equal(rim.point[1],8);
 let picked;for(let y=8;y<192&&!picked;y+=8)for(let x=8;x<192&&!picked;x+=8)picked=api.pickModelingScene(scene,200,200,x,y);
 assert.ok(picked);assert.equal(picked.family,'orthogonal-cell');assert.ok(picked.provenance.lineage.length);assert.equal(picked.approximate,true);
 assert.throws(()=>api.resolveModelingFaceReference(structuredClone(scene),picked.reference),/original accepted/);
 const changes=[c=>c.mesh.chunks.pop(),c=>c.lineage.panels.pop(),c=>c.lineage.panels.push(structuredClone(c.lineage.panels[0])),c=>c.lineage.panels[1].id=c.lineage.panels[0].id,
 c=>c.qualification.operation='union',c=>c.qualification.panelCount++,c=>c.qualification.volumeMM3++,c=>c.qualification.volumeMM3=0,c=>c.qualification.volumeMM3=.5,c=>c.qualification.volumeMM3=Number.MAX_SAFE_INTEGER+1,
 c=>c.lineage.body.id='wrong',c=>c.lineage.body.volumeMM3++,c=>c.lineage.cells[0].volumeMM3++,c=>c.lineage.cells[0].occupied=false,c=>c.lineage.shells[0].signedVolumeMM3++,
 c=>c.lineage.panels[0].query.sourceId='wrong',c=>c.lineage.panels[0].query.surfaceId='wrong',c=>c.lineage.panels[0].vertexIds.reverse(),c=>c.lineage.panels[0].edgeIds.pop(),
 c=>c.lineage.panels[0].lineage.pop(),c=>c.lineage.panels[0].lineage[0].sourceId='wrong',c=>c.lineage.panels[0].lineage[0].uvCorners[0][0].numerator='1',
 c=>c.mesh.chunks[0].parametersUV[0]=.5,c=>c.mesh.chunks[0].indices=[0,1,2,2,1,3],c=>c.mesh.chunks[0].normals[0]*=-1,c=>c.mesh.chunks[0].positionsMM[0]++,
 c=>c.mesh.nativeFrame='right-handed-y-up',c=>c.mesh.context.taskToken='stale',c=>c.mesh.context.bodyId='wrong',c=>c.qualification.quality.manufacturingToleranceCertified=true,
 c=>c.lineage.body.boundsMM.max[0]++,c=>c.lineage.shells[0].areaMM2++,c=>c.lineage.shells[0].panelIds.pop(),c=>c.lineage.shells[0].edgeIds.pop(),c=>c.lineage.shells[0].vertexIds.pop(),c=>c.lineage.shells[0].eulerCharacteristic++,
 c=>c.lineage.panels[0].topology.loop.uses[0].boundary='u-max',c=>c.lineage.panels[0].topology.edges[0].vertexIds.reverse(),c=>c.lineage.panels[0].lineage[0].relativeOrientation*=-1,
 c=>c.lineage.edges[0].canonical.curveId='wrong',c=>c.lineage.edges[0].vertexIds.reverse(),c=>c.lineage.operands[0].origin[0]++,c=>c.lineage.operands[0].faces[0].query.sourceId='wrong',c=>c.lineage.edges[0].uses[0].sourceId='wrong'];
 const nativeCycleControls=[
  ['collapsed UV endpoints and matching mesh UV',c=>{for(const use of c.lineage.panels[0].topology.loop.uses){use.boundary='u-min';use.pcurve.uv0=[0,0];use.pcurve.uv1=[0,0];}c.mesh.chunks[0].parametersUV=Array(8).fill(0);}],
  ['reversed native loop uses',c=>c.lineage.panels[0].topology.loop.uses.reverse()],
  ['rotated native loop uses',c=>{const uses=c.lineage.panels[0].topology.loop.uses;uses.push(uses.shift());}],
 ];
 const acceptedMalformed=[];for(const [name,mutate] of nativeCycleControls){const p=structuredClone(packet);mutate(p.components[0]);
  try{api.prepareModelingScene(p,1,'part');acceptedMalformed.push(name);}catch{ /* expected receiving refusal */ }}
 assert.deepEqual(acceptedMalformed,[],'native UV/cycle tampering must be refused');
 let malformed=nativeCycleControls.length;for(const mutate of changes){const p=structuredClone(packet);mutate(p.components[0]);assert.throws(()=>api.prepareModelingScene(p,1,'part'));malformed++;}
 const hidden=structuredClone(packet);hidden.components[2].component.mesh.positionsMM[0]++;assert.throws(()=>api.prepareModelingScene(hidden,1,'part'));malformed++;
 const result={ok:true,malformed,nativeCycleControls:nativeCycleControls.map(([name])=>name),panels:46,vertices:184,triangles:92,windowPanels:32,transferBytes:bytes.length,transferSHA256:sha256,consumerNativeCalls:0,axisConversions:1,
  pocketGeometry:'retained actual helper arrays validated against native identity/order, adapted raw packet; UV restored from exact native pcurve coefficients',
  operands:'actual fan algorithm over recorded parents with native validator explicitly stubbed',convexValidationStubs:globalThis.__unionProjectionValidationStubs,
  windowGeometry:'native-only topology-derived projection, not measured tessellation',
  scope:'CPU geometry admission/raycast and receiving authority; no actual browser/GPU or physical files'};
 writeFileSync(resolve(output,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
