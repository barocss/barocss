import assert from 'node:assert/strict';
import {kernelCases} from './literal-cases.mjs';

// Frozen authored data only. Root executes these controls after complete freeze.
// No native solver, query, World or old choice API is called by this module.
export const referenceErrors=Object.freeze({input:'full-pair world reference request is invalid',json:'full-pair world reference line must be valid JSON'});
export const referenceGates=Object.freeze({geometryM:1e-12,coefficientM:1e-12,certificatePerUnit:1e-12,objectiveKgM2:1e-12,
  decimalPerUnit:1e-25,momentumKgMps:1e-7,angularMomentumKgM2ps:1e-7,freeVelocityMps:1e-10,freeOmegaRadps:1e-10,freePositionM:1e-12});
const DT=1/120,clone=structuredClone;
const kernelInput=problem=>({op:'kernel',scope:'full-pair',problem:clone(problem),result:null});
const simple=()=>({bodies:[{id:'a',inverseMass:1},{id:'b',inverseMass:1}],rows:[{aId:'a',bId:'b',normal:[1,0,0],boundM:.1}]});
function finite(value,label){assert.equal(typeof value,'number',label);assert.ok(Number.isFinite(value),label);return value;}
function qualified(reply,id){assert.equal(reply.resolved,true,id);assert.equal(reply.executionFailure,false,id);assert.equal(reply.ok,true,id);assert.deepEqual(reply.violations,[],id);}
async function ask(reference,input){const saved=clone(input),reply=await reference.ask(input);assert.deepEqual(input,saved,'reference input copy');return reply;}
function body(id,kind='dynamic',p=[0,0,0]){
  return {id,kind,shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:p.slice(),velocityMps:[0,0,0],orientation:[0,0,0,1],angularVelocityRadps:[0,0,0],
    inverseMass:kind==='dynamic'?1:0,...(kind==='dynamic'?{inertiaDiagonalKgM2:[1/24,1/24,1/24]}:{}),inverseInertiaLocal:kind==='dynamic'?[24,24,24]:[0,0,0],sensor:false,restitution:0,frictionStatic:1,frictionDynamic:.7};
}
function hex(bodies){const bytes=Buffer.alloc(bodies.length*104);let offset=0;for(const b of bodies)for(const field of ['positionM','velocityMps','orientation','angularVelocityRadps'])for(const v of b[field]){finite(v,'raw literal');bytes.writeDoubleLE(v,offset);offset+=8;}assert.equal(offset,bytes.length);return bytes.toString('hex');}
function ledger(bodies=[body('a')]){return {op:'step-ledger',scene:'REFERENCE-GUARD',stepIndex:1,outcome:'accepted',ledger:{beforeBodies:clone(bodies),freeBodies:clone(bodies),velocityBodies:clone(bodies),finalBodies:clone(bodies),fixedStepSeconds:DT,gravityMps2:[0,0,0],actions:[],points:[]},raw:{}};}
function encode(input){input.raw=Object.fromEntries(['before','free','velocity','final'].map(k=>[k,hex(input.ledger[k+'Bodies'])]));return input;}
function free(input){input.ledger.velocityBodies=clone(input.ledger.freeBodies);input.ledger.finalBodies=clone(input.ledger.freeBodies);return encode(input);}
function contact({warm=0,normalNs=3,tangent=[0,0,0],offCentre=false,shift=false}={}){
  const x=ledger([body('a-floor','static'),body('b')]);
  x.ledger.points=[{aId:'a-floor',bId:'b',aIndex:0,bIndex:1,pairKey:'a-floor\0b',pointId:'authored-point',family:'face',pointM:offCentre?[1,0,0]:[0,0,0],normal:[0,1,0],aPositionM:[0,0,0],bPositionM:[0,0,0],warm:{normalNs:warm,tangentNs:[0,0,0]},final:{normalNs,tangentNs:tangent.slice()}}];
  x.ledger.velocityBodies[1].velocityMps=[tangent[0],normalNs+tangent[1],tangent[2]];
  x.ledger.velocityBodies[1].angularVelocityRadps=offCentre?[0,-24*tangent[2],24*(normalNs+tangent[1])]:[0,0,0];
  x.ledger.finalBodies=clone(x.ledger.velocityBodies);if(shift)x.ledger.finalBodies[1].positionM=[.1,0,0];return encode(x);
}
function gravity(nonzeroP=false){const x=ledger([body('a','dynamic',[0,.25,0])]);x.ledger.gravityMps2=[0,-9.81,0];if(nonzeroP)x.ledger.beforeBodies[0].velocityMps=[1,0,0];x.ledger.freeBodies[0].velocityMps=[nonzeroP?1:0,-9.81*DT,0];x.ledger.freeBodies[0].positionM=[nonzeroP?DT:0,.25+(-9.81*DT)*DT,0];return free(x);}
function internal(offCentre=false){const x=ledger([body('a','dynamic',[-.25,0,0]),body('b','dynamic',[.25,0,0])]);x.ledger.points=[{aId:'a',bId:'b',aIndex:0,bIndex:1,pairKey:'a\0b',pointId:'authored-point',family:'face',pointM:offCentre?[0,1,0]:[0,0,0],normal:[1,0,0],aPositionM:[-.25,0,0],bPositionM:[.25,0,0],warm:{normalNs:0,tangentNs:[0,0,0]},final:{normalNs:1,tangentNs:[0,0,0]}}];x.ledger.velocityBodies[0].velocityMps=[-1,0,0];x.ledger.velocityBodies[1].velocityMps=[1,0,0];if(offCentre){x.ledger.velocityBodies[0].angularVelocityRadps=[0,0,24];x.ledger.velocityBodies[1].angularVelocityRadps=[0,0,-24];}x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}
function angular(command=false,anisotropic=false){const b=body('a');if(anisotropic){b.shape.halfExtentsM=[.25,.5,.25];b.inertiaDiagonalKgM2=[1/3*(.5**2+.25**2),1/3*(.25**2+.25**2),1/3*(.25**2+.5**2)];b.inverseInertiaLocal=b.inertiaDiagonalKgM2.map(x=>1/x);}const x=ledger([b]),w=anisotropic?[1,2,0]:[0,0,1];if(command)x.ledger.actions=[['a',{angularImpulseNms:[0,0,1/48],torqueNm:[0,0,(1/48)/DT]}]];else x.ledger.beforeBodies[0].angularVelocityRadps=w.slice();x.ledger.freeBodies[0].angularVelocityRadps=w.slice();const speed=Math.hypot(...w),half=speed*DT/2,factor=Math.sin(half)/speed;x.ledger.freeBodies[0].orientation=[...w.map(v=>v*factor),Math.cos(half)];return free(x);}

