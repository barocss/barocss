/** #1572: Measure actual per-pair lateral velocity/position changes from
 * public Physics World's b0/b1 and b1/b2 contact phases. This probe runs only
 * against a TEMPORARY instrumented esbuild graph; production is unchanged.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
type PairEvent={step:number,pass:number,pair:string,deltaAVx:number,deltaBVx:number,
 deltaAxM:number,deltaBxM:number,normalX:number,pointCount:number,
 fallback:boolean,normalImpulseNs:number,tangentImpulseXNs:number};
type Stats={observations:number,fallback:number,
 signedDeltaAVx:number,signedDeltaBVx:number,absoluteDeltaAVx:number,absoluteDeltaBVx:number,
 signedDeltaAxM:number,signedDeltaBxM:number,absoluteDeltaBxM:number,
 signedReportedTangentImpulseXNs:number,signedReportedNormalX:number,
 peakAbsoluteDeltaBVx:number};
const dt=1/120,steps=1200;
const initial= (i:number,mode:Mode):PhysicsBodyConfig=>{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
  positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
  orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
  restitution:0,friction:{static:1,dynamic:.7}};
};
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
 shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
 restitution:0,friction:{static:1,dynamic:.7}};
const empty=():Stats=>({observations:0,fallback:0,
 signedDeltaAVx:0,signedDeltaBVx:0,absoluteDeltaAVx:0,absoluteDeltaBVx:0,
 signedDeltaAxM:0,signedDeltaBxM:0,absoluteDeltaBxM:0,
 signedReportedTangentImpulseXNs:0,signedReportedNormalX:0,
 peakAbsoluteDeltaBVx:0});
const hook=globalThis as typeof globalThis & {__physics1572PairProbe?:(event:PairEvent)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const all=new Map<string,Stats>(),last2s=new Map<string,Stats>();
 const samples:unknown[]=[];
 hook.__physics1572PairProbe=event=>{
  if(![event.deltaAVx,event.deltaBVx,event.deltaAxM,event.deltaBxM,
        event.normalX,event.normalImpulseNs,event.tangentImpulseXNs].every(Number.isFinite))
   throw Error('P1572_PAIR_NONFINITE');
  if(event.step<1||event.step>steps)throw Error('P1572_PAIR_STEP_RANGE');
  for(const [map,include] of [[all,true],[last2s,event.step>960]] as const){
   if(!include)continue;
   const row=map.get(event.pair)??empty();
   row.observations++;if(event.fallback)row.fallback++;
   row.signedDeltaAVx+=event.deltaAVx;row.signedDeltaBVx+=event.deltaBVx;
   row.absoluteDeltaAVx+=Math.abs(event.deltaAVx);
   row.absoluteDeltaBVx+=Math.abs(event.deltaBVx);
   row.signedDeltaAxM+=event.deltaAxM;row.signedDeltaBxM+=event.deltaBxM;
   row.absoluteDeltaBxM+=Math.abs(event.deltaBxM);
   row.signedReportedTangentImpulseXNs+=event.tangentImpulseXNs;
   row.signedReportedNormalX+=event.normalX;
   row.peakAbsoluteDeltaBVx=Math.max(row.peakAbsoluteDeltaBVx,Math.abs(event.deltaBVx));
   map.set(event.pair,row);
  }
  if(samples.length<40&&(event.step===1||event.step>=960)&&event.pass===0)
   samples.push(event);
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,initial(0,mode),initial(1,mode),initial(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 let finalX:Record<string,number>={};
 try{
  for(let step=1;step<=steps;step++){
   try{
    const state=world.step(dt);accepted=step;
    if(step===steps)finalX=Object.fromEntries(state.bodies
      .filter(b=>b.kind==='dynamic').map(b=>[b.id,b.positionM[0]]));
   }catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
  }
 }finally{world.dispose();delete hook.__physics1572PairProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,
  allPasses:Object.fromEntries([...all].sort(([a],[b])=>a.localeCompare(b))),
  lastTwoSeconds:Object.fromEntries([...last2s].sort(([a],[b])=>a.localeCompare(b))),
  samples,finalX,
  measurementBoundary:'one pair-processing block at a time (all per-point solver iterations in that block); repeated passes and interacting pairs; producer impulse report not independently certified',
  productionChanged:false,eightBoxQualified:false,physicsGO:false}));
 if(firstFailure)process.exitCode=1;
}
