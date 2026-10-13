/** #1572 temporary diagnostic: same-pose SAT penetration versus clipped
 * candidate face-plane separations at b0/b1. No production changes.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
type Event={step:number,pass:number,penetrationM:number,normal:number[],
 candidateCount:number,acceptedCount:number,minSeparationM:number|null,maxSeparationM:number|null};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
const cube=(i:number,mode:Mode):PhysicsBodyConfig=>{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],massKg:1,velocityMps:[0,0,0],orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
};
const host=globalThis as typeof globalThis&{
 __p1572SepContext?:{step:number,pass:number,penetrationM:number,normal:number[]};
 __p1572SepProbe?:(e:Event)=>void;
};
for(const mode of ['OFFSET','YAW'] as const){
 const stats={hits:0,rejections:0,allRejected:0,positiveMin:0,
   minPenetrationM:Infinity,maxPenetrationM:0,
   smallestRejectedMinM:Infinity,largestRejectedMinM:-Infinity,
   firstRejected:null as Event|null};
 const checkpoints:Event[]=[];
 host.__p1572SepProbe=e=>{
  if(!Number.isFinite(e.penetrationM)||e.penetrationM<0||
     e.candidateCount<e.acceptedCount||
     (e.candidateCount>0&&(!Number.isFinite(e.minSeparationM)||!Number.isFinite(e.maxSeparationM))))
     throw Error('SAT_SEPARATION_NONFINITE');
  stats.hits++;stats.minPenetrationM=Math.min(stats.minPenetrationM,e.penetrationM);
  stats.maxPenetrationM=Math.max(stats.maxPenetrationM,e.penetrationM);
  if(e.acceptedCount<e.candidateCount){
    stats.rejections++;
    if(e.acceptedCount===0)stats.allRejected++;
    if((e.minSeparationM??0)>0)stats.positiveMin++;
    stats.smallestRejectedMinM=Math.min(stats.smallestRejectedMinM,e.minSeparationM!);
    stats.largestRejectedMinM=Math.max(stats.largestRejectedMinM,e.minSeparationM!);
    stats.firstRejected??=e;
  }
  if((e.step===1||e.step===600||e.step===1200)&&checkpoints.length<36)
    checkpoints.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:null|string=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}
 catch(err){failure=err instanceof Error?err.message:String(err);break;}}}
 finally{world.dispose();delete host.__p1572SepProbe;delete host.__p1572SepContext;}
 console.log(JSON.stringify({mode,accepted,failure,stats,checkpoints,
   limitation:'SAT overlap and signed face-plane separation are different geometric quantities; correlation does not prove fault',
   productionPhysicsChanged:false,eightBoxGO:false}));
 if(failure||accepted!==1200||stats.hits!==9600)process.exitCode=1;
}
