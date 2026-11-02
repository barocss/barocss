import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import type { Joint } from '@barocss/physics';
import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';

test('historical public hinge and eight-box limitations stay explicit', () => {
  const parts = ['pairA0', 'pairB0', 'pairA1', 'pairB1'].map((id, i) => dynamicPart(id,
    { kind: 'sphere', radiusM: 0.1 }, { positionM: [i % 2 ? 0.1 : -0.1, 0, i < 2 ? 0 : 1] },
    1, { friction: { static: 1, dynamic: 0.7 } }));
  const joints: Joint[] = [0, 1].map(i => ({
    id: `hinge${i}`, kind: 'hinge', bodyAId: parts[2 * i].body.id, bodyBId: parts[2 * i + 1].body.id,
    anchorALocalM: [0.1, 0, 0], anchorBLocalM: [-0.1, 0, 0], axisWorld: [0, 0, 1],
    limitRad: [-0.8, 0.8], motor: { targetSpeedRadps: 0.5, maxImpulseNms: 0.0001, maxReactionNms: 0.01 },
  }));
  assert.throws(() => createPhysicsWorld(makeModel({ gravityMps2: [0, 0, 0], parts, joints }),
    { profile: 'rigid-discrete-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' }),
    (error: unknown) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG' &&
      error.message === 'dynamic pair supports one joint between two dynamic spheres');
  const floor = staticPart('floor', { kind: 'box', halfExtentsM: [2, 0.1, 2] }, { positionM: [0, -0.1, 0] });
  const boxes = Array.from({ length: 8 }, (_, i) => dynamicPart(`b${i}`,
    { kind: 'box', halfExtentsM: [0.25, 0.25, 0.25] }, { positionM: [0, 0.25 + 0.5 * i, 0] }));
  assert.throws(() => createPhysicsWorld(makeModel({ parts: [floor, ...boxes] }),
    { profile: 'rigid-persistent-box-v1', fixedStepSeconds: 1 / 120, broadPhase: 'direct' }),
    (error: unknown) => error instanceof PhysicsError && error.code === 'INVALID_CONFIG' &&
      error.message === 'bodies exceeds the profile bound');
  console.log(JSON.stringify({ metric: 'baseline-admission', hinge: 'REFUSED', eightBox: 'REFUSED',
    historicalStep77Candidate: 'NOT_RUN_ABSENT', physicalQualification: 'NO_GO' }));
});
