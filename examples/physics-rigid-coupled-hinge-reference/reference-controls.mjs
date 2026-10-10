import assert from 'node:assert/strict';
import { restingReferenceInput, literalReferenceControls as adoptedControls }
  from '../physics-rigid-hinge-limit-diagnostic/reference-controls.mjs';

// Importing these authored data does not evaluate a law, oracle or candidate.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const referenceGates=freeze({anchorM:1e-9,angleRad:1e-9,quaternionNorm:1e-9,axisRad:Math.PI/180,
  comM:1e-12,linearMomentumKgMps:1e-7,angularMomentumKgM2ps:1e-7,
  rawNormalized:1e-12,decimalAlgebra:'1e-25',velocity:'exact-bits',angularVelocity:'exact-bits'});
export function fullCarrier(old){
  const input=structuredClone(old),config={...input.config,fixedStepSeconds:1/120,gravityMps2:[0,0,0]};
  const state={stepIndex:0,timeSeconds:0,bodies:input.state.bodies,joints:input.state.joints.map(j=>({
    ...j,linearImpulseNs:[0,0,0],angularImpulseNms:[0,0,0],motorImpulseNms:0})),
    contacts:[],events:[],ccdHits:[],pairStats:{eligiblePairs:0,candidatePairs:0,aabbTests:0}};
  return {config,state,dt:1/120};
}
const rest=fullCarrier(restingReferenceInput);
const changed=edit=>{const input=structuredClone(rest);edit(input);return input;};
const adopted=name=>fullCarrier(adoptedControls.find(c=>c.name===name).input);
const inside=changed(x=>{
  x.state.bodies[0].orientation=[0,0,-.14943813247359922,.9887710779360422];
  x.state.bodies[1].orientation=[0,0,.14943813247359922,.9887710779360422];
  x.state.bodies[0].positionM=[-.0955336489125606,0,0];x.state.bodies[1].positionM=[.0955336489125606,0,0];
  x.state.joints[0].angleRad=.6;
});
export const literalCandidateControls=freeze([
  {name:'resting-coincident-anchors',input:structuredClone(rest),expected:{targetAngleRad:0,finalAngleRad:0}},
  {name:'resting-signed-zero-velocity-and-spin',input:changed(x=>{
    x.state.bodies[0].velocityMps[1]=-0;x.state.bodies[1].angularVelocityRadps[0]=-0;
  }),expected:{targetAngleRad:0,finalAngleRad:0}},
  {name:'inside-limit-coherent-anchors',input:inside,expected:{targetAngleRad:.6,finalAngleRad:.6}},
  {name:'exact-upper-limit',input:adopted('exact-upper-limit'),expected:{targetAngleRad:.8,finalAngleRad:.8}},
  {name:'exact-lower-limit',input:adopted('exact-lower-limit'),expected:{targetAngleRad:-.8,finalAngleRad:-.8}},
  {name:'slight-upper-excess',input:adopted('slight-upper-excess'),expected:{targetAngleRad:.8,finalAngleRad:.8}},
  {name:'slight-lower-excess',input:adopted('slight-lower-excess'),expected:{targetAngleRad:-.8,finalAngleRad:-.8}},
  {name:'quaternion-sign-equivalence',input:adopted('sign-equivalent-quaternion'),expected:{targetAngleRad:.8,finalAngleRad:.8}},
  {name:'Z1-pair-origin',input:adopted('Z1-translation'),expected:{targetAngleRad:0,finalAngleRad:0}},
  {name:'canonical-pair1-Z0',input:adopted('canonical-public-pair1-Z0'),expected:{targetAngleRad:0,finalAngleRad:0}},
  {name:'common-COM-and-common-velocity',input:changed(x=>{
    x.state.bodies[0].positionM=[1.9,3,0];x.state.bodies[1].positionM=[2.1,3,0];
    x.state.bodies.forEach(b=>b.velocityMps=[1,0,0]);
  }),expected:{linearMomentumKgMps:2,angularMomentumKgM2ps:6}},
  {name:'nonzero-linear-momentum',input:changed(x=>x.state.bodies[0].velocityMps=[1,0,0]),expected:{linearMomentumKgMps:1}},
  {name:'equal-opposite-spin',input:changed(x=>{
    x.state.bodies[0].angularVelocityRadps=[0,0,-1];x.state.bodies[1].angularVelocityRadps=[0,0,1];
  }),expected:{linearMomentumKgMps:0,angularMomentumKgM2ps:0}},
  {name:'known-orbital-momentum',input:changed(x=>{
    x.state.bodies[0].velocityMps=[0,-1,0];x.state.bodies[1].velocityMps=[0,1,0];
  }),expected:{linearMomentumKgMps:0,angularMomentumKgM2ps:.2}},
  {name:'known-orbital-plus-spin',input:changed(x=>{
    x.state.bodies[0].velocityMps=[0,-1,0];x.state.bodies[1].velocityMps=[0,1,0];
    x.state.bodies.forEach(b=>b.angularVelocityRadps=[0,0,1]);
  }),expected:{linearMomentumKgMps:0,angularMomentumKgM2ps:.208}},
]);
const orbitalLossInput=adopted('exact-upper-limit');
orbitalLossInput.state.bodies[0].positionM=[-.1,0,0];orbitalLossInput.state.bodies[1].positionM=[.1,0,0];
orbitalLossInput.state.bodies[0].velocityMps=[0,-1,0];orbitalLossInput.state.bodies[1].velocityMps=[0,1,0];
export const orbitalLossCandidateControl=freeze({name:'admitted-incoherent-anchors-orbital-loss',
  input:orbitalLossInput,expectedPhysicalNoGo:true});
