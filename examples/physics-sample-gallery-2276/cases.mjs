// Literal authored DTOs only. No package, oracle or expected-state imports.
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
export const budget=Object.freeze({maxWorldsPerGraph:48,maxAcceptedStepsPerGraph:1024,
  plannedWorldsPerGraph:12,primaryStepsPerGraph:385,plannedAcceptedStepsPerGraph:770,
  evidenceBytesPerGraph:16*1024*1024,wireBytes:2*1024*1024,numericWordBytes:512*1024,
  maxDepth:32,maxNodes:262144,innerMs:170000,outerMs:180000});
const material=(e=0,mu=0)=>({restitution:e,friction:{static:mu,dynamic:mu}});
function box(id,positionM,velocityMps=[0,0,0],half=[.5,.5,.5],orientationXYZW=[0,0,0,1],e=0){
  return dynamicPart(id,{kind:'box',halfExtentsM:half},{positionM,velocityMps,orientationXYZW,angularVelocityRadps:[0,0,0]},2,material(e));
}
function floor(e=0,mu=0,half=[2,.5,2]){
  return staticPart('floor',{kind:'box',halfExtentsM:half},{positionM:[0,-half[1],0]},material(e,mu));
}
export function makeCases(){
  const definitions=[
    {caseId:'projectile',label:'포물선 운동',parts:[box('moving',[-1,3,0],[2,2,0])],steps:64,profile:'rigid-discrete-v1'},
    {caseId:'elastic-box',label:'탄성 상자',parts:[box('moving',[0,.75,0],[0,0,0],[.5,.5,.5],[0,0,0,1],1),floor(1)],steps:64},
    {caseId:'sphere-roll',label:'구의 미끄럼과 구름',parts:[dynamicPart('moving',{kind:'sphere',radiusM:.5},
      {positionM:[-1,.5,0],velocityMps:[1,0,0],orientationXYZW:[0,0,0,1],angularVelocityRadps:[0,0,0]},1,material(0,.2)),floor(0,.2,[3,.25,2])],steps:64,profile:'rigid-discrete-v1'},
    {caseId:'sphere-ccd',label:'고속 구 충돌',parts:[
      dynamicPart('a-sphere',{kind:'sphere',radiusM:.05},{positionM:[-.5,0,0],velocityMps:[100,0,0]},1,{...material(),ccd:true}),
      dynamicPart('z-sphere',{kind:'sphere',radiusM:.05},{positionM:[.5,0,0],velocityMps:[-100,0,0]},1,material())],steps:1,profile:'rigid-discrete-v1',dt:1/30,gravity:[0,0,0]},
    {caseId:'principal-spin',label:'비등방 상자 회전',parts:[box('lower',[0,.5,0]),
      box('upper',[0,5,0],[0,0,0],[.25,.5,.75],[0,0,Math.SQRT1_2,Math.SQRT1_2]),floor()],steps:64},
    {caseId:'coupled-two',label:'두 상자와 바닥',parts:[box('lower',[0,.5,0]),box('upper',[0,1.75,0]),floor()],steps:128},
  ];
  return definitions.map(({caseId,label,parts,steps,profile='rigid-persistent-box-v1',dt=1/120,gravity=[0,-9.81,0]})=>({
    caseId,label,model:makeModel({revision:'gallery-'+caseId,gravityMps2:gravity,parts}),
    options:{profile,fixedStepSeconds:dt,broadPhase:'direct'},steps,
    commands:Array.from({length:steps},(_,index)=>caseId==='principal-spin'&&index===0?
      [{kind:'angularImpulse',bodyId:'upper',angularImpulseNms:[0,.125,0]}]:[]),checkpoints:[0,1,steps],
  }));
}
