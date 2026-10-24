import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { mountingPlate,provePlate,proveHoleMesh,work,nativeBodyHash } from './modeling-hole-fixture.mjs';
import { prove } from './modeling-intersection-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE??new URL('../dist/index.js',import.meta.url).pathname);
const {cad,CadModelError,StoredPlateHoleSolidError,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,classifyStoredPlateHoleSolidPoints}=await import(pathToFileURL(entry).href);
const directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR??new URL('./modeling-hole-evidence',import.meta.url).pathname);mkdirSync(directory,{recursive:true});
const flow={status:'running',modelCalls:0,tessellations:0,classificationCalls:0,classificationQueries:0,stages:[],fullTransitiveNativeCoverage:'NOT_MEASURED',entrySHA256:createHash('sha256').update(readFileSync(entry)).digest('hex')};
const write=()=>writeFileSync(resolve(directory,'source-flow.json'),JSON.stringify(flow,null,2)+'\n');
const disk=()=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);};
const stage=(label,action)=>{disk();assert.ok(++flow.modelCalls<=7);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,...(result?{recomputation:result.recomputation}:{})});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try {
  const initial=stage('mixed convex blank and qualified through-hole',mountingPlate(cad).build),initialText=initial.save();
  work(initial,[],[0,1,2]);flow.baseline=provePlate(initial,[40,20],5,[35,35,15,15]);flow.initialBodySHA256=nativeBodyHash(initial);
  writeFileSync(resolve(directory,'initial.cad-model.json'),initialText);
  disk();flow.tessellations++;write();const blankMesh=tessellateConvexPlanarSolid(initial.bodies.blank.native,{maximumFanTriangles:40});
  assert.ok(blankMesh.report.triangleCount>0);flow.blankDisplay={family:'convex-planar',triangles:blankMesh.report.triangleCount};
  const context={documentId:'mounting_plate',bodyId:initial.bodies.plate.native.bundle.request.bodyId,documentRevision:'baseline',kernelResultRevision:'baseline',topologyRevision:'baseline',taskToken:'hole_preview'};
  disk();flow.tessellations++;write();const holeMesh=tessellateOwnPlateCircularHole(initial.bodies.plate.native.bundle,{context,segmentsPerQuarter:4});
  flow.holeDisplay=proveHoleMesh(initial.bodies.plate.native,holeMesh);assert.deepEqual(holeMesh.mesh.context,context);
  const points=[[40,20,4],[1,1,4],[45,20,4],[40,20,0],[1,1,8],[0,0,0]],expected=['outside','inside','boundary','outside','boundary','boundary'];
  const queries=points.map((point,i)=>({queryId:'material_'+i,point}));
  disk();flow.classificationCalls++;flow.classificationQueries=queries.length;write();
  const material=classifyStoredPlateHoleSolidPoints(initial.bodies.plate.native,queries,{evaluationId:'mounting_material',maximumQueries:8});
  assert.deepEqual(material.classifications.map(c=>c.status),expected);assert.deepEqual(material.queries,queries);
  assert.deepEqual(material.solid,initial.bodies.plate.native);assert.equal(material.report.authority,'stored-coefficient-conic-product-material');
  assert.ok(material.classifications[2].boundary.faces.some(f=>f.role==='hole-wall'));
  assert.ok(material.classifications[4].boundary.faces.some(f=>f.role==='top-cap'));
  assert.equal(material.classifications[5].boundary.vertexIds.length,1);
  flow.material={queries,classifications:material.classifications,proof:material.proof,report:material.report};
  if(process.env.CAD_MODEL_TRANSPORT_DIR) {
    const output=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(output,{recursive:true});
    const text=JSON.stringify({text:initialText,parameters:initial.parameters,features:initial.features,bodySHA256:flow.initialBodySHA256,bodies:initial.bodies,blankMesh,holeMesh})+'\n';
    assert.ok(Buffer.byteLength(text)<=2*1024*1024);writeFileSync(resolve(output,'baseline-native.json'),text);
    flow.transfer={bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),scope:'actual qualified native bodies and both provider meshes; no editor packet or browser execution'};
  }
  const narrow=stage('radius 5 to 2.5',()=>initial.withParameters({radius:2.5})),narrowText=narrow.save(),narrowHash=nativeBodyHash(narrow);
  work(narrow,[0,1],[2],initial);flow.narrow=provePlate(narrow,[40,20],2.5,[37.5,37.5,17.5,17.5]);
  stage('width 81 exact stored UV refusal',()=>{
    assert.throws(()=>narrow.withParameters({width:81}),error=>{
      assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'hole');
      assert.ok(error.cause instanceof StoredPlateHoleSolidError);assert.equal(error.cause.code,'GEOMETRY');flow.chartRefusal=errorData(error);return true;
    });
    assert.equal(narrow.save(),narrowText);assert.equal(nativeBodyHash(narrow),narrowHash);
  });
  const offset=stage('same accepted snapshot off-centre recovery',()=>narrow.withParameters({centerX:32.5,centerY:18.75})),offsetText=offset.save(),offsetHash=nativeBodyHash(offset);
  work(offset,[0,1],[2],narrow);flow.offset=provePlate(offset,[32.5,18.75],2.5,[30,45,16.25,18.75]);
  stage('tangent radius 18.75 genuine containment refusal',()=>{
    assert.throws(()=>offset.withParameters({radius:18.75}),error=>{
      assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'hole');
      assert.ok(error.cause instanceof Error);assert.match(error.cause.message,/strict represented contained circular hole/);flow.tangentRefusal=errorData(error);return true;
    });
    assert.equal(offset.save(),offsetText);assert.equal(nativeBodyHash(offset),offsetHash);
  });
  const noop=stage('same accepted snapshot explicit no-op',()=>offset.withParameters({centerX:32.5,radius:2.5}));
  work(noop,[0,1,2],[],offset);flow.noop=provePlate(noop,[32.5,18.75],2.5,[30,45,16.25,18.75]);
  assert.equal(noop.save(),offsetText);assert.equal(nativeBodyHash(noop),offsetHash);flow.noopWrapperAndNativeIdentity=true;
  flow.editedBodySHA256=offsetHash;writeFileSync(resolve(directory,'edited.cad-model.json'),noop.save());
  const legacyText=readFileSync(new URL('./modeling-evidence/minimal.cad-model.json',import.meta.url),'utf8');
  const legacy=stage('unchanged old authored convex file',()=>cad.load(legacyText));work(legacy,[],[0,1,2]);
  assert.equal(legacy.bodies.part.family,'convex-planar');assert.equal(legacy.bodies.part.native,legacy.evidence[1].native.solid);
  prove(legacy.bodies.part.native,4096);assert.equal(legacy.save(),legacyText);
  flow.legacy={fileSHA256:createHash('sha256').update(legacyText).digest('hex'),bodySHA256:nativeBodyHash(legacy),volumeMM3:4096,authoredBytesUnchanged:true,nativeIdentityUnchanged:true};
  for(const [snapshot,text,hash] of [[initial,initialText,flow.initialBodySHA256],[narrow,narrowText,narrowHash],[offset,offsetText,offsetHash]]) {
    assert.equal(snapshot.save(),text);assert.equal(nativeBodyHash(snapshot),hash);
  }
  flow.futureUseAfterBothRefusals=true;flow.oldAndNewSnapshotsIndependent=true;
  assert.equal(flow.modelCalls,7);assert.equal(flow.tessellations,2);assert.equal(flow.classificationCalls,1);assert.equal(flow.classificationQueries,6);
  flow.status='passed';flow.actualEditorGPU='UNRUN';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
