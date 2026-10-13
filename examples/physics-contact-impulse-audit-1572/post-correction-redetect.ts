/** #1572 read-only re-detection at corrected poses: same pair, same solver pass. */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig} from '../../packages/barocss-physics/src/types.js';
type E={step:number,pass:number,beforePenetrationM:number,afterPenetrationM:number|null,beforePoints:number,afterPoints:number|null,beforeNormal:number[],afterNormal:number[]|null};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};}
const host=globalThis as typeof globalThis & {__p1572Redetect?:(e:E)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const samples:E[]=[];let redetected=0,separated=0,manifoldAfterNull=0;
 host.__p1572Redetect=e=>{
  if(e.afterPenetrationM===null){separated++;}else{redetected++;if(e.afterPenetrationM<0)throw Error('REDETECT_NEGATIVE_DEPTH');}
  if(e.afterPoints===null)manifoldAfterNull++;
  if(!Number.isFinite(e.beforePenetrationM))throw Error('REDETECT_NONFINITE');
  samples.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',
 bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:string|null=null;
 try{for(let step=1;step<=1200;step++){try{world.step(1/120);accepted=step;}catch(err){failure=String(err);break;}}}
 finally{world.dispose();delete host.__p1572Redetect;}
 console.log(JSON.stringify({mode,accepted,failure,redetected,separated,manifoldAfterNull,samples,
  scope:'additional read-only SAT and manifold at corrected poses only, not a new physical solver pass',
  productionChanged:false,eightBoxGO:false}));
 if(failure||accepted!==1200||samples.length!==24)process.exitCode=1;
}
