/**
 * #1572 internal-cache research entry.
 * MUST run only through instrument-private-cache.mjs, which instruments a
 * temporary esbuild graph. The production Physics API and files stay unchanged.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig,PhysicsState} from '../../packages/barocss-physics/src/types.js';

type CacheEvent =
 | {kind:'manifold',step:number,pass:number,pointCount:number,fallback:boolean}
 | {kind:'new-point',step:number,pass:number,pointId:string,reused:boolean,
    priorNormalNs:number,priorTangentMagnitudeNs:number}
 | {kind:'commit',step:number,cachedPoints:number}
 | {kind:'phase',step:number,pointId:string,phase:'warm'|'solve0'|'solve7',
    beforeSlipMps:number,afterSlipMps:number,reused?:boolean,
    normalNs:number,tangentNs:number};


// Contact-point tangential relative speed reconstructed from COPIED accepted
// public World state, not the private per-iteration point-speed or friction law.
// Comparing consecutive accepted snapshots is only a temporal correlation.
function acceptedContactSlip(state:PhysicsState):number|null{
  const c=state.contacts.find(contact=>contact.aId==='b0'&&contact.bId==='b1');
  if(!c)return null;
  const a=state.bodies.find(body=>body.id===c.aId);
  const b=state.bodies.find(body=>body.id===c.bId);
  if(!a||!b)return null;
  const cross=(u:number[],v:number[])=>[
    u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const at=(body:typeof a)=>{
    const arm=c.pointM.map((v,i)=>v-body.positionM[i]);
    const angular=cross(body.angularVelocityRadps,arm);
    return body.velocityMps.map((v,i)=>v+angular[i]);
  };
  const av=at(a),bv=at(b),rel=bv.map((v,i)=>v-av[i]);
  const projection=rel.reduce((v,x,i)=>v+x*c.normalAtoB[i],0);
  return Math.hypot(...rel.map((v,i)=>v-projection*c.normalAtoB[i]));
}

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
  const priorIdentity=new Map<string,boolean>();
  const phaseStats=new Map<string,{count:number,sumAbsDelta:number,peakAbsDelta:number,sumBefore:number,sumAfter:number,sumTangentNs:number}>();
  const phaseSamples:unknown[]=[];
  (globalThis as typeof globalThis & {__physics1572Probe?: (event: CacheEvent)=>void}).__physics1572Probe =
    (event:CacheEvent)=>{
      const row=perStep.get(event.step)??{fallbackPasses:0,manifoldPasses:0,fresh:0,reused:0};
      if(event.kind==='manifold'){
        if(event.fallback){counters.fallbackPasses++;row.fallbackPasses++;}
        else{counters.manifoldPasses++;row.manifoldPasses++;}
      }else if(event.kind==='new-point'){
        priorIdentity.set(event.step+'|'+event.pointId,event.reused);
        if(event.reused){
          counters.pointReused++;row.reused++;
          counters.priorNormalSumNs+=event.priorNormalNs;
          counters.priorTangentSumNs+=event.priorTangentMagnitudeNs;
        }else{counters.pointFresh++;row.fresh++;}
      }else if(event.kind==='commit'){
        if(event.cachedPoints>0)counters.framesWithCache++;
        counters.peakCachedPoints=Math.max(counters.peakCachedPoints,event.cachedPoints);
      }else if(event.kind==='phase'){
        if(![event.beforeSlipMps,event.afterSlipMps,event.normalNs,event.tangentNs].every(Number.isFinite))
          throw Error('PHASE_NUMERIC_UNSAFE');
        const reuse=event.phase==='warm' ? !!event.reused :
          priorIdentity.get(event.step+'|'+event.pointId);
        if(reuse===undefined)throw Error('PHASE_IDENTITY_MISSING');
        const label=event.phase+':'+(reuse?'reused':'fresh');
        const stats=phaseStats.get(label)??{count:0,sumAbsDelta:0,peakAbsDelta:0,
          sumBefore:0,sumAfter:0,sumTangentNs:0};
        const delta=Math.abs(event.afterSlipMps-event.beforeSlipMps);
        stats.count++;stats.sumAbsDelta+=delta;stats.peakAbsDelta=Math.max(stats.peakAbsDelta,delta);
        stats.sumBefore+=event.beforeSlipMps;stats.sumAfter+=event.afterSlipMps;
        stats.sumTangentNs+=event.tangentNs;
        phaseStats.set(label,stats);
        if(phaseSamples.length<30 && (event.step<=3||event.step>=680))
          phaseSamples.push({step:event.step,pointId:event.pointId,phase:event.phase,reused:reuse,
            before:event.beforeSlipMps,after:event.afterSlipMps,
            normalNs:event.normalNs,tangentNs:event.tangentNs});
      }
      perStep.set(event.step,row);
    };
  const world=createPhysicsWorld(config);
  let accepted=0,firstFailure:string|null=null;
  const samples:unknown[]=[];
  const transitionSamples:unknown[]=[];
  const slipGroups={freshFrames:0,noFreshFrames:0,
    freshSumAbsDeltaMps:0,noFreshSumAbsDeltaMps:0,
    freshPeakAbsDeltaMps:0,noFreshPeakAbsDeltaMps:0};
  try{
    for(let step=1;step<=1200;step++){
      try{
        const priorSlip=acceptedContactSlip(world.getState());
        const state=world.step(dt);accepted=step;
        const slip=acceptedContactSlip(state);
        const stepCache=perStep.get(step)??{fallbackPasses:0,manifoldPasses:0,fresh:0,reused:0};
        if(priorSlip!==null&&slip!==null){
          const delta=slip-priorSlip;
          const fresh=stepCache.fresh>0;
          if(fresh){
            slipGroups.freshFrames++;
            slipGroups.freshSumAbsDeltaMps+=Math.abs(delta);
            slipGroups.freshPeakAbsDeltaMps=Math.max(slipGroups.freshPeakAbsDeltaMps,Math.abs(delta));
          }else{
            slipGroups.noFreshFrames++;
            slipGroups.noFreshSumAbsDeltaMps+=Math.abs(delta);
            slipGroups.noFreshPeakAbsDeltaMps=Math.max(slipGroups.noFreshPeakAbsDeltaMps,Math.abs(delta));
          }
          if(fresh&&transitionSamples.length<30)
            transitionSamples.push({step,priorSlipMps:priorSlip,currentSlipMps:slip,
              slipDeltaMps:delta,fresh:stepCache.fresh,reused:stepCache.reused,
              fallbackPasses:stepCache.fallbackPasses});
        }
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
  console.log(JSON.stringify({mode,accepted,firstFailure,counters,samples,transitionSamples,
    pointPhase:Object.fromEntries([...phaseStats].sort(([a],[b])=>a.localeCompare(b))
      .map(([label,stat])=>[label,{count:stat.count,
        meanBeforeSlipMps:stat.sumBefore/stat.count,
        meanAfterSlipMps:stat.sumAfter/stat.count,
        meanAbsSlipChangeMps:stat.sumAbsDelta/stat.count,
        peakAbsSlipChangeMps:stat.peakAbsDelta,
        meanAccumulatedTangentNs:stat.sumTangentNs/stat.count}])),
    phaseSamples,
    phaseInterpretation:'matched point before/after each warmstart or solve call, not causal law proof',
    slipGroups:{
      ...slipGroups,
      freshMeanAbsDeltaMps:slipGroups.freshFrames?slipGroups.freshSumAbsDeltaMps/slipGroups.freshFrames:null,
      noFreshMeanAbsDeltaMps:slipGroups.noFreshFrames?slipGroups.noFreshSumAbsDeltaMps/slipGroups.noFreshFrames:null
    },
    measurementCaveat:'consecutive accepted snapshots, possibly different contact points; correlation only',
    instrumentation:'temporary esbuild source transform; actual private World cache',
    productionFileModified:false,eightBoxQualified:false,physicalGO:false}));
  if(firstFailure)process.exitCode=1;
}
