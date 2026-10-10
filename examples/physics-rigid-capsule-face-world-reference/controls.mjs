import assert from 'node:assert/strict';
import {fixtures} from '../physics-rigid-engine-reference/fixtures.mjs';
import {originalReferenceInput,yawReferenceInput} from '../physics-rigid-capsule-ccd-reference/reference-controls.mjs';
export const fixture=fixtures().find(f=>f.id==='CAPSULE_THIN_CCD').input;
export const worldErrorLiterals={profile:'private capsule face world profile is unsupported',commands:'private capsule face world commands are unsupported',step:'private capsule face world step is unsupported',result:'private capsule face world result is invalid'};
export function configFromInput(input){const config=structuredClone(fixture);config.fixedStepSeconds=input.stepSeconds;config.bodies[0].positionM=[...input.centerM];config.bodies[0].velocityMps=[...input.velocityMps];config.bodies[1].positionM=[...input.box.centerM];config.bodies[1].shape.halfExtentsM=[...input.box.halfExtentsM];if(input.box.orientationXYZW)config.bodies[1].orientation=[...input.box.orientationXYZW];return config;}
export function referenceInputFor(config){const cap=config.bodies.find(b=>b.kind==='dynamic'),box=config.bodies.find(b=>b.kind==='static');return {capsule:{radiusM:cap.shape.radiusM,halfLengthM:cap.shape.halfLengthM,orientationXYZW:structuredClone(cap.orientation??[0,0,0,1]),angularVelocityRadps:structuredClone(cap.angularVelocityRadps??[0,0,0])},box:{id:box.id,centerM:[...box.positionM],halfExtentsM:[...box.shape.halfExtentsM],orientationXYZW:structuredClone(box.orientation??[0,0,0,1]),velocityMps:structuredClone(box.velocityMps??[0,0,0]),angularVelocityRadps:structuredClone(box.angularVelocityRadps??[0,0,0])},centerM:[...cap.positionM],velocityMps:[...cap.velocityMps],stepSeconds:config.fixedStepSeconds,evaluateCandidate:false};}
const derived=change=>({...structuredClone(originalReferenceInput),...change});
export const worldCases=[
 {name:'original-head-on',config:structuredClone(fixture)},
 {name:'yaw-0.2-head-on',config:configFromInput(yawReferenceInput)},
 {name:'initial-touch',config:configFromInput(derived({centerM:[-.101,0,0]}))},
 {name:'resting-at-touch',config:configFromInput(derived({centerM:[-.101,0,0],velocityMps:[0,0,0]}))},
 {name:'contact-beyond-step',config:configFromInput(derived({velocityMps:[10,0,0]}))},
 {name:'zero-motion',config:configFromInput(derived({velocityMps:[0,0,0]}))},
 {name:'departing-with-clearance',config:configFromInput(derived({velocityMps:[-100,0,0]}))},
 {name:'departing-at-touch',config:configFromInput(derived({centerM:[-.101,0,0],velocityMps:[-100,0,0]}))},
];
export function rawState(state){const bytes=Buffer.alloc(state.bodies.length*104);let offset=0;for(const body of state.bodies)for(const [key,size]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]){assert.equal(body[key].length,size);for(let i=0;i<size;i++){assert.equal(typeof body[key][i],'number');bytes.writeDoubleLE(body[key][i],offset);offset+=8;}}return bytes;}
export function numericBits(value){const numbers=[];function collect(x){if(typeof x==='number')numbers.push(x);else if(x&&typeof x==='object')Object.values(x).forEach(collect);}collect(value);const bytes=Buffer.alloc(numbers.length*8);numbers.forEach((v,i)=>bytes.writeDoubleLE(v,i*8));return bytes;}
export function captureWorld(world){const state=world.getState(),diagnostic=world.getCapsuleFaceStepDiagnostics();return {state,diagnostic,rawStateHex:rawState(state).toString('hex'),allNumericHex:numericBits({state,diagnostic}).toString('hex')};}
export function assertUnchanged(world,before,label){assert.deepEqual(captureWorld(world),before,label);}
function refusal(api,name,action,code,message){let caught;try{action();}catch(error){if(!(error instanceof api.PhysicsError))throw error;caught=error;}assert.ok(caught,name);assert.equal(caught.code,code,name);assert.equal(caught.message,message,name);return {name,code,message,originalPhysicsError:true};}
export function runStructuralControls(api){
 assert.deepEqual(api.WORLD_ERRORS,worldErrorLiterals);const receipts=[];
 const unchanged=structuredClone(fixture);receipts.push(refusal(api,'public-original-world-refusal',()=>api.createOriginalWorld(fixture),'INVALID_CONFIG','ccd is supported for dynamic spheres or boxes only and must be true'));assert.deepEqual(fixture,unchanged);
 receipts.push(refusal(api,'original-parseBody-CCD-refusal',()=>api.parseBody(structuredClone(fixture.bodies[0])),'INVALID_CONFIG','ccd is supported for dynamic spheres or boxes only and must be true'));
 const profile=worldErrorLiterals.profile;
 for(const [name,edit,message]of [
  ['wrong-radius',x=>{x.bodies[0].shape.radiusM=.15;},profile],['capsule-spin',x=>{x.bodies[0].angularVelocityRadps=[0,1,0];},profile],
  ['capsule-rotation',x=>{x.bodies[0].orientation=[0,0,Math.sin(.1),Math.cos(.1)];},profile],['tangent-velocity',x=>{x.bodies[0].velocityMps=[100,1,0];},profile],
  ['opposite-side',x=>{x.bodies[0].positionM=[.4,0,0];},profile],['edge-corner',x=>{x.bodies[0].positionM=[-.4,.8,0];},profile],
  ['box-centre',x=>{x.bodies[1].positionM=[.1,0,0];},profile],['box-size',x=>{x.bodies[1].shape.halfExtentsM=[.002,1,1];},profile],
  ['gravity',x=>{x.gravityMps2=[0,-9.81,0];},profile],['configured-dt',x=>{x.fixedStepSeconds=1/100;},profile],
  ['sparse-bodies',x=>{delete x.bodies[1];},profile],['extra-array-key',x=>{x.bodies.extra=1;},profile],
  ['zero-mass',x=>{x.bodies[0].massKg=0;},'massKg must be finite and in [0.000001, 1000000]'],
  ['nonfinite-position',x=>{x.bodies[0].positionM[0]=NaN;},'positionM[0] must be finite and in [-10000, 10000]'],
  ['null-position-component',x=>{x.bodies[0].positionM[0]=null;},'positionM[0] must be finite and in [-10000, 10000]'],
  ['null-position-vector',x=>{x.bodies[0].positionM=null;},'positionM must be a 3-vector'],
  ['null-body',x=>{x.bodies[0]=null;},'body must be an object'],['static-velocity-field',x=>{x.bodies[1].velocityMps=[1,0,0];},'body has an unsupported field']
 ]){const input=structuredClone(fixture);edit(input);const before=structuredClone(input);receipts.push(refusal(api,name,()=>api.createCapsuleFaceCandidateWorld(input),'INVALID_CONFIG',message));assert.deepEqual(input,before,name);}
 const overlap=structuredClone(fixture);overlap.bodies[0].positionM=[-.1009,0,0];receipts.push(refusal(api,'admitted-initial-overlap',()=>api.createCapsuleFaceCandidateWorld(overlap),'INITIAL_OVERLAP','Initial capsule overlaps a box'));
 const marker=new Error('Unexpected capsule world reflection');const proxy=new Proxy({}, {getPrototypeOf(){throw marker;}});assert.throws(()=>api.createCapsuleFaceCandidateWorld(proxy),error=>error===marker);receipts.push({name:'reflection-thrown-identity',unexpected:true});
 const absent=api.createCapsuleFaceCandidateWorld(structuredClone(fixture)),empty=api.createCapsuleFaceCandidateWorld({...structuredClone(fixture),joints:[]});assert.deepEqual(absent.getState(),empty.getState());assert.equal(absent.getCapsuleFaceStepDiagnostics(),null);assert.equal(empty.getCapsuleFaceStepDiagnostics(),null);absent.dispose();empty.dispose();receipts.push({name:'absent-and-empty-joints-state0-equivalent',noStep:true});
 const scene={version:1,profile:'upright-capsule-box-v1',revision:'fixture-1298',boxes:[structuredClone(originalReferenceInput.box)]};
 receipts.push(refusal(api,'public-query-refuses-private-profile',()=>api.createUprightCapsuleQuery({...scene,profile:'rigid-capsule-linear-face-v1'}),'INVALID_CONFIG','Unsupported capsule query profile'));
 const pub=api.createUprightCapsuleQuery(scene),publicHit=pub.sweep({revision:scene.revision,centerM:[-.4,0,0],displacementM:[100/120,0,0],excludeId:null});assert.ok(publicHit);assert.ok(Math.abs(publicHit.toiFraction-.2988)<=1e-12);const stored=pub.getSnapshot();scene.boxes[0].centerM[0]=999;stored.boxes[0].centerM[0]=999;assert.equal(pub.getSnapshot().boxes[0].centerM[0],0);pub.dispose();pub.dispose();receipts.push(refusal(api,'public-query-disposed',()=>pub.getSnapshot(),'DISPOSED','Capsule query is disposed'));
 return {receipts,publicOwnProfileHit:publicHit,publicRadiusM:.15,publicHalfLengthM:.35,successfulCandidateSteps:0};
}
export function diagnosticControls(api,diagnostic){
 const receipts=[];for(const [name,edit]of [['null-diagnostic',()=>null],['null-time',d=>{d.hitTimeSeconds=null;return d;}],['nonfinite-centre',d=>{d.acceptedCenterM[0]=NaN;return d;}],['sparse-centre',d=>{delete d.acceptedCenterM[0];return d;}],['wrong-ID',d=>{if(d.hit)d.hit.dynamicBodyId='floor';return d;}]]){const changed=edit(structuredClone(diagnostic));receipts.push(refusal(api,name,()=>api.validateStepDiagnostics(changed,'b0','floor'),'NUMERIC_LIMIT',worldErrorLiterals.result));}return receipts;
}
export function getterCopyControls(world){const before=captureWorld(world),state=world.getState(),diagnostic=world.getCapsuleFaceStepDiagnostics();state.bodies[0].positionM[0]=999;state.bodies[0].shape.radiusM=999;state.bodies[1].orientation[0]=999;state.pairStats.eligiblePairs=-1;if(state.ccdHits.length)state.ccdHits[0].normalFixtureToBody[0]=999;if(state.contacts.length){state.contacts[0].normalAtoB[0]=999;state.contacts[0].pointM[0]=999;state.contacts[0].tangentImpulseNs[0]=999;}if(diagnostic){diagnostic.acceptedCenterM[0]=999;if(diagnostic.hit)diagnostic.hit.normal[0]=999;}assertUnchanged(world,before,'state/hit/contact/diagnostic copies');return {copied:true,acceptedStep:before.state.stepIndex};}
/** Use original full-world acceptedstep1; refusals never create another acceptedstep. */
export function transactionControls(api,world,recorder){
 const before=captureWorld(world),dt=fixture.fixedStepSeconds,receipts=[];
 assert.equal(before.state.stepIndex,1);assert.deepEqual(before.state.pairStats,{eligiblePairs:8,candidatePairs:8,aabbTests:0});assert.ok(before.diagnostic);
 receipts.push(refusal(api,'bad-step-before-command',()=>world.step(1/100,[{kind:'impulse',bodyId:'missing',impulseNs:[1,0,0]}]),'INVALID_STEP','step must equal configured fixedStepSeconds'));assertUnchanged(world,before,'badstep');
 const commands=[['nonnull-command',[{kind:'force',bodyId:'b0',forceN:[0,0,0]}]],['angular-command',[{kind:'angularImpulse',bodyId:'b0',angularImpulseNms:[0,1,0]}]],['unknown-target-command',[{kind:'force',bodyId:'missing',forceN:[0,0,0]}]],['null-commands',null],['object-commands',{}],['sparse-commands',Array(1)],['array-extra-key',Object.assign([],{extra:1})]];
 for(const [name,value]of commands){const saved=structuredClone(value);receipts.push(refusal(api,name,()=>world.step(dt,value),'INVALID_COMMAND',worldErrorLiterals.commands));assert.deepEqual(value,saved);assertUnchanged(world,before,name);}
 for(const marker of [new Error('Unexpected copied attempt observer'),Object.freeze({name:'PhysicsError',code:'NUMERIC_LIMIT',message:worldErrorLiterals.result})]){recorder.setMode('throw',marker);assert.throws(()=>world.step(dt),error=>error===marker);assertUnchanged(world,before,'unknown observer preserves allacceptedbits');receipts.push({name:marker instanceof Error?'observer-error-identity':'observer-plain-value-identity',unexpected:true,notPhysicalRefusal:true,attempt:recorder.last()});}
 recorder.setMode('record');const centre=[...before.state.bodies[0].positionM];assert.deepEqual(world.overlapSphere({centerM:centre,radiusM:.001}),['b0']);assert.equal(world.raycast({originM:[-2,0,0],direction:[1,0,0],maxDistanceM:4})?.bodyId,'b0');
 receipts.push(refusal(api,'bad-overlap-query',()=>world.overlapSphere({centerM:null,radiusM:1}),'INVALID_QUERY','centerM must be a dense 3-vector'));assertUnchanged(world,before,'query failure');
 return {receipts,priorAcceptedState:before,queries:true,observerThrownValuesPropagated:true,noAcceptedStepAdded:true};
}
export function disposeControls(api,world){world.dispose();world.dispose();const receipts=[];for(const [name,action]of [['getState',()=>world.getState()],['step-precedence',()=>world.step(1/100,null)],['overlapSphere',()=>world.overlapSphere({centerM:[0,0,0],radiusM:1})],['raycast',()=>world.raycast({originM:[0,0,0],direction:[1,0,0],maxDistanceM:1})],['diagnostic',()=>world.getCapsuleFaceStepDiagnostics()]])receipts.push(refusal(api,`disposed-${name}`,action,'DISPOSED','world is disposed'));return {doubleDispose:true,receipts};}
export function originalBoundsControl(api,recorder){const config=structuredClone(fixture);config.bodies[0].positionM=[-10000,0,0];config.bodies[0].velocityMps=[-1000,0,0];const world=api.createCapsuleFaceCandidateWorld(config,{observeAttempt:recorder.observeAttempt}),before=captureWorld(world);const receipt=refusal(api,'original-position-bounds',()=>world.step(config.fixedStepSeconds),'NUMERIC_LIMIT','b0 position exceeded bounds');assertUnchanged(world,before,'original numeric refusal retains acceptedstate0/diagnull');const attempt=recorder.last();world.dispose();world.dispose();return {receipt,priorAccepted:before,attempt,originalNumericControl:true};}
