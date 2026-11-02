import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhysicsWorld, PhysicsError } from '@barocss/physics';
import { createPhysicsScene, createPhysicsReplaySession,
  restorePhysicsReplaySession } from '@barocss/physics/replay';
import { dt, profiles, ballisticConfig } from './fixtures.mjs';

const kind = process.env.P1A_PROOF_KIND;
assert.ok(['baseline', 'source', 'emitted', 'ordinary-source', 'ordinary-emitted'].includes(kind));
const baseline = kind === 'baseline';
const injected = !kind.startsWith('ordinary-');
const hookKey = Symbol.for('barocss.physics.p1a.output-log-fault');
const sentinel = new Error('P1A deterministic preparation fault');
function withFault(phase, cursor, attempt) {
  assert.equal(globalThis[hookKey], undefined);
  let calls = 0;
  globalThis[hookKey] = (actualPhase, actualCursor) => {
    if (actualPhase !== phase || actualCursor !== cursor) return;
    calls++;
    delete globalThis[hookKey];
    throw sentinel;
  };
  try { assert.throws(attempt, error => error === sentinel); }
  finally { delete globalThis[hookKey]; }
  assert.equal(calls, 1, 'one exact injection anchor must execute');
}
const report = value => console.log(JSON.stringify({ proofKind: kind, ...value }));
const refuses = (operation, code) => assert.throws(operation,
  error => error instanceof PhysicsError && error.code === code);

if (injected) {
  for (const profile of profiles) {
    test(`${profile.name}: output preparation and continuation`, () => {
      const world = createPhysicsWorld(profile.config());
      const control = createPhysicsWorld(profile.config());
      try {
        for (let i = 0; i < profile.warmSteps; i++) assert.deepEqual(world.step(dt), control.step(dt));
        const before = world.getState();
        if (profile.name === 'persistent-warm') {
          assert.ok(before.contacts.some(contact => contact.impulseNs > 0), 'warm impulses must be active');
          assert.ok(before.events.some(event => event.phase === 'stay'));
        }
        if (profile.name === 'sleeping-impulse-wake') {
          assert.equal(before.bodies.filter(body => body.sleeping).length, 2);
        }
        if (profile.name === 'dynamic-hinge-history') assert.ok(before.joints[0].angleRad > 0);
        withFault('world-output', before.stepIndex + 1, () => world.step(dt, profile.faultCommands));
        const after = world.getState();
        if (baseline) {
          assert.equal(after.stepIndex, before.stepIndex + 1, 'baseline must reproduce a committed refused step');
          assert.notDeepEqual(after, before);
        } else assert.deepEqual(after, before, 'failed output preparation must retain accepted snapshot');
        let mismatches = 0;
        for (let i = 0; i < 20; i++) {
          const commands = i === 0 ? profile.faultCommands : [];
          const next = world.step(dt, commands), expected = control.step(dt, commands);
          if (baseline) { if (!isDeepEqual(next, expected)) mismatches++; }
          else assert.deepEqual(next, expected, `continuation differs at valid step ${i + 1}`);
        }
        if (baseline) assert.equal(mismatches, 20);
        report({ case: profile.name, sourceFixture: profile.source,
          baselineBugReproduced: baseline, snapshotRetained: !baseline, continuationSteps: 20,
          continuationMatchesControl: !baseline, mismatchSteps: mismatches });
      } finally { world.dispose(); control.dispose(); }
    });
  }

  test('replay log preparation retains state, log and aggregate command budget', () => {
    const scene = createPhysicsScene(ballisticConfig(), { revision: 'p1aReplay', sourceRevision: null });
    const session = createPhysicsReplaySession(scene), control = createPhysicsReplaySession(scene);
    try {
      for (let i = 0; i < 12; i++) assert.deepEqual(session.step(), control.step());
      const before = session.saveSnapshot();
      const commands = [{ kind: 'impulse', bodyId: 'ball', impulseNs: [0, 0.01, 0] }];
      withFault('replay-log', before.finalState.stepIndex + 1, () => session.step(commands));
      const after = session.saveSnapshot();
      assert.deepEqual(after.frames, before.frames, 'failed log preparation must not append a frame');
      if (baseline) {
        assert.equal(after.finalState.stepIndex, before.finalState.stepIndex + 1);
        refuses(() => restorePhysicsReplaySession(after, scene), 'INVALID_SNAPSHOT');
      } else assert.deepEqual(after, before);
      for (let i = 0; i < 20; i++) {
        const next = session.step(i === 0 ? commands : []), expected = control.step(i === 0 ? commands : []);
        if (baseline) assert.equal(next.stepIndex, expected.stepIndex + 1);
        else assert.deepEqual(next, expected);
      }
      const saved = session.saveSnapshot();
      if (baseline) {
        assert.equal(saved.finalState.stepIndex, saved.frames.length + 1);
        refuses(() => restorePhysicsReplaySession(saved, scene), 'INVALID_SNAPSHOT');
      } else {
        assert.deepEqual(saved, control.saveSnapshot());
        const restored = restorePhysicsReplaySession(JSON.parse(JSON.stringify(saved)), scene);
        try {
          assert.deepEqual(restored.getState(), session.getState());
          assert.deepEqual(restored.step(), session.step());
        } finally { restored.dispose(); }
        verifyAggregateBudget();
      }
      report({ case: 'replay-log', baselineBugReproduced: baseline,
        physicalAndLogAligned: !baseline, restoreAndContinue: !baseline, aggregateBudgetRetained: !baseline });
    } finally { session.dispose(); control.dispose(); }
  });
}

