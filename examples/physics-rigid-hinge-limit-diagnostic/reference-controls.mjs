import assert from 'node:assert/strict';

// Importing this file does not run an observer or projection.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const referenceGates = freeze({
  scalarAngleRad: 1e-12,
  scalarDistanceM: 1e-12,
  scalarMomentum: 1e-12,
  scalarEnergyJ: 1e-12,
  decimalAlgebraDifference: '1e-25',
  originalAngleGateRad: 1e-9,
  rawQuaternionUnitGate: 1e-9,
});

export const referenceErrors = freeze({
  finite: { code: 'REFERENCE_INPUT', message: 'Reference input must contain finite binary numbers' },
  vector3: { code: 'REFERENCE_INPUT', message: 'Reference vector must contain exactly 3 numbers' },
  vector4: { code: 'REFERENCE_INPUT', message: 'Reference vector must contain exactly 4 numbers' },
  ids: { code: 'REFERENCE_INPUT', message: 'Reference pair IDs are invalid' },
  quaternion: { code: 'REFERENCE_INPUT', message: 'Reference quaternion has zero norm' },
  material: { code: 'REFERENCE_INPUT', message: 'Reference original sphere material differs' },
  motion: { code: 'REFERENCE_INPUT', message: 'Reference original sphere motion differs' },
  gravity: { code: 'REFERENCE_INPUT', message: 'Reference original gravity differs' },
  bodies: { code: 'REFERENCE_INPUT', message: 'Reference state requires exactly two bodies' },
  joints: { code: 'REFERENCE_INPUT', message: 'Reference state requires exactly one joint' },
});

export const originalPairConfig = freeze({
  bodies: [
    { id: 'pairA0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [-.1, 0, 0],
      velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
    { id: 'pairB0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [.1, 0, 0],
      velocityMps: [0, 0, 0], massKg: 1, restitution: 0, friction: { static: 1, dynamic: .7 } },
  ],
  joints: [{ id: 'hinge0', kind: 'hinge', aId: 'pairA0', bId: 'pairB0',
    anchorALocalM: [.1, 0, 0], anchorBLocalM: [-.1, 0, 0], axisWorld: [0, 0, 1],
    limitRad: [-.8, .8], motor: { targetSpeedRadps: .5, maxImpulseNms: .0001, maxReactionNms: .01 } }],
});

export const restingReferenceInput = freeze({
  config: structuredClone(originalPairConfig),
  dt: .008333333333333333,
  state: {
    bodies: [
      { id: 'pairA0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [-.1, 0, 0],
        velocityMps: [0, 0, 0], orientation: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0] },
      { id: 'pairB0', kind: 'dynamic', shape: { kind: 'sphere', radiusM: .1 }, positionM: [.1, 0, 0],
        velocityMps: [0, 0, 0], orientation: [0, 0, 0, 1], angularVelocityRadps: [0, 0, 0] },
    ],
    joints: [{ id: 'hinge0', kind: 'hinge', aId: 'pairA0', bId: 'pairB0', angleRad: 0 }],
  },
});

function changed(edit) {
  const input = structuredClone(restingReferenceInput);
  edit(input);
  return input;
}

const atLimit = (sign, reported = sign * .8) => changed(input => {
  input.state.bodies[0].positionM = [-.09210609940028851, 0, 0];
  input.state.bodies[1].positionM = [.09210609940028851, 0, 0];
  input.state.bodies[0].orientation = [0, 0, -sign * .19866933079506122, .9800665778412416];
  input.state.bodies[1].orientation = [0, 0, sign * .19866933079506122, .9800665778412416];
  input.state.joints[0].angleRad = reported;
});

const overLimit = sign => changed(input => {
  // Frozen first-order sine/cosine perturbation for angle +/-0.80000001.
  // Its omitted second-order term is below 1e-16, within the named 1e-12 control gate.
  input.state.bodies[0].positionM = [-.09210609920557934, 0, 0];
  input.state.bodies[1].positionM = [.09210609920557934, 0, 0];
  input.state.bodies[0].orientation = [0, 0, -sign * .19866933324522766, .9800665773445683];
  input.state.bodies[1].orientation = [0, 0, sign * .19866933324522766, .9800665773445683];
  input.state.joints[0].angleRad = sign * .8;
});

