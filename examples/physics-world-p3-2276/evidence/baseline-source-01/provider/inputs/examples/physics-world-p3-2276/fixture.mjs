/** P3 authored model data. Import performs no World or reference operation. */
import { makeModel, dynamicPart } from '../physics-model-input/model.mjs';

export const FIXED_DT = 1 / 120;
export const ORIGINAL_BODY_IDS = Object.freeze(['pairA0', 'pairB0', 'pairA1', 'pairB1']);
export const ORIGINAL_JOINT_IDS = Object.freeze(['hinge0', 'hinge1']);
// Fixed mappings from physics-public-disjoint-hinge-reference/variants.mjs.
export const RENAME_BODY_IDS = Object.freeze(['zLeft', 'aRight', 'yLeft', 'bRight']);
export const RENAME_JOINT_IDS = Object.freeze(['jointZulu', 'jointAlpha']);
export const BODY_ORDER = Object.freeze([3, 0, 1, 2]);
export const JOINT_ORDER = Object.freeze([1, 0]);

export function makeP3Fixture(variant = 'ORIGINAL') {
  if (!['ORIGINAL', 'RENAME', 'PERMUTE'].includes(variant)) throw new TypeError('unknown P3 fixture variant');
  const ids = variant === 'RENAME' ? RENAME_BODY_IDS : ORIGINAL_BODY_IDS;
  const jointIds = variant === 'RENAME' ? RENAME_JOINT_IDS : ORIGINAL_JOINT_IDS;
  let parts = [
    dynamicPart(ids[0], { kind: 'sphere', radiusM: .1 }, { positionM: [-.1, 0, 0] }, 1, { restitution: 0, friction: { static: 1, dynamic: .7 } }),
    dynamicPart(ids[1], { kind: 'sphere', radiusM: .1 }, { positionM: [.1, 0, 0] }, 1, { restitution: 0, friction: { static: 1, dynamic: .7 } }),
    dynamicPart(ids[2], { kind: 'sphere', radiusM: .1 }, { positionM: [-.1, 0, 1] }, 1, { restitution: 0, friction: { static: 1, dynamic: .7 } }),
    dynamicPart(ids[3], { kind: 'sphere', radiusM: .1 }, { positionM: [.1, 0, 1] }, 1, { restitution: 0, friction: { static: 1, dynamic: .7 } }),
  ];
  let joints = [0, 1].map(i => ({ id: jointIds[i], kind: 'hinge', bodyAId: ids[2 * i], bodyBId: ids[2 * i + 1],
    anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1],
    limitRad: [-.8, .8], motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } }));
  if (variant === 'PERMUTE') {
    parts = BODY_ORDER.map(i => parts[i]);
    joints = JOINT_ORDER.map(i => joints[i]);
  }
  return { model: makeModel({ revision: 'p3-original-f401', gravityMps2: [0, 0, 0], parts, joints }),
    options: { profile: 'rigid-discrete-v1', fixedStepSeconds: FIXED_DT, broadPhase: 'direct' } };
}
