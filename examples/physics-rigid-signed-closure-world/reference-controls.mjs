import assert from 'node:assert/strict';

// Authored accounting/representation data. No producer, query, solver or World
// is called by these controls. They run only after root's complete freeze.
export const referenceErrors = Object.freeze({input:'live signed world reference request is invalid',json:'live signed world reference line must be valid JSON'});
export const referenceGates = Object.freeze({geometryM:1e-12,decimalPerUnit:1e-25,momentumKgMps:1e-7,angularMomentumKgM2ps:1e-7,
  freeVelocityMps:1e-10,freeOmegaRadps:1e-10,freePositionM:1e-12,coefficientM:1e-12});
const DT=1/120;
const clone=structuredClone;
function body(id,kind='dynamic',p=[0,0,0]){
  return {id,kind,shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:p.slice(),velocityMps:[0,0,0],
    orientation:[0,0,0,1],angularVelocityRadps:[0,0,0],inverseMass:kind==='dynamic'?1:0,
    ...(kind==='dynamic'?{inertiaDiagonalKgM2:[1/24,1/24,1/24]}:{}),inverseInertiaLocal:kind==='dynamic'?[24,24,24]:[0,0,0],
    sensor:false,restitution:0,frictionStatic:1,frictionDynamic:.7};
}
function hex(bodies){
  const bytes=Buffer.alloc(104*bodies.length);let offset=0;
  for(const b of bodies)for(const field of ['positionM','velocityMps','orientation','angularVelocityRadps'])for(const x of b[field]){
    assert.equal(typeof x,'number');bytes.writeDoubleLE(x,offset);offset+=8;
  }
  assert.equal(offset,bytes.length);return bytes.toString('hex');
}
function ledgerInput(bodies=[body('a')]){
  const ledger={beforeBodies:clone(bodies),freeBodies:clone(bodies),velocityBodies:clone(bodies),finalBodies:clone(bodies),
    fixedStepSeconds:DT,gravityMps2:[0,0,0],actions:[],points:[]};
  return {op:'step-ledger',scene:'REFERENCE-GUARD',stepIndex:1,outcome:'accepted',ledger,raw:{}};
}
function encode(input){
  input.raw={before:hex(input.ledger.beforeBodies),free:hex(input.ledger.freeBodies),velocity:hex(input.ledger.velocityBodies),final:hex(input.ledger.finalBodies)};
  return input;
}
function replicateFree(input){input.ledger.velocityBodies=clone(input.ledger.freeBodies);input.ledger.finalBodies=clone(input.ledger.freeBodies);return input;}
function point(input,ai,bi,normal=[0,1,0],position=[0,0,0],warmNormal=0,finalNormal=0,tangent=[0,0,0]){
  const a=input.ledger.freeBodies[ai],b=input.ledger.freeBodies[bi];
  input.ledger.points.push({aId:a.id,bId:b.id,aIndex:ai,bIndex:bi,pairKey:a.id+'\0'+b.id,pointId:'authored-point',family:'face',
    pointM:position.slice(),normal:normal.slice(),aPositionM:a.positionM.slice(),bPositionM:b.positionM.slice(),
    warm:{normalNs:warmNormal,tangentNs:[0,0,0]},final:{normalNs:finalNormal,tangentNs:tangent.slice()}});
}
function floorImpulse({warm=0,final=3,offCentre=false,tangent=[0,0,0],shift=false}={}){
  const x=ledgerInput([body('a-floor','static'),body('b')]);
  point(x,0,1,[0,1,0],offCentre?[1,0,0]:[0,0,0],warm,final,tangent);
  x.ledger.velocityBodies[1].velocityMps=[tangent[0],final+tangent[1],tangent[2]];
  x.ledger.velocityBodies[1].angularVelocityRadps=offCentre?[0,-24*tangent[2],24*(final+tangent[1])]:[0,0,0];
  x.ledger.finalBodies=clone(x.ledger.velocityBodies);
  if(shift)x.ledger.finalBodies[1].positionM=[.1,0,0];
  return encode(x);
}
function internalPoint(offCentre=false){
  const x=ledgerInput([body('a','dynamic',[-.25,0,0]),body('b','dynamic',[.25,0,0])]);
  point(x,0,1,[1,0,0],offCentre?[0,1,0]:[0,0,0],0,1);
  x.ledger.velocityBodies[0].velocityMps=[-1,0,0];x.ledger.velocityBodies[1].velocityMps=[1,0,0];
  if(offCentre){x.ledger.velocityBodies[0].angularVelocityRadps=[0,0,24];x.ledger.velocityBodies[1].angularVelocityRadps=[0,0,-24];}
  x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);
}
function gravityInput(nonzeroP=false){
  const x=ledgerInput([body('a','dynamic',[0,.25,0])]);x.ledger.gravityMps2=[0,-9.81,0];
  if(nonzeroP)x.ledger.beforeBodies[0].velocityMps=[1,0,0];
  x.ledger.freeBodies[0].velocityMps=[nonzeroP?1:0,-9.81*DT,0];
  x.ledger.freeBodies[0].positionM=[nonzeroP?DT:0,.25+(-9.81*DT)*DT,0];
  return encode(replicateFree(x));
}
function angularInput(command=false,anisotropic=false){
  const b=body('a');if(anisotropic){b.shape.halfExtentsM=[.25,.5,.25];b.inertiaDiagonalKgM2=[1/3*(.5**2+.25**2),1/3*(.25**2+.25**2),1/3*(.25**2+.5**2)];b.inverseInertiaLocal=b.inertiaDiagonalKgM2.map(x=>1/x);}
  const x=ledgerInput([b]);const w=anisotropic?[1,2,0]:[0,0,1];
  if(command){x.ledger.actions=[['a',{angularImpulseNms:[0,0,1/48],torqueNm:[0,0,(1/48)/DT]}]];}
  else{x.ledger.beforeBodies[0].angularVelocityRadps=w.slice();}
  x.ledger.freeBodies[0].angularVelocityRadps=w.slice();
  const speed=Math.hypot(...w),half=speed*DT/2,factor=Math.sin(half)/speed;
  x.ledger.freeBodies[0].orientation=[...w.map(v=>v*factor),Math.cos(half)];
  return encode(replicateFree(x));
}
function emptyChoice(){
  const pre=[body('a','dynamic',[-1,0,0]),body('b','dynamic',[1,0,0])];
  return {op:'choice',scene:'REFERENCE-GUARD',stepIndex:1,choiceIndex:0,
    config:{fixedStepSeconds:DT,gravityMps2:[0,0,0],bodies:[]},preBodies:clone(pre),preRawHex:hex(pre),
    problem:{bodies:pre.map(b=>({id:b.id,inverseMass:b.inverseMass})),rows:[]},rowSelections:[],hypBodies:clone(pre),hypRawHex:hex(pre),
    result:{ok:true,status:'SOLVED',activeMask:0,active:[],lambdaKgM:[],translations:pre.map(b=>({id:b.id,u:[0,0,0]})),primalMarginsM:[],
      objectiveKgM2:0,certificate:{primalViolationM:0,negativeMultiplierKgM:0,complementarityKgM2:0,stationarityKgM:0},gram:[],singularMasks:[],infeasibleMasks:0,enumeratedMasks:1,worldStepped:false},
    previousChoiceRows:[]};
}
export const positiveReferenceControlIds=Object.freeze(['zero-ledger','gravity','nonzero-P-gravity','force-plus-impulse','angular-command',
  'orientation-only-isotropic','orientation-only-anisotropic','internal-point','internal-point-torque','external-floor-point','warm-plus-deltas-net-final',
  'floor-offcentre-torque','tangent-point','mixed-point','position-orbital-artifact','static-negative-zero','qsign-equivalent','empty-separated-choice','partial-solved-choice']);
