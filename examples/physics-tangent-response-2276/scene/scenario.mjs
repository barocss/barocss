import { makeModel, dynamicPart, staticPart } from '../../physics-model-input/model.mjs';
export const DEFAULT_SCENARIO='cuboid';
export const PRESETS=Object.freeze({
 cuboid:{label:'직육면체 · 두 축 정지 마찰',shape:'box',dt:1/128,massKg:1,halfExtentsM:[1,.5,.5],inertiaKgM2:[1/6,5/12,5/12],velocityMps:[1,-1,1],movingId:'z-box',sphereStatic:1,floorStatic:1,sphereDynamic:.5,floorDynamic:.5},
 'static-next-down':{label:'구 · 경계 바로 아래',shape:'sphere',speed:1.7499999999999998},
 'static-exact':{label:'구 · 정확한 경계 1.75',shape:'sphere',speed:1.75},
 'dynamic-next-up':{label:'구 · 경계 바로 위',shape:'sphere',speed:1.7500000000000002},
});
export function createScenario(id=DEFAULT_SCENARIO){
 if(!Object.hasOwn(PRESETS,id))throw TypeError('Unknown tangent preset: '+id);
 const p=PRESETS[id],s={dt:1/120,massKg:2,radiusM:.5,inertiaKgM2:[.2,.2,.2],movingId:'z-sphere',fixedId:'a-floor',sphereStatic:1,floorStatic:.25,sphereDynamic:.25,floorDynamic:.0625,...structuredClone(p),id,maxSteps:512};
 s.velocityMps=s.velocityMps??[s.speed,-1,0];s.initialPositionM=s.shape==='box'?[-s.dt,.5+s.dt,-s.dt]:[0,.5,0];
 const floor=staticPart(s.fixedId,{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{friction:{static:s.floorStatic,dynamic:s.floorDynamic},restitution:0,ccd:false});
 const moving=dynamicPart(s.movingId,s.shape==='box'?{kind:'box',halfExtentsM:s.halfExtentsM}:{kind:'sphere',radiusM:s.radiusM},{positionM:s.initialPositionM,velocityMps:s.velocityMps},s.massKg,{friction:{static:s.sphereStatic,dynamic:s.sphereDynamic},restitution:0,ccd:false});
 s.model=makeModel({revision:s.shape==='sphere'?'g2-material-'+id:'g2-tangent-cuboid-desktop',gravityMps2:[0,0,0],parts:[floor,moving]});
 s.options={profile:'rigid-discrete-v1',fixedStepSeconds:s.dt,broadPhase:'direct'};
 s.description=s.shape==='box'?'중심 충돌의 첫 단계에서 두 접선 축의 정지 마찰을 확인합니다.':'원래 구 입력을 유지합니다. 표현 가능한 인접 속도를 비교합니다.';
 return s;
}
