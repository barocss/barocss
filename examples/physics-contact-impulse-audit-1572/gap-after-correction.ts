/** #1572 same pair, same solver pass: before/after correction face gaps.
 * Test-only injected observation calls; actual production execution unchanged.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig} from '../../packages/barocss-physics/src/types.js';
type Event={step:number,pass:number,phase:'before'|'after',reference:string,pointCount:number,minGap:number|null,maxGap:number|null,depth:number};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
const cube=(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig=>{const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}}};
const host=globalThis as typeof globalThis&{__p1572GapContext?:{step:number,pass:number,phase:'before'|'after',depth:number};__p1572GapObserver?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 let before=0,after=0,faceChanged=0,signFlips=0;const pending=new Map<string,Event>();const samples:unknown[]=[];
 host.__p1572GapObserver=e=>{
  if(![1,600,1200].includes(e.step))return;
  if(e.minGap!==null&&!Number.isFinite(e.minGap))throw Error('GAP_NONFINITE');
  const key=e.step+':'+e.pass;
  if(e.phase==='before'){before++;pending.set(key,e);return;}
  after++;const prior=pending.get(key);if(!prior)throw Error('GAP_PAIR_MISSING');
  if(prior.reference!==e.reference)faceChanged++;
  if(prior.minGap!==null&&e.minGap!==null&&Math.sign(prior.minGap)!==Math.sign(e.minGap))signFlips++;
  samples.push({step:e.step,pass:e.pass,referenceBefore:prior.reference,referenceAfter:e.reference,
   beforeGapM:prior.minGap,afterGapM:e.minGap,beforeAccepted:prior.pointCount,afterAccepted:e.pointCount,
   sourcePenetrationM:prior.depth});
  pending.delete(key);
 };
 const world=createPhysicsWorld({fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],contactMode:'persistent-box-v1',
  bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,failure:string|null=null;
 try{for(let i=1;i<=1200;i++){try{world.step(1/120);accepted=i;}catch(e){failure=String(e);break;}}}
 finally{world.dispose();delete host.__p1572GapObserver;delete host.__p1572GapContext;}
 console.log(JSON.stringify({mode,accepted,failure,before,after,faceChanged,signFlips,samples,
  qualification:'recomputed geometry post-correction, not exact same pre-correction points; source face identity recorded',
  productionModified:false,eightBoxGO:false}));
 if(failure||accepted!==1200||before!==24||after!==24||pending.size)process.exitCode=1;
}