export const protocolReferenceControlIds=Object.freeze(['unknown-op','extra-request-key','null-ledger','extra-ledger-key','null-dt','boolean-dt',
  'null-vector','boolean-vector','nonfinite-codec','wrong-ID','truncated-raw','raw-JSON-mismatch','wrong-point-index','wrong-pair-key',
  'null-final-accumulator','malformed-action','duplicate-action-ID','unknown-action-key','bad-outcome','choice-extra-key','choice-raw-length','choice-boolean-mass']);
export const budgetSpoofControlIds=Object.freeze(['final-minus-warm-spoof','wrong-endpoint-sign','mean-point-torque-spoof','free-v-spoof',
  'free-omega-spoof','free-p-spoof','position-velocity-compensation','velocity-phase-position-change','position-q-change']);
function numeric(value,label){assert.equal(typeof value,'number',label);assert.ok(Number.isFinite(value),label);return value;}
async function call(reference,input){const saved=clone(input),reply=await reference.ask(input);assert.deepEqual(input,saved,'reference input copy');return reply;}
function qualified(reply,id){assert.equal(reply.resolved,true,id);assert.equal(reply.executionFailure,false,id);assert.equal(reply.ok,true,id);assert.deepEqual(reply.violations,[],id);}
export async function referenceControls(reference,m){
  void m;const receipts=[];
  const positive=[];
  positive.push(encode(ledgerInput()),gravityInput(),gravityInput(true));
  const force=ledgerInput([body('a','dynamic',[0,.25,0])]);force.ledger.actions=[['a',{impulseNs:[2,0,0],forceN:[120,0,0]}]];
  force.ledger.freeBodies[0].velocityMps=[3,0,0];force.ledger.freeBodies[0].positionM=[3*DT,.25,0];positive.push(encode(replicateFree(force)));
  positive.push(angularInput(true),angularInput(false),angularInput(false,true),internalPoint(),internalPoint(true),floorImpulse(),
    floorImpulse({warm:2,final:3}),floorImpulse({offCentre:true}),floorImpulse({final:0,tangent:[1,0,0]}),floorImpulse({final:1,tangent:[1,0,0]}),floorImpulse({offCentre:true,shift:true}));
  const zero=ledgerInput([body('a-floor','static',[-0,0,0]),body('b')]);for(const field of ['beforeBodies','freeBodies','velocityBodies','finalBodies']){zero.ledger[field][0].velocityMps[1]=-0;zero.ledger[field][1].angularVelocityRadps[2]=-0;}positive.push(encode(zero));
  const sign=ledgerInput();for(const field of ['beforeBodies','freeBodies','velocityBodies','finalBodies'])sign.ledger[field][0].orientation=[-0,-0,-0,-1];positive.push(encode(sign),emptyChoice());
  const partial=emptyChoice();partial.hypBodies=null;partial.hypRawHex=null;positive.push(partial);
  assert.equal(positive.length,positiveReferenceControlIds.length);
  for(let i=0;i<positive.length;i++){
    const id=positiveReferenceControlIds[i],reply=await call(reference,positive[i]);qualified(reply,id);
    if(positive[i].op==='step-ledger'){
      for(const key of ['freeLinearMomentumResidualKgMps','freeAngularMomentumResidualKgM2ps','velocityLinearMomentumResidualKgMps','velocityAngularMomentumResidualKgM2ps','stepLinearMomentumResidualKgMps','stepAngularMomentumResidualKgM2ps'])assert.ok(numeric(reply.metrics[key],id)<=1e-7,id);
      assert.equal(reply.metrics.positionVelocityBitsHeld,true,id);assert.equal(reply.reference.separateFrictionWorkMeasured,false,id);
    }else{
      assert.equal(reply.metrics.stageReached,positive[i].hypBodies!==null,id);
      assert.equal(reply.metrics.roundedFinalMatches,positive[i].hypBodies===null?null:true,id);
      assert.equal(reply.reference.growthCheck.expectedAction,null,id);
    }
    receipts.push({id,reply,ledgerOrProtocolGuard:true,worldCreated:false,solverCalled:false});
  }
  const base=encode(ledgerInput()),pointBase=floorImpulse({warm:2,final:3});
  const protocol=[
    ['unknown-op',()=>({...clone(base),op:'unknown'})],['extra-request-key',()=>({...clone(base),extra:0})],
    ['null-ledger',()=>({...clone(base),ledger:null})],['extra-ledger-key',()=>{const x=clone(base);x.ledger.extra=0;return x;}],
    ['null-dt',()=>{const x=clone(base);x.ledger.fixedStepSeconds=null;return x;}],['boolean-dt',()=>{const x=clone(base);x.ledger.fixedStepSeconds=false;return x;}],
    ['null-vector',()=>{const x=clone(base);x.ledger.beforeBodies[0].velocityMps[0]=null;return x;}],
    ['boolean-vector',()=>{const x=clone(base);x.ledger.beforeBodies[0].velocityMps[0]=false;return x;}],
    ['nonfinite-codec',()=>{const x=clone(base);x.ledger.beforeBodies[0].velocityMps[0]=Infinity;return x;}],
    ['wrong-ID',()=>{const x=clone(base);x.ledger.freeBodies[0].id='missing';return x;}],
    ['truncated-raw',()=>{const x=clone(base);x.raw.before='00';return x;}],
    ['raw-JSON-mismatch',()=>{const x=clone(base);x.ledger.beforeBodies[0].positionM[0]=1;return x;}],
    ['wrong-point-index',()=>{const x=clone(pointBase);x.ledger.points[0].aIndex=99;return x;}],
    ['wrong-pair-key',()=>{const x=clone(pointBase);x.ledger.points[0].pairKey='missing';return x;}],
    ['null-final-accumulator',()=>{const x=clone(pointBase);x.ledger.points[0].final.normalNs=null;return x;}],
    ['malformed-action',()=>{const x=clone(base);x.ledger.actions=[null];return x;}],
    ['duplicate-action-ID',()=>{const x=clone(base);x.ledger.actions=[['a',{}],['a',{}]];return x;}],
    ['unknown-action-key',()=>{const x=clone(base);x.ledger.actions=[['a',{unknown:[0,0,0]}]];return x;}],
    ['bad-outcome',()=>({...clone(base),outcome:'partial'})],['choice-extra-key',()=>({...emptyChoice(),extra:0})],
    ['choice-raw-length',()=>{const x=emptyChoice();x.preRawHex='00';return x;}],
    ['choice-boolean-mass',()=>{const x=emptyChoice();x.problem.bodies[0].inverseMass=false;return x;}],
  ];
  assert.deepEqual(protocol.map(x=>x[0]),protocolReferenceControlIds);
  for(const [id,make]of protocol){const reply=await call(reference,make());assert.equal(reply.ok,false,id);assert.equal(reply.resolved,false,id);assert.equal(reply.executionFailure,true,id);assert.equal(reply.code,'REFERENCE_INPUT',id);assert.equal(reply.message,referenceErrors.input,id);receipts.push({id,reply,protocolGuard:true});}
  const spoofs=[
    ['final-minus-warm-spoof',()=>{const x=clone(pointBase);x.ledger.velocityBodies[1].velocityMps=[0,1,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],
    ['wrong-endpoint-sign',()=>{const x=floorImpulse();x.ledger.velocityBodies[1].velocityMps=[0,-3,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],
    ['mean-point-torque-spoof',()=>{const x=floorImpulse({offCentre:true});x.ledger.points[0].pointM=[0,0,0];return x;}],
    ['free-v-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].velocityMps=[1,0,0];x.ledger.freeBodies[0].positionM=[DT,0,0];replicateFree(x);return encode(x);}],
    ['free-omega-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].angularVelocityRadps=[0,0,1];replicateFree(x);return encode(x);}],
    ['free-p-spoof',()=>{const x=clone(base);x.ledger.freeBodies[0].positionM=[.1,0,0];replicateFree(x);return encode(x);}],
    ['position-velocity-compensation',()=>{const x=clone(base);x.ledger.finalBodies[0].velocityMps=[1,0,0];return encode(x);}],
    ['velocity-phase-position-change',()=>{const x=clone(base);x.ledger.velocityBodies[0].positionM=[.1,0,0];x.ledger.finalBodies=clone(x.ledger.velocityBodies);return encode(x);}],
    ['position-q-change',()=>{const x=clone(base);x.ledger.finalBodies[0].orientation=[0,0,Math.sin(.01),Math.cos(.01)];return encode(x);}],
  ];
  assert.deepEqual(spoofs.map(x=>x[0]),budgetSpoofControlIds);
  for(const [id,make]of spoofs){const reply=await call(reference,make());assert.equal(reply.resolved,true,id);assert.equal(reply.executionFailure,false,id);assert.equal(reply.ok,false,id);assert.ok(reply.violations.length>0,id);receipts.push({id,reply,syntheticBudgetSpoof:true});}
  const first=await call(reference,base),saved=clone(first);first.reference.originM[0]=999;
  assert.deepEqual(await call(reference,base),saved,'reference output copy repeat');
  return {receipts,copyIsolation:true,worldCreated:false,worldStepped:false,producerCalls:0,solverCalls:0,
    positiveLedgerAndChoiceControls:positive.length,protocolControls:protocol.length,budgetSpoofControls:spoofs.length};
}
export const runReferenceControls=referenceControls;
