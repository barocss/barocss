// Authored original HINGE2 data. No constructor, parser or physical operation at import.
export const FIXED_DT = 1 / 120;
export function makeWorldFixture() {
  return {
    fixedStepSeconds: FIXED_DT, gravityMps2: [0, 0, 0],
    bodies: [
      { id: 'pairA0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [-.1, 0, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
      { id: 'pairB0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [.1, 0, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
      { id: 'pairA1', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [-.1, 0, 1], velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
      { id: 'pairB1', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [.1, 0, 1], velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
    ],
    joints: [
      { id: 'hinge0', kind: 'hinge', aId: 'pairA0', bId: 'pairB0', anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1], limitRad: [-.8, .8], motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } },
      { id: 'hinge1', kind: 'hinge', aId: 'pairA1', bId: 'pairB1', anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1], limitRad: [-.8, .8], motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } },
    ],
  };
}
