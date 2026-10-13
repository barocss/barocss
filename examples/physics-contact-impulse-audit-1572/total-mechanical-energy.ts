/** #1572 read-only total mechanical energy ledger for original 3-box
 * OFFSET/YAW fixtures. Explicit scalar cube inertia from geometry
 * independent of Physics mass/inertia implementation. No solver edits.
 *
 * A potential-energy rise is not automatically a bug: contact correction
 * projects positions and can create effective numerical work.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
const dt=1/120,stepCount=1200,g=9.81,halfExtent=.25,mass=1;
const scalarInertia=mass*((2*halfExtent)**2+(2*halfExtent)**2)/12;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
 shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
 restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[halfExtent,halfExtent,halfExtent]},
  positionM:[(i%2)*.05,.25+i*.5,0],massKg:mass,velocityMps:[0,0,0],
  orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
function sample(state:ReturnType<ReturnType<typeof createPhysicsWorld>['getState']>){
 let kinetic=0,potential=0;
 for(const body of state.bodies.filter(x=>x.kind==='dynamic')){
  const v=body.velocityMps,w=body.angularVelocityRadps;
  if(![...v,...w,...body.positionM].every(Number.isFinite))throw Error('ENERGY_NONFINITE_BODY');
  kinetic+=mass*(v[0]**2+v[1]**2+v[2]**2)/2+
   scalarInertia*(w[0]**2+w[1]**2+w[2]**2)/2;
  potential+=mass*g*body.positionM[1];
 }
 return {kineticJ:kinetic,potentialJ:potential,totalJ:kinetic+potential};
}
if(Math.abs(scalarInertia-1/24)>1e-15)throw Error('ENERGY_REFERENCE_INERTIA');
for(const mode of ['OFFSET','YAW'] as const){
 const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-g,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]};
 const world=createPhysicsWorld(config);
 let accepted=0,firstFailure:string|null=null;
 const start=sample(world.getState());
 let last=start,peakTotalJ=start.totalJ,minTotalJ=start.totalJ;
 let positiveStepCount=0,negativeStepCount=0,flatStepCount=0;
 let sumPositiveDeltaJ=0,sumNegativeDeltaJ=0,maxPositiveStepJ=0;
 const checkpoints:unknown[]=[];
 try{
  for(let step=1;step<=stepCount;step++){
   try{
    const state=world.step(dt);
    if(state.stepIndex!==step)throw Error('ENERGY_STEP_INDEX');
    const now=sample(state),deltaJ=now.totalJ-last.totalJ;
    if(!Number.isFinite(deltaJ))throw Error('ENERGY_NONFINITE_DELTA');
    if(deltaJ>1e-12){positiveStepCount++;sumPositiveDeltaJ+=deltaJ;
      maxPositiveStepJ=Math.max(maxPositiveStepJ,deltaJ);
    }else if(deltaJ< -1e-12){negativeStepCount++;sumNegativeDeltaJ+=deltaJ;
    }else flatStepCount++;
    peakTotalJ=Math.max(peakTotalJ,now.totalJ);
    minTotalJ=Math.min(minTotalJ,now.totalJ);
    accepted=step;last=now;
    if(step===1||step%120===0)checkpoints.push({step,...now,deltaFromInitialJ:now.totalJ-start.totalJ,
      xPositions:state.bodies.filter(x=>x.kind==='dynamic').map(x=>({id:x.id,x:x.positionM[0]}))});
   }catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
  }
 }finally{world.dispose();}
 const closureErrorJ=Math.abs(start.totalJ+sumPositiveDeltaJ+sumNegativeDeltaJ-last.totalJ);
 if(closureErrorJ>1e-9)throw Error('ENERGY_LEDGER_CLOSURE:'+closureErrorJ);
 console.log(JSON.stringify({mode,accepted,firstFailure,initial:start,final:last,
  deltaTotalJ:last.totalJ-start.totalJ,peakTotalJ,minTotalJ,
  positiveStepCount,negativeStepCount,flatStepCount,sumPositiveDeltaJ,
  sumNegativeDeltaJ,maxPositiveStepJ,closureErrorJ,checkpoints,
  reference:'independent symmetric uniform solid cube scalar moment m*s^2/6 and E=0.5mv²+0.5Iω²+mgy',
  limits:'no external inputs, but numerical contact/positional correction may do work; this is total sampled body energy not an independent collision correctness proof',
  producerBodyState:true,physicalEightBoxGO:false,solverChanged:false}));
 if(firstFailure)process.exitCode=1;
}
