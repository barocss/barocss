/** Fixed adoption recipes. Import creates no World and runs no test. */
import { makeP3Fixture } from './fixture.mjs';
import { dynamicPart, makeModel } from '../physics-model-input/model.mjs';
import { comparePublicReplayStep } from './compare.mjs';
import { negativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
function need(value, message) { if (!value) throw Error('P3 adoption: ' + message); }
export async function runAdoptionGraph({ graph, provider, expectedRows, sourceComparisons, charge, record }) {
  need(typeof provider.createPhysicsWorld === 'function' && typeof provider.PhysicsError === 'function', 'actual root/error constructor required');
  const live = new Set(); let latest = null, primaryFailure = null;
  const construct = fixture => { charge('constructors'); const world = provider.createPhysicsWorld(fixture.model, fixture.options); live.add(world); return world; };
  const close = world => { charge('cleanupAttempts'); world.dispose(); live.delete(world); charge('cleanupCompleted'); };
  try {
    const fixture = makeP3Fixture(), world = construct(fixture);
    charge('getters'); let before = world.getState();
    for (let step = 1; step <= 2; step++) {
      latest = { graph, attemptedStepIndex: step, before, after: null, negativeZeroPaths: negativeZeroPaths(before) };
      charge('attempts'); const after = world.step([]); charge('accepted');
      const comparison = comparePublicReplayStep({ bankRow: expectedRows.get(step), model: fixture.model, options: fixture.options,
        before, after, variant: 'ORIGINAL', qualifiedSource: sourceComparisons.get(step) });
      latest = { graph, before, after, comparison, negativeZeroPaths: negativeZeroPaths({ before, after }) };
      need(comparison.qualified && comparison.certificateReuse.authorized, 'current public S' + step + ' did not qualify');
      charge('qualified'); await record({ graph, name: 'current-public-S' + step, ...latest }); before = after;
    }
    close(world);
    for (let body = 0; body < 5; body++) {
      const negative = makeP3Fixture(), name = body < 4 ? 'scaled-raw-quaternion-body' + body : 'negative-zero-raw-quaternion-body0';
      if (body < 4) negative.model.bodies[body].initial.orientationXYZW = [0, 0, 0, .9999999];
      else negative.model.bodies[0].initial.orientationXYZW[0] = -0;
      let unexpected = null, error = null;
      charge('constructors');
      try { unexpected = provider.createPhysicsWorld(negative.model, negative.options); live.add(unexpected); }
      catch (failure) { charge('constructorRefusals'); need(failure instanceof provider.PhysicsError, 'negative constructor used unknown error'); error = failure; }
      latest = { graph, name, input: negative, error: error && { code: error.code, message: error.message, details: error.details }, negativeZeroPaths: negativeZeroPaths(negative) };
      need(!unexpected && error?.code === 'INVALID_CONFIG' && error.message === 'dynamic pair supports one joint between two dynamic spheres', name + ' changed admission boundary');
      await record(latest);
    }
    const free = { model: makeModel({ revision: 'p3-adoption-free-quaternion', gravityMps2: [0, 0, 0], parts: [
      dynamicPart('free-sphere', { kind: 'sphere', radiusM: .1 }, { positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, .9999999] }),
    ] }), options: fixture.options };
    const ordinary = construct(free); charge('attempts'); const after = ordinary.step([]); charge('accepted');
    need(after.stepIndex === 1 && after.bodies.length === 1, 'existing normalized free sphere failed');
    await record({ graph, name: 'existing-free-sphere-scaled-quaternion', after, negativeZeroPaths: negativeZeroPaths(after), proofBoundary: 'acceptance and one returned step; no accuracy claim' });
    close(ordinary);
    return { graph, status: 'PASS', constructors: 7, acceptedSteps: 3, newProfileQualifiedSteps: 2, negativeConstructors: 5, phasesObserved: false };
  } catch (error) { primaryFailure = error; error.adoptionEvidence = latest; throw error; }
  finally {
    const failures = [];
    for (const world of live) try { close(world); } catch (error) { failures.push({ name: error.name, message: error.message }); }
    if (failures.length) {
      if (primaryFailure) primaryFailure.cleanupFailures = failures;
      else { const error = Error('adoption cleanup failed'); error.cleanupFailures = failures; throw error; }
    }
  }
}
