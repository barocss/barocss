/** #1572: actual fallback-inclusive applied impulse distribution.
 * Production World remains unchanged; observer uses exact test-only esbuild patch.
 * Delta-v of upper 1kg dynamic body yields applied vector impulse per pair block.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Mode='OFFSET'|'YAW';
type Event={step:number,pass:number,pair:string,fallback:boolean,pointCount:number,
 pointM:[number,number,number],normal:[number,number,number],
 deltaBV:[number,number,number],deltaAV:[number,number,number],
 impulseNs:number,tangentImpulseNs:[number,number,number]};
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis & {__p1572FallbackProbe?:(e:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const stats=new Map<string,{calls:number,fallbackCalls:number,manifoldCalls:number,
 totalAppliedJxNs:number,totalAppliedJyNs:number,totalAppliedJzNs:number,
 fallbackJyNs:number,manifoldJyNs:number,positiveJyNs:number,
 weightedXsum:number,weightedZsum:number,maximumMomentumMismatch:number,
 maxReportedNormalNs:number}>();
 const samples:unknown[]=[];
 host.__p1572FallbackProbe=e=>{
  if(![1,600,1200].includes(e.step)||!['b0/b1','b1/b2'].includes(e.pair))throw Error('P1572_EVENT_SCOPE');
  const key=e.step+':'+e.pair;
  const s=stats.get(key)??{calls:0,fallbackCalls:0,manifoldCalls:0,
   totalAppliedJxNs:0,totalAppliedJyNs:0,totalAppliedJzNs:0,
   fallbackJyNs:0,manifoldJyNs:0,positiveJyNs:0,weightedXsum:0,weightedZsum:0,
   maximumMomentumMismatch:0,maxReportedNormalNs:0};
  if(![...e.pointM,...e.normal,...e.deltaBV,...e.deltaAV,e.impulseNs,...e.tangentImpulseNs].every(Number.isFinite))
   throw Error('P1572_NONFINITE_EVENT');
  // Both bodies are dynamic 1kg. Their pair-block change must be equal/opposite;
  // the producer-reported aggregate may hold cumulative values across passes.
  const mismatch=Math.hypot(...e.deltaAV.map((v,i)=>v+e.deltaBV[i]));
  if(mismatch>1e-9)throw Error('P1572_LINEAR_MOMENTUM_MISMATCH');
  s.maximumMomentumMismatch=Math.max(s.maximumMomentumMismatch,mismatch);
  s.calls++;if(e.fallback){s.fallbackCalls++;s.fallbackJyNs+=e.deltaBV[1];}
  else{s.manifoldCalls++;s.manifoldJyNs+=e.deltaBV[1];}
  s.totalAppliedJxNs+=e.deltaBV[0];
  s.totalAppliedJyNs+=e.deltaBV[1];
  s.totalAppliedJzNs+=e.deltaBV[2];
  // Observation centroid is pair-block producer point, not actual individual
  // point-of-action in multi-point manifold. Do not call this a force centre.
  if(e.deltaBV[1]>0){s.positiveJyNs+=e.deltaBV[1];s.weightedXsum+=e.pointM[0]*e.deltaBV[1];s.weightedZsum+=e.pointM[2]*e.deltaBV[1];}
  s.maxReportedNormalNs=Math.max(s.maxReportedNormalNs,e.impulseNs);
  stats.set(key,s);
  if(samples.length<24&&(e.pass===0||e.fallback))
    samples.push({step:e.step,pass:e.pass,pair:e.pair,fallback:e.fallback,
      appliedImpulseNs:e.deltaBV,reportedNormalNs:e.impulseNs,
      producerPointM:e.pointM,pointCount:e.pointCount});
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
   contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let step=1;step<=steps;step++){
  try{world.step(dt);accepted=step;}
  catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
 }}finally{world.dispose();delete host.__p1572FallbackProbe;}
 const result=Object.fromEntries([...stats].sort(([a],[b])=>a.localeCompare(b)).map(([key,s])=>
  [key,{...s,positiveImpulsePointProxyXZ:s.positiveJyNs>0?[s.weightedXsum/s.positiveJyNs,s.weightedZsum/s.positiveJyNs]:null}]));
 console.log(JSON.stringify({mode,accepted,firstFailure,byPairStep:result,samples,
  witnessScope:'pair-block delta-v includes warm start, point solves and fallback; producer point is NOT per-point normal-force centroid',
  staticB0B1ReferenceNs:2*9.81*dt,productionChanged:false,physicalGO:false}));
 if(firstFailure||stats.size!==6)process.exitCode=1;
}
