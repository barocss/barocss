// Root-only hard16 gate. One outer owned group; controls precede all numerical work.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync,openSync,readSync,closeSync,realpathSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),NODE='/Users/user/.volta/tools/image/node/22.19.0/bin/node';
const hash=path=>{const h=createHash('sha256'),buffer=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const [mode,arg]=process.argv.slice(2);assert.equal(realpathSync(process.execPath),realpathSync(NODE));
if(mode!=='--inner'){
 assert.match(mode??'',/^prefix-[a-z0-9-]{1,48}$/);const out=join(home,'evidence',mode);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
 const child=spawn(NODE,[fileURLToPath(import.meta.url),'--inner',out],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']}),logs=[];let bytes=0,reason=null,kill;
 const signal=name=>{try{process.kill(-child.pid,name);}catch(e){if(e.code!=='ESRCH')throw e;}};
 const stop=why=>{if(reason)return;reason=why;signal('SIGTERM');kill=setTimeout(()=>signal('SIGKILL'),500);};
 const timer=setTimeout(()=>stop('OUTER180S_DEADLINE'),180000);for(const pipe of [child.stdout,child.stderr])pipe.on('data',b=>{bytes+=b.length;if(bytes<=128*1024)logs.push(b);else stop('OUTER_OUTPUT_BOUND');});
 const result=await new Promise(r=>{child.on('error',e=>r({error:e.message}));child.on('close',(exit,signal)=>r({exit,signal}));});clearTimeout(timer);clearTimeout(kill);signal('SIGKILL');
 writeFileSync(join(out,'outer.raw'),Buffer.concat(logs));writeFileSync(join(out,'outer-result.json'),JSON.stringify({...result,reason,hardMaximumStepsPerScene:16,API:false,full1200:false,resourceQualification:false})+'\n');process.exitCode=result.exit===0&&!reason?0:1;
}else{
 const out=arg,deadline=Date.now()+170000,pins=JSON.parse(readFileSync(join(home,'PINS.json'),'utf8')),seal=JSON.parse(readFileSync(join(home,'SOURCE-SEAL.json'),'utf8'));
 const own=['run.mjs','driver.mjs','producer.mjs','protocol.mjs','controls.test.mjs','PINS.json','CONTRACT.md','SOURCE-SEAL.json'];
 function snapshot(){for(const [name,pin]of Object.entries(pins.files)){const path=resolve(root,name);assert.equal(statSync(path).size,pin.bytes);assert.equal(hash(path),pin.sha256,'immutable dependency '+name);}for(const [name,expected]of Object.entries(seal.files))assert.equal(hash(join(home,name)),expected,'source seal '+name);return {dependencies:pins.files,own:Object.fromEntries(own.map(name=>[name,hash(join(home,name))]))};}
 const put=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');let stage='authentication',firstFailure=null,result=null,frozen;
 const timer=setTimeout(()=>{put('deadline.json',{stage,firstFailure,reason:'INTERNAL170S_DEADLINE',reachedData:'UNAVAILABLE_IF_BLOCKED_OR_EXTERNAL_TERMINATION'});process.exit(1);},170000);
 try{
  frozen=snapshot();put('inputs-before.json',frozen);
  const qualified=JSON.parse(readFileSync(resolve(root,'examples/physics-stack-reference-prepared-2276/evidence/census-01/result.json'),'utf8'));assert.equal(qualified.status,'PREPARED_OBSERVATIONAL_CENSUS_PHYSICAL_PARITY_CONFIRMED');assert.equal(qualified.firstFailure,null);
  stage='fixed-synthetic-controls';put('progress.json',{stage});const remaining=Math.floor(deadline-Date.now());assert.ok(remaining>0);
  const controls=spawnSync(NODE,['--test',join(home,'controls.test.mjs')],{cwd:root,encoding:'utf8',timeout:remaining,maxBuffer:2*1024*1024});writeFileSync(join(out,'controls.stdout'),controls.stdout??'');writeFileSync(join(out,'controls.stderr'),controls.stderr??'');put('controls-result.json',{exit:controls.status,signal:controls.signal,error:controls.error?.message});assert.equal(controls.status,0,'fixed controls failed; no numerical calls admitted');assert.match(controls.stdout,/# tests 18\b/);
  writeFileSync(join(out,'budget.json'),JSON.stringify({bytes:4*1024*1024,cap:280*1024*1024,reservedControlMetadataFailureBytes:4*1024*1024})+'\n');
  stage='hard16-physical-composition';put('progress.json',{stage});const {campaign}=await import('./driver.mjs');result=await campaign({root,home,out,pins,deadline,python:realpathSync('/opt/homebrew/bin/python3.13')});assert.equal(result.status,'PIPELINE_PREFIX_PHYSICAL_PARITY_CONFIRMED');
  assert.ok(Date.now()<deadline,'internal170s deadline');
 }catch(error){firstFailure={stage,name:error.name,message:error.message};process.exitCode=1;}
 finally{try{if(frozen){const after=snapshot();put('inputs-after.json',after);assert.deepEqual(after,frozen);}}catch(error){firstFailure??={stage:'input-integrity',message:error.message};process.exitCode=1;}clearTimeout(timer);put('gate-result.json',{status:firstFailure?'STOPPED':'HARD16_PIPELINE_GATE_COMPLETED',firstFailure,resultStatus:result?.status??null,independentlyFullAccepted:0,API:false,full1200:false,resourceQualification:false,completeOwnedData:'NOT_QUALIFIED',completeLifetimeCpu:'NOT_QUALIFIED',RSS:'NOT_QUALIFIED'});}
}
