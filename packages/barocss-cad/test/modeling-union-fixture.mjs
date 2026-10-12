import assert from 'node:assert/strict';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';
import { nativeBodyHash } from './modeling-hole-fixture.mjs';
import { prove } from './modeling-intersection-fixture.mjs';
export { nativeBodyHash };
export function unionBracket(cad) {
 const model=cad.model(),legMinX=model.parameter('legMinX',-0),legMinY=model.parameter('legMinY',-0),legWidth=model.parameter('legWidth',8),legHeight=model.parameter('legHeight',8);
 const base=model.sketch.rectangle({width:32,height:8}).extrude(8);
 const leg=model.sketch.rectangle({min:[legMinX,legMinY],max:[model.dimension.add(legMinX,legWidth),24]}).extrude(legHeight);
 const bracket=base.union(leg);return{model,base,leg,bracket,build:()=>model.build({base,leg,bracket})};
}
export function work(snapshot,reused,evaluated,previous) {
 assert.deepEqual(snapshot.recomputation,{reusedFeatures:reused,evaluatedFeatures:evaluated});
 assert.deepEqual([...reused,...evaluated],[0,1,2,3,4]);deepFrozen(snapshot);
 assert.deepEqual(snapshot.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['sketch',[]],['extrude',[2]],['union',[1,3]]]);
 if(previous){
  for(const i of reused)assert.equal(snapshot.evidence[i],previous.evidence[i]);
  for(const i of evaluated)assert.notEqual(snapshot.evidence[i],previous.evidence[i]);
  for(const [name,index] of [['base',1],['leg',3],['bracket',4]])if(reused.includes(index)){
   assert.equal(snapshot.bodies[name],previous.bodies[name]);assert.equal(snapshot.bodies[name].native,previous.bodies[name].native);
  }
 }
}
export function proveNative(native,volume,panels,bodyCount=1) {
 const r=native.report;assert.equal(r.operation,'union');assert.equal(r.geometryFamily,'exact-integer-orthogonal-cell-solid-v0');
 assert.equal(r.bodyCount,bodyCount);assert.equal(native.bodies.length,bodyCount);assert.equal(r.solid,true);assert.equal(r.empty,false);
 assert.equal(r.volumeMM3,volume);assert.equal(native.bodies.reduce((n,b)=>n+b.volumeMM3,0),volume);
 assert.equal(native.cells.filter(c=>c.occupied).reduce((n,c)=>n+c.volumeMM3,0),volume);
 assert.equal(native.shells.reduce((n,s)=>n+s.signedVolumeMM3,0),volume);
 assert.equal(r.panelCount,panels);assert.equal(native.panels.length,panels);assert.equal(native.sources.length,panels);
 assert.equal(r.quality.restrictedCellModelEmbeddingCertified,true);assert.equal(r.quality.restrictedBoundaryManifoldCertified,true);
 assert.equal(r.quality.arbitraryCurvedSolidCertified,false);assert.equal(r.quality.manufacturingToleranceCertified,false);assert.equal(r.quality.weldingPerformed,false);
 assert.equal(r.workScope,'direct-root-calls-inherited-provider-work-excluded');
 assert.deepEqual(r.directCounts,{originalSourceCompilationCount:2,operandSolidValidationCount:2,faceBuildCount:panels,outputSourceCompilationCount:panels,
  curvePointEvaluationCount:12*panels,curveDerivativeEvaluationCount:12*panels,surfacePointEvaluationCount:3*panels,surfaceDerivativeEvaluationCount:3*panels,observationCount:15*panels});
 assert.equal(native.observations.length,15*panels);assert.equal(r.incidence.everyEdgeTwoOppositeUses,true);assert.equal(r.incidence.orientedVertexLinksSingleCycles,true);
 for(const edge of native.edges){assert.equal(edge.uses.length,2);assert.notEqual(edge.uses[0].sense,edge.uses[1].sense);}
 for(const vertex of native.vertices){assert.equal(new Set(vertex.link.cycleEdgeIds).size,vertex.link.edgeIds.length);assert.ok(vertex.link.degrees.every(d=>d.degree===2));}
 for(const [i,asset] of [native.a,native.b].entries()){
  assert.equal(asset.sourceVersion,0);assert.equal(asset.shell.faces.length,6);assert.equal(native.originalModels[i].objects.length,6);
  assert.ok(asset.source.includes('@model '+native.originalModels[i].name));assert.equal(native.operandReports[i].solid,true);
  const binding=r.operandBindings[i];assert.equal(binding.sourceId,asset.sourceId);assert.equal(binding.shellId,asset.shell.id);assert.equal(binding.faces.length,6);
  for(const [j,face] of asset.shell.faces.entries()){
   const surface=face.bundle.geometry.objects[0];assert.deepEqual(surface,native.originalModels[i].objects[j]);
   assert.ok(asset.source.includes('@surface #'+surface.id));assert.equal(binding.faces[j].globalFaceId,face.id);
   assert.equal(binding.faces[j].localFaceId,face.bundle.topology.face.id);assert.equal(binding.faces[j].surfaceId,surface.id);
  }
 }
 for(const panel of native.panels){
  const source=native.sources.find(s=>s.sourceId===panel.sourceId);assert.ok(source);assert.equal(source.panelId,panel.id);
  assert.deepEqual(source.model,panel.bundle.geometry);assert.equal(source.model.objects.length,5);assert.equal(panel.bundle.topology.face.orientation,'forward');
  assert.ok(native.bodies.some(b=>b.id===panel.bodyId));assert.ok(native.shells.some(s=>s.bodyId===panel.bodyId&&s.panelIds.includes(panel.id)));
  assert.ok(panel.lineage.length>0);
  for(const lineage of panel.lineage){
   const asset=native[lineage.operand],face=asset.shell.faces.find(f=>f.id===lineage.globalFaceId);assert.ok(face);
   assert.equal(lineage.sourceId,asset.sourceId);assert.equal(lineage.shellId,asset.shell.id);
   assert.equal(lineage.localFaceId,face.bundle.topology.face.id);assert.equal(lineage.surfaceId,face.bundle.geometry.objects[0].id);
   assert.ok(lineage.relativeOrientation===1||lineage.relativeOrientation===-1);
   for(const uv of lineage.uvCorners)for(const ratio of uv){assert.ok(BigInt(ratio.denominator)>0n);assert.ok(BigInt(ratio.numerator)>=0n&&BigInt(ratio.numerator)<=BigInt(ratio.denominator));}
  }
 }
 return{volumeMM3:volume,bodyCount,occupiedCells:r.occupiedCellCount,panels,sourceCount:r.sourceCount,report:r};
}
export function proveBracket(snapshot,volume,panels) {
 assert.deepEqual(Object.keys(snapshot.bodies).sort(),['base','bracket','leg']);
 assert.deepEqual(Object.keys(snapshot.parameters).sort(),['legHeight','legMinX','legMinY','legWidth']);
 const {base,leg,bracket}=snapshot.bodies,p=snapshot.parameters;
 assert.equal(base.family,'convex-planar');assert.equal(leg.family,'convex-planar');assert.equal(bracket.family,'orthogonal-cell');
 assert.equal(base.native,snapshot.evidence[1].native.solid);assert.equal(leg.native,snapshot.evidence[3].native.solid);
 prove(base.native,2048);prove(leg.native,p.legWidth*(24-p.legMinY)*p.legHeight);
 const feature=snapshot.evidence[4];assert.equal(feature.kind,'union');assert.equal(feature.parents[0],base.native);assert.equal(feature.parents[1],leg.native);assert.equal(feature.native,bracket.native);
 const result=proveNative(bracket.native,volume,panels);
 assert.deepEqual(bracket.native.a.shell.origin,[0,0,0]);assert.deepEqual(bracket.native.a.shell.sides,[32,8,8]);
 assert.deepEqual(bracket.native.b.shell.origin,[p.legMinX,p.legMinY,0]);assert.deepEqual(bracket.native.b.shell.sides,[p.legWidth,24-p.legMinY,p.legHeight]);
 if(Object.is(p.legMinX,-0)||Object.is(p.legMinY,-0))assert.ok(bracket.native.b.source.includes('-0'));
 const originalFaces=[base.native,leg.native].flatMap(n=>n.graph.faces);assert.equal(originalFaces.length,12);
 const originalIDs=new Set(originalFaces.map(f=>f.faceId));assert.equal(originalIDs.size,12);assert.ok([...originalIDs].every(id=>typeof id==='string'&&id.length>0));
 const originalSources=new Set(originalFaces.map(f=>f.sourceId));assert.ok([...originalSources].every(id=>typeof id==='string'&&id.length>0));
 for(const asset of [bracket.native.a,bracket.native.b]){
  assert.equal(originalSources.has(asset.sourceId),false);
  for(const face of asset.shell.faces){assert.equal(originalIDs.has(face.id),false);assert.equal(originalIDs.has(face.bundle.topology.face.id),false);}
 }
 const actualPrisms=snapshot.recomputation.evaluatedFeatures.filter(i=>snapshot.evidence[i].kind==='extrude').map(i=>{
  const native=snapshot.evidence[i].native;assert.deepEqual(native.report.childNativeWork,{sketchReconstructionCount:1,initialFaceConstructionCount:6,solidQualificationCount:1,solidFaceReconstructionCount:6,sourceCompilationCount:13,bindingObservationCount:144,totalD1Count:432,retries:0});
  return{index:i,report:native.report.childNativeWork};
 });
 return{...result,prismReportsForEvaluatedFeatures:actualPrisms,newBoxRepresentation:'whole-source-six-native-faces-qualified-shells',originalConvexIdentity:true};
}
export function proveBuffers(native,buffers) {
 assert.deepEqual(buffers.native,native);assert.equal(buffers.report.nativeValidationCalls,1);assert.equal(buffers.report.tessellateSurfaceCalls,14);
 // This field excludes work inside the native validator; do not treat it as total compilation work.
 assert.equal(buffers.report.sourceCompilationCalls,0);assert.equal(buffers.panels.length,14);assert.equal(buffers.report.vertexCount,56);assert.equal(buffers.report.triangleCount,28);
 assert.equal(buffers.positions.length,168);assert.equal(buffers.normals.length,168);assert.equal(buffers.indices.length,84);
 assert.equal(buffers.coordinateSystem,'right-handed-y-up');assert.equal(buffers.options.basis,'authored-xyz-matches-rhyup');
 for(const [i,range] of buffers.panels.entries()){
  const panel=native.panels[i];assert.equal(range.panelId,panel.id);assert.deepEqual(range.lineage,panel.lineage);
  assert.equal(range.vertexOffset,i*4);assert.equal(range.indexOffset,i*6);
  for(let j=0;j<4;j++){
   const vertex=native.vertices.find(v=>v.id===range.nativeVertexIdsInBufferOrder[j]);assert.ok(vertex);
   for(let axis=0;axis<3;axis++){
    assert.equal(buffers.positions[(i*4+j)*3+axis],vertex.pointMM[axis]);
    assert.equal(buffers.normals[(i*4+j)*3+axis],axis===panel.axis?panel.sign:0);
   }
  }
 }
 return{report:buffers.report,scope:'complete CPU buffers only; no renderer or browser run',nativeValidationIncludesFullBooleanRebuild:true};
}
