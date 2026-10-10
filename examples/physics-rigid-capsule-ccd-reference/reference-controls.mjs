import assert from 'node:assert/strict';

// Literal inputs and gates are source data. Importing this file runs no trial.
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

export const referenceGates = freeze({
  decimalPrecisionDifference: '1e-25',
  distanceM: 1e-12,
  timeSeconds: 1e-12,
  fraction: 1e-12,
  centerM: 1e-12,
  witnessM: 1e-12,
  membershipM: 1e-12,
  normal: 1e-12,
  signedGapM: 1e-12,
  closingSpeedMps: 1e-12,
  fixedOrientation: 'exact',
  staticBox: 'exact',
});

export const referenceErrorLiterals = freeze({
  initialOverlap: { code: 'INITIAL_OVERLAP', message: 'Initial capsule overlaps a box' },
  profile: { code: 'INVALID_CONFIG', message: 'Private capsule face profile is unsupported' },
  movement: { code: 'INVALID_QUERY', message: 'Private capsule face movement is unsupported' },
  numeric: { code: 'NUMERIC_LIMIT', message: 'Private capsule face result is invalid' },
  referenceFinite: { code: 'REF_INPUT', message: 'Reference input must contain finite binary numbers' },
  referenceTime: { code: 'REF_INPUT', message: 'Reference stepSeconds must be positive' },
  referenceQuaternion: { code: 'REF_INPUT', message: 'Reference quaternion has zero norm' },
  referenceProfile: { code: 'REF_PROFILE', message: 'Reference capsule dimensions are unsupported' },
  referenceMovement: { code: 'REF_MOVEMENT', message: 'Reference face movement is unsupported' },
  referenceFootprint: { code: 'REF_PROFILE', message: 'Reference face footprint is unsupported' },
  referenceAngular: { code: 'REF_PROFILE', message: 'Reference angular motion is unsupported' },
  referenceMovingBox: { code: 'REF_PROFILE', message: 'Reference moving box is unsupported' },
  referenceHit: { code: 'REF_INPUT', message: 'Reference hit must be an object or null' },
  referenceResult: { code: 'REF_INPUT', message: 'Reference result must be an object' },
  referenceNumeric: { code: 'REF_NUMERIC', message: 'Reference result is outside finite binary range' },
});

export const originalReferenceInput = freeze({
  capsule: { radiusM: 0.1, halfLengthM: 0.2 },
  box: { id: 'floor', centerM: [0, 0, 0], halfExtentsM: [0.001, 1, 1], orientationXYZW: [0, 0, 0, 1] },
  centerM: [-0.4, 0, 0], velocityMps: [100, 0, 0],
  stepSeconds: 0.008333333333333333,
  evaluateCandidate: false,
});

export const yawReferenceInput = freeze({
  capsule: { radiusM: 0.1, halfLengthM: 0.2 },
  box: { id: 'floor', centerM: [0, 0, 0], halfExtentsM: [0.001, 1, 1],
    orientationXYZW: [0, 0.09983341664682815, 0, 0.9950041652780257] },
  centerM: [-0.39202663113649666, 0, 0.0794677323180245],
  velocityMps: [98.00665778412416, 0, -19.866933079506122],
  stepSeconds: 0.008333333333333333,
  evaluateCandidate: false,
});

