/**
 * #1572 bounded counterfactual: original three-cube OFFSET/YAW,
 * identical PhysicsWorld law/inputs/iterations except per-step prior point
 * impulse reuse in a TEMPORARY esbuild graph. NOT a public solver option.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
  shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
  restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
  positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
  orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,
  friction:{static:1,dynamic:.7}};
}
type Summary={mode:Mode,cache:'warm-reuse'|'cold-reset',accepted:number,firstFailure:string|null,
  maxProducerPenetrationM:number,maxHorizontalFromInitialM:number,maxVerticalDriftM:number,
  maxSpeedMps:number,maxAngularSpeedRadps:number,maxTiltFromUprightRad:number,
  finalX:Record<string,number>,measuredSettlingThresholdsMet:boolean,
  qualifiedEightBox:false,producerOnlyContactDepth:true};
function run(mode:Mode,cold:boolean):Summary{
 (globalThis as typeof globalThis & {__physics1572ColdStart?:boolean}).__physics1572ColdStart=cold;
 const inputs=[0,1,2].map(i=>cube(i,mode));
 const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
   contactMode:'persistent-box-v1',bodies:[floor,...inputs]};
 const world=createPhysicsWorld(config);
 let accepted=0,firstFailure:string|null=null,maxProducerPenetrationM=0;
 let maxHorizontalFromInitialM=0,maxVerticalDriftM=0,maxSpeedMps=0,maxAngularSpeedRadps=0;
 let maxTiltFromUprightRad=0;
 const referenceY=new Map<string,number>(),finalX:Record<string,number>={};
 try{
  for(let step=1;step<=steps;step++){
   try{
    const state=world.step(dt);
    if(state.stepIndex!==step)throw Error('BAD_CURSOR');
    for(const contact of state.contacts) {
      if(!Number.isFinite(contact.penetrationM))throw Error('NONFINITE_CONTACT');
      maxProducerPenetrationM=Math.max(maxProducerPenetrationM,contact.penetrationM);
    }
    for(const b of state.bodies.filter(b=>b.kind==='dynamic')){
      if(![...b.positionM,...b.velocityMps,...b.angularVelocityRadps,...b.orientation].every(Number.isFinite))
        throw Error('NONFINITE_BODY:'+b.id);
      finalX[b.id]=b.positionM[0];
      if(step===960)referenceY.set(b.id,b.positionM[1]);
      if(step>960){
        const input=inputs.find(x=>x.id===b.id)!;
        const initX=input.positionM[0],initZ=input.positionM[2];
        maxHorizontalFromInitialM=Math.max(maxHorizontalFromInitialM,
          Math.hypot(b.positionM[0]-initX,b.positionM[2]-initZ));
        maxVerticalDriftM=Math.max(maxVerticalDriftM,Math.abs(b.positionM[1]-referenceY.get(b.id)!));
        maxSpeedMps=Math.max(maxSpeedMps,Math.hypot(...b.velocityMps));
        maxAngularSpeedRadps=Math.max(maxAngularSpeedRadps,Math.hypot(...b.angularVelocityRadps));
        maxTiltFromUprightRad=Math.max(maxTiltFromUprightRad,Math.acos(
          Math.min(1,Math.max(-1,1-2*(b.orientation[0]**2+b.orientation[2]**2)))));
      }
    }
    accepted=step;
   }catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
  }
 }finally{world.dispose();}
 const measuredSettlingThresholdsMet=accepted===steps&&maxProducerPenetrationM<=.002
  &&maxHorizontalFromInitialM<=.01&&maxVerticalDriftM<=.005
  &&maxSpeedMps<=.02&&maxAngularSpeedRadps<=.02
  &&maxTiltFromUprightRad<=Math.PI/180;
 return {mode,cache:cold?'cold-reset':'warm-reuse',accepted,firstFailure,
  maxProducerPenetrationM,maxHorizontalFromInitialM,maxVerticalDriftM,
  maxSpeedMps,maxAngularSpeedRadps,maxTiltFromUprightRad,finalX,
  measuredSettlingThresholdsMet,qualifiedEightBox:false,
  producerOnlyContactDepth:true};
}
try{
 for(const mode of ['OFFSET','YAW'] as const){
  const warm=run(mode,false),cold=run(mode,true);
  console.log(JSON.stringify({mode,baseline:warm,counterfactual:cold,
    differenceColdMinusWarm:{
      maxHorizontalFromInitialM:cold.maxHorizontalFromInitialM-warm.maxHorizontalFromInitialM,
      maxSpeedMps:cold.maxSpeedMps-warm.maxSpeedMps,
      maxProducerPenetrationM:cold.maxProducerPenetrationM-warm.maxProducerPenetrationM},
    interpretation:'test-only disabled per-step prior point impulse reuse, identical geometry/friction/dt/iterations; no independent SAT or 8-box proof'}));
 }
}finally{delete (globalThis as typeof globalThis & {__physics1572ColdStart?:boolean}).__physics1572ColdStart;}
