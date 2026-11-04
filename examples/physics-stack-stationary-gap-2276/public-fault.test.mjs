// Root runs only against authenticated example-owned fault provider copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {closeSync, openSync, readFileSync, readSync} from 'node:fs';
import {basename, dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';

const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const paid=join(home,'evidence/gap-01'),faultHome=join(root,'examples/physics-stack-stationary-world-2276');
const hash=b=>createHash('sha256').update(b).digest('hex');
function filePin(path){
  const h=createHash('sha256'),b=Buffer.alloc(65536),fd=openSync(path,'r');let bytes=0;
  try{let n;while((n=readSync(fd,b,0,b.length,null))){h.update(b.subarray(0,n));bytes+=n;}}
  finally{closeSync(fd);}
  return {bytes,sha256:h.digest('hex')};
}
const publicPinsPath=join(home,'PUBLIC-FAULT-PINS.json'),publicPinsBytes=readFileSync(publicPinsPath);
const publicPins=JSON.parse(publicPinsBytes),publicPinsSHA=hash(publicPinsBytes);
function authenticate(){
  assert.equal(hash(readFileSync(publicPinsPath)),publicPinsSHA,'public test pins changed');
  for(const [name,expected]of Object.entries(publicPins.files))assert.deepEqual(filePin(isAbsolute(name)?name:join(root,name)),expected,name);
}
authenticate();
// These immutable, paid bytes predate every public fault test and its provider copy.
const result=JSON.parse(readFileSync(join(paid,'result.json'))),gapPins=JSON.parse(readFileSync(join(home,'PINS.json')));
assert.equal(result.status,'PASS_PRIVATE_GAP_ONE_STEP');assert.equal(result.firstFailure,null);
assert.equal(result.pinsSHA,hash(readFileSync(join(home,'PINS.json'))));
assert.equal(result.providerDigest,'a4ec8205257faa0faa06df13e58f06d944458be2d82f86d8df56030284fca70d');
assert.equal(result.providerDigest,gapPins.providerDigest);
assert.equal(result.actualPrepareCalls,1);assert.equal(result.accepted,1);
assert.equal(result.nonzeroYDisplacement,true);assert.equal(result.inputRetained,true);assert.equal(result.authenticationAfter,true);
assert.equal(result.recovery.allRecordWordsRecovered,true);assert.equal(result.recovery.numericWords,9772);
assert.equal(result.recovery.frames,7);assert.equal(result.recovery.rawBytes,6552);
assert.equal(result.cleanup.length,2);
assert.equal(result.cleanup.reduce((n,x)=>n+x.requests,0),5);
for(const x of result.cleanup){assert.equal(x.closed,true);assert.equal(x.exit,0);assert.equal(x.signal,null);assert.equal(x.error,null);assert.equal(x.stderrBytes,0);assert.equal(x.trailingBytes,0);assert.equal(x.requests,x.replies);}
const oldGuard=JSON.parse(readFileSync(join(root,'examples/physics-world-p5-2276/evidence/stationary-gap-01/result.json')));
assert.equal(oldGuard.status,'PASS');assert.equal(oldGuard.exit,0);assert.equal(oldGuard.timedOut,false);assert.equal(oldGuard.ownedGroupPresentAtFinalization,false);
const decoded=gunzipSync(readFileSync(join(paid,'step-0.jsonl.gz')),{maxOutputLength:4*1024*1024});
const raw=gunzipSync(readFileSync(join(paid,'step-0.f64le.gz')),{maxOutputLength:6552});
const recordWords=readFileSync(join(paid,'record-words.f64le'));
assert.equal(hash(decoded),result.archive.decodedRecordSha256);
assert.equal(hash(raw),result.recovery.rawSha256);assert.equal(raw.length,7*936);
assert.equal(hash(recordWords),result.recovery.recordWordSha256);assert.equal(recordWords.length,9772*8);
let offset=0;
function restore(v){
  if(typeof v==='number'){
    assert.ok(offset+8<=recordWords.length);const n=recordWords.readDoubleLE(offset);offset+=8;
    assert.ok(Number.isFinite(n)&&n===v,'paid numeric word mismatch');return n;
  }
  if(Array.isArray(v))return v.map(restore);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,restore(x)]));
  return v;
}
const record=restore(JSON.parse(decoded.toString('utf8')));assert.equal(offset,recordWords.length);
const endianWords=Buffer.alloc(recordWords.length);
for(let i=0;i<recordWords.length;i+=8)endianWords.writeDoubleBE(recordWords.readDoubleLE(i),i);
assert.equal(hash(endianWords),result.archive.binary64BeWordSha256);
const FRAME_NAMES=['INPUT','BEFORE','FREE','VELOCITY','POSITION_PRE','POSITION_HYP','CANDIDATE'];
const d=record.prepared.diagnostics,p=d.positionAttempt;
const internalFrames=[record.input,d.beforeBodies,d.freeBodies,d.velocityBodies,p.preBodies,p.hypotheticalBodies,record.prepared.candidateBodies];
function internalWords(bodies){
  assert.equal(bodies.length,9);const b=Buffer.alloc(936);let at=0;
  for(const body of bodies)for(const [key,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]])for(let i=0;i<n;i++){assert.ok(Number.isFinite(body[key][i]));b.writeDoubleLE(body[key][i],at);at+=8;}
  return b;
}
for(let i=0;i<7;i++){
  assert.equal(record.frameLayouts[i].name,FRAME_NAMES[i]);assert.equal(record.frameLayouts[i].bytes,936);
  const frame=raw.subarray(i*936,(i+1)*936);
  assert.equal(hash(frame),record.frameLayouts[i].sha256);
  assert.deepEqual(frame,internalWords(internalFrames[i]));
  assert.deepEqual(record.frameLayouts[i].bodyIds,internalFrames[i].map(b=>b.id));
}
const paidInitial=Buffer.from(raw.subarray(0,936));
// Producer's explicit seven-frame map: candidate is index6, offset5616, length936.
const paidCandidate=Buffer.from(raw.subarray(5616,6552));
assert.notDeepEqual(paidCandidate,paidInitial);
assert.ok(record.displacements.some(x=>x.deltaY!==0));

