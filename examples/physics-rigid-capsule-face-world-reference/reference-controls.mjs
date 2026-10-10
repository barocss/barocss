import assert from 'node:assert/strict';
import { runReferenceControls as unchangedFaceControls, originalReferenceInput }
  from '../physics-rigid-capsule-ccd-reference/reference-controls.mjs';

// Synthetic records below test comparator guards. They are not world evidence.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const worldReferenceGates = freeze({ distanceM: 1e-12, velocityMps: 1e-12,
  timeSeconds: 1e-12, fraction: 1e-12, decimalPrecisionDifference: '1e-25', spin: 'exact-zero',
  orientation: 'exact-identity', staticFixture: 'exact', firstAbsoluteEpisodeContact: true });
const dt = .008333333333333333;
const body = (id, kind, shape, positionM, velocityMps) => ({ id, kind, shape, positionM,
  velocityMps, orientation: [0,0,0,1], angularVelocityRadps: [0,0,0],
  ...(kind === 'dynamic' ? {ccd:true,inertiaDiagonalKgM2:[.03600000000000001,.03600000000000001,.03600000000000001]} : {}) });
const state = (index, center, velocity, fraction) => ({stepIndex:index,timeSeconds:index*dt,
  bodies:[body('b0','dynamic',{kind:'capsule',radiusM:.1,halfLengthM:.2},center,velocity),
    body('floor','static',{kind:'box',halfExtentsM:[.001,1,1]},[0,0,0],[0,0,0])],
  contacts:[],events:[],joints:[],ccdHits:fraction===null?[]:[{bodyId:'b0',fixtureId:'floor',toiFraction:fraction,normalFixtureToBody:[-1,0,0]}],
  pairStats:index?{eligiblePairs:8,candidatePairs:8,aabbTests:0}:{eligiblePairs:0,candidatePairs:0,aabbTests:0}});
export const literalWorldReferenceInput = freeze({
  initial:structuredClone(originalReferenceInput),stepIndex:1,outcome:'accepted',
  previousState:state(0,[-.4,0,0],[100,0,0],null),state:state(1,[-.101,0,0],[0,0,0],.3588),
  diagnostic:{acceptedStepIndex:1,stepSeconds:dt,startCenterM:[-.4,0,0],startVelocityMps:[100,0,0],
    hit:{dynamicBodyId:'b0',fixtureId:'floor',fraction:.3588,normal:[-1,0,0],pointM:[-.001,0,0],segmentPointM:[-.101,0,0]},
    hitTimeSeconds:.00299,remainingTimeSeconds:.005343333333333333,
    faceFinalCenterM:[-.101,0,0],faceFinalVelocityMps:[0,0,0],acceptedCenterM:[-.101,0,0],acceptedVelocityMps:[0,0,0]},
});
const changed = edit => { const value=structuredClone(literalWorldReferenceInput); edit(value); return value; };
export const literalWorldComparatorControls = freeze([
  {name:'independent-nominal-world-record',input:structuredClone(literalWorldReferenceInput),ok:true,resolved:true},
  {name:'nonzero-spin-exact-gate',input:changed(x=>{x.state.bodies[0].angularVelocityRadps[2]=1e-30;x.outcome='attempted-refused';}),ok:false,resolved:true},
  {name:'changed-orientation-exact-gate',input:changed(x=>x.state.bodies[0].orientation[1]=1e-30),ok:false,resolved:true},
  {name:'fixture-movement-exact-gate',input:changed(x=>x.state.bodies[1].positionM[0]=1e-30),ok:false,resolved:true},
  {name:'dropped-real-hit',input:changed(x=>{x.diagnostic.hit=null;x.state.ccdHits=[];}),ok:false,resolved:true},
  {name:'null-time-is-not-zero',input:changed(x=>x.diagnostic.hitTimeSeconds=null),ok:false,resolved:false},
  {name:'null-vector-is-not-zero',input:changed(x=>x.state.bodies[0].velocityMps[0]=null),ok:false,resolved:false},
  {name:'nonfinite-vector-codec',input:changed(x=>x.state.bodies[0].velocityMps[0]=NaN),ok:false,resolved:false},
  {name:'missing-vector-entry-codec',input:changed(x=>delete x.state.bodies[0].orientation[0]),ok:false,resolved:false},
  {name:'wrong-world-dynamic-ID',input:changed(x=>x.state.ccdHits[0].bodyId='floor'),ok:false,resolved:false},
]);

function finite(value,label) { assert.ok(typeof value==='number'&&Number.isFinite(value),label);return value; }
export async function runReferenceControls(ask) {
  const faceReceipts=await unchangedFaceControls(input=>ask({op:'face',input}));
  const worldReceipts=[];
  for(const control of literalWorldComparatorControls) {
    const input=structuredClone(control.input),before=structuredClone(input),reply=await ask(input);
    assert.deepEqual(input,before,control.name);assert.equal(reply.ok,control.ok,control.name);assert.equal(reply.resolved,control.resolved,control.name);
    if(control.resolved)for(const [name,value]of Object.entries(reply.metrics))finite(value,`${control.name}.${name}`);
    else assert.equal(reply.executionFailure,true,control.name);
    worldReceipts.push({name:control.name,reply,syntheticComparatorOnly:true});
  }
  const clear=changed(x=>{
    x.initial.velocityMps=[0,0,0];x.previousState.bodies[0].velocityMps=[0,0,0];
    x.state.bodies[0].positionM=[-.4,0,0];x.state.ccdHits=[];
    Object.assign(x.diagnostic,{hit:null,startVelocityMps:[0,0,0],hitTimeSeconds:0,remainingTimeSeconds:dt,
      faceFinalCenterM:[-.4,0,0],acceptedCenterM:[-.4,0,0]});
  });
  const clearReply=await ask(clear);assert.equal(clearReply.ok,true);assert.equal(clearReply.firstAbsoluteContactTimeSeconds,null);
  const touching=changed(x=>{
    x.initial.centerM=[-.101,0,0];x.previousState.bodies[0].positionM=[-.101,0,0];x.state.ccdHits[0].toiFraction=0;
    Object.assign(x.diagnostic,{startCenterM:[-.101,0,0],hitTimeSeconds:0,remainingTimeSeconds:dt});x.diagnostic.hit.fraction=0;
  });
  const touchReply=await ask(touching);assert.equal(touchReply.ok,true);assert.equal(finite(touchReply.firstAbsoluteContactTimeSeconds,'touch firsttime'),0);
  worldReceipts.push({name:'clear-null-versus-real-touch-zero',clearReply,touchReply,syntheticComparatorOnly:true});
  return {faceReceipts,worldReceipts,worldConstructed:false,worldStepped:false};
}
export const controls=runReferenceControls;
