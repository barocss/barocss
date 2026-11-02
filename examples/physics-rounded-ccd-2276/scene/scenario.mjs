import rawCases from '../cases.json';
import { dynamicPart, staticPart, makeModel } from '../../physics-model-input/model.mjs';

export const BALL_ID = 'ccd.ball';
export const BOX_ID = 'ccd.box';
export const DEFAULT_SCENARIO = 'corner';
const FEATURE_PRESETS = {
  corner: { label: '모서리 · 원래 사례', description: '구 중심이 상자의 둥근 모서리 경계에 도달합니다.', radiusM: .1, halfExtentsM: [.1, .1, .1], startM: [-.3, .15, 0], velocityMps: [36, 0, 0] },
  face: { label: '면', description: '구가 상자 면의 중심으로 이동합니다.', radiusM: .125, halfExtentsM: [.25, .25, .25], startM: [-1, 0, 0], velocityMps: [120, 0, 0] },
  vertex: { label: '꼭짓점', description: '구가 두 축 바깥에서 상자 꼭짓점에 접근합니다.', radiusM: .125, halfExtentsM: [.25, .25, .25], startM: [-1, .3125, .3125], velocityMps: [120, 0, 0] },
  'expanded-corner-miss': { label: '확장 상자 모서리 · 통과', description: '확장 AABB 안을 지나지만 실제 구와 상자는 접촉하지 않습니다.', radiusM: .125, halfExtentsM: [.25, .25, .25], startM: [-1, .359375, .359375], velocityMps: [120, 0, 0] },
  rotated: { label: '회전 상자 · 축 순환', description: '상자의 XYZW 자세는 [0.5, 0.5, 0.5, 0.5]입니다.', radiusM: .125, halfExtentsM: [.25, .25, .25], startM: [-1, .3125, .3125], velocityMps: [120, 0, 0], orientationXYZW: [.5, .5, .5, .5] },
};
const decode=v=>{const bytes=Uint8Array.from(v.$f64le.match(/../g),x=>parseInt(x,16));return new DataView(bytes.buffer).getFloat64(0,true);};
export const PRESETS=Object.freeze({...FEATURE_PRESETS,...Object.fromEntries(rawCases.cases.map(c=>['case-'+c.id,{label:c.id,description:'독립 기준의 원래 경계 입력을 공개 World로 실행합니다.',radiusM:decode(c.radius),halfExtentsM:c.half.map(decode),startM:c.start.map(decode),velocityMps:c.end.map((v,i)=>(decode(v)-decode(c.start[i]))*60),boxPositionM:c.boxCenter?.map(decode)??[0,0,0],expectedClass:c.expectedClass}]))});

export function createScenario(id = DEFAULT_SCENARIO) {
  if (!Object.hasOwn(PRESETS, id)) throw new TypeError(`Unknown CCD scenario: ${id}`);
  const scenario = { id, ...structuredClone(PRESETS[id]), boxPositionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1], hz: 60, maxSteps: 512 };
  scenario.orientationXYZW = [...(PRESETS[id].orientationXYZW ?? [0, 0, 0, 1])];
  scenario.boxPositionM=[...(PRESETS[id].boxPositionM??[0,0,0])];
  scenario.model = makeModel({ revision: `rounded-ccd-2276-${id}`, gravityMps2: [0, 0, 0], parts: [
    dynamicPart(BALL_ID, { kind: 'sphere', radiusM: scenario.radiusM }, { positionM: scenario.startM, velocityMps: scenario.velocityMps }, 1, { ccd: true }),
    staticPart(BOX_ID, { kind: 'box', halfExtentsM: scenario.halfExtentsM }, { positionM: scenario.boxPositionM, orientationXYZW: scenario.orientationXYZW }),
  ] });
  scenario.options = { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / scenario.hz, broadPhase: 'direct' };
  return scenario;
}
