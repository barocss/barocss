import assert from 'node:assert/strict';
import { makeWorldFixture, FIXED_DT } from './fixture.mjs';
import { rawBodies, rawBodiesHex, angularCommandRawHex, negativeZeroPaths, framesRawHex } from './raw-codec.mjs';

const PROFILE = 'private hinge velocity World profile is unsupported';
const GROUP = 'private multi-hinge reference requires literal HINGE2 fixture';
const OPTIONS = 'private hinge velocity World options are invalid';
const angular = (bodyId, z) => ({ kind: 'angularImpulse', bodyId, angularImpulseNms: [0, 0, z] });
const copy = value => structuredClone(value);

/** Fixed controls. All constructors and steps occur only when Root calls this function. */
export async function runNativeControls({ createWorld, createOriginalWorld, PhysicsError, askReference, record, resumePrefix = null }) {
  assert.equal(typeof createWorld, 'function');
  assert.equal(typeof createOriginalWorld, 'function');
  assert.equal(typeof PhysicsError, 'function');
  assert.equal(typeof askReference, 'function');
  assert.equal(typeof record, 'function');
  const counts = { publicConstructors: 0, privateConstructors: 0, stepAttempts: 0, calculationAttemptsObserved: 0,
    acceptedSteps: 0, observerCallbacks: 0, queryCalls: 0, disposeCalls: 0, referenceRequests: 0,
    observedCalls: { angularUpdates: 0, freeIntegrations: 0, motorCalls: 0, projectionCalls: 0, reportCalls: 0 } };
  const receipts = [];
  let firstFailure = null;
  let I0 = null, S0 = null, initialCheckpoint = null;
  // Root authenticates and imports these exact original bytes before calling this hook.
  // Reused evidence contributes logical controls, never new native/reference calls.
  if (resumePrefix !== null) {
    const names = ['public-HINGE2-admission',
      ...['config-null', 'config-extra', 'mass-zero', 'duplicate-id', 'sparse-bodies', 'sparse-joints',
        'body-order', 'joint-order', 'gravity', 'mass-profile', 'inertia-presence', 'pair1-offset', 'axis', 'motor', 'chain'].map(name => 'constructor-' + name),
      'options-extra', 'options-accessor', 'constructor-input-copy', 'W0-initial-native'];
    assert.equal(resumePrefix.records.length, 20);
    assert.deepEqual(resumePrefix.records.map(value => value.name), names);
    assert.ok(resumePrefix.records.slice(0, 19).every(value => value.passed === true));
    for (const value of resumePrefix.records) assert.deepEqual(value.zeroPaths, negativeZeroPaths(value));
    assert.deepEqual(resumePrefix.historicalCounts, { publicConstructors: 1, privateConstructors: 18,
      failedInitialRequests: 1, completedInitialRequests: 1, worldSteps: 0, projectionCalls: 0 });
    assert.deepEqual(resumePrefix.records[19].request, resumePrefix.I0);
    assert.deepEqual(resumePrefix.records[19].snapshot, resumePrefix.initialCheckpoint);
    assert.deepEqual(resumePrefix.records[18].snapshot, resumePrefix.initialCheckpoint);
    assert.equal(resumePrefix.I0.op, 'initial');
    assert.deepEqual(resumePrefix.I0.config, makeWorldFixture());
    assert.equal(resumePrefix.I0.sourceRawHex, rawBodiesHex(resumePrefix.I0.sourceState.bodies));
    assert.equal(resumePrefix.I0.sourceRawHex, rawBodiesHex(resumePrefix.initialCheckpoint.bodies));
    validateReply(resumePrefix.I0, resumePrefix.initialReply);
    assert.equal(resumePrefix.initialReply.ok, true);
    assert.equal(resumePrefix.initialReply.referenceStatus, 'RETURN');
    receipts.push(...resumePrefix.records.map(value => ({ name: value.name, passed: value.passed ?? true })));
  }
  const save = async (name, receipt, raw = []) => {
    const value = { type: 'native-control', name, ...receipt };
    value.zeroPaths = negativeZeroPaths(value);
    await record(value, raw); receipts.push({ name, passed: value.passed ?? true });
  };
  function known(value) {
    if (!(value instanceof PhysicsError)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (!['name', 'code', 'message'].every(key => descriptors[key] && Object.hasOwn(descriptors[key], 'value')) ||
      descriptors.name.value !== 'PhysicsError' || typeof descriptors.code.value !== 'string' || typeof descriptors.message.value !== 'string') return null;
    return { name: 'PhysicsError', code: descriptors.code.value, message: descriptors.message.value };
  }
  function expectError(call, code, message) {
    let caught = false, received;
    try { call(); } catch (value) { caught = true; received = value; }
    assert.equal(caught, true, 'expected original PhysicsError');
    const error = known(received);
    assert.deepEqual(error, { name: 'PhysicsError', code, message });
    return error;
  }
  const capture = mode => ({ attempts: [], value: null, callback(attempt) {
    counts.observerCallbacks++;
    this.attempts.push(copy(attempt));
    if (mode?.enabled) throw mode.value;
    if (mode?.mutate) mutateNumbers(attempt);
  } });
  function construct(name, mode = null) {
    const observer = capture(mode), config = makeWorldFixture();
    counts.privateConstructors++;
    const world = createWorld(config, { observeAttempt: attempt => observer.callback(attempt) });
    return { name, config, world, observer };
  }
  function retain(context, before, beforeRaw) {
    assert.deepEqual(context.world.getTransactionSnapshot(), before);
    assert.equal(rawBodiesHex(context.world.getState().bodies), beforeRaw);
    assert.deepEqual(context.world.getDiagnostics(), before.diagnostics);
  }
  async function ask(request) {
    counts.referenceRequests++;
    const reply = await askReference(request);
    return validateReply(request, reply);
  }
  function validateReply(request, reply) {
    assert.deepEqual(Object.keys(reply ?? {}).sort(), ['ok', 'resolved', 'executionFailure', 'referenceStatus', 'metrics', 'reference', 'violations', 'error'].sort());
    assert.equal(typeof reply.ok, 'boolean');
    if (!reply || reply.resolved !== true || reply.executionFailure !== false) {
      const error = new Error('hinge World control reference did not resolve');
      error.request = request; error.reply = reply; throw error;
    }
    assert.ok(['RETURN', 'PRODUCER_REFUSAL', 'MISMATCH'].includes(reply.referenceStatus));
    assert.equal(reply.error, null);
    assert.equal(reply.metrics.actualCompared, true);
    assert.equal(reply.metrics.precision.algebraResolved, true);
    assert.equal(reply.metrics.precision.scalarResolved, true);
    if (reply.ok === true && reply.referenceStatus === 'RETURN') {
      if (request.op === 'initial') {
        assert.equal(reply.reference.stage, 'initial');
        assert.deepEqual(reply.metrics.pairActualCompared, [false, false]);
        assert.deepEqual(reply.reference.pairReplies, [null, null]);
      } else {
        assert.deepEqual(reply.metrics.pairActualCompared, [true, true]);
        for (const check of Object.entries(reply.metrics.checks)) {
          if (check[0] !== 'pairs') assert.equal(check[1], true, check[0]);
        }
        for (const pair of reply.metrics.checks.pairs) for (const [key, value] of Object.entries(pair)) assert.equal(value, true, key);
        assert.equal(reply.reference.pairReplies.length, 2);
        for (const parent of reply.reference.pairReplies) {
          assert.deepEqual(Object.keys(parent).sort(), ['ok', 'resolved', 'executionFailure', 'metrics', 'violations', 'reference', 'certificate', 'transcendentals', 'zeroAuthority'].sort());
          assert.equal(parent.ok, true); assert.equal(parent.resolved, true); assert.equal(parent.executionFailure, false);
        }
      }
    }
    return reply;
  }
  async function initial(context) {
    if (context.name !== 'W0') {
      if (I0 === null || initialCheckpoint === null) {
        await save(context.name + '-initial-unavailable', { passed: false, classification: 'NO_QUALIFIED_INITIAL_CHECKPOINT' });
        return false;
      }
      const snapshot = context.world.getTransactionSnapshot();
      assert.deepEqual(snapshot, initialCheckpoint);
      assert.equal(rawBodiesHex(context.world.getState().bodies), I0.sourceRawHex);
      await save(context.name + '-initial-copy-parity', { passed: true, snapshot, referenceRequests: 0,
        qualifiedInitialRecord: 'W0-initial' }, [rawBodies(snapshot.bodies)]);
      return true;
    }
    const state = context.world.getState(), request = { op: 'initial', config: copy(context.config),
      sourceState: state, sourceRawHex: rawBodiesHex(state.bodies),
      negativeZeroPaths: { sourceState: negativeZeroPaths(state), commands: [], attempt: [], output: [] } };
    let reference;
    if (resumePrefix === null) {
      await save(context.name + '-initial-native', { request, snapshot: context.world.getTransactionSnapshot() }, [rawBodies(state.bodies)]);
      reference = await ask(request);
    } else {
      // A fresh runtime instance must reproduce the authenticated original constructor.
      assert.deepEqual(request, resumePrefix.I0);
      assert.deepEqual(context.world.getTransactionSnapshot(), resumePrefix.initialCheckpoint);
      assert.deepEqual(negativeZeroPaths(context.world.getTransactionSnapshot()), negativeZeroPaths(resumePrefix.initialCheckpoint));
      reference = validateReply(request, resumePrefix.initialReply);
    }
    const passed = reference.ok === true && reference.referenceStatus === 'RETURN';
    if (passed) { I0 = copy(request); initialCheckpoint = context.world.getTransactionSnapshot(); }
    await save(context.name + '-initial', { passed, nativeRecord: context.name + '-initial-native', reference });
    if (!passed && firstFailure === null) firstFailure = { name: context.name + '-initial', classification: 'PHYSICAL_NO_GO' };
    return passed;
  }
  async function physical(context, name, commands, expected = null) {
    const before = context.world.getTransactionSnapshot(), source = context.world.getState();
    const beforeRaw = rawBodiesHex(source.bodies), callbackStart = context.observer.attempts.length;
    counts.stepAttempts++;
    let output = null, error = null;
    try { const state = context.world.step(FIXED_DT, commands); output = { state, diagnostics: context.world.getDiagnostics() }; }
    catch (value) { error = known(value); if (error === null) throw value; }
    const reached = context.observer.attempts.slice(callbackStart);
    assert.equal(reached.length, 1, 'calculation must expose exactly one copied reached attempt');
    const attempt = reached[0];
    counts.calculationAttemptsObserved++;
    for (const key of Object.keys(counts.observedCalls)) counts.observedCalls[key] += attempt.calls[key];
    const after = context.world.getTransactionSnapshot();
    if (error !== null) retain(context, before, beforeRaw);
    const request = { op: 'world-step', config: copy(context.config), sourceState: source, dt: FIXED_DT,
      commands: copy(commands), commandsRawHex: angularCommandRawHex(commands), outcome: output === null ? 'refused' : 'returned',
      attempt, output, error, rawFrames: framesRawHex(attempt.frames),
      negativeZeroPaths: { sourceState: negativeZeroPaths(source), commands: negativeZeroPaths(commands),
        attempt: negativeZeroPaths(attempt), output: negativeZeroPaths(output) } };
    await save(name + '-native', { request, before, after, priorAcceptedRetained: error === null ? null : true,
      callbackCount: reached.length, actualCalls: copy(attempt.calls) },
      [rawBodies(source.bodies), ...Object.values(attempt.frames).filter(value => value !== null).map(rawBodies), rawBodies(after.bodies)]);
    const reference = await ask(request);
    let passed = reference.ok === true && ['RETURN', 'PRODUCER_REFUSAL'].includes(reference.referenceStatus);
    if (expected !== null) {
      assert.deepEqual(error, { name: 'PhysicsError', ...expected });
      passed = passed && reference.referenceStatus === 'PRODUCER_REFUSAL';
    }
    if (passed && context.name === 'W0' && source.stepIndex === 0 && commands.length === 0 && output !== null)
      S0 = copy(request);
    if (output !== null) { counts.acceptedSteps++; assert.equal(after.stepIndex, before.stepIndex + 1); }
    await save(name, { passed, classification: passed ? output === null ? 'QUALIFIED_REFUSAL' : 'QUALIFIED_RETURN' : 'PHYSICAL_NO_GO',
      nativeRecord: name + '-native', reference });
    if (!passed && firstFailure === null) firstFailure = { name, classification: 'PHYSICAL_NO_GO' };
    return { passed, returned: output !== null, output, attempt, reference };
  }
  async function setup(context) {
    if (!await initial(context)) return false;
    const result = await physical(context, context.name + '-setup', []);
    if (!result.passed || !result.returned) {
      if (firstFailure === null) firstFailure = { name: context.name + '-setup', classification: 'NO_QUALIFIED_ACCEPTED_CHECKPOINT' };
      await save(context.name + '-setup-unavailable', { passed: false, classification: 'NO_QUALIFIED_ACCEPTED_CHECKPOINT' });
      return false;
    }
    assert.equal(context.world.getState().stepIndex, 1);
    assert.notEqual(context.world.getDiagnostics(), null);
    assert.equal(context.world.getState().pairStats.eligiblePairs, 32);
    assert.equal(context.world.getState().pairStats.candidatePairs, 32);
    return true;
  }

  if (resumePrefix === null) {
  // P0: unchanged public admission refusal, no trajectory.
  counts.publicConstructors++;
  await save('public-HINGE2-admission', { passed: true, error: expectError(() => createOriginalWorld(makeWorldFixture()),
    'INVALID_CONFIG', 'dynamic pair supports one joint between two dynamic spheres'), callbacks: 0 });
  const ctorCases = [
    ['config-null', () => null, 'world must be an object'],
    ['config-extra', c => { c.extra = true; return c; }, 'world has an unsupported field'],
    ['mass-zero', c => { c.bodies[0].massKg = 0; return c; }, 'massKg must be finite and in [0.000001, 1000000]'],
    ['duplicate-id', c => { c.bodies[2].id = 'pairA0'; return c; }, 'duplicate body ID'],
    ['sparse-bodies', c => { delete c.bodies[0]; return c; }, PROFILE],
    ['sparse-joints', c => { delete c.joints[1]; return c; }, GROUP],
    ['body-order', c => { [c.bodies[0], c.bodies[1]] = [c.bodies[1], c.bodies[0]]; return c; }, PROFILE],
    ['joint-order', c => { c.joints.reverse(); return c; }, PROFILE],
    ['gravity', c => { c.gravityMps2 = [0, -9.81, 0]; return c; }, GROUP],
    ['mass-profile', c => { c.bodies[0].massKg = 2; return c; }, GROUP],
    ['inertia-presence', c => { c.bodies[0].inertiaKgM2 = .4 * .1 ** 2; return c; }, PROFILE],
    ['pair1-offset', c => { c.bodies[2].positionM[2] = 2; return c; }, GROUP],
    ['axis', c => { c.joints[1].axisWorld = [1, 0, 0]; return c; }, GROUP],
    ['motor', c => { c.joints[1].motor.targetSpeedRadps = .6; return c; }, GROUP],
    ['chain', c => { c.joints[1].aId = 'pairA0'; return c; }, GROUP],
  ];
  for (const [name, edit, message] of ctorCases) {
    let callbacks = 0; counts.privateConstructors++;
    const input = edit(makeWorldFixture());
    const error = expectError(() => createWorld(input, { observeAttempt: () => { callbacks++; } }), 'INVALID_CONFIG', message);
    assert.equal(callbacks, 0); await save('constructor-' + name, { passed: true, input, error, callbacks,
      bodyOwnKeys: Array.isArray(input?.bodies) ? Reflect.ownKeys(input.bodies).map(String) : null,
      jointOwnKeys: Array.isArray(input?.joints) ? Reflect.ownKeys(input.joints).map(String) : null });
  }
  for (const accessor of [false, true]) {
    let getterCalls = 0; counts.privateConstructors++;
    const options = accessor ? Object.defineProperty({}, 'observeAttempt', { enumerable: true, get() { getterCalls++; return () => {}; } }) : { extra: true };
    const error = expectError(() => createWorld(makeWorldFixture(), options), 'INVALID_CONFIG', OPTIONS);
    assert.equal(getterCalls, 0); await save('options-' + (accessor ? 'accessor' : 'extra'), { passed: true, error, getterCalls });
  }
  }

  const w0 = construct('W0', { mutate: true });
  assert.equal(w0.world.getDiagnostics(), null);
  const constructorState = w0.world.getTransactionSnapshot();
  if (resumePrefix === null) {
  const originalConfig = copy(w0.config);
  w0.config.bodies[0].positionM[0] = 99; w0.config.joints[0].motor.targetSpeedRadps = 99;
  assert.deepEqual(w0.world.getTransactionSnapshot(), constructorState);
  w0.config = originalConfig;
  await save('constructor-input-copy', { passed: true, snapshot: constructorState });
  } else {
    assert.deepEqual(constructorState, resumePrefix.initialCheckpoint);
    assert.deepEqual(w0.world.getState(), resumePrefix.I0.sourceState);
    assert.equal(rawBodiesHex(w0.world.getState().bodies), resumePrefix.I0.sourceRawHex);
    assert.deepEqual(w0.config, resumePrefix.I0.config);
    assert.deepEqual(negativeZeroPaths(w0.world.getState()), resumePrefix.I0.negativeZeroPaths.sourceState);
    assert.equal(w0.observer.attempts.length, 0);
  }
  if (await setup(w0)) {
    const checkpoint = w0.world.getTransactionSnapshot(), state = w0.world.getState(), raw = rawBodiesHex(state.bodies);
    const guards = [
      ['dt-first', 1 / 100, null, 'INVALID_STEP', 'step must equal configured fixedStepSeconds'],
      ['commands-null', FIXED_DT, null, 'INVALID_COMMAND', 'commands must be a dense array of at most 64'],
      ['commands-hole', FIXED_DT, new Array(1), 'INVALID_COMMAND', 'commands must be a dense array of at most 64'],
      ['command-missing-id', FIXED_DT, [{ kind: 'angularImpulse', angularImpulseNms: [0, 0, .001] }], 'INVALID_COMMAND', 'command 0 has unsupported fields'],
      ['command-duplicate', FIXED_DT, [angular('pairB1', .001), angular('pairB1', .001)], 'INVALID_COMMAND', 'duplicate angularImpulse command for pairB1'],
      ['command-unknown', FIXED_DT, [{ kind: 'force', bodyId: 'missing', forceN: [0, 0, 0] }], 'INVALID_COMMAND', 'command 0 targets an unknown or unsupported body'],
      ['linear-zero', FIXED_DT, [{ kind: 'impulse', bodyId: 'pairA1', impulseNs: [0, 0, 0] }], 'INVALID_COMMAND', 'dynamic hinge admits axis-aligned angular commands only'],
      ['angular-transverse', FIXED_DT, [{ kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [.001, 0, 0] }], 'INVALID_COMMAND', 'dynamic hinge admits axis-aligned angular commands only'],
    ];
    for (const [name, dt, commands, code, message] of guards) {
      const callbacks = w0.observer.attempts.length; counts.stepAttempts++;
      const error = expectError(() => w0.world.step(dt, commands), code, message);
      assert.equal(w0.observer.attempts.length, callbacks); retain(w0, checkpoint, raw);
      await save('W0-' + name, { passed: true, input: { dt, commands },
        commandOwnKeys: Array.isArray(commands) ? Reflect.ownKeys(commands).map(String) : null,
        error, callbackCount: 0, priorAcceptedRetained: true, checkpoint }, [rawBodies(state.bodies)]);
    }
    // Mutate every exposed data branch; fresh getters must preserve the exact accepted store.
    for (const value of [w0.world.getState(), w0.world.getDiagnostics(), w0.world.getTransactionSnapshot()]) mutateNumbers(value);
    retain(w0, checkpoint, raw);
    await save('W0-output-observer-copy', { passed: true, checkpoint, callbackCopyMutated: true }, [rawBodies(state.bodies)]);
    for (const group of [0, 1]) {
      counts.queryCalls++;
      const overlap = w0.world.overlapSphere({ centerM: [0, 0, group], radiusM: .2 });
      assert.deepEqual(overlap, [`pairA${group}`, `pairB${group}`]);
      overlap[0] = 'changed'; retain(w0, checkpoint, raw);
      await save('overlap-' + group, { passed: true, ids: [`pairA${group}`, `pairB${group}`] });
      counts.queryCalls++;
      const hit = w0.world.raycast({ originM: [-2, 0, group], direction: [1, 0, 0], maxDistanceM: 4 });
      // Independent scalar sphere-ray calculation from accepted public state.
      const expected = independentSphereRay(state.bodies, [-2, 0, group], [1, 0, 0], 4);
      assert.deepEqual(hit, expected); assert.equal(hit.bodyId, `pairA${group}`);
      const saved = copy(hit); hit.distanceM = -1; retain(w0, checkpoint, raw);
      await save('ray-' + group, { passed: true, hit: saved, expected });
    }
    const queries = [
      ['query-object', () => w0.world.overlapSphere(null), 'query must be a plain object'],
      ['query-radius', () => w0.world.overlapSphere({ centerM: [0, 0, 0], radiusM: 0 }), 'radiusM must be finite and in [0.0001, 1000]'],
      ['query-direction', () => w0.world.raycast({ originM: [0, 0, 0], direction: [1, 1, 0], maxDistanceM: 4 }), 'direction must be a unit 3-vector'],
    ];
    for (const [name, call, message] of queries) {
      const callbacks = w0.observer.attempts.length; counts.queryCalls++;
      const error = expectError(call, 'INVALID_QUERY', message); retain(w0, checkpoint, raw);
      assert.equal(w0.observer.attempts.length, callbacks); await save(name, { passed: true, error, callbackCount: 0, priorAcceptedRetained: true });
    }
  }
  counts.disposeCalls += 2; w0.world.dispose(); w0.world.dispose();
  for (const [name, call] of [
    ['state', () => w0.world.getState()], ['step', () => { counts.stepAttempts++; return w0.world.step(1 / 100, null); }],
    ['overlap', () => { counts.queryCalls++; return w0.world.overlapSphere(null); }], ['ray', () => { counts.queryCalls++; return w0.world.raycast(null); }],
    ['diagnostics', () => w0.world.getDiagnostics()], ['snapshot', () => w0.world.getTransactionSnapshot()],
  ]) {
    const callbacks = w0.observer.attempts.length;
    const error = expectError(call, 'DISPOSED', 'world is disposed');
    assert.equal(w0.observer.attempts.length, callbacks); await save('disposed-' + name, { passed: true, error, callbackCount: 0 });
  }
  for (const bodyId of ['pairA0', 'pairB0', 'pairA1', 'pairB1']) {
    const context = construct('routing-' + bodyId);
    if (await initial(context)) await physical(context, context.name, [angular(bodyId, .001)]);
  }
  const combined = construct('combined');
  if (await initial(combined)) await physical(combined, 'combined', [
    { kind: 'torque', bodyId: 'pairB1', torqueNm: [0, 0, .001] }, angular('pairB1', .001),
  ]);
  const late = construct('late');
  if (await setup(late)) {
    const result = await physical(late, 'late-angular-movement', [angular('pairB1', 100000)],
      { code: 'NUMERIC_LIMIT', message: 'pairB1 exceeded angular movement limit' });
    if (result.passed) await physical(late, 'late-empty-recovery', []);
  }
  for (const bodyId of ['pairB0', 'pairB1']) {
    const context = construct('overload-' + bodyId);
    if (await setup(context)) await physical(context, context.name, [angular(bodyId, .1)]);
  }
  for (const [label, marker] of [['Error', new Error('1179-world-observer-marker')], ['object', { marker: '1179-world-observer-marker' }], ['null', null]]) {
    const mode = { enabled: false, value: marker }, context = construct('observer-' + label, mode);
    if (!await setup(context)) continue;
    const before = context.world.getTransactionSnapshot(), beforeRaw = rawBodiesHex(context.world.getState().bodies);
    const callbackStart = context.observer.attempts.length;
    mode.enabled = true; counts.stepAttempts++;
    let caught = false, received;
    try { context.world.step(FIXED_DT, []); } catch (value) { caught = true; received = value; }
    assert.equal(caught, true); assert.equal(received, marker);
    const reached = context.observer.attempts.slice(callbackStart);
    assert.equal(reached.length, 1); retain(context, before, beforeRaw);
    counts.calculationAttemptsObserved++;
    for (const key of Object.keys(counts.observedCalls)) counts.observedCalls[key] += reached[0].calls[key];
    await save(context.name + '-identity', { passed: true, unknownIdentityPreserved: true, markerKind: label,
      callbackCount: 1, priorAcceptedRetained: true, before, after: context.world.getTransactionSnapshot(),
      actualAttempt: reached[0], actualCalls: reached[0].calls, referenceRequests: 0 }, [rawBodies(before.bodies)]);
  }
  const actualCounts = copy(counts), logicalCounts = copy(counts);
  const historicalCounts = resumePrefix === null ? null : copy(resumePrefix.historicalCounts);
  const recoveryCounts = { publicConstructors: 0, privateConstructors: resumePrefix === null ? 0 : 1, referenceRequests: 0 };
  const combinedActualCounts = copy(actualCounts);
  if (resumePrefix !== null) {
    logicalCounts.publicConstructors += 1;
    // Seventeen old rejected private constructors plus the current logical W0 instance.
    logicalCounts.privateConstructors += 17;
    logicalCounts.referenceRequests += 1;
    combinedActualCounts.publicConstructors += historicalCounts.publicConstructors;
    combinedActualCounts.privateConstructors += historicalCounts.privateConstructors;
    combinedActualCounts.referenceRequests += historicalCounts.failedInitialRequests + historicalCounts.completedInitialRequests;
  }
  assert.equal(logicalCounts.publicConstructors, 1); assert.equal(logicalCounts.privateConstructors, 29);
  assert.equal(actualCounts.publicConstructors, resumePrefix === null ? 1 : 0);
  assert.equal(actualCounts.privateConstructors, resumePrefix === null ? 29 : 12);
  assert.ok(counts.stepAttempts <= 28);
  return { passed: firstFailure === null, firstFailure, counts: logicalCounts, receipts,
    actualCounts, historicalCounts, recoveryCounts, combinedActualCounts,
    reusedPrefix: resumePrefix === null ? null : { records: 20, initialReplyReused: true,
      originalFailedInitialRetained: true, sourceRecordsWrittenAgain: false },
    I0, S0, initialCheckpoint,
    declaredPopulation: { publicConstructors: 1, privateConstructors: 29, maximumSteps: 28 },
    includesUnobservedInternalCalls: false, nonemptyCacheRollbackClaimed: false, stepLimitReachedClaimed: false };
}

function mutateNumbers(value) {
  if (value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (typeof value[key] === 'number') value[key] = value[key] + 1;
    else mutateNumbers(value[key]);
  }
}
function independentSphereRay(bodies, origin, direction, limit) {
  let best = null;
  for (const body of bodies) {
    const offset = origin.map((value, index) => value - body.positionM[index]);
    const c = offset.reduce((sum, value, index) => sum + value * offset[index], 0) - body.shape.radiusM ** 2;
    const projection = offset.reduce((sum, value, index) => sum + value * direction[index], 0);
    const discriminant = projection ** 2 - c;
    const distance = c <= 0 ? 0 : projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
    if (distance === null || distance > limit) continue;
    if (best === null || distance < best.distanceM || distance === best.distanceM && body.id < best.bodyId) best = { bodyId: body.id, distanceM: distance };
  }
  return best;
}
