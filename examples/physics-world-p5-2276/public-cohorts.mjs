/** Finite public API cohorts. Import is inert. No numerical module is imported here. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {clothMetrics} from '../physics-cloth-viewer/metrics.mjs';
import {checkVisualProfile,checkCadShelf,checkBareWorld} from '../physics-scene/fluid-release-criteria.mjs';
import {sha,raw,fingerprint,stateHash,p95,operate} from './public-values.mjs';
const profiles=['cloth-pinned-sphere-visual-v1','fluid-basin-visual-v1','fluid-basin-xsph-visual-v1','fluid-static-box-visual-v1'];
const near=(a,b)=>{assert.equal(a.length,b.length);let max=0;for(let i=0;i<a.length;i++){assert(Number.isFinite(a[i]));max=Math.max(max,Math.abs(a[i]-b[i]));}assert(max<=1e-12);return max;};
const domain=s=>s.cloths[0]??s.fluids[0];
const positionHash=s=>sha(raw(domain(s).positionsM));
function cursor(s,n){assert.equal(s.stepIndex,n);assert.equal(s.timeSeconds,n*(1/120));assert(s.identity);}
function physical(s){const d=domain(s);assert(d.positionsM.every(Number.isFinite)&&d.velocitiesMps.every(Number.isFinite));if(s.fluids.length)for(let i=0;i<256;i++)for(let axis=0;axis<3;axis++){const x=d.positionsM[i*3+axis];assert(x>=.0125-1e-9&&x<=[.7,1.3,.5][axis]-.0125+1e-9);}}
function speed95(s){const a=[];for(let i=0;i<256;i++)a.push(Math.hypot(...s.fluids[0].velocitiesMps.slice(i*3,i*3+3)));return p95(a);}
export async function qualifyPublic(c){
 const {provider:p,preset,oracle,recipe,write,ledger:L,hidden,arm,progress}=c;
 const owned=new Set();let getterReads=0;
 const make=input=>{const w=p.root.createPhysicsWorld(input.model,input.options);owned.add(w);return w;};
 const dispose=w=>{w.dispose();owned.delete(w);};
 const refusal=(fn,code)=>{let caught;try{fn();}catch(e){caught=e;}assert(caught instanceof p.root.PhysicsError,`canonical error ${code}: ${caught}`);assert.equal(caught.code,code);return caught;};
 const retain=(w,fn,code)=>{const before=fingerprint(hidden(w));const e=refusal(fn,code);assert.equal(fingerprint(hidden(w)),before,'whole accepted/definition/log retention');return e;};
 const snap=s=>({stepIndex:s.stepIndex,timeSeconds:s.timeSeconds,identity:s.identity,positionsSha256:positionHash(s),velocitiesSha256:sha(raw(domain(s).velocitiesMps)),rawStateFingerprint:stateHash(s),diagnostics:domain(s).diagnostics});
 try{
  assert.equal(p.root.PhysicsError,p.canonical.PhysicsError,'one root/domain/replay canonical class');
  // All malformed models precede all accepted initializers. Getter counters prove inert preflight.
  assert.equal(recipe.negativeModels.length,64);
  for(const r of recipe.negativeModels){const before=L.initializers;const input=operate(preset(r.profile),r.operations,preset,()=>getterReads++);refusal(()=>p.root.createPhysicsWorld(input.model,input.options),r.expected.code);L.creationRefusals++;assert.equal(L.initializers,before,r.id+' before initializer');assert.equal(getterReads,0);await progress(r.id);}
  await write('negative-models.json',{status:'PASS',count:64,getterReads,initializersBeforeRefusal:0});
  // Five genuine cloth Worlds. Every trajectory uses the same authenticated old stream.
  const clothResults=[];let referenceHash;
  for(let trial=0;trial<5;trial++){
   const w=make(preset(profiles[0])),model=w.getModel(),times=[],samples=[];assert.deepEqual(model.cloths[0].triangles.flat(),Array.from(oracle.getTriangles()));let peakSampled=0,peakExtension=0;
   for(let n=0;n<=240;n++){
    const start=performance.now(),s=n?w.step([]):w.getState();if(n&&trial>=2)times.push(performance.now()-start);cursor(s,n);
    const d=s.cloths[0],old=oracle.getFrame(n);near(d.positionsM,old.positionsM);near(d.velocitiesMps,old.velocitiesMps);
    if(trial===0){const m=clothMetrics(s,model);assert(m.passed);peakSampled=Math.max(peakSampled,m.sampledTrianglePenetrationM);peakExtension=Math.max(peakExtension,d.diagnostics.maxStructuralExtension);assert(d.diagnostics.maxStructuralExtension<=.10);assert(d.diagnostics.maxVertexPenetrationM<=1e-6);assert.equal(d.diagnostics.maxPinDriftM,0);assert(Math.abs(d.diagnostics.totalMassKg-.2)<=1e-14);}
    if([0,60,240].includes(n)){const historic=c.historicalCloth.reference.snapshots.find(x=>x.step===n);assert.equal(positionHash(s),historic.positionSha256,'original public cloth hash');for(const [key,value]of Object.entries(historic.diagnostics))assert(d.diagnostics[key]===value,'original cloth residual '+key);samples.push(snap(s));}if(n===240){if(trial===0)referenceHash=positionHash(s);else assert.equal(positionHash(s),referenceHash);}
    if(n&&n%60===0)await progress(`cloth-${trial}-${n}`);
   }
   if(trial===0)retain(w,()=>w.step([]),'WORLD_LIMIT');
   if(trial>=2)assert(p95(times)<=1000/120,'original per-trial cloth p95');
   clothResults.push({trial,kind:trial===0?'reference':trial===1?'warmup':'timed',steps:240,samples,peakSampled,peakExtension,p95StepMs:times.length?p95(times):null});dispose(w);
  }
  await write('cloth.json',{status:'PASS',trials:clothResults,independentOracleTolerance:1e-12});
  // Four interleaved ordinary/tuned trials and two tuned repeats: exactly 4320 accepted steps.
  const fluidResults=[],bareCheckpoints={};let retainedHeapDeltaBytes;
  const fluidInput=(high,tuned)=>{const input=preset(tuned?profiles[2]:profiles[1]);if(high){const a=[];for(let z=0;z<4;z++)for(let y=0;y<8;y++)for(let x=0;x<8;x++)a.push([.2+x*.05,.85+y*.05,.3+z*.05]);input.model.fluids[0].initialPositionsM=a;}return input;};
  // Import and copy all nominal inputs before the retained-heap baseline.
  const fluidInputs=[fluidInput(false,false),fluidInput(false,true),fluidInput(true,false),fluidInput(true,true)];
  for(const high of [false,true]){
   const a=make(fluidInputs[high?2:0]),b=make(fluidInputs[high?3:1]),ta=[],tb=[],states={};let baselineHeapBytes;
   if(!high){assert.equal(typeof global.gc,'function','--expose-gc required');global.gc();baselineHeapBytes=process.memoryUsage().heapUsed;}
   let final;
   for(let n=1;n<=720;n++){
    const call=(w,times)=>{const start=performance.now(),s=w.step([]);times.push(performance.now()-start);cursor(s,n);physical(s);return s;};let sa,sb;
    if(n%2){sa=call(a,ta);sb=call(b,tb);}else{sb=call(b,tb);sa=call(a,ta);}final=sb;
    if([60,240,720].includes(n)){
     states[n]={originalSHA:positionHash(sa),tunedSHA:positionHash(sb),originalSpeed95:speed95(sa),tunedSpeed95:speed95(sb),originalDensityError:sa.fluids[0].diagnostics.meanAbsoluteDensityError,tunedDensityError:sb.fluids[0].diagnostics.meanAbsoluteDensityError};
     await write(`fluid-${high?'high':'low'}-${n}-raw.bin`,Buffer.concat([raw(sa.fluids[0].positionsM),raw(sa.fluids[0].velocitiesMps),raw(sb.fluids[0].positionsM),raw(sb.fluids[0].velocitiesMps)]));
     if(!high){bareCheckpoints[n]=snap(sa);if(n===60||n===240){assert(sa.fluids[0].diagnostics.meanAbsoluteDensityError<=(n===60?.25:.05));assert(sa.fluids[0].diagnostics.p95Compression<=.05);}}
    }
    if(n%60===0)await progress(`fluid-${high}-${n}`);
   }
   assert(states[720].tunedSpeed95<=(high?.029:.020));assert(states[240].tunedDensityError<=(high?.033:.026));if(high)assert(states[60].tunedSpeed95>=3.25);
   const result={high,states,originalP95:p95(ta),tunedP95:p95(tb),costRatio:p95(tb)/p95(ta)};assert(result.costRatio<=1.5);
   const finalBits=fingerprint(final);dispose(a);dispose(b);
   if(!high){global.gc();retainedHeapDeltaBytes=process.memoryUsage().heapUsed-baselineHeapBytes;assert(retainedHeapDeltaBytes<=1048576,'retained heap <=1MiB');}
   const repeat=make(fluidInput(high,true));let repeated;for(let n=1;n<=720;n++){repeated=repeat.step([]);if(n%60===0)await progress(`fluid-repeat-${high}-${n}`);}assert.equal(fingerprint(repeated),finalBits,'raw full tuned repeat');dispose(repeat);fluidResults.push(result);
  }
  checkVisualProfile({result:'ok',fixtures:fluidResults});checkBareWorld({result:'ok',count:256,steps:240,finalPositionSha256:bareCheckpoints[240].positionsSha256,copiedAndInvalidRetained:true,densityError60:bareCheckpoints[60].diagnostics.meanAbsoluteDensityError,densityError240:bareCheckpoints[240].diagnostics.meanAbsoluteDensityError,retainedHeapDeltaBytes});
  await write('fluid.json',{status:'PASS',fixtures:fluidResults,bareCheckpoints,retainedHeapDeltaBytes});
  // Actual optional CAD data admission. The numeric root itself remains CAD-free.
  const source=c.shelfSource,request={sourceVersion:0,sourceRevision:'shelfRev1',modelId:'fluid_shelf',surfaceId:'shelf',kind:'static',proxy:'box',minimumHalfExtentM:.01};
  const base=preset(profiles[1]),target=preset(profiles[3]).options;
  const admitted=p.cad.admitCadFluidStaticData(base.model,target,source,request);
  const proxy=admitted.proxy;assert.equal(proxy.body.id,'fixture:fluid_shelf.shelf');assert.deepEqual(proxy.body.initial.positionM,[.35,.2,.25]);assert.deepEqual(proxy.collider.geometry.halfExtentsM,[.15,.01,.15]);assert.match(proxy.binding.approximation.lossLabel,/not the collision shape/);
  for(const [input,req]of [[base.model,{...request,minimumHalfExtentM:1}],[base.model,{...request,kind:'dynamic',massKg:1}],[base.model,{...request,initialOffsetM:[0,0,0]}],[(()=>{const x=preset(profiles[1]).model;x.fluids[0].initialPositionsM[0]=[.3,.2,.3];return x;})(),request]])refusal(()=>p.cad.admitCadFluidStaticData(input,target,source,req),'INVALID_CONFIG');
  const shelf=make({model:admitted.model,options:target}),bare=make(preset(profiles[1])),ts=[],tb=[],receipts=[];let hits=0;
  for(const [text,revision]of [[source,'shelfRev2'],[source+'\n','shelfRev1'],[undefined,undefined]]){const before=L.stepEntries;retain(shelf,()=>p.cad.assertCadProxyCurrent(proxy,text,revision),'STALE_SOURCE');assert.equal(L.stepEntries,before);}
  function geometry(s){const d=s.fluids[0];for(let i=0;i<256;i++)assert(![0,1,2].every(axis=>{const x=d.positionsM[3*i+axis],centre=proxy.body.initial.positionM[axis],half=proxy.collider.geometry.halfExtentsM[axis];return x>centre-half-.0125+1e-9&&x<centre+half+.0125-1e-9;}),'no inflated box penetration');}
  for(let n=1;n<=240;n++){
   const start=performance.now(),b=bare.step([]);tb.push(performance.now()-start);const mark=performance.now();p.cad.assertCadProxyCurrent(proxy,source,'shelfRev1');const s=shelf.step([]);ts.push(performance.now()-mark);physical(s);geometry(s);hits+=s.fluids[0].diagnostics.obstacleHits;
   if([60,240].includes(n)){const r={step:n,bareSHA:positionHash(b),shelfSHA:positionHash(s),cumulativeShelfHits:hits,diagnostics:s.fluids[0].diagnostics};assert.equal(r.bareSHA,bareCheckpoints[n].positionsSha256);assert.notEqual(r.bareSHA,r.shelfSHA);receipts.push(r);await write(`shelf-${n}-raw.bin`,Buffer.concat([raw(s.fluids[0].positionsM),raw(s.fluids[0].velocitiesMps)]));}if(n%60===0)await progress(`shelf-${n}`);
  }
  const shelfFinal=fingerprint(shelf.getState());dispose(shelf);dispose(bare);const repeatShelf=make({model:admitted.model,options:target});let repeatedShelf;for(let n=1;n<=240;n++){p.cad.assertCadProxyCurrent(proxy,source,'shelfRev1');repeatedShelf=repeatShelf.step([]);geometry(repeatedShelf);if(n%60===0)await progress(`shelf-repeat-${n}`);}assert.equal(fingerprint(repeatedShelf),shelfFinal);dispose(repeatShelf);
  const shelfResult={result:'ok',obstacle:proxy.body.id,receipts,bareP95:p95(tb),shelfP95:p95(ts),costRatio:p95(ts)/p95(tb)};checkCadShelf(shelfResult);await write('shelf.json',shelfResult);
  // Four retained never-failed controls; twelve separately constructed fault Worlds.
  const atomic=[];
  for(const profile of profiles){
   const input=preset(profile),control=make(input),initial=fingerprint(hidden(control));
   for(let i=0;i<2;i++)retain(control,()=>{L.domainRecorderAttachAttempts++;return p.replay.createPhysicsRecorder(control);},profile===profiles[0]?'WORLD_LIMIT':'INVALID_SNAPSHOT');
   assert.equal(fingerprint(hidden(control)),initial);const s1=control.step([]),s2=control.step([]),targetBits=fingerprint(s2),hiddenTarget=fingerprint(hidden(control));
   for(const [index,site]of ['mid-kernel','post-diagnostic','public-copy'].entries()){
    const w=make(preset(profile));assert.equal(fingerprint(w.step([])),fingerprint(s1));const before=fingerprint(hidden(w)),error=new Error(`PUBLIC_SYNTHETIC:${profile}:${site}`);arm(site,error);let caught;try{w.step([]);}catch(e){caught=e;}assert.equal(caught,error);L.syntheticFailures++;assert.equal(fingerprint(hidden(w)),before,'retained full accepted and solver continuation');
    if(index===0){arm('numeric',null);const e=retain(w,()=>w.step([]),'NUMERIC_LIMIT');L.typedNumericControls++;assert.equal(e.details.operation,'step');assert.equal(e.details.phase,'validation');assert.equal(e.details.domain,profile===profiles[0]?'cloth':'fluid');assert.deepEqual(e.details.accepted,{stepIndex:1,timeSeconds:1/120});assert(e.details.entityIds.includes((input.model.cloths[0]??input.model.fluids[0]).id));}
    const recovered=w.step([]);assert.equal(fingerprint(recovered),targetBits);assert.equal(fingerprint(hidden(w)),hiddenTarget);const acceptedBefore=fingerprint(hidden(w));domain(recovered).positionsM[0]=123;domain(recovered).velocitiesMps[0]=456;domain(recovered).diagnostics[Object.keys(domain(recovered).diagnostics)[0]]=789;assert.equal(fingerprint(hidden(w)),acceptedBefore,'returned output ownership');atomic.push({profile,site,exactThrownIdentity:true,stateFingerprint:sha(before),recoveredFingerprint:sha(targetBits)});dispose(w);
   }
   const accepted=fingerprint(hidden(control));
   for(const command of recipe.commands){let payload=structuredClone(command.argument);if(Array.isArray(payload))for(const v of payload)if(v.bodyId==='$staticBodyId')v.bodyId=input.model.bodies[0].id;payload=operate(payload,command.operations??[],preset,()=>getterReads++);const kernelBefore=L.solverReturns;retain(control,()=>control.step(payload),command.expected.code);assert.equal(L.solverReturns,kernelBefore,'commands rejected before solver');}
   assert.equal(fingerprint(hidden(control)),accepted);
   for(const q of recipe.queryArguments){L.domainQueries++;retain(control,()=>control.query(structuredClone(q)),'INVALID_QUERY');}
   const externalModel=control.getModel(),externalState=control.getState(),externalBits=fingerprint([externalModel,externalState]);externalModel.revision='externalCopy';domain(externalState).positionsM[0]=123;assert.equal(fingerprint(hidden(control)),accepted);
   dispose(control);control.dispose();assert.equal(hidden(control).domainState,null);assert.equal(hidden(control).modelCopy,null);refusal(()=>control.getState(),'DISPOSED');L.disposedReadRefusals++;assert.notEqual(fingerprint([externalModel,externalState]),externalBits);await progress(`atomic-${profile}`);
  }
  assert.equal(getterReads,0);await write('atomic.json',{status:'PASS',cases:atomic,typedNumericControls:4,externalCopiesSurviveDispose:true,forcedGCClaim:false});
  // Actual shared registry + cached common step ownership + prepare-before-commit log control.
  const rc=make(structuredClone(recipe.rigidFixture)),rw=make(structuredClone(recipe.rigidFixture)),cached=rw.step;
  rc.step([]);const rigidTarget=rc.step([]);L.rigidRecorderAttachAttempts++;const rec=p.replay.createPhysicsRecorder(rw);
  for(const w of [rw,rw]){L.rigidRecorderAttachAttempts++;refusal(()=>p.replay.createPhysicsRecorder(w),'WORLD_OWNED');}
  retain(rw,()=>rw.step([]),'WORLD_OWNED');retain(rw,()=>cached([]),'WORLD_OWNED');rec.step([]);L.rigidRecorderSaveCalls++;const firstLog=rec.saveRecording(),rigidBefore=fingerprint(hidden(rw));const logError=new Error('PUBLIC_SYNTHETIC:rigid:log-prepare');arm('log-prepare',logError);let logCaught;try{rec.step([]);}catch(e){logCaught=e;}assert.equal(logCaught,logError);L.syntheticFailures++;assert.equal(fingerprint(hidden(rw)),rigidBefore);L.rigidRecorderSaveCalls++;assert.equal(fingerprint(rec.saveRecording()),fingerprint(firstLog));assert.equal(fingerprint(rec.step([])),fingerprint(rigidTarget));retain(rw,()=>rec.step([{kind:'unknown'}]),'INVALID_COMMAND');L.rigidRecorderSaveCalls++;assert.equal(rec.saveRecording().frames.length,2);rec.dispose();dispose(rw);dispose(rc);await write('rigid-owner.json',{status:'PASS',exactLogErrorIdentity:true,sharedOwnerRegistry:true,saveCalls:3,wireOrRestoreCalls:0});
  // Real host seam:2 successful steps,1 accepted shadow on external failure,reset pair,2 steps.
  const submitError=new Error('PUBLIC_SYNTHETIC:Viewer-submit');let failSubmit=false;
  const viewer={setClothFrame(frame){if(failSubmit&&frame){failSubmit=false;L.hostExternalSubmitFailures++;throw submitError;}}};
  const host=p.createHostController(viewer);const h1=host.step();near(h1.state.cloths[0].positionsM,oracle.getFrame(1).positionsM);const beforeHost=host.getSnapshot();failSubmit=true;let hostCaught;try{host.step();}catch(e){hostCaught=e;}assert.equal(hostCaught,submitError);const failedHost=host.getSnapshot();assert.equal(fingerprint(failedHost.state),fingerprint(beforeHost.state));assert.equal(failedHost.displayStep,1);assert.equal(failedHost.needsReset,true);const reset=host.reset();assert.equal(reset.state.stepIndex,0);const h2=host.step();near(h2.state.cloths[0].positionsM,oracle.getFrame(1).positionsM);host.dispose();await write('headless-host.json',{status:'PASS',actualHostController:true,externalSubmitFailure:true,Worlds:4,steps:5,browser:'NOT_RUN'});
  const shifted=preset(profiles[1]);shifted.model.fluids[0].initialPositionsM[0][0]+=.005;const sw=make(shifted);assert.equal(sw.getState().fluids[0].positionsM[0],.2+.005);dispose(sw);
  assert.equal(owned.size,0);return {status:'PASS_PUBLIC_P5B_BOUNDED_QUALIFICATION',getterReads,cloth:clothResults,fluid:fluidResults,shelf:shelfResult};
 }catch(error){c.captureFailure(error);throw error;}finally{for(const w of owned){try{w.dispose();}catch{}}}
}
