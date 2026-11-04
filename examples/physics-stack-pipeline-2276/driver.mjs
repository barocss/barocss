import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Window,SerialReference,Cancelled,verifyFingerprint,terminateOwnedWorker,STEPS} from './protocol.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const state=(bodies,step,contacts=[])=>({bodies,contacts,stepIndex:step,timeSeconds:step*(1/120)});
class Producer {
 constructor(data,deadline,out,budget){
  this.worker=new Worker(new URL('./producer.mjs',import.meta.url),{workerData:data,stdout:true,stderr:true});this.deadline=deadline;this.out=out;this.budget=budget;this.pending=null;this.sequence=0;this.frames=[];this.logs=[];this.logBytes=0;this.fatal=null;this.exit=null;
  this.closed=new Promise(resolve=>{this.resolveClose=resolve;});
  const reject=e=>{this.fatal??=e;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=null;}};
  for(const pipe of [this.worker.stdout,this.worker.stderr])pipe.on('data',b=>{this.logBytes+=b.length;if(this.logBytes<=128*1024)this.logs.push(b);else reject(Error('producer output bound'));});
  this.worker.on('error',error=>reject(Object.assign(error,{unresolved:true})));this.worker.on('exit',code=>{this.exit=code;if(this.pending)reject(Object.assign(Error('producer exit while request pending'),{unresolved:true}));this.resolveClose(code);});
  this.worker.on('message',frame=>{
   const pending=this.pending;if(!pending){reject(Error('unsolicited producer frame'));return;}this.pending=null;clearTimeout(pending.timer);
   try{
    assert.equal(frame.id,pending.id);assert.ok(['initial','packet','failure','failure-metadata'].includes(frame.type));
    if(frame.type==='failure-metadata')throw Object.assign(Error(frame.failure.message),frame.failure,{diagnosticsUnavailable:true});
    verifyFingerprint(frame.packet,frame.proof);assert.ok(frame.wire instanceof Uint8Array&&frame.wire.byteLength<=2*1024*1024);assert.equal(sha(frame.wire),frame.wireSha256);
    this.budget.save(join(this.out,`producer-${frame.id}.packet.v8`),frame.wire);this.frames.push({id:frame.id,type:frame.type,scene:frame.packet.scene??frame.packet.failure?.scene,step:frame.packet.step??frame.packet.failure?.step,proof:frame.proof,wireBytes:frame.wire.byteLength,wireSha256:frame.wireSha256});
    if(frame.type==='failure')throw Object.assign(Error(frame.packet.failure.message),frame.packet.failure,{producerDiagnostics:frame.packet.diagnostics});
    assert.equal(frame.type,pending.type==='init'?'initial':'packet');pending.resolve(frame.packet);
   }catch(error){pending.reject(error);}
  });
 }
 request(type,fields={}){assert.equal(this.pending,null);if(this.fatal)throw this.fatal;const id=++this.sequence,remaining=Math.floor(this.deadline-Date.now());assert.ok(remaining>0);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending=null;reject(Object.assign(Error('producer remaining deadline'),{unresolved:true}));},remaining);this.pending={id,type,resolve,reject,timer};this.worker.postMessage({id,type,...fields});});}
 stop(){this.worker.postMessage({type:'stop'});}
 async close(failed){
  if(failed)await terminateOwnedWorker(this.worker,1000);
  else{assert.equal(this.pending,null);this.worker.postMessage({type:'close'});let timer;try{await Promise.race([this.closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('producer clean close deadline')),1000);})]);}catch(error){await terminateOwnedWorker(this.worker,1000);throw error;}finally{clearTimeout(timer);}assert.equal(this.exit,0);assert.equal(this.logBytes,0);assert.equal(this.fatal,null);}
  this.budget.save(join(this.out,'producer-output.raw'),Buffer.concat(this.logs));return {exit:this.exit,logBytes:this.logBytes,fatal:this.fatal?.message??null,frames:this.frames};
 }
}
export async function campaign({root,home,out,pins,deadline,python}){
 const provider=resolve(root,pins.provider),native=resolve(root,pins.native);
 const {archive,evidenceBudget,json,observer,raw,wire}=await import(pathToFileURL(join(native,'examples/physics-stack-library-2276/io.mjs')));
 const verification=await import(pathToFileURL(join(native,'examples/physics-stack-solver-2276/verification.js'))),{verifyNormalKkt}=verification.default??verification;
 const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs')));
 const budget=evidenceBudget(join(out,'budget.json')),producer=new Producer({provider,native,providerDigest:pins.providerDigest},deadline,out,budget),reports=[],failures=[],cleanup=[];
 const counts={producerReturned:0,normalKktPassed:0,fullyVerifiedPhaseSteps:0,archived:0,contiguousPhysicalAccepted:0,independentlyFullAccepted:0,reference:{}};
 for(const op of ['contacts','world','step-ledger','quality'])counts.reference[op]={attempted:0,replied:0,passed:0,shadowReplies:0};
 let window=null,firstObserved=null,executionFailure=null,lastAccepted=null;
 const refs={geometry:observer(join(root,'examples/physics-stack-solver-2276/trajectory-reference.py'),out,'geometry',deadline,budget,python)};
 for(const shard of [0,1])refs['position'+shard]=observer(join(root,'examples/physics-stack-reference-prepared-2276/candidate.py'),out,'position'+shard,deadline,budget,python);
 const queues=Object.fromEntries(Object.entries(refs).map(([label,ref])=>[label,new SerialReference(ref,step=>window.canResolve(step))])),observerCalls={geometry:0,position0:0,position1:0};
 function exactRecord(scene,step,record,frames){const old=pins.records[`${scene}:${step}`];assert.ok(old);assert.ok(old.json.bytes<=2*1024*1024&&old.raw.bytes<=2*1024*1024);assert.deepEqual(wire(record,2*1024*1024),gunzipSync(readFileSync(resolve(root,old.json.path)),{maxOutputLength:2*1024*1024}),'complete per-step record bytes');assert.deepEqual(Buffer.concat(frames.map(raw)),gunzipSync(readFileSync(resolve(root,old.raw.path)),{maxOutputLength:3744}),'complete per-step raw body words');}
 function fail(step,gate,error){const record=window.fail(step,gate,error);failures.push(record);firstObserved??=record;producer.stop();}
 const resolved=(value,label)=>{assert.equal(value.resolved,true,label+' unresolved');assert.notEqual(value.executionFailure,true,label+' execution failure');assert.deepEqual(value.violations,[],label+' physical failure');};
 function check(scene,step,op,request,validate){
  const label=op==='contacts'||op==='quality'?'geometry':'position'+(step%2),queue=queues[label],authority=pins.authority[`${scene}:${step}:${op}`];assert.ok(authority);
  return queue.run(step,async()=>{
   const counter=counts.reference[op];assert.equal(sha(wire(request)),authority.request.sha256,'semantic original request bytes');counter.attempted++;
   const ordinal=++observerCalls[label];let reply;try{reply=await queue.ref.ask(request);}catch(error){error.unresolved=true;throw error;}counter.replied++;assert.equal(sha(readFileSync(join(out,`${label}-${ordinal}-reply.json`))),authority.reply.sha256,'semantic original reply bytes');
   if(!window.canResolve(step)){counter.shadowReplies++;throw new Cancelled();}
   resolved(reply,op);validate?.(reply);counter.passed++;return reply;
  }).catch(error=>{if(!(error instanceof Cancelled))fail(step,op,error);throw error;});
 }
 try{
  for(const scene of ['ALIGNED','OFFSET','YAW']){
   window=new Window(scene);const config=fixture(scene),initialPacket=await producer.request('init',{scene});assert.equal(initialPacket.scene,scene);assert.equal(initialPacket.step,0);assert.equal(initialPacket.providerDigest,pins.providerDigest);
   const initial=state(initialPacket.bodies,0),writer=archive(out,scene+'-16',budget),jobs=new Map();let pendingProducer=null,nextProduce=1,received=0,producerLastBodies=raw(initialPacket.bodies),producerLastContacts=[],sceneFailure=null;
   lastAccepted={scene,state:initial};
   try{
    const quality=await check(scene,0,'quality',{op:'quality',request:{state:initial,initial,timeSeconds:0,referenceAt8s:null}});const first={kind:'initial',scene,state:initial,quality};exactRecord(scene,0,first,[initialPacket.bodies]);writer.write(first,[initialPacket.bodies]);
    const commit=()=>{
     for(let slot=window.ready();slot;slot=window.ready()){
      try{window.beginArchive(slot.step);const {record,frames}=slot.value;exactRecord(scene,slot.step,record,frames);writer.write(record,frames);counts.archived++;lastAccepted={scene,state:record.after};window.archived(slot.step);counts.contiguousPhysicalAccepted++;}
      catch(error){fail(slot.step,'archive',error);break;}
     }
    };
    const verify=async packet=>{
     const step=packet.step,p=packet.prepared,d=p.diagnostics,attempt=d.positionAttempt,s=d.positionStats;
     try{
      window.phase(step,'proof');const velocityCheck=verifyNormalKkt(d.normalProblem,d.normalResult);assert.ok(velocityCheck.passed,'independent normal KKT');counts.normalKktPassed++;
      assert.equal(d.pointLedger.length,d.normalProblem.points.length);assert.ok(d.pointLedger.length<=32);if(step===1)assert.equal(d.pointLedger.length,32);
      for(const key of ['tests','rows','postPairTests'])assert.equal(s[key],36);assert.equal(attempt.problem.rows.length,36);assert.equal(attempt.rowSources.length,36);assert.equal(s.solverCalls,1);assert.equal(s.workingApplicationCount,1);
      for(const point of d.pointLedger){assert.equal(point.warm.normalNs,0);assert.deepEqual(point.warm.tangentNs,[0,0,0]);assert.deepEqual(point.final.tangentNs,[0,0,0]);}
      const ledger={beforeBodies:d.beforeBodies,freeBodies:d.freeBodies,velocityBodies:d.velocityBodies,finalBodies:p.candidateBodies,points:d.pointLedger,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],actions:[]},contacts=d.geometryPatches.map(x=>({aId:x.aId,bId:x.bId})),after=state(p.candidateBodies,step,contacts);
      const tasks=[
       check(scene,step,'contacts',{op:'contacts',freeBodies:d.freeBodies,pointLedger:d.pointLedger},reply=>assert.equal(reply.ok,true)),
       check(scene,step,'world',{op:'world',scene,stepIndex:step,config,preBodies:attempt.preBodies,preRawHex:raw(attempt.preBodies).toString('hex'),problem:attempt.problem,rowSelections:attempt.rowSources,result:attempt.result,hypBodies:attempt.hypotheticalBodies,hypRawHex:raw(attempt.hypotheticalBodies).toString('hex')},reply=>assert.ok(reply.metrics.maxHypDepthRawM<=1e-12&&reply.metrics.maxHypDepthNormalizedM<=1e-12)),
       check(scene,step,'step-ledger',{op:'step-ledger',scene,stepIndex:step,outcome:'accepted',ledger,raw:{before:raw(d.beforeBodies).toString('hex'),free:raw(d.freeBodies).toString('hex'),velocity:raw(d.velocityBodies).toString('hex'),final:raw(p.candidateBodies).toString('hex')}}),
       check(scene,step,'quality',{op:'quality',request:{state:after,initial,timeSeconds:after.timeSeconds,referenceAt8s:null}})
      ];
      const done=await Promise.allSettled(tasks),rejected=done.find(x=>x.status==='rejected');if(rejected)throw rejected.reason;if(!window.canResolve(step))throw new Cancelled();
      const [contactGeometry,positionCheck,ledgerCheck,quality]=done.map(x=>x.value),pointBytes=Buffer.alloc(d.normalProblem.points.length*48);let offset=0;for(const point of d.normalProblem.points)for(const n of [...point.pointM,...point.normalAtoB]){pointBytes.writeDoubleLE(n,offset);offset+=8;}
      const record={kind:'step',scene,step,before:state(packet.priorBodies,step-1,packet.priorContacts),prepared:p,pointOperandF64leHex:pointBytes.toString('hex'),velocityCheck,contactGeometry,positionCheck,ledgerCheck,quality,after};
      window.verified(step,{record,frames:[packet.priorBodies,d.freeBodies,d.velocityBodies,p.candidateBodies]});counts.fullyVerifiedPhaseSteps++;
     }catch(error){if(!(error instanceof Cancelled)&&!window.failures.has(step))fail(step,'normal/local/verification',error);}
    };
    const pump=()=>{
     if(pendingProducer||window.firstObserved||nextProduce>STEPS||window.slots.size>=3)return;
     const step=nextProduce++;window.hold(step);
     pendingProducer=producer.request('step',{step}).then(packet=>{
      counts.producerReturned++;assert.equal(packet.scene,scene);assert.equal(packet.step,received+1);assert.equal(packet.step,step);assert.equal(packet.providerDigest,pins.providerDigest);
      assert.deepEqual(raw(packet.priorBodies),producerLastBodies,'producer body-word chain');assert.deepEqual(raw(packet.prepared.diagnostics.beforeBodies),producerLastBodies,'diagnostic prior body linkage');assert.deepEqual(packet.priorContacts,producerLastContacts,'prior contacts linkage');
      producerLastBodies=raw(packet.prepared.candidateBodies);producerLastContacts=packet.prepared.diagnostics.geometryPatches.map(p=>({aId:p.aId,bId:p.bId}));received++;
      if(!window.canResolve(step)){window.phase(step,'ignored-shadow');return;}
      const task=verify(packet).finally(()=>jobs.delete(step));jobs.set(step,task);
     }).catch(error=>{if(window.canResolve(step))fail(step,'producer/structured-clone',error);else window.unknown(step);}).finally(()=>{pendingProducer=null;});
    };
    while(true){commit();pump();if(!pendingProducer&&jobs.size===0&&(window.firstObserved||nextProduce>STEPS))break;const active=[...jobs.values(),...(pendingProducer?[pendingProducer]:[])];assert.ok(active.length,'scheduler stalled');await Promise.race(active);}
    commit();if(window.firstObserved)throw Error('pipeline stopped at observed failure');assert.equal(window.contiguous,STEPS);assert.ok(window.peak<=3);
   }catch(error){sceneFailure=window.failureSummary()??{message:error.message};if(!firstObserved){fail(window.contiguous+1,'initial/scheduler',error);sceneFailure=window.failureSummary();}}
   finally{reports.push({scene,selectedSteps:16,phaseAccepted:window.contiguous,publicWorldAccepted:'NOT_RUN',failure:sceneFailure,evidence:writer.finish()});}
   if(firstObserved)break;
  }
  if(!firstObserved){const old=JSON.parse(readFileSync(resolve(root,'examples/physics-stack-library-2276/evidence/run-09/native/result.json'),'utf8')).reports.filter(r=>r.selectedSteps===16);assert.deepEqual(reports,old,'complete physical record/raw/word parity');assert.equal(counts.producerReturned,48);assert.equal(counts.archived,48);assert.equal(counts.contiguousPhysicalAccepted,48);}
 }catch(error){executionFailure={name:error.name,message:error.message};}
 finally{
  if(firstObserved||executionFailure)producer.stop();
  try{cleanup.push({producer:await producer.close(!!firstObserved||!!executionFailure)});}catch(error){cleanup.push({producerError:error.message});executionFailure??={name:error.name,message:error.message};}
  for(const [label,ref]of Object.entries(refs))try{cleanup.push({label,...await ref.close(!!firstObserved||!!executionFailure)});}catch(error){cleanup.push({label,error:error.message});executionFailure??={name:error.name,message:error.message};}
  if(firstObserved||executionFailure)try{json(join(out,'failure-state.json'),{firstObserved,executionFailure,window:window?.failureSummary(),lastAccepted,reached:[...window?.slots.values()??[]]});}catch(error){cleanup.push({failureEvidenceError:error.message});}
  budget.finish();
 }
 const result={status:firstObserved||executionFailure?'PIPELINE_PREFIX_STOPPED':'PIPELINE_PREFIX_PHYSICAL_PARITY_CONFIRMED',firstObserved,earliestFailure:window?.failureSummary(),executionFailure,counts,reports,cleanup,referencePools:Object.fromEntries(Object.entries(queues).map(([name,q])=>[name,{scheduled:q.ordinal,observerCalls:observerCalls[name],peakOutstanding:q.peak}])),producerPacketProofs:producer.frames,independentlyFullAccepted:0,API:false,publicWorld:'NOT_RUN',full1200:false,fullP4Qualification:false,resourceQualification:false,complete64MiBData:'NOT_QUALIFIED',completeOwnedLifetimeCpu:'NOT_QUALIFIED',RSS:'NOT_QUALIFIED'};
 json(join(out,'result.json'),result);return result;
}
