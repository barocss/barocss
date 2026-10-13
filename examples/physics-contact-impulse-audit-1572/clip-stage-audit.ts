import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type E={stage:'clip'|'separation',before:number,after:number,step:number,pass:number,pair:string};
const host=globalThis as typeof globalThis&{__p1572ClipProbe?:(event:E)=>void};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+.5*i,0],massKg:1,velocityMps:[0,0,0],orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
for(const mode of ['OFFSET','YAW'] as const){
 const counts={clipCalls:0,clipEmptied:0,separationCalls:0,separationEmptied:0,nonFinite:0};
 const clips=[0,0,0,0];const sample:unknown[]=[];
 host.__p1572ClipProbe=e=>{
  if(e.pair!=='b0/b1'||!Number.isInteger(e.before)||!Number.isInteger(e.after)||e.before<0||e.after<0)
    throw Error('P1572_CLIP_EVENT_INVALID');
  if(e.stage==='clip'){
   const index=counts.clipCalls%4;clips[index]++;
   counts.clipCalls++;if(e.before>0&&e.after===0)counts.clipEmptied++;
  }else{counts.separationCalls++;if(e.before>0&&e.after===0)counts.separationEmptied++;}
  if((e.step===600||e.step===1200)&&sample.length<90)sample.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],
   contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let i=0;i<1200;i++){try{world.step(1/120);accepted++;}catch(e){firstFailure=String(e);break;}}}
 finally{world.dispose();delete host.__p1572ClipProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,counts,clips,sample,
  caveat:'only eligible manifold invocations are counted; clip-empty and separation-empty are exclusive downstream mechanisms, not independent collision correctness',
  productionModified:false,eightBoxGO:false}));
 if(firstFailure||accepted!==1200)process.exitCode=1;
}
