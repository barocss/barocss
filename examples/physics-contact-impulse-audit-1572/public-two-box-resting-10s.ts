import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
/** #1572: measured 10-second PUBLIC two-box resting-contact checkpoint.
 * Bounded smaller-profile diagnostic only; not the original nine-body gate.
 */
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/src/index.js';


const floor=staticPart('floor',{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{restitution:0,friction:{static:.8,dynamic:.5}});
const dynamic=(id:string,y:number)=>(dynamicPart(id,{kind:'box',halfExtentsM:[.5,.5,.5]},{positionM:[0,y,0],velocityMps:[0,0,0]},1,{restitution:0,friction:{static:.8,dynamic:.5}}));
const dt=1/120, steps=1200;
const stackSize=process.argv.includes('--three-boxes')?3:2;
const stackBodies=[floor,dynamic('lower',.5),dynamic('upper',1.5)];
if(stackSize===3)stackBodies.push(dynamic('top',2.5));
const config={model:makeModel({gravityMps2:[0,-9.81,0],parts:stackBodies}),options:{profile:'rigid-persistent-box-v1',fixedStepSeconds:dt,broadPhase:'direct'} as const};
const world=createPhysicsWorld(config.model,config.options);
let accepted=0,maxPenetrationM=0,maxHeightDeviationM=0,maxTiltRad=0;
let maxSpeedMps=0,maxAngularSpeedRadps=0;
let refusal:string|null=null, firstFailure:string|null=null;
const lastWindow = new Map<string,{firstY:number,lastY:number,maxHorizontalDriftM:number,maxSpeedMps:number,maxAngularSpeedRadps:number,maxTiltRad:number}>();
try {
  for(let step=0;step<steps;step++){
    try {
      const state=world.step();
      if(state.stepIndex!==step+1)throw Error('unexpected accepted cursor');
      for(const contact of state.contacts) {
        if(!Number.isFinite(contact.penetrationM))throw Error('nonfinite contact');
        maxPenetrationM=Math.max(maxPenetrationM,contact.penetrationM);
      }
      for(const body of state.bodies.filter(b=>b.kind==='dynamic')){
        const initialY=body.id==='lower'?.5:body.id==='upper'?1.5:2.5;
        maxHeightDeviationM=Math.max(maxHeightDeviationM,Math.abs(body.positionM[1]-initialY));
        maxTiltRad=Math.max(maxTiltRad,2*Math.acos(Math.min(1,Math.abs(body.orientationXYZW[3]))));
        maxSpeedMps=Math.max(maxSpeedMps,Math.hypot(...body.velocityMps));
        maxAngularSpeedRadps=Math.max(maxAngularSpeedRadps,Math.hypot(...body.angularVelocityRadps));
        if(step>=960){
          const tilt=2*Math.acos(Math.min(1,Math.abs(body.orientationXYZW[3])));
          const metric=lastWindow.get(body.id)??{firstY:body.positionM[1],lastY:body.positionM[1],
            maxHorizontalDriftM:0,maxSpeedMps:0,maxAngularSpeedRadps:0,maxTiltRad:0};
          metric.lastY=body.positionM[1];
          metric.maxHorizontalDriftM=Math.max(metric.maxHorizontalDriftM,Math.hypot(body.positionM[0],body.positionM[2]));
          metric.maxSpeedMps=Math.max(metric.maxSpeedMps,Math.hypot(...body.velocityMps));
          metric.maxAngularSpeedRadps=Math.max(metric.maxAngularSpeedRadps,Math.hypot(...body.angularVelocityRadps));
          metric.maxTiltRad=Math.max(metric.maxTiltRad,tilt);
          lastWindow.set(body.id,metric);
        }
        if(![...body.positionM,...body.velocityMps,...body.orientationXYZW,...body.angularVelocityRadps].every(Number.isFinite))
          throw Error('nonfinite body');
      }
      accepted++;
    }catch(error){
      firstFailure=error instanceof Error?error.message:String(error);
      break;
    }
  }
  const prior=JSON.stringify(world.getState());
  // @ts-expect-error Intentional scalar command argument; the canonical API refuses it.
  try{world.step(1/60)}catch(error){if(error instanceof PhysicsError)refusal=error.code;}
  if(refusal!=='INVALID_COMMAND'||JSON.stringify(world.getState())!==prior)
    throw Error('refusal did not preserve accepted state');
  console.log(JSON.stringify({profile:'public-small-stack-resting-10s-v1',stackSize,stepsRequested:steps,
    accepted,firstFailure,refusal,maxPenetrationM,maxHeightDeviationM,
    maxTiltRad,maxSpeedMps,maxAngularSpeedRadps,
    lastTwoSeconds:Object.fromEntries([...lastWindow].sort(([a],[b])=>a.localeCompare(b)).map(([id,m])=>[id,{verticalDriftM:Math.abs(m.lastY-m.firstY),maxHorizontalDriftM:m.maxHorizontalDriftM,maxSpeedMps:m.maxSpeedMps,maxAngularSpeedRadps:m.maxAngularSpeedRadps,maxTiltRad:m.maxTiltRad}])),
    smallProfileNumericResult:firstFailure?'NO_GO':'MEASURED_ONLY',
    nineBodyStableWorldQualified:false},null,2));
  if(firstFailure)process.exitCode=1;
} finally {world.dispose();}
