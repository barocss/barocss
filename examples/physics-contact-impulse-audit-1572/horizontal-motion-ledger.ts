/**
 * #1572: Decompose horizontal motion in the ORIGINAL public OFFSET/YAW
 * three-box subsets into free integration vs collision/position phases.
 * Injected read-only observer runs in a TEMPORARY esbuild World graph.
 * No production source or public API changes. No 8-box qualification.
 */
import {createPhysicsWorld} from '../../packages/barocss-physics/src/index.js';
import type {PhysicsBodyConfig,PhysicsBodyState,PhysicsWorldConfig} from '../../packages/barocss-physics/src/types.js';

type Mode='OFFSET'|'YAW';
type Prediction={id:string,x:number,vx:number};
type Event={step:number,predicted:Prediction[]};
type Ledger={sumSignedIntegratedDx:number,sumSignedContactDx:number,sumSignedNetDx:number,
 sumAbsIntegratedDx:number,sumAbsContactDx:number,maxAbsContactDx:number,
 sumAbsContactDvx:number,maxAbsContactDvx:number,startingX:number,finalX:number};
const dt=1/120,steps=1200;
const floor:PhysicsBodyConfig={id:'floor',kind:'static',
 shape:{kind:'box',halfExtentsM:[2,.1,2]},positionM:[0,-.1,0],
 restitution:0,friction:{static:1,dynamic:.7}};
function cube(i:number,mode:Mode):PhysicsBodyConfig{
 const yaw=mode==='YAW'?(i%2===0?.05:-.05):0;
 return {id:`b${i}`,kind:'dynamic',shape:{kind:'box',halfExtentsM:[.25,.25,.25]},
  positionM:[(i%2)*.05,.25+.5*i,0],velocityMps:[0,0,0],massKg:1,
  orientation:[0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
  restitution:0,friction:{static:1,dynamic:.7}};
}
const probe=globalThis as typeof globalThis & {__physics1572HorizontalProbe?: (event:Event)=>void};
function getBody(states:PhysicsBodyState[],id:string):PhysicsBodyState{
 const b=states.find(item=>item.id===id);
 if(!b)throw Error('P1572_MISSING_BODY:'+id);
 return b;
}
for(const mode of ['OFFSET','YAW'] as const){
 const predictionByStep=new Map<number,Prediction[]>();
 probe.__physics1572HorizontalProbe=(event:Event)=>{
  if(predictionByStep.has(event.step))throw Error('P1572_DUPLICATE_PREDICTION:'+event.step);
  if(event.predicted.length!==3)throw Error('P1572_PREDICTION_COUNT:'+event.step);
  predictionByStep.set(event.step,event.predicted);
 };
 const inputs=[cube(0,mode),cube(1,mode),cube(2,mode)];
 const config:PhysicsWorldConfig={fixedStepSeconds:dt,gravityMps2:[0,-9.81,0],
  contactMode:'persistent-box-v1',bodies:[floor,...inputs]};
 const world=createPhysicsWorld(config);
 const metric=new Map<string,Ledger>(inputs.map(b=>[b.id,{
  sumSignedIntegratedDx:0,sumSignedContactDx:0,sumSignedNetDx:0,
  sumAbsIntegratedDx:0,sumAbsContactDx:0,maxAbsContactDx:0,
  sumAbsContactDvx:0,maxAbsContactDvx:0,
  startingX:b.positionM[0],finalX:b.positionM[0]}]));
 let accepted=0,firstFailure:string|null=null;
 const samples:unknown[]=[];
 try{
  for(let step=1;step<=steps;step++){
   try{
    const before=world.getState();
    const after=world.step(dt);
    if(after.stepIndex!==step)throw Error('P1572_STEP_CURSOR');
    const predicted=predictionByStep.get(step);
    if(!predicted)throw Error('P1572_MISSING_PREDICTION:'+step);
    const perBody=[];
    for(const initial of inputs){
     const previous=getBody(before.bodies,initial.id);
     const result=getBody(after.bodies,initial.id);
     const predictedBody=predicted.find(x=>x.id===initial.id);
     if(!predictedBody)throw Error('P1572_MISSING_PREDICTED_BODY:'+initial.id);
     const integratedDx=predictedBody.x-previous.positionM[0];
     const postIntegrationDx=result.positionM[0]-predictedBody.x;
     const netDx=result.positionM[0]-previous.positionM[0];
     const contactDvx=result.velocityMps[0]-predictedBody.vx;
     if(![integratedDx,postIntegrationDx,netDx,contactDvx].every(Number.isFinite))
       throw Error('P1572_NONFINITE_LEDGER:'+step);
     if(Math.abs((integratedDx+postIntegrationDx)-netDx)>1e-12)
       throw Error('P1572_LEDGER_MISMATCH:'+step);
     const m=metric.get(initial.id)!;
     m.sumSignedIntegratedDx+=integratedDx;
     m.sumSignedContactDx+=postIntegrationDx;
     m.sumSignedNetDx+=netDx;
     m.sumAbsIntegratedDx+=Math.abs(integratedDx);
     m.sumAbsContactDx+=Math.abs(postIntegrationDx);
     m.maxAbsContactDx=Math.max(m.maxAbsContactDx,Math.abs(postIntegrationDx));
     m.sumAbsContactDvx+=Math.abs(contactDvx);
     m.maxAbsContactDvx=Math.max(m.maxAbsContactDvx,Math.abs(contactDvx));
     m.finalX=result.positionM[0];
     if(step===1||step%120===0)perBody.push({id:initial.id,
       integratedDx,postIntegrationDx,netDx,contactDvx,
       cumulativeIntegratedDx:m.sumSignedIntegratedDx,
       cumulativePostIntegrationDx:m.sumSignedContactDx});
    }
    accepted=step;
    predictionByStep.delete(step);
    if(step===1||step%120===0)samples.push({step,bodies:perBody});
   }catch(err){firstFailure=err instanceof Error?err.message:String(err);break;}
  }
 }finally{
  world.dispose();delete probe.__physics1572HorizontalProbe;
 }
 console.log(JSON.stringify({mode,accepted,firstFailure,
  bodyLedger:Object.fromEntries([...metric].sort(([a],[b])=>a.localeCompare(b))),
  samples,scope:'3 dynamic boxes + floor, original offset/yaw public profile',
  phaseMeaning:'postIntegrationDx includes all contact-position changes after free integration, not just a single correction call',
  caveat:'velocity impulses influence later free-integration displacement; no causal allocation of long-term motion',
  productionWorldModified:false,physicalEightBoxGO:false}));
 if(firstFailure)process.exitCode=1;
}
