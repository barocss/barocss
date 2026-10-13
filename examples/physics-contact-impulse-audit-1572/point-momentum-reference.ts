/**
 * #1572 bounded, independent per-contact-impulse momentum/torque arithmetic
 * observer. Runs only with test-only temporary esbuild instrumentation.
 * Samples every point in all eight World passes at steps 1, 600 and 1200
 * of the unchanged original 3-dynamic-cube OFFSET/YAW public fixtures.
 *
 * Each event is matched immediately before/after the SAME application of a
 * warm-start or a point solver. Physics math/collision modules are NOT used
 * for independent delta-v and delta-omega predictions.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';

type V=[number,number,number];
type Q=[number,number,number,number];
type SnapshotBody={
 pos:V;vel:V;omega:V;orientation:Q;inverseMass:number;inverseInertiaLocal:V;
};
type Phase={a:SnapshotBody,b:SnapshotBody,normalNs:number,tangentNs:V};
type Event={mode:'warm'|'solve',step:number,pass:number,iteration:number|null,
 pair:string,pointM:V,normal:V,before:Phase,after:Phase};
const v=(a:readonly number[]):V=>[a[0],a[1],a[2]];
const minus=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const plus=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const scale=(a:V,k:number):V=>[a[0]*k,a[1]*k,a[2]*k];
const cross=(a:V,b:V):V=>[
 a[1]*b[2]-a[2]*b[1],
 a[2]*b[0]-a[0]*b[2],
 a[0]*b[1]-a[1]*b[0]
];
const norm=(a:V)=>Math.hypot(a[0],a[1],a[2]);
const conj=(q:Q):Q=>[-q[0],-q[1],-q[2],q[3]];
function rotate(q:Q,a:V):V{
  const axis:V=[q[0],q[1],q[2]];
  const t=scale(cross(axis,a),2);
  return plus(a,plus(scale(t,q[3]),cross(axis,t)));
}
function angularVelocityFromImpulse(body:SnapshotBody,point:V,impulseOnB:V,sign:number):V{
  const arm=minus(point,body.pos);
  const local=rotate(conj(body.orientation),cross(arm,scale(impulseOnB,sign)));
  const diagonal=body.inverseInertiaLocal;
  return rotate(body.orientation,[local[0]*diagonal[0],local[1]*diagonal[1],local[2]*diagonal[2]]);
}
type PairStats={
 calls:number,warmCalls:number,solveCalls:number,
 maxLinearResidualMps:number,maxAngularResidualRadps:number,
 maxCoulombViolationNs:number,nonFinite:number,
 appliedJxNs:number,appliedJyNs:number,appliedJzNs:number,
 appliedTorqueAxNms:number,appliedTorqueAzNms:number,
 appliedTorqueBxNms:number,appliedTorqueBzNms:number,
 sumAbsoluteJxNs:number,sumAbsoluteJyNs:number
};
const empty=():PairStats=>({
 calls:0,warmCalls:0,solveCalls:0,maxLinearResidualMps:0,maxAngularResidualRadps:0,
 maxCoulombViolationNs:0,nonFinite:0,appliedJxNs:0,appliedJyNs:0,appliedJzNs:0,
 appliedTorqueAxNms:0,appliedTorqueAzNms:0,appliedTorqueBxNms:0,
 sumAbsoluteJxNs:0,sumAbsoluteJyNs:0
});
type Fixture='OFFSET'|'YAW';
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},
  positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Fixture):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
   positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,
   orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
   restitution:0,friction:{static:1,dynamic:.7}};
}
const probe=globalThis as typeof globalThis & {__physics1572ImpulseProbe?: (event:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const all=new Map<string,PairStats>(),samples:unknown[]=[];
 probe.__physics1572ImpulseProbe=(e:Event)=>{
  if(!['b0/b1','b1/b2'].includes(e.pair))throw Error('P1572_PAIR_UNEXPECTED');
  if(![1,600,1200].includes(e.step))throw Error('P1572_STEP_UNEXPECTED');
  const old=e.before,now=e.after;
  const j=e.mode==='warm'
    ?plus(scale(e.normal,old.normalNs),old.tangentNs)
    :plus(scale(e.normal,now.normalNs-old.normalNs),minus(now.tangentNs,old.tangentNs));
  const armA=minus(e.pointM,old.a.pos),armB=minus(e.pointM,old.b.pos);
  const expectDva=scale(j,-old.a.inverseMass),expectDvb=scale(j,old.b.inverseMass);
  const dva=minus(now.a.vel,old.a.vel),dvb=minus(now.b.vel,old.b.vel);
  const dwa=minus(now.a.omega,old.a.omega),dwb=minus(now.b.omega,old.b.omega);
  const expectedDwa=angularVelocityFromImpulse(old.a,e.pointM,j,-1);
  const expectedDwb=angularVelocityFromImpulse(old.b,e.pointM,j,1);
  const linearResidual=Math.max(norm(minus(dva,expectDva)),norm(minus(dvb,expectDvb)));
  const angularResidual=Math.max(norm(minus(dwa,expectedDwa)),norm(minus(dwb,expectedDwb)));
  const coulombViolation=e.mode==='solve'?Math.max(0,norm(now.tangentNs)-now.normalNs):0;
  const key=e.step+':'+e.pair;
  const record=all.get(key)??empty();
  record.calls++;if(e.mode==='warm')record.warmCalls++;else record.solveCalls++;
  if(![...j,linearResidual,angularResidual,coulombViolation].every(Number.isFinite))
    record.nonFinite++;
  record.maxLinearResidualMps=Math.max(record.maxLinearResidualMps,linearResidual);
  record.maxAngularResidualRadps=Math.max(record.maxAngularResidualRadps,angularResidual);
  record.maxCoulombViolationNs=Math.max(record.maxCoulombViolationNs,coulombViolation);
  record.appliedJxNs+=j[0];record.appliedJyNs+=j[1];record.appliedJzNs+=j[2];
  const aTorque=cross(armA,scale(j,-1)),bTorque=cross(armB,j);
  record.appliedTorqueAxNms+=aTorque[0];record.appliedTorqueAzNms+=aTorque[2];
  record.appliedTorqueBxNms+=bTorque[0];record.appliedTorqueBzNms+=bTorque[2];
  record.sumAbsoluteJxNs+=Math.abs(j[0]);record.sumAbsoluteJyNs+=Math.abs(j[1]);
  all.set(key,record);
  if(samples.length<16)
    samples.push({step:e.step,pair:e.pair,mode:e.mode,pass:e.pass,iteration:e.iteration,
      point:e.pointM,impulseOnBNs:j,linearResidual,angularResidual,coulombViolation});
  // Reject numerical correspondence failures, but NOT physically unstable
  // scenes. No outcome-based threshold relaxation is allowed.
  if(record.nonFinite||linearResidual>1e-10||angularResidual>1e-10||coulombViolation>1e-10)
    throw Error('P1572_POINT_MOMENTUM_REFERENCE_NO_GO:'+key);
 };
 const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
   contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]};
 const world=createPhysicsWorld(config);
 let accepted=0,firstFailure:string|null=null;
 const finalX:Record<string,number>={};
 try{
  for(let step=1;step<=steps;step++){
   try{
    const state=world.step(dt);accepted=step;
    if(step===steps)for(const b of state.bodies.filter(b=>b.kind==='dynamic'))
      finalX[b.id]=b.positionM[0];
   }catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
  }
 }finally{world.dispose();delete probe.__physics1572ImpulseProbe;}
 const byStep=Object.fromEntries([...all].sort(([a],[b])=>a.localeCompare(b)));
 // The external static witness for b0/b1 predicts 19.62 N normal support,
 // i.e. 0.1635 Ns per 1/120 s, IF the full step is near-static. We report
 // the difference rather than assuming an accelerating scene is at rest.
 const expectedStaticB0B1Ns=2*9.81*dt;
 const diagnostic=Object.fromEntries([1,600,1200].map(step=>[
  String(step),{expectedStaticNormalImpulseNs:expectedStaticB0B1Ns,
    observedB0B1YImpulseNs:all.get(step+':b0/b1')?.appliedJyNs??null,
    differenceFromStaticNs:(all.get(step+':b0/b1')?.appliedJyNs??0)-expectedStaticB0B1Ns}
 ]));
 console.log(JSON.stringify({fixture:mode,accepted,firstFailure,
  pointMomentumReferencePassed:firstFailure===null&&[...all.values()].every(r=>
    r.nonFinite===0&&r.maxLinearResidualMps<=1e-10&&r.maxAngularResidualRadps<=1e-10&&r.maxCoulombViolationNs<=1e-10),
  independentPerPointArithmetic:byStep,staticNormalSupportComparison:diagnostic,
  finalX,samples,trackedProductionFilesModified:false,eightDynamicBoxQualified:false,
  interpretation:'static reaction is only a feasibility baseline; this is an actual dynamic per-point impulse arithmetic comparison, not a certified complete torque law'}));
 if(firstFailure)process.exitCode=1;
}
