import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { restoreWorking } from '../physics-rigid-feature-geometry/archive.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function featureControls(m,here) {
  const directory=resolve(here,'../physics-rigid-manifold-refusal/evidence/native-cadfee1a');
  const bytes=await readFile(resolve(directory,'manifest.json'));assert.equal(sha(bytes),'43d4a40b8c168e79047aa8d7d7805771aae15a361955228454afca474ee83967');
  for(const [path,hash]of Object.entries(JSON.parse(bytes)))assert.equal(sha(await readFile(resolve(directory,path))),hash);
  const parent=JSON.parse(gunzipSync(await readFile(resolve(directory,'source-ALIGNED-report.json.gz')))),working=restoreWorking(parent,await readFile(resolve(directory,'source-ALIGNED-working.f64le')));
  const first=parent.firstRefusal,a=working.find(b=>b.id===first.aId),b=working.find(b=>b.id===first.bId),geometry=m.featureContact(a,b);assert.equal(geometry.family,'edge');assert.equal(geometry.points.length,1);
  const pairKey=`${a.id}\u0000${b.id}`,pointId=geometry.points[0].key,key=`${pairKey}\u0000${pointId}`,prior=new Map([[key,{normalNs:10,tangentNs:[2,3,4]}]]),before=structuredClone(prior);
  const run=map=>{const bodies=structuredClone([a,b]),island=new m.FrozenContactIsland(bodies,[[0,1]],map);island.solve();island.projectPositions();return {bodies,result:island.result(),coupled:island.getCoupledPositionStats(),attempt:island.getCoupledPositionAttempt()};};
  const cold=run(new Map()),seed=run(prior);assert.deepEqual(seed,cold);assert.deepEqual(prior,before);assert.deepEqual(cold.result.warmCacheStats,{testedPatches:1,compatiblePatches:0,incompatiblePatches:1,reusedPoints:0,coldPoints:1});
  const point={id:pointId,pointM:geometry.points[0].midpointM},facePoint={id:`face:${a.id}:1:1:${b.id}:1:-1:0`,pointM:[0,0,0]},faceMap=new Map([[`${pairKey}\u0000${facePoint.id}`,{normalNs:0,tangentNs:[0,0,0]}]]);
  assert.equal(m.compatiblePatch(prior,pairKey,[point],'edge'),false);assert.equal(m.compatiblePatch(faceMap,pairKey,[facePoint],'face'),true);assert.equal(m.compatiblePatch(faceMap,pairKey,[point],'edge'),false);assert.equal(m.compatiblePatch(prior,pairKey,[facePoint],'face'),false);
  const extra=new Map(faceMap);extra.set(`${pairKey}\u0000face:${a.id}:1:1:${b.id}:1:-1:1`,{normalNs:0,tangentNs:[0,0,0]});assert.equal(m.compatiblePatch(extra,pairKey,[facePoint],'face'),false);
  const invalid=structuredClone(a);invalid.positionM[0]=10000.1;assert.throws(()=>m.adaptContactGeometry(invalid,b),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message==='private feature contact requires valid box witnesses');
  const config={fixedStepSeconds:1/120,gravityMps2:[0,0,0],contactMode:'persistent-box-v1',bodies:[{id:'a',kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[9999.9,0,0],velocityMps:[24,0,0],massKg:1,restitution:0},{id:'b',kind:'static',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[10000,0,0],restitution:0}]};
  const world=m.createCandidateWorld(config),capture=()=>[world.getState(),world.getWarmCacheSnapshot(),world.getWarmCacheStats(),world.getGlobalContactStats(),world.getCoupledPositionStats(),world.getCoupledPositionAttempt()],saved=capture();
  assert.throws(()=>world.step(1/120),e=>e instanceof m.PhysicsError&&e.code==='NUMERIC_LIMIT'&&e.message==='private feature contact requires valid box witnesses');assert.deepEqual(capture(),saved);world.dispose();world.dispose();
  return {parentManifestSha256:sha(bytes),parentPair:[a.id,b.id],edgeGeometry:geometry,seedIgnored:true,edgeResult:cold,faceFullKeySetHeuristic:true,faceEdgeTransitionsCold:true,cacheSeedCopy:true,workingBoundsRefusalRetainsTransaction:true,physicalCorrespondenceClaimed:false};
}
