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
 let fallbackFrames=0,fallbackStarts=0,previousFallback=false;
 let slipAtFallbackSum=0,slipAtManifoldSum=0,slipFallbackSamples=0,slipManifoldSamples=0;
 const fallbackTransitions:unknown[]=[];
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
   const fallback=hit!==null && ids.length===0;
   const contact=state.contacts.find(c=>(c.aId==='b0'&&c.bId==='b1')||(c.aId==='b1'&&c.bId==='b0'));
   let slipSpeedMps:number|null=null;
   if(contact){
     const cross=(u:number[],v:number[])=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
     const at=(body:typeof a)=>{const arm=contact.pointM.map((value,i)=>value-body.positionM[i]);const angular=cross(body.angularVelocityRadps,arm);return body.velocityMps.map((value,i)=>value+angular[i]);};
     const va=at(a),vb=at(b),rel=vb.map((value,i)=>value-va[i]),normal=contact.normalAtoB;
     const normalSpeed=rel.reduce((total,value,i)=>total+value*normal[i],0);
     slipSpeedMps=Math.hypot(...rel.map((value,i)=>value-normalSpeed*normal[i]));
   }
   if(fallback){
     fallbackFrames++;
     if(slipSpeedMps!==null){slipAtFallbackSum+=slipSpeedMps;slipFallbackSamples++;}
   }else if(ids.length && slipSpeedMps!==null){slipAtManifoldSum+=slipSpeedMps;slipManifoldSamples++;}
   if(fallback&&!previousFallback){
     fallbackStarts++;
     fallbackTransitions.push({step,slipSpeedMps,previousIds:previous});
   }
   previousFallback=fallback;
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
    newlyAppearingIds:unmatched,fallbackFrames,fallbackStarts,
    meanSlipFallbackMps:slipFallbackSamples?slipAtFallbackSum/slipFallbackSamples:null,
    meanSlipManifoldMps:slipManifoldSamples?slipAtManifoldSum/slipManifoldSamples:null,
    fallbackTransitions:fallbackTransitions.slice(0,24),checkpoints,
    interpretation:'reconstructed IDs from accepted poses only; no private impulse cache observed',
    solverLawChanged:false,physicalGo:false}));
 }finally{world.dispose();}
}
