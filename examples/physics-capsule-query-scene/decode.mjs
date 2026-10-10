import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
import { referenceSweep,closestSegmentBox,referencePointBox } from '../physics-capsule-sweep-reference/reference.mjs';
const path=resolve(process.argv[2]??'/tmp/physics-1062-source-working/manifest.json'),folder=dirname(path);
const manifest=JSON.parse(readFileSync(path,'utf8')),report=JSON.parse(readFileSync(resolve(folder,'report.json'),'utf8'));
assert.equal(manifest.format,'capsule-sweep-raw-v1');assert.equal(manifest.endianness,'little');
const arrays={};let total=0;
for(const file of manifest.files){assert.ok(!file.file.includes('/')&&!file.file.includes('..'));const bytes=readFileSync(resolve(folder,file.file));
 assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);arrays[file.file]=decodeF64(bytes);assert.equal(arrays[file.file].length,file.elements);total+=bytes.length;}
assert.equal(total,manifest.totalRawBytes);assert.equal(manifest.files.length,2);assert.equal(report.first.length,31);
const referenceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const nativeFolders=['physics-capsule-reuse-reference/evidence/node','physics-capsule-distinct-reference/evidence/node'].map(p=>resolve(referenceRoot,p));
const nativeObservations=nativeFolders.flatMap(p=>JSON.parse(readFileSync(resolve(p,'report.json'),'utf8')).first);
assert.equal(nativeObservations.length,31);assert.deepEqual(report.first.map(o=>o.name),nativeObservations.map(o=>o.name));
assert.equal(report.profile.version,1);assert.equal(report.profile.profile,'upright-capsule-box-v1');
for(const file of ['inputs.f64.bin','outputs.f64.bin'])assert.ok(readFileSync(resolve(folder,file)).equals(Buffer.concat(nativeFolders.map(p=>readFileSync(resolve(p,file))))));
for(let i=0;i<31;i++){assert.deepEqual(report.first[i].scene,nativeObservations[i].scene);assert.deepEqual(report.first[i].query,nativeObservations[i].query);assert.deepEqual(report.first[i].hit,nativeObservations[i].hit);if(report.first[i].error){assert.equal(report.first[i].error.code,'INITIAL_OVERLAP');assert.equal(report.first[i].error.message,'PhysicsError: Initial capsule overlaps a box');}}
assert.equal(report.controls.passed,true);assert.equal(report.controls.getters,0);assert.equal(report.controls.canonicalWithinProviderGraph,true);
const inputs=arrays['inputs.f64.bin'],outputs=arrays['outputs.f64.bin'];assert.ok(inputs&&outputs);
let a=0,b=0,negativeZeroValues=0;
for(const value of [...inputs,...outputs]){assert.ok(Number.isFinite(value));if(Object.is(value,-0))negativeZeroValues++;}
const takeInputs=n=>Array.from(inputs.subarray(a,a+=n)),takeOutputs=n=>Array.from(outputs.subarray(b,b+=n));
const separation=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
for(const original of report.first){const count=takeInputs(1)[0];assert.equal(count,original.scene.boxes.length);
 const boxes=original.scene.boxes.map(box=>({...box,centerM:takeInputs(3),halfExtentsM:takeInputs(3),orientationXYZW:takeInputs(4)}));
 const center=takeInputs(3),displacement=takeInputs(3);assert.deepEqual(center,original.query.centerM);assert.deepEqual(displacement,original.query.displacementM);
 for(let i=0;i<boxes.length;i++)for(const key of ['centerM','halfExtentsM','orientationXYZW'])assert.deepEqual(boxes[i][key],original.scene.boxes[i][key]);
 const [hasHit,hasError]=takeOutputs(2);assert.ok(hasHit===0||hasHit===1);assert.ok(hasError===0||hasError===1);assert.equal(!!hasHit,!!original.hit);assert.equal(!!hasError,!!original.error);
 if(hasError){assert.equal(original.error.code,'INITIAL_OVERLAP');assert.ok(boxes.some(box=>box.id!==original.query.excludeId&&closestSegmentBox(center,box).distanceM<.15-1e-12));continue;}
 const expected=[];for(const box of boxes){if(box.id===original.query.excludeId)continue;const hit=referenceSweep(center,displacement,box);if(hit)expected.push({...hit,bodyId:box.id});}
 if(!hasHit){assert.equal(expected.length,0);assert.equal(original.analytic,null);continue;}
 const fraction=takeOutputs(1)[0],normal=takeOutputs(3),point=takeOutputs(3),segment=takeOutputs(3),iterations=takeOutputs(1)[0];
 assert.equal(fraction,original.hit.fraction);assert.deepEqual(normal,original.hit.normalM);assert.deepEqual(point,original.hit.pointM);assert.deepEqual(segment,original.hit.segmentM);assert.equal(iterations,original.hit.iterations);
 assert.ok(expected.length>0);const minimum=Math.min(...expected.map(h=>h.fraction));const reference=expected.filter(h=>h.fraction<=minimum+1e-9).sort((x,y)=>x.bodyId<y.bodyId?-1:x.bodyId>y.bodyId?1:0)[0];
 assert.equal(reference.bodyId,original.hit.bodyId);assert.ok(Math.abs(fraction-reference.fraction)<=1e-6);assert.ok(separation(normal,reference.normalM)<=1e-6);
 const at=center.map((v,i)=>v+fraction*displacement[i]),box=boxes.find(box=>box.id===original.hit.bodyId),membership=referencePointBox(point,box);
 assert.ok(Math.abs(separation(segment,point)-.15)<=1e-6);assert.ok(Math.abs(closestSegmentBox(at,box).distanceM-.15)<=1e-6);
 assert.ok(Math.max(Math.abs(segment[0]-at[0]),Math.abs(segment[2]-at[2]),Math.max(0,Math.abs(segment[1]-at[1])-.35))<=1e-6);
 assert.ok(membership.distanceM<=1e-6&&membership.boundaryResidualM<=1e-6);assert.ok(Math.abs(Math.hypot(...normal)-1)<=1e-10);
 assert.ok(fraction>=0&&fraction<=1&&iterations>=1&&iterations<=64);
 if(original.analytic){assert.ok(Math.abs(fraction-original.analytic.fraction)<=1e-6);assert.ok(separation(normal,original.analytic.normalM)<=1e-6);if(original.analytic.pointM)assert.ok(separation(point,original.analytic.pointM)<=1e-6);}
}
assert.equal(a,inputs.length);assert.equal(b,outputs.length);assert.equal(JSON.stringify(report.first),JSON.stringify(report.second));
console.log(JSON.stringify({format:manifest.format,cases:report.first.length,totalRawBytes:total,negativeZeroValues,exactHashes:true,allOutputsIndependentlyVerified:true,importsNoCandidateSnapshotOrFixture:true}));
