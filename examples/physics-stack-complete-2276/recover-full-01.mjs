// Offline recovery only. Never imports a solver, World or numerical reference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,openSync,readSync,closeSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyArchive} from '../physics-stack-stream-sized-2276/archive.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const target=join(home,'evidence/full-01/ALIGNED/host'),source=JSON.parse(readFileSync(join(target,'result.json')));
assert.equal(source.status,'COMPLETE_SCENE_STOPPED');assert.equal(source.lastContiguous,1114);
assert.equal(source.archive.compressedSha256,'a7d9a3aa99dad8b1be00f0291765e01a38e3db33868ff2973a6359b4110d5e99');
const runtime=openSync(join(root,'examples/physics-stack-library-2276/evidence/runtime-opt05-01/ALIGNED.f64le'),'r');
const raw=bodies=>{const bytes=Buffer.alloc(936);let at=0;for(const b of bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){bytes.writeDoubleLE(b[key][i],at);at+=8;}assert.equal(at,936);return bytes;};
const hash=createHash('sha256'),pending=new Map(),counts={},maxima={};let records=0,terminal=0,baseline=null;
function metrics(prefix,value){for(const [key,n]of Object.entries(value??{}))if(typeof n==='number'&&Number.isFinite(n))maxima[prefix+'.'+key]=Math.max(maxima[prefix+'.'+key]??-Infinity,n);}
let recovered;
try{
 recovered=await verifyArchive(join(target,'events.gz'),entry=>{
  const h=entry.header;assert.equal(h.scene,'ALIGNED');
  if(h.channel==='rpc'){
   const role=h.op==='contacts'||h.op==='quality'?'geometry':'position'+(h.step%2),key=h.step+':'+h.op;
   const c=counts[h.op]??={requests:0,replies:0};
   if(h.kind==='request'){assert.ok(!pending.has(role));pending.set(role,key);c.requests++;}
   else{assert.equal(pending.get(role),key);pending.delete(role);c.replies++;}return;
  }
  assert.equal(h.channel,'record');assert.equal(h.step,records++);
  const r=entry.record,frames=h.step===0?[r.state.bodies]:[r.before.bodies,r.prepared.diagnostics.freeBodies,r.prepared.diagnostics.velocityBodies,r.prepared.candidateBodies];
  assert.deepEqual(entry.bodyRaw,Buffer.concat(frames.map(raw)));assert.deepEqual(entry.pointRaw,Buffer.from(r.pointOperandF64leHex??'','hex'));hash.update(entry.bodyRaw);
  const final=raw(h.step===0?r.state.bodies:r.after.bodies),expected=Buffer.alloc(936);assert.equal(readSync(runtime,expected,0,936,h.step*936),936);assert.deepEqual(final,expected);
  assert.equal(r.quality.resolved,true);assert.equal(r.quality.executionFailure,false);assert.deepEqual(r.quality.violations,[]);metrics('quality',r.quality.metrics);
  if(h.step===960){baseline=createHash('sha256').update(final).digest('hex');assert.equal(baseline,source.baseline960.bodyRawSha256);}
  if(h.step>=960)terminal++;
  if(h.step>0){
   assert.equal(r.velocityCheck.passed,true);assert.deepEqual(r.velocityCheck.violations,[]);metrics('normal',r.velocityCheck.maxima);
   for(const key of ['contactGeometry','positionCheck','ledgerCheck']){assert.equal(r[key].resolved,true);assert.deepEqual(r[key].violations,[]);metrics(key,r[key].metrics);}
  }
 },source.archive.compressedSha256);
}finally{closeSync(runtime);}
assert.equal(recovered.status,'ARCHIVE_VERIFIED');assert.equal(records,1115);assert.equal(terminal,155);assert.equal(hash.digest('hex'),source.bodyOnlySha256);
assert.deepEqual([...pending],[['position1','1115:world']]);
const result={status:'PASS_OFFLINE_RECOVERY_OF_FAILED_CAMPAIGN_PREFIX_ONLY',sourceCampaignStatus:source.status,recovered,contiguousPhaseRecords:1114,initialRecords:1,referenceWires:counts,pendingReferenceWires:[...pending],baseline960BodySHA256:baseline,terminalRecordFrames:terminal,terminalEndSeconds:1114/120,maxima,solverCalls:0,worldCalls:0,referenceCalls:0,originalIndependentFullPhysics:false,full1200:false,API:false,scope:'Data recovery and recorded gate flags only; no new physical oracle or live deadline qualification. Original failed campaign remains FAIL.'};
const bytes=Buffer.from(JSON.stringify(result,null,2)+'\n');assert.ok(bytes.length<=65536);writeFileSync(join(home,'evidence/full-01/offline-recovery.json'),bytes,{flag:'wx'});console.log(JSON.stringify({status:result.status,records,terminal,encodedBytes:bytes.length}));
