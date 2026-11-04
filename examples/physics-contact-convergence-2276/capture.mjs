// Root-only diagnostic-copy replay. No production hooks, repair, compiler or fallback.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {cpSync,copyFileSync,existsSync,mkdirSync,openSync,readSync,closeSync,readFileSync,
  readdirSync,writeFileSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeCases,numericWordsHex} from './cases.mjs';

const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];
assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===3);
const paid=join(here,'evidence/long-01'),buildPath=join(root,'examples/physics-anisotropic-inertia-2276/evidence/public-build-02/result.json');
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13';
const out=join(here,'evidence',id);mkdirSync(out);
const deadline=Date.now()+170000,frozen={},transforms=[],frameProof=[];
let charged=0,worlds=0,attempts=0,returned=0,sourceComparisons=0,nativeComparisons=0;
let phase='authenticate',failure=null,integrity='NOT_RUN',closure=null,copyPins=null,observer=null,audit=null,referenceCalls=0;
function pin(path){const fd=openSync(path,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);let bytes=0;
  try{let n;while((n=readSync(fd,b,0,b.length,null))){h.update(b.subarray(0,n));bytes+=n;}}finally{closeSync(fd);}
  return{bytes,sha256:h.digest('hex')};}
function freeze(path,sha){const p=pin(path);if(sha)assert.equal(p.sha256,sha);frozen[relative(root,path)]=p;}
function time(){assert.ok(Date.now()<deadline,'one170s includes replay/reference/cleanup/auth');}
function charge(bytes){charged+=bytes;assert.ok(charged<=16*1024*1024,'16MiB including diagnostic closure');}
function save(name,value){const bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)+'\n');
  assert.ok(bytes.length<=2*1024*1024,'2MiB artifact');charge(bytes.length);writeFileSync(join(out,name),bytes,{flag:'wx'});}
function inventory(dir){const result={};function visit(at){for(const entry of readdirSync(at,{withFileTypes:true})){
  assert.ok(!entry.isSymbolicLink());const path=join(at,entry.name);if(entry.isDirectory())visit(path);else result[relative(dir,path)]=pin(path);}}
  visit(dir);return result;}
function replace(path,needle,replacement){const before=readFileSync(path,'utf8');assert.equal(before.split(needle).length,2,'unique exact source needle '+path);
  const after=before.replace(needle,replacement);charge(Math.max(0,Buffer.byteLength(after)-Buffer.byteLength(before)));
  writeFileSync(path,after);transforms.push({file:relative(closure,path),needle,replacement,beforeSHA256:createHash('sha256').update(before).digest('hex'),afterSHA256:pin(path).sha256});}
const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([key,value])=>
  [key,key==='providerDigest'&&typeof value==='string'?'UNTRUSTED_DIAGNOSTIC_COPY':normalize(value)])):x;
function equalWords(a,b,label){assert.deepEqual(normalize(a),normalize(b),label);assert.equal(numericWordsHex(a),numericWordsHex(b),label+' ALLwords');}
function restore(packet){assert.match(packet.numericWordsF64leHex,/^(?:[0-9a-f]{16})*$/);const bytes=Buffer.from(packet.numericWordsF64leHex,'hex');
  assert.ok(bytes.length<=512*1024);let at=0,nodes=0;function visit(value,depth){assert.ok(++nodes<=262144&&depth<=32);
    if(typeof value==='number'){assert.ok(at+8<=bytes.length);const actual=bytes.readDoubleLE(at);at+=8;assert.ok(Number.isFinite(actual)&&actual===value);return actual;}
    if(Array.isArray(value))return value.map(x=>visit(x,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,x])=>[key,visit(x,depth+1)]));return value;}
  const data=visit(packet.data,0);assert.equal(at,bytes.length);return data;}
function load(path){freeze(path);assert.ok(pin(path).bytes<=2*1024*1024);return restore(JSON.parse(readFileSync(path,'utf8')));}
function packet(data){return{format:'contact-witness-479-v1',data,numericWordsF64leHex:numericWordsHex(data)};}
function metadata(error){return{name:error?.name??typeof error,code:error?.code??null,message:String(error?.message??error),stack:error?.stack??null};}
function owner(world){return{state:world.getState(),model:world.getModel(),recording:null};}

