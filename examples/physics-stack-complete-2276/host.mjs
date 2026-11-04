// One scene only, under its direct Python owner's single180s group.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const [out,pinsSHA,remainingText,groupText,mode,scene,budgetPath]=process.argv.slice(2),deadline=Date.now()+Number(remainingText),steps=mode==='prefix'?16:mode==='full'?1200:0;
assert.ok(steps);assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
const hash=path=>{const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const pinsPath=join(home,'PINS.json');assert.equal(hash(pinsPath),pinsSHA);const pins=JSON.parse(readFileSync(pinsPath));
function authenticate(){assert.equal(hash(pinsPath),pinsSHA);for(const [name,pin]of Object.entries(pins.files)){const p=resolve(root,name);assert.equal(statSync(p).size,pin.bytes);assert.equal(hash(p),pin.sha256);}const seal=JSON.parse(readFileSync(join(home,'SOURCE-SEAL.json')));for(const [name,sha]of Object.entries(seal.files))assert.equal(hash(join(home,name)),sha);return hash(join(home,'SOURCE-SEAL.json'));}
const sealSHA=authenticate();writeFileSync(join(out,'inputs-before.json'),JSON.stringify({pinsSHA,sealSHA,providerDigest:pins.providerDigest,mode,scene,steps})+'\n',{flag:'wx'});
let result=null,error=null,integrity=false;
const timer=setTimeout(()=>{writeFileSync(join(out,'host-deadline.json'),JSON.stringify({status:'CPUUNKNOWN',reason:'ONE_SCENE170_INTERNAL_DEADLINE',reachedDiagnosticsUnavailableOnExternalTermination:true})+'\n',{flag:'wx'});process.exit(1);},Math.max(1,Math.floor(deadline-Date.now())));
try{
 const {campaign}=await import('./driver.mjs');result=await campaign({root,out,pins,deadline,python:pins.python,scene,steps,budgetPath});assert.equal(result.status,'COMPLETE_SCENE_PHYSICAL_CONFIRMED');
 for(const key of ['producerAttempted','producerReturned','normalKktPassed','fullyVerifiedPhaseSteps','archived','contiguousPhysicalAccepted'])assert.equal(result.counts[key],steps);
 for(const [op,n]of [['contacts',steps],['world',steps],['step-ledger',steps],['quality',steps+1]])for(const key of ['attempted','replied','resolved','passed'])assert.equal(result.counts.reference[op][key],n);
 assert.equal(result.recovery.status,'ARCHIVE_VERIFIED');assert.equal(result.recovery.records,steps+1);assert.equal(result.recovery.originalWireEntriesCompared,130);assert.equal(result.prefixParity.records,17);assert.equal(result.prefixParity.wirePairs,65);assert.equal(result.lastContiguous,steps);assert.equal(result.firstObserved,null);assert.equal(result.executionFailure,null);
 if(steps===1200){assert.equal(result.baselinePromoted,true);assert.equal(result.terminalQualityPassed,241);assert.equal(result.baseline960.step,960);}
 assert.equal(authenticate(),sealSHA);integrity=true;assert.ok(Date.now()<deadline,'scene170 includes reauthentication and closure');
}catch(e){error={name:e.name,code:e.code??null,message:String(e.message).slice(0,1024)};}finally{clearTimeout(timer);}
const children=(result?.cleanup??[]).filter(x=>x.label),producer=(result?.cleanup??[]).find(x=>x.producer)?.producer;
const clean=children.length===3&&children.map(x=>x.label).join(',')==='geometry,position0,position1'&&new Set(children.map(x=>x.pid)).size===3&&children.every(x=>x.closed&&x.exit===0&&x.signal===null&&x.stderrBytes===0&&x.trailingBytes===0&&x.error===null&&x.requests===x.replies);
const joined=!!producer&&producer.joinedByPinnedClose&&producer.exit===0&&producer.logBytes===0&&producer.fatal===null;
const metadata={protocol:'stack-complete-scene-cpu-v1',pid:process.pid,ppid:process.ppid,expectedPgid:Number(groupText),sourceIntegrity:integrity,sourceSeal:sealSHA,status:error?'HOST_STOPPED':'HOST_PHYSICAL_SCENE_CONFIRMED',error,allReaped:!error&&clean&&joined,mode,scene,steps,children:children.map(x=>({role:x.label,pid:x.pid,closed:x.closed,exit:x.exit,signal:x.signal,stderrBytes:x.stderrBytes,trailingBytes:x.trailingBytes,error:x.error,requests:x.requests,replies:x.replies})),producer:{joinedByPinnedClose:joined,exit:producer?.exit??null,threadId:'NOT_CAPTURED_NOT_INVENTED'},counts:result?.counts??null,resultSHA256:result?hash(join(out,'result.json')):null,originalIndependentFullPhysics:false,strictGlobal64MiBCertification:'NOT_QUALIFIED',API:false};
const line=JSON.stringify(metadata)+'\n';assert.ok(Buffer.byteLength(line)<=16384);writeFileSync(join(out,'closure.json'),line,{flag:'wx'});process.stdout.write(line);process.exitCode=metadata.allReaped?0:1;
