/** Baseline acquisition only. Parent command-run owns the detached process group. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream,writeFileSync} from 'node:fs';
import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..'),MIB=1048576;
const sha=b=>createHash('sha256').update(b).digest('hex'),json=x=>JSON.stringify(x,null,2)+'\n';
const inside=(base,path)=>path===base||path.startsWith(base+'/');
async function pin(path){const info=await stat(path),hash=createHash('sha256');for await(const block of createReadStream(path,{highWaterMark:65536}))hash.update(block);return{path,bytes:info.size,sha256:hash.digest('hex')};}
async function auth(path,expected){const actual=await pin(path);assert.equal(actual.bytes,expected.bytes,path);assert.equal(actual.sha256,expected.sha256,path);return actual;}
async function bounded(path,max=262144){assert((await stat(path)).size<=max,'bounded input '+path);return readFile(path);}
function clone(value){return Array.isArray(value)?value.map(clone):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)])):value;}
function raw(value,context={nodes:0},depth=0){
  assert(++context.nodes<=4096&&depth<=16,'fixed one-body plain graph bounds');
  if(typeof value==='number'){const bytes=Buffer.alloc(8);bytes.writeDoubleLE(value);return{$f64le:bytes.toString('hex')};}
  if(value===null||typeof value==='boolean'||typeof value==='string'){if(typeof value==='string')assert(value.length<=4096);return value;}
  assert(value&&typeof value==='object','ordinary data only');
  const array=Array.isArray(value);assert(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype));
  const keys=Reflect.ownKeys(value);if(array){assert(keys.length===value.length+1);for(let i=0;i<value.length;i++)assert(Object.hasOwn(value,i));}
  const entries=[];
  for(const key of keys){if(array&&key==='length')continue;assert(typeof key==='string');const d=Object.getOwnPropertyDescriptor(value,key);assert(d&&'value'in d&&d.enumerable,'no accessor output');entries.push([key,raw(d.value,context,depth+1)]);}
  return array?entries.map(([,v])=>v):Object.fromEntries(entries);
}
const snapshot=v=>JSON.stringify(raw(v));
function containers(value,set=new Set()){if(value&&typeof value==='object'){assert(!set.has(value),'unshared acyclic data graph');set.add(value);for(const x of Object.values(value))containers(x,set);}return set;}
function detached(output,inputs){const owned=containers(output);for(const input of inputs)for(const object of containers(input))assert(!owned.has(object),'output/input alias');}
function exactKeys(value,keys){assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),keys.slice().sort());}
function stateGuard(state,cursor,options,expectedDigest){
  exactKeys(state,['identity','stepIndex','timeSeconds','bodies','contacts','events','joints','ccdHits','cloths','fluids','pairStats']);
  const finite=v=>{if(typeof v==='number')assert(Number.isFinite(v),'finite state');else if(v&&typeof v==='object')for(const x of Object.values(v))finite(x);};finite(state);
  assert(Object.is(state.stepIndex,cursor)&&Object.is(state.timeSeconds,cursor===0?0:options.fixedStepSeconds),'actual API cursor');
  exactKeys(state.identity,['modelRevision','modelDigest','configurationDigest','providerDigest','profile','frameId','fixedStepSeconds']);
  assert.equal(state.identity.providerDigest,expectedDigest);assert.equal(state.identity.modelRevision,'g1a-baseline-2276');assert.equal(state.identity.profile,options.profile);assert.equal(state.identity.frameId,'g1World');assert(Object.is(state.identity.fixedStepSeconds,options.fixedStepSeconds));
  for(const key of ['modelDigest','configurationDigest','providerDigest'])assert(/^sha256:[0-9a-f]{64}$/.test(state.identity[key]));
  for(const key of ['contacts','events','joints','ccdHits','cloths','fluids'])assert(Array.isArray(state[key])&&state[key].length===0,'empty '+key);
  assert(Array.isArray(state.bodies)&&state.bodies.length===1);const body=state.bodies[0];exactKeys(body,['id','kind','positionM','orientationXYZW','velocityMps','angularVelocityRadps','sleeping']);assert.equal(body.id,'rotor');assert.equal(body.kind,'dynamic');assert.equal(body.sleeping,false);
  for(const key of ['positionM','velocityMps','angularVelocityRadps','orientationXYZW'])assert(Array.isArray(body[key])&&body[key].length===(key==='orientationXYZW'?4:3));
  exactKeys(state.pairStats,['eligiblePairs','candidatePairs','aabbTests']);for(const value of Object.values(state.pairStats))assert.equal(value,0);
}
function comparePair(source,native,expected,path=''){
  if(path==='identity/providerDigest'){assert.equal(source,expected.source);assert.equal(native,expected.native);assert.notEqual(source,native);return;}
  if(source&&typeof source==='object'){assert(native&&typeof native==='object');assert.equal(Array.isArray(source),Array.isArray(native));assert.deepEqual(Object.keys(source).sort(),Object.keys(native).sort());for(const key of Object.keys(source))comparePair(source[key],native[key],expected,path?path+'/'+key:key);}
  else assert.equal(source,native,'exact raw public field '+path);
}
const physicalPath=path=>/^(?:model\/gravityMps2\/\d|model\/bodies\/0\/(?:massKg|initial\/(?:positionM|orientationXYZW|velocityMps|angularVelocityRadps)\/\d)|model\/colliders\/0\/(?:geometry\/halfExtentsM\/\d|local\/(?:positionM|orientationXYZW)\/\d|material\/(?:restitution|friction\/(?:static|dynamic)))|options\/fixedStepSeconds)$/.test(path);
function convertPhysicalLiteral(value,path,counts){
  if(physicalPath(path)){assert(typeof value==='string'&&/^-?(0|[1-9][0-9]*)(\/[1-9][0-9]*)?$/.test(value));const [n,d='1']=value.split('/');counts.nativeScalarConversions++;return Number(n)/Number(d);}
  if(Array.isArray(value))return value.map((x,i)=>convertPhysicalLiteral(x,path+'/'+i,counts));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,x])=>[k,convertPhysicalLiteral(x,path+'/'+k,counts)]));return value;
}
function nativePair(cases,counts){counts.nativePairConversions++;return{model:convertPhysicalLiteral(cases.literalModel,'model',counts),options:convertPhysicalLiteral(cases.literalOptions,'options',counts)};}
async function nativeClosure(path,freeze,visited){
  assert(inside(resolve(ROOT,'packages/barocss-physics/dist'),path)&&path.endsWith('.js'),'published-only closure');if(visited.has(path))return;visited.add(path);
  const name=relative(ROOT,path);assert(freeze.files[name]);await auth(path,freeze.files[name]);const code=(await bounded(path,4*MIB)).toString();assert(!/\bimport\s*\(/.test(code),'no native dynamic/source fallback');
  const specifiers=[...code.matchAll(/\bimport\s+(?:[^;]*?\bfrom\s*)?["']([^"']+)["']/g),...code.matchAll(/\bexport\s+\*\s+from\s*["']([^"']+)["']/g)];
  for(const match of specifiers){assert(match[1].startsWith('.'),'native root cannot import SDK/CAD');await nativeClosure(resolve(dirname(path),match[1]),freeze,visited);}
}
async function bytesUnder(path){let sum=0;for(const item of await readdir(path,{withFileTypes:true})){assert(!item.isSymbolicLink());const child=resolve(path,item.name);sum+=item.isDirectory()?await bytesUnder(child):(await stat(child)).size;}return sum;}
async function main(){
  const args=process.argv.slice(2);assert.equal(args.length,7);assert(args.every(x=>x.length<=4096),'bounded CLI strings');assert.deepEqual(args.filter(x=>x.startsWith('--')),['--run-id','--freeze','--token','--authorize-baseline']);
  const id=args[1],freezePath=resolve(args[3]),token=args[5];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(process.versions.node.startsWith('22.'));
  const started=performance.now(),out=resolve(HERE,'evidence',id);await mkdir(dirname(out),{recursive:true});await mkdir(out,{recursive:false});
  const counts={nativePairConversions:0,nativeScalarConversions:0,constructorAttempts:0,constructorReturns:0,getStateAttempts:0,getStateReturns:0,stepAttempts:0,stepReturns:0,disposeAttempts:0,disposeReturns:0,getModel:0,query:0,recorder:0,WorldApisAfterClassificationStarts:0,sourceBuildStarts:0,classifierStarts:0};
  const graphs={},commands=[],cleanupErrors=[];let classificationStarted=false,phase='auth',firstFailure=null,classifierObservation=null,stored=0,logs=0,closedPin=null,buildPath=null;
  const progress=()=>writeFileSync(resolve(out,'progress.json'),json({phase,counts,graphs,commands,classificationStarted,firstFailure,classifierObservation}));
  const time=()=>assert(performance.now()-started<170000,'170s internal deadline');
  const write=async(name,value)=>{const data=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:json(value));assert(data.length<=(name==='input-raw.json'||/-(?:before|after)-raw\.json$/.test(name)?65536:524288));const used=await bytesUnder(out)-(buildPath?await bytesUnder(buildPath):0);assert(used+data.length+(name==='summary.json'?0:65536)<=2097152,'2MiB actual evidence plus progress/final reserve');await writeFile(resolve(out,name),data,{flag:'wx'});stored+=data.length;return pin(resolve(out,name));};
  async function command(executable,argv,label){
    time();const row={label,command:[executable,...argv],pid:null,closed:false,stdoutEOF:false,stderrEOF:false,exit:null,timedOut:false};commands.push(row);progress();
    const child=spawn(executable,argv,{cwd:ROOT,stdio:['ignore','pipe','pipe'],detached:false});row.pid=child.pid??null;if(row.pid){if(label==='source-build')counts.sourceBuildStarts++;else{counts.classifierStarts++;classifierObservation={actual:'UNKNOWN',durableLowerBound:null,inFlight:'UNKNOWN'};}}progress();
    const buffers={stdout:[],stderr:[]};let finish;const killers=[];const stop=()=>{if(row.timedOut)return;row.timedOut=true;child.kill('SIGTERM');killers.push(setTimeout(()=>child.kill('SIGKILL'),500),setTimeout(()=>{child.stdout.destroy();child.stderr.destroy();finish?.();},1500));};
    const timer=setTimeout(stop,Math.max(1,170000-(performance.now()-started)));
    for(const key of ['stdout','stderr']){child[key].on('data',data=>{const kept=data.subarray(0,Math.max(0,131072-logs));logs+=kept.length;buffers[key].push(kept);if(kept.length<data.length)stop();});child[key].once('end',()=>{row[key+'EOF']=true;});child[key].once('error',error=>{row.pipeError=String(error.message);stop();});}
    await new Promise(done=>{finish=done;child.once('error',error=>{row.spawnError=String(error.message);done();});child.once('close',(code,signal)=>{row.closed=true;row.exit=code;row.signal=signal;done();});});clearTimeout(timer);for(const timer of killers)clearTimeout(timer);
    for(const key of ['stdout','stderr'])await write(label+'.'+key+'.raw',Buffer.concat(buffers[key]));progress();
    assert(row.closed&&row.stdoutEOF&&row.stderrEOF&&!row.timedOut&&!row.pipeError&&!row.spawnError,'closed child pipes');assert.equal(row.exit,0,'child exit '+label);time();
  }
  try{
    const rawFreeze=await bounded(freezePath);assert.equal(sha(rawFreeze),token);const freeze=JSON.parse(rawFreeze);assert.equal(freeze.status,'PARENT_AUTHORIZED_G1_BASELINE_CHARACTERIZATION');assert.equal(freeze.mode,'BASELINE_CHARACTERIZATION_ONLY');assert.equal(freeze.runtimeAuthorized,true);assert.equal(freeze.futureRepairAuthorized,false);assert.equal(freeze.runId,id);
    for(const name of ['CONTRACT.md','CASES.json','AUTHORING-FREEZE-01.json','PROVIDER-IDENTITY-CLARIFICATION-01.json','INTEGRATION-AUDIT.md','baseline.mjs','baseline-classify.py','BASELINE-PLAN.json','BASELINE-AUTHOR-READY.json'])assert(freeze.files[relative(ROOT,resolve(HERE,name))]);
    for(const [name,expected]of Object.entries(freeze.files)){assert(!isAbsolute(name)&&inside(ROOT,resolve(ROOT,name)));await auth(resolve(ROOT,name),expected);}
    for(const [name,expected]of Object.entries(freeze.toolFiles)){assert(isAbsolute(name));await auth(name,expected);}for(const key of ['node','python','esbuildBinary'])assert(freeze.toolFiles[freeze.tools[key]]);assert.equal(freeze.tools.node,process.execPath);assert(freeze.highReview.approved&&freeze.files[freeze.highReview.path]);assert(freeze.files['examples/physics-world-p5-2276/command-run.mjs']);
    const cases=JSON.parse(await bounded(resolve(HERE,'CASES.json'))),clarification=JSON.parse(await bounded(resolve(HERE,'PROVIDER-IDENTITY-CLARIFICATION-01.json')));
    for(const [name,hash]of Object.entries(cases.sourceBaseline.producerPins))assert.equal((await pin(resolve(ROOT,name))).sha256,hash);
    const expected={};for(const graph of ['source','native']){const info=clarification.producers[graph];expected[graph]=info.expectedProviderDigest;await auth(resolve(ROOT,info.unchangedCurrentManifest.path),info.unchangedCurrentManifest);await auth(resolve(ROOT,info.priorActualReceipt.path),info.priorActualReceipt);}
    const packagePath='packages/barocss-physics/package.json';assert(freeze.files[packagePath]);const pkg=JSON.parse(await bounded(resolve(ROOT,packagePath)));assert.equal(pkg.exports['.'].import,'./src/index.ts');assert.equal(pkg.publishConfig.exports['.'].import,'./dist/index.js');
    phase='build';progress();const build=resolve(out,'build');await mkdir(build,{recursive:false});buildPath=build;const sourceRoot=resolve(ROOT,'packages/barocss-physics/src/index.ts'),sourceEntry=resolve(build,'source.mjs'),nativeEntry=resolve(ROOT,'packages/barocss-physics',pkg.publishConfig.exports['.'].import);
    await command(freeze.tools.esbuildBinary,[sourceRoot,'--bundle','--platform=node','--format=esm','--target=node22','--log-level=error','--outfile='+sourceEntry,'--metafile='+resolve(build,'source-meta.json')],'source-build');
    const meta=JSON.parse(await bounded(resolve(build,'source-meta.json')));assert(Object.values(meta.outputs).every(x=>x.imports.length===0));for(const name of Object.keys(meta.inputs)){const path=resolve(ROOT,name),relativePath=relative(ROOT,path);assert(relativePath.startsWith('packages/barocss-physics/src/'),'own CAD-free source root only');assert(freeze.files[relativePath]);await auth(path,freeze.files[relativePath]);}
    const visited=new Set();await nativeClosure(nativeEntry,freeze,visited);assert(await bytesUnder(build)<=16*MIB);const providers={source:await pin(sourceEntry),native:await pin(nativeEntry)};await write('providers.json',{providers,sourceMetafile:meta,nativeClosure:[...visited],identityClarification:await pin(resolve(HERE,'PROVIDER-IDENTITY-CLARIFICATION-01.json')),expectedPublicProviderDigests:expected});
    phase='convert-one-pair';progress();const pair=nativePair(cases,counts),inputRaw=raw(pair),inputPin=await write('input-raw.json',inputRaw),inputImage=snapshot(pair),states={},statePins={};
    assert(Buffer.byteLength(inputImage)<=65536);await write('intended-literal-input.json',{model:cases.literalModel,options:cases.literalOptions});
    for(const graph of ['source','native']){
      phase='capture-'+graph;const local={status:'IN_PROGRESS',constructorOutcome:'NOT_STARTED',disposeOutcome:'NOT_STARTED'};graphs[graph]=local;const copy=clone(pair),image=snapshot(copy);let world=null,primary=null;progress();
      const api=async(name,action)=>{assert(!classificationStarted,'no World API after classification');counts[name+'Attempts']++;progress();const value=action();counts[name+'Returns']++;assert.equal(snapshot(copy),image,'input remains raw unchanged after '+name);assert.equal(snapshot(pair),inputImage);progress();return value;};
      try{
        await auth(providers[graph].path,providers[graph]);const module=await import(pathToFileURL(providers[graph].path).href);assert.equal(typeof module.createPhysicsWorld,'function');
        world=await api('constructor',()=>{world=module.createPhysicsWorld(copy.model,copy.options);return world;});local.constructorOutcome='WORLD_RETURNED';
        const before=await api('getState',()=>world.getState());statePins[graph+'Before']=await write(graph+'-before-raw.json',raw(before));stateGuard(before,0,pair.options,expected[graph]);detached(before,[copy,pair]);
        const after=await api('step',()=>world.step([]));statePins[graph+'After']=await write(graph+'-after-raw.json',raw(after));stateGuard(after,1,pair.options,expected[graph]);detached(after,[copy,pair,before]);
        states[graph]={before,after};local.status='CAPTURE_GUARDS_PASSED';
      }catch(error){primary=error;local.status='CAPTURE_FAILURE';if(!world)local.constructorOutcome='NO_WORLD_RETURNED_INTERNAL_ALLOCATION_UNKNOWN';}
      finally{
        if(world){counts.disposeAttempts++;progress();try{world.dispose();counts.disposeReturns++;local.disposeOutcome='RETURNED';}catch(error){local.disposeOutcome='THREW_ACTUAL_OUTCOME_UNKNOWN';cleanupErrors.push({graph,name:error?.name,message:String(error?.message??error)});primary??=error;}finally{world=null;}}
        try{assert.equal(snapshot(copy),image);assert.equal(snapshot(pair),inputImage);}catch(error){primary??=error;}
        progress();
      }
      if(primary)throw primary;
    }
    phase='close-capture';const rawExpected={source:expected.source,native:expected.native};for(const moment of ['before','after'])comparePair(raw(states.source[moment]),raw(states.native[moment]),rawExpected);
    for(const key of ['constructorAttempts','constructorReturns','getStateAttempts','getStateReturns','stepAttempts','stepReturns','disposeAttempts','disposeReturns'])assert.equal(counts[key],2,key);
    closedPin=await write('capture-closed.json',{status:'CAPTURE_CLOSED_COMPLETE',counts:{...counts},graphs,allWorldReferencesReleased:true,providerDigestInequality:{source:expected.source,native:expected.native,publicValuesUntouched:true},publicRawParity:'all other identity and complete nonidentity state fields exactly equal',statePins,inputPin});
    classificationStarted=true;phase='classification-files-only';progress();
    const request=await write('classification-request.json',{mode:'BASELINE_CHARACTERIZATION_ONLY',freezeSha256:token,artifacts:{closed:closedPin,input:inputPin,...statePins}}),resultPath=resolve(out,'classification.json');
    let classificationCommandFailure=null;try{await command(freeze.tools.python,['-B',resolve(HERE,'baseline-classify.py'),'--request',request.path,'--request-sha256',request.sha256,'--freeze',freezePath,'--token',token,'--out',resultPath],'classifier');}catch(error){classificationCommandFailure=error;}
    try{let result=JSON.parse(await bounded(resultPath,524288));classifierObservation={status:result.status,counts:result.counts,firstPhysicalFailure:result.firstPhysicalFailure,executionFailure:result.executionFailure,graphArtifacts:result.graphArtifacts,workingData:result.workingData,artifact:await pin(resultPath)};result=null;}catch(readError){classifierObservation={actual:'UNKNOWN',inFlight:'UNKNOWN',readFailure:String(readError.message),durableLowerBound:null};try{const path=resolve(out,'classifier-progress.json'),original=await bounded(path,8192);classifierObservation.durableLowerBound=JSON.parse(original);classifierObservation.originalProgress=await pin(path);await write('classifier-progress-original.raw',original);}catch(progressError){classifierObservation.progressReadFailure=String(progressError.message);}}
    if(classificationCommandFailure)throw classificationCommandFailure;
    assert(['CHARACTERIZED_PHYSICAL_NO_GO','CHARACTERIZED_NO_FAILURE_OBSERVED'].includes(classifierObservation.status));
    phase='post-auth';for(const [name,expectedPin]of Object.entries(freeze.files))await auth(resolve(ROOT,name),expectedPin);await auth(providers.source.path,providers.source);await auth(providers.native.path,providers.native);assert(await bytesUnder(out)-await bytesUnder(build)<=2097152-65536);time();
  }catch(error){firstFailure={phase,name:error?.name??typeof error,message:String(error?.message??error).slice(0,4096),code:error?.code??null};}
  finally{
    const status=firstFailure?(classificationStarted?'REFERENCE_OR_RESOURCE_FAILURE':'BASELINE_CAPTURE_FAILURE'):classifierObservation.status;
    const summary={status,mode:'BASELINE_CHARACTERIZATION_ONLY',counts,graphs,closedCapture:closedPin,classificationStarted,classifierObservation,firstFailure,cleanupErrors,commands,elapsedMs:performance.now()-started,physicalPASS:false,WorldApisAfterClassificationStarts:counts.WorldApisAfterClassificationStarts,RSSClaim:false};
    progress();await write('summary.json',summary);console.log(JSON.stringify({status,counts,firstFailure,firstPhysicalFailure:classifierObservation?.firstPhysicalFailure??null}));if(firstFailure)process.exitCode=1;
  }
}
await main();