try{
  freeze(process.execPath,'0d005c18e095027ca8f9fe1cc1126f767ee4ad7b004f4d6fb781ec4228a7c5d1');
  for(const path of [import.meta.filename,join(here,'FAILURE-479-CONTRACT.md'),join(here,'analysis.md'),join(here,'witness-oracle.py'),
    join(here,'cases.mjs'),join(root,'examples/physics-model-input/model.mjs'),join(here,'baseline/first-long-479-01/PINS.json'),
    join(paid,'result.json'),join(paid,'inputs.json'),buildPath,python,
    '/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/Python'])freeze(path);
  const first=JSON.parse(readFileSync(join(paid,'result.json'),'utf8')),build=JSON.parse(readFileSync(buildPath,'utf8'));
  assert.equal(first.status,'CONTACT_CONVERGENCE_NO_GO');assert.equal(first.sourceIntegrity,'PASS');
  assert.equal(first.reports.source.cases['long-three'].acceptedSteps,478);
  assert.equal(first.reports.native.cases['long-three'].acceptedSteps,384);
  assert.equal(build.status,'PUBLIC_WORLD_SOURCE_AND_ACTUAL_CANONICAL_PREPARED');assert.equal(build.firstFailure,null);
  const original=dirname(build.sourceEntry);for(const[path,sha]of Object.entries(build.sourcePins))freeze(resolve(root,path),sha);
  const originalPins=inventory(original),expected={source:new Map(),native:new Map()};
  for(const graph of ['source','native'])for(const[from,to]of[[0,32],[32,128],[128,256],[256,384]]){
    const data=load(join(paid,graph+'-long-three-'+from+'-'+to+'.json'));assert.equal(data.startStep,from);assert.equal(data.endStep,to);
    for(const state of data.states){const old=expected[graph].get(state.stepIndex);if(old)equalWords(old,state,'paid window overlap');else expected[graph].set(state.stepIndex,state);}}
  const refused=load(join(paid,'source-long-three-refusal-479.json'));
  assert.equal(refused.ownerUnchanged,true);equalWords(refused.before,refused.after,'original refused owner');
  for(const state of refused.states){const old=expected.source.get(state.stepIndex);if(old)equalWords(old,state,'paid source refusal overlap');else expected.source.set(state.stepIndex,state);}
  assert.equal(expected.source.size,479);assert.equal(expected.native.size,385);
  closure=join(out,'source-diagnostic-provider');const bytes=Object.values(originalPins).reduce((n,p)=>n+p.bytes,0);charge(bytes);
  cpSync(original,closure,{recursive:true});if(!existsSync(join(closure,'package.json'))){const packagePath=join(dirname(original),'package.json');freeze(packagePath);charge(pin(packagePath).bytes);copyFileSync(packagePath,join(closure,'package.json'));}
  const geometry=join(closure,'stack/geometry.js'),witness=join(closure,'stack/witness.js'),face=join(closure,'stack/face-contact.js'),worldPath=join(closure,'world.js');
  replace(geometry,'export function featureContact(a, b) {',`export function featureContact(a, b) {
    if (globalThis.__contactWitness479?.armed) { const o=globalThis.__contactWitness479; o.currentPair={a,b}; o.lastPoint=null; o.featureFailure=null; o.faceContext=null; o.facePoint=null; o.faceCertification=null; o.faceFailure=null; o.pointFailure=null; }`);
  replace(geometry,'return local.every((v, i) => Number.isFinite(v) && Math.abs(v) <= e[i] + WITNESS_TOLERANCE_M);',
    `const observedInside = local.every((v, i) => Number.isFinite(v) && Math.abs(v) <= e[i] + WITNESS_TOLERANCE_M);
    if (!observedInside && globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.failedWitness ??= {body,witness:w,local,extents:e,toleranceM:WITNESS_TOLERANCE_M};
    return observedInside;`);
  replace(geometry,"const geometry = selection.feature.kind === 'edge-cross' ? edgeContact(a, b, selection) : faceContact(a, b, selection);",
    `let geometry; try { geometry = selection.feature.kind === 'edge-cross' ? edgeContact(a, b, selection) : faceContact(a, b, selection); }
    catch (caught) { if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.featureFailure={site:'FACE_OR_EDGE_CONSTRUCTION',a,b,selection,error:{name:caught?.name,code:caught?.code??null,message:String(caught?.message??caught),stack:caught?.stack??null}}; throw caught; }`);
  replace(geometry,`if (!geometry.points.length || geometry.points.some(p => !witnessInside(a, p.witnessAM) || !witnessInside(b, p.witnessBM)))
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `if (!geometry.points.length || geometry.points.some(p => !witnessInside(a, p.witnessAM) || !witnessInside(b, p.witnessBM))) {
        if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.featureFailure={site:'FINAL_BOX_WITNESS',a,b,selection,geometry};
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);
    }`);
  replace(witness,'    if (![...a, ...b, ...result.midpointM, gap, result.pointPenetrationM].every(Number.isFinite)',
    `    if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.lastPoint={key,a,b,normal:n,gap,result};
    if (![...a, ...b, ...result.midpointM, gap, result.pointPenetrationM].every(Number.isFinite)`);
  replace(witness,`|| gap > WITNESS_TOLERANCE_M)
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `|| gap > WITNESS_TOLERANCE_M) {
        if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.pointFailure={site:'POINT_GAP_OR_NONFINITE',key,a,b,normal:n,gap,result};
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);
    }`);
  replace(face,`    if (!candidates.length)
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `    if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.faceContext={a,b,selection,referenceId:ref.id,incidentId:inc.id,axis,side,incidentAxis,incidentSide,n,centre,poly,candidates};
    if (!candidates.length) {
        if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.faceFailure={site:'EMPTY_CANDIDATES'};
        error('NUMERIC_LIMIT', WITNESS_MESSAGE);
    }`);
  replace(face,'    const interior = scale(candidates.reduce',`    if (globalThis.__contactWitness479?.armed) Object.assign(globalThis.__contactWitness479.faceContext,{referencePlane,incidentPlane,faceA,faceB});
    const interior = scale(candidates.reduce`);
  replace(face,'            const certified = (candidate) => exact.check(candidate.midpointM)\n                && exact.selectedFaceBounds(candidate.midpointM, faceA, faceB)\n                && exact.onFace(0, faceA, candidate.witnessAM) && exact.onFace(1, faceB, candidate.witnessBM);',
    `            if (globalThis.__contactWitness479?.armed) globalThis.__contactWitness479.facePoint={index:i,original,lastCandidate:original,roundingStep:0};
            const certified = (candidate) => {
                const o=globalThis.__contactWitness479, trace={candidate,check:null,selectedFaceBounds:null,onFaceA:null,onFaceB:null,started:'check'};
                if(o?.armed)o.faceCertification=trace;
                let answer=trace.check=exact.check(candidate.midpointM);
                if(answer){trace.started='selectedFaceBounds';answer=trace.selectedFaceBounds=exact.selectedFaceBounds(candidate.midpointM,faceA,faceB);}
                if(answer){trace.started='onFaceA';answer=trace.onFaceA=exact.onFace(0,faceA,candidate.witnessAM);}
                if(answer){trace.started='onFaceB';answer=trace.onFaceB=exact.onFace(1,faceB,candidate.witnessBM);}
                trace.started='returned';trace.answer=answer;return answer;
            };`);
  replace(face,'                const candidate = point(original.key, witnessA, witnessB, planeNormalAtoB);',
    `                if(globalThis.__contactWitness479?.armed)Object.assign(globalThis.__contactWitness479.facePoint,{seed,roundingStep:step});
                const candidate = point(original.key, witnessA, witnessB, planeNormalAtoB);
                if(globalThis.__contactWitness479?.armed)globalThis.__contactWitness479.facePoint.lastCandidate=candidate;`);
  replace(face,`                if (!exact.movementWithin(original.witnessAM, candidate.witnessAM)
                    || !exact.movementWithin(original.witnessBM, candidate.witnessBM)
                    || !exact.movementWithin(original.midpointM, candidate.midpointM))
                    error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `                let withinA,withinB,withinMid;
                if (!(withinA=exact.movementWithin(original.witnessAM,candidate.witnessAM))
                    || !(withinB=exact.movementWithin(original.witnessBM,candidate.witnessBM))
                    || !(withinMid=exact.movementWithin(original.midpointM,candidate.midpointM))) {
                    if(globalThis.__contactWitness479?.armed)globalThis.__contactWitness479.faceFailure={site:'MOVEMENT_WITHIN',withinA:withinA??null,withinB:withinB??null,withinMid:withinMid??null};
                    error('NUMERIC_LIMIT', WITNESS_MESSAGE);
                }`);
  replace(face,`            }
            error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `            }
            if(globalThis.__contactWitness479?.armed)globalThis.__contactWitness479.faceFailure={site:'ROUNDING_EXHAUSTED'};
            error('NUMERIC_LIMIT', WITNESS_MESSAGE);`);
  replace(face,`        if (caught instanceof StrictLineFailure)
            error('NUMERIC_LIMIT', WITNESS_MESSAGE);`,
    `        if (caught instanceof StrictLineFailure) {
            if(globalThis.__contactWitness479?.armed)globalThis.__contactWitness479.faceFailure={site:'STRICT_LINE_FAILURE',error:{name:caught.name,code:caught.code??null,message:caught.message}};
            error('NUMERIC_LIMIT', WITNESS_MESSAGE);
        }`);
  replace(worldPath,'const prepared = prepareFrictionlessIsland(next, pairs, { jointCount: joints.length });',
    `const prepared = (()=>{const o=globalThis.__contactWitness479;if(!o?.armed)return prepareFrictionlessIsland(next,pairs,{jointCount:joints.length});
      o.capture=structuredClone({beforeBodies:bodies,freeBodies:next,pairs,context:{jointCount:joints.length},dt,acceptedStep:stepIndex,nextStep:stepIndex+1});o.captureIslandCalls++;
      try{const value=prepareFrictionlessIsland(next,pairs,{jointCount:joints.length});o.unexpectedCandidate=structuredClone(value);throw o.marker;}
      catch(caught){o.freeBodiesAfter=structuredClone(next);o.caught={name:caught?.name??typeof caught,code:caught?.code??null,message:String(caught?.message??caught),stack:caught?.stack??null,diagnostics:caught?.diagnostics??null};throw caught;}})();`);
  copyPins=inventory(closure);save('transforms.json',{original,originalPins,copy:closure,transforms,copyPins,identity:'UNTRUSTED_DIAGNOSTIC_COPY'});
  save('inputs.json',{frozen,planned:{sourceWorlds:1,stepAttempts:479,returned:478,nativeWorlds:0,additionalPrivateCalls:0,referenceCalls:1}});
  const api=await import(pathToFileURL(join(closure,'index.js'))),c=makeCases('long').find(c=>c.caseId==='long-three');
  const authored=structuredClone(c),world=api.createPhysicsWorld(c.model,c.options);worlds++;
  observer={armed:false,marker:Error('EXAMPLE_UNEXPECTED_479_CANDIDATE_RETURN'),captureIslandCalls:0,failedWitness:null,featureFailure:null,lastPoint:null};
  assert.equal(globalThis.__contactWitness479,undefined);globalThis.__contactWitness479=observer;
  let before,after,observed;
  try{
    for(let index=0;index<=478;index++){
      phase='replay-source-'+index;time();const actual=world.getState();equalWords(actual,expected.source.get(index),'paid Source prefix '+index);sourceComparisons++;
      if(index<=384){equalWords(actual,expected.native.get(index),'paid Native available prefix '+index);nativeComparisons++;}
      frameProof.push({step:index,numericSHA256:createHash('sha256').update(Buffer.from(numericWordsHex(actual),'hex')).digest('hex'),
        stateSHA256:createHash('sha256').update(JSON.stringify(normalize(actual))).digest('hex')});
      if(index===478)break;
      attempts++;world.step([]);returned++;
    }
    equalWords(world.getState(),refused.before.state,'original refused Source cursor478');
    phase='actual-attempt-479';before=owner(world);observer.armed=true;attempts++;
    let caughtError=null;try{world.step([]);returned++;}catch(error){caughtError=error;observed=metadata(error);}
    after=owner(world);
    const snapshot=structuredClone({capture:observer.capture,caught:observer.caught,currentPair:observer.currentPair,
      freeBodiesAfter:observer.freeBodiesAfter,unexpectedCandidate:observer.unexpectedCandidate,
      failedWitness:observer.failedWitness,featureFailure:observer.featureFailure,lastPoint:observer.lastPoint,
      faceContext:observer.faceContext,facePoint:observer.facePoint,faceCertification:observer.faceCertification,
      faceFailure:observer.faceFailure,pointFailure:observer.pointFailure});
    const p=packet({caseId:'long-three-479',model:c.model,options:c.options,before,after,observed,observer:snapshot});save('actual-479.json',p);
    assert.ok(caughtError);assert.notEqual(caughtError,observer.marker,'unexpected candidate returned');
    assert.ok(caughtError instanceof api.PhysicsError);assert.equal(caughtError.code,'NUMERIC_LIMIT');
    assert.equal(caughtError.message,'private feature contact requires valid box witnesses');
    equalWords(after,before,'attempt479 owner retained');assert.deepEqual(c,authored);
    assert.equal(observer.captureIslandCalls,1);assert.equal(observer.capture.acceptedStep,478);assert.equal(observer.capture.nextStep,479);
    equalWords(observer.capture.freeBodies,observer.freeBodiesAfter,'actual FREE input retained');
    phase='independent-Fraction-audit';time();const wire=JSON.stringify(p)+'\n';assert.ok(Buffer.byteLength(wire)<=2*1024*1024);
    referenceCalls++;const child=spawnSync(python,['-B',join(here,'witness-oracle.py')],{cwd:root,input:wire,encoding:'utf8',timeout:Math.max(1,Math.floor(deadline-Date.now())),maxBuffer:65536});
    save('witness-audit.stdout',Buffer.from(child.stdout??''));save('witness-audit.stderr',Buffer.from(child.stderr??''));
    assert.ok(child.status===0&&!child.error&&!child.signal&&!(child.stderr??'').length,'Fraction audit execution');audit=JSON.parse(child.stdout);
    assert.equal(audit.resolved,true);assert.equal(audit.executionFailure,false);assert.equal(audit.pointAvailable,true,'exact failed/latest point unavailable');
  }finally{delete globalThis.__contactWitness479;world.dispose();}
  assert.equal(attempts,479);assert.equal(returned,478);assert.equal(sourceComparisons,479);assert.equal(nativeComparisons,385);
}catch(error){failure={phase,...metadata(error)};process.exitCode=1;}
finally{
  delete globalThis.__contactWitness479;
  try{for(const[path,expected]of Object.entries(frozen))assert.deepEqual(pin(resolve(root,path)),expected,'original input changed '+path);
    if(copyPins)assert.deepEqual(inventory(closure),copyPins,'diagnostic copy changed');time();integrity='PASS';}
  catch(error){integrity='FAIL';failure??={phase:'final-authentication',...metadata(error)};process.exitCode=1;}
  save('frame-proof.json',frameProof);
  save('result.json',{status:failure?'CONTACT_479_DIAGNOSTIC_NO_GO':'CONTACT_479_SOURCE_REFUSAL_CAPTURED_AND_AUDITED',failure,sourceIntegrity:integrity,
    worlds,stepAttempts:attempts,returnedSteps:returned,paidSourceFrameComparisons:sourceComparisons,paidNativeFrameComparisons:nativeComparisons,
    additionalPrivateCandidateCalls:0,referenceCalls,observerCaptureIslandCalls:observer?.captureIslandCalls??0,
    audit,native479:'NOT_RUN',physicalWorldAcceptance479:false,identityScope:'UNTRUSTED_DIAGNOSTIC_COPY',compilerCalls:0,chargedBeforeFinalReceiptBytes:charged});
}
