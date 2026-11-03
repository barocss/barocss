// Root executes only after canonical build/prefix qualification and High review.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync,existsSync,openSync,readSync,closeSync,realpathSync,statSync,copyFileSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),self=fileURLToPath(import.meta.url);
const project=resolve(here,'../..'),packageRoot=join(project,'packages/barocss-physics'),helperNative=join(here,'evidence/run-06/native-modules');
// Actual canonical build stack-library-build-05; byte hashes frozen after exit0.
const PROVIDER_PINS={
 "dist/capsule-contact.js": "7519483aec208b282ae23bb6985868af199b19d00d3d00564b3a5438d2113ad1",
 "dist/collision.js": "a42979046e9f32c9fe16323617975b4d3a80aa71f44a74330208b0003c491457",
 "dist/contact-contribution.js": "ef2eea7731343f2584baea3280515163ca23602cd3219049ea5d0296e7bce57e",
 "dist/contact-tangent.js": "d5a3e6a0a2fef8000b219df53569c571a6d75b6a854b5266dd84fda3c58df9d0",
 "dist/internal-types.js": "b105d9550d9a3a0dccc02de4bf06d3191f7ce2a0b9241ee9031c14a54dff9b6e",
 "dist/limits.js": "15e4c3baf2645fa8aa040fcd4de7c5d14685e7a6ce1b6c45cffda01c47e08219",
 "dist/math.js": "d82024b2458cf6ffdacef3ce57e0e1b802888bc39168ee032202536d4bdaa028",
 "dist/stack/edge-contact.js": "cd35a636c99773c087204ead2e3f797b9b803624d6883d1906b8d4bff2af0c34",
 "dist/stack/face-contact.js": "f00894e179c5317e77367991e6a30b1858ddf637282ccce40318b36873d20349",
 "dist/stack/full-pair-apply.js": "7f8d7bc1a0540ae85de4684a571ce70f08efd536f34bb67ad111cced690377d7",
 "dist/stack/full-pair-core.mjs": "75941f67d5359c3734a68c93dd571313bdcab030a170205dee6e22d592119a46",
 "dist/stack/full-pair-exact.mjs": "258732a572bd6b2d1606db97cd2b637bfd252ce5fb59ee31cb30b0e9d298cd32",
 "dist/stack/full-pair-input.mjs": "294a5ace022a05ca93cf269c2c9f3faa7f22f9715bc8f59a2956b2cb04078027",
 "dist/stack/full-pair-linear.mjs": "f12c0243c18178a138b79faaac29b14e61714a42376c6c88c2b8757eef82b280",
 "dist/stack/full-pair-phase.js": "e82291e4014b98666367fe33bdf7e996f3b3c544c881dc5967b1b06ad6311c32",
 "dist/stack/full-pair-rows.js": "9810df91101ff635dcfe9c0610a4cc35d4b88dd340ce9cef67406ee5afcaffe9",
 "dist/stack/full-pair-solver.mjs": "84e32cae07dbdd295e46af04691f0bf37815d77e73e2b5edfb75b0739e104432",
 "dist/stack/geometry-adapter.js": "203477a61d5a9bf7d2afa2d66114e2bcff360fd6d0c123c659166d6c4dc1ac27",
 "dist/stack/geometry.js": "225329ca8c8359cd1e3278e7bb40951087841182cc07e1581e48f1cea691e43f",
 "dist/stack/normal-bridge.js": "d0775459bf850fa33198b86fe1b3bad3d16b9b02b3d57f9cf0adcc91e3eb13d0",
 "dist/stack/normal-solver.js": "d672f4a7f41179fc9aefb767d0e92ed580cf346c9bd17ac8cc75b75aefba9570",
 "dist/stack/prepare-step.js": "8d5c34c3420739f762b0b3ef5a1c8885f596b3c311e528197db29def4d7c915b",
 "dist/stack/sat-feature.js": "75558bcb2392da27b81e8f0ae17cbb446ceccb191e4ec536280140da9bde7359",
 "dist/stack/signed-sat.js": "0c6d102bb26183d6f0789615bb66d9b44afedc52774dd575603308ebf859547c",
 "dist/stack/strict-line.js": "1c817289a7eb1c22caf107cc1e882b6cb4439f3d0a59161fe9229356fd9c71fe",
 "dist/stack/witness.js": "efd1289164059156211e7a382d69a6382e88dd0253f3e3c58a082268d20c3aa9",
 "dist/types.js": "65a4905c6bda0d4e7a5fc7ea105a1362c8cae1345070b5d17fd524a8790e1f8b",
 "dist/validation.js": "7a16fbadf07097048276364818d8851d77f980fe84a30dc79529eadcb2fabe2c",
 "package.json": "7ef765dcf000a0b45dd74495e60243e16516506e730afa024fc7f32b11222330"
};
const HELPER_PINS={
'examples/physics-rigid-contact-reference/fixtures.mjs':'ca760b2945d246de1e2f32cb4763ef58bf95e87422b6d4545682c20abb3a1ac0',
'examples/physics-stack-solver-2276/verification.js':'6b1ccdf9d97caef4c42e0ec5faaaa206cd47141df0842b523618e629ce178b80',
'examples/physics-stack-library-2276/io.mjs':'33e266bb0d9d6b86e9890b1aaef0c730a96754c90daab698d22b0bc9e2c89a97',
'package.json':'1d575b89482ff9234d5605033fcd24677eed9c4a32824fe34be156d44ab0496b',
};
const NODE='/Users/user/.volta/tools/image/node/22.19.0/bin/node',NODE_HASH='0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1';
const EXPECTED_RUNTIME='613664b0998cf6f643cef4850a8da177f9d0f578a9dd2e6b63b83ce173fdf9c9',CAP=280*1024*1024;
const hash=path=>{const h=createHash('sha256'),b=Buffer.alloc(64*1024),fd=openSync(path,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
function snapshotProvider(out){
 assert.ok(PROVIDER_PINS,'canonical build not pinned; no calls permitted');let bytes=0;const copied=[];
 for(const [prefix,origin,pins]of [['canonical-provider',packageRoot,PROVIDER_PINS],['test-helpers',helperNative,HELPER_PINS]])for(const [name,expected]of Object.entries(pins)){
  const source=join(origin,name),target=join(out,prefix,name);assert.equal(hash(source),expected,'original canonical/helper byte authentication '+name);
  const size=statSync(source).size;assert.ok(bytes+size<16*1024*1024,'provider snapshot16MiB bound inside shared280MiB');
  mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);assert.equal(hash(target),expected);bytes+=size;copied.push({source,target:relative(out,target),bytes:size,sha256:expected});
 }
 writeFileSync(join(out,'provider-copy-provenance.json'),JSON.stringify({origin:'ACTUAL_CANONICAL_PACKAGE_BUILD_BYTE_EXACT_SNAPSHOT_NOT_SOURCE_EMISSION',buildGuard:'stack-library-build-05',runtimeDigest:EXPECTED_RUNTIME,copied},null,2)+'\n');
 const manifests=[];for(const name of ['src/provider-manifest.generated.ts','dist/provider-manifest.generated.js']){const path=join(packageRoot,name);if(existsSync(path))manifests.push({path,sha256:hash(path),bytes:statSync(path).size});}
 writeFileSync(join(out,'provider-identity-sidecar.json'),JSON.stringify({manifests,boundary:'Identity provenance only, separate from runtime graph/physical evidence; no public World proof'},null,2)+'\n');return bytes;
}
function authenticate(out){
 assert.ok(PROVIDER_PINS,'canonical build not pinned');assert.equal(realpathSync(process.execPath),realpathSync(NODE));assert.equal(hash(NODE),NODE_HASH);
 const entries=[];for(const [prefix,pins]of [['canonical-provider',PROVIDER_PINS],['test-helpers',HELPER_PINS]])for(const [name,expected]of Object.entries(pins)){
  const path=join(out,prefix,name);assert.equal(hash(path),expected,'frozen snapshot changed '+name);entries.push({path:relative(out,path),sha256:expected});
 }
 return {runtime:entries,runtimeDigest:EXPECTED_RUNTIME,node:{path:NODE,sha256:NODE_HASH},runner:hash(self),contract:hash(join(here,'RUNTIME-OPT02-CONTRACT.md'))};
}
const [mode,arg,scene]=process.argv.slice(2);
if(mode!=='--scene'){
 const id=mode;assert.match(id??'',/^runtime-opt02-[a-z0-9-]{1,48}$/);
 const out=join(here,'evidence',id);assert.ok(!existsSync(out),'fresh diagnostic ID required');mkdirSync(out);
 const snapshotBytes=snapshotProvider(out),frozen=authenticate(out);writeFileSync(join(out,'inputs-before.json'),JSON.stringify(frozen,null,2)+'\n');
 writeFileSync(join(out,'budget.json'),JSON.stringify({bytes:1024*1024+snapshotBytes,cap:CAP,reservedSupervisorBytes:1024*1024,providerSnapshotBytes:snapshotBytes})+'\n');
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
 let integrityFailure=null;try{assert.deepEqual(authenticate(out),frozen);}catch(e){integrityFailure=e.message;firstFailure??={stage:'input-integrity',message:e.message};}
 const actualBytes=files(out).reduce((n,p)=>n+statSync(p).size,0);
 assert.ok(actualBytes<CAP-1024*1024,'shared280MiB final receipt reserve');
 writeFileSync(join(out,'result.json'),JSON.stringify({status:firstFailure?'RUNTIME_DIAGNOSTIC_STOPPED':'RUNTIME_DIAGNOSTIC_COMPLETED',firstFailure,integrityFailure,reports,actualBytesBeforeFinalReceipt:actualBytes,referenceVerified1200:false,independentlyFullAccepted:0,resourceQualification:false,API:false,fullP4Qualification:false},null,2)+'\n');
 process.exitCode=firstFailure?1:0;
}else{
 const out=arg;assert.ok(['ALIGNED','OFFSET','YAW'].includes(scene));
 const deadline=Date.now()+170000,start=process.hrtime.bigint(),cpuStart=process.cpuUsage();
 const frozen=authenticate(out);
 const {raw,wire,wordsDigest}=await import(pathToFileURL(join(out,'test-helpers/examples/physics-stack-library-2276/io.mjs')));
 const {prepareStackStep}=await import(pathToFileURL(join(out,'canonical-provider/dist/stack/prepare-step.js')));
 const {parseBody}=await import(pathToFileURL(join(out,'canonical-provider/dist/validation.js')));
 const {fixture}=await import(pathToFileURL(join(out,'test-helpers/examples/physics-rigid-contact-reference/fixtures.mjs')));
 const verification=await import(pathToFileURL(join(out,'test-helpers/examples/physics-stack-solver-2276/verification.js')));
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
 assert.equal(frames,1201);assert.deepEqual(authenticate(out),frozen);
 }catch(error){firstFailure={stage,step:diagnosticAccepted+1,errorClass:error.name,code:error.code,message:error.message};
  try{save(scene+'-failure-diagnostics.json',wire({firstFailure,reached,priorAcceptedBodies:bodies,wordDigest:wordsDigest(reached)},4*1024*1024));}
  catch(storageError){firstFailure.failureEvidenceError=storageError.message;firstFailure.completeFailureDiagnosticsRetained=false;}
 }
 const used=process.cpuUsage(cpuStart),result={status:firstFailure?'RUNTIME_DIAGNOSTIC_STOPPED':'RUNTIME_DIAGNOSTIC_COMPLETED',scene,requestedSteps:1200,engineReturned,diagnosticAccepted,normalKktAccepted,independentlyFullAccepted:0,worldAccepted:'NOT_RUN',referenceVerified1200:false,fullP4Qualification:false,resourceQualification:false,API:false,firstFailure,frames,frameBytes:936,rawBytes:frames*936,rawSha256:rawHash.digest('hex'),runtimeDigest:EXPECTED_RUNTIME,timing:{wholeSceneWallNs:String(process.hrtime.bigint()-start),wholeSceneCpuUserUs:used.user,wholeSceneCpuSystemUs:used.system,prepareTotalWallNs:String(prepareWallNs),prepareTotalCpuUserUs:prepareUserUs,prepareTotalCpuSystemUs:prepareSystemUs,normalKktTotalWallNs:String(normalKktWallNs),boundary:'Whole scene includes setup/output to this receipt preparation; cleanup and receipt finalization remain outer process boundary. Prepare/KKT fields are nested attribution, never a cost-gate comparison.'}};
 save(scene+'-result.json',wire(result));writeFileSync(join(out,'budget.json'),JSON.stringify(budget)+'\n');process.exitCode=firstFailure?1:0;
}
