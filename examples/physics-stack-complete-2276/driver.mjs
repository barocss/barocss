// New composition only. Original mathematics and sealed hard16 pipeline stay untouched.
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,openSync,readSync,closeSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Window} from './window.mjs';
import {fingerprint,verifyFingerprint} from './fingerprint.mjs';
import {reference} from './reference.mjs';
import {CommittedBaseline} from './baseline.mjs';
import {captureFailureWindow,failureWindowMetadata,encodeFiniteFailure} from './failure-evidence.mjs';
import {StreamArchive,retainedBudget,verifyArchive} from '../physics-stack-stream-sized-2276/archive.mjs';
import {SerialReference,Cancelled,terminateOwnedWorker} from '../physics-stack-pipeline-2276/protocol.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),state=(bodies,step,contacts=[])=>({bodies,contacts,stepIndex:step,timeSeconds:step*(1/120)});
class Producer{
 constructor(data,deadline,onFatal){this.onFatal=onFatal;this.expectedExit=false;
  this.worker=new Worker(new URL('./producer.mjs',import.meta.url),{workerData:data,stdout:true,stderr:true});this.deadline=deadline;this.pending=null;this.sequence=0;this.logBytes=0;this.logs=[];this.fatal=null;this.exit=null;this.proofs=0;this.proofHash=createHash('sha256');this.prepareNs=0n;this.maxPrepareNs=0n;
  this.closed=new Promise(r=>this.resolveClose=r);const reject=e=>{const first=!this.fatal,step=this.pending?.step;this.fatal??=e;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=null;}if(first)this.onFatal?.(Object.assign(e,{unresolved:true}),step);};
  for(const pipe of [this.worker.stdout,this.worker.stderr])pipe.on('data',b=>{this.logBytes+=b.length;if(this.logBytes<=128*1024)this.logs.push(b);reject(Error('unexpected producer output'));});
  this.worker.on('error',e=>reject(Object.assign(e,{unresolved:true})));this.worker.on('exit',code=>{this.exit=code;if(this.pending||!this.expectedExit||code!==0)reject(Object.assign(Error('producer unexpected/pending exit'),{unresolved:true}));this.resolveClose();});
  this.worker.on('message',frame=>{
   const p=this.pending;if(!p){reject(Error('unsolicited producer packet'));return;}this.pending=null;clearTimeout(p.timer);
   try{
    assert.equal(frame.id,p.id);assert.ok(['initial','packet','failure','failure-metadata'].includes(frame.type));
    if(frame.type==='failure-metadata')throw Object.assign(Error(frame.failure.message),frame.failure,{name:frame.failure.errorClass,diagnosticsUnavailable:true});
    verifyFingerprint(frame.packet,frame.proof);this.proofs++;this.proofHash.update(JSON.stringify(frame.proof)+'\n');
    if(frame.type==='failure')throw Object.assign(Error(frame.packet.failure.message),frame.packet.failure,{name:frame.packet.failure.errorClass,producerDiagnostics:{failure:frame.packet.failure,inputBodies:frame.packet.inputBodies,diagnostics:frame.packet.diagnostics}});
    assert.equal(frame.type,p.type==='init'?'initial':'packet');assert.match(frame.prepareNs,/^[0-9]{1,20}$/);const elapsed=BigInt(frame.prepareNs);this.prepareNs+=elapsed;this.maxPrepareNs=this.maxPrepareNs>elapsed?this.maxPrepareNs:elapsed;
    p.resolve({packet:frame.packet,proof:frame.proof});
   }catch(e){p.reject(e);this.onFatal?.(e,p.step);}
  });
 }
 request(type,fields={}){assert.equal(this.pending,null);if(this.fatal)throw this.fatal;const id=++this.sequence,remaining=Math.floor(this.deadline-Date.now());assert.ok(remaining>0);return new Promise((resolve,reject)=>{this.pending={id,type,step:fields.step??0,resolve,reject,timer:setTimeout(()=>{this.pending=null;reject(Object.assign(Error('producer scene deadline'),{unresolved:true}));},remaining)};this.worker.postMessage({id,type,...fields});});}
 stop(){this.worker.postMessage({type:'stop'});}
 async close(failed){
  this.expectedExit=true;if(failed)await terminateOwnedWorker(this.worker,1000);else{assert.equal(this.pending,null);this.worker.postMessage({type:'close'});let timer;try{await Promise.race([this.closed,new Promise((_,r)=>{timer=setTimeout(()=>r(Error('producer close deadline')),1000);})]);}catch(e){await terminateOwnedWorker(this.worker,1000);throw e;}finally{clearTimeout(timer);}assert.equal(this.exit,0);assert.equal(this.logBytes,0);assert.equal(this.fatal,null);}
  return {exit:this.exit,logBytes:this.logBytes,fatal:this.fatal?.message??null,joinedByPinnedClose:true,proofs:this.proofs,proofSha256:this.proofHash.digest('hex'),prepareNs:String(this.prepareNs),maxPrepareNs:String(this.maxPrepareNs)};
 }
}
export async function campaign({root,out,pins,deadline,python,scene,steps,budgetPath}){
 assert.ok(steps===16||steps===1200);assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
 const workDeadline=deadline-4000;assert.ok(workDeadline>Date.now(),'four-second scene cleanup reserve');
 const provider=resolve(root,pins.provider),native=resolve(root,pins.native),{raw,wire}=await import(pathToFileURL(join(native,'examples/physics-stack-library-2276/io.mjs')));
 const verification=await import(pathToFileURL(join(native,'examples/physics-stack-solver-2276/verification.js'))),{verifyNormalKkt}=verification.default??verification;
 const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs')));
 const old=JSON.parse(readFileSync(resolve(root,'examples/physics-stack-pipeline-2276/PINS.json'))),budget=retainedBudget(JSON.parse(readFileSync(budgetPath))),window=new Window(scene,steps);let archive=null,producer=null,runtimeFd=null;
 const counts={requested:steps,producerAttempted:0,producerReturned:0,normalKktPassed:0,fullyVerifiedPhaseSteps:0,archived:0,contiguousPhysicalAccepted:0,recordGroups:0,oldWirePairsCompared:0,oldRecordsCompared:0,runtimeFramesCompared:0,independentlyFullAccepted:0,reference:{}};
 const timing={normalKktNs:0n,archiveNs:0n,referenceAskNs:0n},workMax={},cleanup=[];for(const op of ['contacts','world','step-ledger','quality'])counts.reference[op]={attempted:0,replied:0,resolved:0,passed:0,shadowReplies:0};
 const refs={},queues={},runtimePath=resolve(root,pins.runtimeFrames[scene]),bodyHash=createHash('sha256'),prefixBodyHash=createHash('sha256'),prefixRecordHash=createHash('sha256'),prefixWordsHash=createHash('sha256');
 let firstObserved=null,executionFailure=null,failureData=null,failureWindow=null,failureEvidence=null,lastAccepted=null,initial=null,baseline960=null,baseline960Identity=null,baselinePromoted=false,terminalQualityPassed=0,archiveReceipt=null,recovery=null,bodyBytes=0,prefixParity=null;
 const baseline=new CommittedBaseline();
 const resolved=(value,label)=>{assert.equal(value.resolved,true,label+' unresolved');assert.notEqual(value.executionFailure,true,label+' execution refusal');};
 function fail(step,gate,error,data=null){const bounded=Object.assign(new Error(String(error.message).slice(0,1024)),{name:error.name,code:error.code,unresolved:error.unresolved===true});const record=window.fail(step,gate,bounded);if(!firstObserved){firstObserved=record;failureData=data??(error.producerDiagnostics?{producerDiagnostics:error.producerDiagnostics}:null);producer?.stop();baseline.stop();try{failureWindow=captureFailureWindow(window,step);}catch(e){failureWindow={captureStatus:'CAPTURE_FAILED',selectedStep:null,selectedFrame:null,selectionReason:'CAPTURE_FAILED',firstCandidateMissing:null,availabilityAtCapture:[],captureError:String(e.message).slice(0,256)};}}}
 function runtimeFrame(bodies,step){const actual=raw(bodies),expected=Buffer.alloc(936);assert.equal(readSync(runtimeFd,expected,0,936,step*936),936,'complete runtime05 frame');assert.deepEqual(actual,expected,'runtime05 determinism only');counts.runtimeFramesCompared++;}
 function exactRecord(step,record,body,points){
  if(step>16)return;const entry=old.records[`${scene}:${step}`];assert.ok(entry);assert.ok(entry.json.bytes<=2**21&&entry.raw.bytes<=2**21);
  const json=gunzipSync(readFileSync(resolve(root,entry.json.path)),{maxOutputLength:2**21}),rb=gunzipSync(readFileSync(resolve(root,entry.raw.path)),{maxOutputLength:3744});assert.deepEqual(wire(record,2**21),json,'complete old physical record JSON bytes');assert.deepEqual(body,rb,'complete old four-phase raw body bytes');
  const prior=JSON.parse(json);assert.deepEqual(points,Buffer.from(prior.pointOperandF64leHex??'','hex'),'original point operand raw words');prefixRecordHash.update(json);prefixBodyHash.update(body);counts.oldRecordsCompared++;
 }
 function numericWords(record,consume){if(typeof record==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(record);consume(b);}else if(record&&typeof record==='object')for(const key of Object.keys(record))numericWords(record[key],consume);}
 async function writeRecord(step,record,frames,points,proof){
  const body=Buffer.concat(frames.map(raw),frames.length*936);exactRecord(step,record,body,points);if(step<=16)numericWords(record,b=>prefixWordsHash.update(b));
  const start=process.hrtime.bigint();await archive.appendRecord(scene,step,record,body,points,proof.sha256);timing.archiveNs+=process.hrtime.bigint()-start;bodyHash.update(body);bodyBytes+=body.length;counts.recordGroups++;
 }
 async function check(step,op,request,validate){
  const label=op==='contacts'||op==='quality'?'geometry':'position'+(step%2),authority=step<=16?old.authority[`${scene}:${step}:${op}`]:null;
  return queues[label].run(step,async()=>{
   const count=counts.reference[op];count.attempted++;const start=process.hrtime.bigint();let response;try{response=await queues[label].ref.ask(step,op,request);}catch(e){e.unresolved=true;throw e;}finally{timing.referenceAskNs+=process.hrtime.bigint()-start;}
   count.replied++;if(authority){assert.equal(response.requestSHA,authority.request.sha256,'old semantic request byte hash');assert.equal(response.replySHA,authority.reply.sha256,'old semantic reply byte hash');counts.oldWirePairsCompared++;}
   if(!window.canResolve(step)){count.shadowReplies++;throw new Cancelled();}resolved(response.value,op);count.resolved++;assert.deepEqual(response.value.violations,[],op+' physical failure');validate?.(response.value);count.passed++;return response.value;
  }).catch(error=>{if(!(error instanceof Cancelled))fail(step,op,error);throw error;});
 }
 const jobs=new Map();let pendingProducer=null,nextProduce=1,received=0,producerLastBodies=null,producerLastContacts=[];
 try{
  runtimeFd=openSync(runtimePath,'r');archive=new StreamArchive(out,budget);producer=new Producer({provider,native,providerDigest:pins.providerDigest,steps},workDeadline,(e,step)=>fail(step??window.contiguous+1,'producer fatal',e));
  for(const label of ['geometry','position0','position1'])refs[label]=reference({path:join(root,label==='geometry'?'examples/physics-stack-solver-2276/trajectory-reference.py':'examples/physics-stack-reference-prepared-2276/candidate.py'),label,python,scene,deadline:workDeadline,archive,wire,onFailure:(e,id)=>fail(id?.step??window.contiguous+1,label+' IO',e)});
  for(const [label,ref]of Object.entries(refs))queues[label]=new SerialReference(ref,step=>window.canResolve(step));
  const first=await producer.request('init',{scene}),packet=first.packet;assert.equal(packet.scene,scene);assert.equal(packet.step,0);assert.equal(packet.providerDigest,pins.providerDigest);initial=state(packet.bodies,0);lastAccepted=initial;producerLastBodies=raw(packet.bodies);runtimeFrame(packet.bodies,0);
  const quality=await check(0,'quality',{op:'quality',request:{state:initial,initial,timeSeconds:0,referenceAt8s:null}});await writeRecord(0,{kind:'initial',scene,state:initial,quality},[packet.bodies],Buffer.alloc(0),first.proof);
  const commit=async()=>{for(let slot=window.ready();slot;slot=window.ready()){
   try{window.beginArchive(slot.step);const {record,frames,points,proof}=slot.value;await writeRecord(slot.step,record,frames,points,proof);counts.archived++;lastAccepted=record.after;delete slot.received;window.archived(slot.step);counts.contiguousPhysicalAccepted++;
    if(slot.step===960){baseline960=record.after;baseline960Identity={step:960,bodyRawSha256:sha(raw(baseline960.bodies)),stateFingerprint:slot.value.afterFingerprint};baseline.commit(960,window.contiguous,baseline960,baseline960Identity);baselinePromoted=true;}
   }catch(e){fail(slot.step,'archive',e,slot.value?.record?.prepared??null);break;}
  }};
  const verify=async receivedPacket=>{
   const packet=receivedPacket.packet,step=packet.step,p=packet.prepared,d=p.diagnostics,attempt=d.positionAttempt,s=d.positionStats;
   try{
    window.phase(step,'proof');const start=process.hrtime.bigint(),velocityCheck=verifyNormalKkt(d.normalProblem,d.normalResult);timing.normalKktNs+=process.hrtime.bigint()-start;assert.ok(velocityCheck.passed,'independent normal KKT');counts.normalKktPassed++;
    assert.equal(d.pointLedger.length,d.normalProblem.points.length);assert.ok(d.pointLedger.length<=32);if(step===1)assert.equal(d.pointLedger.length,32);
    for(const key of ['tests','rows','postPairTests'])assert.equal(s[key],36);assert.equal(attempt.problem.rows.length,36);assert.equal(attempt.rowSources.length,36);assert.equal(s.solverCalls,1);assert.equal(s.workingApplicationCount,1);
    for(const [k,v]of Object.entries(s))if(typeof v==='number'&&Number.isFinite(v))workMax[k]=Math.max(workMax[k]??-Infinity,v);
    for(const point of d.pointLedger){assert.equal(point.warm.normalNs,0);assert.deepEqual(point.warm.tangentNs,[0,0,0]);assert.deepEqual(point.final.tangentNs,[0,0,0]);}
    const ledger={beforeBodies:d.beforeBodies,freeBodies:d.freeBodies,velocityBodies:d.velocityBodies,finalBodies:p.candidateBodies,points:d.pointLedger,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],actions:[]},contacts=d.geometryPatches.map(x=>({aId:x.aId,bId:x.bId})),after=state(p.candidateBodies,step,contacts);
    const qualityTask=async()=>{const referenceAt8s=await baseline.forQuality(step,after,()=>window.canResolve(step));if(step>960)assert.ok(baseline.promoted);return check(step,'quality',{op:'quality',request:{state:after,initial,timeSeconds:after.timeSeconds,referenceAt8s}});};
    const tasks=[check(step,'contacts',{op:'contacts',freeBodies:d.freeBodies,pointLedger:d.pointLedger},reply=>assert.equal(reply.ok,true)),
     check(step,'world',{op:'world',scene,stepIndex:step,config:fixture(scene),preBodies:attempt.preBodies,preRawHex:raw(attempt.preBodies).toString('hex'),problem:attempt.problem,rowSelections:attempt.rowSources,result:attempt.result,hypBodies:attempt.hypotheticalBodies,hypRawHex:raw(attempt.hypotheticalBodies).toString('hex')},reply=>assert.ok(reply.metrics.maxHypDepthRawM<=1e-12&&reply.metrics.maxHypDepthNormalizedM<=1e-12)),
     check(step,'step-ledger',{op:'step-ledger',scene,stepIndex:step,outcome:'accepted',ledger,raw:{before:raw(d.beforeBodies).toString('hex'),free:raw(d.freeBodies).toString('hex'),velocity:raw(d.velocityBodies).toString('hex'),final:raw(p.candidateBodies).toString('hex')}}),qualityTask()];
    const done=await Promise.allSettled(tasks),bad=done.find(x=>x.status==='rejected');if(bad)throw bad.reason;if(!window.canResolve(step))throw new Cancelled();
    const [contactGeometry,positionCheck,ledgerCheck,quality]=done.map(x=>x.value),pointBytes=Buffer.alloc(d.normalProblem.points.length*48);let offset=0;for(const point of d.normalProblem.points)for(const n of [...point.pointM,...point.normalAtoB]){pointBytes.writeDoubleLE(n,offset);offset+=8;}
    if(step>=960)terminalQualityPassed++;runtimeFrame(p.candidateBodies,step);
    const record={kind:'step',scene,step,before:state(packet.priorBodies,step-1,packet.priorContacts),prepared:p,pointOperandF64leHex:pointBytes.toString('hex'),velocityCheck,contactGeometry,positionCheck,ledgerCheck,quality,after};
    window.verified(step,{record,frames:[packet.priorBodies,d.freeBodies,d.velocityBodies,p.candidateBodies],points:pointBytes,proof:receivedPacket.proof,afterFingerprint:step===960?fingerprint(after):null});counts.fullyVerifiedPhaseSteps++;
   }catch(e){if(!(e instanceof Cancelled)){if(!failureData&&firstObserved?.step===step)failureData={input:packet.priorBodies,prepared:p};if(!window.failures.has(step))fail(step,'normal/local/verification',e,{input:packet.priorBodies,prepared:p});}}
  };
  const pump=()=>{
   if(pendingProducer||window.firstObserved||nextProduce>steps||window.slots.size>=3)return;const step=nextProduce++;window.hold(step);counts.producerAttempted++;
   pendingProducer=producer.request('step',{step}).then(frame=>{
    const packet=frame.packet;counts.producerReturned++;assert.equal(packet.scene,scene);assert.equal(packet.step,received+1);assert.equal(packet.step,step);assert.equal(packet.providerDigest,pins.providerDigest);assert.deepEqual(raw(packet.priorBodies),producerLastBodies,'producer ownership body chain');assert.deepEqual(raw(packet.prepared.diagnostics.beforeBodies),producerLastBodies,'actual prior diagnostic linkage');assert.deepEqual(packet.priorContacts,producerLastContacts);
    window.slots.get(step).received=frame;
    producerLastBodies=raw(packet.prepared.candidateBodies);producerLastContacts=packet.prepared.diagnostics.geometryPatches.map(p=>({aId:p.aId,bId:p.bId}));received++;
    if(!window.canResolve(step)){window.phase(step,'ignored-shadow');return;}const task=verify(frame).finally(()=>jobs.delete(step));jobs.set(step,task);
   }).catch(e=>{if(window.canResolve(step))fail(step,'producer/structured-clone',e);else window.unknown(step);}).finally(()=>{pendingProducer=null;});
  };
  while(true){await commit();pump();if(!pendingProducer&&jobs.size===0&&(window.firstObserved||nextProduce>steps))break;const active=[...jobs.values(),...(pendingProducer?[pendingProducer]:[])];assert.ok(active.length,'bounded scheduler stalled');await Promise.race(active);}
  await commit();if(window.firstObserved)throw Error('scene stopped at first observed failure');assert.equal(window.contiguous,steps);assert.ok(window.peak<=3);
 }catch(e){executionFailure={name:e.name,code:e.code??null,message:e.message};if(!firstObserved)fail(window.contiguous+1,'initial/scheduler',e);}
 finally{
  if(firstObserved||executionFailure){producer?.stop();baseline.stop();}
  const closing=[...(producer?[producer.close(!!firstObserved||!!executionFailure).then(value=>cleanup.push({producer:value})).catch(e=>{cleanup.push({producerError:e.message});executionFailure??={name:e.name,message:e.message};})]:[]),
   ...Object.entries(refs).map(async([label,ref])=>{try{const closed=await ref.close(!!firstObserved||!!executionFailure);cleanup.push(closed.receipt);if(closed.partial.length||closed.stderr.length){failureData??={};failureData.referencePartial??={};failureData.referencePartial[label]={step:closed.lastStep,partialHex:closed.partial.toString('hex'),stderrHex:closed.stderr.toString('hex')};}}catch(e){cleanup.push({label,error:e.message});executionFailure??={name:e.name,message:e.message};}})];
  await Promise.allSettled(closing);
  const unfinished=[...jobs.values(),...(pendingProducer?[pendingProducer]:[])];let settleTimer;
  try{await Promise.race([Promise.allSettled(unfinished),new Promise((_,reject)=>{settleTimer=setTimeout(()=>reject(Error('common cleanup remaining deadline')),Math.max(1,Math.min(1500,deadline-Date.now())));})]);}catch(e){executionFailure??={name:e.name,message:e.message};archive?.gzip.destroy(e);archive?.sink.destroy(e);await Promise.allSettled(unfinished);}finally{clearTimeout(settleTimer);}
  cleanup.sort((a,b)=>(a.producer?'':a.label??'').localeCompare(b.producer?'':b.label??''));
  try{if(archive)archiveReceipt=await archive.close();}catch(e){executionFailure??={name:e.name,code:e.code??null,message:e.message};}
  if(runtimeFd!==null)closeSync(runtimeFd);writeFileSync(budgetPath,JSON.stringify({cap:budget.cap,used:budget.used,reserve:budget.reserve})+'\n');
 }
 const bodyOnlySha256=bodyHash.digest('hex');
 if(!firstObserved&&!executionFailure)try{
  const recoveredBody=createHash('sha256'),recoveredPrefixBody=createHash('sha256'),recoveredPrefixJSON=createHash('sha256'),recoveredPrefixWords=createHash('sha256'),recoveredWires=Object.fromEntries(['geometry','position0','position1'].map(label=>[label,createHash('sha256')]));let recoveredOldWireEntries=0,recoveredRecords=0;
  recovery=await verifyArchive(join(out,'events.gz'),async entry=>{
   const h=entry.header;assert.equal(h.scene,scene);
   if(h.channel==='rpc'){
    const label=h.op==='contacts'||h.op==='quality'?'geometry':'position'+(h.step%2),digest=sha(entry.payload);recoveredWires[label].update(h.step+':'+h.op+':'+h.kind+':'+digest+'\n');
    if(h.step<=16){const authority=old.authority[`${scene}:${h.step}:${h.op}`];assert.ok(authority);assert.equal(digest,authority[h.kind].sha256,'recovered original semantic wire bytes');recoveredOldWireEntries++;}
   }else if(h.channel==='record'){
    assert.equal(h.step,recoveredRecords++,'contiguous recovered record groups');const r=entry.record,frames=h.step===0?[r.state.bodies]:[r.before.bodies,r.prepared.diagnostics.freeBodies,r.prepared.diagnostics.velocityBodies,r.prepared.candidateBodies];
    assert.deepEqual(entry.bodyRaw,Buffer.concat(frames.map(raw),frames.length*936),'recovered body words vs restored record');assert.deepEqual(entry.pointRaw,Buffer.from(r.pointOperandF64leHex??'','hex'),'recovered point words vs original hex');recoveredBody.update(entry.bodyRaw);
    if(h.step<=16){const authority=old.records[`${scene}:${h.step}`],json=gunzipSync(readFileSync(resolve(root,authority.json.path)),{maxOutputLength:2**21}),body=gunzipSync(readFileSync(resolve(root,authority.raw.path)),{maxOutputLength:3744});assert.deepEqual(entry.jsonBytes,json,'recovered original whole JSON bytes');assert.deepEqual(entry.bodyRaw,body,'recovered old four-phase body words');recoveredPrefixJSON.update(entry.jsonBytes);recoveredPrefixWords.update(entry.words);recoveredPrefixBody.update(entry.bodyRaw);}
   }else assert.fail('unexpected live archive channel');
  },archiveReceipt.compressedSha256);
  assert.equal(recovery.status,'ARCHIVE_VERIFIED');assert.equal(recovery.records,steps+1);assert.equal(recovery.entries,2*(4*steps+1)+steps+1);assert.equal(recoveredRecords,steps+1);assert.equal(recoveredBody.digest('hex'),bodyOnlySha256,'all recovered body-only words');assert.equal(recoveredOldWireEntries,130);
  for(const label of ['geometry','position0','position1'])assert.equal(recoveredWires[label].digest('hex'),cleanup.find(x=>x.label===label).wireTranscriptSha256,'all recovered original child wire bytes');
  const expected=JSON.parse(readFileSync(resolve(root,'examples/physics-stack-library-2276/evidence/run-09/native/result.json'))).reports.find(r=>r.scene===scene&&r.selectedSteps===16).evidence;
  prefixParity={records:counts.oldRecordsCompared,wirePairs:counts.oldWirePairsCompared,decodedRecordSha256:prefixRecordHash.digest('hex'),binary64BeWordSha256:prefixWordsHash.digest('hex'),bodyRawSha256:prefixBodyHash.digest('hex')};
  assert.equal(prefixParity.records,17);assert.equal(prefixParity.wirePairs,65);assert.equal(prefixParity.decodedRecordSha256,expected.decodedRecordSha256);assert.equal(prefixParity.binary64BeWordSha256,expected.binary64BeWordSha256);assert.equal(prefixParity.bodyRawSha256,expected.rawSha256);assert.equal(recoveredPrefixJSON.digest('hex'),expected.decodedRecordSha256);assert.equal(recoveredPrefixWords.digest('hex'),expected.binary64BeWordSha256);assert.equal(recoveredPrefixBody.digest('hex'),expected.rawSha256);recovery.originalWireEntriesCompared=130;recovery.bodyOnlySha256=bodyOnlySha256;
  if(steps===1200){assert.ok(baselinePromoted);assert.equal(terminalQualityPassed,241);assert.equal(statSync(runtimePath).size,1201*936);assert.equal(counts.runtimeFramesCompared,1201);}else assert.equal(counts.runtimeFramesCompared,17);
  assert.ok(Date.now()<deadline,'scene170 includes stream recovery');
 }catch(e){executionFailure={name:e.name,code:e.code??null,message:e.message};}
 if(firstObserved||executionFailure){
  const evidence={firstObserved,earliest:window.failureSummary(),executionFailure,lastAccepted,failureData,failureWindow,reachedDiagnosticsUnavailableOnExternalTermination:false};
  try{const bytes=encodeFiniteFailure(evidence,wire);budget.charge(bytes.length,true);writeFileSync(join(out,'failure.json'),bytes,{flag:'wx'});failureEvidence={file:'failure.json',selectedFramePersisted:!!failureWindow?.selectedFrame,includedFiniteNumberBits:'RECOVERABLE',aliasIdentityRestored:false,selection:failureWindowMetadata(failureWindow)};}
  catch(e){const omission={status:'FAILURE_EVIDENCE_OMITTED',fullPayloadOmitted:true,selectedFramePersisted:false,firstObserved,earliest:window.failureSummary(),executionFailure,evidenceError:{code:e.code??null,message:String(e.message).slice(0,1024)},lastContiguous:window.contiguous,failureWindow:failureWindowMetadata(failureWindow)};const bytes=encodeFiniteFailure(omission,wire);budget.charge(bytes.length,true);writeFileSync(join(out,'failure-metadata.json'),bytes,{flag:'wx'});failureEvidence={file:'failure-metadata.json',fullPayloadOmitted:true,selectedFramePersisted:false,includedFiniteNumberBits:'RECOVERABLE_METADATA_ONLY',aliasIdentityRestored:false,selection:failureWindowMetadata(failureWindow)};}
  writeFileSync(budgetPath,JSON.stringify({cap:budget.cap,used:budget.used,reserve:budget.reserve})+'\n');
 }
 const result={status:firstObserved||executionFailure?'COMPLETE_SCENE_STOPPED':'COMPLETE_SCENE_PHYSICAL_CONFIRMED',scene,selectedSteps:steps,counts,firstObserved,earliest:window.failureSummary(),executionFailure,cleanup,lastContiguous:window.contiguous,peakCredits:window.peak,baseline960:baseline960Identity,baselinePromoted,terminalQualityPassed,prefixParity,runtimeDeterminism:{frames:counts.runtimeFramesCompared,authority:'SAVED_RUNTIME05_BODY_WORDS_NOT_PHASE_ORACLE'},bodyOnlySha256,bodyBytes,archive:archiveReceipt,recovery,workMax,failureEvidence,timing:Object.fromEntries(Object.entries(timing).map(([k,v])=>[k,String(v)])),budget:{cap:budget.cap,used:budget.used,reserve:budget.reserve},originalIndependentFullPhysics:false,strictGlobal64MiBCertification:'NOT_QUALIFIED',API:false,publicWorld:'NOT_RUN',desktop:'NOT_RUN'};
 writeFileSync(join(out,'result.json'),wire(result,128*1024),{flag:'wx'});return result;
}
