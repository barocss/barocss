import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import type { PhysicsBodyConfig, PhysicsJointConfig } from '@barocss/physics';

test('historical public hinge and eight-box limitations stay explicit', () => {
  const bodies: PhysicsBodyConfig[] = ['pairA0', 'pairB0', 'pairA1', 'pairB1'].map((id, i) => ({
    id, kind: 'dynamic', shape: { kind: 'sphere', radiusM: 0.1 },
    positionM: [i % 2 ? 0.1 : -0.1, 0, i < 2 ? 0 : 1],
    velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: 0.7 },
  }));
  const joints: PhysicsJointConfig[] = [0, 1].map(i => ({
    id: `hinge${i}`, kind: 'hinge', aId: bodies[2 * i].id, bId: bodies[2 * i + 1].id,
    anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0], axisWorld: [0, 0, 1],
    limitRad: [-0.8, 0.8], motor: { targetSpeedRadps: 0.5, maxImpulseNms: 0.0001, maxReactionNms: 0.01 },
  }));
  assert.throws(() => createPhysicsWorld({ fixedStepSeconds: 1 / 120, gravityMps2: [0, 0, 0], bodies, joints }),
    (error: unknown) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG' &&
      error.message === 'dynamic pair supports one joint between two dynamic spheres');
  const floor: PhysicsBodyConfig = { id: 'floor', kind: 'static', shape: { kind: 'box', halfExtentsM: [2, 0.1, 2] }, positionM: [0, -0.1, 0], restitution: 0 };
  const boxes: PhysicsBodyConfig[] = Array.from({ length: 8 }, (_, i) => ({
    id: `b${i}`, kind: 'dynamic', shape: { kind: 'box', halfExtentsM: [0.25, 0.25, 0.25] },
    positionM: [0, 0.25 + 0.5 * i, 0], velocityMps: [0, 0, 0], massKg: 1, restitution: 0,
  }));
  assert.throws(() => createPhysicsWorld({ fixedStepSeconds: 1 / 120, gravityMps2: [0, -9.81, 0], contactMode: 'persistent-box-v1', bodies: [floor, ...boxes] }),
    (error: unknown) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG' &&
      error.message === 'persistent-box-v1 admits at most four bodies');
  console.log(JSON.stringify({ metric: 'baseline-admission', hinge: 'REFUSED', eightBox: 'REFUSED',
    historicalStep77Candidate: 'NOT_RUN_ABSENT', physicalQualification: 'NO_GO' }));
});
