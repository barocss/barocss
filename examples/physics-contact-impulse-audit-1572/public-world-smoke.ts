/** #1572 bounded PUBLIC PhysicsWorld regression. Does not qualify 9-body stable stacks.
 * Execute from repo root: npx tsx examples/physics-contact-impulse-audit-1572/public-world-smoke.ts
 */
import { createPhysicsWorld, PhysicsError } from '../../packages/barocss-physics/src/index.js';
import type { PhysicsWorldConfig, PhysicsBodyConfig, PhysicsState } from '../../packages/barocss-physics/src/types.js';
const box=(id:string,y:number):PhysicsBodyConfig=>({
 id,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.5,.5,.5]},
 positionM:[0,y,0],velocityMps:[0,0,0],massKg:1,restitution:0,
 friction:{static:.8,dynamic:.5}
});
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.5,2]},
 positionM:[0,-.5,0],restitution:0,friction:{static:.8,dynamic:.5}};
const config:PhysicsWorldConfig={fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],
 contactMode:'persistent-box-v1',bodies:[floor,box('lower',.5),box('upper',1.5)]};
const world=createPhysicsWorld(config);
let last:PhysicsState=world.getState(),peakPenetrationM=0,peakTiltRad=0;
let accepted=0;
try{
 for(let i=0;i<120;i++){
   const next=world.step(config.fixedStepSeconds);
   if(next.stepIndex!==i+1 || next.timeSeconds!==(i+1)*config.fixedStepSeconds)
     throw Error('unexpected step cursor at '+i);
   for(const body of next.bodies){
     if(![...body.positionM,...body.velocityMps,...body.orientation,...body.angularVelocityRadps].every(Number.isFinite))
       throw Error('nonfinite state at '+i+':'+body.id);
     if(body.kind==='dynamic')peakTiltRad=Math.max(peakTiltRad,
       2*Math.acos(Math.min(1,Math.abs(body.orientation[3]))));
   }
   for(const contact of next.contacts){
     if(!Number.isFinite(contact.penetrationM) || contact.penetrationM<0)
       throw Error('invalid penetration at '+i);
     peakPenetrationM=Math.max(peakPenetrationM,contact.penetrationM);
   }
   last=next;accepted++;
 }
 const before=JSON.stringify(world.getState());
 let refused=false;
 try{world.step(1/60)}catch(error){
   refused=error instanceof PhysicsError && error.code==='INVALID_STEP';
 }
 if(!refused)throw Error('expected INVALID_STEP refusal');
 if(JSON.stringify(world.getState())!==before)
   throw Error('refusal mutated accepted state');
 console.log(JSON.stringify({profile:'public-persistent-box-three-body-v1',accepted,
  peakPenetrationM,peakTiltRad,finalBodyY:last.bodies.filter(b=>b.kind==='dynamic').map(b=>b.positionM[1]),
  publicWorldExecuted:true,stableStackQualified:false,originalEightBoxQualified:false},null,2));
}finally{world.dispose();}
