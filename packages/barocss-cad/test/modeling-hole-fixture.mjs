import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prove } from './modeling-intersection-fixture.mjs';
import { deepFrozen } from './modeling-regeneration-fixture.mjs';

export function mountingPlate(cad) {
  const model=cad.model(), width=model.parameter('width',80), depth=model.parameter('depth',40), height=model.parameter('height',8);
  const centerX=model.parameter('centerX',40), centerY=model.parameter('centerY',20), radius=model.parameter('radius',5);
  const blank=model.sketch.rectangle({width,height:depth}).extrude(height);
  const plate=blank.hole({center:[centerX,centerY],radius});
  return {model,blank,plate,build:()=>model.build({blank,plate})};
}

// Native payloads, not new wrapper metadata, remain the historical hash authority.
export function nativeBodyHash(snapshot) {
  const text=value=>typeof value==='number' ? Object.is(value,-0)?'-0':JSON.stringify(value)
    :Array.isArray(value)?'['+value.map(text).join(',')+']'
      :value!==null&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+text(value[k])).join(',')+'}'
        :JSON.stringify(value);
  const payload=Object.fromEntries(Object.entries(snapshot.bodies).map(([name,body])=>[name,body.native]));
  return createHash('sha256').update(text(payload)).digest('hex');
}

export function work(snapshot,reused,evaluated,previous) {
  assert.deepEqual(snapshot.recomputation,{reusedFeatures:reused,evaluatedFeatures:evaluated});
  assert.deepEqual([...reused,...evaluated],snapshot.features.map(f=>f.index));deepFrozen(snapshot);
  if(previous) {
    for(const index of reused)assert.equal(snapshot.evidence[index],previous.evidence[index]);
    for(const index of evaluated)assert.notEqual(snapshot.evidence[index],previous.evidence[index]);
    if(reused.includes(1)) {
      assert.equal(snapshot.bodies.blank,previous.bodies.blank);
      assert.equal(snapshot.bodies.blank.native,previous.bodies.blank.native);
    }
    if(reused.includes(2)) {
      assert.equal(snapshot.bodies.plate,previous.bodies.plate);
      assert.equal(snapshot.bodies.plate.native,previous.bodies.plate.native);
    }
  }
}

export function provePlate(snapshot,center,radius,clearance) {
  assert.deepEqual(Object.keys(snapshot.bodies).sort(),['blank','plate']);
  assert.deepEqual(Object.keys(snapshot.parameters).sort(),['centerX','centerY','depth','height','radius','width']);
  assert.deepEqual(snapshot.parameters,{width:80,depth:40,height:8,centerX:center[0],centerY:center[1],radius});
  const blank=snapshot.bodies.blank,plate=snapshot.bodies.plate;
  for(const body of [blank,plate])assert.deepEqual(Object.keys(body).sort(),['family','native']);
  assert.equal(blank.family,'convex-planar');assert.equal(plate.family,'stored-rational-plate-hole');
  assert.equal(blank.native,snapshot.evidence[1].native.solid);prove(blank.native,25600);
  assert.equal(snapshot.evidence[2].kind,'hole');assert.equal(snapshot.evidence[2].parent,blank.native);
  assert.equal(plate.native,snapshot.evidence[2].native);
  const {bundle,parentReport,certificate}=plate.native,{request,topology,faces,sourceModels}=bundle;
  assert.deepEqual([request.widthMM,request.heightMM,request.thicknessMM],[80,40,8]);
  assert.deepEqual(request.centreMM,center);assert.equal(request.radiusMM,radius);
  assert.deepEqual(parentReport.boundsMM,{min:[0,0,0],max:[80,40,8]});assert.deepEqual(parentReport.clearanceMM,clearance);
  assert.equal(parentReport.solid,false);assert.equal(parentReport.topologyCertified,false);
  assert.equal(parentReport.referenceSemantics,'analytic-authored-family-formula-not-certified');
  assert.equal(certificate.kind,'restricted-stored-rational-plate-hole-solid');assert.equal(certificate.geometryAuthority,'stored-coefficient-mathematical-model');
  assert.equal(certificate.solid,true);assert.equal(certificate.genus,1);assert.equal(certificate.weightedEuler,0);
  assert.equal(certificate.embeddedStoredGeometryCertified,true);assert.equal(certificate.materialComponentCount,1);
  assert.equal(Object.hasOwn(certificate,'volumeMM3'),false);
  assert.deepEqual([faces.length,topology.vertices.length,topology.edges.length,topology.loops.length,topology.loops.reduce((n,l)=>n+l.uses.length,0)],[7,10,15,9,30]);
  assert.equal(topology.vertices.length-topology.edges.length+faces.reduce((n,f)=>n+1-f.innerLoopIds.length,0),0);
  assert.equal(sourceModels.length,7);assert.equal(new Set(sourceModels.map(s=>s.faceId)).size,7);
  for(const face of faces) {
    const source=sourceModels.find(s=>s.faceId===face.id);assert.ok(source);assert.equal(source.sourceVersion,0);
    assert.equal(source.model.name,face.id);assert.equal(source.model.lengthUnit,'mm');
    assert.deepEqual(source.model.objects.find(o=>o.id===face.surface.id),face.surface);
    assert.ok(source.source.includes('@surface #'+face.surface.id));
    const loops=topology.loops.filter(l=>l.faceId===face.id);
    assert.ok(loops.some(l=>l.id===face.outerLoopId));
    for(const id of face.innerLoopIds)assert.ok(loops.some(l=>l.id===id&&l.role==='inner'));
    for(const use of loops.flatMap(l=>l.uses)) {
      const edge=topology.edges.find(e=>e.id===use.edgeId);assert.ok(edge);
      assert.deepEqual(source.model.objects.find(o=>o.id===edge.curve.id),edge.curve);
    }
  }
  for(const incidence of parentReport.edgeIncidence) {
    assert.equal(incidence.uses.length,2);assert.notEqual(incidence.uses[0].sense,incidence.uses[1].sense);
  }
  for(const link of certificate.vertexLinks) {
    assert.equal(link.germs.length,3);assert.equal(link.corners.length,3);assert.equal(link.cycle.length,3);
    assert.equal(new Set(link.cycle.map(g=>g.edgeId+':'+g.endpointIndex)).size,3);
  }
  const wall=faces.find(f=>f.role==='hole-wall');assert.equal(wall.orientation,'reverse');
  for(const role of ['bottom-cap','top-cap'])assert.equal(faces.find(f=>f.role===role).innerLoopIds.length,1);
  assert.deepEqual(certificate.ringProof.storedMiddleWeight,Math.SQRT1_2);
  return {center,radius,clearance,boundsMM:parentReport.boundsMM,genus:1,weightedEuler:0,faces:7,vertices:10,edges:15,loops:9,uses:30,sourceModels:7,certifiedVolume:'UNAVAILABLE',nativeIdentityPreserved:true};
}

