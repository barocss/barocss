import assert from 'node:assert/strict';
import { controls as positionControls } from '../physics-rigid-position-reference/controls.mjs';

const fields = [
  'testedPatches',
  'compatiblePatches',
  'incompatiblePatches',
  'reusedPoints',
  'coldPoints',
];
const zeroStats = Object.fromEntries(fields.map(field => [field, 0]));

/** Read detached counters. Mutations affect only getter copies. */
function checkedStats(world, label) {
  const first = world.getWarmCacheStats();
  const second = world.getWarmCacheStats();
  assert.notStrictEqual(first, second, `${label}: getter must return a new copy`);
  assert.deepEqual(Object.keys(first).sort(), [...fields].sort(), `${label}: counter fields`);
  assert.deepEqual(second, first, `${label}: repeated getters must agree`);
  for (const field of fields) {
    assert.equal(Number.isInteger(first[field]), true, `${label}: ${field} must be an integer`);
    assert.ok(first[field] >= 0, `${label}: ${field} must be nonnegative`);
  }
  assert.equal(
    first.testedPatches,
    first.compatiblePatches + first.incompatiblePatches,
    `${label}: every tested patch has one complete-set decision`,
  );
  const saved = structuredClone(first);
  for (const field of fields) first[field] = -1;
  first.callerMutation = true;
  const third = world.getWarmCacheStats();
  assert.notStrictEqual(third, second, `${label}: subsequent getter must return a new copy`);
  assert.deepEqual(third, saved, `${label}: caller mutations must not change counters`);
  assert.deepEqual(second, saved, `${label}: getter copies must not share mutable fields`);
  return saved;
}

/** Reuse the original flow once. The wrapper never adds a world step. */
export async function controls(module, scene, reference) {
  const { createCandidateWorld, PhysicsError } = module;
  const worlds = [];
  const wrappedModule = {
    ...module,
    createCandidateWorld(config) {
      const world = createCandidateWorld(config);
      assert.equal(typeof world.getWarmCacheStats, 'function', 'private warm-cache getter');
      const initial = checkedStats(world, 'initial');
      assert.deepEqual(initial, zeroStats, 'initial warm-cache counters must be zero');
      const receipt = {
        worldIndex: worlds.length,
        bodyIds: world.getState().bodies.map(body => body.id),
        initial,
        events: [],
        disposalCalls: 0,
      };
      worlds.push(receipt);
      const originalStep = world.step;
      const originalDispose = world.dispose;
      let disposed = false;

      world.step = function (...args) {
        // Preserve the original typed disposal refusal if a caller steps later.
        if (disposed) return originalStep.apply(world, args);
        const before = checkedStats(world, 'before step');
        let state;
        try {
          state = originalStep.apply(world, args);
        } catch (error) {
          if (error instanceof PhysicsError) {
            const after = checkedStats(world, `refused ${error.code}`);
            assert.deepEqual(after, before, 'typed refusal must retain exact warm-cache counters');
            receipt.events.push({ kind: 'typed-refusal', code: error.code, before, after });
          }
          throw error;
        }
        const after = checkedStats(world, 'accepted step');
        receipt.events.push({ kind: 'accepted-step', stepIndex: state.stepIndex, before, after });
        return state;
      };

      world.dispose = function (...args) {
        const before = disposed ? null : checkedStats(world, 'before dispose');
        const result = originalDispose.apply(world, args);
        disposed = true;
        receipt.disposalCalls += 1;
        assert.throws(
          () => world.getWarmCacheStats(),
          error => error instanceof PhysicsError && error.code === 'DISPOSED',
          'warm-cache getter must retain the original typed disposal contract',
        );
        receipt.events.push({ kind: 'dispose', call: receipt.disposalCalls, before, getterCode: 'DISPOSED' });
        return result;
      };
      return world;
    },
  };

  const original = await positionControls(wrappedModule, scene, reference);
  assert.equal(worlds.length, 2, 'reuse the existing snapshot and two-box worlds only');
  for (const world of worlds) {
    assert.equal(world.disposalCalls, 2, 'reuse the original repeat-dispose flow');
  }
  assert.equal(worlds.flatMap(world => world.events).filter(event => event.kind === 'accepted-step').length, 1,
    'reuse the original two-box accepted step once');
  return {
    ...original,
    warmCacheControls: {
      initialAllZero: true,
      getterCopyMutationIsolation: true,
      nonnegativeIntegerCounters: true,
      testedEqualsCompatiblePlusIncompatible: true,
      typedRefusalCountersRetained: true,
      disposedGetterUsesOriginalPhysicsError: true,
      repeatDisposePreserved: true,
      interpretation: 'Complete-set cache decision counters are events, not public forces.',
      worlds,
    },
  };
}
