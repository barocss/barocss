import assert from 'node:assert/strict';
import {literalCases, providerProvenance} from './fixtures.mjs';
import {rawBodies, rawCommands, framesToRaw, rawEvidence, negativeZeroPaths, digest} from './raw.mjs';

const FRAME_KEYS = ['sourceBodies', 'angularBodies', 'motorBodies', 'freeBodies', 'projectedBodies'];
const WIRE_FRAMES = ['source', 'angular', 'motor', 'free', 'projected'];
const REPORT_KEYS = ['id', 'kind', 'aId', 'bId', 'angleRad', 'linearImpulseNs', 'angularImpulseNms', 'motorImpulseNms'];
const CHECK_KEYS = [
  'sourceRawMatchesInput', 'commandsRawMatchesInput', 'parsedActionsMatch', 'sourceCursorRetained',
  'acceptedReportAuthorityMatch', 'heldFrameBitsMatch', 'namedZeroSignsMatch', 'outputAttemptCorrespondence',
  'callsMatch', 'jointReportIdentityMatch', 'targetAngleAuthorityMatch', 'capDecisionMatch',
  'finiteSignedWork', 'nonnegativeEnergiesAndObjective', 'parentPredictionQualified', 'parentActualQualified',
  'actualErrorMatch', 'actualOutcomeMatch',
];
const WORK_KEYS = ['externalAngularByBodyJ', 'externalAngularTotalJ', 'motorMidpointJ', 'motorSpinMidpointJ',
  'motorResidualJ', 'freeDeltaKJ', 'projectionDeltaKJ', 'projectionObjectiveJ', 'energyByPhaseJ', 'motorBalanceResidualJ'];
const PAIR_ERROR_KEYS = ['positionM', 'angleRad', 'quaternion', 'velocityMps', 'angularVelocityRadps',
  'linearMomentumKgMps', 'angularMomentumKgM2ps', 'energyJ'];
const PRECISION_UNITS = ['positionM', 'quaternion', 'velocityMps', 'angularVelocityRadps',
  'linearMomentumKgMps', 'angularMomentumKgM2ps', 'energyJ', 'impulseNs', 'angularImpulseNms'];

export class ReferenceExecutionError extends Error {
  constructor(message = 'hinge motor reference execution is unresolved or invalid') {
    super(message); this.name = 'ReferenceExecutionError';
  }
}

function record(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length ||
    keys.some(key => {const d = Object.getOwnPropertyDescriptor(value, key);
      return !d || !d.enumerable || !Object.hasOwn(d, 'value');}) ||
    Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key))) {
    throw new ReferenceExecutionError(label + ' schema differs');
  }
}

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ReferenceExecutionError(label + ' must be finite numeric');
  return value;
}

function finiteTree(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return Object.getPrototypeOf(value) === Array.prototype &&
    Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({length: value.length}, (_, i) => Object.hasOwn(value, i) && finiteTree(value[i])).every(Boolean);
  return Object.getPrototypeOf(value) === Object.prototype && Reflect.ownKeys(value).every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && d?.enumerable && Object.hasOwn(d, 'value') && finiteTree(d.value);
  });
}

function knownProducerError(m, thrown, input) {
  if (!(thrown instanceof m.PhysicsError)) return null;
  // Preserve the inherited provider boundary. Do not invoke unknown code/message getters here.
  const descriptors = Object.getOwnPropertyDescriptors(thrown);
  const code = descriptors.code?.value, message = descriptors.message?.value;
  const name = descriptors.name?.value;
  if (name !== 'PhysicsError' || typeof code !== 'string' || typeof message !== 'string') return null;
  const original = [
    'private hinge velocity archived pose is invalid', 'private hinge velocity result is invalid',
    'private hinge velocity linear data is invalid', 'private hinge velocity system is singular or unsafe',
    'private hinge velocity certificate is invalid', 'unsafe joint reaction',
    'private hinge motor diagnostics are invalid',
  ];
  const bodyMessages = input.carrier.bodies.flatMap(body => [
    `${body.id} exceeded angular movement limit`, `${body.id} exceeded step displacement limit`,
    `${body.id} position exceeded bounds`, `${body.id} velocity exceeded bounds`,
    `${body.id} angularVelocity exceeded bounds`, `${body.id} orientation exceeded tolerance`,
  ]);
  const cap = `${input.config.joints[0].id} exceeded motor reaction limit`;
  if (code === 'NUMERIC_LIMIT' && [...original, ...bodyMessages, cap].includes(message)) return {name, code, message};
  if (code === 'INVALID_CONFIG' && message === 'private hinge velocity profile is unsupported') return {name, code, message};
  if (code === 'INVALID_STEP' && message === 'private hinge velocity step must equal 1/120') return {name, code, message};
  return null;
}

