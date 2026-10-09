import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPhysicsWorld} from '@barocss/physics';
import {buildConfig} from './fixture.mjs';
import {createScene} from './scene.mjs';
import {diagnostics,referenceControls,segmentBoxDistance} from './metrics.mjs';
const dt=1/120,hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const bodyHash=s=>{const data=new Float64Array(s.bodies.flatMap(b=>[...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps]));return hash(Buffer.from(data.buffer));};
function run(name,timed=false,save=false){
 const fixture=buildConfig(name),beforeConfig=hash(fixture),start=performance.now(),scene=createScene(name),setupMs=performance.now()-start,initial=scene.getState(),initialActor=initial.bodies.find(b=>b.id==='actor'),samples=[],times=[],maxima={},firstViolations=[];
 assert.deepEqual(initialActor.inertiaDiagonalKgM2,[.1,.1,.1]);let crossedStep=false,freeFlightMaxError=0,preContact=true,contactSteps=0,maxPositiveProgressM=0,last=null;
 function inspect(state){const d=diagnostics(state,fixture.geometry.floorPlane);for(const [key,value]of Object.entries(d))if(typeof value==='number')maxima[key]=Math.max(maxima[key]??0,key==='supportPlaneGapM'?Math.abs(value):value);
 const gates={finite:d.finite,position:d.maxPositionM<=5,velocity:d.maxVelocityMps<=100,quaternion:d.quaternionNormError<=1e-10,overlap:d.maxOverlapLowerBoundM<=.005,tilt:d.capsuleAxisTiltDegrees<=5};
 for(const [gate,pass]of Object.entries(gates))if(!pass&&!firstViolations.some(v=>v.gate===gate))firstViolations.push({gate,stepIndex:state.stepIndex,metrics:d});
 const actor=state.bodies.find(b=>b.id==='actor');maxPositiveProgressM=Math.max(maxPositiveProgressM,actor.positionM[0]-initialActor.positionM[0]);if(name==='SLOPE15'&&maxPositiveProgressM>.02&&!firstViolations.some(v=>v.gate==='slopePolicy'))firstViolations.push({gate:'slopePolicy',stepIndex:state.stepIndex,positiveProgressM:maxPositiveProgressM});if(name==='STEP10'&&actor.positionM[0]>=.75)crossedStep=true;
 if(state.contacts.some(c=>c.aId==='actor'||c.bId==='actor')){contactSteps++;preContact=false;}
 if(preContact){const n=state.stepIndex,expectedY=initialActor.positionM[1]-9.81*dt*dt*n*(n+1)/2,expectedVy=-9.81*n*dt;freeFlightMaxError=Math.max(freeFlightMaxError,Math.abs(actor.positionM[1]-expectedY),Math.abs(actor.velocityMps[1]-expectedVy));const requested=name==='REST'?0:1;freeFlightMaxError=Math.max(freeFlightMaxError,Math.abs(actor.positionM[0]-(initialActor.positionM[0]+n*dt*requested)),Math.abs(actor.velocityMps[0]-(n===0?0:requested)));}
 last=d;
 }
 function sample(state){if(save)samples.push({state,queries:scene.queries(),bodyFloat64Sha256:bodyHash(state),fullStateSha256:hash(state)});}
 if(!timed){inspect(initial);sample(initial);}
 let final=initial;
 for(let n=1;n<=240;n++){const t=performance.now();final=scene.step(dt);if(timed)times.push(performance.now()-t);assert.equal(final.stepIndex,n);assert.equal(final.timeSeconds,n*dt);if(!timed){inspect(final);if([60,120,180,240].includes(n))sample(final);}}
 const actor=final.bodies.find(b=>b.id==='actor'),progress=actor.positionM[0]-initialActor.positionM[0],xzDrift=Math.hypot(actor.positionM[0]-initialActor.positionM[0],actor.positionM[2]-initialActor.positionM[2]);
 const finalDiag=diagnostics(final,fixture.geometry.floorPlane),baseGO=firstViolations.length===0&&freeFlightMaxError<=1e-12;
 const productGates=name==='REST'?{restGap:Math.abs(finalDiag.supportPlaneGapM)<=.005,restDrift:xzDrift<=.01}:name==='FLAT'?{progress:progress>=1.9&&progress<=2.1,finalGap:Math.abs(finalDiag.supportPlaneGapM)<=.005}:name==='STEP10'?{progress:progress>=1.9,crossedStep}: {rejectedSlope:maxPositiveProgressM<=.02};
 const numericalGO=baseGO&&Object.values(productGates).every(Boolean);assert.equal(hash(fixture),beforeConfig);scene.dispose();scene.dispose();
 return {name,fixture,setupMs,times,maxima,firstViolations,freeFlightMaxError,contactSteps,finalMetrics:finalDiag,progressM:progress,maxPositiveProgressM,xzDriftM:xzDrift,crossedStep,productGates,numericalGO,samples,finalStateSha256:hash(final),finalBodyFloat64Sha256:bodyHash(final)};
}
function controls(){
 const results=[],data=buildConfig('FLAT'),world=createPhysicsWorld(data.config),initial=world.getState();data.config.bodies[0].positionM[0]=999;assert.equal(hash(world.getState()),hash(initial));results.push({label:'copied-config',passed:true});
 const returned=world.getState();returned.bodies[0].positionM[0]=888;returned.bodies[0].shape.radiusM=8;assert.equal(hash(world.getState()),hash(initial));results.push({label:'copied-state',passed:true});
 const actor=initial.bodies.find(b=>b.id==='actor'),self=world.raycast({originM:actor.positionM,direction:[0,-1,0],maxDistanceM:2,includeSensors:false});assert.deepEqual(self,{bodyId:'actor',distanceM:0});assert.deepEqual(Object.keys(self).sort(),['bodyId','distanceM']);results.push({label:'actual-self-ray-no-normal-or-exclusion',result:self});
 const overlap=world.overlapSphere({centerM:[-1,0,0],radiusM:.01,includeSensors:false});assert.ok(overlap.includes('actor')&&overlap.includes('floor'));results.push({label:'foot-overlap-IDs-only',rawIds:overlap});
 function refuse(label,fn,code){const before=hash(world.getState());assert.throws(fn,e=>e.code===code);assert.equal(hash(world.getState()),before);results.push({label,code,completeRetention:true});}
 refuse('nonunit-ray',()=>world.raycast({originM:actor.positionM,direction:[0,-2,0],maxDistanceM:2}),'INVALID_QUERY');refuse('negative-overlap',()=>world.overlapSphere({centerM:[0,0,0],radiusM:-1}),'INVALID_QUERY');refuse('invalid-dt',()=>world.step(0),'INVALID_STEP');refuse('unknown-body',()=>world.step(dt,[{kind:'impulse',bodyId:'missing',impulseNs:[1,0,0]}]),'INVALID_COMMAND');
 for(const [label,patch]of [['capsuleCCD',{ccd:true}],['capsule-inertia-override',{inertiaKgM2:.1}]]){const config=buildConfig('FLAT').config;Object.assign(config.bodies[0],patch);assert.throws(()=>createPhysicsWorld(config),e=>e.code==='INVALID_CONFIG');results.push({label,code:'INVALID_CONFIG'});}
 world.dispose();world.dispose();for(const fn of [()=>world.getState(),()=>world.step(dt),()=>world.raycast({originM:[0,0,0],direction:[0,-1,0],maxDistanceM:1})])assert.throws(fn,e=>e.code==='DISPOSED');results.push({label:'double-disposal/disposed-refusals',passed:true});
 const raw=buildConfig('REST').config,kinematic={id:'actor',kind:'kinematic',shape:{kind:'capsule',radiusM:.15,halfLengthM:.35},positionM:[0,.505,0],orientation:[0,0,0,1],restitution:0,friction:{static:0,dynamic:0}};
 assert.throws(()=>createPhysicsWorld({...raw,bodies:[kinematic,raw.bodies[1]]}),e=>e.code==='INVALID_CONFIG');results.push({label:'kinematic-static-only-refused',code:'INVALID_CONFIG'});
 const sentinel={id:'sentinel',kind:'dynamic',shape:{kind:'sphere',radiusM:.01},positionM:[10,10,10],velocityMps:[0,0,0],massKg:1,restitution:0};
 const k=createPhysicsWorld({...raw,gravityMps2:[0,0,0],bodies:[kinematic,raw.bodies[1],sentinel]}),state=k.step(dt,[{kind:'kinematicTarget',bodyId:'actor',positionM:[0,-.2,0]}]);
 const moved=state.bodies.find(b=>b.id==='actor'),floor=state.bodies.find(b=>b.id==='floor');assert.deepEqual(moved.positionM,[0,-.2,0]);const overlapLowerBound=Math.max(0,.15-segmentBoxDistance(moved,floor));assert.ok(overlapLowerBound>.005);results.push({label:'kinematic-static-not-blocked',actualState:state,overlapLowerBoundM:overlapLowerBound});k.dispose();k.dispose();return results;
}
try{
 const refs=referenceControls();assert.ok(Math.abs(refs.planeGap)<1e-12);assert.ok(Math.abs(refs.touchDistance-.15)<1e-12);assert.ok(Math.abs(refs.separatedDistance-.25)<1e-12);assert.ok(refs.insideDistance<=1e-12);assert.ok(Math.abs(refs.quarterTurnEnds[0][0]-.35)<1e-12);assert.ok(Math.abs(refs.quarterTurnEnds[0][1])<1e-12);assert.ok(Math.abs(refs.cornerDistance-Math.sqrt(.5825))<1e-12);assert.ok(Math.abs(refs.rotatedBoxDistance-Math.sqrt(.5725))<1e-12);
 const cases=[];for(const name of ['REST','FLAT','STEP10','SLOPE15']){const first=run(name,false,true),repeat=run(name,false,true);assert.deepEqual(first.samples,repeat.samples);run(name,true);const cpuTrials=Array.from({length:3},()=>{const r=run(name,true);assert.equal(r.finalStateSha256,first.finalStateSha256);const s=[...r.times].sort((a,b)=>a-b);return {steps:r.times.length,p95Ms:s[Math.ceil(s.length*.95)-1],setupMs:r.setupMs,finalStateSha256:r.finalStateSha256};});cases.push({...first,repeatExact:true,cpuTrials,cpuGO:cpuTrials.every(t=>t.p95Ms<=8.33)});}
 const guards=controls();console.log(JSON.stringify({ok:true,issue:830,independentReferences:refs,cases,controls:guards,rawCharacterGO:cases.every(c=>c.numericalGO&&c.cpuGO),characterControllerImplemented:false,viewerTested:false,querySweepAvailable:false}));
}catch(error){console.log(JSON.stringify({ok:false,firstFailure:error.stack||String(error)}));process.exitCode=1;}
