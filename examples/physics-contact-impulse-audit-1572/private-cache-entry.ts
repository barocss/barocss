/**
 * #1572 internal-cache research entry.
 * MUST run only through instrument-private-cache.mjs, which instruments a
 * temporary esbuild graph. The production Physics API and files stay unchanged.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';

type CacheEvent =
 | {kind:'manifold',step:number,pass:number,pointCount:number,fallback:boolean}
 | {kind:'new-point',step:number,pass:number,pointId:string,reused:boolean,
    priorNormalNs:number,priorTangentMagnitudeNs:number}
 | {kind:'commit',step:number,cachedPoints:number};

const dt=1/120;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
  shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
  restitution:0,friction:{static:1,dynamic:.7}};
function box(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig {
  const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
  return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
    positionM:[(i%2)*.05,.25+i*.5,0],velocityMps:[0,0,0],massKg:1,
    orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
    restitution:0,friction:{static:1,dynamic:.7}};
}
for(const mode of ['OFFSET','YAW'] as const){
  const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
    contactMode:'persistent-box-v1',
    bodies:[floor,box(0,mode),box(1,mode),box(2,mode)]};
  const counters={manifoldPasses:0,fallbackPasses:0,pointFresh:0,pointReused:0,
    priorNormalSumNs:0,priorTangentSumNs:0,framesWithCache:0,peakCachedPoints:0};
  const perStep=new Map<number,{fallbackPasses:number,manifoldPasses:number,fresh:number,reused:number}>();
  (globalThis as typeof globalThis & {__physics1572Probe?: (event: CacheEvent)=>void}).__physics1572Probe =
    (event:CacheEvent)=>{
      const row=perStep.get(event.step)??{fallbackPasses:0,manifoldPasses:0,fresh:0,reused:0};
      if(event.kind==='manifold'){
        if(event.fallback){counters.fallbackPasses++;row.fallbackPasses++;}
        else{counters.manifoldPasses++;row.manifoldPasses++;}
      }else if(event.kind==='new-point'){
        if(event.reused){
          counters.pointReused++;row.reused++;
          counters.priorNormalSumNs+=event.priorNormalNs;
          counters.priorTangentSumNs+=event.priorTangentMagnitudeNs;
        }else{counters.pointFresh++;row.fresh++;}
      }else if(event.kind==='commit'){
        if(event.cachedPoints>0)counters.framesWithCache++;
        counters.peakCachedPoints=Math.max(counters.peakCachedPoints,event.cachedPoints);
      }
      perStep.set(event.step,row);
    };
  const world=createPhysicsWorld(config);
  let accepted=0,firstFailure:string|null=null;
  const samples:unknown[]=[];
  try{
    for(let step=1;step<=1200;step++){
      try{
        const state=world.step(dt);accepted=step;
        if(step===1||step%120===0){
          const b1=state.bodies.find(b=>b.id==='b1')!;
          const b2=state.bodies.find(b=>b.id==='b2')!;
          samples.push({step,counters:{...counters},stepCounters:perStep.get(step)??null,
            xPositions:[b1.positionM[0],b2.positionM[0]]});
        }
      }catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
    }
  }finally{
    world.dispose();
    delete (globalThis as typeof globalThis & {__physics1572Probe?: unknown}).__physics1572Probe;
  }
  console.log(JSON.stringify({mode,accepted,firstFailure,counters,samples,
    instrumentation:'temporary esbuild source transform; actual private World cache',
    productionFileModified:false,eightBoxQualified:false,physicalGO:false}));
  if(firstFailure)process.exitCode=1;
}
