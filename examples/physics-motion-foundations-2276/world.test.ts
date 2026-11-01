import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld } from '@barocss/physics';
import { makeModel, dynamicPart } from '../physics-model-input/model.mjs';

const sphere = (id: string, x = 0, massKg = 1, vx = 0) => dynamicPart(id,
  { kind: 'sphere', radiusM: 0.2 }, { positionM: [x, 0, 0], velocityMps: [vx, 0, 0] }, massKg,
  { restitution: 1 });
const near = (a: number, b: number, e: number) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}, tol ${e}`);

test('ballistic analytic truth separates integration error from repeatability', () => {
  const samples = [60, 120, 240].map(hz => {
    const dt = 1 / hz, model = makeModel({ parts: [sphere('fall')] }),
      options = { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' } as const;
    const world = createPhysicsWorld(model, options), repeat = createPhysicsWorld(model, options);
    let state = world.getState();
    for (let i = 0; i < hz; i++) {
      state = world.step();
      assert.deepEqual(repeat.step(), state);
    }
    const b = state.bodies[0], exactY = -4.905, exactVy = -9.81;
    const errorM = Math.abs(b.positionM[1] - exactY);
    near(b.velocityMps[1], exactVy, 1e-11);
    assert.ok(errorM < 0.083);
    // Exact ballistic energy is constant. This is measured error, not an adjusted oracle.
    const energyErrorJ = 0.5 * b.velocityMps[1] ** 2 + 9.81 * b.positionM[1];
    world.dispose(); repeat.dispose();
    return { dt, errorM, velocityErrorMps: Math.abs(b.velocityMps[1] - exactVy), energyErrorJ };
  });
  const ratios = [samples[0].errorM / samples[1].errorM, samples[1].errorM / samples[2].errorM];
  for (const ratio of ratios) assert.ok(ratio >= 1.99 && ratio <= 2.01);
  console.log(JSON.stringify({ metric: 'ballistic', samples, ratios, order: 1, deterministicRepeat: true }));
});

test('unequal-mass elastic spheres conserve linear momentum and kinetic energy', () => {
  const dt = 1 / 120;
  const world = createPhysicsWorld(makeModel({ gravityMps2: [0, 0, 0],
    parts: [sphere('a', -0.3, 2, 1), sphere('b', 0.3, 1, -1)] }),
  { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' });
  let impact = false, maxMomentumError = 0, maxEnergyError = 0;
  for (let i = 0; i < 120; i++) {
    const s = world.step(), [a, b] = s.bodies;
    maxMomentumError = Math.max(maxMomentumError, Math.abs(2 * a.velocityMps[0] + b.velocityMps[0] - 1));
    maxEnergyError = Math.max(maxEnergyError, Math.abs(a.velocityMps[0] ** 2 + 0.5 * b.velocityMps[0] ** 2 - 1.5));
    if (s.contacts.length) impact = true;
    if (impact) { near(a.velocityMps[0], -1 / 3, 1e-10); near(b.velocityMps[0], 5 / 3, 1e-10); }
  }
  assert.ok(impact); assert.ok(maxMomentumError <= 1e-10); assert.ok(maxEnergyError <= 1e-10);
  world.dispose();
  console.log(JSON.stringify({ metric: 'elastic-impact', maxMomentumError, maxEnergyError }));
});

test('sphere inertia and finite rotation agree with angular impulse and exact spin', () => {
  const dt = 1 / 120;
  const world = createPhysicsWorld(makeModel({ gravityMps2: [0, 0, 0], parts: [sphere('rotor', 0, 2)] }),
  { profile: 'rigid-discrete-v1', fixedStepSeconds: dt, broadPhase: 'direct' });
  let s = world.step([{ kind: 'angularImpulse', bodyId: 'rotor', angularImpulseNms: [0, 0, 0.032] }]);
  // Inertia is model data, not a state field. Observe I = applied angular impulse / accepted spin.
  near(0.032 / s.bodies[0].angularVelocityRadps[2], 0.032, 1e-14);
  for (let i = 1; i < 120; i++) s = world.step();
  const b = s.bodies[0]; near(b.angularVelocityRadps[2], 1, 1e-12);
  const rotationError = Math.max(Math.abs(b.orientationXYZW[2] - Math.sin(0.5)), Math.abs(b.orientationXYZW[3] - Math.cos(0.5)));
  assert.ok(rotationError <= 1e-11);
  world.dispose();
  console.log(JSON.stringify({ metric: 'uniform-sphere-spin', rotationError, angularMomentumNms: 0.032 * b.angularVelocityRadps[2] }));
});
