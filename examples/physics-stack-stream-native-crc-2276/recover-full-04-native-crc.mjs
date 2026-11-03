// Root-only offline archive recovery. No solver, World or numerical reference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,openSync,readSync,closeSync,statSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyArchive} from './archive.mjs';
const componentHome=dirname(fileURLToPath(import.meta.url)),home=resolve(componentHome,'../physics-stack-complete-2276'),root=resolve(home,'../..'),out=join(home,'evidence/full-04'),target=join(out,'ALIGNED/host');
const SHA='4a262ec7fbd1388413e180777f7d2d01201191b067fb8e41dc1224547760a993',SIZE=222540406;
const start=performance.now(),deadline=()=>assert.ok(performance.now()-start<170000,'OFFLINE_RECOVERY170');
const hash=b=>createHash('sha256').update(b).digest('hex');
function pin(path){const h=createHash('sha256'),buf=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,buf,0,buf.length,null)))h.update(buf.subarray(0,n));}finally{closeSync(fd);}return {bytes:statSync(path).size,sha256:h.digest('hex')};}
assert.ok(!existsSync(join(componentHome,'offline-recovery.json'))&&!existsSync(join(componentHome,'recovery-failure.json')),'FRESH_OUTPUTS');
assert.equal(statSync(join(target,'events.gz')).size,SIZE);
const pinsPath=join(home,'PINS.json'),pinsSHA='4ad32b3410a31ede3431f9c5ed1552c8b61a783ddfcb7c2a875a7ad2b5939c63';assert.equal(pin(pinsPath).sha256,pinsSHA);
const pins=JSON.parse(readFileSync(pinsPath)),runtimePath=resolve(root,pins.runtimeFrames.ALIGNED),decoderPath=join(componentHome,'archive.mjs');
assert.deepEqual(pin(runtimePath),pins.files[pins.runtimeFrames.ALIGNED]);assert.equal(pin(decoderPath).sha256,'8ab60659035aef867273444b6f491840592030ab315473ca2cccb000bb02d54f');
const raw=bodies=>{const bytes=Buffer.alloc(936);let at=0;assert.equal(bodies.length,9);for(const b of bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){assert.ok(Number.isFinite(b[key][i]));bytes.writeDoubleLE(b[key][i],at);at+=8;}assert.equal(at,936);return bytes;};
const pending=new Map(),counts={},maxima={},bodyHash=createHash('sha256');let records=0,entries=0,terminal=0,baseline=null,recovered=null,error=null,lastRecordStep=null,runtimeFramesCompared=0;
function metrics(prefix,v){for(const [key,n]of Object.entries(v??{}))if(typeof n==='number'&&Number.isFinite(n))maxima[prefix+'.'+key]=Math.max(maxima[prefix+'.'+key]??-Infinity,n);}
const runtime=openSync(runtimePath,'r');
try{
 recovered=await verifyArchive(join(target,'events.gz'),entry=>{
  deadline();assert.ok(++entries<=10803);const h=entry.header;assert.equal(h.scene,'ALIGNED');assert.ok(Number.isInteger(h.step)&&h.step>=0&&h.step<=1200);
  if(h.channel==='rpc'){
   assert.ok(['contacts','quality','world','step-ledger'].includes(h.op));const role=['contacts','quality'].includes(h.op)?'geometry':'position'+(h.step%2),key=h.step+':'+h.op,c=counts[h.op]??={requests:0,replies:0};
   if(h.kind==='request'){assert.ok(!pending.has(role));pending.set(role,key);assert.ok(pending.size<=3);c.requests++;}
   else{assert.equal(h.kind,'reply');assert.equal(pending.get(role),key);pending.delete(role);c.replies++;}return;
  }
  assert.equal(h.channel,'record');assert.equal(h.step,records);const r=entry.record;
  const frames=h.step===0?[r.state.bodies]:[r.before.bodies,r.prepared.diagnostics.freeBodies,r.prepared.diagnostics.velocityBodies,r.prepared.candidateBodies];
  assert.deepEqual(entry.bodyRaw,Buffer.concat(frames.map(raw)));
  const hex=r.pointOperandF64leHex??'';assert.equal(typeof hex,'string');assert.match(hex,/^(?:[0-9a-f]{2})*$/);assert.deepEqual(entry.pointRaw,Buffer.from(hex,'hex'));
  const final=raw(h.step===0?r.state.bodies:r.after.bodies),expected=Buffer.alloc(936);assert.equal(readSync(runtime,expected,0,936,h.step*936),936);assert.deepEqual(final,expected);runtimeFramesCompared++;
  assert.equal(r.quality.resolved,true);assert.equal(r.quality.executionFailure,false);assert.deepEqual(r.quality.violations,[]);metrics('quality',r.quality.metrics);
  if(h.step>0){assert.equal(r.velocityCheck.passed,true);assert.deepEqual(r.velocityCheck.violations,[]);metrics('normal',r.velocityCheck.maxima);for(const key of ['contactGeometry','positionCheck','ledgerCheck']){assert.equal(r[key].resolved,true);assert.deepEqual(r[key].violations,[]);metrics(key,r[key].metrics);}}
  bodyHash.update(entry.bodyRaw);if(h.step===960)baseline=hash(final);if(h.step>=960)terminal++;lastRecordStep=h.step;records++;
 },SHA);
 assert.equal(recovered.status,'ARCHIVE_VERIFIED');deadline();assert.equal(pin(pinsPath).sha256,pinsSHA);assert.deepEqual(pin(runtimePath),pins.files[pins.runtimeFrames.ALIGNED]);
}catch(e){error={errorClass:e.name,code:e.code??null,message:String(e.message).slice(0,2048)};}finally{closeSync(runtime);}
const result={status:error?'OFFLINE_RECOVERY_STOPPED_WITH_PROGRESS':'PASS_OFFLINE_RECOVERY_ONLY',expectedArchive:{bytes:SIZE,sha256:SHA},pinsSHA256:pinsSHA,hostResultPresent:existsSync(join(target,'result.json')),hostClosurePresent:existsSync(join(target,'closure.json')),hostFailurePresent:existsSync(join(target,'failure.json')),sourceIntegrityFinal:'NOT_RUN_NO_LIVE_RECEIPT',recovered,error,completeDecodedEntriesObserved:entries,recordGroupsVerified:records,lastRecordStep,runtimeFramesCompared,recordedPhaseGateStepsVerified:Math.max(0,records-1),bodyOnlySHA256OfVerifiedRecords:bodyHash.digest('hex'),referenceWires:counts,pendingReferenceWires:[...pending],record960BodySHA256:baseline,recordedTerminalQualityFrames:terminal,maxima,completeArchivePopulationRecovered:!error&&records===1201&&entries===10803&&pending.size===0,liveContiguousAccepted:'UNKNOWN_NO_HOST_RECEIPT',solverCalls:0,worldCalls:0,referenceCalls:0,originalIndependentFullPhysics:false,API:false,scope:'Offline persisted bytes and recorded gate flags only; no new physical oracle, live acceptance, clean CPU or deadline promotion.'};
const paid=JSON.parse(readFileSync(join(out,'offline-recovery.json')));if(!error){try{assert.deepEqual(result,paid,'exact paid old-reader counts/logical digests/gate flags/runtime frames');}catch(e){error={errorClass:e.name,code:e.code??null,message:String(e.message).slice(0,2048)};result.error=error;result.status='OFFLINE_RECOVERY_STOPPED_WITH_PROGRESS';}}
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(bytes.length<=65536);const path=join(componentHome,error?'recovery-failure.json':'offline-recovery.json');writeFileSync(path,bytes,{flag:'wx'});console.log(JSON.stringify({status:result.status,path,records,entries,bytes:bytes.length}));if(error)process.exitCode=1;
