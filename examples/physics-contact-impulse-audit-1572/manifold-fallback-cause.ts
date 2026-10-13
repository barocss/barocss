/** #1572 test-only classify source Manifold fallback: strict reference face
 * alignment versus clipped incident face emptiness, and compare to the actual
 * b0/b1 contact fallbacks in original OFFSET/YAW 3-box PhysicsWorld scenes.
 * No production Physics kernel change.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type V=[number,number,number];
type Event={step:number,pass:number,pair:string,manifoldCount:number,hasManifold:boolean,
  maxAlignmentA:number,maxAlignmentB:number,normal:V};
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
 positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
 orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__p1572FaceCauseProbe?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const stats={passesWithHit:0,manifold:0,fallback:0,
  referenceFaceIneligible:0,clipOrSeparationRejected:0,
  minMaxA:1,minMaxB:1,firstFallbackStep:null as number|null};
 const checkpoints:unknown[]=[];
 host.__p1572FaceCauseProbe=e=>{
  const norm=Math.hypot(...e.normal);
  if(!Number.isFinite(norm)||Math.abs(norm-1)>1e-8)throw Error('P1572_FACE_NONUNIT_NORMAL');
  if(![e.maxAlignmentA,e.maxAlignmentB].every(v=>Number.isFinite(v)&&v>=0&&v<=1+1e-9))
   throw Error('P1572_FACE_INVALID_ALIGNMENT');
  const eligible=Math.max(e.maxAlignmentA,e.maxAlignmentB)>=1-1e-6;
  stats.passesWithHit++;stats.minMaxA=Math.min(stats.minMaxA,e.maxAlignmentA);
  stats.minMaxB=Math.min(stats.minMaxB,e.maxAlignmentB);
  if(e.hasManifold){stats.manifold++;if(!eligible)throw Error('P1572_FACE_CLASSIFICATION_CONTRADICTION');}
  else{
   stats.fallback++;if(stats.firstFallbackStep===null)stats.firstFallbackStep=e.step;
   if(!eligible)stats.referenceFaceIneligible++;else stats.clipOrSeparationRejected++;
  }
  if(e.step===1||e.step===600||e.step===1200||
      (!e.hasManifold&&e.step===stats.firstFallbackStep&&checkpoints.length<30)){
   if(checkpoints.length<90)checkpoints.push({step:e.step,pass:e.pass,
     type:e.hasManifold?'manifold':!eligible?'reference-face-ineligible':'clip-or-separation-rejected',
     maxAlignmentA:e.maxAlignmentA,maxAlignmentB:e.maxAlignmentB,
     manifoldCount:e.manifoldCount,normal:e.normal});
  }
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let step=1;step<=steps;step++){
  try{world.step(dt);accepted=step;}catch(e){firstFailure=e instanceof Error?e.message:String(e);break;}
 }}finally{world.dispose();delete host.__p1572FaceCauseProbe;}
 if(stats.passesWithHit!==1200*8||stats.fallback!==stats.referenceFaceIneligible+stats.clipOrSeparationRejected)
  throw Error('P1572_FACE_MISSING_SAMPLES');
 console.log(JSON.stringify({mode,accepted,firstFailure,stats,checkpoints,
   interpretation:'test-only source reference-face threshold classification; clipped-empty and separation failures grouped',
   originalEightBoxPhysicalGO:false,productionPhysicsChanged:false}));
 if(firstFailure)process.exitCode=1;
}
