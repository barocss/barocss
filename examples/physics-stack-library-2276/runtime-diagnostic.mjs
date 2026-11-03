// Root executes only after High review. No build or source-provider fallback.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync,existsSync,openSync,readSync,closeSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),self=fileURLToPath(import.meta.url);
const native=join(here,'evidence/run-04/native-modules');
const NODE='/Users/user/.volta/tools/image/node/22.19.0/bin/node',NODE_HASH='0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1';
const EXPECTED_RUNTIME='4d4120b87827ed1cb4a6389f9a1deff00873a4e448c22da2cd22317341004731',CAP=280*1024*1024;
const hash=path=>{const h=createHash('sha256'),b=Buffer.alloc(64*1024),fd=openSync(path,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
function authenticate(){
 assert.equal(realpathSync(process.execPath),realpathSync(NODE));assert.equal(hash(NODE),NODE_HASH);
 const paths=files(native).filter(p=>/\.(js|mjs|json)$/.test(p)&&(!relative(native,p).startsWith('examples/physics-stack-library-2276/')||p.endsWith('/io.mjs'))).sort();
 const entries=paths.map(p=>({path:relative(native,p),sha256:hash(p)})),h=createHash('sha256');
 for(const e of entries)h.update(e.path+'\0'+e.sha256+'\n');
 assert.equal(entries.length,37);assert.equal(h.digest('hex'),EXPECTED_RUNTIME,'run04 emitted bytes changed');
 return {runtime:entries,node:{path:NODE,sha256:NODE_HASH},runner:hash(self),contract:hash(join(here,'RUNTIME-DIAGNOSTIC-CONTRACT.md'))};
}
const [mode,arg,scene]=process.argv.slice(2);
if(mode!=='--scene'){
 const id=mode;assert.match(id??'',/^runtime-[a-z0-9-]{1,56}$/);
 const out=join(here,'evidence',id);assert.ok(!existsSync(out),'fresh diagnostic ID required');mkdirSync(out);
 const frozen=authenticate();writeFileSync(join(out,'inputs-before.json'),JSON.stringify(frozen,null,2)+'\n');
 writeFileSync(join(out,'budget.json'),JSON.stringify({bytes:1024*1024,cap:CAP,reservedSupervisorBytes:1024*1024})+'\n');
 const reports=[];let firstFailure=null;
 for(const name of ['ALIGNED','OFFSET','YAW']){
  const sceneStart=process.hrtime.bigint(),supervisorCpuStart=process.cpuUsage(),groupSignals=[];
  const child=spawn(NODE,[self,'--scene',out,name],{detached:true,stdio:['ignore','pipe','pipe']}),logs=[];let logBytes=0,stopReason=null;
  const signal=s=>{try{process.kill(-child.pid,s);groupSignals.push({signal:s,result:'SENT'});}catch(e){groupSignals.push({signal:s,result:e.code});if(e.code!=='ESRCH')throw e;}};
  let killTimer;const stop=reason=>{if(stopReason)return;stopReason=reason;signal('SIGTERM');killTimer=setTimeout(()=>signal('SIGKILL'),500);};
  const timer=setTimeout(()=>stop('OUTER180S_DEADLINE'),180000);
  for(const pipe of [child.stdout,child.stderr])pipe.on('data',b=>{logBytes+=b.length;if(logBytes<=128*1024)logs.push(b);else stop('SUPERVISOR_OUTPUT_BOUND');});
  const exit=await new Promise(r=>{child.on('error',e=>r({error:e.message}));child.on('close',(code,sig)=>r({code,signal:sig}));});
  clearTimeout(timer);clearTimeout(killTimer);signal('SIGKILL');
  writeFileSync(join(out,name+'-process.raw'),Buffer.concat(logs));
  const resultPath=join(out,name+'-result.json'),result=existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):null;
  const rawPath=join(out,name+'.f64le'),rawPresent=existsSync(rawPath),rawBytes=rawPresent?statSync(rawPath).size:0;
  const observedRaw={present:rawPresent,bytes:rawBytes,full936ByteFrames:Math.floor(rawBytes/936),trailingBytes:rawBytes%936,sha256:rawPresent?hash(rawPath):null,source:'PARENT_AFTER_CHILD_REAP'};
  const reachedDiagnosticsUnavailableOnExternalTermination=result===null&&(stopReason!==null||exit.signal!=null);
  reports.push({scene:name,...exit,stopReason,result,observedRaw,reachedDiagnosticsUnavailableOnExternalTermination,reachedDiagnosticsStatus:reachedDiagnosticsUnavailableOnExternalTermination?'UNAVAILABLE_ON_EXTERNAL_TERMINATION':result===null?'NO_CHILD_RECEIPT':'SEE_CHILD_RECEIPT',groupSignals,outerSceneWallNs:String(process.hrtime.bigint()-sceneStart),supervisorCpuUs:process.cpuUsage(supervisorCpuStart)});
  if(exit.code!==0||stopReason||result?.status!=='RUNTIME_DIAGNOSTIC_COMPLETED'){firstFailure={scene:name,...exit,stopReason,firstFailure:result?.firstFailure??null};break;}
 }
 let integrityFailure=null;try{assert.deepEqual(authenticate(),frozen);}catch(e){integrityFailure=e.message;firstFailure??={stage:'input-integrity',message:e.message};}
 const actualBytes=files(out).reduce((n,p)=>n+statSync(p).size,0);
 assert.ok(actualBytes<CAP-1024*1024,'shared280MiB final receipt reserve');
 writeFileSync(join(out,'result.json'),JSON.stringify({status:firstFailure?'RUNTIME_DIAGNOSTIC_STOPPED':'RUNTIME_DIAGNOSTIC_COMPLETED',firstFailure,integrityFailure,reports,actualBytesBeforeFinalReceipt:actualBytes,referenceVerified1200:false,independentlyFullAccepted:0,resourceQualification:false,API:false,fullP4Qualification:false},null,2)+'\n');
 process.exitCode=firstFailure?1:0;
}else{
 const out=arg;assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
 const deadline=Date.now()+170000,start=process.hrtime.bigint(),cpuStart=process.cpuUsage();
 const frozen=authenticate();
 const {raw,wire,wordsDigest}=await import(pathToFileURL(join(native,'examples/physics-stack-library-2276/io.mjs')));
 const {prepareStackStep}=await import(pathToFileURL(join(native,'packages/barocss-physics/src/stack/prepare-step.js')));
 const {parseBody}=await import(pathToFileURL(join(native,'packages/barocss-physics/src/validation.js')));
 const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs')));
 const verification=await import(pathToFileURL(join(native,'examples/physics-stack-solver-2276/verification.js')));
 const {verifyNormalKkt}=verification.default??verification;
 let budget=JSON.parse(readFileSync(join(out,'budget.json'),'utf8'));
 function save(name,b){assert.ok(budget.bytes+b.length<=CAP-1024*1024,'shared280MiB cap plus final receipt reserve');writeFileSync(join(out,name),b,{flag:'wx'});budget.bytes+=b.length;}
 const rawPath=join(out,scene+'.f64le'),rawHash=createHash('sha256');let frames=0;
 function frame(bodies){const b=raw(bodies);assert.equal(b.length,936);assert.ok(budget.bytes+b.length<CAP-1024*1024);appendFileSync(rawPath,b);rawHash.update(b);budget.bytes+=b.length;frames++;}
 let bodies=fixture(scene).bodies.map(body=>parseBody(body)),engineReturned=0,diagnosticAccepted=0,normalKktAccepted=0,firstFailure=null,reached=null,stage='initial';
 let prepareWallNs=0n,prepareUserUs=0,prepareSystemUs=0,normalKktWallNs=0n;
 save(scene+'-initial-body-metadata.json',wire({scene,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],bodies,runtimeDigest:EXPECTED_RUNTIME}));frame(bodies);
 try{for(let step=1;step<=1200;step++){
  assert.ok(Date.now()<deadline,'INTERNAL170S_DEADLINE');stage='prepare';
  writeFileSync(join(out,scene+'-progress.json'),JSON.stringify({stage,step,engineReturned,diagnosticAccepted,normalKktAccepted,independentlyFullAccepted:0,frames})+'\n');
  const before=structuredClone(bodies);let prepared;
  const begin=process.hrtime.bigint(),cpu=process.cpuUsage();
  try{prepared=prepareStackStep(bodies,1/120,[0,-9.81,0]);engineReturned++;}
  catch(error){reached={before,inputUnchanged:false,errorClass:error.name,code:error.code,message:error.message,diagnostics:error.diagnostics??null};assert.deepEqual(bodies,before,'typed refusal changed prior accepted input');reached.inputUnchanged=true;throw error;}
  finally{prepareWallNs+=process.hrtime.bigint()-begin;const used=process.cpuUsage(cpu);prepareUserUs+=used.user;prepareSystemUs+=used.system;}
  reached={before,prepared,inputUnchanged:false};assert.deepEqual(bodies,before,'preparation changed prior accepted input');reached.inputUnchanged=true;
  assert.ok(Date.now()<deadline,'INTERNAL170S_DEADLINE');stage='independent-normal-KKT';
  const kktStart=process.hrtime.bigint();let kkt;
  try{kkt=verifyNormalKkt(prepared.diagnostics.normalProblem,prepared.diagnostics.normalResult);}finally{normalKktWallNs+=process.hrtime.bigint()-kktStart;}
  reached.normalVerification=kkt;assert.equal(kkt.passed,true,'independent normal KKT');normalKktAccepted++;
  assert.ok(Date.now()<deadline,'INTERNAL170S_DEADLINE');stage='save-accepted-frame';frame(prepared.candidateBodies);
  bodies=prepared.candidateBodies;diagnosticAccepted++;reached=null;
 }
 assert.equal(frames,1201);assert.deepEqual(authenticate(),frozen);
 }catch(error){firstFailure={stage,step:diagnosticAccepted+1,errorClass:error.name,code:error.code,message:error.message};
  try{save(scene+'-failure-diagnostics.json',wire({firstFailure,reached,priorAcceptedBodies:bodies,wordDigest:wordsDigest(reached)},4*1024*1024));}
  catch(storageError){firstFailure.failureEvidenceError=storageError.message;firstFailure.completeFailureDiagnosticsRetained=false;}
 }
 const used=process.cpuUsage(cpuStart),result={status:firstFailure?'RUNTIME_DIAGNOSTIC_STOPPED':'RUNTIME_DIAGNOSTIC_COMPLETED',scene,requestedSteps:1200,engineReturned,diagnosticAccepted,normalKktAccepted,independentlyFullAccepted:0,worldAccepted:'NOT_RUN',referenceVerified1200:false,fullP4Qualification:false,resourceQualification:false,API:false,firstFailure,frames,frameBytes:936,rawBytes:frames*936,rawSha256:rawHash.digest('hex'),runtimeDigest:EXPECTED_RUNTIME,timing:{wholeSceneWallNs:String(process.hrtime.bigint()-start),wholeSceneCpuUserUs:used.user,wholeSceneCpuSystemUs:used.system,prepareTotalWallNs:String(prepareWallNs),prepareTotalCpuUserUs:prepareUserUs,prepareTotalCpuSystemUs:prepareSystemUs,normalKktTotalWallNs:String(normalKktWallNs),boundary:'Whole scene includes setup/output to this receipt preparation; cleanup and receipt finalization remain outer process boundary. Prepare/KKT fields are nested attribution, never a cost-gate comparison.'}};
 save(scene+'-result.json',wire(result));writeFileSync(join(out,'budget.json'),JSON.stringify(budget)+'\n');process.exitCode=firstFailure?1:0;
}
