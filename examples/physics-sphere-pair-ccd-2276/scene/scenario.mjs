import {makeModel,dynamicPart} from '../../physics-model-input/model.mjs';
export const MARKED_ID='marked',OTHER_ID='other';
export const DEFAULT_SCENARIO='minimum-miss';
export const PRESETS=Object.freeze({
 'minimum-miss':{label:'최소 반지름 · 원래 MISS',radii:[.0001,.0001],starts:[[5,.00020000001,0],[-5,0,0]],velocities:[[-600,0,0],[600,0,0]],dt:1/60,displayRadiusScale:1000,expectedClass:'MISS'},
 'minimum-graze':{label:'최소 반지름 · 실제 접선 충돌',radii:[.0001,.0001],starts:[[5,.0002,0],[-5,0,0]],velocities:[[-600,0,0],[600,0,0]],dt:1/60,displayRadiusScale:1000,expectedClass:'HIT'},
 'head-on':{label:'일반 반지름 · 정면 충돌',radii:[.1,.1],starts:[[-1,0,0],[1,0,0]],velocities:[[400,0,0],[-400,0,0]],dt:1/60,displayRadiusScale:1,expectedClass:'HIT'},
 'graze':{label:'일반 반지름 · 접선 충돌',radii:[.1,.1],starts:[[-1,.2,0],[1,0,0]],velocities:[[400,0,0],[-400,0,0]],dt:1/60,displayRadiusScale:1,expectedClass:'HIT'},
});
export function createScenario(id=DEFAULT_SCENARIO){
 if(!Object.hasOwn(PRESETS,id))throw TypeError('Unknown sphere-pair preset: '+id);const s={id,...structuredClone(PRESETS[id]),maxSteps:512};
 s.model=makeModel({revision:id==='minimum-miss'?'g2-sphere-pair-near-graze':'g2-sphere-pair-desktop-'+id,gravityMps2:[0,0,0],parts:[MARKED_ID,OTHER_ID].map((name,i)=>dynamicPart(name,{kind:'sphere',radiusM:s.radii[i]},{positionM:s.starts[i],velocityMps:s.velocities[i]},1,{ccd:i===0}))});
 s.options={profile:'rigid-discrete-v1',fixedStepSeconds:s.dt,broadPhase:'direct'};
 s.description='두 구의 수락한 위치와 자세를 표시합니다. 표시 반지름은 충돌 경계의 증거가 아닙니다.';return s;
}
