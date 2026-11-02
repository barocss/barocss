/** Parent-frozen G1d integration only. Authoring this driver executes no Physics. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,stat,readdir,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const SELF=fileURLToPath(import.meta.url),HERE=dirname(SELF),ROOT=resolve(HERE,'../..'),MIB=1048576;
const OLD=resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/evidence'),COPIED=resolve(OLD,'g1b-micro-02/build/package'),SRC=resolve(COPIED,'src');
const META=resolve(OLD,'g1b-micro-02/staged-providers.json'),BASE=resolve(OLD,'g1b-native-completion-02/input-1.json'),REFERENCE=resolve(HERE,'reference-integration.py');
const REQUIRED=[SELF,REFERENCE,resolve(HERE,'CONTRACT.md'),META,BASE,resolve(OLD,'g1b-micro-02/summary.json'),resolve(ROOT,'examples/physics-rigid-rotation-g1c-2276/reference-frame.py'),resolve(OLD,'g1b-trajectory-01/reference/bank.json'),resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/REFERENCE-BANK-REUSE-T02.json'),...[80,120].flatMap(p=>['02','04'].map(i=>resolve(OLD,`g1b-trajectory-01-reference-rows/bank-${p}-${i}.json`)))];
const ENTRY=['index.ts','replay.ts'].map(name=>`export * from ${JSON.stringify(resolve(SRC,name))};`).concat(`export { g1Control, g1bControl } from ${JSON.stringify(resolve(SRC,'g1-test-control.ts'))};`).join('\n')+'\n';
const hash=value=>createHash('sha256').update(value).digest('hex'),json=value=>JSON.stringify(value)+'\n';
const inside=(base,path)=>path===base||path.startsWith(base+'/');
async function bounded(path,limit=65536){assert((await stat(path)).size<=limit,'file bound '+path);return readFile(path);}
async function pin(path){const info=await stat(path);assert(info.isFile());const h=createHash('sha256');for await(const block of createReadStream(path,{highWaterMark:65536}))h.update(block);return{path,bytes:info.size,sha256:h.digest('hex')};}
async function auth(path,wanted){assert(wanted&&Number.isSafeInteger(wanted.bytes)&&/^[a-f0-9]{64}$/.test(wanted.sha256));assert.equal(await realpath(path),path);const got=await pin(path);assert.equal(got.bytes,wanted.bytes,path);assert.equal(got.sha256,wanted.sha256,path);}
function raw(value,ctx={nodes:0},depth=0){
  assert(++ctx.nodes<=16384&&depth<=32);if(typeof value==='number'){assert(Number.isFinite(value));const b=Buffer.alloc(8);b.writeDoubleLE(value);return{$f64le:b.toString('hex')};}
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;assert(value&&typeof value==='object');const array=Array.isArray(value);assert.equal(Object.getPrototypeOf(value),array?Array.prototype:Object.prototype);
  const keys=Reflect.ownKeys(value);if(array)assert.equal(keys.length,value.length+1);const pairs=keys.filter(k=>!array||k!=='length').map(k=>{assert(typeof k==='string');const d=Object.getOwnPropertyDescriptor(value,k);assert(d&&'value'in d&&d.enumerable);return[k,raw(d.value,ctx,depth+1)];});return array?pairs.map(([,v])=>v):Object.fromEntries(pairs);
}
function decode(value){if(value&&typeof value==='object'&&Object.hasOwn(value,'$f64le')){assert.deepEqual(Object.keys(value),['$f64le']);assert(/^[a-f0-9]{16}$/.test(value.$f64le));return Buffer.from(value.$f64le,'hex').readDoubleLE();}if(Array.isArray(value))return value.map(decode);return value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,decode(v)])):value;}
const snapshot=value=>JSON.stringify(raw(value));
function containers(value,set=new Set()){if(value&&typeof value==='object'){assert(!set.has(value),'public sharing/cycle');set.add(value);for(const item of Object.values(value))containers(item,set);}return set;}
function detached(value,others){const owned=containers(value);for(const other of others)for(const item of containers(other))assert(!owned.has(item),'public output alias');}
function parity(a,b,expected,path=''){
  if(path.endsWith('providerDigest')){assert.equal(a,expected.source);assert.equal(b,expected.native);return;}
  if(a&&typeof a==='object'){assert(b&&typeof b==='object');assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))parity(a[k],b[k],expected,path?path+'/'+k:k);}else assert.equal(a,b,'raw parity '+path);
}
/** Stable identities include owner callbacks as identities only; no callbacks run. */
function cacheSerializer(){const ids=new WeakMap();let next=0;return cache=>{
  const seen=new Set();let nodes=0;const id=o=>{if(!ids.has(o))ids.set(o,++next);return ids.get(o);};
  const visit=(v,depth=0,root=false)=>{assert(++nodes<=16384&&depth<=32);if(v===undefined)return{$undefined:true};if(typeof v==='number')return raw(v);if(v===null||typeof v==='boolean'||typeof v==='string')return v;
    if(typeof v==='function')return{$function:id(v)};assert(typeof v==='object');const identity=root?null:id(v);if(seen.has(v))return{$ref:identity};seen.add(v);
    if(v instanceof Map)return{$id:identity,$map:[...v].map(([k,x])=>[visit(k,depth+1),visit(x,depth+1)])};
    const array=Array.isArray(v);assert([Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)));const entries=[];
    for(const k of Reflect.ownKeys(v)){if(array&&k==='length')continue;assert(typeof k==='string');const d=Object.getOwnPropertyDescriptor(v,k);assert(d&&'value'in d);entries.push([k,visit(d.value,depth+1)]);}return{$id:identity,type:array?'array':'object',entries};};
  const text=JSON.stringify(visit(cache,0,true));assert(Buffer.byteLength(text)<=131072);return text;};}
