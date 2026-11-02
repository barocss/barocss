// Bundle this test with the same root/replay source aliases used by the Lab server.
// Run the emitted Node module with node --test. No installed-package fallback is intended.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabSession } from './session.mjs';

function retain(session) { return { state: session.state, recording: session.recording }; }

test('refused load and refused config retain accepted state and recording', () => {
  const session = createLabSession();
  try {
    session.step({ angularImpulseNms: [.01, -.02, .03] });
    const before = retain(session);
    assert.throws(() => session.step({ torqueNm: [NaN, 0, 0] }));
    assert.deepEqual(retain(session), before);
    assert(session.error);
    assert.throws(() => session.reset({ shape: 'box', halfExtentsM: [-1, .2, .3] }));
    assert.deepEqual(retain(session), before);
    session.step();
    assert.equal(session.error, null);
  } finally { session.dispose(); }
});

test('one-step impulses expire and configured torque is reissued', () => {
  const session = createLabSession({ torqueNm: [.01, 0, 0] });
  try {
    session.step({ angularImpulseNms: [0, .02, 0] });
    session.step();
    session.step({ torqueNm: [0, 0, 0] });
    const commands = session.recording.frames.map(frame => frame.commands.map(command => command.kind));
    assert.deepEqual(commands, [['angularImpulse', 'torque'], ['torque'], []]);
    const dt = session.options.fixedStepSeconds;
    const expected = session.baseline.bodies[0];
    assert.equal(expected.id, 'lab.body');
    const diagnostics = session.diagnostics;
    assert.equal(diagnostics.expectedMomentumWorldNms[0], diagnostics.initialMomentumWorldNms[0] + .01 * dt + .01 * dt);
    assert.equal(diagnostics.expectedMomentumWorldNms[1], diagnostics.initialMomentumWorldNms[1] + .02);
    assert.equal(diagnostics.torqueWorkIsApproximate, true);
    assert.equal(diagnostics.independentQualification, false);
  } finally { session.dispose(); }
});

test('actual recording restore supports real continuation and rejects tampering without mutation', () => {
  const session = createLabSession({ shape: 'capsule', torqueNm: [0, .01, 0] });
  try {
    session.step({ angularImpulseNms: [.01, 0, -.01] });
    session.step();
    const packet = session.save(), saved = retain(session), diagnostics = session.diagnostics;
    session.step();
    const continued = retain(session), continuedDiagnostics = session.diagnostics;
    session.restore(packet);
    assert.deepEqual(retain(session), saved);
    assert.deepEqual(session.diagnostics, diagnostics);
    session.step();
    assert.deepEqual(retain(session), continued);
    assert.deepEqual(session.diagnostics, continuedDiagnostics);
    const changed = structuredClone(packet);
    changed.recording.finalState.bodies[0].angularVelocityRadps[0] += 1;
    const before = retain(session);
    assert.throws(() => session.restore(changed));
    assert.deepEqual(retain(session), before);
    const otherConfig = structuredClone(packet);
    otherConfig.config.hz = 60;
    assert.throws(() => session.restore(otherConfig));
    assert.deepEqual(retain(session), before);
  } finally { session.dispose(); }
});

test('reset clears recording, adopts normalized config and keeps a bounded horizon', () => {
  const session = createLabSession({ maxSteps: 2 });
  try {
    session.step(); session.step();
    assert.equal(session.horizonReached, true);
    const before = retain(session);
    assert.throws(() => session.step(), /horizon/);
    assert.deepEqual(retain(session), before);
    session.reset({ shape: 'sphere', orientationXYZW: [0, 0, 0, 2] });
    assert.equal(session.horizon, 512);
    assert.equal(session.state.stepIndex, 0);
    assert.equal(session.recording.frames.length, 0);
    assert.deepEqual(session.config.orientationXYZW, [0, 0, 0, 1]);
    assert.equal(session.config.shape, 'sphere');
    assert.equal(session.diagnostics.impulseEnergyJ, 0);
  } finally { session.dispose(); }
  assert.throws(() => session.step(), /disposed/);
});