const restExpected = { relativeAngleRad: 0, anchorGapM: 0, axisDeviationRad: 0,
  limitExcessRad: 0, reportedAngleDifferenceRad: 0, linearMomentumKgMps: 0,
  angularMomentumKgM2ps: 0, energyJ: 0, comDriftM: 0,
  limitGatePassed: true, reportGatePassed: true };

export const literalReferenceControls = freeze([
  { name: 'resting-pair', input: structuredClone(restingReferenceInput), expected: { ...restExpected } },
  { name: 'exact-upper-limit', input: atLimit(1), expected: { relativeAngleRad: .8, anchorGapM: 0,
    axisDeviationRad: 0, limitExcessRad: 0, reportedAngleDifferenceRad: 0,
    limitGatePassed: true, reportGatePassed: true } },
  { name: 'exact-lower-limit', input: atLimit(-1), expected: { relativeAngleRad: -.8, anchorGapM: 0,
    axisDeviationRad: 0, limitExcessRad: 0, reportedAngleDifferenceRad: 0,
    limitGatePassed: true, reportGatePassed: true } },
  { name: 'slight-upper-excess', input: overLimit(1), expected: { relativeAngleRad: .80000001,
    anchorGapM: 0, axisDeviationRad: 0, limitExcessRad: 1e-8,
    reportedAngleDifferenceRad: 1e-8, limitGatePassed: false, reportGatePassed: false } },
  { name: 'slight-lower-excess', input: overLimit(-1), expected: { relativeAngleRad: -.80000001,
    anchorGapM: 0, axisDeviationRad: 0, limitExcessRad: 1e-8,
    reportedAngleDifferenceRad: -1e-8, limitGatePassed: false, reportGatePassed: false } },
  { name: 'sign-equivalent-quaternion', input: (() => {
    const input = atLimit(1); input.state.bodies[0].orientation = input.state.bodies[0].orientation.map(x => -x); return input;
  })(), expected: { relativeAngleRad: .8, anchorGapM: 0, axisDeviationRad: 0,
    limitExcessRad: 0, reportedAngleDifferenceRad: 0, limitGatePassed: true, reportGatePassed: true } },
  { name: 'Z1-translation', input: changed(input => {
    for (const container of [input.state, input.config]) {
      for (const body of container.bodies) { body.id = body.id.replace('0', '1'); body.positionM[2] = 1; }
      container.joints[0].id = 'hinge1'; container.joints[0].aId = 'pairA1'; container.joints[0].bId = 'pairB1';
    }
  }), expected: { ...restExpected } },
  { name: 'canonical-public-pair1-Z0', input: changed(input => {
    for (const container of [input.state, input.config]) {
      for (const body of container.bodies) body.id = body.id.replace('0', '1');
      container.joints[0].id = 'hinge1'; container.joints[0].aId = 'pairA1'; container.joints[0].bId = 'pairB1';
    }
  }), expected: { ...restExpected } },
  { name: 'changed-report-only', input: changed(input => { input.state.joints[0].angleRad = .2; }),
    expected: { relativeAngleRad: 0, anchorGapM: 0, limitExcessRad: 0,
      reportedAngleDifferenceRad: -.2, limitGatePassed: true, reportGatePassed: false } },
  { name: 'anchor-mismatch', input: changed(input => { input.state.bodies[0].positionM[0] = -.09; }),
    expected: { anchorGapM: .01, comDriftM: .005, relativeAngleRad: 0 } },
  { name: 'known-spin-and-orbit', input: changed(input => {
    input.state.bodies[0].velocityMps = [0, -1, 0]; input.state.bodies[1].velocityMps = [0, 1, 0];
    input.state.bodies[0].angularVelocityRadps = [0, 0, 1]; input.state.bodies[1].angularVelocityRadps = [0, 0, 1];
  }), expected: { linearMomentumKgMps: 0, angularMomentumKgM2ps: .208, energyJ: 1.004 } },
  { name: 'null-position', input: changed(input => { input.state.bodies[0].positionM[0] = null; }), error: referenceErrors.finite },
  { name: 'nonfinite-position-codec', input: changed(input => { input.state.bodies[0].positionM[0] = Infinity; }), error: referenceErrors.finite },
  { name: 'null-report', input: changed(input => { input.state.joints[0].angleRad = null; }), error: referenceErrors.finite },
  { name: 'wrong-body-ID', input: changed(input => { input.state.bodies[0].id = 'missing'; }), error: referenceErrors.ids },
  { name: 'wrong-joint-ID', input: changed(input => { input.state.joints[0].id = 'missing'; }), error: referenceErrors.ids },
  { name: 'short-position-vector', input: changed(input => { input.state.bodies[0].positionM.pop(); }), error: referenceErrors.vector3 },
  { name: 'short-quaternion-vector', input: changed(input => { input.state.bodies[0].orientation.pop(); }), error: referenceErrors.vector4 },
  { name: 'missing-body', input: changed(input => { input.state.bodies.pop(); }), error: referenceErrors.bodies },
  { name: 'missing-joint', input: changed(input => { input.state.joints.pop(); }), error: referenceErrors.joints },
  { name: 'zero-quaternion', input: changed(input => { input.state.bodies[0].orientation = [0, 0, 0, 0]; }), error: referenceErrors.quaternion },
  { name: 'changed-original-material', input: changed(input => { input.config.bodies[0].friction.dynamic = .6; }), error: referenceErrors.material },
  { name: 'changed-original-initial-motion', input: changed(input => { input.config.bodies[0].velocityMps[0] = 1; }), error: referenceErrors.motion },
  { name: 'changed-original-gravity', input: changed(input => { input.config.gravityMps2 = [0, -9.81, 0]; }), error: referenceErrors.gravity },
]);