function stateGuard(state,cursor,pair,provider){
  raw(state);assert(Object.is(state.stepIndex,cursor));assert(Object.is(state.timeSeconds,cursor===0?0:cursor*pair.options.fixedStepSeconds));assert.equal(state.identity.providerDigest,provider);assert.equal(state.identity.profile,pair.options.profile);assert.equal(state.identity.frameId,pair.model.frame.id);assert.equal(state.identity.modelRevision,pair.model.revision);assert(Object.is(state.identity.fixedStepSeconds,pair.options.fixedStepSeconds));
  for(const key of ['modelDigest','configurationDigest','providerDigest'])assert(/^sha256:[a-f0-9]{64}$/.test(state.identity[key]));assert.equal(state.bodies.length,1);assert.equal(state.bodies[0].id,'rotor');assert.equal(state.bodies[0].kind,'dynamic');assert.equal(state.bodies[0].sleeping,false);
  for(const key of ['contacts','events','joints','ccdHits','cloths','fluids'])assert.deepEqual(state[key],[]);for(const n of Object.values(state.pairStats))assert(Object.is(n,0));for(const key of ['positionM','velocityMps'])assert.equal(snapshot(state.bodies[0][key]),snapshot(pair.model.bodies[0].initial[key]));
}
async function tree(path){let bytes=0;const pins=[];for(const item of await readdir(path,{withFileTypes:true})){assert(!item.isSymbolicLink());const p=resolve(path,item.name);if(item.isDirectory()){const sub=await tree(p);bytes+=sub.bytes;pins.push(...sub.pins);}else{assert(item.isFile());const info=await pin(p);bytes+=info.bytes;pins.push(info);}}return{bytes,pins};}
async function main(){
  const argv=process.argv.slice(2);assert.equal(argv.length,6);assert.deepEqual([argv[0],argv[2],argv[4]],['--run-id','--freeze','--token']);const id=argv[1],freezePath=resolve(argv[3]),token=argv[5];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(/^[a-f0-9]{64}$/.test(token));
  const freezeBytes=await bounded(freezePath,2*MIB);assert.equal(hash(freezeBytes),token);const freeze=JSON.parse(freezeBytes),out=resolve(HERE,'evidence',id);await mkdir(out,{recursive:false});
  const started=performance.now(),counts={buildChildren:0,referenceChildren:0,entryEvaluations:0,explicitConstructors:0,restoreCalls:0,explicitRecorderAttachments:0,worldReads:0,recorderReads:0,saveRecording:0,worldStepAttempts:0,recorderStepAttempts:0,explicitAcceptedSteps:0,refusals:0,worldDisposals:0,recorderDisposals:0,privateCacheReads:0},commands=[],completed=[],graphs={},cleanupErrors=[],live={},sourceResults=new Map();
  let phase='auth',firstFailure=null,meta=null,base=null,evidenceBytes=0,buildInfo=null,peakLogicalBytes=0;
  const time=()=>assert(performance.now()-started<170000,'170s internal deadline');
  // Owned data charge, including pending encodings; 4MiB reserves module/stack/layout overhead. No RSS claim.
  const charge=(...extra)=>{let bytes=4*MIB,nodes=0;const seen=new Set();const walk=v=>{assert(++nodes<=150000);if(v===null||v===undefined||typeof v==='number'||typeof v==='boolean'){bytes+=16;return;}if(typeof v==='string'){bytes+=48+4*v.length;return;}assert(typeof v==='object');if(seen.has(v))return;seen.add(v);bytes+=128;if(Buffer.isBuffer(v)){bytes+=2*v.length;return;}if(v instanceof Map){for(const[k,x]of v){bytes+=64;walk(k);walk(x);}return;}for(const[k,x]of Object.entries(v)){bytes+=64+4*k.length;walk(x);}};walk({freezeBytes,freeze,meta,base,counts,commands,completed,graphs,cleanupErrors,live,sourceResults,buildInfo,firstFailure,extra});peakLogicalBytes=Math.max(bytes,peakLogicalBytes);assert(bytes<=16*MIB,'harness logical16MiB');};
  async function put(name,value,limit=65536){const text=typeof value==='string'?value:json(value),data=Buffer.from(text);assert(data.length<=limit,name+' bound');charge(text,data,value);assert(evidenceBytes+data.length+65536<=16*MIB);await writeFile(resolve(out,name),data,{flag:'wx'});evidenceBytes+=data.length;return resolve(out,name);}
  async function authenticate(){
    time();assert(Object.keys(freeze.files).length<=512);for(const[name,wanted]of Object.entries(freeze.files)){assert(!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));await auth(path,wanted);}for(const path of REQUIRED)assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'missing frozen file '+path);
    for(const name of ['node','python','esbuild']){assert(isAbsolute(freeze.tools[name]));assert.equal(freeze.tools[name+'Pin'].path,freeze.tools[name]);await auth(freeze.tools[name],freeze.tools[name+'Pin']);}assert.equal(freeze.tools.node,process.execPath);assert(process.versions.node.startsWith('22.'));assert.equal(Buffer.byteLength(ENTRY),freeze.sourceEntry.bytes);assert.equal(hash(ENTRY),freeze.sourceEntry.sha256);
    if(meta){assert.equal(meta.stagedPins.length,262);for(const p of meta.stagedPins){assert(inside(resolve(OLD,'g1b-micro-02/build'),p.path));await auth(p.path,p);}assert.equal(meta.transfer.length,88);for(const t of meta.transfer){const path=resolve(ROOT,'packages/barocss-physics/src',t.name);assert(inside(resolve(ROOT,'packages/barocss-physics/src'),path));await auth(path,t.original);}}
    if(buildInfo)for(const p of buildInfo.pins)await auth(p.path,p);
  }
  async function child(label,command){
    time();const row={label,command,pid:null,exit:null,signal:null,closed:false};commands.push(row);let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),primary=null;
    const proc=spawn(command[0],command.slice(1),{cwd:ROOT,stdio:['ignore','pipe','pipe']});row.pid=proc.pid??null;
    const fail=e=>{primary??=e;proc.kill('SIGKILL');};const timer=setTimeout(()=>fail(new Error(label+' 20s deadline')),Math.min(20000,Math.max(1,170000-(performance.now()-started))));
    try{await new Promise(yes=>{proc.once('error',e=>{primary??=e;});for(const[stream,key]of[[proc.stdout,'out'],[proc.stderr,'err']]){stream.on('error',fail);stream.on('data',block=>{if(stdout.length+stderr.length+block.length>65536){fail(new Error(label+' output bound'));return;}if(key==='out')stdout=Buffer.concat([stdout,block]);else stderr=Buffer.concat([stderr,block]);});}proc.once('close',(exit,signal)=>{Object.assign(row,{exit,signal,closed:true});yes();});});
      charge(stdout,stderr);await put(label+'.stdout.raw',stdout.toString());await put(label+'.stderr.raw',stderr.toString());if(primary)throw primary;assert.equal(row.exit,0,label+' exit');return stdout;
    }finally{clearTimeout(timer);if(!row.closed)proc.kill('SIGKILL');}
  }
  async function reference(packet){const prefix=packet.graph+'-'+packet.id,input=await put(prefix+'.json',packet),output=resolve(out,prefix+'-reference.json');counts.referenceChildren++;const wire=JSON.parse((await child(prefix+'-reference',[freeze.tools.python,'-B',REFERENCE,'--input',input,'--output',output])).toString());assert.equal(wire.status,'PASS_G1D_INTEGRATION_AUDIT');const data=await bounded(output),report=JSON.parse(data);evidenceBytes+=data.length;assert(evidenceBytes+65536<=16*MIB);charge(packet,wire,data,report);assert.equal(report.status,'PASS_G1D_INTEGRATION_AUDIT');completed.push({graph:packet.graph,id:packet.id,audit:await pin(output)});}
  try{
    await authenticate();meta=JSON.parse(await bounded(META,MIB));await authenticate();assert.equal(JSON.parse(await bounded(resolve(OLD,'g1b-micro-02/summary.json'))).status,'PASS_STAGED_G1B_MICRO_ONLY');base=decode(JSON.parse(await bounded(BASE)));assert.equal(base.options.fixedStepSeconds,1/120);assert.equal(base.model.bodies.length,1);assert.equal(base.model.colliders.length,1);assert.equal(base.model.bodies[0].massKg,1);assert.deepEqual(base.model.colliders[0].geometry,{kind:'box',halfExtentsM:[.1,.2,.3]});assert.deepEqual(base.model.bodies[0].initial,{positionM:[0,0,0],orientationXYZW:[0,0,0,1],velocityMps:[0,0,0],angularVelocityRadps:[1,1,1]});assert.deepEqual(base.model.gravityMps2,[0,0,0]);assert.equal(base.options.profile,'rigid-discrete-v1');assert.equal(base.options.broadPhase,'direct');
    phase='build-source';const build=resolve(out,'build');await mkdir(build);const entry=resolve(build,'entry.ts'),bundle=resolve(build,'source.mjs'),metafile=resolve(build,'metafile.json');await writeFile(entry,ENTRY,{flag:'wx'});await auth(entry,freeze.sourceEntry);
    counts.buildChildren++;await child('source-build',[freeze.tools.esbuild,entry,'--target=es2022','--platform=node','--format=esm','--bundle','--metafile='+metafile,'--outfile='+bundle]);
    const mf=JSON.parse(await bounded(metafile,MIB));for(const path of Object.keys(mf.inputs)){const p=resolve(ROOT,path);assert(p===entry||inside(SRC,p),'source input closure '+p);}for(const path of Object.keys(mf.outputs))assert(inside(build,resolve(ROOT,path)));buildInfo=await tree(build);assert(buildInfo.bytes<=16*MIB);await put('source-build-pins.json',buildInfo,MIB);await authenticate();
    for(const graph of ['source','native']){
      phase=graph;await authenticate();time();const api=await import(pathToFileURL(graph==='source'?bundle:resolve(COPIED,'dist/index.js')).href);counts.entryEvaluations++;
      const replay=graph==='source'?api:await import(pathToFileURL(resolve(COPIED,'dist/replay.js')).href),control=graph==='source'?api:await import(pathToFileURL(resolve(COPIED,'dist/g1-test-control.js')).href);if(graph==='native')counts.entryEvaluations+=2;
      assert.equal(typeof replay.restorePhysicsRecording,'function');const c=control.g1Control,t=control.g1bControl;assert.deepEqual(t.take(),[]);c.assertReleased();
      const worlds=[],recorders=[],returned=[],protectedInputs=[],receipt=[],cacheImage=cacheSerializer();live.returned=returned;live.protectedInputs=protectedInputs;live.receipt=receipt;
      const protect=value=>{protectedInputs.push({value,words:snapshot(value)});return value;};
      const checkProtected=()=>{for(const item of protectedInputs)assert.equal(snapshot(item.value),item.words,'input/command/log mutation');for(const item of returned)assert.equal(snapshot(item.value),item.words,'previous output mutation');};
      const keep=value=>{detached(value,[...protectedInputs.map(x=>x.value),...returned.map(x=>x.value)]);returned.push({value,words:snapshot(value)});return value;};
      const read=(world,recorder)=>{if(recorder)counts.recorderReads++;else counts.worldReads++;return keep(recorder?recorder.getState():world.getState());};
      const save=recorder=>{counts.saveRecording++;const value=recorder.saveRecording();detached(value,[...protectedInputs.map(x=>x.value),...returned.map(x=>x.value)]);return protect(value);};
      const drain=(kind,label)=>{const observations=t.take();assert.equal(observations.length,kind==='general'?595:0,label);const kinds={};for(const item of observations)kinds[item.kind]=(kinds[item.kind]??0)+1;if(kind==='general')assert.deepEqual(kinds,{initialMomentum:1,newtonCondition:108,pivot:324,newtonUpdate:108,midpointResidual:27,stageComplete:27});const text=snapshot(observations);assert(Buffer.byteLength(text)<=MIB);charge(observations,text);receipt.push({label,count:observations.length,bytes:Buffer.byteLength(text),sha256:hash(text),kinds});};
      const step=(target,commands,recorder,kind,label)=>{time();if(recorder)counts.recorderStepAttempts++;else counts.worldStepAttempts++;const state=target.step(commands);drain(kind,label);counts.explicitAcceptedSteps++;checkProtected();return keep(state);};
      const cache=world=>{counts.privateCacheReads++;const text=cacheImage(c.cache(world));charge(text);return text;};
      const refusal=async(world,recorder,action,expected,marker=null)=>{
        const before=read(world,recorder),saved=save(recorder),image=cache(world);counts.refusals++;let thrown=null;try{action();}catch(error){thrown=error;}assert(thrown,'refusal expected');
        if(marker)assert.equal(thrown,marker);else{assert(thrown instanceof api.PhysicsError);assert.equal(thrown.code,expected);assert.equal(thrown.details.accepted.stepIndex,1);}
        drain(marker?'general':'none',expected);const afterImage=cache(world),after=read(world,recorder),afterLog=save(recorder);
        await put(graph+'-refusal-'+expected+'-cache.json',image,131072);
        await put(graph+'-refusal-'+expected+'.json',{expected,unknownErrorObjectPreserved:marker?thrown===marker:null,cacheBeforeSha256:hash(image),cacheAfterSha256:hash(afterImage),stateBeforeRaw:raw(before),stateAfterRaw:raw(after),logBeforeRaw:raw(saved),logAfterRaw:raw(afterLog)});
        assert.equal(afterImage,image,'accepted cache identity/content changed');assert.equal(snapshot(after),snapshot(before));assert.equal(snapshot(afterLog),snapshot(saved));checkProtected();
      };
      try{
        const kick=structuredClone(base);kick.model.bodies[0].initial.angularVelocityRadps=[0,0,0];protect(kick);
        const kc=protect([{kind:'angularImpulse',bodyId:'rotor',angularImpulseNms:[0,0,1/64]},{kind:'torque',bodyId:'rotor',torqueNm:[0,0,1/8]}]),empty=protect([]);
        counts.explicitConstructors++;const kw=api.createPhysicsWorld(kick.model,kick.options);worlds.push(kw);const ki=read(kw),k1=step(kw,kc,false,'principal','kick-1'),k2=step(kw,empty,false,'principal','kick-2');
        for(const[state,i]of[[ki,0],[k1,1],[k2,2]])stateGuard(state,i,kick,meta.expectedProviderDigests[graph]);assert.equal(snapshot(k1.bodies[0].angularVelocityRadps),snapshot(k2.bodies[0].angularVelocityRadps));
        const kp={graph,id:'kick',inputRaw:raw(kick),initialRaw:raw(ki),commandsRaw:raw([kc,empty]),statesRaw:raw([k1,k2])};live.packet=kp;await reference(kp);
        const model=protect(structuredClone(base));counts.explicitConstructors++;const rw=api.createPhysicsWorld(model.model,model.options);worlds.push(rw);const direct=rw.step;counts.explicitRecorderAttachments++;const rr=replay.createPhysicsRecorder(rw);recorders.push(rr);const ri=read(rw,rr),r1=step(rr,empty,true,'general','recording-1'),one=save(rr);
        const missing=protect([{kind:'angularImpulse',bodyId:'missing',angularImpulseNms:[0,0,0]}]);
        await refusal(rw,rr,()=>{counts.worldStepAttempts++;direct(empty);},'WORLD_OWNED');
        await refusal(rw,rr,()=>{counts.recorderStepAttempts++;rr.step(missing);},'INVALID_COMMAND');
        const marker=new Error('G1D_F03_PRECOMMIT');c.arm('F03',marker);await refusal(rw,rr,()=>{counts.recorderStepAttempts++;rr.step(empty);},'F03',marker);assert.equal(c.pending(),false);
        const r2=step(rr,empty,true,'general','recording-2'),two=save(rr);for(const[state,i]of[[ri,0],[r1,1],[r2,2]])stateGuard(state,i,model,meta.expectedProviderDigests[graph]);
        counts.restoreCalls++;const restored=replay.restorePhysicsRecording(one,{model:model.model,options:model.options,providerDigest:meta.expectedProviderDigests[graph]});worlds.push(restored.world);recorders.push(restored.recorder);drain('general','restore-internal-step-1');checkProtected();
        const restoredOne=read(restored.world,restored.recorder);assert.equal(snapshot(restoredOne),snapshot(r1));const restoredTwo=step(restored.recorder,empty,true,'general','restored-2'),restoredLog=save(restored.recorder);assert.equal(snapshot(restoredTwo),snapshot(r2));assert.equal(snapshot(restoredLog),snapshot(two));
        const rp={graph,id:'recording',inputRaw:raw(model),initialRaw:raw(ri),commandsRaw:raw([empty,empty]),statesRaw:raw([r1,r2])};live.packet=rp;await reference(rp);checkProtected();
        const result={kick:{initial:raw(ki),states:raw([k1,k2])},recording:{initial:raw(ri),states:raw([r1,r2]),one:raw(one),two:raw(two),restoredOne:raw(restoredOne),restoredTwo:raw(restoredTwo),restoredLog:raw(restoredLog)}};
        await put(graph+'-public-words.json',result);if(graph==='source')sourceResults.set('all',result);else parity(sourceResults.get('all'),result,meta.expectedProviderDigests);await put(graph+'-trace-receipts.json',receipt);graphs[graph]={physicalEndpointAudits:4,initialGeometryChecks:2,explicitWorlds:2,internalRestoreWorlds:1,internalRestoreWorldReads:1,internalRecorderAttachments:1,explicitAcceptedSteps:5,internalReplaySteps:1,refusals:3};
      }catch(error){firstFailure??={phase,name:error.name,message:error.message,stack:error.stack};throw error;}
      finally{
        for(const recorder of recorders.reverse())try{counts.recorderDisposals++;recorder.dispose();}catch(error){cleanupErrors.push('recorder dispose: '+error.message);}
        for(const world of worlds.reverse()){try{counts.worldDisposals++;world.dispose();}catch(error){cleanupErrors.push('world dispose: '+error.message);}try{c.cancel();}catch(error){cleanupErrors.push('cancel: '+error.message);}try{c.release(world);}catch(error){cleanupErrors.push('release: '+error.message);}}
        try{t.take();t.assertEmpty();c.assertReleased();}catch(error){cleanupErrors.push('controls: '+error.message);}for(const key of Object.keys(live))delete live[key];
      }
      assert.equal(cleanupErrors.length,0);const gs=c.stats(),ts=t.stats();assert.equal(gs.attachments,3);assert.equal(gs.releases,3);assert.equal(gs.dispatch,7);assert.equal(gs.faultThrows,1);assert.equal(gs.F03Site,7);
      assert.deepEqual(ts,{coefficientPow:3,prepare:7,triaxial:7,zero:0,principal:2,general:5,initialMomentum:5,midpoint:135,newtonCondition:540,linearSolve:540,pivot:1620,newtonUpdate:540,midpointResidual:135,stageComplete:135,generalReturn:5,linearResidualFailure:0});graphs[graph].commonStats=gs;graphs[graph].triaxialStats=ts;await put(graph+'-helper-stats.json',{gs,ts});
    }
    assert.deepEqual(counts,{buildChildren:1,referenceChildren:4,entryEvaluations:4,explicitConstructors:4,restoreCalls:2,explicitRecorderAttachments:2,worldReads:2,recorderReads:16,saveRecording:18,worldStepAttempts:6,recorderStepAttempts:10,explicitAcceptedSteps:10,refusals:6,worldDisposals:6,recorderDisposals:4,privateCacheReads:12});assert.equal(completed.length,4);assert.equal(cleanupErrors.length,0);
  }catch(error){firstFailure??={phase,name:error.name,message:error.message,stack:error.stack};}
  finally{
    try{await authenticate();}catch(error){if(firstFailure)cleanupErrors.push('post-auth: '+error.message);else firstFailure={phase:'post-auth',name:error.name,message:error.message,stack:error.stack};}
    const summary={status:firstFailure||cleanupErrors.length?'FAIL':'PASS_STAGED_G1D_COMMAND_RECORDING_ONLY',runId:id,phase,counts,graphs,completed,commands,firstFailure,cleanupErrors,evidenceBytes,buildBytes:buildInfo?.bytes??0,peakLogicalBytes,innerMs:performance.now()-started,productionAdoption:'NOT_RUN',queries:0,serialize:0,deserialize:0};await put('summary.json',summary);process.stdout.write(json({status:summary.status,summary:resolve(out,'summary.json')}));if(firstFailure||cleanupErrors.length)process.exitCode=1;
  }
}
main().catch(error=>{process.stderr.write(String(error.stack??error)+'\n');process.exitCode=1;});
