// Fresh exact existing failure/restore/regression bank after the face guide change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,openSync,readSync,closeSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCase as twoCase,numericWordsHex} from '../physics-coupled-cubes-floor-2276/cases.mjs';
import {makeCase as threeCase} from '../physics-three-cubes-floor-2276/cases.mjs';
const root=resolve(import.meta.dirname,'../..'),here=import.meta.dirname,id=process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===5&&process.argv[3]==='--public');
const apiPath=resolve(root,process.argv[4]),apiDirectory=dirname(apiPath);
const out=join(here,'evidence',id);mkdirSync(out);const deadline=Date.now()+170000,pins={},reports={},bytes={source:0,native:0};let graph=null,failure=null;
function hash(p){const f=openSync(p,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);try{let n;while((n=readSync(f,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(f);}return h.digest('hex');}
function pin(p,expected){const actual=hash(p);if(expected)assert.equal(actual,expected,p);pins[p]=actual;}
function put(name,value){const s=JSON.stringify(value)+'\n',n=Buffer.byteLength(s);assert.ok(n<=2*1024*1024);if(graph){bytes[graph]+=n;assert.ok(bytes[graph]<=16*1024*1024);}writeFileSync(join(out,name),s,{flag:'wx'});}
const json=p=>JSON.parse(readFileSync(p,'utf8'));
function restore(p){const raw=Buffer.from(p.numericWordsF64leHex,'hex');assert.ok(raw.length<=512*1024);let i=0;function visit(x){if(typeof x==='number'){assert.ok(i+8<=raw.length);const v=raw.readDoubleLE(i);i+=8;assert.ok(Number.isFinite(v)&&v===x);return v;}if(Array.isArray(x))return x.map(visit);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v)]));return x;}const data=visit(p.data);assert.equal(i,raw.length);assert.equal(numericWordsHex(data),p.numericWordsF64leHex);return data;}
const normal=x=>Array.isArray(x)?x.map(normal):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'OWN_PROVIDER':normal(v)])):x;
function equal(a,b){assert.deepEqual(normal(a),normal(b));assert.equal(numericWordsHex(a),numericWordsHex(b));}
try{
 pin(apiPath);const paid=json(apiPath);assert.equal(paid.status,'ANISOTROPIC_PUBLIC_SOURCE_NATIVE_EIGHT_CASES_CONFIRMED');assert.equal(paid.sourceIntegrity,'PASS');const buildPath=paid.buildManifest;pin(buildPath);const build=json(buildPath);assert.equal(build.status,'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');assert.equal(build.sourceIntegrity,true);
 for(const map of [build.sourcePins,build.nativePins,build.currentSourcePins])for(const[p,s]of Object.entries(map))pin(resolve(root,p),s);
 for(const p of [import.meta.filename,join(here,'POST-REPAIR-REGRESSION-CONTRACT.md'),join(root,'examples/physics-coupled-cubes-floor-2276/cases.mjs'),join(root,'examples/physics-three-cubes-floor-2276/cases.mjs'),join(root,'examples/physics-model-input/model.mjs'),process.execPath])pin(p);
 put('inputs.json',{pins,scope:'actual fixed source/native; no old refusal providers'});
 for(const which of ['source','native']){
  graph=which;const count=reports[which]={worlds:0,externalAttempts:0,externalReturns:0,replayedSteps:0,refusals:0,regressionSteps:0,status:'RUNNING'},api={...await import(pathToFileURL(which==='source'?build.sourceEntry:build.nativeEntry)),...await import(pathToFileURL(which==='source'?build.sourceReplay:build.nativeReplay))};
  function open(c){assert.ok(Date.now()<deadline&&count.worlds<48);const w=api.createPhysicsWorld(c.model,c.options);count.worlds++;return w;}
  function step(actor,c=[]){assert.ok(Date.now()<deadline&&count.externalAttempts<1024);count.externalAttempts++;const s=actor.step(c);count.externalReturns++;return s;}
  function owner(w,r){return{model:w.getModel(),state:w.getState(),...(r?{recording:r.saveRecording()}: {})};}
  const naturalPath=join(apiDirectory,which+'-natural-120-64.json');pin(naturalPath);const natural=restore(json(naturalPath)),c={model:natural.model,options:natural.options};let saved=null;
  for(const[name,make,path]of [['two',twoCase,join(root,'examples/physics-coupled-cubes-floor-2276/evidence/public32-01',which+'-prefix-32.json')],['three',threeCase,join(root,'examples/physics-three-cubes-floor-2276/evidence/api-01',which+'-first32.json')]]){
   pin(path);const old=restore(json(path)),input=make(),w=open(input),states=[w.getState()];try{equal(states[0],old.states[0]);for(let n=1;n<=32;n++){states.push(step(w));count.regressionSteps++;equal(states[n],old.states[n]);}put(which+'-'+name+'-regression.json',{states,allWords:numericWordsHex(states),paid:path});}finally{w.dispose();}
  }
  for(const record of [true,false]){
   const w=open(c),r=record?api.createPhysicsRecorder(w):null;try{for(let n=1;n<=4;n++)equal(step(r??w),natural.states[n]);const before=owner(w,r);if(record)saved=before.recording;const commands=[{kind:'impulse',bodyId:'upper',impulseNs:[0,100000,0]}],original=structuredClone(commands);let observed=null;
    try{step(r??w,commands);}catch(e){observed=e;count.refusals++;}const after=owner(w,r);put(which+'-known-'+record+'.json',{before,after,beforeWords:numericWordsHex(before),afterWords:numericWordsHex(after),error:{code:observed?.code,details:observed?.details}});assert.ok(observed instanceof api.PhysicsError);assert.equal(observed.code,'NUMERIC_LIMIT');assert.equal(observed.details.phase,'candidate');assert.equal(observed.details.operation,record?'record':'step');assert.equal(observed.details.accepted.stepIndex,4);assert.deepEqual(after,before);assert.equal(numericWordsHex(after),numericWordsHex(before));assert.deepEqual(commands,original);equal(step(r??w),natural.states[5]);
   }finally{r?.dispose();w.dispose();}
  }
  for(const record of [true,false]){
   const input=structuredClone(c),upper=input.model.bodies.find(b=>b.id==='upper'),col=input.model.colliders.find(x=>x.bodyId==='upper');upper.massKg=1e6;upper.initial.positionM=[0,5000,0];col.geometry.halfExtentsM=[1000,.0001,.0001];const original=structuredClone(input),w=open(input),r=record?api.createPhysicsRecorder(w):null;
   try{const before=owner(w,r);let observed=null;try{step(r??w);}catch(e){observed=e;count.refusals++;}const after=owner(w,r);put(which+'-conditioned-'+record+'.json',{before,after,beforeWords:numericWordsHex(before),afterWords:numericWordsHex(after),error:{code:observed?.code,message:observed?.message,details:observed?.details}});assert.ok(observed instanceof api.PhysicsError);assert.equal(observed.code,'NUMERIC_LIMIT');assert.match(observed.message,/positive definite well-scaled inertia required/);assert.equal(observed.details.phase,'candidate');assert.equal(observed.details.operation,record?'record':'step');assert.equal(observed.details.accepted.stepIndex,0);assert.deepEqual(after,before);assert.equal(numericWordsHex(after),numericWordsHex(before));assert.deepEqual(input,original);}finally{r?.dispose();w.dispose();}
  }
  assert.equal(saved.frames.length,4);const restored=api.restorePhysicsRecording(saved,{model:c.model,options:c.options,providerDigest:paid.reports[which].providerDigest});count.worlds++;count.replayedSteps+=4;try{equal(restored.world.getState(),natural.states[4]);for(let n=5;n<=8;n++)equal(step(restored.recorder),natural.states[n]);put(which+'-restore.json',{state:restored.world.getState(),recording:restored.recorder.saveRecording(),replayedSteps:4,continuedSteps:4});}finally{restored.recorder.dispose();restored.world.dispose();}
  assert.equal(count.worlds,7);assert.equal(count.externalAttempts,82);assert.equal(count.externalReturns,78);assert.equal(count.replayedSteps,4);assert.equal(count.refusals,4);count.acceptedSteps=count.externalReturns+count.replayedSteps;count.status='KNOWN_CONDITIONED_REFUSALS_RESTORE_AND_ISOTROPIC_32_PARITY_CONFIRMED';
 }
}catch(e){failure={graph,message:e.message,stack:e.stack};process.exitCode=1;}
finally{let sourceIntegrity='PASS';try{for(const[p,s]of Object.entries(pins))assert.equal(hash(p),s);assert.ok(Date.now()<deadline);}catch(e){sourceIntegrity='FAIL';failure??={message:e.message};process.exitCode=1;}put('final-inputs.json',pins);put('result.json',{status:failure?'CONTACT_POST_REPAIR_REGRESSION_NO_GO':'CONTACT_POST_REPAIR_FAILURE_RESTORE_REGRESSION_CONFIRMED',failure,reports,sourceIntegrity,bytes,oracleCalls:0,compilerCalls:0,mobile:false,publication:false});}
