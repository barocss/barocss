// Bounded progress evidence. This file cannot grant live/campaign acceptance.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

export function closedPhaseCheckpoint({scene,steps,counts,archive,bodyOnlySha256,baseline960,terminalQualityPassed,peakCredits}){
 assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
 assert.ok(steps===16||steps===1200);
 for(const key of ['producerAttempted','producerReturned','normalKktPassed','fullyVerifiedPhaseSteps','archived','contiguousPhysicalAccepted'])assert.equal(counts[key],steps,key);
 assert.equal(counts.recordGroups,steps+1);
 assert.equal(counts.runtimeFramesCompared,steps+1);
 for(const op of ['contacts','world','step-ledger','quality']){
  const expected=steps+(op==='quality'?1:0);
  for(const key of ['attempted','replied','resolved','passed'])assert.equal(counts.reference[op][key],expected,op+':'+key);
  assert.equal(counts.reference[op].shadowReplies,0);
 }
 assert.equal(archive.status,'ARCHIVE_CLOSED');
 assert.equal(archive.entries,9*steps+3);
 assert.match(archive.compressedSha256,/^[a-f0-9]{64}$/);
 assert.match(bodyOnlySha256,/^[a-f0-9]{64}$/);
 assert.ok(Number.isInteger(peakCredits)&&peakCredits>=1&&peakCredits<=3);
 if(steps===1200){assert.equal(baseline960.step,960);assert.equal(terminalQualityPassed,241);}
 return {status:'PHASES_AND_ARCHIVE_CLOSED_BEFORE_RECOVERY',scene,selectedSteps:steps,
  counts,archive,bodyOnlySha256,baseline960,terminalQualityPassed,peakCredits,
  recovery:'NOT_YET_COMPLETED',closedTreeCPU:'NOT_QUALIFIED_BY_CHECKPOINT',
  originalIndependentFullPhysics:false,API:false,
  scope:'Recorded phase/archive completion only; recovery, final source authentication and owner acceptance remain required.'};
}

export function writeClosedPhaseCheckpoint(path,data,wire){
 const result=closedPhaseCheckpoint(data),bytes=wire(result,65536);
 assert.ok(Buffer.isBuffer(bytes)&&bytes.length<=65536);
 writeFileSync(path,bytes,{flag:'wx'});
 return result;
}
