import assert from 'node:assert/strict';

export const physicsProbeNames = ['probe', 'controls-probe', 'events-queries-probe',
  'rotation-probe', 'oriented-colliders-probe', 'friction-stack-probe', 'joints-probe',
  'ccd-probe', 'broadphase-probe', 'replay-probe'];

const near = (value, expected, tolerance) => assert.ok(Math.abs(value - expected) <= tolerance,
  `${value} differs from ${expected} by more than ${tolerance}`);

export function inspectProbe(name, output) {
  assert.ok(output && typeof output === 'object');
  if (name === 'probe') {
    assert.equal(output.firstContactStep, 62);
    near(output.restHeightM, 0.7, 0.001);
    near(output.collisionImpulseNs, 2, 1e-9);
  } else if (name === 'friction-stack-probe') {
    near(output.zeroFrictionSpeedX, 1, 1e-12);
    near(output.frictionSpeedX, 0.7142857142857143, 1e-12);
    near(output.stackY[0], 0.25, 0.001);
    near(output.stackY[1], 0.75, 0.001);
    assert.ok(output.maxPenetrationM < 0.002);
  } else if (name === 'joints-probe') {
    near(output.fixedY, 0, 1e-6);
    near(output.hingeAngleRad, 0.5, 1e-9);
    assert.equal(output.hingeStopStep, 31);
  } else if (name === 'ccd-probe') {
    near(output.toiFraction, 0.282, 1e-12);
    near(output.ccdY, 0.06, 1e-6);
    assert.ok(output.discreteY < -2);
  } else if (name === 'broadphase-probe') {
    assert.equal(output.direct.candidatePairs, 29760);
    assert.equal(output.aabb.candidatePairs, 960);
    assert.equal(output.aabb.aabbTests, 29760);
    assert.equal(output.contactStatesMatch, true);
    assert.ok(output.direct.wallMs < 1000 && output.aabb.wallMs < 1000);
  } else if (name === 'replay-probe') {
    assert.equal(output.replayedSteps, 150);
    assert.ok(output.contactSteps > 0);
    near(output.jointReactionY, 0.08175, 1e-12);
    assert.equal(output.staleAndDamagedRefused, true);
  } else if (name === 'cad-proxy-probe') {
    assert.equal(output.result, 'ok');
    assert.equal(output.contactStep, 21);
    assert.equal(output.staleSourceRefused, true);
  } else if (output.result !== undefined) assert.equal(output.result, 'ok');
}