// Ordinary modes use no provider transformations and no fault hooks.
if (!injected) {
  test('ordinary canonical root: analytic force, independent copies, refusal and disposal', () => {
    const world = createPhysicsWorld(ballisticConfig());
    try {
      let state;
      for (let step = 1; step <= 120; step++) {
        state = world.step(dt, [{ kind: 'force', bodyId: 'ball', forceN: [4, 0, 0] }]);
        const seconds = step * dt;
        near(state.bodies[0].velocityMps[0], 2 * seconds, 1e-11);
        near(state.bodies[0].velocityMps[1], -9.81 * seconds, 1e-11);
        near(state.bodies[0].positionM[0], dt * dt * step * (step + 1), 1e-11);
        near(state.bodies[0].positionM[1], 2 - 9.81 * dt * dt * step * (step + 1) / 2, 1e-11);
      }
      const retained = world.getState();
      state.bodies[0].positionM[0] = 999;
      state.bodies[0].orientation[0] = 1;
      state.bodies[0].shape.radiusM = 999;
      state.pairStats.eligiblePairs = 999;
      assert.deepEqual(world.getState(), retained);
      refuses(() => world.step(dt, [{ kind: 'impulse', bodyId: 'missing', impulseNs: [0, 1, 0] }]), 'INVALID_COMMAND');
      assert.deepEqual(world.getState(), retained);
      refuses(() => world.step(dt, [{ kind: 'impulse', bodyId: 'ball', impulseNs: [100000, 0, 0] }]), 'NUMERIC_LIMIT');
      assert.deepEqual(world.getState(), retained);
      world.dispose(); world.dispose();
      refuses(() => world.getState(), 'DISPOSED');
      refuses(() => world.step(dt), 'DISPOSED');
      report({ case: 'ordinary-root', analyticSemiImplicitLaw: true, copyIsolation: true,
        typedRefusalRetention: true, idempotentDispose: true });
    } finally { world.dispose(); }
  });

  test('ordinary canonical replay: restore and continuation', () => {
    const scene = createPhysicsScene(ballisticConfig(), { revision: 'p1aOrdinary', sourceRevision: null });
    const session = createPhysicsReplaySession(scene);
    let restored;
    try {
      for (let i = 0; i < 30; i++) session.step(i === 0
        ? [{ kind: 'impulse', bodyId: 'ball', impulseNs: [0, 0.25, 0] }] : []);
      const snapshot = session.saveSnapshot();
      const before = session.getState();
      refuses(() => session.step([{ kind: 'force', bodyId: 'missing', forceN: [0, 1, 0] }]), 'INVALID_COMMAND');
      assert.deepEqual(session.getState(), before);
      assert.deepEqual(session.saveSnapshot(), snapshot);
      restored = restorePhysicsReplaySession(JSON.parse(JSON.stringify(snapshot)), scene);
      for (let i = 0; i < 20; i++) assert.deepEqual(restored.step(), session.step());
      report({ case: 'ordinary-replay', restoreAndContinue: true, continuationSteps: 20 });
    } finally { session.dispose(); restored?.dispose(); }
  });
}

function near(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}; tolerance ${tolerance}`);
}
function isDeepEqual(actual, expected) {
  try { assert.deepEqual(actual, expected); return true; } catch { return false; }
}
function verifyAggregateBudget() {
  // 32 dynamic bodies x four distinct action kinds = 128; the per-frame cap is 64.
  // Use force+torque for each body: 64 commands x64 frames exactly fills 4096.
  const config = ballisticConfig();
  config.gravityMps2 = [0, 0, 0];
  config.bodies = Array.from({ length: 32 }, (_, i) => ({ ...ballisticConfig().bodies[0],
    id: `body:${i}`, positionM: [i, 0, 0] }));
  const scene = createPhysicsScene(config, { revision: 'p1aBudget', sourceRevision: null });
  const session = createPhysicsReplaySession(scene);
  const commands = config.bodies.flatMap(body => [
    { kind: 'force', bodyId: body.id, forceN: [0, 0, 0] },
    { kind: 'torque', bodyId: body.id, torqueNm: [0, 0, 0] }]);
  try {
    withFault('replay-log', 1, () => session.step(commands));
    for (let i = 0; i < 64; i++) session.step(commands);
    const before = session.saveSnapshot();
    assert.equal(before.frames.length, 64);
    refuses(() => session.step([{ kind: 'force', bodyId: 'body:0', forceN: [0, 0, 0] }]), 'WORLD_LIMIT');
    assert.deepEqual(session.saveSnapshot(), before);
    assert.equal(session.step().stepIndex, 65, 'aggregate limit counts commands, not empty frames');
  } finally { session.dispose(); }
}
