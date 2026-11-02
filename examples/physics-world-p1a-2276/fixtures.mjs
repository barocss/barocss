// Existing admitted profiles. No tolerance, solver budget, or numeric law changes.
export const dt = 1 / 120;
const sphere = (id, positionM = [0, 0, 0]) => ({ id, kind: 'dynamic',
  shape: { kind: 'sphere', radiusM: 0.1 }, positionM,
  velocityMps: [0, 0, 0], massKg: 1, restitution: 0 });

export const profiles = [
  {
    name: 'persistent-warm', warmSteps: 120,
    source: 'examples/physics-scene/persistent-box-probe.mjs:8-19',
    config() {
      const friction = { static: 1, dynamic: 0.7 };
      const box = (id, y) => ({ id, kind: 'dynamic',
        shape: { kind: 'box', halfExtentsM: [0.25, 0.25, 0.25] },
        positionM: [0, y, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction });
      return { fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], contactMode: 'persistent-box-v1',
        bodies: [box('part:lower', 0.25), box('part:upper', 0.75),
          { id: 'fixture:floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] },
            positionM: [0, -0.1, 0], restitution: 0, friction }] };
    },
    faultCommands: [],
  },
  {
    name: 'sleeping-impulse-wake', warmSteps: 120,
    source: 'examples/physics-scene/large-scene-probe.mjs:115-121',
    config: () => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0], broadPhase: 'aabb',
      sceneMode: 'large-v1', bodies: [
        { id: 'fixture:floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [4, 0.1, 4] },
          positionM: [0, -0.1, 0], restitution: 0 },
        sphere('part:lower', [0, 0.1, 0]), sphere('part:upper', [0, 0.3, 0])] }),
    faultCommands: [{ kind: 'impulse', bodyId: 'part:upper', impulseNs: [0, 0.1, 0] }],
  },
  {
    name: 'dynamic-hinge-history', warmSteps: 30,
    source: 'examples/physics-scene/dynamic-hinge-motor-probe.mjs:5-14',
    config: () => ({ fixedStepSeconds: dt, gravityMps2: [0, 0, 0],
      bodies: [sphere('part:a'), sphere('part:b')], joints: [
        { id: 'joint:pair', kind: 'hinge', aId: 'part:a', bId: 'part:b',
          anchorALocalM: [0, 0, 0], anchorBLocalM: [0, 0, 0], axisWorld: [0, 0, 1],
          limitRad: [-0.51, 0.51], motor: { targetSpeedRadps: 0.5,
            maxImpulseNms: 0.0001, maxReactionNms: 0.0005 } }] }),
    faultCommands: [],
  },
];

export const ballisticConfig = () => ({ fixedStepSeconds: dt, gravityMps2: [0, -9.81, 0],
  bodies: [{ ...sphere('ball', [0, 2, 0]), massKg: 2 }] });