const request = change => ({ ...structuredClone(originalReferenceInput), ...change });
export const literalReferenceControls = freeze([
  { name: 'original-head-on', input: structuredClone(originalReferenceInput),
    expected: { status: 'hit', distanceM: 0.399, signedGapM: 0.299,
      timeSeconds: 0.00299, fraction: 0.3588, remainingSeconds: 0.005343333333333333,
      centerHit: [-0.101, 0, 0], centerFinal: [-0.101, 0, 0], velocityFinal: [0, 0, 0],
      normal: [-1, 0, 0], ambiguity: 'flat-interval' } },
  { name: 'yaw-0.2-head-on', input: structuredClone(yawReferenceInput),
    expected: { status: 'hit', distanceM: 0.399, signedGapM: 0.299,
      timeSeconds: 0.00299, fraction: 0.3588, remainingSeconds: 0.005343333333333333,
      normal: [-0.9800665778412416, 0, 0.19866933079506122], ambiguity: 'flat-interval' } },
  { name: 'resting-with-clearance', input: request({ velocityMps: [0, 0, 0] }),
    expected: { status: 'clear', distanceM: 0.399, signedGapM: 0.299,
      centerFinal: [-0.4, 0, 0], velocityFinal: [0, 0, 0], ambiguity: 'flat-interval' } },
  { name: 'initial-touch', input: request({ centerM: [-0.101, 0, 0] }),
    expected: { status: 'hit', distanceM: 0.1, signedGapM: 0,
      timeSeconds: 0, fraction: 0, remainingSeconds: 0.008333333333333333,
      centerFinal: [-0.101, 0, 0], velocityFinal: [0, 0, 0], ambiguity: 'flat-interval' } },
  { name: 'resting-at-touch', input: request({ centerM: [-0.101, 0, 0], velocityMps: [0, 0, 0] }),
    expected: { status: 'hit', timeSeconds: 0, fraction: 0,
      centerFinal: [-0.101, 0, 0], velocityFinal: [0, 0, 0], ambiguity: 'flat-interval' } },
  { name: 'initial-overlap', input: request({ centerM: [-0.1009, 0, 0],
      expectedError: referenceErrorLiterals.initialOverlap }),
    expected: { status: 'initial-overlap', signedGapM: -0.0001,
      error: referenceErrorLiterals.initialOverlap } },
  { name: 'contact-beyond-step', input: request({ velocityMps: [10, 0, 0] }),
    expected: { status: 'clear', distanceM: 0.399, signedGapM: 0.299,
      centerFinal: [-0.3166666666666667, 0, 0], velocityFinal: [10, 0, 0] } },
  { name: 'departing-with-clearance', input: request({ velocityMps: [-100, 0, 0] }),
    expected: { status: 'clear', distanceM: 0.399, signedGapM: 0.299,
      centerFinal: [-1.2333333333333334, 0, 0], velocityFinal: [-100, 0, 0] } },
  { name: 'departing-at-touch', input: request({ centerM: [-0.101, 0, 0], velocityMps: [-100, 0, 0] }),
    expected: { status: 'hit', timeSeconds: 0, fraction: 0,
      centerFinal: [-0.9343333333333333, 0, 0], velocityFinal: [-100, 0, 0] } },
  { name: 'nonfinite-center-null-codec', input: request({ centerM: [null, 0, 0],
      expectedError: referenceErrorLiterals.referenceFinite }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceFinite } },
  { name: 'zero-step', input: request({ stepSeconds: 0,
      expectedError: referenceErrorLiterals.referenceTime }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceTime } },
  { name: 'negative-step', input: request({ stepSeconds: -0.008333333333333333,
      expectedError: referenceErrorLiterals.referenceTime }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceTime } },
  { name: 'zero-quaternion', input: request({
      box: { id: 'floor', centerM: [0, 0, 0], halfExtentsM: [0.001, 1, 1], orientationXYZW: [0, 0, 0, 0] },
      expectedError: referenceErrorLiterals.referenceQuaternion }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceQuaternion } },
  { name: 'wrong-original-radius', input: request({ capsule: { radiusM: 0.15, halfLengthM: 0.2 },
      expectedError: referenceErrorLiterals.referenceProfile }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceProfile } },
  { name: 'tangent-movement', input: request({ velocityMps: [100, 1, 0],
      expectedError: referenceErrorLiterals.referenceMovement }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceMovement } },
  { name: 'edge-corner-footprint', input: request({ centerM: [-0.4, 0.8, 0],
      expectedError: referenceErrorLiterals.referenceFootprint }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceFootprint } },
  { name: 'angular-motion', input: request({
      capsule: { radiusM: 0.1, halfLengthM: 0.2, angularVelocityRadps: [0, 1, 0] },
      expectedError: referenceErrorLiterals.referenceAngular }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceAngular } },
  { name: 'moving-box', input: request({
      box: { id: 'floor', centerM: [0, 0, 0], halfExtentsM: [0.001, 1, 1],
        orientationXYZW: [0, 0, 0, 1], velocityMps: [1, 0, 0] },
      expectedError: referenceErrorLiterals.referenceMovingBox }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceMovingBox } },
  { name: 'malformed-hit', input: request({ evaluateCandidate: true, hit: [],
      expectedError: referenceErrorLiterals.referenceHit }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceHit } },
  { name: 'malformed-result', input: request({ result: null,
      expectedError: referenceErrorLiterals.referenceResult }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceResult } },
  { name: 'nonfinite-result-null-codec', input: request({
      result: { centerM: [null, 0, 0], velocityMps: [0, 0, 0],
        hitTimeSeconds: 0.00299, remainingTimeSeconds: 0.005343333333333333 },
      expectedError: referenceErrorLiterals.referenceFinite }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceFinite } },
  { name: 'finite-input-overflowing-binary-output', input: request({
      velocityMps: [-1e308, 0, 0], stepSeconds: 1e308,
      expectedError: referenceErrorLiterals.referenceNumeric }),
    expected: { status: 'input-error', error: referenceErrorLiterals.referenceNumeric } },
]);