export function proveHoleMesh(native,display) {
  assert.equal(display.mesh.format,'barocss-native-face-mesh');assert.equal(display.mesh.chunks.length,7);
  assert.deepEqual(display.report.native,native.parentReport);assert.equal(display.report.segmentsPerQuarter,4);
  assert.equal(display.report.approximation,'sampled-native-circle-ring-and-faceted-surface');
  assert.equal(display.report.solid,false);assert.equal(display.report.topologyCertified,false);
  const {centreMM:[cx,cy]}=native.bundle.request;let triangles=0;
  for(const chunk of display.mesh.chunks) {
    const face=native.bundle.faces.find(f=>f.id===chunk.nativeFaceId),provenance=display.provenance.find(p=>p.faceToken===chunk.faceToken);
    assert.ok(face&&provenance);assert.equal(provenance.nativeSurfaceId,face.surface.id);
    const loops=native.bundle.topology.loops.filter(l=>l.faceId===face.id);
    assert.deepEqual([...provenance.nativeLoopIds].sort(),loops.map(l=>l.id).sort());
    assert.deepEqual([...provenance.nativeEdgeIds].sort(),[...new Set(loops.flatMap(l=>l.uses.map(u=>u.edgeId)))].sort());
    assert.equal(chunk.faceOrientation,face.orientation==='forward'?'forward':'reversed');
    assert.ok(chunk.positionsMM.every(Number.isFinite)&&chunk.normals.every(Number.isFinite));
    assert.equal(chunk.positionsMM.length,chunk.normals.length);assert.equal(chunk.indices.length%3,0);
    assert.ok(chunk.indices.every(i=>Number.isInteger(i)&&i>=0&&3*i<chunk.positionsMM.length));triangles+=chunk.indices.length/3;
    for(let i=0;i<chunk.positionsMM.length;i+=3) {
      const p=chunk.positionsMM.slice(i,i+3),n=chunk.normals.slice(i,i+3);
      if(face.role==='hole-wall')assert.ok((p[0]-cx)*n[0]+(p[1]-cy)*n[1]<0);
      if(face.role==='bottom-cap')assert.ok(n[2]<0);if(face.role==='top-cap')assert.ok(n[2]>0);
    }
    if(face.role==='bottom-cap'||face.role==='top-cap')for(let i=0;i<chunk.indices.length;i+=3) {
      const ps=chunk.indices.slice(i,i+3).map(index=>chunk.positionsMM.slice(3*index,3*index+2));
      const signs=ps.map((a,j)=>{const b=ps[(j+1)%3];return (b[0]-a[0])*(cy-a[1])-(b[1]-a[1])*(cx-a[0]);});
      assert.ok(!(signs.every(s=>s>=0)||signs.every(s=>s<=0)),'Sampled cap must leave the centre aperture open');
    }
  }
  assert.equal(triangles,display.report.triangleCount);assert.ok(triangles>0);
  return {faces:7,triangles,centreApertureOpen:true,cavityNormalsInward:true,approximation:display.report.approximation};
}
