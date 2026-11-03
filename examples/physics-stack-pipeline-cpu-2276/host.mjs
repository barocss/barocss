// One direct Node child. Reuse the sealed driver; no test process or supervisor.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),pipeline=join(root,'examples/physics-stack-pipeline-2276');
const [out,pinsSHA,remainingText,groupText]=process.argv.slice(2),deadline=Date.now()+Number(remainingText),expectedGroup=Number(groupText);
const hash=path=>{const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const pinsPath=join(home,'PINS.json');assert.equal(hash(pinsPath),pinsSHA);const config=JSON.parse(readFileSync(pinsPath,'utf8')),pins=JSON.parse(readFileSync(join(pipeline,'PINS.json'),'utf8'));
function authenticate(){
 assert.equal(hash(pinsPath),pinsSHA);for(const [name,pin]of Object.entries(config.files)){const p=resolve(root,name);assert.equal(statSync(p).size,pin.bytes);assert.equal(hash(p),pin.sha256);}
 for(const [name,pin]of Object.entries(pins.files)){const p=resolve(root,name);assert.equal(statSync(p).size,pin.bytes);assert.equal(hash(p),pin.sha256);}
 const seal=JSON.parse(readFileSync(join(pipeline,'SOURCE-SEAL.json'),'utf8'));for(const [name,sha]of Object.entries(seal.files))assert.equal(hash(join(pipeline,name)),sha);
 return {pipelineSeal:hash(join(pipeline,'SOURCE-SEAL.json')),newPins:hash(pinsPath)};
}
const frozen=authenticate();assert.equal(frozen.pipelineSeal,'c74b021da1d1a5b9af2ef814efc92c14fd0d7009c1202c89fa2d90b2892241f7');
const controls=JSON.parse(readFileSync(join(pipeline,'evidence/prefix-02/controls-result.json'),'utf8')),priorInputs=JSON.parse(readFileSync(join(pipeline,'evidence/prefix-02/inputs-before.json'),'utf8'));
assert.equal(controls.exit,0);assert.equal(controls.signal,null);assert.match(readFileSync(join(pipeline,'evidence/prefix-02/controls.stdout'),'utf8'),/# tests 18\b/);assert.equal(priorInputs.own['SOURCE-SEAL.json'],frozen.pipelineSeal);
writeFileSync(join(out,'host-inputs-before.json'),JSON.stringify(frozen)+'\n');writeFileSync(join(out,'budget.json'),JSON.stringify({bytes:4*1024*1024,cap:280*1024*1024,reserveIncludesControllerAndClosure:true})+'\n');
let result=null,error=null,integrity=false;
const timer=setTimeout(()=>{writeFileSync(join(out,'host-deadline.json'),JSON.stringify({status:'CPUUNKNOWN',reason:'INTERNAL170S_REMAINING_DEADLINE',descendantClosure:'UNAVAILABLE'})+'\n');process.exit(1);},Math.max(1,Math.floor(deadline-Date.now())));
try{
 const {campaign}=await import('../physics-stack-pipeline-2276/driver.mjs');result=await campaign({root,home:pipeline,out,pins,deadline,python:config.python});
 assert.equal(result.status,'PIPELINE_PREFIX_PHYSICAL_PARITY_CONFIRMED');assert.equal(result.firstObserved,null);assert.equal(result.executionFailure,null);
 for(const key of ['producerReturned','normalKktPassed','fullyVerifiedPhaseSteps','archived','contiguousPhysicalAccepted'])assert.equal(result.counts[key],48);
 assert.equal(result.counts.independentlyFullAccepted,0);assert.equal(result.reports.length,3);
 for(const [op,count]of [['contacts',48],['world',48],['step-ledger',48],['quality',51]])for(const key of ['attempted','replied','passed'])assert.equal(result.counts.reference[op][key],count);
 assert.deepEqual(authenticate(),frozen);integrity=true;assert.ok(Date.now()<deadline);
}catch(e){error={name:e.name,message:e.message};}
finally{clearTimeout(timer);}
const children=(result?.cleanup??[]).filter(x=>x.label),producer=(result?.cleanup??[]).find(x=>x.producer)?.producer;
const cleanChildren=children.length===3&&new Set(children.map(x=>x.pid)).size===3&&children.every(x=>x.closed&&x.exit===0&&x.signal===null&&x.stderrBytes===0&&x.trailingBytes===0&&x.error===null&&x.requests===x.replies);
const joined=!!producer&&producer.exit===0&&producer.logBytes===0&&producer.fatal===null;
const metadata={protocol:'stack-real-pipeline-cpu-v1',pid:process.pid,ppid:process.ppid,expectedPgid:expectedGroup,sourceIntegrity:integrity,pipelineSeal:frozen.pipelineSeal,status:error?'HOST_STOPPED':'HOST_PHYSICAL_PREFIX_CONFIRMED',error,
 allReaped:!error&&cleanChildren&&joined,children:children.map(x=>({role:x.label,pid:x.pid,closed:x.closed,exit:x.exit,signal:x.signal,stderrBytes:x.stderrBytes,trailingBytes:x.trailingBytes,error:x.error,requests:x.requests,replies:x.replies})),
 producer:{joinedByPinnedClose:joined,exit:producer?.exit??null,threadId:'NOT_CAPTURED_NOT_INVENTED',evidence:'SEALED_DRIVER_AWAITS_ITS_OWN_WORKER_EXIT_EVENT'},counts:result?.counts??null,resultSHA256:result?hash(join(out,'result.json')):null,independentlyFullAccepted:0,API:false,full1200:false,resourceQualification:false};
const line=JSON.stringify(metadata)+'\n';assert.ok(Buffer.byteLength(line)<=16384);writeFileSync(join(out,'host-closure.json'),line);process.stdout.write(line);process.exitCode=metadata.allReaped?0:1;
