import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysicsWorld } from '@barocss/physics';

// #region anisotropic-model
const model = orientationXYZW => ({
  format: 'barocss-physics-model', version: 1, revision: 'docsAnisotropic1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' },
  gravityMps2: [0, -9.81, 0],
  bodies: [{ id: 'box', kind: 'dynamic', massKg: 2,
    inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
    initial: { positionM: [0, 5, 0], orientationXYZW,
      velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] } }],
  colliders: [{ id: 'boxHull', bodyId: 'box',
    geometry: { kind: 'box', halfExtentsM: [0.25, 0.5, 0.75] },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 } }],
  joints: [], cloths: [], fluids: [], sourceBindings: [],
});
const options = { profile: 'rigid-persistent-box-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' };
// #endregion anisotropic-model

test('a rotated noncubic box advances without contact', () => {
  const world = createPhysicsWorld(model([0.1, 0.2, 0.3, Math.sqrt(0.86)]), options);
  try {
    for (let n = 0; n < 12; n++) world.step([]);
    const state = world.getState(), h = options.fixedStepSeconds;
    assert.equal(state.stepIndex, 12);
    assert.equal(state.contacts.length, 0);
    assert.ok(Math.abs(state.bodies[0].positionM[1] - (5 - 9.81 * h * h * 12 * 13 / 2)) <= 1e-10);
  } finally { world.dispose(); }
});

test('an angular impulse acts once about a rotated principal axis', () => {
  // #region anisotropic-principal-step
  const world = createPhysicsWorld(model([0, 0, Math.SQRT1_2, Math.SQRT1_2]), options);
  try {
    world.step([{ kind: 'angularImpulse', bodyId: 'box', angularImpulseNms: [0, 1 / 8, 0] }]);
    for (let n = 1; n < 12; n++) world.step([]);
    const state = world.getState(), body = state.bodies[0];
    // Body X is world Y in this initial pose. I_x = 13/24 kg·m².
    assert.ok(Math.abs(body.angularVelocityRadps[1] - 3 / 13) <= 1e-10);
    assert.equal(state.stepIndex, 12);
    assert.equal(state.contacts.length, 0);
  } finally { world.dispose(); }
  // #endregion anisotropic-principal-step
});
