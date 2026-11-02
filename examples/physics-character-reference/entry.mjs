import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPhysicsWorld} from '@barocss/physics';
import {buildConfig,PARAMETERS} from './fixture.mjs';
import {makeModel,dynamicPart,kinematicPart} from '../physics-model-input/model.mjs';
import {createScene} from './scene.mjs';
import {diagnostics,referenceControls,segmentBoxDistance} from './metrics.mjs';
const dt=1/120,hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const bodyHash=s=>{const data=new Float64Array(s.bodies.flatMap(b=>[...b.positionM,...b.velocityMps,...b.orientationXYZW,...b.angularVelocityRadps]));return hash(Buffer.from(data.buffer));};
function run(name,timed=false,save=false){
 const fixture=buildConfig(name),beforeConfig=hash(fixture),start=performance.now(),scene=createScene(name),setupMs=performance.now()-start,initial=scene.getState(),initialActor=initial.bodies.find(b=>b.id==='actor'),samples=[],times=[],maxima={},firstViolations=[];
 assert.deepEqual(Array(3).fill(2*PARAMETERS.massKg*(PARAMETERS.radiusM+PARAMETERS.halfLengthM)**2/5),[.1,.1,.1]);let crossedStep=false,freeFlightMaxError=0,preContact=true,contactSteps=0,maxPositiveProgressM=0,last=null;
 function inspect(state){const d=diagnostics(state,fixture.geometry.floorPlane,fixture.geometry);for(const [key,value]of Object.entries(d))if(typeof value==='number')maxima[key]=Math.max(maxima[key]??0,key==='supportPlaneGapM'?Math.abs(value):value);
 const gates={finite:d.finite,position:d.maxPositionM<=5,velocity:d.maxVelocityMps<=100,quaternion:d.quaternionNormError<=1e-10,overlap:d.maxOverlapLowerBoundM<=.005,tilt:d.capsuleAxisTiltDegrees<=5};
 for(const [gate,pass]of Object.entries(gates))if(!pass&&!firstViolations.some(v=>v.gate===gate))firstViolations.push({gate,stepIndex:state.stepIndex,metrics:d});
 const actor=state.bodies.find(b=>b.id==='actor');maxPositiveProgressM=Math.max(maxPositiveProgressM,actor.positionM[0]-initialActor.positionM[0]);if(name==='SLOPE15'&&maxPositiveProgressM>.02&&!firstViolations.some(v=>v.gate==='slopePolicy'))firstViolations.push({gate:'slopePolicy',stepIndex:state.stepIndex,positiveProgressM:maxPositiveProgressM});if(name==='STEP10'&&actor.positionM[0]>=.75)crossedStep=true;
 if(state.contacts.some(c=>c.bodyAId==='actor'||c.bodyBId==='actor')){contactSteps++;preContact=false;}
 if(preContact){const n=state.stepIndex,expectedY=initialActor.positionM[1]-9.81*dt*dt*n*(n+1)/2,expectedVy=-9.81*n*dt;freeFlightMaxError=Math.max(freeFlightMaxError,Math.abs(actor.positionM[1]-expectedY),Math.abs(actor.velocityMps[1]-expectedVy));const requested=name==='REST'?0:1;freeFlightMaxError=Math.max(freeFlightMaxError,Math.abs(actor.positionM[0]-(initialActor.positionM[0]+n*dt*requested)),Math.abs(actor.velocityMps[0]-(n===0?0:requested)));}
 last=d;
 }
 function sample(state){if(save)samples.push({state,queries:scene.queries(),bodyFloat64Sha256:bodyHash(state),fullStateSha256:hash(state)});}
 if(!timed){inspect(initial);sample(initial);}
 let final=initial;
 for(let n=1;n<=240;n++){const t=performance.now();final=scene.step();if(timed)times.push(performance.now()-t);assert.equal(final.stepIndex,n);assert.equal(final.timeSeconds,n*dt);if(!timed){inspect(final);if([60,120,180,240].includes(n))sample(final);}}
 const actor=final.bodies.find(b=>b.id==='actor'),progress=actor.positionM[0]-initialActor.positionM[0],xzDrift=Math.hypot(actor.positionM[0]-initialActor.positionM[0],actor.positionM[2]-initialActor.positionM[2]);
 const finalDiag=diagnostics(final,fixture.geometry.floorPlane,fixture.geometry),baseGO=firstViolations.length===0&&freeFlightMaxError<=1e-12;
 const productGates=name==='REST'?{restGap:Math.abs(finalDiag.supportPlaneGapM)<=.005,restDrift:xzDrift<=.01}:name==='FLAT'?{progress:progress>=1.9&&progress<=2.1,finalGap:Math.abs(finalDiag.supportPlaneGapM)<=.005}:name==='STEP10'?{progress:progress>=1.9,crossedStep}: {rejectedSlope:maxPositiveProgressM<=.02};
 const numericalGO=baseGO&&Object.values(productGates).every(Boolean);assert.equal(hash(fixture),beforeConfig);scene.dispose();scene.dispose();
 return {name,fixture,setupMs,times,maxima,firstViolations,freeFlightMaxError,contactSteps,finalMetrics:finalDiag,progressM:progress,maxPositiveProgressM,xzDriftM:xzDrift,crossedStep,productGates,numericalGO,samples,finalStateSha256:hash(final),finalBodyFloat64Sha256:bodyHash(final)};
}
function controls(){
 const results=[],data=buildConfig('FLAT'),world=createPhysicsWorld(data.config.model,data.config.options),initial=world.getState();data.config.model.bodies[0].initial.positionM[0]=999;assert.equal(hash(world.getState()),hash(initial));results.push({label:'copied-config',passed:true});
 const returned=world.getState();returned.bodies[0].positionM[0]=888;const returnedModel=world.getModel();returnedModel.colliders[0].geometry.radiusM=8;assert.equal(hash(world.getState()),hash(initial));assert.equal(world.getModel().colliders[0].geometry.radiusM,.15);results.push({label:'copied-state/model',passed:true});
 const actor=initial.bodies.find(b=>b.id==='actor'),self=world.query({kind:'raycast',originM:actor.positionM,direction:[0,-1,0],maxDistanceM:2,includeSensors:false});assert.deepEqual(self,{kind:'raycast',hit:{bodyId:'actor',colliderId:'actor.shape',distanceM:0}});assert.deepEqual(Object.keys(self.hit).sort(),['bodyId','colliderId','distanceM']);results.push({label:'actual-self-ray-no-normal-or-exclusion',result:self});
 const overlap=world.query({kind:'overlap-sphere',centerM:[-1,0,0],radiusM:.01,includeSensors:false});assert.ok(overlap.colliderIds.includes('actor.shape')&&overlap.colliderIds.includes('floor.shape'));results.push({label:'foot-overlap-IDs-only',rawIds:overlap.colliderIds});
 function refuse(label,fn,code){const before=hash(world.getState());assert.throws(fn,e=>e.code===code);assert.equal(hash(world.getState()),before);results.push({label,code,completeRetention:true});}
 refuse('nonunit-ray',()=>world.query({kind:'raycast',originM:actor.positionM,direction:[0,-2,0],maxDistanceM:2,includeSensors:false}),'INVALID_QUERY');refuse('negative-overlap',()=>world.query({kind:'overlap-sphere',centerM:[0,0,0],radiusM:-1,includeSensors:false}),'INVALID_QUERY');refuse('invalid-command-argument',()=>world.step(0),'INVALID_COMMAND');refuse('unknown-body',()=>world.step([{kind:'impulse',bodyId:'missing',impulseNs:[1,0,0]}]),'INVALID_COMMAND');
 for(const label of ['capsuleCCD','capsule-inertia-override']){const {model,options}=buildConfig('FLAT').config;if(label==='capsuleCCD')model.colliders[0].ccd=true;else model.bodies[0].inertia={kind:'sphere-isotropic',about:'com',frame:'body-local',kgM2:.1};assert.throws(()=>createPhysicsWorld(model,options),e=>e.code==='INVALID_CONFIG');results.push({label,code:'INVALID_CONFIG'});}
 world.dispose();world.dispose();for(const fn of [()=>world.getState(),()=>world.step(),()=>world.query({kind:'raycast',originM:[0,0,0],direction:[0,-1,0],maxDistanceM:1,includeSensors:false})])assert.throws(fn,e=>e.code==='DISPOSED');results.push({label:'double-disposal/disposed-refusals',passed:true});
 const {model:raw,options}=buildConfig('REST').config,kinematic=kinematicPart('actor',{kind:'capsule',radiusM:.15,halfLengthM:.35},{positionM:[0,.505,0]});
 assert.throws(()=>createPhysicsWorld({...raw,bodies:[kinematic.body,raw.bodies[1]],colliders:[kinematic.collider,raw.colliders[1]]},options),e=>e.code==='INVALID_CONFIG');results.push({label:'kinematic-static-only-refused',code:'INVALID_CONFIG'});
 const sentinel=dynamicPart('sentinel',{kind:'sphere',radiusM:.01},{positionM:[10,10,10]});
 const k=createPhysicsWorld(makeModel({gravityMps2:[0,0,0],parts:[kinematic,{body:raw.bodies[1],collider:raw.colliders[1]},sentinel]}),options),state=k.step([{kind:'kinematicTarget',bodyId:'actor',positionM:[0,-.2,0]}]);
 const moved=state.bodies.find(b=>b.id==='actor'),floor=state.bodies.find(b=>b.id==='floor');assert.deepEqual(moved.positionM,[0,-.2,0]);const overlapLowerBound=Math.max(0,.15-segmentBoxDistance(moved,floor,{radiusM:.15,halfLengthM:.35},{halfExtentsM:[3,.05,1]}));assert.ok(overlapLowerBound>.005);results.push({label:'kinematic-static-not-blocked',actualState:state,overlapLowerBoundM:overlapLowerBound});k.dispose();k.dispose();return results;
}
try{
 const refs=referenceControls();assert.ok(Math.abs(refs.planeGap)<1e-12);assert.ok(Math.abs(refs.touchDistance-.15)<1e-12);assert.ok(Math.abs(refs.separatedDistance-.25)<1e-12);assert.ok(refs.insideDistance<=1e-12);assert.ok(Math.abs(refs.quarterTurnEnds[0][0]-.35)<1e-12);assert.ok(Math.abs(refs.quarterTurnEnds[0][1])<1e-12);assert.ok(Math.abs(refs.cornerDistance-Math.sqrt(.5825))<1e-12);assert.ok(Math.abs(refs.rotatedBoxDistance-Math.sqrt(.5725))<1e-12);
 const cases=[];for(const name of ['REST','FLAT','STEP10','SLOPE15']){const first=run(name,false,true),repeat=run(name,false,true);assert.deepEqual(first.samples,repeat.samples);run(name,true);const cpuTrials=Array.from({length:3},()=>{const r=run(name,true);assert.equal(r.finalStateSha256,first.finalStateSha256);const s=[...r.times].sort((a,b)=>a-b);return {steps:r.times.length,p95Ms:s[Math.ceil(s.length*.95)-1],setupMs:r.setupMs,finalStateSha256:r.finalStateSha256};});cases.push({...first,repeatExact:true,cpuTrials,cpuGO:cpuTrials.every(t=>t.p95Ms<=8.33)});}
 const guards=controls();console.log(JSON.stringify({ok:true,issue:830,independentReferences:refs,cases,controls:guards,rawCharacterGO:cases.every(c=>c.numericalGO&&c.cpuGO),characterControllerImplemented:false,viewerTested:false,querySweepAvailable:false}));
}catch(error){console.log(JSON.stringify({ok:false,firstFailure:error.stack||String(error)}));process.exitCode=1;}
