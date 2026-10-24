import assert from 'node:assert/strict';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';
import { nativeBodyHash } from './modeling-hole-fixture.mjs';
import { prove } from './modeling-intersection-fixture.mjs';
export { nativeBodyHash };
export function recessedPlate(cad) {
 const model=cad.model(),toolX=model.parameter('toolX',8),toolY=model.parameter('toolY',8),toolWidth=model.parameter('toolWidth',16),toolSpanY=model.parameter('toolSpanY',8),depth=model.parameter('depth',4);
 const plate=model.sketch.rectangle({min:[-0,0],max:[32,24]}).extrude(8);
 const tool=model.sketch.rectangle({min:[toolX,toolY],max:[model.dimension.add(toolX,toolWidth),model.dimension.add(toolY,toolSpanY)]}).extrude(depth);
 const part=plate.cut(tool);return{model,plate,tool,part,build:()=>model.build({plate,tool,part})};
}
export function work(snapshot,reused,evaluated,previous) {
 assert.deepEqual(snapshot.recomputation,{reusedFeatures:reused,evaluatedFeatures:evaluated});
 assert.deepEqual([...reused,...evaluated],[0,1,2,3,4]);deepFrozen(snapshot);
 assert.deepEqual(snapshot.features.map(f=>[f.kind,f.dependencies]),[['sketch',[]],['extrude',[0]],['sketch',[]],['extrude',[2]],['difference',[1,3]]]);
 if(previous){
  for(const i of reused)assert.equal(snapshot.evidence[i],previous.evidence[i]);
  for(const i of evaluated)assert.notEqual(snapshot.evidence[i],previous.evidence[i]);
  for(const [name,index] of [['plate',1],['tool',3],['part',4]])if(reused.includes(index)){
   assert.equal(snapshot.bodies[name],previous.bodies[name]);assert.equal(snapshot.bodies[name].native,previous.bodies[name].native);
  }
 }
}
export function proveNative(native,volume,panels,bodyCount=1) {
 const r=native.report;assert.equal(r.operation,'difference');assert.equal(r.geometryFamily,'exact-integer-orthogonal-cell-solid-v0');
 assert.equal(r.bodyCount,bodyCount);assert.equal(native.bodies.length,bodyCount);assert.equal(r.solid,bodyCount>0);assert.equal(r.empty,bodyCount===0);
 assert.equal(r.volumeMM3,volume);assert.equal(native.bodies.reduce((n,b)=>n+b.volumeMM3,0),volume);
 assert.equal(native.cells.filter(c=>c.occupied).reduce((n,c)=>n+c.volumeMM3,0),volume);
 assert.equal(native.shells.reduce((n,s)=>n+s.signedVolumeMM3,0),volume);
 assert.equal(r.panelCount,panels);assert.equal(native.panels.length,panels);assert.equal(native.sources.length,panels);
 assert.equal(r.quality.restrictedCellModelEmbeddingCertified,bodyCount>0);assert.equal(r.quality.restrictedBoundaryManifoldCertified,bodyCount>0);
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
export function provePlate(snapshot,volume,panels) {
 assert.deepEqual(Object.keys(snapshot.bodies).sort(),['part','plate','tool']);
 assert.deepEqual(Object.keys(snapshot.parameters).sort(),['depth','toolSpanY','toolWidth','toolX','toolY']);
 const {plate,tool,part}=snapshot.bodies,p=snapshot.parameters;
 assert.equal(plate.family,'convex-planar');assert.equal(tool.family,'convex-planar');assert.equal(part.family,'orthogonal-cell');
 assert.equal(plate.native,snapshot.evidence[1].native.solid);assert.equal(tool.native,snapshot.evidence[3].native.solid);
 prove(plate.native,6144);prove(tool.native,p.toolWidth*p.toolSpanY*p.depth);
 const feature=snapshot.evidence[4];assert.equal(feature.kind,'difference');assert.equal(feature.parents[0],plate.native);assert.equal(feature.parents[1],tool.native);assert.equal(feature.native,part.native);
 const result=proveNative(part.native,volume,panels),native=part.native;
 assert.deepEqual(native.a.shell.origin,[-0,0,0]);assert.deepEqual(native.a.shell.sides,[32,24,8]);
 assert.deepEqual(native.b.shell.origin,[p.toolX,p.toolY,0]);assert.deepEqual(native.b.shell.sides,[p.toolWidth,p.toolSpanY,p.depth]);
 assert.ok(native.a.source.includes('-0'));assert.ok(snapshot.save().includes('"min":[-0,0]'));
 const originalFaces=[plate.native,tool.native].flatMap(n=>n.graph.faces);assert.equal(originalFaces.length,12);
 const originalIDs=new Set(originalFaces.map(f=>f.faceId));assert.equal(originalIDs.size,12);assert.ok([...originalIDs].every(id=>typeof id==='string'&&id.length>0));
 const originalSources=new Set(originalFaces.map(f=>f.sourceId));assert.ok([...originalSources].every(id=>typeof id==='string'&&id.length>0));
 for(const asset of [native.a,native.b]){
  assert.equal(originalSources.has(asset.sourceId),false);
  for(const face of asset.shell.faces){assert.equal(originalIDs.has(face.id),false);assert.equal(originalIDs.has(face.bundle.topology.face.id),false);}
 }
 for(const cell of native.cells)assert.equal(cell.occupied,cell.insideA&&!cell.insideB);
 const coords=[native.grid.x,native.grid.y,native.grid.z];
 for(const panel of native.panels){
  const points=panel.vertexIds.map(id=>native.vertices.find(v=>v.id===id).pointMM);
  const center=[0,1,2].map(a=>points.reduce((n,point)=>n+point[a],0)/4);
  const cell=native.cells.find(c=>c.index.every((v,i)=>v===panel.cellIndex[i]));assert.ok(cell.occupied);
  const cellCenter=cell.index.map((v,i)=>(coords[i][v]+coords[i][v+1])/2);
  assert.ok((center[panel.axis]-cellCenter[panel.axis])*panel.sign>0);
  if(panel.emptyCellIndex){const empty=native.cells.find(c=>c.index.every((v,i)=>v===panel.emptyCellIndex[i]));assert.equal(empty.occupied,false);}
  const fromTool=panel.lineage.filter(l=>l.operand==='b');for(const lineage of fromTool)assert.equal(lineage.relativeOrientation,-1);
  if(fromTool.length){
   const lo=[p.toolX,p.toolY,0][panel.axis],hi=[p.toolX+p.toolWidth,p.toolY+p.toolSpanY,p.depth][panel.axis];
   assert.ok(center[panel.axis]===lo||center[panel.axis]===hi);
   assert.equal(panel.sign,center[panel.axis]===lo?1:-1);
  }
  // Neither underside opening nor a through-window has a spurious covering cap tile.
  if(panel.axis===2&&(center[2]===0||(p.depth>=8&&center[2]===8)))assert.equal(center[0]>p.toolX&&center[0]<p.toolX+p.toolWidth&&center[1]>p.toolY&&center[1]<p.toolY+p.toolSpanY,false);
 }
 if(p.toolX===8&&p.toolY===8){
  const inward=native.panels.filter(panel=>panel.lineage.some(l=>l.operand==='b'));
  const directions=new Set(inward.map(panel=>panel.axis+':'+panel.sign));
  assert.deepEqual([...directions].sort(),(p.depth<8?['0:-1','0:1','1:-1','1:1','2:-1']:['0:-1','0:1','1:-1','1:1']).sort());
 }
 const actualPrisms=snapshot.recomputation.evaluatedFeatures.filter(i=>snapshot.evidence[i].kind==='extrude').map(i=>{
  const native=snapshot.evidence[i].native;assert.deepEqual(native.report.childNativeWork,{sketchReconstructionCount:1,initialFaceConstructionCount:6,solidQualificationCount:1,solidFaceReconstructionCount:6,sourceCompilationCount:13,bindingObservationCount:144,totalD1Count:432,retries:0});
  return{index:i,report:native.report.childNativeWork};
 });
 return{...result,prismReportsForEvaluatedFeatures:actualPrisms,newBoxRepresentation:'whole-source-six-native-faces-qualified-shells',originalConvexIdentity:true,cavityNormalsAndOpenCaps:true};
}
export function proveBuffers(native,buffers) {
 assert.deepEqual(buffers.native,native);assert.equal(buffers.report.nativeValidationCalls,1);assert.equal(buffers.report.tessellateSurfaceCalls,46);
 // This field excludes work inside the native validator; do not treat it as total compilation work.
 assert.equal(buffers.report.sourceCompilationCalls,0);assert.equal(buffers.panels.length,46);assert.equal(buffers.report.vertexCount,184);assert.equal(buffers.report.triangleCount,92);
 assert.equal(buffers.positions.length,552);assert.equal(buffers.normals.length,552);assert.equal(buffers.indices.length,276);
 assert.equal(buffers.coordinateSystem,'right-handed-z-up');assert.equal(buffers.options.basis,'authored-xyz-matches-rhyup');
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
