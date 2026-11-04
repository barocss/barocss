// Root alone executes after runtime05 ends. No compiler or mutable package imports.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,statSync,openSync,readSync,closeSync,realpathSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {observeMake} from './observe.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),lib=join(root,'examples/physics-stack-library-2276');
const provider=join(lib,'evidence/runtime-opt05-01/canonical-provider'),native=join(lib,'evidence/run-09/native-modules'),authority=join(lib,'evidence/run-09/native');
const NODE='/Users/user/.volta/tools/image/node/22.19.0/bin/node',PYTHON=realpathSync('/opt/homebrew/bin/python3.13');
const hash=path=>{const h=createHash('sha256'),b=Buffer.alloc(65536),fd=openSync(path,'r');try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');};
const put=(out,name,value)=>{const b=Buffer.from(JSON.stringify(value,null,2)+'\n');assert.ok(b.length<=64*1024,'metadata64KiB bound');writeFileSync(join(out,name),b,{flag:'wx'});};
function authenticate(){
 assert.equal(realpathSync(process.execPath),realpathSync(NODE));
 const pinPath=join(home,'PINS.json'),pins=JSON.parse(readFileSync(pinPath,'utf8')),result={[pinPath]:hash(pinPath)};
 assert.equal(pins.status,'SOURCE_ONLY_NOT_EXECUTED');assert.ok(Object.keys(pins.files).length<=256);
 for(const [name,pin]of Object.entries(pins.files)){const path=name.startsWith('/')?name:join(root,name);assert.equal(statSync(path).size,pin.bytes,'size '+name);assert.equal(hash(path),pin.sha256,'hash '+name);result[path]=pin.sha256;}
 const completion=join(lib,'evidence/runtime-opt05-01/result.json');assert.ok(existsSync(completion),'runtime05 must end before census');
 const long=JSON.parse(readFileSync(completion,'utf8'));assert.equal(long.status,'RUNTIME_DIAGNOSTIC_COMPLETED');assert.equal(long.firstFailure,null);assert.equal(long.integrityFailure,null);assert.equal(long.reports.length,3);
 for(const r of long.reports){assert.equal(r.code,0);assert.equal(r.stopReason,null);assert.equal(r.result.engineReturned,1200);assert.equal(r.result.diagnosticAccepted,1200);assert.equal(r.result.normalKktAccepted,1200);}
 result[completion]=hash(completion);return result;
}
const [mode,arg]=process.argv.slice(2);
if(mode!=='--inner'){
 assert.match(mode??'',/^make-[a-z0-9-]{1,48}$/);authenticate();const out=join(home,'evidence',mode);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
 const child=spawn(NODE,[fileURLToPath(import.meta.url),'--inner',out],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']}),logs=[];let bytes=0,reason=null,kill;
 const signal=s=>{try{process.kill(-child.pid,s);}catch(error){if(error.code!=='ESRCH')throw error;}};
 const stop=r=>{if(reason)return;reason=r;signal('SIGTERM');kill=setTimeout(()=>signal('SIGKILL'),500);};
 const timer=setTimeout(()=>stop('OUTER180S_DEADLINE'),180000);
 for(const pipe of [child.stdout,child.stderr])pipe.on('data',b=>{bytes+=b.length;if(bytes<=128*1024)logs.push(b);else stop('OUTER_OUTPUT_BOUND');});
 const result=await new Promise(r=>{child.on('error',e=>r({error:e.message}));child.on('close',(exit,signal)=>r({exit,signal}));});
 clearTimeout(timer);clearTimeout(kill);signal('SIGKILL');writeFileSync(join(out,'outer.raw'),Buffer.concat(logs));
 put(out,'outer-result.json',{...result,reason,API:false,full1200:false,resourceQualification:false});process.exitCode=result.exit===0&&!reason?0:1;
}else{
 const out=arg,deadline=Date.now()+170000,frozen=authenticate(),started=process.hrtime.bigint();
 const {archive,evidenceBudget,json,observer,raw,remain,wordsDigest}=await import(pathToFileURL(join(native,'examples/physics-stack-library-2276/io.mjs')));
 const {prepareStackStep}=await import(pathToFileURL(join(provider,'dist/stack/prepare-step.js'))),{parseBody}=await import(pathToFileURL(join(provider,'dist/validation.js'))),{StrictLineContext}=await import(pathToFileURL(join(provider,'dist/stack/strict-line.js')));
 const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs'))),verification=await import(pathToFileURL(join(native,'examples/physics-stack-solver-2276/verification.js'))),{verifyNormalKkt}=verification.default??verification;
 put(out,'inputs-before.json',frozen);writeFileSync(join(out,'budget.json'),JSON.stringify({bytes:4*1024*1024,cap:280*1024*1024,reservedMetadataAndSidecars:4*1024*1024})+'\n');const budget=evidenceBudget(join(out,'budget.json'));
 const geometry=observer(join(root,'examples/physics-stack-solver-2276/trajectory-reference.py'),out,'geometry',deadline,budget,PYTHON),position=observer(join(root,'examples/physics-rigid-full-pair-position-world/reference.py'),out,'position',deadline,budget,PYTHON);
 const config=fixture('ALIGNED');let bodies=config.bodies.map(b=>parseBody(b)),contactPairs=[],accepted=0,stage='probe',firstFailure=null,currentAttempt=null,instrument=null,evidence=null,completePhysicalParity=false;
 const steps=[],cleanup=[],scene='ALIGNED',state=(bodies,step,contacts=[])=>({bodies,contacts,stepIndex:step,timeSeconds:step*(1/120)}),initial=state(bodies,0),writer=archive(out,'ALIGNED-16',budget);
 const resolved=(v,label)=>{assert.equal(v.resolved,true,label);assert.notEqual(v.executionFailure,true,label);assert.deepEqual(v.violations,[],label);};
 const timer=setTimeout(()=>{try{put(out,'deadline.json',{stage,accepted,reason:'INTERNAL170S_DEADLINE',counts:'UNINTERPRETABLE_UNAVAILABLE_IF_SYNCHRONOUS_CALL_BLOCKED',API:false});}finally{process.exit(1);}},Math.max(1,deadline-Date.now()));
 try{
  // The context is unreachable after this function returns; retain only its actual prototype.
  const prototype=(()=>{const probe=new StrictLineContext(bodies[0],bodies[1],[0,1,0]),m=Object.getOwnPropertyDescriptor(probe,'m');assert.ok(m&&Object.hasOwn(m,'value')&&m.value&&typeof m.value==='object');const p=Object.getPrototypeOf(m.value);assert.equal(p.constructor.name,'Arithmetic');return p;})();
  instrument=observeMake(prototype);instrument.checkpoint();
  stage='initial-quality';const quality=await geometry.ask({op:'quality',request:{state:initial,initial,timeSeconds:0,referenceAt8s:null}});resolved(quality,'initial quality');writer.write({kind:'initial',scene,state:initial,quality},[bodies]);
  for(let step=1;step<=16;step++){
   remain(deadline);instrument.checkpoint();stage='step'+step;writeFileSync(join(out,'progress.json'),JSON.stringify({stage,accepted})+'\n');
   const before=structuredClone(bodies);currentAttempt={scene,step,before};let prepared;
   try{prepared=prepareStackStep(bodies,1/120,[0,-9.81,0]);}catch(error){currentAttempt.diagnostics=error.diagnostics??null;assert.deepEqual(bodies,before);throw error;}
   instrument.checkpoint();assert.deepEqual(bodies,before);currentAttempt.prepared=prepared;
   const d=prepared.diagnostics,p=d.positionAttempt,s=d.positionStats,velocityCheck=verifyNormalKkt(d.normalProblem,d.normalResult);
   assert.equal(velocityCheck.passed,true);assert.equal(d.pointLedger.length,d.normalProblem.points.length);assert.ok(d.pointLedger.length<=32);if(step===1)assert.equal(d.pointLedger.length,32);
   for(const key of ['tests','rows','postPairTests'])assert.equal(s[key],36);assert.equal(p.problem.rows.length,36);assert.equal(p.rowSources.length,36);assert.equal(s.solverCalls,1);assert.equal(s.workingApplicationCount,1);
   for(const point of d.pointLedger){assert.equal(point.warm.normalNs,0);assert.deepEqual(point.warm.tangentNs,[0,0,0]);assert.deepEqual(point.final.tangentNs,[0,0,0]);}
   const contactGeometry=await geometry.ask({op:'contacts',freeBodies:d.freeBodies,pointLedger:d.pointLedger});resolved(contactGeometry,'strict contacts');assert.equal(contactGeometry.ok,true);
   const positionCheck=await position.ask({op:'world',scene,stepIndex:step,config,preBodies:p.preBodies,preRawHex:raw(p.preBodies).toString('hex'),problem:p.problem,rowSelections:p.rowSources,result:p.result,hypBodies:p.hypotheticalBodies,hypRawHex:raw(p.hypotheticalBodies).toString('hex')});resolved(positionCheck,'position');assert.ok(positionCheck.metrics.maxHypDepthRawM<=1e-12&&positionCheck.metrics.maxHypDepthNormalizedM<=1e-12);
   const ledger={beforeBodies:d.beforeBodies,freeBodies:d.freeBodies,velocityBodies:d.velocityBodies,finalBodies:prepared.candidateBodies,points:d.pointLedger,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],actions:[]};
   const ledgerCheck=await position.ask({op:'step-ledger',scene,stepIndex:step,outcome:'accepted',ledger,raw:{before:raw(d.beforeBodies).toString('hex'),free:raw(d.freeBodies).toString('hex'),velocity:raw(d.velocityBodies).toString('hex'),final:raw(prepared.candidateBodies).toString('hex')}});resolved(ledgerCheck,'ledger');
   const contacts=d.geometryPatches.map(p=>({aId:p.aId,bId:p.bId})),after=state(prepared.candidateBodies,step,contacts),quality=await geometry.ask({op:'quality',request:{state:after,initial,timeSeconds:after.timeSeconds,referenceAt8s:null}});resolved(quality,'quality');
   const pointBytes=Buffer.alloc(d.normalProblem.points.length*48);let offset=0;for(const point of d.normalProblem.points)for(const value of [...point.pointM,...point.normalAtoB]){pointBytes.writeDoubleLE(value,offset);offset+=8;}
   writer.write({kind:'step',scene,step,before:state(before,step-1,contactPairs),prepared,pointOperandF64leHex:pointBytes.toString('hex'),velocityCheck,contactGeometry,positionCheck,ledgerCheck,quality,after},[before,d.freeBodies,d.velocityBodies,prepared.candidateBodies]);
   bodies=prepared.candidateBodies;contactPairs=contacts;accepted++;currentAttempt=null;steps.push({step,cumulative:instrument.snapshot()});
  }
  instrument.checkpoint();stage='complete-physical-parity';evidence=writer.finish();
  const old=JSON.parse(readFileSync(join(authority,'result.json'),'utf8')).reports.find(r=>r.scene===scene&&r.selectedSteps===16);assert.ok(old);assert.deepEqual({scene,selectedSteps:16,phaseAccepted:accepted,publicWorldAccepted:'NOT_RUN',failure:null,evidence},old,'complete record/raw/numeric-word parity');
  for(const [role,count,offset]of [['geometry',33,9],['position',32,6]])for(let n=1;n<=count;n++)for(const kind of ['request','reply'])assert.equal(hash(join(out,`${role}-${n}-${kind}.json`)),hash(join(authority,`${role}-${n+offset}-${kind}.json`)),'complete old physical wire bytes');
  completePhysicalParity=true;
 }catch(error){firstFailure={stage,errorClass:error.name,code:error.code,message:error.message};try{json(join(out,'failure-diagnostics.json'),{firstFailure,currentAttempt,words:wordsDigest(currentAttempt)});}catch(storage){firstFailure.failureEvidenceError=storage.message;}}
 finally{
  if(instrument)try{instrument.restore();}catch(error){firstFailure??={stage:'prototype-restore',message:error.message};}
  for(const [role,ref]of [['geometry',geometry],['position',position]])try{cleanup.push({role,...await ref.close(firstFailure!==null)});}catch(error){firstFailure??={stage:'cleanup',role,message:error.message};}
  budget.finish();
 }
 try{const after=authenticate();assert.deepEqual(after,frozen);put(out,'inputs-after.json',after);remain(deadline);}catch(error){firstFailure??={stage:'input-integrity',message:error.message};}
 const diagnosticStatus=instrument?.status()??null,interpretable=firstFailure===null&&completePhysicalParity&&diagnosticStatus?.restored&&diagnosticStatus?.diagnosticFailure===null&&diagnosticStatus?.originalThrows===0;
 put(out,'make-counts.json',{status:interpretable?'OBSERVED_SUCCESSFUL_MAKE_KEY_REPETITION':'UNINTERPRETABLE',interpretable,diagnosticStatus,counts:instrument?.snapshot()??null,steps,notActualCache:true,noSpeedClaim:true});
 put(out,'result.json',{status:interpretable?'OBSERVED_SUCCESSFUL_MAKE_KEY_REPETITION':'MAKE_CENSUS_STOPPED',firstFailure,completePhysicalParity,accepted,evidence,cleanup,wholeDiagnosticWallNs:String(process.hrtime.bigint()-started),boundary:'Instrumented new16-prefix observation; no speed, exception-path, whole-data/RSS or full1200 qualification',API:false,full1200:false,resourceQualification:false});
 clearTimeout(timer);process.exitCode=interpretable?0:1;
}