export const ledgerPositiveIds=Object.freeze(['zero-ledger','gravity','nonzero-P-gravity','force-plus-impulse','angular-command','orientation-only-isotropic','orientation-only-anisotropic','internal-point','internal-point-torque','external-floor-point','warm-plus-deltas-net-final','floor-offcentre-torque','tangent-point','mixed-point','position-orbital-artifact','static-negative-zero','qsign-equivalent']);
export const ledgerSpoofIds=Object.freeze(['final-minus-warm-spoof','wrong-endpoint-sign','mean-point-torque-spoof','free-v-spoof','free-omega-spoof','free-p-spoof','position-velocity-compensation','velocity-phase-position-change','position-q-change']);
export const referenceProtocolIds=Object.freeze(['unknown-op','extra-request-key','missing-problem','null-problem','null-result-member','null-mass','boolean-mass','empty-bodies','duplicate-ID','wrong-endpoint','null-normal','boolean-normal','wrong-normal-length','null-bound','boolean-bound','bound-outside','mass-below','mass-above','mass-negative','mass-subnormal','too-many-bodies','too-many-rows','unknown-scope','null-ledger','extra-ledger-key','null-dt','boolean-dt','null-vector','boolean-vector','wrong-ID','truncated-raw','raw-JSON-mismatch','wrong-point-index','wrong-pair-key','null-final-accumulator','malformed-action','duplicate-action-ID','unknown-action-key','bad-outcome']);

