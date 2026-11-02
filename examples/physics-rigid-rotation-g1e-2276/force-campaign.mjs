/** G1e baseline capture only. No Physics import or candidate evaluation before parent authentication. */
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
const REQUIRED=[SELF,REFERENCE,resolve(HERE,'CONTRACT.md'),resolve(HERE,'FORCE-DESIGN.md'),META,BASE,
  resolve(MICRO,'summary.json'),resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/reference-micro.py'),
  resolve(ROOT,'examples/physics-rigid-rotation-g1c-2276/reference-frame.py'),
  resolve(ROOT,'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'),
  ...['CONTRACT.md','CASES.json','REFERENCES-CLARIFICATION-01.md'].map(n=>resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276',n))];
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
function stateGuard(s,index,pair,provider){
  raw(s);assert(Object.is(s.stepIndex,index));assert(Object.is(s.timeSeconds,index===0?0:pair.options.fixedStepSeconds));
  assert.equal(s.identity.providerDigest,provider);assert.equal(s.identity.modelRevision,pair.model.revision);assert.equal(s.identity.profile,pair.options.profile);assert.equal(s.identity.frameId,pair.model.frame.id);assert(Object.is(s.identity.fixedStepSeconds,pair.options.fixedStepSeconds));
  for(const k of ['modelDigest','configurationDigest','providerDigest'])assert(/^sha256:[a-f0-9]{64}$/.test(s.identity[k]));
  assert.equal(s.bodies.length,1);const b=s.bodies[0];assert.equal(b.id,'rotor');assert.equal(b.kind,'dynamic');assert.equal(b.sleeping,false);
  for(const k of ['positionM','velocityMps'])assert.equal(words(b[k]),words(pair.model.bodies[0].initial[k]));
  for(const k of ['contacts','events','joints','ccdHits','cloths','fluids'])assert.deepEqual(s[k],[]);
  assert.deepEqual(s.pairStats,{eligiblePairs:0,candidatePairs:0,aabbTests:0});
}

async function main(){
  const argv=process.argv.slice(2);assert.equal(argv.length,8);assert.deepEqual([argv[0],argv[2],argv[4],argv[6]],['--mode','--run-id','--freeze','--token']);
  const mode=argv[1],id=argv[3],freezePath=resolve(argv[5]),token=argv[7];assert.equal(mode,'baseline','repair requires a separate implementation and parent freeze');assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(/^[a-f0-9]{64}$/.test(token));
  const started=performance.now(),freezeBytes=await bounded(freezePath,2*MIB);assert.equal(hash(freezeBytes),token);
  const freeze=JSON.parse(freezeBytes),out=resolve(HERE,'evidence',id);await mkdir(out,{recursive:false});
  const counts={buildChildren:0,referenceChildren:0,entryEvaluations:0,worlds:0,reads:0,steps:0,acceptedSteps:0,stateAudits:0,disposals:0,releases:0,privateInertiaReads:0};
  const commands=[],records=[],graphs={},cleanupErrors=[],audits=[],firstPhysicalFailure={},sourcePrivate={},sourceTrace={};
  let phase='authenticate',meta=null,base=null,firstFailure=null,evidenceBytes=0,peakLogicalBytes=0;
  const time=()=>assert(performance.now()-started<170000,'170s inner deadline');
  const charge=(...extra)=>{let bytes=4*MIB,nodes=0;const seen=new Set();const walk=v=>{assert(++nodes<=150000);if(v===null||v===undefined||typeof v==='number'||typeof v==='boolean'){bytes+=16;return;}if(typeof v==='string'){bytes+=48+4*v.length;return;}assert(typeof v==='object');if(seen.has(v))return;seen.add(v);bytes+=128;if(Buffer.isBuffer(v)){bytes+=2*v.length;return;}for(const[k,x]of Object.entries(v)){bytes+=64+4*k.length;walk(x);}};walk({freeze,freezeBytes,meta,base,counts,commands,records,graphs,cleanupErrors,audits,firstPhysicalFailure,sourcePrivate,sourceTrace,firstFailure,extra});peakLogicalBytes=Math.max(peakLogicalBytes,bytes);assert(bytes<=16*MIB,'16MiB harness logical charge');};
  async function put(name,value,limit=65536){time();const text=typeof value==='string'?value:json(value),data=Buffer.from(text);assert(data.length<=limit,'packet bound '+name);charge(value,text,data);assert(evidenceBytes+data.length+MIB<=16*MIB,'16MiB evidence reserve');await writeFile(resolve(out,name),data,{flag:'wx'});evidenceBytes+=data.length;return resolve(out,name);}
  async function authenticate(){
    time();assert(freeze.files&&Object.keys(freeze.files).length<=768);
    for(const[name,p]of Object.entries(freeze.files)){assert(!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));await auth(path,p);}
    for(const path of REQUIRED)assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'missing mandatory frozen file '+path);
    for(const name of ['node','python',...['esbuild','tsc'].filter(n=>Object.hasOwn(freeze.tools,n))]){const path=freeze.tools[name],p=freeze.tools[name+'Pin'];assert(isAbsolute(path));if(p.path!==undefined)assert.equal(p.path,path);await auth(path,p);}
    assert.equal(freeze.tools.node,process.execPath);assert(process.versions.node.startsWith('22.'));
    if(meta){assert.equal(meta.stagedPins.length,262);for(const p of meta.stagedPins){assert(inside(resolve(MICRO,'build'),p.path));await auth(p.path,p);}assert.equal(meta.transfer.length,88);for(const t of meta.transfer){const path=resolve(ROOT,'packages/barocss-physics/src',t.name);assert(inside(resolve(ROOT,'packages/barocss-physics/src'),path));await auth(path,t.original);}}
  }
  async function child(label,args,deadlineMs){
    time();const remaining=170000-(performance.now()-started);assert(remaining>1000,'insufficient child deadline');const row={label,args,pid:null,exit:null,signal:null,closed:false,deadlineMs:Math.min(deadlineMs,remaining-500)};commands.push(row);
    const proc=spawn(args[0],args.slice(1),{cwd:ROOT,stdio:['ignore','pipe','pipe']});row.pid=proc.pid??null;let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),primary=null;
    const fail=e=>{primary??=e;proc.kill('SIGKILL');},timer=setTimeout(()=>fail(new Error(label+' child deadline')),row.deadlineMs);
    try{await new Promise(done=>{proc.once('error',e=>{primary??=e;});for(const[stream,isOut]of[[proc.stdout,true],[proc.stderr,false]]){stream.on('error',fail);stream.on('data',block=>{if(stdout.length+stderr.length+block.length>65536){fail(new Error(label+' child output bound'));return;}if(isOut)stdout=Buffer.concat([stdout,block]);else stderr=Buffer.concat([stderr,block]);});}proc.once('close',(exit,signal)=>{Object.assign(row,{exit,signal,closed:true});done();});});
      await put(label+'.stdout.raw',stdout.toString());await put(label+'.stderr.raw',stderr.toString());if(primary)throw primary;assert.equal(row.exit,0,label+' child failed');return stdout;
    }finally{clearTimeout(timer);if(!row.closed)proc.kill('SIGKILL');}
  }
  async function externalOutput(name,limit){const path=resolve(out,name),bytes=await bounded(path,limit),data=JSON.parse(bytes);charge(bytes,data);assert(evidenceBytes+bytes.length+MIB<=16*MIB);evidenceBytes+=bytes.length;return{path,data,pin:await pin(path)};}
  try{
    await authenticate();meta=JSON.parse(await bounded(META,MIB));await authenticate();
    assert.equal(JSON.parse(await bounded(resolve(MICRO,'summary.json'))).status,'PASS_STAGED_G1B_MICRO_ONLY');
    base=decode(JSON.parse(await bounded(BASE)));assert.equal(base.options.profile,'rigid-discrete-v1');assert.equal(base.options.broadPhase,'direct');assert.equal(base.options.fixedStepSeconds,1/120);
    assert.equal(base.model.bodies.length,1);assert.equal(base.model.colliders.length,1);assert.equal(base.model.bodies[0].id,'rotor');assert.equal(base.model.bodies[0].massKg,1);assert.deepEqual(base.model.bodies[0].inertia,{kind:'primitive-com',about:'com',frame:'body-local'});
    assert.deepEqual(base.model.colliders[0].geometry,{kind:'box',halfExtentsM:[.1,.2,.3]});assert.deepEqual(base.model.bodies[0].initial,{positionM:[0,0,0],orientationXYZW:[0,0,0,1],velocityMps:[0,0,0],angularVelocityRadps:[1,1,1]});assert.deepEqual(base.model.gravityMps2,[0,0,0]);for(const k of ['joints','cloths','fluids'])assert.deepEqual(base.model[k],[]);assert.equal(base.model.colliders[0].ccd,false);assert.equal(base.model.colliders[0].sensor,false);
    for(const graph of ['source','native']){
      phase='capture-'+graph;await authenticate();
      const api=await import(pathToFileURL(graph==='source'?resolve(MICRO,'build/source.mjs'):resolve(PACKAGE,'dist/index.js')).href);counts.entryEvaluations++;
      const control=graph==='source'?api:await import(pathToFileURL(resolve(PACKAGE,'dist/g1-test-control.js')).href);if(graph==='native')counts.entryEvaluations++;
      const c=control.g1Control,t=control.g1bControl;c.assertReleased();assert.deepEqual(t.take(),[]);
      const beforeStats=c.stats(),beforeTri=t.stats();
      for(const caseId of ['J','JT']){
        const pair=structuredClone(base),loads=[{kind:'angularImpulse',bodyId:'rotor',angularImpulseNms:[...J]}];if(caseId==='JT')loads.push({kind:'torque',bodyId:'rotor',torqueNm:[...TAU]});
        const pairWords=words(pair),commandWords=words(loads),prefix=graph+'-'+caseId;
        let world=null,primary=null,before=null,after=null,privateInitial=null,traceReceipt=null,beforeWords=null,afterWords=null;
        try{
          time();counts.worlds++;world=api.createPhysicsWorld(pair.model,pair.options);counts.reads++;before=world.getState();counts.stateAudits++;stateGuard(before,0,pair,meta.expectedProviderDigests[graph]);detached(before,[pair,loads]);beforeWords=words(before);
          counts.privateInertiaReads++;const cache=c.cache(world),body=cache.bodies.find(b=>b.id==='rotor');assert(body);privateInitial={bodyId:body.id,inertiaDiagonalKgM2:raw(body.inertiaDiagonalKgM2),orientationXYZW:raw(body.orientation)};assert.deepEqual(privateInitial.orientationXYZW,raw(before.bodies[0].orientationXYZW));
          counts.steps++;after=world.step(loads);counts.acceptedSteps++;counts.stateAudits++;stateGuard(after,1,pair,meta.expectedProviderDigests[graph]);detached(after,[pair,loads,before]);assert.equal(words(before),beforeWords);afterWords=words(after);
          assert.equal(words(pair),pairWords,'pair mutation');assert.equal(words(loads),commandWords,'command mutation');
          const observations=t.take();assert.equal(observations.length,595);const kinds={};for(const x of observations)kinds[x.kind]=(kinds[x.kind]??0)+1;assert.deepEqual(kinds,{initialMomentum:1,newtonCondition:108,pivot:324,newtonUpdate:108,midpointResidual:27,stageComplete:27});
          const trace=observations.map(x=>JSON.stringify(raw(x))).join('\n')+'\n';assert(Buffer.byteLength(trace)<=MIB);charge(observations,trace);await put(prefix+'-trace.jsonl',trace,MIB);traceReceipt={count:595,kinds,bytes:Buffer.byteLength(trace),sha256:hash(trace)};
          await put(prefix+'-private-initial.json',privateInitial);
          if(graph==='source'){sourcePrivate[caseId]=privateInitial;sourceTrace[caseId]=traceReceipt;}
          else {assert.deepEqual(privateInitial,sourcePrivate[caseId],'actual admitted private words parity');assert.deepEqual(traceReceipt,sourceTrace[caseId],'actual trace words parity');}
          const packet={graph,id:caseId,pairRaw:raw(pair),commandsRaw:raw(loads),beforeRaw:raw(before),afterRaw:raw(after)};
          await put(prefix+'-record.json',packet);records.push(packet);
          await put(prefix+'-trace-receipt.json',traceReceipt);
        }catch(e){primary=e;throw e;}
        finally{
          if(world){for(const[action,fn]of[['dispose',()=>{counts.disposals++;world.dispose();}],['cancel',()=>c.cancel()],['release',()=>{counts.releases++;c.release(world);}]])try{fn();}catch(e){cleanupErrors.push({graph,id:caseId,action,message:e.message});primary??=e;}}
          try{const leftovers=t.take();assert.deepEqual(leftovers,[],'undrained trace');t.assertEmpty();c.assertReleased();}catch(e){cleanupErrors.push({graph,id:caseId,action:'controls',message:e.message});primary??=e;}
          if(primary&&!firstFailure)firstFailure={phase,name:primary.name,message:primary.message,stack:primary.stack};
        }
        assert.equal(cleanupErrors.length,0,'cleanup failure');
        assert.equal(words(before),beforeWords,'dispose mutated initial output');assert.equal(words(after),afterWords,'dispose mutated final output');assert.equal(words(pair),pairWords);assert.equal(words(loads),commandWords);
      }
      const gs=c.stats(),ts=t.stats();assert.equal(gs.attachments-beforeStats.attachments,2);assert.equal(gs.releases-beforeStats.releases,2);assert.equal(gs.dispatch-beforeStats.dispatch,2);assert.equal(gs.faultThrows-beforeStats.faultThrows,0);assert.equal(ts.general-beforeTri.general,2);assert.equal(ts.stageComplete-beforeTri.stageComplete,54);assert.equal(ts.pivot-beforeTri.pivot,648);
      graphs[graph]={status:'CAPTURED_NOT_PHYSICALLY_CLASSIFIED',commonStats:gs,triaxialStats:ts};await put(graph+'-helper-stats.json',graphs[graph]);
    }
    assert.equal(records.length,4);assert.equal(counts.disposals,4);assert.equal(counts.releases,4);assert.equal(counts.acceptedSteps,4);assert.equal(counts.stateAudits,8);assert.equal(counts.buildChildren,0);
    for(const caseId of ['J','JT']){const s=records.find(x=>x.graph==='source'&&x.id===caseId),n=records.find(x=>x.graph==='native'&&x.id===caseId);parity({...s,graph:'paired'},{...n,graph:'paired'},meta.expectedProviderDigests);}
    await put('capture-complete.json',{status:'FOUR_WORLDS_CLOSED_BEFORE_CLASSIFICATION',counts,cleanupErrors});await authenticate();
    phase='reference-bank';const bankInput={cases:records.filter(x=>x.graph==='source').map(({id,pairRaw,commandsRaw})=>({id,pairRaw,commandsRaw}))};const input=await put('bank-input.json',bankInput),bankPath=resolve(out,'bank.json');counts.referenceChildren++;
    await child('bank-build',[freeze.tools.python,'-B',REFERENCE,'--build-bank','--input',input,'--output',bankPath],140000);
    let bankPin;{const bank=await externalOutput('bank.json',MIB);assert.equal(bank.data.status,'PASS_REFERENCE_BANK');bankPin=bank.pin;}
    for(const record of records){
      phase='audit-'+record.graph+'-'+record.id;const prefix=record.graph+'-'+record.id;await auth(bankPath,bankPin);counts.referenceChildren++;
      await child(prefix+'-audit',[freeze.tools.python,'-B',REFERENCE,'--audit','--input',resolve(out,prefix+'-record.json'),'--bank',bankPath,'--output',resolve(out,prefix+'-audit.json')],20000);
      const result=await externalOutput(prefix+'-audit.json',65536);assert.equal(result.data.status,'PASS_REFERENCE_AUDIT');assert(['PASS','PHYSICAL_NO_GO'].includes(result.data.physicalStatus));
      audits.push({graph:record.graph,id:record.id,physicalStatus:result.data.physicalStatus,path:result.path,...result.pin});if(result.data.physicalStatus==='PHYSICAL_NO_GO'&&!firstPhysicalFailure[record.graph])firstPhysicalFailure[record.graph]={id:record.id,report:result.data};
    }
    await auth(bankPath,bankPin);for(const graph of ['source','native'])graphs[graph].status=firstPhysicalFailure[graph]?'PHYSICAL_NO_GO':'PASS';assert.equal(counts.referenceChildren,5);
  }catch(e){firstFailure??={phase,name:e.name,message:e.message,stack:e.stack};}
  finally{
    try{await authenticate();}catch(e){if(firstFailure)cleanupErrors.push({action:'post-auth',message:e.message});else firstFailure={phase:'post-auth',name:e.name,message:e.message,stack:e.stack};}
    const status=firstFailure||cleanupErrors.length?'FAIL':Object.keys(firstPhysicalFailure).length?'CHARACTERIZED_PHYSICAL_NO_GO':'CHARACTERIZED_PHYSICAL_PASS';
    const summary={status,mode,runId:id,phase,counts,graphs,audits,firstFailure,firstPhysicalFailure,cleanupErrors,commands,resources:{evidenceBytes,peakLogicalBytes,wholeLogicalBytes:64*MIB,referenceLogicalBytes:8*MIB,buildBytes:0,rssClaim:false},innerMs:performance.now()-started,productionAdoption:'NOT_RUN',repair:'NOT_RUN',physicalToleranceChanged:false};
    // The summary is the final failure receipt even if the inner deadline has expired.
    const text=json(summary);assert(Buffer.byteLength(text)<=65536);assert(evidenceBytes+Buffer.byteLength(text)<=16*MIB);await writeFile(resolve(out,'summary.json'),text,{flag:'wx'});
    process.stdout.write(json({status,summary:resolve(out,'summary.json')}));if(status==='FAIL')process.exitCode=1;
  }
}
main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});
