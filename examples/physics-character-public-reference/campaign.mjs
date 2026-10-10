import { createUprightCapsuleController } from '@barocss/physics';
import { createCharacterCore } from '../../packages/barocss-physics/src/character/core.js';
import { CASES } from './fixture.mjs';
import { evaluate } from './metrics.mjs';
import { numbers,encode,hex } from './binary.mjs';
export const DT=1/120,STEPS=240;
export const config=f=>({version:1,profile:'upright-capsule-controller-v1',scene:structuredClone(f.scene),positionM:[...f.positionM]});
export const command=(f,overrides={})=>({dtSeconds:DT,sceneRevision:f.scene.revision,desiredVelocityMps:[...f.requestMps],...overrides});
export const project=s=>({version:1,profile:'upright-capsule-controller-v1',sceneRevision:s.sceneRevision,stepIndex:s.stepIndex,timeSeconds:s.timeSeconds,positionM:s.positionM,velocityMps:s.velocityMps,orientationXYZW:s.orientationXYZW,fallVelocityYMps:s.fallVelocityYMps,grounded:s.grounded,support:s.support,blocked:s.blocked,assist:s.assist,queryCount:s.queryCount});
export const bits=value=>hex(encode(numbers(value)));
export const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b)&&bits(a)===bits(b);
export function observe(){return CASES.map(f=>{
 let core,pub,states=[],publicStates=[],error=null,retained=null,rejected=null;
 try{
  pub=createUprightCapsuleController(config(f));core=createCharacterCore(f.scene,f.positionM);
  states.push(core.getState());publicStates.push(pub.getSnapshot());
  for(let i=0;i<STEPS;i++){publicStates.push(pub.step(command(f)));states.push(core.step(DT,f.requestMps,f.scene.revision));}
 }catch(e){error={name:e.name,code:e.code,message:e.message};if(core){retained=core.getState();rejected=core.getLastRejected();}}
 finally{core?.dispose();pub?.dispose();}
 const metrics=f.expectedError?null:evaluate(f,states),sameCoreProjection=exact(publicStates,states.map(project));
 return {name:f.name,scene:structuredClone(f.scene),positionM:[...f.positionM],requestMps:[...f.requestMps],expectedError:f.expectedError,states,publicStates,error,retained,rejected,metrics,sameCoreProjection,passed:f.expectedError?error?.code===f.expectedError&&states.length===0:!error&&metrics.passed&&sameCoreProjection};
});}
const p95=s=>[...s].sort((a,b)=>a-b)[Math.ceil(s.length*.95)-1];
export function timing(){const fixtures=CASES.filter(f=>!f.expectedError);for(const f of fixtures){const c=createUprightCapsuleController(config(f));for(let i=0;i<STEPS;i++)c.step(command(f));c.dispose();}
 const trials=[];for(let t=0;t<3;t++){const trial=[];for(const f of fixtures){const c=createUprightCapsuleController(config(f)),request=command(f),samplesMs=[];let queryCount=0;for(let i=0;i<STEPS;i++){const start=performance.now(),s=c.step(request);samplesMs.push(performance.now()-start);queryCount+=s.queryCount;}c.dispose();const sorted=[...samplesMs].sort((a,b)=>a-b),percentile=p95(samplesMs);trial.push({name:f.name,samplesMs,p95Ms:percentile,medianMs:(sorted[119]+sorted[120])/2,minMs:sorted[0],maxMs:sorted.at(-1),spreadMs:sorted.at(-1)-sorted[0],queryCount,passed:percentile<=8.33});}trials.push(trial);}return {trials,passed:trials.flat().every(t=>t.passed),capture:false,publicStep:true};}
