import specification from '../CASES-02.json';
import {makeModel,dynamicPart,staticPart} from '../../physics-model-input/model.mjs';
const labels={
 'centered-y-entry':'양의 단위 자세 · HIT',
 'negative-moving-quaternion':'이동 상자 q 부호 반전 · HIT',
 'negative-fixture-quaternion':'정적 상자 q 부호 반전 · HIT',
 'parallel-outside':'바깥 평행 경로 · MISS',
};
export const DEFAULT_SCENARIO='centered-y-entry';
export const PRESETS=Object.freeze(Object.fromEntries(Object.entries(labels).map(([id,label])=>[id,{label}])));
export function createScenario(id=DEFAULT_SCENARIO){
 if(!Object.hasOwn(PRESETS,id))throw TypeError('Unknown box CCD preset: '+id);
 const c=structuredClone(specification.cases.find(c=>c.id===id)),p=specification.physical;
 const moving=dynamicPart('moving',{kind:'box',halfExtentsM:p.halfExtentsM},{positionM:c.start,velocityMps:c.velocity,orientationXYZW:c.mutation==='negative-moving-q'?[0,0,0,-1]:[0,0,0,1]},p.massKg,{ccd:true});
 const fixture=staticPart('fixture',{kind:'box',halfExtentsM:p.fixedHalfExtentsM},{positionM:c.fixtureCenter??[0,0,0],orientationXYZW:c.mutation==='negative-fixture-q'?[0,0,0,-1]:[0,0,0,1]});
 return {id,label:PRESETS[id].label,description:'동일한 물리 자세의 q와 -q를 비교합니다. 화면은 수락한 상태를 표시합니다.',halfExtentsM:[...p.halfExtentsM],otherHalfExtentsM:[...p.fixedHalfExtentsM],dt:p.dt,maxSteps:512,inputCase:c,
 model:makeModel({revision:'g2-box-slab-'+id,gravityMps2:[0,0,0],parts:[moving,fixture]}),options:{profile:'rigid-discrete-v1',fixedStepSeconds:p.dt,broadPhase:'direct'}};
}