function finiteNumber(actual, label) {
  assert.ok(actual !== null &&
    (typeof actual === 'number' || (typeof actual === 'string' && actual.trim() !== '')),
    `${label}: missing or invalid numeric output`);
  const decoded = Number(actual);
  assert.ok(Number.isFinite(decoded), `${label}: nonfinite numeric output`);
  return decoded;
}

function close(actual, expected, tolerance, label) {
  const decoded = finiteNumber(actual, label);
  assert.ok(Math.abs(decoded - expected) <= tolerance,
    `${label}: ${actual} versus ${expected}`);
}

function vectorClose(actual, expected, tolerance, label) {
  assert.equal(actual.length, expected.length, label);
  const error = Math.hypot(...actual.map((value, axis) => finiteNumber(value, `${label}[${axis}]`) - expected[axis]));
  assert.ok(error <= tolerance, `${label}: ${error}`);
}

function checkExpected(reply, expected, label) {
  assert.equal(reply.ok, true, `${label}: ${JSON.stringify(reply.violations)}`);
  assert.equal(reply.resolved, true, label);
  const ref = reply.reference;
  assert.equal(ref.status, expected.status, label);
  for (const [key, field, tolerance] of [
    ['distanceM', 'distance', referenceGates.distanceM],
    ['signedGapM', 'signedGap', referenceGates.signedGapM],
    ['timeSeconds', 'toiSeconds', referenceGates.timeSeconds],
    ['fraction', 'toiFraction', referenceGates.fraction],
    ['remainingSeconds', 'remainingSeconds', referenceGates.timeSeconds],
  ]) {
    if (key in expected) close(ref[field], expected[key], tolerance, `${label}.${key}`);
  }
  for (const field of ['centerHit', 'centerFinal', 'velocityFinal', 'normal']) {
    if (field in expected) vectorClose(ref[field], expected[field], 1e-12, `${label}.${field}`);
  }
  if ('ambiguity' in expected) {
    assert.equal(ref.initialWitness.witnessAmbiguity, expected.ambiguity, label);
    assert.ok(ref.initialWitness.flatIntervalsM.length > 0, label);
  }
  if ('error' in expected) assert.deepEqual(ref.error, expected.error, label);
  if (expected.status === 'clear') {
    assert.equal(ref.toiSeconds, null, label);
    assert.equal(ref.toiFraction, null, label);
  }
}

export async function runReferenceControls(ask) {
  const receipts = [];
  for (const control of literalReferenceControls) {
    const input = structuredClone(control.input);
    const before = structuredClone(input);
    const reply = await ask(input);
    assert.deepEqual(input, before, `${control.name}: caller input copy`);
    checkExpected(reply, control.expected, control.name);
    receipts.push({ name: control.name, ok: reply.ok, resolved: reply.resolved,
      metrics: reply.metrics, reference: reply.reference });
  }
  const full = await ask(structuredClone(originalReferenceInput));
  const firstInput = request({ stepSeconds: 0.004166666666666667 });
  const first = await ask(firstInput);
  const secondInput = request({
    centerM: first.reference.centerFinal.map(Number),
    velocityMps: first.reference.velocityFinal.map(Number),
    stepSeconds: 0.004166666666666667,
  });
  const second = await ask(secondInput);
  for (const reply of [full, first, second]) assert.equal(reply.ok, true, 'half-step composition');
  vectorClose(second.reference.centerFinal, full.reference.centerFinal.map(Number),
    referenceGates.centerM, 'half-step final center');
  vectorClose(second.reference.velocityFinal, full.reference.velocityFinal.map(Number),
    referenceGates.closingSpeedMps, 'half-step final velocity');
  close(first.reference.toiSeconds, Number(full.reference.toiSeconds),
    referenceGates.timeSeconds, 'half-step total contact time');
  close(second.reference.toiSeconds, 0, referenceGates.timeSeconds, 'second half initial touch');
  receipts.push({ name: 'two-half-step-composition', ok: true,
    full: full.reference, first: first.reference, second: second.reference });
  const copyInput = structuredClone(originalReferenceInput);
  const accepted = await ask(copyInput);
  copyInput.centerM[0] = -4;
  copyInput.box.halfExtentsM[0] = 0.002;
  const repeat = await ask(structuredClone(originalReferenceInput));
  assert.deepEqual(repeat, accepted, 'input copy repeat');
  const replyCopy = structuredClone(repeat);
  repeat.reference.centerFinal[0] = '42';
  repeat.reference.normal[0] = '42';
  const fresh = await ask(structuredClone(originalReferenceInput));
  assert.deepEqual(fresh, replyCopy, 'result copy repeat');
  receipts.push({ name: 'input-result-copy-repeat', ok: true });
  return receipts;
}

export const controls = runReferenceControls;
