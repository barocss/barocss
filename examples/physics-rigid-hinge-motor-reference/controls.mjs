import assert from 'node:assert/strict';
import {fixture, restInput, providerProvenance} from './fixtures.mjs';
import {rawBodies, rawCommands, rawEvidence, framesToRaw, digest} from './raw.mjs';

const DT_MESSAGE = 'private hinge velocity step must equal 1/120';
const PROFILE = 'private hinge velocity profile is unsupported';
const POSE = 'private hinge velocity archived pose is invalid';
const COMMAND_ARRAY = 'commands must be a dense array of at most 64';
const COMMAND_FIELDS = 'command 0 has unsupported fields';
const COMMAND_TARGET = 'command 0 targets an unknown or unsupported body';
const COMMAND_AXIS = 'dynamic hinge admits axis-aligned angular commands only';
const OPTIONS = 'private hinge motor options are invalid';
const REACTION = 'unsafe joint reaction';

// These mutations are authored source, not executed during module import.
export const admissionCases = [
  ['dt-first', x => {x.dt = 1 / 100; x.config = null; x.commands = null;}, 'INVALID_STEP', DT_MESSAGE],
  ['null-config', x => {x.config = null;}, 'INVALID_CONFIG', 'world must be an object'],
  ['config-extra-key', x => {x.config.extra = 0;}, 'INVALID_CONFIG', 'world has an unsupported field'],
  ['zero-mass', x => {x.config.bodies[0].massKg = 0;}, 'INVALID_CONFIG', 'massKg must be finite and in [0.000001, 1000000]'],
  ['wrong-mass', x => {x.config.bodies[0].massKg = 2;}, 'INVALID_CONFIG', PROFILE],
  ['explicit-inertia', x => {x.config.bodies[0].inertiaKgM2 = .004;}, 'INVALID_CONFIG', PROFILE],
  ['nonzero-gravity', x => {x.config.gravityMps2 = [0, -9.81, 0];}, 'INVALID_CONFIG', PROFILE],
  ['different-material', x => {x.config.bodies[0].friction.dynamic = .6;}, 'INVALID_CONFIG', PROFILE],
  ['different-axis', x => {x.config.joints[0].axisWorld = [1, 0, 0];}, 'INVALID_CONFIG', PROFILE],
  ['profile-before-command', x => {x.config.bodies[0].massKg = 2; x.commands = null;}, 'INVALID_CONFIG', PROFILE],
  ['sparse-config-body', x => {delete x.config.bodies[0];}, 'INVALID_CONFIG', PROFILE],
  ['sparse-config-joint', x => {delete x.config.joints[0];}, 'INVALID_CONFIG', 'joints must be a dense array of at most 8'],
  ['null-carrier', x => {x.carrier = null;}, 'NUMERIC_LIMIT', POSE],
  ['null-remembered-angle', x => {x.carrier.joints[0].angleRad = null;}, 'NUMERIC_LIMIT', POSE],
  ['NaN-remembered-angle', x => {x.carrier.joints[0].angleRad = NaN;}, 'NUMERIC_LIMIT', POSE],
  ['infinite-remembered-angle', x => {x.carrier.joints[0].angleRad = Infinity;}, 'NUMERIC_LIMIT', POSE],
  ['undefined-remembered-angle', x => {x.carrier.joints[0].angleRad = undefined;}, 'NUMERIC_LIMIT', POSE],
  ['negative-cursor', x => {x.carrier.stepIndex = -1;}, 'NUMERIC_LIMIT', POSE],
  ['cursor-above3600', x => {x.carrier.stepIndex = 3601; x.carrier.timeSeconds = 3601 / 120;}, 'NUMERIC_LIMIT', POSE],
  ['time-does-not-match-cursor', x => {x.carrier.timeSeconds = .1;}, 'NUMERIC_LIMIT', POSE],
  ['sparse-carrier-body', x => {delete x.carrier.bodies[0];}, 'NUMERIC_LIMIT', POSE],
  ['sparse-carrier-joint', x => {delete x.carrier.joints[0];}, 'NUMERIC_LIMIT', POSE],
  ['wrong-carrier-body-id', x => {x.carrier.bodies[0].id = 'missing';}, 'NUMERIC_LIMIT', POSE],
  ['null-raw-component', x => {x.carrier.bodies[0].positionM[0] = null;}, 'NUMERIC_LIMIT', POSE],
  ['nonfinite-raw-component', x => {x.carrier.bodies[0].velocityMps[0] = Infinity;}, 'NUMERIC_LIMIT', POSE],
  ['sparse-raw-vector', x => {delete x.carrier.bodies[0].velocityMps[0];}, 'NUMERIC_LIMIT', POSE],
  ['zero-quaternion', x => {x.carrier.bodies[0].orientation = [0, 0, 0, 0];}, 'NUMERIC_LIMIT', POSE],
  ['null-commands', x => {x.commands = null;}, 'INVALID_COMMAND', COMMAND_ARRAY],
  ['sparse-commands', x => {x.commands = new Array(1);}, 'INVALID_COMMAND', COMMAND_ARRAY],
  ['commands-extra-array-key', x => {x.commands.extra = 0;}, 'INVALID_COMMAND', COMMAND_ARRAY],
  ['65-commands', x => {x.commands = Array(65).fill(null);}, 'INVALID_COMMAND', COMMAND_ARRAY],
  ['null-command', x => {x.commands = [null];}, 'INVALID_COMMAND', 'command 0 must be a plain object'],
  ['unsupported-command', x => {x.commands = [{kind: 'wrong', bodyId: 'pairB0', angularImpulseNms: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_FIELDS],
  ['command-extra-key', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, 0, 0], extra: 0}];}, 'INVALID_COMMAND', COMMAND_FIELDS],
  ['command-missing-bodyId', x => {x.commands = [{kind: 'angularImpulse', angularImpulseNms: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_FIELDS],
  ['command-absent-target', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'absent', angularImpulseNms: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_TARGET],
  ['command-null-target', x => {x.commands = [{kind: 'angularImpulse', bodyId: null, angularImpulseNms: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_TARGET],
  ['duplicate-angular-command', x => {x.commands = [0, 1].map(() => ({kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, 0, .001]}));}, 'INVALID_COMMAND', 'duplicate angularImpulse command for pairB0'],
  ['zero-linear-force', x => {x.commands = [{kind: 'force', bodyId: 'pairB0', forceN: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_AXIS],
  ['zero-linear-impulse', x => {x.commands = [{kind: 'impulse', bodyId: 'pairB0', impulseNs: [0, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_AXIS],
  ['perpendicular-angular-command', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [.001, 0, 0]}];}, 'INVALID_COMMAND', COMMAND_AXIS],
  ['short-command-vector', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, 0]}];}, 'INVALID_COMMAND', 'command 0.angularImpulseNms must be a dense 3-vector'],
  ['sparse-command-vector', x => {const v = [0, 0, 0]; delete v[1]; x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: v}];}, 'INVALID_COMMAND', 'command 0.angularImpulseNms must be a dense 3-vector'],
  ['null-command-component', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, null, 0]}];}, 'INVALID_COMMAND', 'command 0.angularImpulseNms must have finite components within ±100000'],
  ['NaN-command-component', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, NaN, 0]}];}, 'INVALID_COMMAND', 'command 0.angularImpulseNms must have finite components within ±100000'],
  ['command-over-original-bound', x => {x.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [0, 0, 100001]}];}, 'INVALID_COMMAND', 'command 0.angularImpulseNms must have finite components within ±100000'],
];