function validateActual(output, attempt, pristine) {
  if (output !== null) {
    record(output, ['bodies', 'jointReport', 'diagnostics'], 'producer output');
    record(output.jointReport, REPORT_KEYS, 'producer report');
    record(output.diagnostics, ['sourceStepIndex', 'sourceTimeSeconds', 'acceptedReportAngleRad',
      'rawSourceAngleRad', 'rawFreeAngleRad', 'rawFinalAngleRad', 'parsedActions', 'frames', 'metrics',
      'motor', 'projection', 'bodyCorrections', 'energyByPhase', 'work', 'reportCap', 'calls'], 'producer diagnostics');
    assert.equal(finiteTree(output), true, 'finite own producer data');
    assert.ok(Object.is(output.jointReport.angleRad, output.diagnostics.projection.poseReport.targetAngleRad), 'exact outgoing target authority');
    assert.equal(output.diagnostics.sourceStepIndex, pristine.carrier.stepIndex);
    assert.equal(output.diagnostics.sourceTimeSeconds, pristine.carrier.timeSeconds);
    assert.ok(Object.is(output.diagnostics.acceptedReportAngleRad, pristine.carrier.joints[0].angleRad));
    assert.deepEqual(output.diagnostics.calls, {motorCalls: 1, projectionCalls: 1});
    assert.deepEqual(output.bodies, output.diagnostics.frames.projectedBodies);
    assert.deepEqual(output.bodies, output.diagnostics.projection.bodies);
  }
  if (attempt !== null) {
    record(attempt, ['stage', 'sourceStepIndex', 'sourceTimeSeconds', 'acceptedReportAngleRad',
      'parsedActions', 'frames', 'motor', 'projection', 'jointReport', 'bodyCorrections',
      'energyByPhase', 'work', 'reportCap', 'calls', 'error'], 'producer attempt');
    record(attempt.frames, FRAME_KEYS, 'producer attempt frames');
    assert.equal(finiteTree(attempt), true, 'finite own attempt data');
    assert.equal(attempt.sourceStepIndex, pristine.carrier.stepIndex);
    assert.equal(attempt.sourceTimeSeconds, pristine.carrier.timeSeconds);
    assert.ok(Object.is(attempt.acceptedReportAngleRad, pristine.carrier.joints[0].angleRad));
    assert.ok(['admitted', 'angular-ready', 'motor-ready', 'free-ready', 'projection-ready', 'report-ready'].includes(attempt.stage));
    assert.ok([0, 1].includes(attempt.calls.motorCalls) && [0, 1].includes(attempt.calls.projectionCalls));
    if (output !== null) {
      assert.equal(attempt.stage, 'report-ready'); assert.equal(attempt.error, null);
      for (const key of ['frames', 'motor', 'projection', 'bodyCorrections', 'energyByPhase', 'work', 'reportCap', 'calls']) {
        assert.deepEqual(attempt[key], output.diagnostics[key], 'output/attempt ' + key);
      }
      assert.deepEqual(attempt.jointReport, output.jointReport);
    }
  }
}