export async function referenceControls(reference,m){
  void m;const receipts=[];
  // Native unsafe is compatible with an independent exact SOLVED reference.
  // L03 genuine ninth row belongs exclusively to root's first actual query.
  for(const literal of kernelCases()){
    const input=kernelInput(literal.problem),reply=await ask(reference,input);qualified(reply,literal.id);
    assert.equal(reply.referenceStatus,literal.status==='NUMERIC_UNSAFE'?'SOLVED':literal.status,literal.id);
    assert.equal(reply.metrics,null,literal.id+' no native solution supplied');
    assert.equal(reply.reference.counters.lpPivots<=4096,true,literal.id);assert.equal(reply.reference.counters.qpTransitions<=4096,true,literal.id);
    if(reply.referenceStatus==='SOLVED')for(const key of ['primalViolationM','negativeMultiplierKgM','complementarityKgM2','stationarityKgM'])assert.equal(reply.reference.certificateExact[key],'0/1',literal.id);
    receipts.push({id:literal.id,kind:'independent-input-only-optimum',reply,nativeSolverCalled:false,worldCreated:false});
  }
  const positive=[encode(ledger()),gravity(),gravity(true)];
  const force=ledger([body('a','dynamic',[0,.25,0])]);force.ledger.actions=[['a',{impulseNs:[2,0,0],forceN:[120,0,0]}]];force.ledger.freeBodies[0].velocityMps=[3,0,0];force.ledger.freeBodies[0].positionM=[3*DT,.25,0];positive.push(free(force),angular(true),angular(),angular(false,true),internal(),internal(true),contact(),contact({warm:2}),contact({offCentre:true}),contact({normalNs:0,tangent:[1,0,0]}),contact({normalNs:1,tangent:[1,0,0]}),contact({offCentre:true,shift:true}));
  const zero=ledger([body('a-floor','static',[-0,0,0]),body('b')]);for(const field of ['beforeBodies','freeBodies','velocityBodies','finalBodies']){zero.ledger[field][0].velocityMps[1]=-0;zero.ledger[field][1].angularVelocityRadps[2]=-0;}positive.push(encode(zero));
  const sign=ledger();for(const field of ['beforeBodies','freeBodies','velocityBodies','finalBodies'])sign.ledger[field][0].orientation=[-0,-0,-0,-1];positive.push(encode(sign));
  assert.equal(positive.length,ledgerPositiveIds.length);
  for(let i=0;i<positive.length;i++){const id=ledgerPositiveIds[i],reply=await ask(reference,positive[i]);qualified(reply,id);assert.equal(reply.metrics.positionVelocityBitsHeld,true,id);assert.equal(reply.reference.separateFrictionWorkMeasured,false,id);for(const key of ['freeLinearMomentumResidualKgMps','freeAngularMomentumResidualKgM2ps','velocityLinearMomentumResidualKgMps','velocityAngularMomentumResidualKgM2ps','stepLinearMomentumResidualKgMps','stepAngularMomentumResidualKgM2ps'])assert.ok(finite(reply.metrics[key],id)<=1e-7,id);receipts.push({id,kind:'adopted-ledger-literal',reply,worldCreated:false,solverCalled:false});}
  const base=encode(ledger()),pointBase=contact({warm:2});
  const protocol=[
    ['unknown-op',()=>({...kernelInput(simple()),op:'unknown'})],['extra-request-key',()=>({...kernelInput(simple()),extra:0})],['missing-problem',()=>({op:'kernel',scope:'full-pair',result:null})],['null-problem',()=>({...kernelInput(simple()),problem:null})],['null-result-member',()=>({...kernelInput(simple()),result:{status:'SOLVED',translations:null}})],
    ...[['null-mass',null],['boolean-mass',false],['mass-below',5e-7],['mass-above',2e6],['mass-negative',-1],['mass-subnormal',Number.MIN_VALUE]].map(([id,value])=>[id,()=>{const x=kernelInput(simple());x.problem.bodies[0].inverseMass=value;return x;}]),
    ['empty-bodies',()=>kernelInput({bodies:[],rows:[]})],['duplicate-ID',()=>{const x=kernelInput(simple());x.problem.bodies[1].id='a';return x;}],['wrong-endpoint',()=>{const x=kernelInput(simple());x.problem.rows[0].aId='missing';return x;}],
    ['null-normal',()=>{const x=kernelInput(simple());x.problem.rows[0].normal=null;return x;}],['boolean-normal',()=>{const x=kernelInput(simple());x.problem.rows[0].normal[0]=true;return x;}],['wrong-normal-length',()=>{const x=kernelInput(simple());x.problem.rows[0].normal=[1,0];return x;}],
    ...[['null-bound',null],['boolean-bound',false],['bound-outside',10.0001]].map(([id,value])=>[id,()=>{const x=kernelInput(simple());x.problem.rows[0].boundM=value;return x;}]),
    ['too-many-bodies',()=>kernelInput({bodies:Array.from({length:10},(_,i)=>({id:'b'+i,inverseMass:1})),rows:[]})],['too-many-rows',()=>{const x=kernelInput(simple());x.problem.rows=Array.from({length:37},()=>clone(x.problem.rows[0]));return x;}],['unknown-scope',()=>({...kernelInput(simple()),scope:'choice'})],
    ['null-ledger',()=>({...clone(base),ledger:null})],['extra-ledger-key',()=>{const x=clone(base);x.ledger.extra=0;return x;}],['null-dt',()=>{const x=clone(base);x.ledger.fixedStepSeconds=null;return x;}],['boolean-dt',()=>{const x=clone(base);x.ledger.fixedStepSeconds=false;return x;}],['null-vector',()=>{const x=clone(base);x.ledger.beforeBodies[0].velocityMps[0]=null;return x;}],['boolean-vector',()=>{const x=clone(base);x.ledger.beforeBodies[0].velocityMps[0]=false;return x;}],['wrong-ID',()=>{const x=clone(base);x.ledger.freeBodies[0].id='missing';return x;}],['truncated-raw',()=>{const x=clone(base);x.raw.before='00';return x;}],['raw-JSON-mismatch',()=>{const x=clone(base);x.ledger.beforeBodies[0].positionM[0]=1;return x;}],['wrong-point-index',()=>{const x=clone(pointBase);x.ledger.points[0].aIndex=99;return x;}],['wrong-pair-key',()=>{const x=clone(pointBase);x.ledger.points[0].pairKey='missing';return x;}],['null-final-accumulator',()=>{const x=clone(pointBase);x.ledger.points[0].final.normalNs=null;return x;}],['malformed-action',()=>{const x=clone(base);x.ledger.actions=[null];return x;}],['duplicate-action-ID',()=>{const x=clone(base);x.ledger.actions=[['a',{}],['a',{}]];return x;}],['unknown-action-key',()=>{const x=clone(base);x.ledger.actions=[['a',{unknown:[0,0,0]}]];return x;}],['bad-outcome',()=>({...clone(base),outcome:'partial'})]
  ];
  assert.deepEqual(new Set(protocol.map(x=>x[0])),new Set(referenceProtocolIds));
  for(const [id,make]of protocol){const reply=await ask(reference,make());assert.equal(reply.ok,false,id);assert.equal(reply.resolved,false,id);assert.equal(reply.executionFailure,true,id);assert.equal(reply.code,'REFERENCE_INPUT',id);assert.equal(reply.message,referenceErrors.input,id);receipts.push({id,kind:'strict-protocol-refusal',reply});}
  const spoofs=[
    ['final-minus-warm-spoof',()=>{const x=clone(pointBase);x.ledger.velocityBodies[1].velocityMps=[0,1,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],['wrong-endpoint-sign',()=>{const x=contact();x.ledger.velocityBodies[1].velocityMps=[0,-3,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],['mean-point-torque-spoof',()=>{const x=contact({offCentre:true});x.ledger.points[0].pointM=[0,0,0];return x;}],['free-v-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].velocityMps=[1,0,0];x.ledger.freeBodies[0].positionM=[DT,0,0];return free(x);}],['free-omega-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].angularVelocityRadps=[0,0,1];return free(x);}],['free-p-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].positionM=[.1,0,0];return free(x);}],['position-velocity-compensation',()=>{const x=clone(base);x.ledger.finalBodies[0].velocityMps=[1,0,0];return encode(x);}],['velocity-phase-position-change',()=>{const x=clone(base);x.ledger.velocityBodies[0].positionM=[.1,0,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],['position-q-change',()=>{const x=clone(base);x.ledger.finalBodies[0].orientation=[0,0,1,0];return encode(x);}]
  ];
  assert.deepEqual(spoofs.map(x=>x[0]),ledgerSpoofIds);
  for(const [id,make]of spoofs){const reply=await ask(reference,make());assert.equal(reply.resolved,true,id);assert.equal(reply.executionFailure,false,id);assert.equal(reply.ok,false,id);assert.ok(reply.violations.length>0,id);receipts.push({id,kind:'known-budget-spoof',reply,notPhysicalWorldEvidence:true});}
  const zeroReceipt=receipts.find(x=>x.id==='zero-ledger'),first=clone(zeroReceipt.reply);zeroReceipt.reply.metrics.freeLinearMomentumResidualKgMps=123;
  const fresh=await ask(reference,base);assert.deepEqual(fresh,first,'fresh reference output is isolated from copied output mutation');
  zeroReceipt.reply=first;
  return {receipts,copyIsolation:true,worldCreated:false,worldStepped:false,producerCalls:0,solverCalls:0,
    independentKernelControls:kernelCases().length,positiveLedgerControls:positive.length,protocolControls:protocol.length,budgetSpoofControls:spoofs.length};
}
export const runReferenceControls=referenceControls;