function typed(m, action, code, message, name) {
  assert.throws(action, error => error instanceof m.PhysicsError &&
    error.code === code && error.message === message, name);
}

function identityThrow(action, marker, name) {
  let caught = false;
  try {action();} catch (thrown) {caught = true; assert.equal(thrown, marker, name);}
  assert.equal(caught, true, name);
}

function markers(prefix) {
  return [['error', new Error(prefix)], ['object', {marker: prefix}], ['null', null], ['string', prefix]];
}

export async function runControls(m, {writeRecord, genuineBeforeRaw} = {}) {
  assert.ok(Buffer.isBuffer(genuineBeforeRaw) && genuineBeforeRaw.length === 208,
    'authenticated genuine-before buffer is required');
  assert.deepEqual(rawBodies(fixture('genuine-orbital').carrier.bodies), genuineBeforeRaw,
    'genuine literal matches authenticated BEFORE, not old AFTER');
  assert.equal(digest(genuineBeforeRaw), providerProvenance.genuineRawSha256);
  const receipts = [];
  const counts = {candidateCalls: 0, motorCalls: 0, projectionCalls: 0,
    parentPreparationCalls: 0, commandParserCalls: 0, angularAdmissionCalls: 0,
    helperMotorCalls: 0, reportValidationCalls: 0, capGuardCalls: 0,
    observerCalls: 0, acceptedOutputs: 0, knownCandidateRefusals: 0, unknownIdentityChecks: 0};
  const emit = async record => {receipts.push(record); if (writeRecord) await writeRecord({kind: 'native-control', ...record}, []);};

  function invoke(input, {options, observer} = {}) {
    const capture = {attempt: null, callbackCount: 0, output: null};
    const privateOptions = options === undefined ? {observeAttempt(attempt) {
      capture.callbackCount++; counts.observerCalls++;
      capture.attempt = structuredClone(attempt);
      if (observer) observer(attempt);
    }} : options;
    counts.candidateCalls++;
    try {
      capture.output = m.advanceDrivenHingePairReference(input.config, input.carrier,
        input.dt, input.commands, privateOptions);
      counts.acceptedOutputs++;
      return capture;
    } finally {
      const calls = capture.attempt?.calls ?? capture.output?.diagnostics.calls;
      if (calls) {counts.motorCalls += calls.motorCalls; counts.projectionCalls += calls.projectionCalls;}
      assert.ok(capture.callbackCount <= 1, 'maximum one actual callback');
      // The capture belongs to this control; no unknown thrown payload is stored.
      invoke.last = capture;
    }
  }

  for (const [name, edit, code, message] of admissionCases) {
    const input = restInput(); edit(input); const saved = structuredClone(input);
    typed(m, () => invoke(input), code, message, name);
    assert.deepEqual(input, saved, name + ' caller retained');
    assert.equal(invoke.last.callbackCount, 0, name + ' callback0');
    counts.knownCandidateRefusals++;
    await emit({name, category: 'admission', code, message, callbackCount: 0,
      lawCalls: {motorCalls: 0, projectionCalls: 0}, inputRetained: true});
  }

  for (const field of ['kind', 'bodyId', 'angularImpulseNms']) {
    const input = fixture('angular-impulse-B'); let reads = 0;
    Object.defineProperty(input.commands[0], field, {enumerable: true,
      get() {reads++; throw new Error('command accessor must not run');}});
    typed(m, () => invoke(input), 'INVALID_COMMAND', COMMAND_FIELDS, 'command accessor ' + field);
    assert.equal(reads, 0); assert.equal(invoke.last.callbackCount, 0); counts.knownCandidateRefusals++;
    await emit({name: 'command-accessor-' + field, category: 'descriptor', code: 'INVALID_COMMAND',
      message: COMMAND_FIELDS, getterReads: reads, callbackCount: 0, lawCalls: {motorCalls: 0, projectionCalls: 0}});
  }
  {
    const input = restInput(); let reads = 0;
    Object.defineProperty(input.carrier.joints[0], 'angleRad', {enumerable: true,
      get() {reads++; throw new Error('carrier record accessor must not run');}});
    typed(m, () => invoke(input), 'NUMERIC_LIMIT', POSE, 'carrier angle accessor');
    assert.equal(reads, 0); assert.equal(invoke.last.callbackCount, 0); counts.knownCandidateRefusals++;
    await emit({name: 'carrier-record-accessor', category: 'descriptor', code: 'NUMERIC_LIMIT',
      message: POSE, getterReads: reads, callbackCount: 0, lawCalls: {motorCalls: 0, projectionCalls: 0}});
  }

  const optionCases = [
    ['null', () => null], ['array', () => []], ['extra', () => ({extra: 0})],
    ['own-undefined', () => ({observeAttempt: undefined})], ['own-null', () => ({observeAttempt: null})],
    ['symbol', () => ({[Symbol('extra')]: 0})],
    ['nonenumerable', () => Object.defineProperty({}, 'observeAttempt', {value() {}, enumerable: false})],
  ];
  for (const [name, make] of optionCases) {
    typed(m, () => invoke(restInput(), {options: make()}), 'INVALID_CONFIG', OPTIONS, name);
    assert.equal(invoke.last.callbackCount, 0); counts.knownCandidateRefusals++;
    await emit({name: 'options-' + name, category: 'options', code: 'INVALID_CONFIG', message: OPTIONS,
      callbackCount: 0, lawCalls: {motorCalls: 0, projectionCalls: 0}});
  }
  {
    let reads = 0;
    const options = Object.defineProperty({}, 'observeAttempt', {enumerable: true,
      get() {reads++; throw new Error('option getter must not run');}});
    typed(m, () => invoke(restInput(), {options}), 'INVALID_CONFIG', OPTIONS, 'options accessor');
    assert.equal(reads, 0); counts.knownCandidateRefusals++;
    await emit({name: 'options-accessor', category: 'options', getterReads: 0, code: 'INVALID_CONFIG',
      message: OPTIONS, callbackCount: 0, lawCalls: {motorCalls: 0, projectionCalls: 0}});
  }

  for (const [kind, marker] of markers('1179-config-marker')) {
    const input = restInput(), before = rawBodies(input.carrier.bodies);
    Object.defineProperty(input.config, 'fixedStepSeconds', {enumerable: true, get() {throw marker;}});
    identityThrow(() => invoke(input), marker, 'original config getter ' + kind);
    assert.deepEqual(rawBodies(input.carrier.bodies), before); assert.equal(invoke.last.callbackCount, 0);
    counts.unknownIdentityChecks++;
    await emit({name: 'config-getter-' + kind, category: 'ordinary-unknown-identity', identicalThrown: true,
      callbackCount: 0, inputRaw: rawEvidence(before), inheritedTypedProxyGuaranteeClaimed: false});
  }
  for (const [kind, marker] of markers('1179-reflection-marker')) {
    const input = restInput();
    input.config = new Proxy(input.config, {ownKeys() {throw marker;}});
    identityThrow(() => invoke(input), marker, 'reflection ' + kind);
    assert.equal(invoke.last.callbackCount, 0); counts.unknownIdentityChecks++;
    await emit({name: 'config-ownKeys-' + kind, category: 'ordinary-unknown-identity', identicalThrown: true,
      callbackCount: 0, inheritedTypedProxyGuaranteeClaimed: false});
  }
  for (const [kind, marker] of markers('1179-options-reflection-marker')) {
    const options = new Proxy({}, {ownKeys() {throw marker;}});
    identityThrow(() => invoke(restInput(), {options}), marker, 'options reflection ' + kind);
    assert.equal(invoke.last.callbackCount, 0); counts.unknownIdentityChecks++;
    await emit({name: 'options-ownKeys-' + kind, category: 'ordinary-unknown-identity', identicalThrown: true,
      callbackCount: 0, inheritedTypedProxyGuaranteeClaimed: false});
  }
  for (const [kind, marker] of markers('1179-command-reflection-marker')) {
    const input = fixture('angular-impulse-B');
    input.commands[0] = new Proxy(input.commands[0], {getOwnPropertyDescriptor() {throw marker;}});
    identityThrow(() => invoke(input), marker, 'command descriptor reflection ' + kind);
    assert.equal(invoke.last.callbackCount, 0); counts.unknownIdentityChecks++;
    await emit({name: 'command-descriptor-' + kind, category: 'ordinary-unknown-identity', identicalThrown: true,
      callbackCount: 0, inheritedTypedProxyGuaranteeClaimed: false});
  }
  {
    const input = restInput(); input.commands = null;
    let reads = 0;
    const options = Object.defineProperty({}, 'observeAttempt', {enumerable: true, get() {reads++; throw new Error('options must come after commands');}});
    typed(m, () => invoke(input, {options}), 'INVALID_COMMAND', COMMAND_ARRAY, 'commands before options');
    assert.equal(reads, 0); counts.knownCandidateRefusals++;
    await emit({name: 'commands-before-options', category: 'priority', code: 'INVALID_COMMAND', message: COMMAND_ARRAY,
      optionGetterReads: 0, callbackCount: 0, lawCalls: {motorCalls: 0, projectionCalls: 0}});
  }

  // Honest helper controls: no adopted projection, no hidden staged case15/16.
  for (const [angle, blocked] of [[.9, true], [-.9, false]]) {
    const input = restInput(); input.carrier.joints[0].angleRad = angle;
    const saved = structuredClone(input), before = rawBodies(input.carrier.bodies);
    counts.parentPreparationCalls++;
    const prepared = m.prepareInput(input.config, input.carrier, input.dt);
    assert.equal(prepared.carrier.joints[0].angleRad, angle);
    counts.helperMotorCalls++;
    const j = m.driveDynamicHingeMotor(prepared.joint, prepared.bodies[0], prepared.bodies[1], angle);
    assert.equal(j === 0, blocked); assert.deepEqual(input, saved); assert.deepEqual(rawBodies(input.carrier.bodies), before);
    await emit({name: angle > 0 ? 'memory-plus.9-helper' : 'memory-minus.9-helper', category: 'parent-and-motor-helper',
      inputAngleRad: angle, expectedBlocked: blocked, motorImpulseNms: j,
      originalMotorCalls: 1, projectionCalls: 0, stagedCase: false, inputRetained: true,
      inputRaw: rawEvidence(before), helperBodiesRaw: rawEvidence(rawBodies(prepared.bodies))});
  }
  for (const [name, perpendicular, refuses] of [
    ['perpendicular-equality-helper', 1e-12, false],
    ['perpendicular-above-helper', 1.0000000000000002e-12, true],
  ]) {
    const input = restInput();
    input.commands = [{kind: 'angularImpulse', bodyId: 'pairB0', angularImpulseNms: [perpendicular, 0, 0]}];
    counts.parentPreparationCalls++; const prepared = m.prepareInput(input.config, input.carrier, input.dt);
    counts.commandParserCalls++; const actions = m.parseCommands(input.commands, prepared.bodies);
    counts.angularAdmissionCalls++;
    if (refuses) typed(m, () => m.admitDynamicHingeCommands(prepared.joint, prepared.bodies, actions), 'INVALID_COMMAND', COMMAND_AXIS, name);
    else m.admitDynamicHingeCommands(prepared.joint, prepared.bodies, actions);
    await emit({name, category: 'angular-admission-helper', refuses, projectionCalls: 0, originalMotorCalls: 0,
      commandRaw: rawEvidence(rawCommands(input.commands)), stagedCase: false});
  }

  const reportIdentity = {id: 'hinge0', aId: 'pairA0', bId: 'pairB0'};
  const report = () => ({...reportIdentity, kind: 'hinge', angleRad: -.2,
    linearImpulseNs: [100, -100, 0], angularImpulseNms: [0, 0, .01], motorImpulseNms: -.0001});
  counts.reportValidationCalls++;
  const originalReport = report(), checked = m.validateHingeMotorReport(originalReport, reportIdentity);
  assert.deepEqual(checked, originalReport); checked.linearImpulseNs[0] = 999;
  assert.equal(originalReport.linearImpulseNs[0], 100);
  await emit({name: 'finite-report-and-no-linear-cap', category: 'pure-report-data', negativeSignedValuesAccepted: true,
    reportCopyDetached: true, motorCalls: 0, projectionCalls: 0});
  const reportEdits = [
    ['extra', r => {r.extra = 0;}], ['missing-angle', r => {delete r.angleRad;}],
    ['NaN-j', r => {r.motorImpulseNms = NaN;}], ['null-J', r => {r.linearImpulseNs[0] = null;}],
    ['infinite-K', r => {r.angularImpulseNms[1] = Infinity;}],
    ['sparse-J', r => {delete r.linearImpulseNs[1];}], ['wrong-id', r => {r.id = 'hinge1';}],
  ];
  for (const [name, edit] of reportEdits) {
    const value = report(); edit(value); const saved = structuredClone(value); counts.reportValidationCalls++;
    typed(m, () => m.validateHingeMotorReport(value, reportIdentity), 'NUMERIC_LIMIT', REACTION, name);
    assert.deepEqual(value, saved);
    await emit({name: 'report-' + name, category: 'pure-report-data', code: 'NUMERIC_LIMIT', message: REACTION,
      motorCalls: 0, projectionCalls: 0, inputRetained: true});
  }
  for (const [name, vector, expectedMessage] of [
    ['positive-equality', [0, 0, .01], null], ['negative-equality', [0, 0, -.01], null],
    ['strict-greater', [0, 0, .010000000000000002], 'hinge0 exceeded motor reaction limit'],
    ['NaN', [0, NaN, 0], REACTION], ['short', [0, 0], REACTION],
  ]) {
    const saved = structuredClone(vector); counts.capGuardCalls++;
    if (expectedMessage) typed(m, () => m.enforceHingeMotorReactionCap('hinge0', vector), 'NUMERIC_LIMIT', expectedMessage, name);
    else m.enforceHingeMotorReactionCap('hinge0', vector);
    assert.deepEqual(vector, saved);
    await emit({name: 'cap-' + name, category: 'pure-cap-data', passedEquality: expectedMessage === null,
      expectedMessage, motorCalls: 0, projectionCalls: 0, inputRetained: true});
  }

  // Actual bounded stage failures; no solver/result injection.
  for (const [name, edit, message, stage, projectionCalls] of [
    ['angular-movement', x => {x.carrier.bodies[0].angularVelocityRadps = [1000, 1000, 0];},
      'pairA0 exceeded angular movement limit', 'motor-ready', 0],
    ['step-displacement', x => {x.carrier.bodies[0].velocityMps = [1000, 1000, 0];},
      'pairA0 exceeded step displacement limit', 'motor-ready', 0],
    ['free-parent-bounds', x => {for (const body of x.carrier.bodies) {body.positionM = [10000, 0, 0]; body.velocityMps = [1, 0, 0];}},
      POSE, 'free-ready', 1],
  ]) {
    const input = restInput(); edit(input); const saved = structuredClone(input);
    typed(m, () => invoke(input), 'NUMERIC_LIMIT', message, name);
    const a = invoke.last.attempt;
    assert.equal(invoke.last.callbackCount, 1); assert.equal(a.stage, stage);
    assert.deepEqual(a.calls, {motorCalls: 1, projectionCalls});
    assert.equal(a.projection, null); assert.equal(a.jointReport, null); assert.equal(a.reportCap, null);
    assert.equal(a.frames.projectedBodies, null); assert.deepEqual(input, saved); counts.knownCandidateRefusals++;
    await emit({name: 'late-' + name, category: 'actual-stage-refusal', code: 'NUMERIC_LIMIT', message,
      attempt: a, callbackCount: 1, lawCalls: a.calls,
      rawFrames: Object.fromEntries(Object.entries(framesToRaw(a.frames)).map(([key, value]) => [key, rawEvidence(value)])),
      inputRetained: true});
  }

  for (const fixtureName of ['rest', 'genuine-orbital']) {
    for (const [kind, marker] of markers('1179-observer-marker')) {
      const input = fixture(fixtureName), saved = structuredClone(input);
      identityThrow(() => invoke(input, {observer() {throw marker;}}), marker, 'observer ' + fixtureName + '/' + kind);
      const a = invoke.last.attempt;
      assert.equal(invoke.last.callbackCount, 1); assert.equal(a.stage, 'report-ready');
      assert.equal(a.error, null); assert.deepEqual(a.calls, {motorCalls: 1, projectionCalls: 1});
      if (fixtureName === 'genuine-orbital') assert.equal(a.reportCap.exceedsCap, true);
      assert.deepEqual(input, saved); counts.unknownIdentityChecks++;
      await emit({name: 'observer-' + fixtureName + '-' + kind, category: 'actual-observer-identity',
        identicalThrown: true, callbackCount: 1, attempt: a, lawCalls: a.calls,
        capNotEnforcedAfterObserverThrow: true, inputRetained: true,
        rawFrames: Object.fromEntries(Object.entries(framesToRaw(a.frames)).map(([key, value]) => [key, rawEvidence(value)]))});
    }
  }

  {
    const input = restInput(); input.commands = undefined;
    const saved = structuredClone(input);
    const captured = invoke(input, {options: Object.create(null)});
    assert.equal(captured.callbackCount, 0);
    assert.deepEqual(captured.output.diagnostics.calls, {motorCalls: 1, projectionCalls: 1});
    assert.deepEqual(input, saved);
    await emit({name: 'omitted-command-empty-null-prototype-options', category: 'actual-defaults',
      output: structuredClone(captured.output), callbackCount: 0,
      lawCalls: captured.output.diagnostics.calls, inputRetained: true});
  }
  {
    const input = restInput(), saved = structuredClone(input);
    const captured = invoke(input, {observer(a) {
      a.frames.sourceBodies[0].positionM[0] = 777;
      a.frames.angularBodies[0].angularVelocityRadps[0] = 777;
      a.frames.motorBodies[1].velocityMps[0] = 777;
      a.frames.freeBodies[0].orientation[0] = 777;
      a.frames.projectedBodies[1].positionM[0] = 777;
      a.parsedActions[0].bodyId = 'changed'; a.jointReport.linearImpulseNs[0] = 777;
      a.projection.diagnostics.projection.physicalA[0][0] = 777;
      a.projection.diagnostics.projection.result.certificate.primal = 777;
    }});
    const output = captured.output, pristine = structuredClone(output), a = captured.attempt;
    const attemptSaved = structuredClone(a);
    assert.equal(captured.callbackCount, 1); assert.deepEqual(output.diagnostics.frames, a.frames);
    assert.deepEqual(output.jointReport, a.jointReport); assert.deepEqual(output.diagnostics.projection, a.projection);
    const before = rawBodies(input.carrier.bodies);
    output.bodies[0].positionM[0] = 999;
    output.jointReport.linearImpulseNs[0] = 999;
    output.diagnostics.frames.freeBodies[0].velocityMps[0] = 999;
    output.diagnostics.projection.bodies[0].orientation[0] = 999;
    assert.deepEqual(output.diagnostics.frames.projectedBodies, pristine.diagnostics.frames.projectedBodies);
    assert.deepEqual(output.diagnostics.bodyCorrections, pristine.diagnostics.bodyCorrections);
    assert.deepEqual(output.diagnostics.projection.diagnostics, pristine.diagnostics.projection.diagnostics);
    assert.deepEqual(captured.attempt, attemptSaved); assert.deepEqual(input, saved);
    assert.deepEqual(rawBodies(input.carrier.bodies), before);
    await emit({name: 'observer-and-return-copy', category: 'actual-copy', attempt: a,
      callbackCount: 1, lawCalls: a.calls, actualOutputBeforeMutation: pristine,
      callerRetained: true, observerDetached: true, returnedBranchesDetached: true});
  }

  // The source zeros themselves are literal inputs, not computed expectations.
  const zero = fixture('rest-signed-zero');
  assert.ok(Object.is(zero.carrier.bodies[0].velocityMps[1], -0));
  assert.ok(Object.is(zero.carrier.bodies[1].angularVelocityRadps[0], -0));
  await emit({name: 'literal-raw-zero-witness', category: 'raw-data',
    sourceRaw: rawEvidence(rawBodies(zero.carrier.bodies)), commandsRaw: rawEvidence(rawCommands(zero.commands)),
    candidateCalls: 0, motorCalls: 0, projectionCalls: 0});

  return {receipts, counts, countScope: {motorCalls: 'candidate-only', projectionCalls: 'candidate-only',
    helperMotorCalls: 'direct-original-helper', parentPreparationCalls: 'direct-helper-only',
    internalParentPreparationCallsIncluded: false}, worldCreated: false, worldStepped: false,
    physicalSolverInjected: false, parent93Replayed: false,
    inheritedTypedProxyGuaranteeClaimed: false};
}
