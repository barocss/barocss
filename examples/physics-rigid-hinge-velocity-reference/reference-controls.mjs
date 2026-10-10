import assert from 'node:assert/strict';
import { literalCandidateControls as originalLiterals, orbitalLossCandidateControl }
  from '../physics-rigid-coupled-hinge-reference/reference-controls.mjs';

// Import authored parent data only. No candidate, pose or solver is called here.
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const referenceGates = freeze({
  positionM:1e-12, quaternion:1e-12, linearVelocityMps:1e-10, angularVelocityRadps:1e-9,
  objectiveJ:1e-10, coefficientRelative:1e-12, decimalAlgebra:'1e-25', scalarRepeatRad:1e-12,
  rawNormalized:1e-12, anchorM:1e-9, angleRad:1e-9, quaternionNorm:1e-9, axisRad:Math.PI/180,
  comM:1e-12, linearMomentumKgMps:1e-7, angularMomentumKgM2ps:1e-7,
  anchorVelocityMps:1e-9, transverseRateRadps:1e-9, outwardRateRadps:1e-9,
  dimensionlessCertificate:1e-10, pivotRelative:1e-12, conditionInf:1e12,
});
export const referenceErrors = freeze({
  input:'hinge velocity reference input is invalid',
  linear:'private hinge velocity linear data is invalid',
  system:'private hinge velocity system is singular or unsafe',
  certificate:'private hinge velocity certificate is invalid',
  raw:'hinge velocity reference raw13 encoding is invalid',
  carrier:'coupled hinge reference carrier cursor differs',
  statistics:'coupled hinge reference carrier statistics differ',
  ids:'Reference pair IDs are invalid',
});
const rest = structuredClone(originalLiterals[0].input);
const altered = (source,edit) => { const value=structuredClone(source);edit(value);return value; };
const parent = name => originalLiterals.find(row=>row.name===name).input;
const stop = (name,source,a,b,kind,active) => ({name,input:altered(parent(source),x=>{
  x.state.bodies[0].angularVelocityRadps=[0,0,a];x.state.bodies[1].angularVelocityRadps=[0,0,b];
}),expected:{stopKind:kind,activeStop:active}});
const originalExpectedKinds = [
  'none','none','none','none','none','upper','lower','none','none','none','none','none','none','none','none',
];
export const literalReferenceControls = freeze([
  ...originalLiterals.map((row,index)=>({name:row.name,input:structuredClone(row.input),
    expected:{stopKind:originalExpectedKinds[index],activeStop:false,
      ...(index<=1?{identity:true}:{}),
      ...(row.expected.linearMomentumKgMps!==undefined?{beforeLinearMomentumKgMps:row.expected.linearMomentumKgMps}:{}),
      ...(row.expected.angularMomentumKgM2ps!==undefined?{beforeAngularMomentumKgM2ps:row.expected.angularMomentumKgM2ps}:{}),
    }})),
  stop('upper-outward','slight-upper-excess',-1,1,'upper',true),
  stop('upper-inward','slight-upper-excess',1,-1,'upper',false),
  stop('lower-outward','slight-lower-excess',1,-1,'lower',true),
  stop('lower-inward','slight-lower-excess',-1,1,'lower',false),
  {name:'interior-positive-relative-rate',input:altered(rest,x=>{
    x.state.bodies[0].angularVelocityRadps=[0,0,-1];x.state.bodies[1].angularVelocityRadps=[0,0,1];
  }),expected:{stopKind:'none',activeStop:false}},
  {name:'interior-negative-relative-rate',input:altered(rest,x=>{
    x.state.bodies[0].angularVelocityRadps=[0,0,1];x.state.bodies[1].angularVelocityRadps=[0,0,-1];
  }),expected:{stopKind:'none',activeStop:false}},
  {name:'interior-transverse-rate',input:altered(rest,x=>{
    x.state.bodies[0].angularVelocityRadps=[1,0,0];x.state.bodies[1].angularVelocityRadps=[0,1,0];
  }),expected:{stopKind:'none',activeStop:false,identity:false}},
]);
export const genuineOrbitalReferenceControl = freeze({
  name:'genuine-admitted-parent-orbital-loss-FIRST',input:structuredClone(orbitalLossCandidateControl.input),
  expected:{stopKind:'none',activeStop:false,beforeAngularMomentumKgM2ps:.2},
  parentPoseOnlyNoGoRetained:true, actualCandidateEvidenceRequired:true,
});

