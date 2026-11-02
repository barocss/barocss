import { dynamicPart, staticPart, makeModel } from '../../physics-model-input/model.mjs';
export const MOVING_ID = 'impact.moving', OTHER_ID = 'impact.other';
export const DEFAULT_SCENARIO = 'minimum';
export const PRESETS = Object.freeze({
  minimum: { label: '최소 반발계수 · 0.25', speed: 2, bodyE: .8, otherE: .25 },
  threshold: { label: '경계 속도 · 정확히 0.5', speed: .5, bodyE: 1, otherE: 1 },
  above: { label: '경계 바로 위 · 0.5000000000000001', speed: .5000000000000001, bodyE: 1, otherE: 1 },
  unit: { label: '완전 탄성 · 1', speed: 2, bodyE: 1, otherE: 1 },
  zero: { label: '반발 없음 · 0', speed: 2, bodyE: 0, otherE: 1 },
  pair: { label: '같은 질량 · 두 상자', speed: 2, bodyE: .8, otherE: .25, pair: true },
});
export function createScenario(id = DEFAULT_SCENARIO) {
  if (!Object.hasOwn(PRESETS,id)) throw new TypeError('Unknown impact preset: '+id);
  const preset = PRESETS[id], halfExtentsM = [.5,.5,.5], otherHalfExtentsM = preset.pair ? halfExtentsM : [2,.5,2];
  const parts = [preset.pair
    ? dynamicPart(OTHER_ID,{kind:'box',halfExtentsM},{positionM:[0,-.5,0]},2,{restitution:preset.otherE})
    : staticPart(OTHER_ID,{kind:'box',halfExtentsM:otherHalfExtentsM},{positionM:[0,-.5,0]},{restitution:preset.otherE}),
    dynamicPart(MOVING_ID,{kind:'box',halfExtentsM},{positionM:[0,.5,0],velocityMps:[0,-preset.speed,0]},2,{restitution:preset.bodyE})];
  return { id,...preset,halfExtentsM,otherHalfExtentsM,maxSteps:512,
    description:'중력과 마찰이 없는 중심 충돌입니다. 수락한 상태를 표시합니다.',
    model:makeModel({revision:'persistent-impact-2276-'+id,gravityMps2:[0,0,0],parts}),
    options:{profile:'rigid-persistent-box-v1',fixedStepSeconds:1/120,broadPhase:'direct'} };
}
