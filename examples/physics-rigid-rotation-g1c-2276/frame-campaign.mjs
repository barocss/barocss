/** Parent-run, finite staged frame validation. No build or production adoption. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,stat,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const SELF=fileURLToPath(import.meta.url),HERE=dirname(SELF),ROOT=resolve(HERE,'../..'),MIB=1048576;
const OLD=resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/evidence');
const META=resolve(OLD,'g1b-micro-02/staged-providers.json'),BASE=resolve(OLD,'g1b-native-completion-02/input-1.json');
const REFERENCE=resolve(HERE,'reference-frame.py');
const REQUIRED=[resolve(OLD,'g1b-micro-02/summary.json'),resolve(OLD,'g1b-micro-02/source-initial-private.json'),resolve(OLD,'g1b-trajectory-01-reference-rows/bank-80-02.json'),resolve(OLD,'g1b-trajectory-01-reference-rows/bank-120-02.json'),resolve(OLD,'g1b-trajectory-01/reference/bank.json'),resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/REFERENCE-BANK-REUSE-T02.json')];
const hash=data=>createHash('sha256').update(data).digest('hex');
const json=value=>JSON.stringify(value)+'\n';
const inside=(base,path)=>path===base||path.startsWith(base+'/');
async function bounded(path,limit){assert((await stat(path)).size<=limit,'file bound '+path);return readFile(path);}
async function auth(path,expected){
  assert(expected&&Number.isSafeInteger(expected.bytes)&&expected.bytes>=0&&/^[a-f0-9]{64}$/.test(expected.sha256));
  assert.equal(await realpath(path),path,'no symlink '+path);const info=await stat(path);assert(info.isFile());assert.equal(info.size,expected.bytes,path);
  const digest=createHash('sha256');for await(const block of createReadStream(path,{highWaterMark:65536}))digest.update(block);
  assert.equal(digest.digest('hex'),expected.sha256,path);
}
function raw(value,ctx={nodes:0},depth=0){
  assert(++ctx.nodes<=16384&&depth<=32,'raw graph bound');
  if(typeof value==='number'){assert(Number.isFinite(value));const b=Buffer.alloc(8);b.writeDoubleLE(value);return{$f64le:b.toString('hex')};}
  if(value===null||typeof value==='boolean'||typeof value==='string'){if(typeof value==='string')assert(value.length<=4096);return value;}
  assert(value&&typeof value==='object');const array=Array.isArray(value);assert.equal(Object.getPrototypeOf(value),array?Array.prototype:Object.prototype);
  const keys=Reflect.ownKeys(value);if(array)assert.equal(keys.length,value.length+1);
  const pairs=keys.filter(k=>k!=='length'||!array).map(k=>{assert(typeof k==='string');const d=Object.getOwnPropertyDescriptor(value,k);assert(d&&'value'in d&&d.enumerable);return[k,raw(d.value,ctx,depth+1)];});
  return array?pairs.map(([,v])=>v):Object.fromEntries(pairs);
}
function decode(value){
  if(value&&typeof value==='object'&&Object.hasOwn(value,'$f64le')){assert.deepEqual(Object.keys(value),['$f64le']);assert(/^[a-f0-9]{16}$/.test(value.$f64le));return Buffer.from(value.$f64le,'hex').readDoubleLE();}
  if(Array.isArray(value))return value.map(decode);
  return value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)])):value;
}
const snapshot=value=>JSON.stringify(raw(value));
const clone=value=>structuredClone(value);
function objects(value,set=new Set()){
  if(value&&typeof value==='object'){assert(!set.has(value),'public graph has sharing/cycle');set.add(value);for(const item of Object.values(value))objects(item,set);}return set;
}
function detached(output,inputs){const seen=objects(output);for(const input of inputs)for(const item of objects(input))assert(!seen.has(item),'public alias');}
function parity(a,b,expected,path=''){
  if(path==='identity/providerDigest'){assert.equal(a,expected.source);assert.equal(b,expected.native);return;}
  if(a&&typeof a==='object'){assert(b&&typeof b==='object');assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const key of Object.keys(a))parity(a[key],b[key],expected,path?path+'/'+key:key);}
  else assert.equal(a,b,'public raw parity '+path);
}
function stateGuard(state,cursor,pair,expected){
  raw(state);assert(Object.is(state.stepIndex,cursor));assert(Object.is(state.timeSeconds,cursor===0?0:pair.options.fixedStepSeconds));
  assert.equal(state.identity.providerDigest,expected);assert.equal(state.identity.profile,pair.options.profile);assert.equal(state.identity.frameId,pair.model.frame.id);
  assert(Object.is(state.identity.fixedStepSeconds,pair.options.fixedStepSeconds));
  for(const key of ['modelDigest','configurationDigest','providerDigest'])assert(/^sha256:[a-f0-9]{64}$/.test(state.identity[key]));
  assert.equal(state.bodies.length,1);assert.equal(state.bodies[0].id,pair.model.bodies[0].id);assert.equal(state.bodies[0].kind,'dynamic');assert.equal(state.bodies[0].sleeping,false);
  for(const key of ['contacts','events','joints','ccdHits','cloths','fluids'])assert.deepEqual(state[key],[]);
  for(const n of Object.values(state.pairStats))assert(Object.is(n,0));
  for(const key of ['positionM','velocityMps'])assert.equal(snapshot(state.bodies[0][key]),snapshot(pair.model.bodies[0].initial[key]));
}
async function main(){
  const argv=process.argv.slice(2);assert.equal(argv.length,6);assert.deepEqual([argv[0],argv[2],argv[4]],['--run-id','--freeze','--token']);
  const id=argv[1],freezePath=resolve(argv[3]),token=argv[5];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(/^[a-f0-9]{64}$/.test(token));assert(process.versions.node.startsWith('22.'));
  const freezeBytes=await bounded(freezePath,2*MIB);assert.equal(hash(freezeBytes),token);const freeze=JSON.parse(freezeBytes);
  const out=resolve(HERE,'evidence',id);await mkdir(out,{recursive:false});
  const started=performance.now(),counts={moduleEvaluations:0,constructors:0,reads:0,steps:0,disposals:0,referenceSpawns:0,privateObservations:0},completed=[],cleanupErrors=[];
  let firstFailure=null,phase='auth',evidenceBytes=0,peakLogicalBytes=0,meta=null,cases=null,casesDocument=null,base=null,currentWorld=null,basePrivate=null,reuseEvidence=null,reusedSourcePasses=0;
  const sourceRecords=new Map(),live={};
  const time=()=>assert(performance.now()-started<170000,'inner 170s deadline');
  // Conservative logical ownership charge; this is not a process heap/RSS measurement.
  const charge=(...extra)=>{const seen=new Set();let n=4*MIB,nodes=0;
    const walk=value=>{assert(++nodes<=200000,'owned node bound');if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean'){n+=16;return;}
      if(typeof value==='string'){n+=48+4*value.length;return;}assert(typeof value==='object');if(seen.has(value))return;seen.add(value);n+=128;
      if(Buffer.isBuffer(value)){n+=2*value.length;return;}if(value instanceof Map){n+=64*value.size;for(const[k,v]of value){walk(k);walk(v);}return;}
      for(const[k,v]of Object.entries(value)){n+=64+4*k.length;walk(v);}};
    walk({freezeBytes,freeze,meta,base,basePrivate,casesDocument,cases,reuseEvidence,completed,sourceRecords,live,counts,firstFailure,cleanupErrors,extra});peakLogicalBytes=Math.max(peakLogicalBytes,n);assert(n<=32*MIB,'logical harness bound');};
  async function put(name,value,limit=65536){const encoded=json(value),data=Buffer.from(encoded);charge(value,encoded,data);assert(data.length<=limit,name+' record bound');assert(evidenceBytes+data.length+65536<=16*MIB,'evidence bound');await writeFile(resolve(out,name),data,{flag:'wx'});evidenceBytes+=data.length;return resolve(out,name);}
  async function authenticate(){
    time();assert(freeze.files&&typeof freeze.files==='object');assert(Object.keys(freeze.files).length<=512);
    for(const [name,pin] of Object.entries(freeze.files)){assert(!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));await auth(path,pin);}
    for(const path of [SELF,REFERENCE,META,BASE,...REQUIRED,resolve(ROOT,freeze.casesFile)])assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'missing frozen file '+path);
    assert.equal(freeze.reuseSource.id,'b01-cycle-yzx');
    for(const [key,name] of Object.entries({recordFile:'source-b01-cycle-yzx.json',auditFile:'source-b01-cycle-yzx-reference.json',summaryFile:'summary.json'})){
      const path=resolve(ROOT,freeze.reuseSource[key]);assert.equal(path,resolve(HERE,'evidence/g1c-frame-01',name));assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'missing reuse pin '+key);
    }
    assert(isAbsolute(freeze.tools.python));assert.equal(freeze.tools.pythonPin.path,freeze.tools.python);assert.equal(freeze.tools.nodePin.path,process.execPath);await auth(freeze.tools.python,freeze.tools.pythonPin);await auth(process.execPath,freeze.tools.nodePin);
    if(meta){assert.equal(meta.stagedPins.length,262);for(const pin of meta.stagedPins){assert(inside(resolve(OLD,'g1b-micro-02/build'),pin.path));await auth(pin.path,pin);}
      assert.equal(meta.transfer.length,88);for(const entry of meta.transfer){const path=resolve(ROOT,'packages/barocss-physics/src',entry.name);assert(inside(resolve(ROOT,'packages/barocss-physics/src'),path));await auth(path,entry.original);}}
  }
  async function reference(recordPath,resultName){
    time();const output=resolve(out,resultName),command=[freeze.tools.python,'-B',REFERENCE,'--input',recordPath,'--output',output];counts.referenceSpawns++;
    let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),primary=null,closed=false;
    const child=spawn(command[0],command.slice(1),{cwd:ROOT,stdio:['ignore','pipe','pipe']});
    const fail=e=>{primary??=e;child.kill('SIGKILL');};
    const timer=setTimeout(()=>fail(new Error('reference 10s deadline')),Math.min(10000,Math.max(1,170000-(performance.now()-started))));
    try{
      const result=await new Promise((yes,no)=>{
        child.once('error',e=>{primary??=e;});
        for(const [stream,key] of [[child.stdout,'stdout'],[child.stderr,'stderr']])stream.on('data',block=>{if(key==='stdout')stdout=Buffer.concat([stdout,block]);else stderr=Buffer.concat([stderr,block]);if(stdout.length+stderr.length>65536)fail(new Error('reference output bound'));});
        child.once('close',(code,signal)=>{closed=true;yes({code,signal});});
      });
      assert(stdout.length+stderr.length<=65536,'reference output bound');
      await put(resultName+'.wire.json',{command,result,stdout:stdout.toString(),stderr:stderr.toString()},65536);
      if(primary)throw primary;assert.equal(result.code,0,'reference exit');const wire=JSON.parse(stdout.toString());assert.equal(wire.status,'PASS_G1C_FRAME_AUDIT','reference stdout');
      const bytes=await bounded(output,65536);assert(evidenceBytes+bytes.length+65536<=16*MIB);evidenceBytes+=bytes.length;const report=JSON.parse(bytes);assert.equal(report.status,'PASS_G1C_FRAME_AUDIT','reference result');charge(stdout,stderr,wire,bytes,bytes.toString(),report);
      return {bytes:bytes.length,sha256:hash(bytes),status:report.status};
    }finally{clearTimeout(timer);if(!closed)child.kill('SIGKILL');}
  }
  try{
    await authenticate();meta=JSON.parse(await bounded(META,MIB));await authenticate();assert.equal(JSON.parse(await bounded(REQUIRED[0],65536)).status,'PASS_STAGED_G1B_MICRO_ONLY');basePrivate=JSON.parse(await bounded(REQUIRED[1],65536));
    casesDocument=JSON.parse(await bounded(resolve(ROOT,freeze.casesFile),65536));cases=Array.isArray(casesDocument)?casesDocument:casesDocument.rows;assert(Array.isArray(cases)&&cases.length===8);assert.equal(new Set(cases.map(c=>c.id)).size,cases.length);
    base=decode(JSON.parse(await bounded(BASE,65536)));assert.equal(base.options.fixedStepSeconds,1/120);assert.equal(base.model.bodies.length,1);
    const derive=row=>{const pair=clone(base),body=pair.model.bodies[0];pair.model.colliders[0].geometry.halfExtentsM=clone(row.halfExtentsM);body.massKg=row.massKg;body.initial.orientationXYZW=clone(row.qXYZW);body.initial.angularVelocityRadps=clone(row.omegaWorldRadps);return pair;};
    const loadReuse=async key=>JSON.parse(await bounded(resolve(ROOT,freeze.reuseSource[key]),65536));
    reuseEvidence={summary:await loadReuse('summaryFile'),record:await loadReuse('recordFile'),audit:await loadReuse('auditFile')};
    const {summary:prior,record:saved,audit:savedAudit}=reuseEvidence,reuseId=freeze.reuseSource.id,reuseRow=cases.find(row=>row.id===reuseId);assert(reuseRow);
    assert.equal(prior.status,'FAIL');assert.equal(prior.runId,'g1c-frame-01');assert.equal(prior.phase,'source');
    assert.deepEqual(prior.counts,{moduleEvaluations:1,constructors:1,reads:1,steps:1,disposals:1,referenceSpawns:1,privateObservations:1});
    assert.deepEqual(prior.cleanupErrors,['controls: staged observer/control leak']);assert.equal(prior.firstFailure.phase,'source');assert.equal(prior.firstFailure.name,'AssertionError');assert.equal(prior.firstFailure.message,'cleanup failed\n\n1 !== 0\n');
    assert.equal(prior.completed.length,1);assert.equal(prior.completed[0].graph,'source');assert.equal(prior.completed[0].id,reuseId);assert.equal(prior.completed[0].audit.status,'PASS_G1C_FRAME_AUDIT');
    assert.equal(prior.completed[0].audit.sha256,freeze.files[freeze.reuseSource.auditFile].sha256);assert.equal(prior.completed[0].audit.bytes,freeze.files[freeze.reuseSource.auditFile].bytes);
    assert.equal(saved.graph,'source');assert.equal(saved.id,reuseId);assert.equal(savedAudit.graph,'source');assert.equal(savedAudit.id,reuseId);assert.equal(savedAudit.status,'PASS_G1C_FRAME_AUDIT');
    const reusePair=derive(reuseRow);assert.deepEqual(saved.case,raw(reuseRow));assert.deepEqual(saved.inputRaw,raw(reusePair));
    stateGuard(decode(saved.beforeRaw),0,reusePair,meta.expectedProviderDigests.source);stateGuard(decode(saved.afterRaw),1,reusePair,meta.expectedProviderDigests.source);
    assert.deepEqual(saved.beforeRaw.identity,saved.afterRaw.identity);
    assert.deepEqual(saved.initialPrivateRaw.orientationXYZW,saved.beforeRaw.bodies[0].orientationXYZW);assert.deepEqual(saved.initialPrivateRaw.inertiaDiagonalKgM2,reuseRow.bodyPermutation.map(i=>basePrivate.inertiaDiagonalKgM2[i]));assert.equal(decode(saved.trace).count,595);
    sourceRecords.set(reuseId,{beforeRaw:saved.beforeRaw,afterRaw:saved.afterRaw});completed.push({...prior.completed[0],reuseKind:'SAVED_PASS_OLD_CAMPAIGN_CLEANUP_FAIL',recordFile:freeze.reuseSource.recordFile,auditFile:freeze.reuseSource.auditFile,summaryFile:freeze.reuseSource.summaryFile});reusedSourcePasses=1;charge(reusePair);
    for(const graph of ['source','native']){
      phase=graph;time();await authenticate();
      const entry=resolve(OLD,'g1b-micro-02/build',graph==='source'?'source.mjs':'package/dist/index.js');
      const api=await import(pathToFileURL(entry).href);counts.moduleEvaluations++;
      const controls=graph==='source'?api:await import(pathToFileURL(resolve(dirname(entry),'g1-test-control.js')).href);if(graph==='native')counts.moduleEvaluations++;
      assert.equal(typeof api.createPhysicsWorld,'function');assert(controls.g1bControl&&controls.g1Control);assert.deepEqual(controls.g1bControl.take(),[]);
      for(const row of cases){
        time();assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.id));if(graph==='source'&&row.id===reuseId)continue;const pair=derive(row);
        const inputWords=snapshot(pair);Object.assign(live,{pair,inputWords});assert.notEqual(inputWords,snapshot(base),'no repeated original baseline row');let before,after,trace,initialPrivateRaw;
        try{
          counts.constructors++;currentWorld=api.createPhysicsWorld(pair.model,pair.options);
          counts.reads++;before=currentWorld.getState();stateGuard(before,0,pair,meta.expectedProviderDigests[graph]);detached(before,[pair]);const beforeWords=snapshot(before);Object.assign(live,{before,beforeWords});
          counts.privateObservations++;initialPrivateRaw=(()=>{const cache=controls.g1Control.cache(currentWorld);assert.equal(cache.stepIndex,0);assert.equal(cache.running,false);const b=cache.bodies.find(b=>b.id==='rotor');assert(b);return{bodyId:b.id,inertiaDiagonalKgM2:raw(b.inertiaDiagonalKgM2),orientationXYZW:raw(b.orientation)};})();
          assert.deepEqual(initialPrivateRaw.orientationXYZW,raw(before.bodies[0].orientationXYZW));assert.deepEqual(initialPrivateRaw.inertiaDiagonalKgM2,row.bodyPermutation.map(i=>basePrivate.inertiaDiagonalKgM2[i]));live.initialPrivateRaw=initialPrivateRaw;
          counts.steps++;after=currentWorld.step([]);trace=controls.g1bControl.take();assert.equal(trace.length,595,'general-flow trace count');
          const traceCounts={};for(const item of trace)traceCounts[item.kind]=(traceCounts[item.kind]??0)+1;assert.deepEqual(traceCounts,{initialMomentum:1,newtonCondition:108,pivot:324,newtonUpdate:108,midpointResidual:27,stageComplete:27});assert.deepEqual(raw(trace.find(v=>v.kind==='initialMomentum').value.moments),initialPrivateRaw.inertiaDiagonalKgM2);
          stateGuard(after,1,pair,meta.expectedProviderDigests[graph]);assert.equal(snapshot(pair),inputWords,'input changed');assert.equal(snapshot(before),beforeWords,'previous output changed');detached(after,[pair,before]);
          const traceText=snapshot(trace),traceBytes=Buffer.from(traceText);Object.assign(live,{after,trace,traceText,traceBytes});assert(traceBytes.length<=MIB,'trace byte bound');
          const record={graph,id:row.id,case:raw(row),inputRaw:raw(pair),initialPrivateRaw,beforeRaw:raw(before),afterRaw:raw(after),trace:raw({count:trace.length,counts:traceCounts,bytes:traceBytes.length,sha256:hash(traceBytes)})};
          live.record=record;live.recordText=json(record);charge();const recordPath=await put(graph+'-'+row.id+'.json',record);
          if(graph==='source')sourceRecords.set(row.id,{beforeRaw:record.beforeRaw,afterRaw:record.afterRaw});else{const source=sourceRecords.get(row.id);parity(source.beforeRaw,record.beforeRaw,meta.expectedProviderDigests);parity(source.afterRaw,record.afterRaw,meta.expectedProviderDigests);}
          const audit=await reference(recordPath,graph+'-'+row.id+'-reference.json');completed.push({graph,id:row.id,audit});
        }catch(error){firstFailure??={phase,name:error.name,message:error.message,stack:error.stack};throw error;}
        finally{
          if(currentWorld){
            try{counts.disposals++;currentWorld.dispose();}catch(error){cleanupErrors.push('dispose: '+error.message);}
            try{controls.g1Control.cancel();}catch(error){cleanupErrors.push('cancel: '+error.message);}
            try{controls.g1Control.release(currentWorld);}catch(error){cleanupErrors.push('release: '+error.message);}finally{currentWorld=null;}
          }
          try{controls.g1bControl.take();controls.g1bControl.assertEmpty();controls.g1Control.assertReleased();}catch(error){cleanupErrors.push('controls: '+error.message);}
          for(const key of Object.keys(live))delete live[key];
        }
        assert.equal(cleanupErrors.length,0,'cleanup failed');
      }
    }
    assert.deepEqual(counts,{moduleEvaluations:3,constructors:15,reads:15,steps:15,disposals:15,referenceSpawns:15,privateObservations:15});assert.equal(completed.length,16);assert.equal(completed.filter(row=>row.reuseKind).length,1);assert.equal(reusedSourcePasses,1);assert.equal(cleanupErrors.length,0);
  }catch(error){firstFailure??={phase,name:error.name,message:error.message,stack:error.stack};}
  finally{
    try{await authenticate();}catch(error){if(firstFailure)cleanupErrors.push('post-auth: '+error.message);else firstFailure={phase:'post-auth',name:error.name,message:error.message,stack:error.stack};}
    const summary={status:firstFailure||cleanupErrors.length?'FAIL':'PASS_COMPOSITE_G1C_FRAME_WITH_PRESERVED_CLEANUP_FAIL',runId:id,phase,counts,reusedSourcePasses,preservedFailure:reuseEvidence?.summary.firstFailure??null,completed,firstFailure,cleanupErrors,evidenceBytes,peakLogicalBytes,innerMs:performance.now()-started,productionAdoption:'NOT_RUN'};
    await put('summary.json',summary);process.stdout.write(json({status:summary.status,summary:resolve(out,'summary.json')}));if(firstFailure||cleanupErrors.length)process.exitCode=1;
  }
}
main().catch(error=>{process.stderr.write(String(error.stack??error)+'\n');process.exitCode=1;});
