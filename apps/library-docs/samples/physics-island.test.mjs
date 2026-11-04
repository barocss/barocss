import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';

// #region two-cubes-floor-model
const initial = positionM => ({ positionM, orientationXYZW: [0, 0, 0, 1],
  velocityMps: [0, 0, 0], angularVelocityRadps: [0, 0, 0] });
const cube = (id, y) => ({ id, kind: 'dynamic', massKg: 2,
  inertia: { kind: 'primitive-com', about: 'com', frame: 'body-local' },
  initial: initial([0, y, 0]) });
const model = {
  format: 'barocss-physics-model', version: 1, revision: 'docsCoupledCubes1',
  frame: { id: 'world', basis: 'right-handed-xyz', rotation: 'local-to-world-xyzw' },
  units: { length: 'm', mass: 'kg', time: 's', angle: 'rad' },
  gravityMps2: [0, -9.81, 0],
  bodies: [cube('lower', 0.5), cube('upper', 1.75),
    { id: 'floor', kind: 'static', initial: { positionM: [0, -0.5, 0], orientationXYZW: [0, 0, 0, 1] } }],
  colliders: ['lower', 'upper', 'floor'].map(bodyId => ({
    id: `hull:${bodyId}`, bodyId,
    geometry: { kind: 'box', halfExtentsM: bodyId === 'floor' ? [2, 0.5, 2] : [0.5, 0.5, 0.5] },
    local: { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] },
    material: { restitution: 0, friction: { static: 0, dynamic: 0 } },
    sensor: false, ccd: false, filter: { categoryBits: 1, maskBits: 65535 },
  })),
  joints: [], cloths: [], fluids: [], sourceBindings: [],
};
const options = { profile: 'rigid-persistent-box-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' };
// #endregion two-cubes-floor-model

test('two cubes and floor use the common World and configured clock', () => {
  // #region two-cubes-floor-step
  const world = createPhysicsWorld(model, options);
  try {
    for (let i = 0; i < 32; i++) world.step([]);
    const state = world.getState();
    // Render state.bodies; rendering does not advance the World.
    assert.equal(state.stepIndex, 32);
    assert.equal(state.timeSeconds, 32 / 120);
    assert.equal(state.contacts.length, 2);
    for (const [id, height] of [['lower', 0.5], ['upper', 1.5]]) {
      const body = state.bodies.find(value => value.id === id);
      assert.ok(Math.abs(body.positionM[1] - height) <= 1e-10);
      assert.ok(Math.abs(body.velocityMps[1]) <= 1e-10);
    }
  } finally { world.dispose(); }
  // #endregion two-cubes-floor-step
});

test('the zero-friction island has an explicit direct-broadphase boundary', () => {
  assert.throws(() => createPhysicsWorld(model, { ...options, broadPhase: 'aabb' }),
    error => error instanceof PhysicsError && error.code === 'INVALID_CONFIG');
});

test('three cubes and floor stay within the existing four-body profile', () => {
  // #region three-cubes-floor-step
  const chain = structuredClone(model);
  chain.revision = 'docsThreeCubes1';
  chain.bodies.find(body => body.id === 'upper').initial.positionM[1] = 2.75;
  chain.bodies.push(cube('middle', 1.5));
  chain.colliders.push({ ...structuredClone(chain.colliders[0]),
    id: 'hull:middle', bodyId: 'middle' });
  const world = createPhysicsWorld(chain, options);
  try {
    for (let i = 0; i < 32; i++) world.step([]);
    const state = world.getState();
    assert.equal(state.stepIndex, 32);
    assert.equal(state.contacts.length, 3);
    for (const [id, height] of [['lower', 0.5], ['middle', 1.5], ['upper', 2.5]]) {
      const body = state.bodies.find(value => value.id === id);
      assert.ok(Math.abs(body.positionM[1] - height) <= 1e-10);
      assert.ok(Math.abs(body.velocityMps[1]) <= 1e-10);
    }
  } finally { world.dispose(); }
  // #endregion three-cubes-floor-step
});
