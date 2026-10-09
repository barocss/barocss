import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
import { referenceSweep,closestSegmentBox,referencePointBox } from '../physics-capsule-sweep-reference/reference.mjs';
const path=resolve(process.argv[2]??'/tmp/physics-distinct-clean/manifest.json'),folder=dirname(path);
const manifest=JSON.parse(readFileSync(path,'utf8')),report=JSON.parse(readFileSync(resolve(folder,'report.json'),'utf8'));
assert.equal(manifest.format,'capsule-sweep-raw-v1');assert.equal(manifest.endianness,'little');
const arrays={};let total=0;
for(const file of manifest.files){assert.ok(!file.file.includes('/')&&!file.file.includes('..'));const bytes=readFileSync(resolve(folder,file.file));
 assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);arrays[file.file]=decodeF64(bytes);assert.equal(arrays[file.file].length,file.elements);total+=bytes.length;}
assert.equal(total,manifest.totalRawBytes);assert.equal(manifest.files.length,2);const profiles = [['DISTINCT_1_GRAZE',1],['DISTINCT_8_GRAZE',8],['DISTINCT_16_GRAZE',16],['DISTINCT_32_GRAZE',32],['DISTINCT_32_REVERSE',32],['DISTINCT_32_EXCLUDE',32],['DISTINCT_32_CLEAR',32],['DISTINCT_32_WALL',32],['DISTINCT_32_OVERLAP_LAST',32]];
assert.deepEqual(report.first.map(o=>[o.name,o.scene.boxes.length]),profiles);
const inputs=arrays['inputs.f64.bin'],outputs=arrays['outputs.f64.bin'];assert.ok(inputs&&outputs);
let a=0,b=0,negativeZeroValues=0;
for(const value of [...inputs,...outputs]){assert.ok(Number.isFinite(value));if(Object.is(value,-0))negativeZeroValues++;}
const takeInputs=n=>Array.from(inputs.subarray(a,a+=n)),takeOutputs=n=>Array.from(outputs.subarray(b,b+=n));
const separation=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
for(const original of report.first){const count=takeInputs(1)[0];assert.equal(count,original.scene.boxes.length);
 assert.equal(original.query.revision,'sweepRef1');assert.equal(original.scene.revision,'sweepRef1');
 const walls=original.name==='DISTINCT_32_WALL',clear=original.name==='DISTINCT_32_CLEAR',reverse=original.name==='DISTINCT_32_REVERSE',excluded=original.name==='DISTINCT_32_EXCLUDE';
 assert.deepEqual(original.query.centerM,[-.5,clear?.600001:.6,0]);assert.deepEqual(original.query.displacementM,[walls?2:1.5,0,0]);assert.equal(original.query.excludeId,excluded?'box00':null);
 for(let i=0;i<original.scene.boxes.length;i++){const index=reverse?31-i:i,source=original.scene.boxes[i],lastOverlap=original.name==='DISTINCT_32_OVERLAP_LAST'&&i===31;
 assert.equal(source.id,'box'+String(index).padStart(2,'0'));
 assert.deepEqual(source.centerM,lastOverlap?[-.5,.6,0]:[.5+index/1000,walls?.6:.05,0]);
 assert.deepEqual(source.halfExtentsM,walls||lastOverlap?[.05,1,1]:[.25,.05,.75]);assert.deepEqual(source.orientationXYZW,[0,0,0,1]);}
 const boxes=original.scene.boxes.map(box=>({...box,centerM:takeInputs(3),halfExtentsM:takeInputs(3),orientationXYZW:takeInputs(4)}));
 const center=takeInputs(3),displacement=takeInputs(3);assert.deepEqual(center,original.query.centerM);assert.deepEqual(displacement,original.query.displacementM);
 for(let i=0;i<boxes.length;i++)for(const key of ['centerM','halfExtentsM','orientationXYZW'])assert.deepEqual(boxes[i][key],original.scene.boxes[i][key]);
 const [hasHit,hasError]=takeOutputs(2);assert.equal(!!hasHit,!!original.hit);assert.equal(!!hasError,!!original.error);
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
 const index=excluded?1:0,expectedFraction=walls?.4:(.75+index/1000)/1.5,expectedNormal=walls?[-1,0,0]:[0,1,0];
 assert.equal(original.hit.bodyId,'box'+String(index).padStart(2,'0'));assert.ok(Math.abs(fraction-expectedFraction)<=1e-6);assert.ok(separation(normal,expectedNormal)<=1e-6);if(!walls)assert.ok(separation(point,[.25+index/1000,.1,0])<=1e-6);
 if(original.analytic){assert.ok(Math.abs(fraction-original.analytic.fraction)<=1e-6);assert.ok(separation(normal,original.analytic.normalM)<=1e-6);if(original.analytic.pointM)assert.ok(separation(point,original.analytic.pointM)<=1e-6);}
}
assert.equal(a,inputs.length);assert.equal(b,outputs.length);assert.equal(JSON.stringify(report.first),JSON.stringify(report.second));
console.log(JSON.stringify({format:manifest.format,cases:report.first.length,totalRawBytes:total,negativeZeroValues,exactHashes:true,allOutputsIndependentlyVerified:true,importsNoCandidateSnapshotOrFixture:true}));
