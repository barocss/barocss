import assert from 'node:assert/strict';
import { fixture } from './fixtures.mjs';
export function controls(module, scene) {
  const { createCandidateWorld, createOriginalWorld, PhysicsError } = module;
  const config = fixture(scene), untouched = structuredClone(config);
  assert.throws(() => createOriginalWorld(config), e => e instanceof PhysicsError && e.code === 'INVALID_CONFIG');
  const world = createCandidateWorld(config);
  const saved = world.getState();
  config.bodies[0].positionM[0] += 1;
  assert.deepEqual(world.getState(), saved, 'constructor must copy caller data');
  const copy = world.getState(); copy.bodies[0].positionM[0] += 1;
  assert.deepEqual(world.getState(), saved, 'snapshot must copy internal data');
  assert.throws(() => world.step(1 / 100), e => e instanceof PhysicsError && e.code === 'INVALID_STEP');
  assert.deepEqual(world.getState(), saved, 'bad time must retain accepted state');
  const tooMany = fixture(scene); tooMany.bodies.push({ ...structuredClone(tooMany.bodies[0]), id: 'b8', positionM: [1.5, 1, 0] });
  assert.throws(() => createCandidateWorld(tooMany), e => e instanceof PhysicsError && e.code === 'INVALID_CONFIG');
  world.dispose(); world.dispose();
  assert.throws(() => world.getState(), e => e instanceof PhysicsError && e.code === 'DISPOSED');
  return { scene, originalRefusal: true, candidateNineBodies: true, inputCopy: true, snapshotCopy: true, badTimeRetained: true, tenBodyRefused: true, doubleDisposed: true, untouchedFixture: untouched };
}