const worldPath=resolve(process.env.STATIONARY_FAULT_WORLD??''),replayPath=resolve(process.env.STATIONARY_FAULT_REPLAY??'');
assert.ok(process.env.STATIONARY_FAULT_WORLD&&process.env.STATIONARY_FAULT_REPLAY,'instrumented provider env required');
assert.equal(basename(worldPath),'index.js');assert.equal(basename(replayPath),'replay.js');assert.equal(dirname(worldPath),dirname(replayPath));
const copy=dirname(worldPath),faultOut=dirname(copy);
assert.equal(basename(copy),'provider-copy');
assert.ok(['public-fault-source-01','public-fault-native-01'].includes(basename(faultOut)));
assert.equal(dirname(faultOut),join(faultHome,'evidence'));
for(const name of ['INPUTS','RESULT'])assert.match(process.env['STATIONARY_GAP_FAULT_'+name+'_SHA256']??'',/^[a-f0-9]{64}$/,'Root-bound fault manifest SHA required');
const faultInputsBytes=readFileSync(join(faultOut,'inputs.json')),faultResultBytes=readFileSync(join(faultOut,'result.json'));
assert.equal(hash(faultInputsBytes),process.env.STATIONARY_GAP_FAULT_INPUTS_SHA256);
assert.equal(hash(faultResultBytes),process.env.STATIONARY_GAP_FAULT_RESULT_SHA256);
const faultInputs=JSON.parse(faultInputsBytes),faultResult=JSON.parse(faultResultBytes);
assert.equal(faultResult.status,'FAULT_CONTROLS_CONFIRMED');assert.equal(faultResult.originalProviderUnchanged,true);assert.equal(faultResult.exit,0);assert.equal(faultResult.signal,null);assert.equal(faultResult.error,null);
assert.equal(faultInputs.mode,basename(faultOut)==='public-fault-source-01'?'source':'native');
assert.deepEqual(faultInputs.changes,faultResult.changes);
assert.equal(faultInputs.providerIdentityScope,'TEST_COPY_ONLY; identity not claimed for instrumented bytes');
const changes=new Map(faultInputs.changes.map(x=>[x.path,x]));
assert.ok(changes.size>=1&&changes.size<=2);
for(const [name,c]of changes){
  assert.ok(['index.js','world.js'].includes(name));assert.equal(c.testOnly,true);
  assert.deepEqual(c.insertions,['frames','candidate','output','log','commit']);
  assert.equal(c.originalSha256,faultInputs.before[name]);
}
const copyPins=new Map();
for(const [name,originalSHA]of Object.entries(faultInputs.before)){
  assert.ok(name==='../package.json'||(!name.startsWith('/')&&!name.split('/').includes('..')));
  const target=name==='../package.json'?join(copy,'package.json'):join(copy,name);
  const expected=changes.get(name)?.instrumentedSha256??originalSHA;
  assert.equal(filePin(target).sha256,expected,'only authenticated instrumentation permitted');copyPins.set(target,expected);
}
function authenticateCopy(){
  assert.equal(hash(readFileSync(join(faultOut,'inputs.json'))),process.env.STATIONARY_GAP_FAULT_INPUTS_SHA256);
  assert.equal(hash(readFileSync(join(faultOut,'result.json'))),process.env.STATIONARY_GAP_FAULT_RESULT_SHA256);
  for(const [path,sha]of copyPins)assert.equal(filePin(path).sha256,sha);
}
const {model,options,bodyWords}=await import(pathToFileURL(join(faultHome,'model.mjs')));
const api=await import(pathToFileURL(worldPath)),replay=await import(pathToFileURL(replayPath));
function gapModel(){const m=model('ALIGNED');for(const b of m.bodies)if(b.kind==='dynamic')b.initial.positionM[1]+=.0001;return m;}
function assertPaid(state,expected){
  assert.deepEqual(state.bodies.map(b=>b.id),record.frameLayouts[0].bodyIds);
  assert.deepEqual(bodyWords(state),expected,'actual public body words versus paid private GAP');
}
function closeAll(items){for(const item of items.reverse())item?.dispose();}