function finiteNumber(value, label) {
  assert.ok(typeof value === 'number' && Number.isFinite(value), `${label}: invalid numeric output`);
  return value;
}

export async function runReferenceControls(ask) {
  const receipts = [];
  for (const control of literalReferenceControls) {
    const input = structuredClone(control.input), before = structuredClone(input);
    const result = await ask(input);
    assert.deepEqual(input, before, `${control.name}: input copy`);
    if (control.error) {
      assert.equal(result.ok, false, control.name);
      assert.equal(result.code, control.error.code, control.name);
      assert.equal(result.message, control.error.message, control.name);
    } else {
      assert.equal(result.ok, true, control.name);
      assert.equal(result.resolved, true, control.name);
      assert.ok(finiteNumber(result.precisionMaxDifference, control.name) <= 1e-25, control.name);
      assert.ok(finiteNumber(result.scalarAngleRepeatMaxDifferenceRad, control.name) <= 1e-12, control.name);
      for (const mode of ['raw', 'normalized']) {
        for (const [key, expected] of Object.entries(control.expected)) {
          if (typeof expected === 'boolean') assert.equal(result[mode][key], expected, `${control.name}.${mode}.${key}`);
          else assert.ok(Math.abs(finiteNumber(result[mode][key], `${control.name}.${mode}.${key}`)-expected) <= 1e-12,
            `${control.name}.${mode}.${key}: ${result[mode][key]} versus ${expected}`);
        }
      }
    }
    receipts.push({ name: control.name, result });
  }
  const original = await ask(structuredClone(restingReferenceInput));
  const changedReport = await ask(changed(input => { input.state.joints[0].angleRad = .2; }));
  for (const mode of ['raw', 'normalized']) {
    for (const key of ['anchorAM', 'anchorBM', 'anchorGapM', 'relativeAngleRad', 'energyJ',
      'linearMomentumVectorKgMps', 'angularMomentumVectorKgM2ps']) {
      assert.deepEqual(changedReport[mode][key], original[mode][key], `report-only preserves ${mode}.${key}`);
    }
  }
  receipts.push({ name: 'changed-report-preserves-pose-geometry-momentum-energy', ok: true });
  return receipts;
}

export const controls = runReferenceControls;