export const referenceErrors=freeze({
  finite:'coupled hinge reference requires finite numeric fields',dt:'coupled hinge reference dt must equal 1/120',
  carrier:'coupled hinge reference carrier cursor differs',statistics:'coupled hinge reference carrier statistics differ',
  rawLength:'coupled hinge reference raw13 length differs',
  ids:'Reference pair IDs are invalid',oldFinite:'Reference input must contain finite binary numbers',
});
export const referenceOnlyControls=freeze([
  {name:'null-dt',input:changed(x=>x.dt=null),error:referenceErrors.finite},
  {name:'invalid-dt',input:changed(x=>x.dt=1/100),error:referenceErrors.dt},
  {name:'null-cursor',input:changed(x=>x.state.stepIndex=null),error:referenceErrors.carrier},
  {name:'cursor-above-original-limit',input:changed(x=>{x.state.stepIndex=3601;x.state.timeSeconds=3601/120;}),error:referenceErrors.carrier},
  {name:'boolean-counter',input:changed(x=>x.state.pairStats.eligiblePairs=false),error:referenceErrors.statistics},
  {name:'wrong-body-ID',input:changed(x=>x.state.bodies[0].id='missing'),error:referenceErrors.ids},
  {name:'null-raw-position',input:changed(x=>x.state.bodies[0].positionM[0]=null),error:referenceErrors.oldFinite},
  {name:'nonfinite-raw-position-codec',input:changed(x=>x.state.bodies[0].positionM[0]=Infinity),error:referenceErrors.oldFinite},
  {name:'truncated-raw13',input:{...structuredClone(rest),beforeRawHex:'00'},error:referenceErrors.rawLength},
]);
function finite(value,label){assert.ok(typeof value==='number'&&Number.isFinite(value),label);return value;}
function near(value,expected,tolerance,label){assert.ok(Math.abs(finite(value,label)-expected)<=tolerance,label);}
export async function runReferenceControls(ask){
  const analytical=[],refusals=[];
  for(const c of literalCandidateControls){
    const input=structuredClone(c.input),saved=structuredClone(input),reply=await ask(input);
    assert.deepEqual(input,saved,c.name);assert.equal(reply.ok,true,c.name);assert.equal(reply.resolved,true,c.name);
    assert.ok(finite(reply.metrics.precisionMaxDifference,c.name)<=1e-25);assert.ok(finite(reply.metrics.scalarRepeatMaxDifferenceRad,c.name)<=1e-12);
    if('targetAngleRad'in c.expected)near(reply.reference.targetAngleRad,c.expected.targetAngleRad,1e-9,c.name);
    if('finalAngleRad'in c.expected)near(reply.reference.expectedFinalAngleRad,c.expected.finalAngleRad,1e-9,c.name);
    for(const view of ['raw','normalized'])for(const field of ['linearMomentumKgMps','angularMomentumKgM2ps'])if(field in c.expected){
      near(reply.reference.before[view][field],c.expected[field],1e-12,c.name);
      near(reply.reference.after[view][field],c.expected[field],1e-12,c.name);
    }
    analytical.push({name:c.name,reply,referencePredictionOnly:true});
  }
  for(const c of referenceOnlyControls){const reply=await ask(structuredClone(c.input));assert.equal(reply.ok,false,c.name);assert.equal(reply.executionFailure,true,c.name);assert.equal(reply.code,'REFERENCE_INPUT');assert.equal(reply.message,c.error);refusals.push({name:c.name,reply});}
  const exposed=await ask(structuredClone(orbitalLossCandidateControl.input));assert.equal(exposed.resolved,true);assert.equal(exposed.ok,false);
  assert.ok(exposed.metrics.rawAngularMomentumChangeKgM2ps>1e-7);assert.equal(exposed.metrics.velocityChanged,false);assert.equal(exposed.metrics.angularVelocityChanged,false);
  refusals.push({name:'pose-only-orbital-change-exposed',reply:exposed,referencePredictionOnly:true,
    actualCandidateEvidenceRequired:true,expectedPhysicalNoGo:true});
  const reply=await ask(structuredClone(rest)),saved=structuredClone(reply);reply.reference.expectedBodies[0].positionM[0]=99;
  assert.deepEqual(await ask(structuredClone(rest)),saved,'detached reference output repeat');
  return {analytical,refusals,replyCopyIsolated:true,worldCreated:false,worldStepped:false,oldProjectionCalled:false};
}
export const controls=runReferenceControls;
