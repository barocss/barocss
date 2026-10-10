import assert from 'node:assert/strict';
import { controls as cacheControls } from '../physics-rigid-cache-reference/controls.mjs';
import { fixture } from '../physics-rigid-contact-reference/fixtures.mjs';

const fields = [
  'assemblyTests', 'patches', 'points', 'globalSweeps', 'pointUpdates',
  'positionSweeps', 'positionTests', 'positionHits', 'facePatches', 'edgePatches',
];
const zeroStats = Object.fromEntries(fields.map(field => [field, 0]));
const restitutionMessage = 'private global contact reference requires zero restitution';

function checkedStats(world, label) {
  const first = world.getGlobalContactStats();
  const second = world.getGlobalContactStats();
  assert.notStrictEqual(first, second, `${label}: getter must return a new copy`);
  assert.deepEqual(Object.keys(first).sort(), [...fields].sort(), `${label}: global counter fields`);
  assert.deepEqual(second, first, `${label}: repeated getters must agree`);
  for (const field of fields) {
    assert.equal(Number.isInteger(first[field]), true, `${label}: ${field} must be an integer`);
    assert.ok(first[field] >= 0, `${label}: ${field} must be nonnegative`);
  }
  const saved = structuredClone(first);
  for (const field of fields) first[field] = -1;
  first.callerMutation = true;
  const third = world.getGlobalContactStats();
  assert.notStrictEqual(third, second, `${label}: subsequent getter must return a new copy`);
  assert.deepEqual(third, saved, `${label}: caller mutation must not change global counters`);
  assert.deepEqual(second, saved, `${label}: getter copies must remain independent`);
  return saved;
}

function checkAcceptedWork(stats, state, warm) {
  assert.equal(stats.globalSweeps, 64, 'accepted step uses 64 global sweeps');
  assert.equal(stats.pointUpdates, 64 * stats.points, 'each assembled point gets one update per sweep');
  assert.equal(stats.positionSweeps, 8, 'accepted step uses eight position sweeps');
  assert.equal(stats.positionTests, 8 * stats.assemblyTests, 'each assembly pair is tested in every position sweep');
  assert.ok(stats.patches <= stats.assemblyTests, 'patches cannot exceed assembly tests');
  assert.equal(stats.patches,stats.facePatches+stats.edgePatches,'face/edge family accounting');
  assert.ok(warm.coldPoints>=stats.edgePatches,'each edge is cold');
  assert.ok(stats.points<=4*stats.facePatches+stats.edgePatches,'bounded feature points');
  assert.ok(stats.points >= stats.patches && stats.points <= 4 * stats.patches, 'each bounded patch contains one to four points');
  assert.ok(stats.positionHits <= stats.positionTests, 'position hits cannot exceed tests');
  assert.equal(state.pairStats.eligiblePairs, stats.assemblyTests, 'public eligible pairs count assembly tests');
  assert.equal(state.pairStats.candidatePairs, stats.assemblyTests, 'public candidate pairs count actual assembly detects');
  assert.equal(state.pairStats.aabbTests, 0, 'private global profile has no AABB pass');
  assert.equal(warm.testedPatches, stats.patches, 'whole-set warm gate runs once per assembled patch');
  assert.equal(warm.reusedPoints + warm.coldPoints, stats.points, 'every assembled point is reused or cold');
}

/** Reuse the cache/position controls once; add no successful world or step. */
export async function controls(module, scene, reference) {
  const { createCandidateWorld, PhysicsError } = module;
  const nonzeroRestitution = fixture(scene);
  nonzeroRestitution.bodies[0].restitution = .5;
  assert.throws(
    () => createCandidateWorld(nonzeroRestitution),
    error => error instanceof PhysicsError && error.code === 'INVALID_CONFIG' && error.message === restitutionMessage,
    'nonzero restitution must use the frozen typed refusal and exact message',
  );

  const worlds = [];
  const wrappedModule = {
    ...module,
    createCandidateWorld(config) {
      const world = createCandidateWorld(config);
      assert.equal(typeof world.getGlobalContactStats, 'function', 'private global counter getter');
      const initial = checkedStats(world, 'initial');
      assert.deepEqual(initial, zeroStats, 'initial global counters must be zero');
      const receipt = {
        worldIndex: worlds.length, bodyIds: world.getState().bodies.map(body => body.id),
        initial, events: [], disposalCalls: 0,
      };
      worlds.push(receipt);
      const originalStep = world.step;
      const originalDispose = world.dispose;
      let disposed = false;

      world.step = function (...args) {
        if (disposed) return originalStep.apply(world, args);
        const before = checkedStats(world, 'before step');
        let state;
        try {
          state = originalStep.apply(world, args);
        } catch (error) {
          if (error instanceof PhysicsError) {
            const after = checkedStats(world, `refused ${error.code}`);
            assert.deepEqual(after, before, 'typed refusal must retain exact global counters');
            receipt.events.push({ kind: 'typed-refusal', code: error.code, before, after });
          }
          throw error;
        }
        const after = checkedStats(world, 'accepted step');
        const warm = world.getWarmCacheStats();
        checkAcceptedWork(after, state, warm);
        receipt.events.push({ kind: 'accepted-step', stepIndex: state.stepIndex, before, after,
          warm: structuredClone(warm), pairStats: structuredClone(state.pairStats) });
        return state;
      };

      world.dispose = function (...args) {
        const before = disposed ? null : checkedStats(world, 'before dispose');
        const result = originalDispose.apply(world, args);
        disposed = true;
        receipt.disposalCalls += 1;
        assert.throws(
          () => world.getGlobalContactStats(),
          error => error instanceof PhysicsError && error.code === 'DISPOSED',
          'global getter must retain the original typed disposal contract',
        );
        receipt.events.push({ kind: 'dispose', call: receipt.disposalCalls, before, getterCode: 'DISPOSED' });
        return result;
      };
      return world;
    },
  };

  const original = await cacheControls(wrappedModule, scene, reference);
  assert.equal(worlds.length, 2, 'reuse the original snapshot and two-box worlds');
  for (const world of worlds) assert.equal(world.disposalCalls, 2, 'reuse original repeat disposal');
  const events = worlds.flatMap(world => world.events);
  assert.equal(events.filter(event => event.kind === 'accepted-step').length, 1, 'reuse the original accepted step once');
  assert.deepEqual(worlds[0].events.filter(event => event.kind === 'typed-refusal').map(event => event.code), ['INVALID_STEP']);
  assert.deepEqual(worlds[1].events.filter(event => event.kind === 'typed-refusal').map(event => event.code),
    ['INVALID_STEP', 'INVALID_COMMAND', 'NUMERIC_LIMIT']);
  return {
    ...original,
    globalContactControls: {
      restitutionRefused: { code: 'INVALID_CONFIG', message: restitutionMessage, requested: .5 },
      initialAllZero: true, getterCopyMutationIsolation: true, nonnegativeIntegerCounters: true,
      acceptedWorkIdentities: true, warmPointAccounting: true, typedRefusalCountersRetained: true,
      disposedGetterUsesOriginalPhysicsError: true, repeatDisposePreserved: true,
      interpretation: 'Private counters record assembly and solver work; they are not calibrated force data.',
      worlds,
    },
  };
}
