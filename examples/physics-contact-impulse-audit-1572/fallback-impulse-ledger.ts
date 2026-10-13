/** #1572 test-only full-pass velocity-impulse ledger including manifold fallback. */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';
type Event={step:number,pass:number,pair:string,fallback:boolean,pointCount:number,
  impulseOnB:[number,number,number],deltaAV:[number,number,number],deltaBV:[number,number,number]};
type Row={calls:number,fallbacks:number,manifolds:number,netImpulseX:number,netImpulseY:number,
  sumAbsImpulseX:number,netDeltaBVX:number,maxMomentumError:number};
const zero=():Row=>({calls:0,fallbacks:0,manifolds:0,netImpulseX:0,netImpulseY:0,
 sumAbsImpulseX:0,netDeltaBVX:0,maxMomentumError:0});
const gravity:[number,number,number]=[0,-9.81,0],dt=1/120;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',shape:{kind:'box',halfExtentsM:[2,.1,2]},
 positionM:[0,-.1,0],restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:'OFFSET'|'YAW'):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:'b'+i,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
 positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
 orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],restitution:0,
 friction:{static:1,dynamic:.7}};
}
const host=globalThis as typeof globalThis&{__physics1572FallbackProbe?:(event:Event)=>void};
for(const mode of ['OFFSET','YAW'] as const){
 const totals=new Map<string,Row>(),lastTwo=new Map<string,Row>(),checkpoints:unknown[]=[];
 host.__physics1572FallbackProbe=e=>{
   if(!['b0/b1','b1/b2'].includes(e.pair))throw Error('INVALID_PAIR');
   for(const [map,allowed] of [[totals,true],[lastTwo,e.step>960]] as const){
     if(!allowed)continue;
     const row=map.get(e.pair)??zero();
     row.calls++;if(e.fallback)row.fallbacks++;else row.manifolds++;
     row.netImpulseX+=e.impulseOnB[0];row.netImpulseY+=e.impulseOnB[1];
     row.sumAbsImpulseX+=Math.abs(e.impulseOnB[0]);
     row.netDeltaBVX+=e.deltaBV[0];
     const residual=Math.max(...e.impulseOnB.map((v,i)=>Math.abs(v-e.deltaBV[i])),
       ...e.impulseOnB.map((v,i)=>Math.abs(v+e.deltaAV[i])));
     row.maxMomentumError=Math.max(row.maxMomentumError,residual);
     if(![...Object.values(row),...e.impulseOnB,...e.deltaAV,...e.deltaBV].every(Number.isFinite))
       throw Error('NONFINITE_IMPULSE_LEDGER');
     if(residual>1e-9)throw Error('MOMENTUM_LEDGER_MISMATCH');
     map.set(e.pair,row);
   }
   if([1,600,1200].includes(e.step)&&e.pass===7)checkpoints.push(e);
 };
 const world=createPhysicsWorld({fixedStepSeconds:dt,gravityMps2:gravity,
   contactMode:'persistent-box-v1',bodies:[floor,cube(0,mode),cube(1,mode),cube(2,mode)]});
 let accepted=0,firstFailure:string|null=null;
 try{for(let i=1;i<=1200;i++){
   try{world.step(dt);accepted=i;}catch(e){firstFailure=String(e);break;}
 }}finally{world.dispose();delete host.__physics1572FallbackProbe;}
 console.log(JSON.stringify({mode,accepted,firstFailure,totals:Object.fromEntries(totals),
   lastTwoSeconds:Object.fromEntries(lastTwo),checkpoints,
   interpretation:'each whole-pair contact block impulse reconstructed from actual dynamic-body delta-v (1kg each); includes fallback and manifold with all 8 passes; does not independently prove collision geometry',
   productionChanged:false,fullEightBoxGO:false}));
 if(firstFailure||checkpoints.length!==6)process.exitCode=1;
}