function compareReply(reply, expectedDisposition, reachedRaw, output, error, attempt) {
  record(reply, ['ok', 'resolved', 'executionFailure', 'referenceStatus', 'metrics', 'reference', 'violations', 'error'], 'reference envelope');
  for (const key of ['ok', 'resolved', 'executionFailure']) if (typeof reply[key] !== 'boolean') throw new ReferenceExecutionError('reference boolean differs');
  if (reply.resolved !== true || reply.executionFailure !== false || reply.error !== null) throw new ReferenceExecutionError();
  if (!['RETURN', 'CAP_REFUSAL', 'PRODUCER_REFUSAL', 'MISMATCH'].includes(reply.referenceStatus) ||
    !Array.isArray(reply.violations) || !reply.violations.every(v => typeof v === 'string')) throw new ReferenceExecutionError('reference status/violations differ');
  record(reply.metrics, ['actualCompared', 'checks', 'frameErrors', 'motorError', 'reportError', 'workError', 'pairMetricErrors', 'precision'], 'reference metrics');
  if (reply.metrics.actualCompared !== true) throw new ReferenceExecutionError('actual reference comparison is required');
  record(reply.metrics.checks, CHECK_KEYS, 'reference checks');
  record(reply.metrics.frameErrors, WIRE_FRAMES, 'reference frame errors');
  record(reply.metrics.pairMetricErrors, WIRE_FRAMES, 'reference pair errors');
  record(reply.metrics.precision, ['algebraMaxDifferenceByUnit', 'scalarRepeatMaxDifferenceRad', 'algebraResolved', 'scalarResolved'], 'reference precision');
  record(reply.metrics.precision.algebraMaxDifferenceByUnit, PRECISION_UNITS, 'reference precision units');
  if (reply.metrics.precision.algebraResolved !== true || reply.metrics.precision.scalarResolved !== true) throw new ReferenceExecutionError('reference precision is unresolved');
  const failures = [];
  if (output !== null || attempt?.stage === 'report-ready') {
    for (const key of ['motorError', 'reportError', 'workError']) {
      if (reply.metrics[key] === null) throw new ReferenceExecutionError('complete actual comparison is missing: ' + key);
    }
  }
  const near = (value, gate, label) => {if (Math.abs(finite(value, label)) > gate) failures.push(label);};
  for (const [key, value] of Object.entries(reply.metrics.checks)) {
    if (value !== null && typeof value !== 'boolean') throw new ReferenceExecutionError('reference check is not boolean/null');
    if (value === false) failures.push('reference check ' + key);
    // Complete actual report cases must not borrow prediction-only default flags.
    if ((output !== null || attempt?.stage === 'report-ready') && value === null &&
      !(key === 'outputAttemptCorrespondence' && output === null)) {
      throw new ReferenceExecutionError('complete actual check is missing: ' + key);
    }
  }
  for (const label of WIRE_FRAMES) {
    const e = reply.metrics.frameErrors[label], pair = reply.metrics.pairMetricErrors[label];
    if (reachedRaw[label] === null) {
      if (e !== null || pair !== null) throw new ReferenceExecutionError('unreached frame error is fabricated');
      continue;
    }
    record(e, ['positionM', 'quaternion', 'velocityMps', 'angularVelocityRadps', 'metadataMatch'], 'reference ' + label + ' error');
    near(e.positionM, 1e-12, label + ' p'); near(e.quaternion, 1e-12, label + ' q');
    near(e.velocityMps, 1e-10, label + ' v'); near(e.angularVelocityRadps, label === 'projected' ? 1e-9 : 1e-10, label + ' omega');
    if (typeof e.metadataMatch !== 'boolean') throw new ReferenceExecutionError('reference metadata flag differs');
    if (!e.metadataMatch) failures.push(label + ' metadata');
    // Pair metric agreement exists when diagnostics are complete; a late partial
    // attempt does not fabricate missing source/motor measurement diagnostics.
    if (pair !== null) {record(pair, PAIR_ERROR_KEYS, 'reference pair metric error');
      for (const [key, value] of Object.entries(pair)) near(value, 1e-12, label + ' metric ' + key);}
    else if (output !== null) throw new ReferenceExecutionError('complete pair metric error is missing');
  }
  if (reply.metrics.motorError !== null) {
    const v = reply.metrics.motorError;
    record(v, ['inputAngleMatch', 'blockedMatch', 'impulseNms', 'relativeSpeedBeforeRadps', 'relativeSpeedAfterRadps'], 'reference motor error');
    for (const key of ['inputAngleMatch', 'blockedMatch']) {if (typeof v[key] !== 'boolean') throw new ReferenceExecutionError('motor branch flag differs'); if (!v[key]) failures.push('motor ' + key);}
    near(v.impulseNms, 1e-12, 'motor j'); near(v.relativeSpeedBeforeRadps, 1e-10, 'motor sBefore'); near(v.relativeSpeedAfterRadps, 1e-10, 'motor sAfter');
  }
  if (reply.metrics.reportError !== null) {
    record(reply.metrics.reportError, ['angleRad', 'linearImpulseNs', 'angularImpulseNms', 'motorImpulseNms', 'bodyLinearImpulseNs', 'bodyAngularImpulseNms', 'angularReactionNormNms'], 'reference report error');
    for (const [key, value] of Object.entries(reply.metrics.reportError)) near(value, key === 'angleRad' ? 1e-9 : 1e-12, 'report ' + key);
  }
  if (reply.metrics.workError !== null) {
    record(reply.metrics.workError, WORK_KEYS, 'reference work error');
    for (const [key, value] of Object.entries(reply.metrics.workError)) near(value, key === 'projectionObjectiveJ' ? 1e-10 : 1e-12, 'work ' + key);
  }
  for (const [key, value] of Object.entries(reply.metrics.precision.algebraMaxDifferenceByUnit)) near(value, 1e-25, 'precision ' + key);
  near(reply.metrics.precision.scalarRepeatMaxDifferenceRad, 1e-12, 'scalar repeat');
  if (!reply.ok) failures.push(...reply.violations.map(v => 'reference: ' + v));
  if (!reply.ok && reply.violations.length === 0) failures.push('reference reported NO-GO without violation text');
  if (reply.referenceStatus !== expectedDisposition) failures.push('mandatory disposition: expected ' + expectedDisposition + ', got ' + reply.referenceStatus);
  if (expectedDisposition === 'RETURN' && output === null) failures.push('required complete return is absent');
  if (expectedDisposition === 'CAP_REFUSAL') {
    if (output !== null || error === null || error.code !== 'NUMERIC_LIMIT' ||
      error.message !== `${attempt?.jointReport?.id} exceeded motor reaction limit`) failures.push('required exact cap receipt is absent');
    if (attempt?.stage !== 'report-ready' || attempt.error !== null || attempt.reportCap?.exceedsCap !== true) failures.push('actual pre-cap reached report proof is absent');
  }
  return {passed: reply.ok && failures.length === 0, failures};
}

