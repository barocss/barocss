/** #1572 controlled read-only kinetic energy balance for actual individual
 * point warm-start / solver calls. No production source edits. A point impulse
 * may raise local kinetic energy under warm-start; judge the full trace, not
 * any intermediate event alone. Energies use independent world inertia math.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];type Q=[number,number,number,number];
type BodySnapshot={pos:V,vel:V,omega:V,orientation:Q,inverseMass:number,inverseInertiaLocal:V};
type Impulse={normalNs:number,tangentNs:V};
type Event={kind:'warm'|'solve',step:number,pass:number,iteration:number|null,pair:string,
 pointM:V,normal:V,beforeImpulse:Impulse,afterImpulse:Impulse,
 aBefore:BodySnapshot,bBefore:BodySnapshot,aAfter:BodySnapshot,bAfter:BodySnapshot};
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const add=(a:V,b:V):V=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:V,s:number):V=>[a[0]*s,a[1]*s,a[2]*s];
const inv=(q:Q):Q=>[-q[0],-q[1],-q[2],q[3]];
function rotate(q:Q,v:V):V{
 const axis:V=[q[0],q[1],q[2]],t=scale(cross(axis,v),2);
 return add(v,add(scale(t,q[3]),cross(axis,t)));
}
function relativeAtPoint(a:BodySnapshot,b:BodySnapshot,p:V):V{
 const av=add(a.vel,cross(a.omega,sub(p,a.pos)));
 const bv=add(b.vel,cross(b.omega,sub(p,b.pos)));
 return sub(bv,av);
}
function impulseVector(e:Event):V{
 if(e.kind==='warm')return add(scale(e.normal,e.beforeImpulse.normalNs),e.beforeImpulse.tangentNs);
 return add(scale(e.normal,e.afterImpulse.normalNs-e.beforeImpulse.normalNs),
   sub(e.afterImpulse.tangentNs,e.beforeImpulse.tangentNs));
}
function energy(b:BodySnapshot):number{
 if(b.inverseMass===0)return 0;
 const local=rotate(inv(b.orientation),b.omega);
 const rotational=local.reduce((sum,w,i)=>sum+w*w/b.inverseInertiaLocal[i],0);
 return .5*dot(b.vel,b.vel)/b.inverseMass+.5*rotational;
}
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],friction:{static:1,dynamic:.7},restitution:0};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],friction:{static:1,dynamic:.7},restitution:0};
}
const probe=globalThis as typeof globalThis&{__physics1572EnergyProbe?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const stats:Record<string,{count:number,positive:number,totalDeltaJ:number,positiveDeltaJ:number,negativeDeltaJ:number,maxRiseJ:number,maxAbsoluteWorkResidualJ:number,totalPredictedImpulseWorkJ:number}>={};
 const driftWindowStats:Record<string,{count:number,totalDeltaJ:number,positive:number,maxAbsoluteWorkResidualJ:number}>={};
 const samples:unknown[]=[];
 probe.__physics1572EnergyProbe=e=>{
  const before=energy(e.aBefore)+energy(e.bBefore),after=energy(e.aAfter)+energy(e.bAfter);
  const delta=after-before;
  const j=impulseVector(e);
  const v0=relativeAtPoint(e.aBefore,e.bBefore,e.pointM);
  const v1=relativeAtPoint(e.aAfter,e.bAfter,e.pointM);
  const expectedImpulseWorkJ=dot(j,v0)+.5*dot(j,sub(v1,v0));
  const workResidualJ=delta-expectedImpulseWorkJ;
  if(![delta,...j,expectedImpulseWorkJ,workResidualJ].every(Number.isFinite)
    || Math.abs(workResidualJ)>1e-10)throw Error('ENERGY_IMPULSE_WORK_REFERENCE_NO_GO:'+e.step+':'+e.pair);
  const key=e.pair+':'+e.kind,stat=stats[key]??{
    count:0,positive:0,totalDeltaJ:0,positiveDeltaJ:0,negativeDeltaJ:0,maxRiseJ:0,
    maxAbsoluteWorkResidualJ:0,totalPredictedImpulseWorkJ:0};
  stat.count++;stat.totalDeltaJ+=delta;
  stat.maxAbsoluteWorkResidualJ=Math.max(stat.maxAbsoluteWorkResidualJ,Math.abs(workResidualJ));
  stat.totalPredictedImpulseWorkJ+=expectedImpulseWorkJ;
  if(delta>0){stat.positive++;stat.positiveDeltaJ+=delta;stat.maxRiseJ=Math.max(stat.maxRiseJ,delta);}
  else stat.negativeDeltaJ+=delta;
  stats[key]=stat;
  if(e.step>=680&&e.step<=720){
    const drift=driftWindowStats[key]??{count:0,totalDeltaJ:0,positive:0,maxAbsoluteWorkResidualJ:0};
    drift.count++;drift.totalDeltaJ+=delta;if(delta>0)drift.positive++;
    drift.maxAbsoluteWorkResidualJ=Math.max(drift.maxAbsoluteWorkResidualJ,Math.abs(workResidualJ));
    driftWindowStats[key]=drift;
  }
  if(samples.length<24||e.step===688&&e.pass===0&&e.iteration===0)
    samples.push({step:e.step,pass:e.pass,iteration:e.iteration,pair:e.pair,kind:e.kind,deltaJ:delta,
      predictedImpulseWorkJ:expectedImpulseWorkJ,workResidualJ});
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{
  for(let step=1;step<=steps;step++){
   try{world.step(dt);accepted=step;}catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
  }
 }finally{world.dispose();delete probe.__physics1572EnergyProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,stats,driftWindowStats,samples,
  independentWorkIdentity:'delta pair KE = J dot pre-relative-point-velocity + half J dot delta-relative-point-velocity; no external work within single point call',
  measurementSteps:'step 1; multiples of 120; all steps 680..720; both b0/b1 and b1/b2 pairs',
  limitation:'pair kinetic energy changes during individual solver calls, not an external-force corrected full-step energy audit',
  productionSolverChanged:false,eightBoxPhysicalGO:false}));
 if(firstFailure)process.exitCode=1;
}
