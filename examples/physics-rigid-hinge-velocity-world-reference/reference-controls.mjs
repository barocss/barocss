import assert from 'node:assert/strict';
import {negativeZeroPaths} from './raw-codec.mjs';
import {envelope} from './reference-reply.mjs';

const copy = value => structuredClone(value);
const INPUT = {code: 'REFERENCE_INPUT', message: 'hinge world reference input is invalid'};
const JSON_ERROR = {code: 'REFERENCE_JSON', message: 'hinge world reference line must be valid JSON'};

function expectError(reply, expected) {
  envelope(reply);
  assert.equal(reply.ok, false); assert.equal(reply.resolved, false); assert.equal(reply.executionFailure, true);
  assert.equal(reply.referenceStatus, 'UNRESOLVED'); assert.equal(reply.metrics, null);
  assert.equal(reply.reference, null); assert.deepEqual(reply.violations, []); assert.deepEqual(reply.error, expected);
}
function expectReturn(reply, initial) {
  envelope(reply);
  assert.equal(reply.ok, true); assert.equal(reply.resolved, true); assert.equal(reply.executionFailure, false);
  assert.equal(reply.referenceStatus, 'RETURN'); assert.equal(reply.error, null); assert.deepEqual(reply.violations, []);
  assert.equal(reply.metrics.actualCompared, true);
  assert.deepEqual(reply.metrics.pairActualCompared, initial ? [false, false] : [true, true]);
  if (initial) assert.equal(reply.reference.stage, 'initial');
}
function mutateReply(value) {
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'number') value[key] += 1;
    else mutateReply(value[key]);
  }
}

/** Exactly the frozen26 requests; missing S0 is reported, never manufactured. */
export async function runReferenceControls({I0, S0, askReference, askRaw, record}) {
  let reached = 0;
  const send = async (name, request, expected) => {
    const reply = await askReference(request); reached++;
    if (expected === 'INPUT') expectError(reply, INPUT);
    else if (expected === 'MISMATCH') {
      envelope(reply); assert.equal(reply.ok, false); assert.equal(reply.resolved, true);
      assert.equal(reply.executionFailure, false); assert.equal(reply.referenceStatus, 'MISMATCH');
      assert.equal(reply.error, null); assert.ok(reply.violations.length > 0);
    } else expectReturn(reply, request.op === 'initial');
    await record({type: 'reference-control', name, passed: true, expected, reached});
    return reply;
  };
  if (I0 !== null) await send('P01', copy(I0), 'RETURN');
  if (S0 !== null) {
    const pristine = copy(S0), first = await send('P02', copy(S0), 'RETURN'), untouched = copy(first);
    mutateReply(first);
    const repeated = await send('P03', copy(S0), 'RETURN');
    assert.deepEqual(repeated, untouched); assert.deepEqual(S0, pristine);
  }
  const initialMutations = [
    request => { request.extra = 0; },
    request => { request.sourceState.timeSeconds = null; },
    request => { request.sourceState.bodies[1].id = 'pairA0'; },
    request => { request.sourceState.bodies[0].angularVelocityRadps[0] = false; },
    request => { request.sourceRawHex = '00'; },
    request => { request.sourceRawHex = '000000000000f87f' + request.sourceRawHex.slice(16); },
    request => { request.negativeZeroPaths.sourceState = ['/pairStats/eligiblePairs', '/pairStats/eligiblePairs']; },
    request => { request.negativeZeroPaths.sourceState = ['/bodies/0/positionM/0']; },
  ];
  if (I0 !== null) for (let index = 0; index < initialMutations.length; index++) {
    const request = copy(I0); initialMutations[index](request);
    await send('I' + String(index + 1).padStart(2, '0'), request, 'INPUT');
  }
  const stepMutations = [
    request => { request.dt = null; },
    request => { request.outcome = 'prediction'; },
    request => { request.sourceState.timeSeconds += .001; },
    request => { assert.deepEqual(request.commands, []); request.commandsRawHex = '00'; },
    request => { request.rawFrames.angular = '00'; },
    request => { request.sourceState.bodies[0].positionM[0] += .001; },
    request => {
      assert.equal(request.sourceState.stepIndex, 0);
      assert.ok(Object.is(request.sourceState.bodies[0].velocityMps[1], 0));
      request.negativeZeroPaths.sourceState = ['/bodies/0/velocityMps/1'];
    },
    request => { request.negativeZeroPaths.sourceState = ['/absent']; },
    request => { request.attempt = null; request.negativeZeroPaths.attempt = ['/stage']; },
    request => { request.attempt.pairProgress[1].projectedRawHex = null; },
    request => { request.attempt.pairProgress[0].lastCall.ordinal = 2; },
    request => {
      request.outcome = 'refused'; request.output = null; request.negativeZeroPaths.output = [];
      request.error = {name: 'PhysicsError', code: 'NUMERIC_LIMIT', message: 'invented World error'};
    },
    request => {
      request.output.state.joints[0].angleRad += .01;
      request.negativeZeroPaths.output = negativeZeroPaths(request.output);
    },
    request => {
      request.outcome = 'refused'; request.output = null; request.negativeZeroPaths.output = [];
      request.error = {name: 'PhysicsError', code: 'NUMERIC_LIMIT', message: 'hinge0 exceeded motor reaction limit'};
    },
  ];
  if (S0 !== null) for (let index = 0; index < stepMutations.length; index++) {
    const request = copy(S0); stepMutations[index](request);
    await send('S' + String(index + 1).padStart(2, '0'), request, index < 12 ? 'INPUT' : 'MISMATCH');
  }
  const malformed = await askRaw('{\n'); reached++; expectError(malformed, JSON_ERROR);
  await record({type: 'reference-control', name: 'J01', passed: true, expected: 'JSON', reached});
  return {reached, planned: 26, complete: reached === 26};
}
