/** #1572 read-only per-frame b0/b1 manifold identity audit.
 * Uses actual public accepted poses and current native geometry.
 * Computed contact IDs are diagnostics, not access to private World cache.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import {detect} from '../../packages/barocss-physics/src/collision.js';
import {boxFaceManifold} from '../../packages/barocss-physics/src/contact-manifold.js';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
  positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
  orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
for(const mode of ['OFFSET','YAW'] as const){
 const cfg:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]};
 const world=createPhysicsWorld(cfg);
 let previous:string[]|null=null,framesWithContact=0,idTransitions=0,pointCountChanges=0,unmatched=0;
 const checkpoints:unknown[]=[];
 try{
  for(let step=1;step<=steps;step++){
   const state=world.step(dt);
   const a=state.bodies.find(b=>b.id==='b0')!,b=state.bodies.find(b=>b.id==='b1')!;
   const bodyA=parseBody({...cube(0,mode),positionM:a.positionM,velocityMps:a.velocityMps,
    orientation:a.orientation,angularVelocityRadps:a.angularVelocityRadps},false);
   const bodyB=parseBody({...cube(1,mode),positionM:b.positionM,velocityMps:b.velocityMps,
    orientation:b.orientation,angularVelocityRadps:b.angularVelocityRadps},false);
   const hit=detect(bodyA,bodyB),points=hit?boxFaceManifold(bodyA,bodyB,hit):null;
   const ids=points?.map(p=>p.id)??[];
   if(hit)framesWithContact++;
   if(previous!==null){
    if(previous.join('|')!==ids.join('|'))idTransitions++;
    if(previous.length!==ids.length)pointCountChanges++;
    unmatched+=ids.filter(id=>!previous!.includes(id)).length;
   }
   previous=ids;
   if(step===1||step%120===0)checkpoints.push({step,ids,count:ids.length,
    pointM:points?.map(p=>p.pointM)??[],producerPenetrationM:hit?.penetration??null});
  }
  console.log(JSON.stringify({mode,steps,framesWithContact,idTransitions,pointCountChanges,
    newlyAppearingIds:unmatched,checkpoints,
    interpretation:'reconstructed IDs from accepted poses only; no private impulse cache observed',
    solverLawChanged:false,physicalGo:false}));
 }finally{world.dispose();}
}