test('unfaulted public candidate has actual nonzero paid GAP displacement',()=>{
  const authored=gapModel(),retained=structuredClone(authored),w=api.createPhysicsWorld(authored,options);
  try{
    const before=w.getState();assertPaid(before,paidInitial);assert.equal(before.stepIndex,0);assert.equal(before.timeSeconds,0);
    const after=w.step([]);assertPaid(after,paidCandidate);assert.notDeepEqual(bodyWords(after),bodyWords(before));
    assert.equal(after.stepIndex,1);assert.equal(after.timeSeconds,1/120);assert.deepEqual(authored,retained);
  }finally{w.dispose();}
});
for(const point of ['frames','candidate','output','log','commit'])test('paid GAP rollback '+point+'; known/error/object/null; clean retry and restore',()=>{
  for(const kind of ['known','error','object','null']){
    const owned=[];let w,c,r,cr,restored;
    try{
      const authored=gapModel(),retained=structuredClone(authored);
      w=api.createPhysicsWorld(authored,options);owned.push(w);
      c=api.createPhysicsWorld(gapModel(),options);owned.push(c);
      r=replay.createPhysicsRecorder(w);owned.push(r);cr=replay.createPhysicsRecorder(c);owned.push(cr);
      const before=w.getState(),beforeWords=bodyWords(before),beforeModel=w.getModel(),beforeRecording=r.saveRecording(),command=[];
      assertPaid(before,paidInitial);assert.equal(before.stepIndex,0);assert.equal(before.timeSeconds,0);
      assert.equal(beforeRecording.frames.length,0);
      const value=kind==='known'?new api.PhysicsError('NUMERIC_LIMIT','GAP injected '+point):kind==='error'?Error('GAP unknown '+point):kind==='object'?{tag:'GAP unknown',point}:null;
      assert.equal(globalThis.__stationaryWorldFault??null,null);
      globalThis.__stationaryWorldFault={point,value};let caught=false;
      try{r.step(command);}catch(error){
        caught=true;
        if(kind==='known'){
          assert.ok(error instanceof api.PhysicsError);assert.equal(error.code,'NUMERIC_LIMIT');
          assert.equal(error.details.operation,'record');assert.equal(error.details.phase,point==='candidate'?'candidate':'prepare-output');
          assert.deepEqual(error.details.accepted,{stepIndex:0,timeSeconds:0});
        }else assert.equal(error,value,'unknown thrown value identity');
      }
      assert.equal(caught,true);assert.equal(globalThis.__stationaryWorldFault,null);
      assert.deepEqual(command,[]);assert.deepEqual(authored,retained);
      assert.deepEqual(w.getState(),before);assert.deepEqual(bodyWords(w.getState()),beforeWords);
      assert.deepEqual(w.getModel(),beforeModel);assert.deepEqual(r.getState(),before);assert.deepEqual(r.saveRecording(),beforeRecording);
      const first=r.step([]),cleanFirst=cr.step([]);
      assertPaid(first,paidCandidate);assert.deepEqual(first,cleanFirst);
      assert.equal(first.stepIndex,1);assert.equal(first.timeSeconds,1/120);assert.equal(r.saveRecording().frames.length,1);
      const saved=r.saveRecording();
      restored=replay.restorePhysicsRecording(saved,{model:saved.model,options:saved.options,providerDigest:saved.identity.providerDigest});
      owned.push(restored.world,restored.recorder);
      assert.deepEqual(restored.world.getState(),first);assertPaid(restored.world.getState(),paidCandidate);
      const next=r.step([]),cleanNext=cr.step([]),restoredNext=restored.recorder.step([]);
      assert.deepEqual(next,cleanNext);assert.deepEqual(restoredNext,cleanNext);
      assert.deepEqual(bodyWords(next),bodyWords(cleanNext));assert.deepEqual(bodyWords(restoredNext),bodyWords(cleanNext));
      assert.equal(next.stepIndex,2);assert.equal(next.timeSeconds,2/120);assert.equal(r.saveRecording().frames.length,2);
      assert.deepEqual(w.getModel(),beforeModel);assert.deepEqual(authored,retained);
    }finally{globalThis.__stationaryWorldFault=null;closeAll(owned);}
  }
});
test.after(()=>{authenticateCopy();authenticate();});
