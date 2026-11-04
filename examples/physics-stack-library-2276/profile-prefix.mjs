// Sampling diagnostic only. Root owns the external180s guard and invocation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync,existsSync,statSync,openSync,readSync,closeSync,realpathSync} from 'node:fs';
import {dirname,resolve,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
const here=dirname(fileURLToPath(import.meta.url)),saved=join(here,'evidence/run-04'),native=join(saved,'native-modules');
const NODE='/Users/user/.volta/tools/image/node/22.19.0/bin/node',NODE_SHA='0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1';
const RUNTIME_SHA='4d4120b87827ed1cb4a6389f9a1deff00873a4e448c22da2cd22317341004731',RESULT_SHA='7ac55d69aef2843cbac2f8d10d860d5674c74eb0e1840b5951fabf922404742d';
const deadline=Date.now()+170000,id=process.argv[2];assert.match(id??'',/^profile-[a-z0-9-]{1,56}$/);
const out=join(here,'evidence',id);if(existsSync(out))assert.equal(readdirSync(out).length,0,'fresh empty profile directory required');else mkdirSync(out);
const hash=p=>{const h=createHash('sha256'),b=Buffer.alloc(64*1024),fd=openSync(p,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
const put=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const remaining=()=>assert.ok(Date.now()<deadline,'INTERNAL170S_DEADLINE');
const archivePaths=Array.from({length:17},(_,step)=>join(saved,'native',`ALIGNED-16-${step}.f64le.gz`));
function snapshot(){
 assert.equal(realpathSync(process.execPath),realpathSync(NODE));assert.equal(hash(NODE),NODE_SHA);
 const runtime=files(native).filter(p=>/\.(js|mjs|json)$/.test(p)&&(!relative(native,p).startsWith('examples/physics-stack-library-2276/')||p.endsWith('/io.mjs'))).sort();
 const entries=runtime.map(p=>({path:relative(native,p),sha256:hash(p)})),h=createHash('sha256');for(const e of entries)h.update(e.path+'\0'+e.sha256+'\n');
 assert.equal(entries.length,37);assert.equal(h.digest('hex'),RUNTIME_SHA);assert.equal(hash(join(saved,'native/result.json')),RESULT_SHA);
 return {runtime:entries,node:{path:NODE,sha256:NODE_SHA},authoring:{runner:hash(fileURLToPath(import.meta.url)),contract:hash(join(here,'PROFILE-CONTRACT.md'))},archives:archivePaths.map(path=>{const bytes=statSync(path).size;assert.ok(bytes>0&&bytes<=2*1024*1024,'compressed piece2MiB bound');return {path,bytes,sha256:hash(path)};}),savedResult:{sha256:RESULT_SHA},execArgv:process.execArgv};
}
let stage='authenticate',frozen=null,harnessWire=null,prepareCalls=0,engineReturned=0,normalKktAccepted=0,wordParityFrames=0,firstFailure=null,reached=null;
const rawHash=createHash('sha256'),savedRawHash=createHash('sha256');let bodyFrames=0;
try{
 assert.ok(process.execArgv.includes('--cpu-prof'),'Root must enable Node CPU sampling');frozen=snapshot();put('inputs-before.json',frozen);remaining();
 const {raw,wire}=await import(pathToFileURL(join(native,'examples/physics-stack-library-2276/io.mjs')));
 harnessWire=wire;
 const {prepareStackStep}=await import(pathToFileURL(join(native,'packages/barocss-physics/src/stack/prepare-step.js')));
 const {parseBody}=await import(pathToFileURL(join(native,'packages/barocss-physics/src/validation.js')));
 const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs')));
 const verification=await import(pathToFileURL(join(native,'examples/physics-stack-solver-2276/verification.js'))),{verifyNormalKkt}=verification.default??verification;
 const old=JSON.parse(readFileSync(join(saved,'native/result.json'),'utf8')).reports.find(r=>r.scene==='ALIGNED'&&r.selectedSteps===16);assert.ok(old&&old.phaseAccepted===16);
 let bodies=fixture('ALIGNED').bodies.map(body=>parseBody(body));put('initial-metadata.json',{scene:'ALIGNED',fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],bodies});
 function saveAndCompare(step,current){
  stage='raw-parity-'+step;const path=archivePaths[step],bytes=statSync(path).size;assert.ok(bytes>0&&bytes<=2*1024*1024,'compressed piece2MiB bound');
  const authority=gunzipSync(readFileSync(path),{maxOutputLength:3744});assert.equal(authority.length,step===0?936:3744);savedRawHash.update(authority);
  const actual=raw(current);assert.equal(actual.length,936);assert.deepEqual(actual,authority.subarray(authority.length-936),'exact binary64 final body parity step'+step);wordParityFrames++;
  appendFileSync(join(out,'ALIGNED.f64le'),actual);rawHash.update(actual);bodyFrames++;
 }
 saveAndCompare(0,bodies);
 for(let step=1;step<=16;step++){
  remaining();stage='prepare-'+step;const before=structuredClone(bodies);reached={step,before};prepareCalls++;
  let prepared;try{prepared=prepareStackStep(bodies,1/120,[0,-9.81,0]);engineReturned++;}catch(error){reached.diagnostics=error.diagnostics??null;reached.code=error.code;assert.deepEqual(bodies,before,'refusal input unchanged');reached.inputUnchanged=true;throw error;}
  reached.prepared=prepared;assert.deepEqual(bodies,before,'prepare input unchanged');reached.inputUnchanged=true;remaining();stage='normal-KKT-'+step;
  const kkt=verifyNormalKkt(prepared.diagnostics.normalProblem,prepared.diagnostics.normalResult);reached.normalVerification=kkt;assert.equal(kkt.passed,true,'unchanged independent normal KKT');normalKktAccepted++;
  saveAndCompare(step,prepared.candidateBodies);bodies=prepared.candidateBodies;reached=null;
 }
 assert.equal(savedRawHash.digest('hex'),old.evidence.rawSha256,'all saved raw pieces authenticated against pinned run04 receipt');
 assert.equal(bodyFrames,17);assert.equal(wordParityFrames,17);assert.equal(prepareCalls,16);remaining();const after=snapshot();assert.deepEqual(after,frozen);put('inputs-after.json',after);
}catch(error){firstFailure={stage,errorClass:error.name,code:error.code,message:error.message};try{if(harnessWire)writeFileSync(join(out,'failure-diagnostics.json'),harnessWire({firstFailure,reached},4*1024*1024),{flag:'wx'});else put('failure-diagnostics.json',{firstFailure});}catch(e){firstFailure.failureEvidenceError=e.message;}try{if(frozen){const after=snapshot();put('inputs-after.json',after);assert.deepEqual(after,frozen);}}catch(e){firstFailure.integrityFailure=e.message;}process.exitCode=1;}
put('result.json',{status:firstFailure?'PROFILE_DIAGNOSTIC_STOPPED':'PROFILE_PREFIX_WORD_PARITY_CONFIRMED',firstFailure,prepareCalls,engineReturned,normalKktAccepted,wordParityFrames,bodyFrames,rawBytes:bodyFrames*936,rawSha256:rawHash.digest('hex'),profileInformative:firstFailure===null,samplingBoundary:'Node writes CPU profile on process exit; Root must verify that artifact. Samples include setup/authentication/IO and are not benchmark or speed-ratio evidence.',independentlyFullAccepted:0,resourceQualification:false,fullP4Qualification:false,API:false});
