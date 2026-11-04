import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {closedPhaseCheckpoint,writeClosedPhaseCheckpoint} from './phase-checkpoint.mjs';
import {wire} from '../physics-stack-library-2276/io.mjs';

const prior=name=>JSON.parse(readFileSync(new URL('../physics-stack-complete-2276/evidence/'+name+'/ALIGNED/host/result.json',import.meta.url)));
// Synthetic count projection only; old paid fixtures contain no Fraction execution proof.
const projectCounts=counts=>{const {runtimeFramesCompared,oldWirePairsCompared,oldRecordsCompared,...rest}=counts;return {...rest,prefixWirePairsCompared:oldWirePairsCompared,prefixRecordsCompared:oldRecordsCompared,trajectoryFramesObserved:runtimeFramesCompared,stationaryFraction:{requested:counts.reference.world.attempted,replied:counts.reference.world.replied,resolved:counts.reference.world.resolved,passed:counts.reference.world.passed,shadowReplies:0}};};
const input=r=>({scene:r.scene,steps:r.selectedSteps,counts:projectCounts(r.counts),archive:r.archive,
 bodyOnlySha256:r.bodyOnlySha256,baseline960:r.baseline960,
 terminalQualityPassed:r.terminalQualityPassed,peakCredits:r.peakCredits});

test('actual complete prefix05 has phase progress but grants no final acceptance',()=>{
 const completed=prior('prefix-05'),result=closedPhaseCheckpoint(input(completed));
 assert.equal(result.counts.contiguousPhysicalAccepted,16);
 assert.equal(result.archive.entries,147);
 assert.equal(result.recovery,'NOT_YET_COMPLETED');
 assert.equal(result.originalIndependentFullPhysics,false);
 assert.equal(result.API,false);
 assert.equal(completed.recovery.status,'ARCHIVE_VERIFIED');
});
test('actual failed full03 cannot create a completed phase checkpoint',()=>{
 const failed=prior('full-03'),directory=mkdtempSync(join(tmpdir(),'physics-phase-refusal-'));
 const path=join(directory,'phase-checkpoint.json');
 assert.equal(failed.counts.contiguousPhysicalAccepted,1153);
 assert.throws(()=>writeClosedPhaseCheckpoint(path,input(failed),wire));
 assert.equal(existsSync(path),false);
});
test('progress bytes survive a subsequent stop and cannot be overwritten',()=>{
 const completed=prior('prefix-05'),directory=mkdtempSync(join(tmpdir(),'physics-phase-retention-'));
 const path=join(directory,'phase-checkpoint.json'),stop=Error('later-recovery-stopped');
 assert.throws(()=>{writeClosedPhaseCheckpoint(path,input(completed),wire);throw stop;},e=>e===stop);
 const before=readFileSync(path),result=JSON.parse(before);
 assert.equal(result.counts.contiguousPhysicalAccepted,16);
 assert.equal(result.originalIndependentFullPhysics,false);
 assert.throws(()=>writeClosedPhaseCheckpoint(path,input(completed),wire),{code:'EEXIST'});
 assert.deepEqual(readFileSync(path),before);
});

test('new exact Fraction counters are all required and cannot be inferred from FloatKKT',()=>{
 const completed=prior('prefix-05');for(const key of ['requested','replied','resolved','passed']){const data=input(completed);data.counts.stationaryFraction[key]--;assert.throws(()=>closedPhaseCheckpoint(data));}
 const missing=input(completed);delete missing.counts.stationaryFraction;assert.throws(()=>closedPhaseCheckpoint(missing));
 const shadow=input(completed);shadow.counts.stationaryFraction.shadowReplies=1;assert.throws(()=>closedPhaseCheckpoint(shadow));
 const result=closedPhaseCheckpoint(input(completed));assert.equal(result.counts.trajectoryFramesObserved,17);assert.equal(Object.hasOwn(result.counts,'runtimeFramesCompared'),false);assert.equal(result.originalIndependentFullPhysics,false);
});