export async function consumeCases(m, ask, {writeRecord, limit = 14, genuineBeforeRaw} = {}) {
  assert.equal(typeof ask, 'function', 'independent observer is required');
  assert.equal(typeof writeRecord, 'function', 'durable per-case writer is required');
  assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 14, 'same frozen prefix length');
  assert.equal(literalCases.length, 14);
  assert.ok(Buffer.isBuffer(genuineBeforeRaw) && genuineBeforeRaw.length === 208,
    'authenticated genuine-before buffer is required');
  assert.deepEqual(rawBodies(literalCases[0].input.carrier.bodies), genuineBeforeRaw,
    'genuine input equals authenticated parent BEFORE bytes');
  assert.equal(digest(genuineBeforeRaw), providerProvenance.genuineRawSha256);
  const observations = [], counts = {declaredCases: 14, candidateCalls: 0, attemptedCases: 0,
    returnedOutputs: 0, matchedReturns: 0, matchedCaps: 0, earlierKnownRefusals: 0,
    motorCalls: 0, projectionCalls: 0, observerCalls: 0, callCountsComplete: true};
  let failure = null;
  for (let index = 0; index < limit; index++) {
    const item = literalCases[index], input = structuredClone(item.input), pristine = structuredClone(input);
    const sourceRaw = rawBodies(input.carrier.bodies), commandsRaw = rawCommands(input.commands);
    let output = null, attempt = null, error = null, callbackCount = 0;
    let unknownThrown, unknownReceived = false;
    counts.candidateCalls++; counts.attemptedCases++;
    try {
      output = m.advanceDrivenHingePairReference(input.config, input.carrier, input.dt, input.commands,
        {observeAttempt(value) {callbackCount++; attempt = structuredClone(value);}});
      counts.returnedOutputs++;
    } catch (thrown) {
      error = knownProducerError(m, thrown, pristine);
      if (error === null) {unknownReceived = true; unknownThrown = thrown;}
    }
    const raw = output !== null ? framesToRaw(output.diagnostics.frames) :
      attempt !== null ? framesToRaw(attempt.frames) : {source: sourceRaw, angular: null, motor: null, free: null, projected: null};
    const calls = attempt?.calls ?? output?.diagnostics.calls ?? (unknownReceived ? null : {motorCalls: 0, projectionCalls: 0});
    counts.observerCalls += callbackCount;
    if (calls) {counts.motorCalls += calls.motorCalls; counts.projectionCalls += calls.projectionCalls;}
    else counts.callCountsComplete = false;
    const observation = {kind: 'hinge-case', index, ordinal: index + 1, name: item.name,
      expectedDisposition: item.expectedDisposition, input: pristine, inputAfter: structuredClone(input),
      inputRetained: null, attempt, output, error,
      callbackCount, calls, rawFrames: Object.fromEntries(WIRE_FRAMES.map(label => [label, rawEvidence(raw[label])])),
      commandsRaw: rawEvidence(commandsRaw), negativeZeroPaths: negativeZeroPaths({input: pristine, attempt, output}),
      reference: null, compared: null, passed: false, classification: null,
      worldCreated: false, worldStepped: false, parent93Replayed: false};
    const rawBuffers = [...WIRE_FRAMES.map(label => raw[label]).filter(value => value !== null), commandsRaw];
    if (unknownReceived) {
      observation.classification = 'EXECUTION_FAILURE';
      observation.executionFailure = {phase: 'producer', unknownReceived: true, thrownPayloadStored: false};
      observations.push(observation); await writeRecord(observation, rawBuffers);
      throw unknownThrown;
    }
    try {
      assert.deepEqual(input, pristine, 'complete input retained');
      assert.deepEqual(rawBodies(input.carrier.bodies), sourceRaw, 'raw input bits retained');
      assert.deepEqual(rawCommands(input.commands), commandsRaw, 'command bits retained');
      observation.inputRetained = true;
      assert.ok(callbackCount <= 1, 'maximum one observer callback');
      validateActual(output, attempt, pristine);
      if (output !== null || attempt?.stage === 'report-ready') assert.equal(callbackCount, 1);
      const request = {op: 'evaluate', config: pristine.config, carrier: pristine.carrier, dt: pristine.dt,
        commands: pristine.commands, commandsRawHex: commandsRaw.toString('hex'),
        outcome: output === null ? 'refused' : 'returned', attempt, output, error,
        rawFrames: Object.fromEntries(WIRE_FRAMES.map(label => [label, raw[label]?.toString('hex') ?? null]))};
      observation.reference = await ask(request);
      observation.compared = compareReply(observation.reference, item.expectedDisposition, raw, output, error, attempt);
      observation.passed = observation.compared.passed;
      observation.classification = observation.passed ? 'PASS' : 'NO_GO';
    } catch (thrown) {
      observation.classification = 'EXECUTION_FAILURE';
      // This record stores a fixed harness phase marker, never an unknown payload.
      observation.executionFailure = {phase: 'validation-or-reference', unknownPayloadStored: false};
      observations.push(observation); await writeRecord(observation, rawBuffers);
      throw thrown;
    }
    if (observation.passed) {
      if (item.expectedDisposition === 'RETURN') counts.matchedReturns++;
      else counts.matchedCaps++;
    } else if (error !== null && error.message !== `${input.config.joints[0].id} exceeded motor reaction limit`) counts.earlierKnownRefusals++;
    observations.push(observation);
    // Persist the full actual record and raw prefix before any next physical call.
    await writeRecord(observation, rawBuffers);
    if (!observation.passed) {failure = observation; break;}
  }
  return {observations, failure, counts, providerProvenance,
    stagedReportSemanticsGO: failure === null && observations.length === 14 &&
      counts.matchedReturns === 12 && counts.matchedCaps === 2,
    matchedCapMeansAcceptedOutput: false, worldGO: false, worldCreated: false,
    worldStepped: false, parent93Replayed: false};
}
