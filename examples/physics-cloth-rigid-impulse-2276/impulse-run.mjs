/** Explicitly authorized private campaign child. Parent command-run owns the process group. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile, writeFile, mkdir, readdir, stat, open, lstat} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {dirname, resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const HERE=dirname(fileURLToPath(import.meta.url)), ROOT=resolve(HERE,'../..');
const MIB=1048576, sha=b=>createHash('sha256').update(b).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const within=(parent,path)=>path===parent||path.startsWith(parent+'/');
async function filePin(path){const info=await stat(path),hash=createHash('sha256');for await(const b of createReadStream(path,{highWaterMark:65536}))hash.update(b);return{path,bytes:info.size,sha256:hash.digest('hex')};}
async function readBound(path,limit=MIB){const info=await stat(path);assert(info.size<=limit,'bounded read '+path);return readFile(path);}
async function exactPin(path,pin){const actual=await filePin(path);assert.equal(actual.bytes,pin.bytes,path);assert.equal(actual.sha256,pin.sha256,path);return actual;}
function numericRaw(value){
  if(typeof value==='number'){const b=Buffer.allocUnsafe(8);b.writeDoubleLE(value);return{$f64le:b.toString('hex')};}
  if(Array.isArray(value))return value.map(numericRaw);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,numericRaw(item)]));
  assert(value===null||typeof value==='string'||typeof value==='boolean','plain numeric data only');return value;
}
const snapshot=value=>JSON.stringify(numericRaw(value));
function detachedClone(value){
  if(Array.isArray(value))return value.map(detachedClone);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,detachedClone(item)]));
  return value;
}
function assertNoAliases(input,output){
  const inputs=new Set(),outputs=new Set();
  const collect=(value,set)=>{if(value&&typeof value==='object'){if(set.has(value))return;set.add(value);for(const child of Object.values(value))collect(child,set);}};
  collect(input,inputs);
  const visit=value=>{if(value&&typeof value==='object'){assert(!inputs.has(value),'output aliases input');assert(!outputs.has(value),'output fields alias each other');outputs.add(value);for(const child of Object.values(value))visit(child);}};
  visit(output);assert(outputs.size<=128,'bounded output graph');
}
function preservedFields(input,output){
  assert.equal(snapshot(output.clothContext),snapshot(input.clothContext));assert.equal(snapshot(output.rigidContext),snapshot(input.rigidContext));
  for(const key of ['endpoint','positionM','massKg'])assert.equal(snapshot(output.point[key]),snapshot(input.point[key]),'point nonvelocity '+key);
  for(const key of ['endpoint','comPositionM','massKg','rotationBodyToWorld','principalInertiaKgM2'])assert.equal(snapshot(output.rigid[key]),snapshot(input.rigid[key]),'rigid nonvelocity '+key);
  assert.equal(snapshot(output.report.pointEndpoint),snapshot(input.point.endpoint));assert.equal(snapshot(output.report.rigidEndpoint),snapshot(input.rigid.endpoint));
  const finite=value=>{if(typeof value==='number')assert(Number.isFinite(value),'finite candidate output');else if(value&&typeof value==='object')for(const item of Object.values(value))finite(item);};finite(output);
}
function instantiateLiteral(caseRecipe,cases){
  const raw=detachedClone(cases.literalBases[caseRecipe.base]);
  for(const patch of caseRecipe.patches){let target=raw;for(const key of patch.path.slice(0,-1)){assert(Object.hasOwn(target,key));target=target[key];}const key=patch.path.at(-1);assert(Object.hasOwn(target,key));target[key]=detachedClone(patch.value);}
  return raw;
}
function convertLiteral(value){
  if(typeof value==='string'&&/^-?(0|[1-9][0-9]*)(\/[1-9][0-9]*)?$/.test(value)){
    const [numerator,denominator='1']=value.split('/');return Number(numerator)/Number(denominator);
  }
  if(Array.isArray(value))return value.map(convertLiteral);
  if(value&&typeof value==='object'){
    if(Object.keys(value).length===1&&Object.hasOwn(value,'ieee754F64LE')){assert.equal(value.ieee754F64LE,'000000000000f07f');return Buffer.from(value.ieee754F64LE,'hex').readDoubleLE();}
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,convertLiteral(item)]));
  }
  return value;
}
function preflightLiteralMetadata(cases){
  const all=[...cases.acceptedCases,...cases.refusalCases],ids=new Set();
  assert.equal(cases.acceptedCases.length,13);assert.equal(cases.refusalCases.length,10);assert.equal(cases.faultCases.length,2);
  for(const item of all){
    assert(!ids.has(item.id));ids.add(item.id);assert(Object.hasOwn(cases.literalBases,item.base));
    for(const patch of item.patches){
      assert(Array.isArray(patch.path)&&patch.path.length>=1&&patch.path.length<=4);
      let owner=cases.literalBases[item.base];
      for(const part of patch.path){assert(typeof part==='string'&&owner!==null&&typeof owner==='object'&&!Array.isArray(owner)&&Object.hasOwn(owner,part),'existing literal metadata path');owner=owner[part];}
    }
  }
  for(const item of cases.faultCases){assert.equal(item.baseAcceptedCase,'03-off-com-transverse');assert(ids.has(item.baseAcceptedCase));assert.equal(item.candidateCondensed3x3Solves,1);}
  assert.equal(cases.aggregateCeilings.candidateAttempts,50);assert.equal(cases.aggregateCeilings.candidateCondensed3x3Solves,30);
  return {status:'PASS_LITERAL_METADATA_ONLY',accepted:13,refusals:10,faults:2,literalInstantiations:0,nativeConversions:0,mathCalls:0};
}
function instrument(source){
  const invocation=method=>`(globalThis as unknown as {__impulseObserve:{${method}():void}}).__impulseObserve.${method}();`;
  const sites=[['export function projectClothRigidImpulse(input: unknown): ImpulseResult {','entry'],
    ['// IMPULSE_DIRECT_SOLVE_ENTRY: one fixed direct factorization and one RHS.','solve'],
    ['// IMPULSE_FIRST_SIDE_PREPARED: after point candidate, before rigid candidate.','first'],
    ['// IMPULSE_PAIR_PREPARED: both candidates and report complete, before pair return.','pair']];
  let effective=source;for(const [anchor,method]of sites){assert.equal(effective.split(anchor).length,2,'unique overlay '+method);effective=effective.replace(anchor,anchor+'\n  '+invocation(method));}
  return{effective,sites:sites.map(([anchor,method])=>({anchor,method}))};
}
async function ownedTreeBytes(directory){let bytes=0;for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name);assert(!entry.isSymbolicLink(),'no evidence symlinks');bytes+=entry.isDirectory()?await ownedTreeBytes(path):(await stat(path)).size;}return bytes;}
async function main(){
  const args=process.argv.slice(2);assert.deepEqual(args.filter(x=>x.startsWith('--')),['--run-id','--freeze','--token','--authorize-impulse-campaign']);
  assert.equal(args.length,7);const runId=args[1],freezePath=resolve(args[3]),token=args[5];
  assert(/^[a-z0-9][a-z0-9-]{0,88}$/.test(runId),'bounded fresh run id with oracle suffix');assert(process.versions.node.startsWith('22.'));
  const start=performance.now(),out=resolve(HERE,'evidence',runId),oracleOut=resolve(HERE,'evidence',runId+'-oracle');
  const counts={oracleProcesses:0,referenceRequests:0,referenceRequestsDurableLowerBound:0,referenceRequestsStatus:'NOT_STARTED',fixtureConversions:0,candidateAttempts:0,candidateReturns:0,candidateThrows:0,candidateUnexpectedThrows:0,candidateRefusals:0,candidateFaults:0,candidateSolves:0,validatorProcesses:0,validatorReplies:0,validatorPasses:0,typescriptProcesses:0,sourceBuilds:0,WorldCalls:0};
  let phaseName='authentication',phaseUntil=start+5000,firstFailure=null,graphName=null,caseId=null,stored=0,childCaptured=0,oracleEvidenceBytes=0,oracleSummaryPin=null,oracleObservedPrefix=null,oracleAuthorization=null;
  const completed=[],graphs={},commands=[],processStarts={oracle:0,esbuild:0,typescript:0,validator:0},resources={RSSClaim:false,processHeapMeasured:false,workingChargeModel:'owned payload/serialization only; High source review required',ownedDataCeilingBytes:64*MIB,evidenceLimitBytes:8*MIB,buildLimitBytes:16*MIB,workingFixedBounds:{referenceBytes:8*MIB,candidateBytes:8*MIB,reserveBytes:24*MIB}};
  await mkdir(out,{recursive:false});
  const progress=()=>{const text=json({status:'IN_PROGRESS',phase:phaseName,graph:graphName,caseId,counts,actualChildProcessStarts:processStarts,commands,completed,elapsedMs:performance.now()-start});assert(Buffer.byteLength(text)<=65536,'bounded durable progress');writeFileSync(resolve(out,'progress.json'),text);};
  const checkTime=()=>{assert(performance.now()-start<170000,'170s whole campaign deadline');assert(performance.now()<phaseUntil,'phase deadline '+phaseName);};
  const phase=(name,maxMs)=>{phaseName=name;phaseUntil=Math.min(start+170000,performance.now()+maxMs);progress();};
  const write=async(name,value,reserved=false)=>{const bytes=typeof value==='string'||Buffer.isBuffer(value)?Buffer.from(value):Buffer.from(json(value));assert(bytes.length<=(name.endsWith('.raw')?4*MIB:MIB),'single artifact bound');const limit=8*MIB-(reserved?0:65536);assert(stored+oracleEvidenceBytes+bytes.length+65536<=limit,'combined oracle/runner evidence bound');await writeFile(resolve(out,name),bytes,{flag:'wx'});stored+=bytes.length;return filePin(resolve(out,name));};
  async function authenticate(){
    const raw=await readBound(freezePath,4*MIB);assert.equal(sha(raw),token,'explicit execution token');const freeze=JSON.parse(raw);
    assert.equal(freeze.status,'PARENT_AUTHORIZED_IMPULSE_CAMPAIGN');assert.equal(freeze.runId,runId,'one frozen fresh campaign id');assert.equal(freeze.runtimeAuthorized,true);assert.equal(freeze.p5Closed,true);assert.equal(freeze.validationRequestLimit,26);
    for(const name of ['candidate.ts','oracle.py','native-validate.py','impulse-run.mjs','CONTRACT.md','CASES.json','RUNNER-PLAN.json','RUNNER-AUTHOR-READY.json','RUNNER-AUTHORING-FREEZE-01.json','AUTHORING-FREEZE-01.json','CANDIDATE-AUTHOR-READY.json','ORACLE-AUTHOR-READY.json'])assert(freeze.files[relative(ROOT,resolve(HERE,name))],'complete source pin '+name);
    for(const [path,pin]of Object.entries(freeze.files)){assert(!isAbsolute(path)&&within(ROOT,resolve(ROOT,path)));await exactPin(resolve(ROOT,path),pin);}
    for(const [path,pin]of Object.entries(freeze.toolFiles)){assert(isAbsolute(path));await exactPin(path,pin);}
    for(const key of ['node','python','esbuildBinary','typescriptCLI'])assert(freeze.toolFiles[freeze.tools[key]],'tool closure pin '+key);
    assert.equal(resolve(freeze.tools.node),process.execPath,'exact Node executable');
    const binaryHandle=await open(freeze.tools.esbuildBinary,'r');try{const magic=Buffer.alloc(4);await binaryHandle.read(magic,0,4,0);assert(['cffaedfe','feedfacf','cefaedfe','feedface','cafebabe','bebafeca','7f454c46'].includes(magic.toString('hex')),'true native esbuild binary, not JS launcher');}finally{await binaryHandle.close();}
    assert.equal(freeze.highReview.approved,true);assert(freeze.files[freeze.highReview.path],'High review file pinned');
    const p5='examples/physics-world-p5-2276/completion-results.json';assert(freeze.files[p5]);assert.equal(JSON.parse(await readBound(resolve(ROOT,p5))).status,'P5_DONE_BOUNDED_LOCALSELECTED_WITH_RENDERING_SDK_BOUNDARY');
    assert(freeze.files['examples/physics-world-p5-2276/command-run.mjs'],'outer guard pinned');
    return freeze;
  }
  async function command(executable,argv,label,maxMs){
    checkTime();const record={label,command:[executable,...argv],startedElapsedMs:performance.now()-start,detached:false,pid:null,exit:null,signal:null,stdoutEOF:false,stderrEOF:false,closed:false,timedOut:false,capturedBytes:0,stdoutSha256:null,stderrSha256:null};commands.push(record);progress();
    const cp=spawn(executable,argv,{cwd:ROOT,stdio:['ignore','pipe','pipe'],detached:false,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});record.pid=cp.pid??null;
    if(record.pid){if(label==='oracle'){processStarts.oracle++;counts.referenceRequests=null;counts.referenceRequestsDurableLowerBound=null;counts.referenceRequestsStatus='SPAWNED_UNAVAILABLE';}else if(label==='typescript-emit')processStarts.typescript++;else if(label==='source-esbuild')processStarts.esbuild++;else processStarts.validator++;}progress();
    const chunks={stdout:[],stderr:[]},hashes={stdout:createHash('sha256'),stderr:createHash('sha256')};
    let finish=null,killTimer=null,closeTimer=null,spawnError=null;
    const stop=()=>{
      if(record.timedOut)return;
      record.timedOut=true;cp.kill('SIGTERM');
      killTimer=setTimeout(()=>cp.kill('SIGKILL'),500);
      closeTimer=setTimeout(()=>{cp.stdout.destroy();cp.stderr.destroy();finish?.();},1500);
    };
    const timer=setTimeout(stop,Math.max(1,Math.min(maxMs,phaseUntil-performance.now(),start+170000-performance.now())));
    record.observedBytes=0;record.omittedBytes=0;
    for(const name of ['stdout','stderr']){
      cp[name].on('data',chunk=>{
        hashes[name].update(chunk);record.observedBytes+=chunk.length;
        const kept=chunk.subarray(0,Math.max(0,4*MIB-childCaptured));
        childCaptured+=kept.length;record.capturedBytes+=kept.length;record.omittedBytes+=chunk.length-kept.length;
        if(kept.length)chunks[name].push(kept);if(kept.length<chunk.length)stop();
      });
      cp[name].once('end',()=>{record[name+'EOF']=true;});
      cp[name].once('error',error=>{record.pipeError=String(error.message);stop();});
    }
    await new Promise(resolveDone=>{finish=resolveDone;cp.once('error',error=>{spawnError=error;resolveDone();});cp.once('close',(code,signal)=>{record.exit=code;record.signal=signal;record.closed=true;resolveDone();});});
    clearTimeout(timer);clearTimeout(killTimer);clearTimeout(closeTimer);
    for(const name of ['stdout','stderr']){record[name+'Sha256']=hashes[name].digest('hex');await write(label+'.'+name+'.raw',Buffer.concat(chunks[name]));}
    await write(label+'.command.json',record);progress();
    assert(!spawnError,spawnError?.message);assert(!record.timedOut,'child deadline '+label);assert(!record.pipeError&&record.closed&&record.stdoutEOF&&record.stderrEOF,'child pipe EOF and close '+label);assert.equal(record.exit,0,'child nonzero '+label);checkTime();return record;
  }
  async function recoverOraclePrefix(){
    const recoveryErrors=[];
    const note=(phase,error)=>recoveryErrors.push({phase,code:error?.code??null,message:String(error?.message??error).slice(0,512)});
    if(processStarts.oracle===0){
      counts.referenceRequests=0;counts.referenceRequestsDurableLowerBound=0;counts.referenceRequestsStatus='NOT_STARTED';
      oracleObservedPrefix={status:'ORACLE_NOT_STARTED',actualCountsKnown:true,referenceRequests:0,recoveryErrors};return;
    }
    counts.referenceRequests=null;counts.referenceRequestsDurableLowerBound=null;counts.referenceRequestsStatus='SPAWNED_UNAVAILABLE';
    oracleObservedPrefix={status:'ORACLE_SPAWNED_COUNTS_UNAVAILABLE',actualCounts:'UNKNOWN',inFlight:'UNKNOWN',durableLowerBound:null,recoveryErrors};
    try{
      assert(oracleAuthorization,'recorded pre-spawn oracle authorization');
      await exactPin(oracleAuthorization.freeze.path,oracleAuthorization.freeze);
      for(const [name,pin]of Object.entries(oracleAuthorization.inputs))await exactPin(resolve(HERE,name),pin);
    }catch(error){note('oracle-provider-authentication',error);return;}
    const checkedCounts=value=>{
      assert(value&&typeof value==='object'&&!Array.isArray(value));
      for(const [key,count]of Object.entries(value))assert(Number.isSafeInteger(count)&&count>=0,'nonnegative durable oracle count '+key);
      assert(Number.isSafeInteger(value.requestsAttempted)&&value.requestsAttempted<=23);
      assert(Number.isSafeInteger(value.requestsReturned)&&value.requestsReturned<=value.requestsAttempted);
      assert(value.acceptedReferences<=13&&value.expectedRefusals<=10);
      for(const prefix of ['exactKkt','exactCondition','decimal80','decimal120'])assert(Number.isSafeInteger(value[prefix+'Attempted'])&&value[prefix+'Attempted']<=13&&Number.isSafeInteger(value[prefix+'Returned'])&&value[prefix+'Returned']<=value[prefix+'Attempted']);
      assert.equal(value.WorldCalls,0);assert.equal(value.candidateCalls,0);assert.equal(value.nativeFixtureConversions,0);
      return value;
    };
    const capture=async(name,limit)=>{
      const path=resolve(oracleOut,name),info=await lstat(path);assert(info.isFile()&&!info.isSymbolicLink(),'owned ordinary oracle receipt');
      const raw=await readBound(path,limit),original={path,bytes:raw.length,sha256:sha(raw)};
      let copy=null;
      try{copy=await write('oracle-failure-'+name+'.raw',raw);assert.equal(copy.bytes,original.bytes);assert.equal(copy.sha256,original.sha256);}catch(error){note(name+'-copy',error);}
      const saved={original,copy,authentication:{owner:'fresh owned oracle run directory',oraclePid:commands.find(x=>x.label==='oracle')?.pid??null,oracleFreeze:oracleAuthorization.freeze,sourcePin:oracleAuthorization.inputs['oracle.py']}};
      oracleObservedPrefix.snapshots??=[];oracleObservedPrefix.snapshots.push(saved);
      return {saved,value:JSON.parse(raw)};
    };
    try{
      const {saved,value}=await capture('summary.json',MIB);
      assert.equal(value.runId,runId+'-oracle');assert(['FAIL','PASS_INDEPENDENT_IMPULSE_ORACLE'].includes(value.status));
      assert.equal(value.provenance.freezeSha256,oracleAuthorization.freeze.sha256);
      for(const [name,pin]of Object.entries(oracleAuthorization.inputs)){assert.equal(value.provenance.inputs[name].bytes,pin.bytes);assert.equal(value.provenance.inputs[name].sha256,pin.sha256);}
      const actual=checkedCounts(value.counts);counts.referenceRequests=actual.requestsAttempted;counts.referenceRequestsDurableLowerBound=actual.requestsAttempted;counts.referenceRequestsStatus='AUTHORITATIVE_SUMMARY';
      oracleSummaryPin=saved.original;
      Object.assign(oracleObservedPrefix,{status:'ORIGINAL_ORACLE_SUMMARY_AUTHORITATIVE',actualCountsKnown:true,actualCounts:actual,inFlight:'reported by original final summary',durableLowerBound:actual,firstFailure:value.firstFailure??null,summary:saved});return;
    }catch(error){note('summary-read-or-authentication',error);}
    try{
      const {saved,value}=await capture('progress.json',8192);
      assert(['IN_PROGRESS','FAIL','PASS_INDEPENDENT_IMPULSE_ORACLE'].includes(value.status));assert(typeof value.phase==='string'&&value.phase.length<=256);
      assert(value.caseId===null||typeof value.caseId==='string'&&/^[A-Za-z0-9-]{1,96}$/.test(value.caseId));
      const durable=checkedCounts(value.counts);
      counts.referenceRequestsDurableLowerBound=durable.requestsAttempted;counts.referenceRequestsStatus='DURABLE_LOWER_BOUND_ACTUAL_UNKNOWN';
      Object.assign(oracleObservedPrefix,{status:'ORIGINAL_ORACLE_PROGRESS_DURABLE_LOWER_BOUND',actualCountsKnown:false,actualCounts:'UNKNOWN',inFlight:'UNKNOWN: progress may precede further work or reply commit',durableLowerBound:durable,atSnapshot:{caseId:value.caseId,phase:value.phase,attemptedMinusReturned:durable.requestsAttempted-durable.requestsReturned},firstFailure:value.firstFailure??null,progress:saved});
    }catch(error){note('progress-read-or-authentication',error);}
  }
  try{
    let oracleAbsent=false;try{await stat(oracleOut);}catch(error){if(error.code==='ENOENT')oracleAbsent=true;else throw error;}assert(oracleAbsent,'fresh oracle run id');
    const freeze=await authenticate(),cases=JSON.parse(await readBound(resolve(HERE,'CASES.json'))),plan=JSON.parse(await readBound(resolve(HERE,'RUNNER-PLAN.json')));
    await write('literal-metadata-preflight.json',preflightLiteralMetadata(cases));
    const candidateReady=JSON.parse(await readBound(resolve(HERE,'CANDIDATE-AUTHOR-READY.json')));
    for(const key of ['point.velocityMps','rigid.velocityMps','rigid.angularVelocityRadps','report.pointLinearImpulseNs','report.rigidLinearImpulseNs','report.rigidAngularImpulseNms','report.relativeVelocityBeforeMps','report.relativeVelocityAfterMps','report.kineticEnergyBeforeJ','report.kineticEnergyAfterJ','report.dissipatedEnergyJ'])assert(candidateReady.reportToOracleMapping[key],'report mapping metadata '+key);
    await write('start.json',{runId,freezeSha256:token,freezePath,counts,resources,planSha256:freeze.files[relative(ROOT,resolve(HERE,'RUNNER-PLAN.json'))].sha256});
    phase('build',20000);const build=resolve(out,'build'),overlay=resolve(build,'overlay'),native=resolve(build,'native');await mkdir(overlay,{recursive:true});
    const original=await readBound(resolve(HERE,'candidate.ts'),65536),instrumented=instrument(original.toString());assert(Buffer.byteLength(instrumented.effective)<=131072,'bounded effective source');
    await writeFile(resolve(build,'package.json'),json({type:'module'}),{flag:'wx'});await writeFile(resolve(overlay,'candidate.ts'),instrumented.effective,{flag:'wx'});
    counts.sourceBuilds++;progress();
    await command(freeze.tools.esbuildBinary,[resolve(overlay,'candidate.ts'),'--bundle','--platform=node','--format=esm','--target=node22','--log-level=error','--outfile='+resolve(build,'source.mjs'),'--metafile='+resolve(build,'source-metafile.json')],'source-esbuild',10000);
    const sourceMetafile=JSON.parse(await readBound(resolve(build,'source-metafile.json'),65536));
    assert.equal(Object.keys(sourceMetafile.inputs).length,1);assert(Object.values(sourceMetafile.outputs).every(o=>o.imports.length===0),'candidate source has no imports');
    assert((await stat(resolve(build,'source.mjs'))).size<=MIB,'bounded candidate source bundle');
    const config={compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],types:[],strict:true,declaration:true,skipLibCheck:true,noEmitOnError:true,rootDir:overlay,outDir:native},files:[resolve(overlay,'candidate.ts')]};
    await writeFile(resolve(build,'tsconfig.json'),json(config),{flag:'wx'});counts.typescriptProcesses++;progress();
    await command(freeze.tools.node,[freeze.tools.typescriptCLI,'--project',resolve(build,'tsconfig.json'),'--listFiles'],'typescript-emit',15000);
    const compilerFiles=(await readBound(resolve(out,'typescript-emit.stdout.raw'))).toString().trim().split(/\r?\n/).filter(Boolean);
    for(const path of compilerFiles)assert(path===resolve(overlay,'candidate.ts')||freeze.toolFiles[path],'unfrozen actual compiler input '+path);
    const nativePath=resolve(native,'candidate.js');let nativeBytes=await readBound(nativePath);assert(!/^\s*(?:import|export\s+.*\sfrom)\s/m.test(nativeBytes.toString()),'no native source fallback/import');
    assert(await ownedTreeBytes(build)<=16*MIB,'isolated source/build16MiB');
    const sourceProviderPin=await filePin(resolve(build,'source.mjs')),nativeProviderPin=await filePin(nativePath);
    await write('build-provider.json',{originalCandidateSha256:sha(original),effectiveCandidateSha256:sha(instrumented.effective),sites:instrumented.sites,source:sourceProviderPin,native:nativeProviderPin,declarations:await filePin(resolve(native,'candidate.d.ts')),sourceMetafile,actualCompilerInputs:compilerFiles,sourceFallback:false});
    nativeBytes=null;completed.push('isolated-source-native-build');
    phase('oracle',100000);
    const oracleInputs=Object.fromEntries(['CONTRACT.md','CASES.json','AUTHORING-FREEZE-01.json','oracle.py','ORACLE-AUTHOR-READY.json'].map(name=>[name,freeze.files[relative(ROOT,resolve(HERE,name))]]));
    const oracleFreeze=await write('oracle-execution-freeze.json',{status:'PARENT_AUTHORIZED_IMPULSE_ORACLE_EXECUTION',runtimeAuthorized:true,p5Closed:true,inputs:oracleInputs});
    oracleAuthorization={freeze:oracleFreeze,inputs:oracleInputs,parentFreezeSha256:token};
    counts.oracleProcesses++;progress();
    await command(freeze.tools.python,['-B',resolve(HERE,'oracle.py'),'--run-id',runId+'-oracle','--freeze',oracleFreeze.path,'--token',oracleFreeze.sha256],'oracle',100000);
    oracleSummaryPin=await filePin(resolve(oracleOut,'summary.json'));const oracleSummary=JSON.parse(await readBound(oracleSummaryPin.path));
    assert.equal(oracleSummary.status,'PASS_INDEPENDENT_IMPULSE_ORACLE');const oc=oracleSummary.counts;
    for(const [key,value]of Object.entries({requestsAttempted:23,requestsReturned:23,acceptedReferences:13,exactKktAttempted:13,exactKktReturned:13,exactConditionAttempted:13,exactConditionReturned:13,decimal80Attempted:13,decimal80Returned:13,decimal120Attempted:13,decimal120Returned:13}))assert.equal(oc[key],value,'oracle counts '+key);
    assert.equal(oracleSummary.replies.length,23);counts.referenceRequests=23;counts.referenceRequestsDurableLowerBound=23;counts.referenceRequestsStatus='AUTHORITATIVE_SUMMARY';progress();
    const replyPins=new Map();
    for(const item of oracleSummary.replies){assert(/^[A-Za-z0-9-]+\.reply\.json$/.test(item.path));const path=resolve(oracleOut,item.path);assert(within(oracleOut,path));await exactPin(path,item);replyPins.set(item.path.slice(0,-11),{...item,path});}
    for(const c of cases.acceptedCases){const reply=JSON.parse(await readBound(replyPins.get(c.id).path));assert.equal(reply.status,'ACCEPTED_REFERENCE');assert.equal(reply.caseId,c.id);}
    for(const c of cases.refusalCases){const reply=JSON.parse(await readBound(replyPins.get(c.id).path));assert.equal(reply.status,'EXPECTED_REFUSAL');assert.equal(reply.reason,c.reason);}
    oracleEvidenceBytes=await ownedTreeBytes(oracleOut);assert(oracleEvidenceBytes<=8*MIB,'oracle artifact8MiB');assert(stored+oracleEvidenceBytes<=8*MIB-65536,'combined evidence reserve');completed.push('oracle-23-pass');
    phase('fixtures',5000);const fixtureInputs=new Map(),fixturePins=new Map();
    for(const c of [...cases.acceptedCases,...cases.refusalCases]){
      let literal=instantiateLiteral(c,cases),savedReply=JSON.parse(await readBound(replyPins.get(c.id).path));
      assert.deepEqual(literal,savedReply.rawIdealInput,'same literal reference/native case before conversion');savedReply=null;
      counts.fixtureConversions++;progress();const input=convertLiteral(literal);literal=null;
      fixtureInputs.set(c.id,input);fixturePins.set(c.id,await write(c.id+'.input-raw.json',numericRaw(input)));
    }
    assert.equal(counts.fixtureConversions,23);completed.push('23-global-native-conversions');
    const sourceOutputs=new Map();
    const checkCandidateWorking=()=>{const serialized=JSON.stringify([...fixtureInputs].map(([key,value])=>[key,numericRaw(value)]))+JSON.stringify([...sourceOutputs])+JSON.stringify(commands);const bytes=Buffer.byteLength(serialized);resources.peakCandidateOwnedPayloadChargeBytes=Math.max(resources.peakCandidateOwnedPayloadChargeBytes??0,4*MIB+32*bytes);assert(4*MIB+32*bytes<=8*MIB,'candidate8MiB owned payload charge model');};
    checkCandidateWorking();
    for(const graph of ['source','native']){
      graphName=graph;phase(graph,20000);
      let currentCall=null;
      const local={attempts:0,returns:0,refusals:0,faultThrows:0,solveEntries:0,firstSideVisits:0,pairVisits:0,validatorProcesses:0};let activeFault=null,marker=null;
      const observer={entry(){local.attempts++;counts.candidateAttempts++;progress();},solve(){local.solveEntries++;counts.candidateSolves++;progress();},first(){local.firstSideVisits++;progress();if(activeFault==='first')throw marker;},pair(){local.pairVisits++;progress();if(activeFault==='pair')throw marker;}};
      assert(!Object.hasOwn(globalThis,'__impulseObserve'),'no observer collision');globalThis.__impulseObserve=observer;
      try{
        const selectedProvider=graph==='source'?sourceProviderPin:nativeProviderPin;await exactPin(selectedProvider.path,selectedProvider);
        const provider=await import(pathToFileURL(selectedProvider.path).href);
        assert.equal(typeof provider.projectClothRigidImpulse,'function');
        const invoke=(input,expectation)=>{checkTime();const before=snapshot(input),prior={...local};currentCall={input};progress();let value,error,didThrow=false;
          try{value=provider.projectClothRigidImpulse(input);counts.candidateReturns++;}catch(caught){didThrow=true;error=caught;counts.candidateThrows++;}finally{assert.equal(snapshot(input),before,'input unchanged after '+caseId);}
          assert.equal(local.attempts,prior.attempts+1,'one actual candidate entry');
          if(expectation==='accepted'){if(didThrow){counts.candidateUnexpectedThrows++;throw error;}assert.equal(local.solveEntries,prior.solveEntries+1);assert(value);assertNoAliases(input,value);preservedFields(input,value);local.returns++;}
          else if(expectation==='refusal'){assert(error instanceof provider.ImpulseInputError);assert.equal(error.code,'INVALID_INPUT');assert.equal(local.solveEntries,prior.solveEntries);assert.equal(local.firstSideVisits,prior.firstSideVisits);assert.equal(value,undefined);local.refusals++;counts.candidateRefusals++;}
          else{assert.equal(error,marker,'unknown marker object identity');assert.equal(value,undefined);assert.equal(local.solveEntries,prior.solveEntries+1);local.faultThrows++;counts.candidateFaults++;}
          currentCall=null;progress();return{value,error};};
        for(const c of cases.acceptedCases){caseId=c.id;const input=detachedClone(fixtureInputs.get(c.id)),{value}=invoke(input,'accepted');const raw=numericRaw(value),rawText=JSON.stringify(raw);
          if(graph==='source')sourceOutputs.set(c.id,rawText);else assert.equal(rawText,sourceOutputs.get(c.id),'ALL source/native output numeric bits and structure');checkCandidateWorking();
          const outputPin=await write(graph+'-'+c.id+'.output-raw.json',raw);counts.validatorProcesses++;local.validatorProcesses++;progress();
          const request=await write(graph+'-'+c.id+'.validation-request.json',{caseId:c.id,graph,validationOrdinal:counts.validatorProcesses,executionFreezeSha256:token,input:fixturePins.get(c.id),output:outputPin,oracleReply:replyPins.get(c.id),oracleSummary:oracleSummaryPin});
          const resultPath=resolve(out,graph+'-'+c.id+'.validation.json');
          let validationCommandError=null;
          try{await command(freeze.tools.python,['-B',resolve(HERE,'native-validate.py'),'--request',request.path,'--request-sha256',request.sha256,'--freeze',freezePath,'--token',token,'--out',resultPath],graph+'-'+c.id+'-validate',5000);}catch(error){validationCommandError=error;}
          let result=null,validationPin=null;
          try{const resultRaw=await readBound(resultPath,262144);stored+=resultRaw.length;result=JSON.parse(resultRaw);validationPin=await filePin(resultPath);counts.validatorReplies++;}catch(error){if(!validationCommandError)throw error;}
          if(validationCommandError){const failure=new Error(result?.firstFailure?.message??validationCommandError.message);failure.evidence=validationPin;throw failure;}
          assert.equal(result.status,'PASS_NATIVE_F64_PHYSICAL_AUDIT');assert.equal(result.linearSolves,0);counts.validatorPasses++;completed.push(graph+':'+c.id);progress();
          assert(stored+await ownedTreeBytes(oracleOut)<=8*MIB-65536,'combined evidence8MiB');checkTime();
        }
        for(const c of cases.refusalCases){caseId=c.id;const {error}=invoke(detachedClone(fixtureInputs.get(c.id)),'refusal');assert.equal(error.reason,c.reason);completed.push(graph+':'+c.id);await write(graph+'-'+c.id+'.refusal.json',{status:'PASS_EXPECTED_REFUSAL',code:error.code,reason:error.reason,inputUnchanged:true});}
        for(const [i,c]of cases.faultCases.entries()){caseId=c.id;activeFault=i===0?'first':'pair';marker=new Error(c.marker);invoke(detachedClone(fixtureInputs.get(c.baseAcceptedCase)),'fault');activeFault=null;await write(graph+'-'+c.id+'.fault.json',{status:'PASS_UNKNOWN_MARKER_IDENTITY',marker:c.marker,inputUnchanged:true,noPairOutput:true});completed.push(graph+':'+c.id);}
        assert.deepEqual(local,{attempts:25,returns:13,refusals:10,faultThrows:2,solveEntries:15,firstSideVisits:15,pairVisits:14,validatorProcesses:13});graphs[graph]={status:'PASS_PRIVATE_CANDIDATE_GRAPH',counts:local};await write(graph+'-summary.json',graphs[graph]);
      }finally{currentCall=null;delete globalThis.__impulseObserve;}
    }
    phase('finalize',5000);await authenticate();await exactPin(sourceProviderPin.path,sourceProviderPin);await exactPin(nativeProviderPin.path,nativeProviderPin);
    assert.equal(counts.candidateAttempts,50);assert.equal(counts.candidateSolves,30);assert.equal(counts.candidateReturns,26);assert.equal(counts.candidateThrows,24);assert.equal(counts.candidateUnexpectedThrows,0);assert.equal(counts.candidateRefusals,20);assert.equal(counts.candidateFaults,4);assert.equal(counts.validatorProcesses,26);assert.equal(counts.validatorPasses,26);assert.equal(counts.validatorReplies,26);assert.deepEqual(processStarts,{oracle:1,esbuild:1,typescript:1,validator:26});
    assert(await ownedTreeBytes(out)-await ownedTreeBytes(build)+await ownedTreeBytes(oracleOut)<=8*MIB-65536,'actual combined evidence8MiB with summary reserve');assert(await ownedTreeBytes(out)+await ownedTreeBytes(oracleOut)<=24*MIB,'build16MiB plus combined evidence8MiB');completed.push('post-authentication-and-ledger');
  }catch(error){
    firstFailure={name:error?.name??typeof error,message:String(error?.message??error).slice(0,4096),phase:phaseName,graph:graphName,caseId,code:error?.code??null,reason:error?.reason??null,evidence:error?.evidence??null,assertion:{actual:error?.actual??null,expected:error?.expected??null,operator:error?.operator??null}};
    try{await recoverOraclePrefix();}catch(recoveryError){oracleObservedPrefix??={actualCounts:'UNKNOWN',inFlight:'UNKNOWN'};oracleObservedPrefix.recoveryFatal={name:recoveryError?.name??'Error',message:String(recoveryError?.message??recoveryError).slice(0,512)};}
  }
  finally{
    delete globalThis.__impulseObserve;
    const summary={status:firstFailure?'FAIL_PRIVATE_IMPULSE_CAMPAIGN':'PASS_PRIVATE_IMPULSE_REDUCED_PLANT',runId,freezeSha256:token,counts,actualChildProcessStarts:processStarts,graphs,completed,commands,firstFailure,resources,oracleSummary:oracleSummaryPin,oracleObservedPrefix,elapsedMs:performance.now()-start,publicAPI:'UNCHANGED',trajectory:'NOT_RUN',RSSClaim:false};
    progress();await write('summary.json',summary,true);console.log(JSON.stringify({status:summary.status,counts,firstFailure}));if(firstFailure)process.exitCode=1;
  }
}
await main();
