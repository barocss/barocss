import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import type { PhysicsBodyState, PhysicsContact, PhysicsState, PhysicsWorldConfig, Vec3 } from '@barocss/physics';

// Frozen before execution. Two tests use 3000 + 240 = 3240 successful steps.
const DT = 1 / 120, MASS = 2, RADIUS = 0.2, GRAVITY = 9.81;
const INERTIA = 2 * MASS * RADIUS ** 2 / 5;
const MU_STATIC = 0.25, MU_DYNAMIC = 0.2;
const GATES = { gapM: 1e-10, motion: 1e-10, impulseNs: 1e-10,
  tangentNs: 1e-12, cumulativeNs: 1e-8, energyJ: 1e-10,
  slidingPositionM: 1e-3, rolling: 1e-9 };

function configuration(speed = 0): PhysicsWorldConfig {
  return { fixedStepSeconds: DT, gravityMps2: [0, -GRAVITY, 0], bodies: [
    { id: 'floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] },
      positionM: [0, -0.1, 0], restitution: 0, friction: { static: MU_STATIC, dynamic: MU_DYNAMIC } },
    { id: 'sphere', kind: 'dynamic', shape: { kind: 'sphere', radiusM: RADIUS }, massKg: MASS,
      positionM: [0, RADIUS, 0], velocityMps: [speed, 0, 0], restitution: 0,
      friction: { static: MU_STATIC, dynamic: MU_DYNAMIC } },
  ] };
}

