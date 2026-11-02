/** Canonical bounded-rotor checks. No runtime imports before the parent freeze is authenticated. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF=fileURLToPath(import.meta.url), HERE=dirname(SELF), ROOT=resolve(HERE,'../..'), MIB=1048576;
const OLD=resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/evidence');
const MICRO=resolve(OLD,'g1b-micro-02'), PACKAGE=resolve(MICRO,'build/package');
const META=resolve(MICRO,'staged-providers.json'), BASE=resolve(OLD,'g1b-native-completion-02/input-1.json');
const REFERENCE=resolve(HERE,'reference-force.py');
const FRAME_REFERENCE=resolve(ROOT,'examples/physics-rigid-rotation-g1c-2276/reference-frame.py');
const SOURCE_MANIFEST=resolve(ROOT,'packages/barocss-physics/src/provider-manifest.generated.ts');
const GOLD_ROOT=resolve(OLD,'g1b-trajectory-02');
const REQUIRED=[SELF,REFERENCE,FRAME_REFERENCE,SOURCE_MANIFEST,resolve(HERE,'PUBLIC-SUPPORT-CONTRACT.md'),
  resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/reference-micro.py'),
  resolve(ROOT,'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'),
  resolve(GOLD_ROOT,'summary.json'),resolve(GOLD_ROOT,'input-5.json'),
  ...[80,120].map(p=>resolve(OLD,`g1b-trajectory-01-reference-rows/bank-${p}-02.json`)),
  ...['world.ts','rotation-support.ts','rigid-free-rotation.ts','rigid-forced-rotation.ts'].map(n=>resolve(ROOT,'packages/barocss-physics/src',n))];
const J=[1/1024,-1/2048,1/4096], TAU=[1/128,-1/256,1/512];
const hash=x=>createHash('sha256').update(x).digest('hex'), json=x=>JSON.stringify(x)+'\n';
const inside=(base,path)=>path===base||path.startsWith(base+'/');
async function bounded(path,limit=65536){const s=await stat(path);assert(s.isFile()&&s.size<=limit,'file bound '+path);return readFile(path);}
async function pin(path){const s=await stat(path);assert(s.isFile());const h=createHash('sha256');for await(const b of createReadStream(path,{highWaterMark:65536}))h.update(b);return{bytes:s.size,sha256:h.digest('hex')};}
async function auth(path,wanted){assert(wanted&&Number.isSafeInteger(wanted.bytes)&&wanted.bytes>=0&&/^[a-f0-9]{64}$/.test(wanted.sha256));assert.equal(await realpath(path),path);assert.deepEqual(await pin(path),{bytes:wanted.bytes,sha256:wanted.sha256},path);}
function raw(v,ctx={nodes:0},depth=0){
  assert(++ctx.nodes<=16384&&depth<=32,'raw object bound');
  if(typeof v==='number'){assert(Number.isFinite(v));const b=Buffer.alloc(8);b.writeDoubleLE(v);return{$f64le:b.toString('hex')};}
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  assert(v&&typeof v==='object');const array=Array.isArray(v);assert.equal(Object.getPrototypeOf(v),array?Array.prototype:Object.prototype);
  const keys=Reflect.ownKeys(v);if(array){assert.equal(keys.length,v.length+1);for(let i=0;i<v.length;i++)assert(Object.hasOwn(v,i));}
  const entries=keys.filter(k=>!array||k!=='length').map(k=>{assert(typeof k==='string');const d=Object.getOwnPropertyDescriptor(v,k);assert(d&&'value'in d&&d.enumerable);return[k,raw(d.value,ctx,depth+1)];});
  return array?entries.map(([,x])=>x):Object.fromEntries(entries);
}
function decode(v){if(v&&typeof v==='object'&&Object.hasOwn(v,'$f64le')){assert.deepEqual(Object.keys(v),['$f64le']);assert(/^[a-f0-9]{16}$/.test(v.$f64le));return Buffer.from(v.$f64le,'hex').readDoubleLE();}return Array.isArray(v)?v.map(decode):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)])):v;}
const words=v=>JSON.stringify(raw(v));
function containers(v,set=new Set()){if(v&&typeof v==='object'){assert(!set.has(v),'public shared container/cycle');set.add(v);for(const x of Object.values(v))containers(x,set);}return set;}
function detached(v,others){const set=containers(v);for(const other of others)for(const x of containers(other))assert(!set.has(x),'public alias');}
function parity(a,b,providers,path=''){
  if(path.endsWith('/providerDigest')){assert.equal(a,providers.source);assert.equal(b,providers.native);return;}
  if(a&&typeof a==='object'){assert(b&&typeof b==='object');assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))parity(a[k],b[k],providers,path+'/'+k);}else assert.equal(a,b,'raw parity '+path);
}

function generatedManifest(text,emitted){const prefix='export const providerManifest = ';assert.equal(text.split(prefix).length,2);const tail=text.split(prefix)[1].trim();return JSON.parse(tail.slice(0,-(emitted?1:' as const;'.length)));}

async function main(){
  const args=process.argv.slice(2);assert.equal(args.length,6);assert.deepEqual([args[0],args[2],args[4]],['--run-id','--freeze','--token']);const id=args[1],freezePath=resolve(args[3]),token=args[5];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(/^[a-f0-9]{64}$/.test(token));
  const started=performance.now(),freezeBytes=await bounded(freezePath,2*MIB);assert.equal(hash(freezeBytes),token);const freeze=JSON.parse(freezeBytes),out=resolve(HERE,'evidence',id);await mkdir(out,{recursive:false});
  const graphs={},commands=[],completed=[],sourceRecords={},providerDigests={};let phase='authenticate',firstFailure=null,evidenceBytes=0,peakLogicalBytes=0,base=null,gold=null;
  const time=()=>assert(performance.now()-started<170000,'170s inner deadline');
  const charge=(...extra)=>{let bytes=4*MIB,nodes=0;const seen=new Set();const walk=v=>{assert(++nodes<=180000);if(v===null||v===undefined||typeof v==='number'||typeof v==='boolean'){bytes+=16;return;}if(typeof v==='string'){bytes+=48+4*v.length;return;}assert(typeof v==='object');if(seen.has(v))return;seen.add(v);bytes+=128;if(Buffer.isBuffer(v)){bytes+=2*v.length;return;}for(const[k,x]of Object.entries(v)){bytes+=64+4*k.length;walk(x);}};walk({freeze,freezeBytes,graphs,commands,completed,sourceRecords,providerDigests,base,gold,firstFailure,extra});peakLogicalBytes=Math.max(peakLogicalBytes,bytes);assert(bytes<=16*MIB,'16MiB harness charge');};
  async function put(name,value,limit=65536){time();const text=typeof value==='string'?value:json(value),data=Buffer.from(text);assert(data.length<=limit,'packet bound '+name);charge(value,text,data);assert(evidenceBytes+data.length+MIB<=16*MIB,'16MiB evidence reserve');await writeFile(resolve(out,name),data,{flag:'wx'});evidenceBytes+=data.length;return resolve(out,name);}
  function pathOf(name){assert(typeof name==='string'&&!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));assert(Object.hasOwn(freeze.files,name),'unfrozen runtime/input '+name);return path;}
  async function authenticate(){
    time();assert(freeze.files&&Object.keys(freeze.files).length<=1024);for(const[name,p]of Object.entries(freeze.files)){assert(!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));await auth(path,p);}for(const p of REQUIRED)assert(Object.hasOwn(freeze.files,relative(ROOT,p)),'missing mandatory pin '+p);
    for(const n of ['node','python']){const p=freeze.tools[n];assert(isAbsolute(p));await auth(p,freeze.tools[n+'Pin']);}assert.equal(freeze.tools.node,process.execPath);assert(process.versions.node.startsWith('22.'));
    for(const n of ['sourceEntry','nativeEntry','nativeReplay','nativeIdentity','nativeManifest'])pathOf(freeze.runtime[n]);for(const n of ['base','forceBank','sourceGoldFrames'])pathOf(freeze.inputs[n]);
    for(const[n,file]of Object.entries({nativeEntry:'index.js',nativeReplay:'replay.js',nativeIdentity:'identity.js',nativeManifest:'provider-manifest.generated.js'}))assert.equal(pathOf(freeze.runtime[n]),resolve(ROOT,'packages/barocss-physics/dist',file));
    assert.equal(pathOf(freeze.inputs.base),BASE);assert.equal(pathOf(freeze.inputs.sourceGoldFrames),resolve(GOLD_ROOT,'source-states.jsonl'));
  }
  async function closure(path,dataOnly=false,seen=new Set()){
    if(seen.has(path))return;seen.add(path);assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'unfrozen imported module '+path);if(dataOnly)assert(['identity.js','types.js','provider-manifest.generated.js'].includes(path.slice(path.lastIndexOf('/')+1)),'non-DATA module in identity closure');
    const text=(await bounded(path,2*MIB)).toString();for(const m of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){assert(m[1].startsWith('.'),'foreign runtime import '+m[1]);await closure(resolve(dirname(path),m[1]),dataOnly,seen);}
  }
  async function child(label,argv){
    time();const remaining=170000-(performance.now()-started);assert(remaining>1000);const row={label,argv,pid:null,exit:null,signal:null,closed:false,deadlineMs:Math.min(20000,remaining-500)};commands.push(row);const proc=spawn(argv[0],argv.slice(1),{cwd:ROOT,stdio:['ignore','pipe','pipe']});row.pid=proc.pid??null;let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),primary=null;
    const fail=e=>{primary??=e;proc.kill('SIGKILL');},timer=setTimeout(()=>fail(new Error(label+' child deadline')),row.deadlineMs);
    try{await new Promise(done=>{proc.once('error',e=>{primary??=e;});for(const[stream,isOut]of[[proc.stdout,true],[proc.stderr,false]]){stream.on('error',fail);stream.on('data',b=>{if(stdout.length+stderr.length+b.length>65536){fail(new Error(label+' output cap'));return;}if(isOut)stdout=Buffer.concat([stdout,b]);else stderr=Buffer.concat([stderr,b]);});}proc.once('close',(exit,signal)=>{Object.assign(row,{exit,signal,closed:true});done();});});await put(label+'.stdout.raw',stdout.toString());await put(label+'.stderr.raw',stderr.toString());if(primary)throw primary;assert.equal(row.exit,0,label+' failed');}finally{clearTimeout(timer);if(!row.closed)proc.kill('SIGKILL');}
  }
  async function reference(graph,caseId,pair,before,after,loads){
    const prefix=graph+'-'+caseId,output=resolve(out,prefix+'-audit.json');let packet,script,argv;
    if(caseId==='free'){
      packet={graph,id:'canonical-free',case:raw({bodyPermutation:[0,1,2],worldSigns:[1,1,1],worldHalfTurnAxis:null,quatSign:1,omegaWorldRadps:[1,1,1]}),inputRaw:raw(pair),beforeRaw:raw(before),afterRaw:raw(after)};script=FRAME_REFERENCE;
    }else{packet={graph,id:caseId,pairRaw:raw(pair),commandsRaw:raw(loads),beforeRaw:raw(before),afterRaw:raw(after)};script=REFERENCE;}
    const input=await put(prefix+'-reference-input.json',packet);argv=[freeze.tools.python,'-B',script,...(caseId==='free'?[]:['--audit']),'--input',input,...(caseId==='free'?[]:['--bank',pathOf(freeze.inputs.forceBank)]),'--output',output];graphs[graph].counts.referenceChildren++;await child(prefix+'-reference',argv);
    const bytes=await bounded(output),report=JSON.parse(bytes);charge(bytes,report);evidenceBytes+=bytes.length;assert(evidenceBytes+MIB<=16*MIB);assert.equal(report.status,caseId==='free'?'PASS_G1C_FRAME_AUDIT':'PASS_REFERENCE_AUDIT');if(caseId!=='free')assert.equal(report.physicalStatus,'PASS');graphs[graph].counts.independentEndpointAudits++;completed.push({graph,id:caseId,path:output,...await pin(output)});
  }
  async function goldState(){
    const summary=JSON.parse(await bounded(resolve(GOLD_ROOT,'summary.json'),MIB));assert.equal(summary.graphs.source.status,'PASS_TRAJECTORY_GRAPH');assert.equal(summary.graphs.source.cases[5].caseId,'P03-principal-z');assert.equal(summary.graphs.source.cases[5].status,'PASS_CASE');
    const input=decode(JSON.parse(await bounded(resolve(GOLD_ROOT,'input-5.json'))));assert.equal(input.options.fixedStepSeconds,1/120);assert.deepEqual(input.model.bodies[0].initial.angularVelocityRadps,[0,0,1]);
    const path=pathOf(freeze.inputs.sourceGoldFrames);assert((await stat(path)).size<=2*MIB);let pending='',found=null,seen=0;
    for await(const chunk of createReadStream(path,{encoding:'utf8',highWaterMark:16384})){pending+=chunk;let edge;while((edge=pending.indexOf('\n'))>=0){const line=pending.slice(0,edge);pending=pending.slice(edge+1);assert(Buffer.byteLength(line)<=65536);if(!line)continue;const row=JSON.parse(line);if(row.c===5&&row.n===1){assert(!found);found=row.stateRaw.bodies[0];seen++;}}assert(Buffer.byteLength(pending)<=65536);}
    assert.equal(pending,'');assert.equal(seen,1);assert(found);return{orientationXYZW:found.orientationXYZW,angularVelocityRadps:found.angularVelocityRadps,provenance:{sourceCase:'P03-principal-z',sourceCaseStatus:'PASS_CASE',sourceGraphStatus:summary.graphs.source.status,wholeCampaignStatus:summary.status}};
  }
  try{
    await authenticate();base=decode(JSON.parse(await bounded(pathOf(freeze.inputs.base))));gold=await goldState();{const bank=JSON.parse(await bounded(pathOf(freeze.inputs.forceBank),MIB));assert.equal(bank.status,'PASS_REFERENCE_BANK');}
    assert.equal(base.model.bodies[0].id,'rotor');assert.equal(base.options.fixedStepSeconds,1/120);assert.deepEqual(base.model.colliders[0].geometry,{kind:'box',halfExtentsM:[.1,.2,.3]});
    for(const graph of ['source','native']){
      if(graph==='native')assert.equal(graphs.source?.status,'PASS_CANONICAL_GRAPH','Source checks and cleanup must pass before Native imports');phase='load-'+graph;await authenticate();
      let api,replay,digest,ownManifest;
      if(graph==='source'){
        await closure(pathOf(freeze.runtime.sourceEntry));api=await import(pathToFileURL(pathOf(freeze.runtime.sourceEntry)).href);replay=api;digest=api.digest;ownManifest=generatedManifest((await bounded(SOURCE_MANIFEST,MIB)).toString(),false);assert.deepEqual(api.providerManifest,ownManifest);
      }else{
        await closure(pathOf(freeze.runtime.nativeIdentity),true);await closure(pathOf(freeze.runtime.nativeManifest),true);await closure(pathOf(freeze.runtime.nativeEntry));await closure(pathOf(freeze.runtime.nativeReplay));
        const identity=await import(pathToFileURL(pathOf(freeze.runtime.nativeIdentity)).href),manifestModule=await import(pathToFileURL(pathOf(freeze.runtime.nativeManifest)).href);digest=identity.digest;ownManifest=generatedManifest((await bounded(pathOf(freeze.runtime.nativeManifest),MIB)).toString(),true);assert.deepEqual(manifestModule.providerManifest,ownManifest);api=await import(pathToFileURL(pathOf(freeze.runtime.nativeEntry)).href);replay=await import(pathToFileURL(pathOf(freeze.runtime.nativeReplay)).href);
      }
      assert.equal(typeof digest,'function');assert.equal(typeof replay.createPhysicsRecorder,'function');assert.equal(typeof replay.restorePhysicsRecording,'function');providerDigests[graph]=digest(ownManifest);if(graph==='native')assert.notEqual(providerDigests.native,providerDigests.source);
      const counts={constructorAttempts:0,explicitWorlds:0,restoredWorlds:0,worlds:0,explicitAcceptedSteps:0,replayedAcceptedSteps:0,acceptedSteps:0,stepAttempts:0,refusedSteps:0,configurationRefusals:0,unknownRefusals:0,numericFaultRefusals:0,worldReads:0,recorderReads:0,saveRecording:0,restoreCalls:0,explicitRecorderAttachments:0,recorderDisposals:0,worldDisposals:0,referenceChildren:0,independentEndpointAudits:0};
      graphs[graph]={status:'IN_PROGRESS',counts,cleanupErrors:[],providerDigest:providerDigests[graph],hiddenCacheIdentity:'NOT_DIRECTLY_OBSERVED'};
      const worlds=[],recorders=[],disposedWorlds=new Set(),protectedInputs=[],outputs=[],results={};
      const protect=v=>{protectedInputs.push({value:v,words:words(v)});return v;};
      const intact=()=>{for(const x of protectedInputs)assert.equal(words(x.value),x.words,'caller input mutated');for(const x of outputs)assert.equal(words(x.value),x.words,'prior public output mutated');};
      const keep=v=>{detached(v,[...protectedInputs.map(x=>x.value),...outputs.map(x=>x.value)]);outputs.push({value:v,words:words(v)});charge(protectedInputs,outputs);return v;};
      const expectedIdentity=pair=>({modelRevision:pair.model.revision,modelDigest:digest(pair.model),configurationDigest:digest(pair.options),providerDigest:providerDigests[graph],profile:pair.options.profile,frameId:pair.model.frame.id,fixedStepSeconds:pair.options.fixedStepSeconds});
      const guard=(s,index,pair)=>{raw(s);assert.deepEqual(s.identity,expectedIdentity(pair));assert(Object.is(s.stepIndex,index));assert(Object.is(s.timeSeconds,index===0?0:pair.options.fixedStepSeconds));assert.equal(s.bodies.length,1);assert.equal(s.bodies[0].id,pair.model.bodies[0].id);assert.equal(s.bodies[0].kind,'dynamic');assert.equal(s.bodies[0].sleeping,false);for(const k of ['positionM','velocityMps'])assert.equal(words(s.bodies[0][k]),words(pair.model.bodies[0].initial[k]));for(const k of ['joints','contacts','events','ccdHits','cloths','fluids'])assert.deepEqual(s[k],[]);assert.deepEqual(s.pairStats,{eligiblePairs:0,candidatePairs:0,aabbTests:0});};
      const read=(world,recorder)=>{if(recorder)counts.recorderReads++;else counts.worldReads++;const result=keep(recorder?recorder.getState():world.getState());intact();return result;};
      const save=recorder=>{counts.saveRecording++;const result=keep(recorder.saveRecording());intact();return result;};
      const opened=pair=>{counts.constructorAttempts++;const world=api.createPhysicsWorld(pair.model,pair.options);assert(!worlds.includes(world));worlds.push(world);counts.explicitWorlds++;counts.worlds++;return world;};
      const close=world=>{if(!disposedWorlds.has(world)){counts.worldDisposals++;world.dispose();disposedWorlds.add(world);intact();}};
      const accepted=(target,loads)=>{time();counts.stepAttempts++;const state=keep(target.step(loads));counts.explicitAcceptedSteps++;counts.acceptedSteps++;intact();return state;};
      const refuse=async(label,world,recorder,operation,expected,marker=null)=>{
        const before=read(world,recorder),priorLog=recorder?save(recorder):null;let caught=null;counts.stepAttempts++;try{operation();}catch(e){caught=e;}assert(caught,label+' must refuse');if(marker){assert.equal(caught,marker);counts.unknownRefusals++;}else{assert(caught instanceof api.PhysicsError);assert.equal(caught.code,expected);assert.equal(caught.details.accepted.stepIndex,before.stepIndex);assert(Object.is(caught.details.accepted.timeSeconds,before.timeSeconds));}counts.refusedSteps++;
        const after=read(world,recorder),nextLog=recorder?save(recorder):null;assert.equal(words(after),words(before),label+' accepted state changed');if(recorder)assert.equal(words(nextLog),words(priorLog),label+' log changed');intact();await put(graph+'-'+label+'-refusal.json',{expected:marker?'SAME_UNKNOWN_ERROR':expected,unknownIdentity:marker?caught===marker:null,error:{name:caught.name,message:caught.message,stack:caught.stack,code:caught.code??null},beforeRaw:raw(before),afterRaw:raw(after),beforeLogRaw:priorLog?raw(priorLog):null,afterLogRaw:nextLog?raw(nextLog):null,hiddenCacheIdentity:'NOT_DIRECTLY_OBSERVED'});
      };
      try{
        for(const caseId of ['free','J','JT']){
          phase=graph+'-'+caseId;const pair=protect(structuredClone(base)),loads=protect(caseId==='free'?[]:[{kind:'angularImpulse',bodyId:'rotor',angularImpulseNms:[...J]},...(caseId==='JT'?[{kind:'torque',bodyId:'rotor',torqueNm:[...TAU]}]:[])]);let world=null;
          try{world=opened(pair);const before=read(world),after=accepted(world,loads);guard(before,0,pair);guard(after,1,pair);results[caseId]={pairRaw:raw(pair),commandsRaw:raw(loads),beforeRaw:raw(before),afterRaw:raw(after)};await put(graph+'-'+caseId+'-public.json',results[caseId]);await refuse(caseId+'-horizon',world,null,()=>world.step([]),'NUMERIC_LIMIT');await reference(graph,caseId,pair,before,after,loads);}finally{if(world)close(world);}
        }
        phase=graph+'-rename';{
          const pair=structuredClone(base);pair.model.bodies[0].id='spinB';pair.model.colliders[0].id='surfaceB';pair.model.colliders[0].bodyId='spinB';protect(pair);const loads=protect([{kind:'angularImpulse',bodyId:'spinB',angularImpulseNms:[...J]},{kind:'torque',bodyId:'spinB',torqueNm:[...TAU]}]);let world=null;
          try{world=opened(pair);const before=read(world),after=accepted(world,loads);guard(before,0,pair);guard(after,1,pair);const original=decode(results.JT.afterRaw).bodies[0],renamed=after.bodies[0];assert.equal(renamed.id,'spinB');for(const key of Object.keys(original).filter(k=>k!=='id'))assert.equal(words(renamed[key]),words(original[key]),'renamed physical body '+key);results.rename={pairRaw:raw(pair),commandsRaw:raw(loads),beforeRaw:raw(before),afterRaw:raw(after)};await put(graph+'-rename-public.json',results.rename);}finally{if(world)close(world);}
        }
        for(const shape of ['sphere','cube']){
          phase=graph+'-compat-'+shape;const pair=structuredClone(base);pair.model.bodies[0].initial.angularVelocityRadps=[0,0,1];pair.model.colliders[0].geometry=shape==='sphere'?{kind:'sphere',radiusM:.1}:{kind:'box',halfExtentsM:[.1,.1,.1]};protect(pair);let world=null;
          try{world=opened(pair);const before=read(world),after=accepted(world,protect([]));guard(before,0,pair);guard(after,1,pair);for(const key of ['orientationXYZW','angularVelocityRadps'])assert.deepEqual(raw(after.bodies[0][key]),gold[key],'saved validated principal-z compatibility '+key);results[shape]={pairRaw:raw(pair),beforeRaw:raw(before),afterRaw:raw(after),goldProvenance:gold.provenance};await put(graph+'-'+shape+'-compat.json',results[shape]);}finally{if(world)close(world);}
        }
        phase=graph+'-configuration-refusals';
        const bad=[['mass2',p=>p.model.bodies[0].massKg=2],['permuted-h',p=>p.model.colliders[0].geometry.halfExtentsM=[.2,.1,.3]],['axisymmetric',p=>p.model.colliders[0].geometry.halfExtentsM=[.1,.1,.2]],['unequal-near-cube',p=>p.model.colliders[0].geometry.halfExtentsM=[.1,.1,.10000000000000002]],['halfturn-q',p=>p.model.bodies[0].initial.orientationXYZW=[0,0,1,0]],['zero-spin',p=>p.model.bodies[0].initial.angularVelocityRadps=[0,0,0]],['dt60',p=>p.options.fixedStepSeconds=1/60],['dt240',p=>p.options.fixedStepSeconds=1/240],['aabb',p=>p.options.broadPhase='aabb'],['persistent',p=>p.options.profile='rigid-persistent-box-v1'],['static-floor',p=>{p.model.bodies.push({id:'floorBody',kind:'static',initial:{positionM:[0,-1,0],orientationXYZW:[0,0,0,1]}});p.model.colliders.push({...structuredClone(p.model.colliders[0]),id:'floorCollider',bodyId:'floorBody',geometry:{kind:'box',halfExtentsM:[1,.1,1]}});}],['ccd',p=>p.model.colliders[0].ccd=true]];
        for(const[label,mutate]of bad){const pair=structuredClone(base);mutate(pair);protect(pair);let caught=null;counts.constructorAttempts++;try{const unexpected=api.createPhysicsWorld(pair.model,pair.options);worlds.push(unexpected);counts.worlds++;counts.explicitWorlds++;}catch(e){caught=e;}assert(caught instanceof api.PhysicsError,'configuration unexpectedly admitted '+label);assert.equal(caught.code,'INVALID_CONFIG');counts.configurationRefusals++;intact();await put(graph+'-config-'+label+'.json',{status:'EXPECTED_BREAKING_REFUSAL',pairRaw:raw(pair),error:{code:caught.code,message:caught.message,details:caught.details}});}
        phase=graph+'-recording';{
          const pair=protect(structuredClone(base)),loads=protect([{kind:'angularImpulse',bodyId:'rotor',angularImpulseNms:[...J]},{kind:'torque',bodyId:'rotor',torqueNm:[...TAU]}]);const world=opened(pair),directStep=world.step;const before=read(world);guard(before,0,pair);counts.explicitRecorderAttachments++;const recorder=replay.createPhysicsRecorder(world);recorders.push(recorder);
          await refuse('owned-direct',world,recorder,()=>directStep([]),'WORLD_OWNED');const badLoads=protect([{kind:'torque',bodyId:'rotor',torqueNm:[...TAU]}]);await refuse('torque-only',world,recorder,()=>recorder.step(badLoads),'INVALID_COMMAND');
          for(const mode of ['unknown','nan']){
            const originalHypot=Math.hypot,marker=new Error('CANONICAL_FORCED_UNKNOWN'),fault={mode,hits:0,throwSite:null};
            const action=()=>{Math.hypot=function(...xs){if(xs.length===4){fault.hits++;fault.throwSite=new Error('ACTUAL_FORCED_THROW_SITE').stack;if(mode==='unknown')throw marker;return NaN;}return originalHypot.apply(Math,xs);};try{return recorder.step(loads);}finally{Math.hypot=originalHypot;}};
            await refuse(mode+'-forced',world,recorder,action,'NUMERIC_LIMIT',mode==='unknown'?marker:null);assert.equal(Math.hypot,originalHypot);assert.equal(fault.hits,1);assert(fault.throwSite.includes('prepareForcedBoxRotation'),'fault must originate inside actual forced helper');if(mode==='nan')counts.numericFaultRefusals++;await put(graph+'-'+mode+'-forced-site.json',fault);
          }
          const after=accepted(recorder,loads);guard(after,1,pair);assert.equal(words(after),JSON.stringify(results.JT.afterRaw));const one=save(recorder);assert.equal(one.frames.length,1);counts.restoreCalls++;const restored=replay.restorePhysicsRecording(one,{model:pair.model,options:pair.options,providerDigest:providerDigests[graph]});assert(!worlds.includes(restored.world));worlds.push(restored.world);recorders.push(restored.recorder);counts.restoredWorlds++;counts.worlds++;counts.replayedAcceptedSteps++;counts.acceptedSteps++;
          const restoredState=read(restored.world,restored.recorder),restoredLog=save(restored.recorder);guard(restoredState,1,pair);assert.equal(words(restoredState),words(after));assert.equal(words(restoredLog),words(one));await refuse('recording-horizon',world,recorder,()=>recorder.step([]),'NUMERIC_LIMIT');await refuse('restored-horizon',restored.world,restored.recorder,()=>restored.recorder.step([]),'NUMERIC_LIMIT');results.recording={beforeRaw:raw(before),afterRaw:raw(after),recordingRaw:raw(one),restoredStateRaw:raw(restoredState),restoredLogRaw:raw(restoredLog)};await put(graph+'-recording.json',results.recording);intact();
        }
        for(const key of Object.keys(results)){if(graph==='source')sourceRecords[key]=results[key];else parity(sourceRecords[key],results[key],providerDigests);}
        assert.equal(counts.constructorAttempts,19);assert.equal(counts.explicitWorlds,7);assert.equal(counts.restoredWorlds,1);assert.equal(counts.worlds,8);assert.equal(counts.explicitAcceptedSteps,7);assert.equal(counts.replayedAcceptedSteps,1);assert.equal(counts.acceptedSteps,8);assert.equal(counts.stepAttempts,16);assert.equal(counts.refusedSteps,9);assert.equal(counts.configurationRefusals,12);assert.equal(counts.unknownRefusals,1);assert.equal(counts.numericFaultRefusals,1);assert.equal(counts.referenceChildren,3);assert.equal(counts.independentEndpointAudits,3);assert.equal(counts.restoreCalls,1);
      }finally{
        for(const recorder of recorders.reverse())try{counts.recorderDisposals++;recorder.dispose();}catch(e){graphs[graph].cleanupErrors.push({action:'recorder-dispose',message:e.message});}for(const world of worlds.reverse())try{close(world);}catch(e){graphs[graph].cleanupErrors.push({action:'world-dispose',message:e.message});}try{intact();}catch(e){graphs[graph].cleanupErrors.push({action:'retained-input-output',message:e.message});}
      }
      assert.deepEqual(graphs[graph].cleanupErrors,[]);assert.equal(counts.worldDisposals,8);assert.equal(counts.recorderDisposals,2);graphs[graph].status='PASS_CANONICAL_GRAPH';await put(graph+'-counts.json',graphs[graph]);
    }
  }catch(e){firstFailure={phase,name:e.name,message:e.message,stack:e.stack};}
  finally{
    try{await authenticate();}catch(e){if(firstFailure)firstFailure.postAuthenticationFailure=e.message;else firstFailure={phase:'post-auth',name:e.name,message:e.message,stack:e.stack};}
    const status=firstFailure?'FAIL_CANONICAL_BOUNDED_ROTATION':'ADOPTED_BOUNDED';const summary={status,runId:id,phase,graphs,commands,completed,providerDigests,firstFailure,buildChildren:0,newODEWindows:0,queryCalls:0,serializeCalls:0,deserializeCalls:0,hiddenCacheIdentity:'NOT_DIRECTLY_OBSERVED',resources:{evidenceBytes,peakLogicalBytes,harnessLimit:16*MIB,evidenceLimit:16*MIB,wholeLogicalBytes:64*MIB,rssClaim:false},innerMs:performance.now()-started,scope:'EXACT_ONE_STEP_ISOLATED_ROTOR_AND_EXPLICIT_REFUSALS',browser:'NOT_RUN',remote:'NOT_RUN',deployment:'NOT_RUN'};const text=json(summary);assert(Buffer.byteLength(text)<=65536);assert(evidenceBytes+Buffer.byteLength(text)<=16*MIB);await writeFile(resolve(out,'summary.json'),text,{flag:'wx'});process.stdout.write(json({status,summary:resolve(out,'summary.json')}));if(firstFailure)process.exitCode=1;
  }
}
main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
