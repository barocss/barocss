/** #1572: measured 10-second PUBLIC two-box resting-contact checkpoint.
 * Bounded smaller-profile diagnostic only; not the original nine-body gate.
 */
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/src/index.js';
import type { PhysicsBodyConfig, PhysicsWorldConfig } from '../../packages/barocss-physics/src/types.js';

const floor:PhysicsBodyConfig={id:'floor',kind:'static',
  shape:{kind:'box',halfExtentsM:[2,.5,2]},positionM:[0,-.5,0],
  restitution:0,friction:{static:.8,dynamic:.5}};
const dynamic=(id:string,y:number):PhysicsBodyConfig=>({id,kind:'dynamic',
  shape:{kind:'box',halfExtentsM:[.5,.5,.5]},positionM:[0,y,0],
  velocityMps:[0,0,0],massKg:1,restitution:0,friction:{static:.8,dynamic:.5}});
const dt=1/120, steps=1200;
const stackSize=process.argv.includes('--three-boxes')?3:2;
const stackBodies=[floor,dynamic('lower',.5),dynamic('upper',1.5)];
if(stackSize===3)stackBodies.push(dynamic('top',2.5));
const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:stackBodies};
const world=createPhysicsWorld(config);
let accepted=0,maxPenetrationM=0,maxHeightDeviationM=0,maxTiltRad=0;
let maxSpeedMps=0,maxAngularSpeedRadps=0;
let refusal:string|null=null, firstFailure:string|null=null;
try {
  for(let step=0;step<steps;step++){
    try {
      const state=world.step(dt);
      if(state.stepIndex!==step+1)throw Error('unexpected accepted cursor');
      for(const contact of state.contacts) {
        if(!Number.isFinite(contact.penetrationM))throw Error('nonfinite contact');
        maxPenetrationM=Math.max(maxPenetrationM,contact.penetrationM);
      }
      for(const body of state.bodies.filter(b=>b.kind==='dynamic')){
        const initialY=body.id==='lower'?.5:body.id==='upper'?1.5:2.5;
        maxHeightDeviationM=Math.max(maxHeightDeviationM,Math.abs(body.positionM[1]-initialY));
        maxTiltRad=Math.max(maxTiltRad,2*Math.acos(Math.min(1,Math.abs(body.orientation[3]))));
        maxSpeedMps=Math.max(maxSpeedMps,Math.hypot(...body.velocityMps));
        maxAngularSpeedRadps=Math.max(maxAngularSpeedRadps,Math.hypot(...body.angularVelocityRadps));
        if(![...body.positionM,...body.velocityMps,...body.orientation,...body.angularVelocityRadps].every(Number.isFinite))
          throw Error('nonfinite body');
      }
      accepted++;
    }catch(error){
      firstFailure=error instanceof Error?error.message:String(error);
      break;
    }
  }
  const prior=JSON.stringify(world.getState());
  try{world.step(1/60)}catch(error){if(error instanceof PhysicsError)refusal=error.code;}
  if(refusal!=='INVALID_STEP'||JSON.stringify(world.getState())!==prior)
    throw Error('refusal did not preserve accepted state');
  console.log(JSON.stringify({profile:'public-small-stack-resting-10s-v1',stackSize,stepsRequested:steps,
    accepted,firstFailure,refusal,maxPenetrationM,maxHeightDeviationM,
    maxTiltRad,maxSpeedMps,maxAngularSpeedRadps,
    smallProfileNumericResult:firstFailure?'NO_GO':'MEASURED_ONLY',
    nineBodyStableWorldQualified:false},null,2));
  if(firstFailure)process.exitCode=1;
} finally {world.dispose();}