const norm = (v: Vec3): number => Math.hypot(...v);
const dot = (a: Vec3, b: Vec3): number => a.reduce((sum, value, i) => sum + value * b[i], 0);
const add = (a: Vec3, b: Vec3): Vec3 => a.map((value, i) => value + b[i]) as Vec3;
const mean = (a: Vec3, b: Vec3): Vec3 => a.map((value, i) => (value + b[i]) / 2) as Vec3;
const sphereOf = (state: PhysicsState): PhysicsBodyState => state.bodies.find((body) => body.id === 'sphere')!;
const near = (actual: number, expected: number, tolerance: number): void => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} vs ${expected}; tolerance ${tolerance}`);
};

function kinetic(body: PhysicsBodyState): number {
  return MASS * dot(body.velocityMps, body.velocityMps) / 2
    + INERTIA * dot(body.angularVelocityRadps, body.angularVelocityRadps) / 2;
}

function geometry(body: PhysicsBodyState): number {
  // Fixed input floor top=0. This does not read producer contact points or depth.
  assert.ok(Math.abs(body.positionM[0]) + RADIUS < 2);
  assert.ok(Math.abs(body.positionM[2]) + RADIUS < 2);
  const gap = body.positionM[1] - RADIUS;
  assert.ok(Math.abs(gap) <= GATES.gapM, `Independent floor gap ${gap}`);
  return gap;
}

function impulseOnSphere(contact: PhysicsContact): { normal: Vec3; tangent: Vec3; total: Vec3 } {
  assert.ok((contact.aId === 'floor' && contact.bId === 'sphere')
    || (contact.bId === 'floor' && contact.aId === 'sphere'));
  const sign = contact.bId === 'sphere' ? 1 : -1;
  const normal = contact.normalAtoB.map((value) => sign * value * contact.impulseNs) as Vec3;
  const tangent = contact.tangentImpulseNs.map((value) => sign * value) as Vec3;
  near(contact.normalAtoB[0], 0, GATES.impulseNs);
  near(sign * contact.normalAtoB[1], 1, GATES.impulseNs);
  near(contact.normalAtoB[2], 0, GATES.impulseNs);
  assert.ok(contact.impulseNs >= 0);
  near(dot(tangent, [0, 1, 0]), 0, GATES.tangentNs);
  return { normal, tangent, total: add(normal, tangent) };
}

test('one sphere has geometric stationary support on a finite floor for 3000 steps', (context) => {
  const world = createPhysicsWorld(configuration());
  let maxGapM = 0, maxSupportErrorNs = 0, maxEnergyErrorJ = 0, totalNormalNs = 0;
  for (let i = 0; i < 3000; i++) {
    const state = world.step(DT), sphere = sphereOf(state);
    maxGapM = Math.max(maxGapM, Math.abs(geometry(sphere)));
    assert.ok(norm(sphere.velocityMps) <= GATES.motion);
    assert.ok(norm(sphere.angularVelocityRadps) <= GATES.motion);
    assert.equal(state.joints.length, 0);
    assert.equal(state.contacts.length, 1);
    const impulse = impulseOnSphere(state.contacts[0]);
    const supportError = Math.abs(impulse.normal[1] - MASS * GRAVITY * DT);
    maxSupportErrorNs = Math.max(maxSupportErrorNs, supportError);
    assert.ok(supportError <= GATES.impulseNs);
    assert.ok(norm(impulse.tangent) <= GATES.tangentNs);
    totalNormalNs += impulse.normal[1];
    const energy = kinetic(sphere) + MASS * GRAVITY * (sphere.positionM[1] - RADIUS);
    maxEnergyErrorJ = Math.max(maxEnergyErrorJ, Math.abs(energy));
    assert.ok(Math.abs(energy) <= GATES.energyJ);
    if (i === 4) {
      const retained = world.getState();
      state.bodies[1].positionM[1] = 99;
      state.contacts[0].normalAtoB[1] = 99;
      state.contacts[0].tangentImpulseNs[0] = 99;
      state.contacts[0].pointM[1] = 99;
      assert.deepEqual(world.getState(), retained);
      assert.throws(() => world.step(DT / 2),
        (error: unknown) => error instanceof PhysicsError && error.code === 'INVALID_STEP');
      assert.deepEqual(world.getState(), retained);
    }
  }
  const cumulativeBalanceNs = Math.abs(totalNormalNs - MASS * GRAVITY * DT * 3000);
  assert.ok(cumulativeBalanceNs <= GATES.cumulativeNs);
  context.diagnostic(JSON.stringify({ metric: 'finite-floor-sphere-support', steps: 3000,
    maxGapM, maxSupportErrorNs, cumulativeBalanceNs, maxEnergyErrorJ }));
  world.dispose(); world.dispose();
  for (const action of [() => world.getState(), () => world.step(DT)]) {
    assert.throws(action, (error: unknown) => error instanceof PhysicsError && error.code === 'DISPOSED');
  }
});

test('one uniform sphere slides then rolls with analytic impulse, energy and work checks', (context) => {
  const world = createPhysicsWorld(configuration(1));
  let previous = sphereOf(world.getState());
  const initialEnergyJ = kinetic(previous);
  let maxMomentumErrorNs = 0, maxAngularErrorNms = 0, maxWorkErrorJ = 0;
  let maxEnergyGrowthJ = 0, maxSlidingPositionErrorM = 0, maxGapM = 0;
  for (let i = 1; i <= 240; i++) {
    const state = world.step(DT), sphere = sphereOf(state);
    assert.equal(state.contacts.length, 1);
    assert.equal(state.joints.length, 0);
    maxGapM = Math.max(maxGapM, Math.abs(geometry(sphere)));
    const impulse = impulseOnSphere(state.contacts[0]);
    near(impulse.normal[1], MASS * GRAVITY * DT, GATES.impulseNs);
    assert.ok(norm(impulse.tangent) <= MU_STATIC * impulse.normal[1] + GATES.impulseNs);
    // A sphere on y=0 has the exact physical arm (0,-r,0), independent of
    // the producer's contact points and penetration correction.
    const torque: Vec3 = [-RADIUS * impulse.tangent[2], 0, RADIUS * impulse.tangent[0]];
    const freeVelocity = add(previous.velocityMps, [0, -GRAVITY * DT, 0]);
    for (let axis = 0; axis < 3; axis++) {
      const momentumError = Math.abs(MASS * (sphere.velocityMps[axis] - freeVelocity[axis]) - impulse.total[axis]);
      const angularError = Math.abs(INERTIA * (sphere.angularVelocityRadps[axis]
        - previous.angularVelocityRadps[axis]) - torque[axis]);
      maxMomentumErrorNs = Math.max(maxMomentumErrorNs, momentumError);
      maxAngularErrorNms = Math.max(maxAngularErrorNms, angularError);
      assert.ok(momentumError <= GATES.impulseNs);
      assert.ok(angularError <= GATES.impulseNs);
    }
    const freeKinetic = MASS * dot(freeVelocity, freeVelocity) / 2
      + INERTIA * dot(previous.angularVelocityRadps, previous.angularVelocityRadps) / 2;
    const impulseWork = dot(impulse.total, mean(freeVelocity, sphere.velocityMps))
      + dot(torque, mean(previous.angularVelocityRadps, sphere.angularVelocityRadps));
    const workError = Math.abs(kinetic(sphere) - freeKinetic - impulseWork);
    maxWorkErrorJ = Math.max(maxWorkErrorJ, workError);
    assert.ok(workError <= GATES.energyJ);
    const energyGrowth = kinetic(sphere) - kinetic(previous);
    maxEnergyGrowthJ = Math.max(maxEnergyGrowthJ, energyGrowth);
    assert.ok(energyGrowth <= GATES.energyJ);
    if (i <= 12) {
      const time = i * DT;
      near(sphere.velocityMps[0], 1 - MU_DYNAMIC * GRAVITY * time, GATES.motion);
      near(sphere.angularVelocityRadps[2], -5 * MU_DYNAMIC * GRAVITY * time / (2 * RADIUS), GATES.motion);
      near(impulse.tangent[0], -MU_DYNAMIC * MASS * GRAVITY * DT, GATES.impulseNs);
      const positionError = Math.abs(sphere.positionM[0] - (time - MU_DYNAMIC * GRAVITY * time * time / 2));
      maxSlidingPositionErrorM = Math.max(maxSlidingPositionErrorM, positionError);
      assert.ok(positionError <= GATES.slidingPositionM);
    }
    previous = sphere;
  }
  near(previous.velocityMps[0], 5 / 7, GATES.rolling);
  near(previous.angularVelocityRadps[2], -5 / (7 * RADIUS), GATES.rolling);
  near(previous.velocityMps[0] + RADIUS * previous.angularVelocityRadps[2], 0, GATES.rolling);
  near(kinetic(previous), 5 * initialEnergyJ / 7, GATES.rolling);
  context.diagnostic(JSON.stringify({ metric: 'sphere-sliding-to-rolling', steps: 240,
    maxGapM, maxMomentumErrorNs, maxAngularErrorNms, maxWorkErrorJ, maxEnergyGrowthJ,
    maxSlidingPositionErrorM, finalSpeedMps: previous.velocityMps[0],
    finalSpinRadps: previous.angularVelocityRadps[2], finalEnergyJ: kinetic(previous) }));
  world.dispose();
});
