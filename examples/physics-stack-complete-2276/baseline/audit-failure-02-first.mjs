// Data-only audit of the first actual finite failure envelope. No physics calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeFiniteFailure} from './failure-evidence.mjs';
import {raw,wordsDigest} from '../physics-stack-library-2276/io.mjs';

const home=new URL('./evidence/full-02/ALIGNED/host/',import.meta.url);
const bytes=readFileSync(new URL('failure.json',home));
assert.ok(bytes.length<=2**21);
const decoded=decodeFiniteFailure(bytes),d=decoded.data;
const live=JSON.parse(readFileSync(new URL('result.json',home)));
assert.equal(live.status,'COMPLETE_SCENE_STOPPED');
assert.equal(live.counts.contiguousPhysicalAccepted,1098);
assert.deepEqual(d.firstObserved,live.firstObserved);
assert.equal(d.firstObserved.step,1099);
assert.equal(d.earliest.earliestFailingStep,'UNKNOWN');
assert.equal(d.failureWindow.selectedStep,1099);
assert.equal(d.failureWindow.selectedFrame.packet.step,1099);
assert.equal(d.lastAccepted.stepIndex,1098);
assert.equal(decoded.aliasIdentityRestored,false);
assert.equal(decoded.negativeZeroPathCount,84);
for(const path of decoded.negativeZeroPaths){
 let value=d;for(const key of path){assert.ok(Object.hasOwn(value,key));value=value[key];}
 assert.ok(Object.is(value,-0));
}
const packet=d.failureWindow.selectedFrame.packet;
assert.equal(packet.scene,'ALIGNED');
assert.equal(packet.providerDigest,'6a504f420b8d2db5e60cd8b73103ac0c136381d56a966cb41ee54feda4336305');
const runtime=new URL('../physics-stack-library-2276/evidence/runtime-opt05-01/ALIGNED.f64le',new URL('../',import.meta.url));
const fd=openSync(runtime,'r');let frames=0;
try{
 for(const [bodies,step]of [[d.lastAccepted.bodies,1098],[packet.priorBodies,1098],
  [packet.prepared.diagnostics.beforeBodies,1098],[packet.prepared.candidateBodies,1099]]){
  const expected=Buffer.alloc(936);assert.equal(readSync(fd,expected,0,936,step*936),936);
  assert.deepEqual(raw(bodies),expected);frames++;
 }
}finally{closeSync(fd);}
const result={status:'PASS_DATA_ONLY_ACTUAL_FAILURE_ENVELOPE_RECOVERY',
 inputSHA256:createHash('sha256').update(bytes).digest('hex'),inputBytes:bytes.length,
 selectedStep:1099,lastAcceptedStep:1098,earliestFailingStep:'UNKNOWN',
 negativeZeroPathsRestored:84,bodyFramesComparedToPaidRuntime:frames,
 restoredNumericWords:wordsDigest(d),aliasIdentityRestored:false,
 cloneFingerprintValidation:'NOT_CLAIMED_AFTER_JSON_ALIAS_EXPANSION',
 originalLiveStatusUnchanged:live.status,physicalAcceptanceAdded:0,
 solverCalls:0,worldCalls:0,referenceCalls:0,full1200:false,API:false};
writeFileSync(new URL('failure-recovery.json',home),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
