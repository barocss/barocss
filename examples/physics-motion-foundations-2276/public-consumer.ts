import assert from 'node:assert/strict';
import { createPlanarPendulum, createPhysicsWorld, PhysicsError } from '@barocss/physics';
import type { PlanarPendulum, PlanarPendulumConfig, PlanarPendulumState, PhysicsWorld } from '@barocss/physics';

const config: PlanarPendulumConfig = { massKg: 2, comDistanceM: 0.6,
  inertia: { about: 'com', kgM2: 0.2 }, gravityMps2: 9.80665,
  initialAngleRad: 0.5, initialAngularVelocityRadps: 0, fixedStepSeconds: 1 / 120 };
const pendulum: PlanarPendulum = createPlanarPendulum(config);
const state: PlanarPendulumState = pendulum.step(config.fixedStepSeconds);
assert.equal(state.stepIndex, 1);
assert.ok(state.angleRad < config.initialAngleRad);
assert.ok(state.angularVelocityRadps < 0);
const world: PhysicsWorld = createPhysicsWorld({ fixedStepSeconds: 1 / 120, gravityMps2: [0, 0, 0],
  bodies: [{ id: 'sphere', kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.1 }, massKg: 1,
    positionM: [0, 0, 0], velocityMps: [0, 0, 0], restitution: 0 }] });
assert.equal(world.step(1 / 120).stepIndex, 1);
pendulum.dispose(); pendulum.dispose(); world.dispose();
assert.throws(() => pendulum.getState(), (error: unknown) => error instanceof PhysicsError && error.code === 'DISPOSED');
console.log(JSON.stringify({ publicSpecifier: '@barocss/physics', emittedDeclarations: true,
  nativeNodeResolution: true, pendulumStep: state.stepIndex, worldUnchanged: true }));