// Pure algebra literals are independent fixed12DOF rows, not physical scenes.
const basis = Array.from({length:11},(_,i)=>Array.from({length:12},(_,j)=>i===j?1:0));
const pure = {a:basis,b:Array(11).fill(0),h:Array(12).fill(1),y0:Array(12).fill(0),stopKind:'none',stopRow:[]};
const linear = (name,edit,expected) => ({name,input:{op:'linear',problem:altered(pure,edit)},expected});
const withStop = (p,value) => {p.stopKind='upper';p.stopRow=Array.from({length:12},(_,i)=>i===11?1:0);p.y0[11]=value;};
export const literalLinearReferenceControls = freeze([
  linear('basis-exact-identity',()=>{},{identity:true,activeStop:false,rank:11,y:Array(12).fill(0),objective:0}),
  linear('basis-required-equality-correction',p=>p.y0[0]=1,{identity:false,activeStop:false,rank:11,y:Array(12).fill(0),objective:.5}),
  linear('basis-active-upper-stop',p=>withStop(p,1),{identity:false,activeStop:true,rank:12,y:Array(12).fill(0),objective:.5}),
  linear('basis-inactive-upper-stop',p=>withStop(p,-1),{identity:true,activeStop:false,rank:11,y:[0,0,0,0,0,0,0,0,0,0,0,-1],objective:0}),
  linear('basis-exact-zero-stop-inactive',p=>withStop(p,0),{identity:true,activeStop:false,rank:11,y:Array(12).fill(0),objective:0}),
]);
export const linearReferenceRefusals = freeze([
  linear('compatible-duplicate-row',p=>{p.a[10]=p.a[9].slice();p.b[0]=1;},{code:'REFERENCE_SYSTEM',message:referenceErrors.system}),
  linear('incompatible-duplicate-row',p=>{p.a[10]=p.a[9].slice();p.b[0]=1;p.b[10]=1;},{code:'REFERENCE_SYSTEM',message:referenceErrors.system}),
  linear('near-dependent-pivot',p=>{p.a[10]=p.a[9].slice();p.a[10][10]=1e-7;p.b[0]=1;},{code:'REFERENCE_SYSTEM',message:referenceErrors.system}),
  linear('zero-H',p=>p.h[0]=0,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('negative-H',p=>p.h[0]=-1,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('null-H',p=>p.h[0]=null,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('NaN-H-codec',p=>p.h[0]=NaN,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('unsafe-reciprocal-H',p=>p.h[0]=Number.MIN_VALUE,{code:'REFERENCE_SYSTEM',message:referenceErrors.system}),
  linear('unsafe-reciprocal-H-forcing',p=>{p.h[0]=Number.MIN_VALUE;p.b[0]=1;},{code:'REFERENCE_SYSTEM',message:referenceErrors.system}),
  linear('null-matrix-row',p=>p.a[0]=null,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('short-RHS',p=>p.b.pop(),{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('boolean-coefficient',p=>p.a[0][0]=true,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('extra-linear-key',p=>p.extra=0,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
  linear('none-stop-null',p=>p.stopRow=null,{code:'REFERENCE_INPUT',message:referenceErrors.linear}),
]);
export const physicalReferenceRefusals = freeze([
  {name:'null-dt',input:altered(rest,x=>x.dt=null),message:'coupled hinge reference requires finite numeric fields'},
  {name:'null-cursor',input:altered(rest,x=>x.state.stepIndex=null),message:referenceErrors.carrier},
  {name:'cursor-over-original-bound',input:altered(rest,x=>{x.state.stepIndex=3601;x.state.timeSeconds=3601*(1/120);}),message:referenceErrors.carrier},
  {name:'boolean-pair-counter',input:altered(rest,x=>x.state.pairStats.eligiblePairs=false),message:referenceErrors.statistics},
  {name:'null-position',input:altered(rest,x=>x.state.bodies[0].positionM[0]=null),message:referenceErrors.input},
  {name:'wrong-body-ID',input:altered(rest,x=>x.state.bodies[0].id='missing'),message:referenceErrors.ids},
  {name:'raw13-truncated',input:{...structuredClone(rest),beforeRawHex:'00'},message:referenceErrors.raw},
  {name:'raw13-spaces',input:{...structuredClone(rest),beforeRawHex:' '.repeat(416)},message:referenceErrors.raw},
  {name:'null-output',input:{...structuredClone(rest),output:null},message:referenceErrors.input},
  {name:'unknown-reference-op',input:{...structuredClone(rest),op:'candidate'},message:referenceErrors.input},
]);

function finite(value,label){assert.ok(typeof value==='number'&&Number.isFinite(value),label);return value;}
function close(value,wanted,gate,label){assert.ok(Math.abs(finite(value,label)-wanted)<=gate,label);}
function exactNumber(pair,label){
  assert.ok(Array.isArray(pair)&&pair.length===2&&pair.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)),label);
  assert.ok(BigInt(pair[1])>0n,label);return Number(pair[0])/Number(pair[1]);
}
function qualified(reply,name){
  assert.equal(reply.resolved,true,name);assert.equal(reply.executionFailure,false,name);assert.equal(reply.ok,true,name);
  assert.ok(finite(reply.metrics.precisionMaxDifference,name)<=1e-25,name);
  assert.ok(finite(reply.metrics.scalarRepeatMaxDifferenceRad,name)<=1e-12,name);
  const cert=reply.certificate.expected;
  for(const key of ['primalZero','stationarityZero','stopKktPassed'])assert.equal(cert[key],true,name);
  assert.equal(cert.rowCount,cert.activeStop?12:11,name);assert.equal(cert.rank,cert.rowCount,name);
}
function physicalReceipt(reply,control){
  qualified(reply,control.name);
  assert.equal(reply.reference.projection.stopKind,control.expected.stopKind,control.name);
  assert.equal(reply.certificate.expected.activeStop,control.expected.activeStop,control.name);
  if('identity'in control.expected)assert.equal(reply.certificate.expected.identity,control.expected.identity,control.name);
  if('beforeAngularMomentumKgM2ps'in control.expected)for(const mode of ['raw','normalized'])
    close(reply.reference.before[mode].angularMomentumKgM2ps,control.expected.beforeAngularMomentumKgM2ps,1e-12,control.name);
  if('beforeLinearMomentumKgMps'in control.expected)for(const mode of ['raw','normalized'])
    close(reply.reference.before[mode].linearMomentumKgMps,control.expected.beforeLinearMomentumKgMps,1e-12,control.name);
  assert.equal(reply.reference.nativeInertiaKgM2.length,2,control.name);
  reply.reference.nativeInertiaKgM2.forEach(x=>assert.equal(finite(x,control.name),.4*1*.1**2,control.name));
}
export async function runReferenceControls(ask){
  const physical=[],linear=[],refusals=[],certificateGuards=[];
  // Prediction receipts do not replace the actual31candidate outputs per graph.
  for(const control of [genuineOrbitalReferenceControl,...literalReferenceControls]){
    const input=structuredClone(control.input),saved=structuredClone(input),reply=await ask(input);
    assert.deepEqual(input,saved,control.name);physicalReceipt(reply,control);
    physical.push({name:control.name,reply,referencePredictionOnly:true,actualCandidateEvidenceRequired:true});
  }
  for(const control of literalLinearReferenceControls){
    const reply=await ask(structuredClone(control.input));qualified(reply,control.name);
    assert.equal(reply.certificate.expected.identity,control.expected.identity,control.name);
    assert.equal(reply.certificate.expected.activeStop,control.expected.activeStop,control.name);
    assert.equal(reply.certificate.expected.rank,control.expected.rank,control.name);
    reply.reference.expectedY.forEach((x,i)=>close(x,control.expected.y[i],1e-12,control.name));
    close(exactNumber(reply.certificate.expected.objectiveExact,control.name),control.expected.objective,1e-12,control.name);
    linear.push({name:control.name,reply,pureAlgebraGuard:true});
  }
  for(const control of linearReferenceRefusals){
    const reply=await ask(structuredClone(control.input));assert.equal(reply.ok,false,control.name);
    assert.equal(reply.code,control.expected.code,control.name);assert.equal(reply.message,control.expected.message,control.name);
    assert.equal(reply.resolved,control.expected.code==='REFERENCE_SYSTEM',control.name);
    assert.equal(reply.executionFailure,control.expected.code==='REFERENCE_INPUT',control.name);
    refusals.push({name:control.name,reply,pureAlgebraGuard:true});
  }
  for(const control of physicalReferenceRefusals){
    const reply=await ask(structuredClone(control.input));assert.equal(reply.ok,false,control.name);
    assert.equal(reply.resolved,false,control.name);assert.equal(reply.executionFailure,true,control.name);
    assert.equal(reply.code,'REFERENCE_INPUT',control.name);assert.equal(reply.message,control.message,control.name);
    refusals.push({name:control.name,reply,referenceProtocolGuard:true});
  }
  // Authored literal certificate, no candidate-produced certificate is reused.
  const identity={y:Array(12).fill(0),lambda:Array(11).fill(0),activeStop:false,identity:true,solveAttempts:0,phases:[],
    objectiveDimensionless:0,certificate:{primal:0,stationarity:0,negativeMu:0,complementarity:0,objective:0}};
  const activeProblem=structuredClone(pure);withStop(activeProblem,1);
  const phase=(count,y,lambda)=>({rowIds:Array.from({length:count},(_,i)=>i),rowCount:count,pivots:Array(count).fill(1),
    inverse:Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>i===j?1:0)),normInf:1,conditionInf:1,
    lambda,y,residuals:{linear:0,inverse:0}});
  const freeY=[0,0,0,0,0,0,0,0,0,0,0,1],activeLambda=[0,0,0,0,0,0,0,0,0,0,0,-1];
  const activeLiteral={y:Array(12).fill(0),lambda:activeLambda,activeStop:true,identity:false,solveAttempts:2,
    phases:[phase(11,freeY,Array(11).fill(0)),phase(12,Array(12).fill(0),activeLambda)],
    objectiveDimensionless:.5,certificate:{primal:0,stationarity:0,negativeMu:0,complementarity:0,objective:0}};
  const certificateCases=[
    {name:'literal-identity-certificate',edit:()=>{},ok:true},
    {name:'literal-certificate-y-primal-spoof',edit:r=>r.y[0]=1,ok:false},
    {name:'literal-certificate-objective-spoof',edit:r=>r.objectiveDimensionless=1,ok:false},
    {name:'literal-certificate-null-y',edit:r=>r.y[0]=null,error:true},
    {name:'literal-certificate-NaN-y-codec',edit:r=>r.y[0]=NaN,error:true},
    {name:'literal-certificate-extra-key',edit:r=>r.extra=0,error:true},
    {name:'literal-certificate-boolean-identity',edit:r=>r.identity=0,error:true},
    {name:'literal-active-certificate',base:activeLiteral,problem:activeProblem,edit:()=>{},ok:true},
    {name:'literal-active-multiplier-sign-spoof',base:activeLiteral,problem:activeProblem,edit:r=>r.lambda[11]=1,ok:false},
    {name:'literal-active-choice-spoof',base:activeLiteral,problem:activeProblem,edit:r=>{
      r.activeStop=false;r.solveAttempts=1;r.phases=[r.phases[0]];r.y=freeY.slice();r.lambda=Array(11).fill(0);r.objectiveDimensionless=0;
    },ok:false},
  ];
  for(const control of certificateCases){
    const result=structuredClone(control.base??identity);control.edit(result);
    const reply=await ask({op:'linear',problem:structuredClone(control.problem??pure),result});
    if(control.error){assert.equal(reply.code,'REFERENCE_INPUT',control.name);assert.equal(reply.executionFailure,true,control.name);assert.equal(reply.message,referenceErrors.certificate,control.name);}
    else {assert.equal(reply.resolved,true,control.name);assert.equal(reply.executionFailure,false,control.name);assert.equal(reply.ok,control.ok,control.name);}
    certificateGuards.push({name:control.name,reply,pureAlgebraComparatorProof:true});
  }
  const input={op:'linear',problem:structuredClone(pure)},first=await ask(input),saved=structuredClone(first);
  first.reference.expectedY[0]=999;first.certificate.expected.yExact[0][0]='999';
  assert.deepEqual(await ask(input),saved,'independent copied reply repeat');
  return {physical,linear,refusals,certificateGuards,replyCopyIsolated:true,worldCreated:false,worldStepped:false,
    motorDriven:false,oldProjectionCalled:false,successfulCandidateCalls:0};
}
export const controls=runReferenceControls;
