import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {buildXYPolygonRegion,buildXYPolygonPlanarFaceWithHole,validateXYPolygonPlanarFaceWithHoleBundle,tessellateXYPolygonPlanarFaceWithHole,evaluateSurfaceD1,evaluateCurve,curveDomain,validatePreviewPacket} from '../../packages/barocss-cad/dist/index.js';
const output=resolve(process.argv[2]??'/tmp/barocss-hole-face-preview-prototype');
mkdirSync(output,{recursive:true});
const write=(name,value)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n');
const close=(a,b)=>assert.ok(Math.hypot(...a.map((x,i)=>x-b[i]))<=1e-9,`${a} differs from ${b}`);
const orient=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const contains=(a,b,c,p)=>[orient(a,b,p),orient(b,c,p),orient(c,a,p)].every(x=>x>=0);
const square=[[0,0],[10,0],[10,10],[0,10]],holeSquare=[[3,3],[7,3],[7,7],[3,7]],definitions=[],summaries=[],failures=[];
for(const outerCW of [false,true])for(const holeCW of [false,true])definitions.push({id:`square_o_${outerCW?'cw':'ccw'}_h_${holeCW?'cw':'ccw'}`,outer:outerCW?[...square].reverse():square,hole:holeCW?[...holeSquare].reverse():holeSquare,area:84,queries:[[[1,1],true],[[5,5],false],[[11,5],false]]});
definitions.push({id:'concave_L',outer:[[0,0],[40,0],[40,10],[10,10],[10,40],[0,40]],hole:[[2,20],[8,20],[2,30]],area:670,queries:[[[2,5],true],[[3,23],false],[[20,20],false]]});
definitions.push({id:'collapsed_triangle_piece',outer:[[0,0],[12,0],[0,12]],hole:[[2,2],[4,2],[2,4]],area:70,queries:[[[1,1],true],[[3,2.5],false],[[10,10],false]],mustOmit:true});
for(const definition of definitions){
 const outer=buildXYPolygonRegion({id:definition.id+'_outer',points:definition.outer}).curve,hole=buildXYPolygonRegion({id:definition.id+'_hole',points:definition.hole}).curve;
 const {bundle}=buildXYPolygonPlanarFaceWithHole(outer,hole,{faceId:definition.id+'_face'}),before=structuredClone(bundle),meshId=definition.id+'_mesh',revision=7;
 const result=tessellateXYPolygonPlanarFaceWithHole(bundle,{meshId,revision}),{packet,edgePaths,edgeProvenance,report}=result;
 validatePreviewPacket(packet);assert.deepEqual(bundle,before);assert.deepEqual(bundle.geometry.objects.slice(0,2),[outer,hole]);
 assert.equal(packet.surfaceId,meshId);assert.equal(packet.revision,revision);assert.equal(report.meshId,meshId);assert.equal(report.sourceVersion,0);
 assert.equal(report.kind,'xy-polygon-planar-face-with-hole-preview');assert.equal(report.geometricValidity,'not-certified');assert.equal(report.topologyCertified,false);assert.equal(report.solid,false);
 assert.deepEqual(report.native,validateXYPolygonPlanarFaceWithHoleBundle(bundle));assert.equal(report.area.nativeMM2,definition.area);
 const surface=bundle.geometry.objects.find(object=>object.id===bundle.topology.face.surfaceId);assert.ok(surface&&surface.kind==='surface');
 assert.equal(report.faceId,bundle.topology.face.id);assert.equal(report.surfaceId,surface.id);
 const point=i=>packet.positions.slice(i*3,i*3+3),normal=i=>packet.normals.slice(i*3,i*3+3),vertices=packet.positions.length/3,triangles=packet.indices.length/3;
 assert.equal(report.vertexCount,vertices);assert.equal(report.triangleCount,triangles);assert.ok(vertices<=264&&triangles<=132);
 for(let i=0;i<vertices;i++){
  const uv=packet.parameters.slice(i*2,i*2+2),sample=evaluateSurfaceD1(surface,...uv),{du,dv}=sample;
  close(point(i),sample.point);const cross=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]],length=Math.hypot(...cross);
  assert.ok(length>0);close(normal(i),cross.map(x=>x/length));close(normal(i),[0,0,1]);assert.ok(Math.abs(point(i)[2])<=1e-9);
 }
 let area=0;const cells=[];
 for(let i=0;i<packet.indices.length;i+=3){const ids=packet.indices.slice(i,i+3);assert.ok(ids.every(id=>Number.isInteger(id)&&id>=0&&id<vertices));const cell=ids.map(point),twice=orient(cell[0],cell[1],cell[2]);assert.ok(twice>0);area+=twice/2;cells.push(cell);}
 const comparison=1e-8+1e-12*Math.max(1,definition.area);assert.equal(report.area.comparisonMM2,comparison);assert.ok(Math.abs(area-definition.area)<=comparison);assert.ok(Math.abs(report.area.meshMM2-area)<=comparison);assert.ok(Math.abs(report.area.differenceMM2)<=comparison);
 const coverage=definition.queries.map(([p,expected])=>{const covered=cells.some(cell=>contains(...cell,p));assert.equal(covered,expected,`Unexpected coverage at ${p}`);return {pointMM:p,covered};});
 const bounds={min:[0,1,2].map(axis=>Math.min(...Array.from({length:vertices},(_,i)=>point(i)[axis]))),max:[0,1,2].map(axis=>Math.max(...Array.from({length:vertices},(_,i)=>point(i)[axis])))};assert.deepEqual(packet.bounds,bounds);
 const n=definition.outer.length+definition.hole.length;assert.equal(edgePaths.length,n);assert.equal(edgeProvenance.length,n);assert.equal(report.edgePathCount,n);assert.equal(new Set(edgePaths.map(path=>path.id)).size,n);
 for(const path of edgePaths){
  const edge=bundle.topology.edges.find(edge=>edge.id===path.id),provenance=edgeProvenance.find(p=>p.edgeId===path.id);assert.ok(edge&&provenance);
  const loop=bundle.topology.loops.find(loop=>loop.id===edge.loopId),use=loop.uses.find(use=>use.edgeId===edge.id),curve=bundle.geometry.objects.find(object=>object.id===edge.curveId),source=bundle.geometry.objects.find(object=>object.id===edge.sourceCurveId);
  for(const key of ['curveId','sourceCurveId','sourceSegmentIndex','sourceParameterRange','loopId','loopRole'])assert.deepEqual(provenance[key],edge[key]);
  assert.equal(provenance.faceId,bundle.topology.face.id);assert.equal(provenance.surfaceId,surface.id);assert.equal(provenance.loopSense,use.sense);assert.deepEqual(provenance.nativeDomain,curveDomain(curve));
  assert.equal(path.points.length,2);for(let end=0;end<2;end++){close(path.points[end],evaluateCurve(curve,provenance.nativeDomain[end]));close(path.points[end],evaluateCurve(source,edge.sourceParameterRange[end]));}
 }
 assert.equal(report.slabCount,report.decomposition.length);assert.ok(report.slabCount<=11);
 let intervals=0,omitted=0;
 for(const slab of report.decomposition){assert.ok(slab.xRange[0]<slab.xRange[1]);assert.ok(slab.midpointX.denominator>0);
  for(const interval of slab.intervals){intervals++;assert.ok(interval.omittedCollapsedTriangles===0||interval.omittedCollapsedTriangles===1);omitted+=interval.omittedCollapsedTriangles;assert.equal(interval.corners.length,4);
   for(const corner of interval.corners){const edge=bundle.topology.edges.find(edge=>edge.id===corner.edgeId),curve=bundle.geometry.objects.find(object=>object.id===corner.curveId),source=bundle.geometry.objects.find(object=>object.id===corner.sourceCurveId);assert.ok(edge&&curve&&source);assert.equal(corner.loopId,edge.loopId);assert.equal(corner.loopRole,edge.loopRole);assert.ok(corner.parameterFraction.denominator>0);const sample=evaluateSurfaceD1(surface,...corner.uv);close(sample.point,evaluateCurve(curve,corner.nativeParameter));close(sample.point,evaluateCurve(source,corner.sourceParameter));}
  }
 }
 assert.equal(report.trapezoidCount,intervals);assert.equal(triangles,2*intervals-omitted);if(definition.mustOmit)assert.ok(omitted>0,'Exact collapsed pieces must be recorded and omitted');
 for(const [suffix,value] of Object.entries({bundle,packet,'edge-paths':edgePaths,'edge-provenance':edgeProvenance,report,decomposition:report.decomposition,coverage}))write(definition.id+'.'+suffix+'.json',value);
 summaries.push({id:definition.id,vertexCount:vertices,triangleCount:triangles,edgePathCount:n,areaMM2:area,comparisonMM2:comparison,omittedCollapsedTriangles:omitted,coverage,originalSourcesUnchanged:true});
 if(definition.id==='square_o_ccw_h_ccw'){
  const previous=structuredClone(result);
  for(const kind of ['inner-reference','inner-pcurve']){const bad=structuredClone(bundle),inner=bad.topology.loops.find(loop=>loop.role==='hole');if(kind==='inner-reference')bad.topology.edges.find(edge=>edge.id===inner.uses[0].edgeId).curveId='missing_curve';else inner.uses[0].pcurve.uv1[0]+=.1;
   assert.throws(()=>tessellateXYPolygonPlanarFaceWithHole(bad,{meshId,revision}),error=>{assert.ok(error instanceof Error);failures.push({kind,message:error.message});return true;});assert.deepEqual(bundle,before);assert.deepEqual(result,previous);assert.deepEqual(tessellateXYPolygonPlanarFaceWithHole(bundle,{meshId,revision}),previous);write('rejected-'+kind+'.bundle.json',bad);
  }
  assert.throws(()=>tessellateXYPolygonPlanarFaceWithHole(bundle,{meshId:outer.id,revision}),Error);
 }
}
write('summary.json',{summaries,failures,scope:'Original native two-loop display mesh; no raster, generic geometry/topology certificate, solid, exchange or broad validation.'});console.log(JSON.stringify({summaries,failures}));
