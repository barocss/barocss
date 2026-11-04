// Root-only current build03 Source diagnostic. No compiler, replay factory or extra solve.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync,copyFileSync,existsSync,mkdirSync,openSync,readSync,closeSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCases,numericWordsHex} from './cases.mjs';

const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===3);
const out=join(here,'evidence',id);mkdirSync(out);
const paid=join(here,'evidence/long-02'),buildPath=join(root,'examples/physics-anisotropic-inertia-2276/evidence/public-build-03/result.json');
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const deadline=Date.now()+170000,frozen={},frameProof=[],changes=[];
let phase='authenticate',failure=null,integrity='NOT_RUN',charged=0,closure=null,copyPins=null,observer=null,audit=null;
let worlds=0,attempts=0,returned=0,sourceFrames=0,nativeFrames=0,referenceCalls=0;
function pin(path){const fd=openSync(path,'r'),h=createHash('sha256'),block=Buffer.alloc(65536);let bytes=0;try{let n;while((n=readSync(fd,block,0,block.length,null))){h.update(block.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}return{bytes,sha256:h.digest('hex')};}
function freeze(path,sha){const p=pin(path);if(sha)assert.equal(p.sha256,sha);frozen[relative(root,path)]=p;}
function time(){assert.ok(Date.now()<deadline,'one170s includes replay/reference/cleanup/auth');}
function charge(n){charged+=n;assert.ok(charged<=16*1024*1024,'16MiB total including diagnostic closure');}
function put(name,value){const b=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');assert.ok(b.length<=2*1024*1024,'2MiB artifact');charge(b.length);writeFileSync(join(out,name),b,{flag:'wx'});}
function inventory(dir){const r={};function visit(at){for(const e of readdirSync(at,{withFileTypes:true})){assert.ok(!e.isSymbolicLink());const p=join(at,e.name);if(e.isDirectory())visit(p);else r[relative(dir,p)]=pin(p);}}visit(dir);return r;}
function transform(path,needle,replacement){const before=readFileSync(path,'utf8');assert.equal(before.split(needle).length,2,'one authenticated callsite');const after=before.replace(needle,replacement);charge(Math.max(0,Buffer.byteLength(after)-Buffer.byteLength(before)));writeFileSync(path,after);changes.push({path:relative(closure,path),needle,replacement,beforeSHA256:createHash('sha256').update(before).digest('hex'),afterSHA256:pin(path).sha256});}
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'&&typeof v==='string'?'UNTRUSTED_DIAGNOSTIC_COPY':normalize(v)])):x;
function same(a,b,label){assert.deepEqual(normalize(a),normalize(b),label);assert.equal(numericWordsHex(a),numericWordsHex(b),label+' ALLwords');}
function restore(p){assert.match(p.numericWordsF64leHex,/^(?:[0-9a-f]{16})*$/);const b=Buffer.from(p.numericWordsF64leHex,'hex');assert.ok(b.length<=512*1024);let at=0,nodes=0;function visit(x,d){assert.ok(++nodes<=262144&&d<=32);if(typeof x==='number'){assert.ok(at+8<=b.length);const n=b.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(n)&&n===x);return n;}if(Array.isArray(x))return x.map(v=>visit(v,d+1));if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,visit(v,d+1)]));return x;}const data=visit(p.data,0);assert.equal(at,b.length);return data;}
function load(path){freeze(path);assert.ok(pin(path).bytes<=2*1024*1024);return restore(JSON.parse(readFileSync(path,'utf8')));}
function pack(data){return{format:'post-normal-490-v1',data,numericWordsF64leHex:numericWordsHex(data)};}
function meta(error){return{name:error?.name??typeof error,code:error?.code??null,message:String(error?.message??error),details:error?.details??null,stack:error?.stack??null};}
function owner(world){return{state:world.getState(),model:world.getModel(),recording:null};}
try{
  freeze(process.execPath,'0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1');
  for(const path of [import.meta.filename,join(here,'NORMAL-490-CONTRACT.md'),join(here,'normal490-oracle.py'),join(here,'cases.mjs'),join(root,'examples/physics-model-input/model.mjs'),
    join(here,'baseline/first-long-490-02/PINS.json'),join(paid,'result.json'),join(paid,'inputs.json'),buildPath,python,
    '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python'])freeze(path);
  const first=JSON.parse(readFileSync(join(paid,'result.json'),'utf8')),build=JSON.parse(readFileSync(buildPath,'utf8'));
  assert.equal(first.status,'CONTACT_CONVERGENCE_NO_GO');assert.equal(first.sourceIntegrity,'PASS');assert.equal(first.buildManifest,buildPath);
  assert.equal(first.reports.source.cases['long-three'].acceptedSteps,489);assert.equal(first.reports.native.cases['long-three'].acceptedSteps,384);
  assert.equal(build.status,'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');assert.equal(build.firstFailure,null);assert.equal(build.sourceIntegrity,true);
  for(const[path,sha]of Object.entries(build.sourcePins))freeze(resolve(root,path),sha);
  const expected={source:new Map(),native:new Map()};
  for(const graph of ['source','native'])for(const[from,to]of[[0,32],[32,128],[128,256],[256,384]]){
    const data=load(join(paid,graph+'-long-three-'+from+'-'+to+'.json'));assert.equal(data.startStep,from);assert.equal(data.endStep,to);
    for(const state of data.states){const old=expected[graph].get(state.stepIndex);if(old)same(old,state,'paid overlap');else expected[graph].set(state.stepIndex,state);}}
  const refusal=load(join(paid,'source-long-three-refusal-490.json'));assert.equal(refusal.ownerUnchanged,true);same(refusal.before,refusal.after,'original refused owner');
  for(const state of refusal.states){const old=expected.source.get(state.stepIndex);if(old)same(old,state,'observed Source overlap');else expected.source.set(state.stepIndex,state);}
  assert.equal(expected.source.size,490);assert.equal(expected.native.size,385);
  const original=dirname(build.sourceEntry),originalPins=inventory(original);closure=join(out,'source-diagnostic-provider');charge(Object.values(originalPins).reduce((n,p)=>n+p.bytes,0));cpSync(original,closure,{recursive:true});
  if(!existsSync(join(closure,'package.json'))){const p=join(dirname(original),'package.json');freeze(p);charge(pin(p).bytes);copyFileSync(p,join(closure,'package.json'));}
  transform(join(closure,'stack/frictionless-island.js'),
    `const speed = finite(dot(sub(velocityAt(b, point.midpointM), velocityAt(a, point.midpointM)), geometry.planeNormalAtoB));
                need(speed >= -SI, 'fresh post contact normal feasibility');`,
    `const pointVelocityB = velocityAt(b, point.midpointM), pointVelocityA = velocityAt(a, point.midpointM);
                const relative = sub(pointVelocityB, pointVelocityA);
                const speed = finite(dot(relative, geometry.planeNormalAtoB));
                const feasible = speed >= -SI;
                if(!feasible && globalThis.__postNormal490?.armed)globalThis.__postNormal490.failedPostNormal ??= structuredClone({phase:'WORKING_AFTER_POSITION_BEFORE_RETURN',aIndex,bIndex,a,b,pointIndex:geometry.points.indexOf(point),point,geometry,normal:geometry.planeNormalAtoB,pointVelocityA,pointVelocityB,relative,speed,SI,predicate:feasible});
                need(feasible, 'fresh post contact normal feasibility');`);
  transform(join(closure,'world.js'),'const prepared = prepareFrictionlessIsland(next, pairs, { jointCount: joints.length });',
    `const prepared = (()=>{const o=globalThis.__postNormal490;if(!o?.armed)return prepareFrictionlessIsland(next,pairs,{jointCount:joints.length});
      o.capture=structuredClone({beforeBodies:bodies,freeBodies:next,pairs,context:{jointCount:joints.length},dt,acceptedStep:stepIndex,nextStep:stepIndex+1});o.captureIslandCalls++;
      try{const result=prepareFrictionlessIsland(next,pairs,{jointCount:joints.length});o.unexpectedCandidate=structuredClone(result);throw o.marker;}
      catch(caught){o.freeBodiesAfter=structuredClone(next);o.caught={name:caught?.name??typeof caught,code:caught?.code??null,message:String(caught?.message??caught),diagnostics:caught?.diagnostics??null,stack:caught?.stack??null};throw caught;}})();`);
  copyPins=inventory(closure);put('transforms.json',{original,originalPins,copy:closure,copyPins,changes,identity:'UNTRUSTED_DIAGNOSTIC_COPY'});
  put('inputs.json',{frozen,planned:{worlds:1,stepAttempts:490,returned:489,observedSourceFrames:490,availableNativeFrames:385,extraPrivateCalls:0,referenceCalls:1},source385to489IndependentlyQualified:false,native490:'NOT_RUN'});
  const api=await import(pathToFileURL(join(closure,'index.js'))),c=makeCases('long').find(x=>x.caseId==='long-three'),authored=structuredClone(c),world=api.createPhysicsWorld(c.model,c.options);worlds++;
  observer={armed:false,marker:Error('EXAMPLE_UNEXPECTED_490_CANDIDATE_RETURN'),captureIslandCalls:0,failedPostNormal:null};
  assert.equal(globalThis.__postNormal490,undefined);globalThis.__postNormal490=observer;
  try{
    for(let index=0;index<=489;index++){
      phase='observed-source-replay-'+index;time();const state=world.getState();same(state,expected.source.get(index),'observed Source frame '+index);sourceFrames++;
      if(index<=384){same(state,expected.native.get(index),'available Native frame '+index);nativeFrames++;}
      frameProof.push({step:index,wordsSHA256:createHash('sha256').update(Buffer.from(numericWordsHex(state),'hex')).digest('hex'),stateSHA256:createHash('sha256').update(JSON.stringify(normalize(state))).digest('hex')});
      if(index===489)break;attempts++;world.step([]);returned++;
    }
    phase='actual-attempt-490';same(world.getState(),refusal.before.state,'original cursor489');const before=owner(world);observer.armed=true;attempts++;
    let caught=null;try{world.step([]);returned++;}catch(error){caught=error;}
    const after=owner(world),snapshot=structuredClone({capture:observer.capture,caught:observer.caught,freeBodiesAfter:observer.freeBodiesAfter,failedPostNormal:observer.failedPostNormal,unexpectedCandidate:observer.unexpectedCandidate});
    const p=pack({caseId:'long-three-post-normal-490',model:c.model,options:c.options,before,after,observed:caught?meta(caught):null,observer:snapshot,
      observedSuffix:{startStep:384,endStep:489,states:refusal.states,qualifiesWindow:false}});put('actual-490.json',p);
    assert.ok(caught&&caught!==observer.marker);assert.ok(caught instanceof api.PhysicsError);assert.equal(caught.code,'NUMERIC_LIMIT');assert.equal(caught.message,'frictionless island: fresh post contact normal feasibility');
    same(before,after,'failed490 owner retained');same(observer.capture.freeBodies,observer.freeBodiesAfter,'actual FREE input retained');assert.deepEqual(c,authored);
    assert.equal(observer.captureIslandCalls,1);assert.equal(observer.capture.acceptedStep,489);assert.equal(observer.capture.nextStep,490);assert.ok(observer.failedPostNormal);
    assert.equal(observer.failedPostNormal.predicate,false);assert.equal(before.state.stepIndex,489);assert.equal(after.state.stepIndex,489);
    phase='independent-Hamilton-velocity-derivative';time();const wire=JSON.stringify(p)+'\n';assert.ok(Buffer.byteLength(wire)<=2*1024*1024);referenceCalls++;
    const child=spawnSync(python,['-B',join(here,'normal490-oracle.py')],{cwd:root,input:wire,encoding:'utf8',timeout:Math.max(1,Math.floor(deadline-Date.now())),maxBuffer:65536});
    put('normal-audit.stdout',Buffer.from(child.stdout??''));put('normal-audit.stderr',Buffer.from(child.stderr??''));assert.ok(child.status===0&&!child.error&&!child.signal&&!(child.stderr??'').length);
    audit=JSON.parse(child.stdout);assert.equal(audit.resolved,true);assert.equal(audit.executionFailure,false);assert.equal(audit.recordedFloatGuardRejects,true);
  }finally{delete globalThis.__postNormal490;world.dispose();}
  assert.equal(attempts,490);assert.equal(returned,489);assert.equal(sourceFrames,490);assert.equal(nativeFrames,385);
}catch(error){failure={phase,...meta(error)};process.exitCode=1;}
finally{
  delete globalThis.__postNormal490;
  try{for(const[path,expected]of Object.entries(frozen))assert.deepEqual(pin(resolve(root,path)),expected,'input changed '+path);if(copyPins)assert.deepEqual(inventory(closure),copyPins,'diagnostic copy changed');time();integrity='PASS';}
  catch(error){integrity='FAIL';failure??={phase:'final-authentication',...meta(error)};process.exitCode=1;}
  put('frame-proof.json',frameProof);put('result.json',{status:failure?'POST_NORMAL_490_DIAGNOSTIC_NO_GO':'POST_NORMAL_490_SOURCE_REFUSAL_CAPTURED_AND_AUDITED',failure,sourceIntegrity:integrity,
    worlds,stepAttempts:attempts,returnedSteps:returned,observedSourceFrameComparisons:sourceFrames,availableNativeFrameComparisons:nativeFrames,referenceCalls,
    observerCaptureIslandCalls:observer?.captureIslandCalls??0,extraPrivateCandidateCalls:0,normalSolverExtraCalls:0,positionSolverExtraCalls:0,compilerCalls:0,
    independentTrajectoryTransitionsAdded:0,public490Committed:false,native490:'NOT_RUN',audit,identityScope:'UNTRUSTED_DIAGNOSTIC_COPY',chargedBeforeFinalReceiptBytes:charged});
}
