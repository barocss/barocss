/** DATA-only gate reader and explicit P0-to-original state correspondence. */
import { createHash } from 'node:crypto';
import { qualifyReply } from '../physics-rigid-hinge-velocity-world-reference/reference-reply.mjs';
import { worldQuality } from '../physics-rigid-hinge-velocity-world-reference/world-quality.mjs';
import { rawBodiesHex } from '../physics-rigid-hinge-velocity-world-reference/raw-codec.mjs';
import { restoreNegativeZeroPaths } from '../physics-public-disjoint-hinge-reference/variants.mjs';
import { ORIGINAL_BODY_IDS, ORIGINAL_JOINT_IDS, RENAME_BODY_IDS, RENAME_JOINT_IDS } from './fixture.mjs';

const PHASES = ['source', 'angular', 'motor', 'free', 'postContact', 'projected'];
const FRAME_NAMES = ['sourceBodies', 'angularBodies', 'motorBodies', 'freeBodies', 'postContactBodies', 'projectedBodies'];
const NATIVE_HEAD = 'f40123da0eedb19245688557f865e1beb09d47ef';
const bits = value => { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); return bytes.toString('hex'); };
const hash = value => createHash('sha256').update(value).digest('hex');
function need(value, message) { if (!value) throw new Error('P3 comparison input: ' + message); }
function encoding(value) {
  if (typeof value === 'number') { need(Number.isFinite(value), 'nonfinite number'); return ['f64le', bits(value)]; }
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(encoding);
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, encoding(value[key])]));
}
const fingerprint = value => hash(JSON.stringify(encoding(value)));

/** First exact difference, including IEEE binary64 bits and signed zero. */
export function firstBitsDifference(expected, actual, path = '') {
  if (typeof expected === 'number' || typeof actual === 'number') {
    if (typeof expected === 'number' && typeof actual === 'number' && Object.is(expected, actual)) return null;
    return { path, expected, actual, expectedBits: typeof expected === 'number' ? bits(expected) : null,
      actualBits: typeof actual === 'number' ? bits(actual) : null };
  }
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object')
    return expected === actual ? null : { path, expected, actual };
  if (Array.isArray(expected) !== Array.isArray(actual)) return { path, expectedKind: 'array', actualKind: typeof actual };
  const a = Object.keys(expected).sort(), b = Object.keys(actual).sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) return { path, expectedKeys: a, actualKeys: b };
  for (const key of a) {
    const difference = firstBitsDifference(expected[key], actual[key], path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));
    if (difference) return difference;
  }
  return null;
}
function rawDifference(expected, actual, path) {
  if (expected === actual) return null;
  if (typeof expected !== 'string' || typeof actual !== 'string' || expected.length !== actual.length)
    return { path, expectedBytes: expected?.length / 2, actualBytes: actual?.length / 2 };
  for (let offset = 0; offset < expected.length; offset += 16) {
    const a = expected.slice(offset, offset + 16), b = actual.slice(offset, offset + 16);
    if (a !== b) return { path, f64Index: offset / 16, bodyIndex: Math.floor(offset / 208),
      bodyComponent: (offset / 16) % 13, expectedBits: a, actualBits: b };
  }
  return { path };
}
function identityMap(variant) {
  need(['ORIGINAL', 'RENAME', 'PERMUTE'].includes(variant), 'unsupported variant');
  const bodies = variant === 'RENAME' ? RENAME_BODY_IDS : ORIGINAL_BODY_IDS;
  const joints = variant === 'RENAME' ? RENAME_JOINT_IDS : ORIGINAL_JOINT_IDS;
  return new Map([...bodies.map((id, index) => [id, ORIGINAL_BODY_IDS[index]]),
    ...joints.map((id, index) => [id, ORIGINAL_JOINT_IDS[index]])]);
}
function remapIds(value, ids, key = '') {
  if (value === null || typeof value !== 'object')
    return ['id', 'bodyId', 'jointId', 'aId', 'bId'].includes(key) && typeof value === 'string' ? ids.get(value) ?? value : value;
  if (Array.isArray(value)) return value.map(item => remapIds(item, ids));
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, remapIds(item, ids, name)]));
}
function orderedBodies(bodies, ids) {
  const mapped = remapIds(bodies, ids), byId = new Map(mapped.map(body => [body.id, body]));
  need(mapped.length === 4 && byId.size === 4 && ORIGINAL_BODY_IDS.every(id => byId.has(id)), 'body identity mapping');
  return ORIGINAL_BODY_IDS.map(id => byId.get(id));
}

/** No inertia formula is copied. Actual observed native inertia is compared to
 * the bank; public-only parity uses that qualified metadata after exact model checks. */
function mapPublic(state, model, options, request, ids, nativeBodies = null) {
  need(state && Array.isArray(state.bodies) && Array.isArray(state.joints), 'missing public state');
  need(state.bodies.length === 4 && state.joints.length === 2 && state.cloths.length === 0 && state.fluids.length === 0,
    'public entity population');
  need(JSON.stringify(state.bodies.map(body => body.id)) === JSON.stringify(model.bodies.map(body => body.id)), 'public caller body order');
  need(JSON.stringify(state.joints.map(joint => joint.id)) === JSON.stringify(model.joints.map(joint => joint.id)), 'public caller joint order');
  need(state.contacts.length === 0 && state.events.length === 0 && state.ccdHits.length === 0, 'new profile produced interaction output');
  need(state.identity.modelRevision === model.revision && state.identity.frameId === model.frame.id &&
    state.identity.profile === options.profile && state.identity.fixedStepSeconds === options.fixedStepSeconds, 'public identity metadata');
  const modelBodies = new Map(model.bodies.map(body => [body.id, body]));
  const modelJoints = new Map(model.joints.map(joint => [joint.id, joint]));
  const colliders = new Map(model.colliders.map(collider => [collider.bodyId, collider]));
  const originalBodies = new Map(request.sourceState.bodies.map(body => [body.id, body]));
  const native = nativeBodies && new Map(nativeBodies.map(body => [body.id, body]));
  const bodies = orderedBodies(state.bodies.map(body => {
    const config = modelBodies.get(body.id), collider = colliders.get(body.id);
    need(config && collider && body.kind === config.kind && body.sleeping === false, 'public body metadata');
    const original = originalBodies.get(ids.get(body.id));
    return { id: body.id, kind: body.kind, shape: structuredClone(collider.geometry), positionM: [...body.positionM],
      velocityMps: [...body.velocityMps], orientation: [...body.orientationXYZW], angularVelocityRadps: [...body.angularVelocityRadps],
      inertiaKgM2: native ? native.get(body.id)?.inertiaKgM2 : original?.inertiaKgM2 };
  }), ids);
  const joints = state.joints.map(joint => {
    const config = modelJoints.get(joint.id);
    need(config && joint.bodyAId === config.bodyAId && joint.bodyBId === config.bodyBId, 'public directed endpoints');
    return remapIds({ id: joint.id, kind: config.kind, aId: joint.bodyAId, bId: joint.bodyBId,
      angleRad: joint.angleRad, linearImpulseNs: [...joint.linearImpulseOnBNs],
      angularImpulseNms: [...joint.angularImpulseOnBNms], motorImpulseNms: joint.motorImpulseNms }, ids);
  });
  const byJointId = new Map(joints.map(joint => [joint.id, joint]));
  need(byJointId.size === 2 && ORIGINAL_JOINT_IDS.every(id => byJointId.has(id)), 'public joint mapping');
  return { stepIndex: state.stepIndex, timeSeconds: state.timeSeconds, bodies, contacts: [], events: [],
    joints: ORIGINAL_JOINT_IDS.map(id => byJointId.get(id)), ccdHits: [], pairStats: structuredClone(state.pairStats) };
}

function modelCorrespondence(model, options, request, ids) {
  const expected = request.config;
  const actual = { fixedStepSeconds: options.fixedStepSeconds, gravityMps2: [...model.gravityMps2], bodies: [], joints: [] };
  need(options.profile === 'rigid-discrete-v1' && options.broadPhase === 'direct', 'unsupported model profile');
  need(model.bodies.length === 4 && model.colliders.length === 4 && model.joints.length === 2 &&
    model.cloths.length === 0 && model.fluids.length === 0, 'model population');
  const colliderByBody = new Map(model.colliders.map(collider => [collider.bodyId, collider]));
  for (const body of model.bodies) {
    const collider = colliderByBody.get(body.id);
    need(body.kind === 'dynamic' && body.inertia.kind === 'primitive-com' && body.inertia.about === 'com' &&
      body.inertia.frame === 'body-local', 'native primitive inertia declaration');
    need(collider && collider.sensor === false && collider.ccd === false && collider.filter.categoryBits === 1 &&
      collider.filter.maskBits === 65535 && firstBitsDifference({ positionM: [0, 0, 0], orientationXYZW: [0, 0, 0, 1] }, collider.local) === null,
    'collider profile');
    actual.bodies.push({ id: ids.get(body.id), kind: body.kind, shape: structuredClone(collider.geometry),
      positionM: [...body.initial.positionM], velocityMps: [...body.initial.velocityMps], massKg: body.massKg,
      restitution: collider.material.restitution, friction: structuredClone(collider.material.friction) });
    need(firstBitsDifference(body.initial.orientationXYZW, [0, 0, 0, 1]) === null &&
      firstBitsDifference(body.initial.angularVelocityRadps, [0, 0, 0]) === null, 'initial resting pose');
  }
  actual.bodies.sort((a, b) => ORIGINAL_BODY_IDS.indexOf(a.id) - ORIGINAL_BODY_IDS.indexOf(b.id));
  for (const joint of model.joints) actual.joints.push({ id: ids.get(joint.id), kind: joint.kind,
    aId: ids.get(joint.bodyAId), bId: ids.get(joint.bodyBId), anchorALocalM: [...joint.anchorALocalM],
    anchorBLocalM: [...joint.anchorBLocalM], axisWorld: [...joint.axisWorld], limitRad: [...joint.limitRad], motor: structuredClone(joint.motor) });
  actual.joints.sort((a, b) => ORIGINAL_JOINT_IDS.indexOf(a.id) - ORIGINAL_JOINT_IDS.indexOf(b.id));
  return { expected, actual };
}

function prepare({ bankRow, model, options, before, after, variant = 'ORIGINAL' }, trace = null) {
  need(bankRow && bankRow.stepIndex === bankRow.request?.output?.state?.stepIndex &&
    /^[0-9a-f]{64}$/.test(bankRow.locators?.reply?.sha256 ?? ''), 'authenticated row locator required');
  const request = bankRow.request, reply = bankRow.reply;
  // Gate the full original reply before reading new actual numerical data.
  const historicalQualification = qualifyReply(reply, request);
  need(historicalQualification.qualified === true, 'historical independent conjunctive gates did not qualify');
  const historicalWholeQuality = worldQuality(request.output.state, request.output.diagnostics, reply);
  need(historicalWholeQuality.failures.length === 0, 'historical whole-World gates failed');
  const ids = identityMap(variant), mapping = modelCorrespondence(model, options, request, ids);
  return { request, reply, ids, mapping, historicalQualification, historicalWholeQuality,
    mappedBefore: mapPublic(before, model, options, request, ids, trace?.phases?.source?.bodies),
    mappedAfter: mapPublic(after, model, options, request, ids, trace?.phases?.projected?.bodies) };
}

/** Exact full-phase correspondence is required before historical certificate reuse. */
export function compareOriginalStep(input) {
  const trace = structuredClone(input.trace);
  const unresolved = (path, reason) => ({ qualified: false, disposition: 'UNRESOLVED', checks: {},
    firstDifference: { path, reason }, certificateReuse: { authorized: false, mode: 'missing-actual-observation' } });
  if (trace?.version !== 1 || trace.stepIndex !== input.bankRow.stepIndex || !Array.isArray(trace.negativeZeroPaths))
    return unresolved('/trace', 'complete actual trace and signed-zero authority required');
  for (const phase of PHASES) if (!Array.isArray(trace.phases?.[phase]?.bodies) ||
    typeof trace.phases[phase].rawHex !== 'string' || trace.phases[phase].bodies.some(body => typeof body.inertiaKgM2 !== 'number'))
    return unresolved('/trace/phases/' + phase, 'actual complete phase/raw/native inertia was not observed');
  if (!trace.postContactResult || trace.projections?.length !== 2 || !trace.projections.every(Boolean) ||
    !Array.isArray(trace.motorImpulsesNms) || trace.motorImpulsesNms.length !== 2 || !Array.isArray(trace.contactChecks) ||
    !Array.isArray(trace.atan2) || !Array.isArray(trace.pairBegins) || !Array.isArray(trace.callEvents))
    return unresolved('/trace', 'actual projection/report/contact/motor/call evidence was not observed');
  restoreNegativeZeroPaths(trace, trace.negativeZeroPaths);
  const data = prepare(input, trace), { request, reply, ids } = data;
  const checks = {}, differences = [];
  function check(name, expected, actual, raw = false) {
    const difference = raw ? rawDifference(expected, actual, '/' + name) : firstBitsDifference(expected, actual, '/' + name);
    checks[name] = difference === null;
    if (difference) differences.push(difference);
  }
  check('modelInput', data.mapping.expected, data.mapping.actual);
  check('beforeState', request.sourceState, data.mappedBefore);
  check('afterState', request.output.state, data.mappedAfter);
  check('identityStable', input.before.identity, input.after.identity);
  const phaseRawHex = {};
  for (const [index, phase] of PHASES.entries()) {
    const actual = trace.phases[phase];
    need(actual && typeof actual.rawHex === 'string', 'unreached phase ' + phase);
    check(phase + 'CallerOrder', input.model.bodies.map(body => body.id), actual.bodies.map(body => body.id));
    check(phase + 'RawSelf', actual.rawHex, rawBodiesHex(actual.bodies), true);
    const ordered = orderedBodies(actual.bodies, ids);
    phaseRawHex[phase] = rawBodiesHex(ordered);
    check(phase + 'RawBank', request.rawFrames[phase], phaseRawHex[phase], true);
    const expected = request.attempt.frames[FRAME_NAMES[index]].map(body => ({ id: body.id, kind: body.kind,
      shape: body.shape, positionM: body.positionM, velocityMps: body.velocityMps, orientation: body.orientation,
      angularVelocityRadps: body.angularVelocityRadps, inertiaKgM2: body.inertiaKgM2 }));
    check(phase + 'BodyMetadataAndValues', expected, ordered);
  }
  const result = trace.postContactResult;
  need(result && trace.projections?.length === 2 && trace.projections.every(Boolean), 'missing actual projection/report output');
  check('contactSequence', request.attempt.contactChecks, remapIds(trace.contactChecks, ids));
  const actualMotors = input.model.joints.map((joint, index) => [ids.get(joint.id), trace.motorImpulsesNms?.[index]]);
  const motorById = new Map(actualMotors);
  check('motorImpulses', request.attempt.pairs.map(pair => pair.motor.impulseNms), ORIGINAL_JOINT_IDS.map(id => motorById.get(id)));
  check('postContactCalls', { projectionCalls: 2, reportCalls: 2 }, result.calls);
  check('postContactReturnedRaw', phaseRawHex.projected, rawBodiesHex(orderedBodies(result.projectedBodies, ids)), true);
  check('postContactRawSelf', result.projectedRawHex, rawBodiesHex(result.projectedBodies), true);
  const measuredPairs = [];
  for (const index of [0, 1]) {
    const expected = request.attempt.pairs[index], projection = remapIds(trace.projections[index], ids);
    check('projection' + index, expected.projection, projection);
    check('jointReport' + index, expected.jointReport, remapIds(result.jointReports[index], ids));
    check('bodyCorrections' + index, expected.bodyCorrections, remapIds(result.bodyCorrections[index], ids));
    check('reportCap' + index, expected.reportCap, result.reportCaps[index]);
    // This reader receives only actual projection measurements for native geometry;
    // its independent pair proof input stays explicitly the original saved reply.
    measuredPairs.push({ projection, metrics: { projected: projection.diagnostics.after } });
    const events = trace.atan2.filter(event => event.pairIndex === index);
    check('atan2Sites' + index, ['measureBodies.relativeAngle', 'pose.relativeAngle', 'pose.relativeAngle', 'measureBodies.relativeAngle'], events.map(event => event.site));
    check('pairMarker' + index, { pairIndex: index, jointId: ORIGINAL_JOINT_IDS[index] }, remapIds(trace.pairBegins[index], ids));
    for (const [ordinal, event] of events.entries()) {
      check('atan2Bits' + index + '-' + ordinal, { yBits: bits(event.y), xBits: bits(event.x), valueBits: bits(event.value) },
        { yBits: event.yBits, xBits: event.xBits, valueBits: event.valueBits });
    }
  }
  check('atan2Total', 8, trace.atan2.length);
  check('actualCallSequence', [
    { kind: 'motor-begin', jointId: 'hinge0' }, { kind: 'motor-return', jointId: 'hinge0', impulseNms: request.attempt.pairs[0].motor.impulseNms },
    { kind: 'motor-begin', jointId: 'hinge1' }, { kind: 'motor-return', jointId: 'hinge1', impulseNms: request.attempt.pairs[1].motor.impulseNms },
    { kind: 'report-begin', pairIndex: 0 }, { kind: 'report-return', pairIndex: 0 },
    { kind: 'report-begin', pairIndex: 1 }, { kind: 'report-return', pairIndex: 1 },
  ], remapIds(trace.callEvents, ids));
  const measuredWorldQuality = worldQuality(data.mappedAfter, { pairs: measuredPairs }, reply);
  checks.measuredWorldQuality = measuredWorldQuality.failures.length === 0;
  if (!checks.measuredWorldQuality) differences.push({ path: '/measuredWorldQuality', failures: measuredWorldQuality.failures });
  const qualified = Object.values(checks).every(Boolean);
  return { qualified, disposition: qualified ? 'RETURN' : 'NUMERICAL_MISMATCH', checks,
    firstDifference: differences[0] ?? null, beforeFingerprint: fingerprint(data.mappedBefore), afterFingerprint: fingerprint(data.mappedAfter),
    certificateReuse: { authorized: qualified, mode: 'direct-six-phase-correspondence', stepIndex: input.bankRow.stepIndex,
      authority: { nativeHead: NATIVE_HEAD, replySha256: input.bankRow.locators.reply.sha256 } },
    measuredWorldQuality, reusedIndependentQualification: data.historicalQualification,
    evidence: { phaseRawHex, motorImpulseBits: trace.motorImpulsesNms.map(bits),
      correctionAndCapFingerprint: fingerprint({ corrections: result.bodyCorrections, caps: result.reportCaps }),
      actualCorrections: result.bodyCorrections, actualCaps: result.reportCaps,
      actualProjectionFingerprints: trace.projections.map(fingerprint), angleOperands: trace.atan2,
      fingerprintEncoding: 'sorted-keys-with-every-number-as-f64le-hex',
      callEvents: trace.callEvents, phasesObserved: true, actualProjectionCertificatesObserved: true } };
}

/** Public output equality to a fully qualified observed SOURCE. This does not
 * assert that uninstrumented phase internals were observed in this new graph. */
export function comparePublicReplayStep(input) {
  const source = input.qualifiedSource;
  need(source?.qualified === true && source.certificateReuse?.authorized === true &&
    source.certificateReuse.mode === 'direct-six-phase-correspondence' && source.certificateReuse.stepIndex === input.bankRow.stepIndex &&
    source.certificateReuse.authority?.nativeHead === NATIVE_HEAD &&
    source.certificateReuse.authority?.replySha256 === input.bankRow.locators.reply.sha256, 'qualified observed SOURCE receipt required');
  const data = prepare(input), differences = [], checks = {};
  for (const [name, expected, actual] of [['modelInput', data.mapping.expected, data.mapping.actual],
    ['beforeState', data.request.sourceState, data.mappedBefore], ['afterState', data.request.output.state, data.mappedAfter],
    ['identityStable', input.before.identity, input.after.identity],
    ['sourceBeforeFingerprint', source.beforeFingerprint, fingerprint(data.mappedBefore)],
    ['sourceAfterFingerprint', source.afterFingerprint, fingerprint(data.mappedAfter)]]) {
    const difference = firstBitsDifference(expected, actual, '/' + name);
    checks[name] = difference === null;
    if (difference) differences.push(difference);
  }
  const qualified = Object.values(checks).every(Boolean);
  return { qualified, disposition: qualified ? 'RETURN' : 'NUMERICAL_MISMATCH', checks, firstDifference: differences[0] ?? null,
    beforeFingerprint: fingerprint(data.mappedBefore), afterFingerprint: fingerprint(data.mappedAfter),
    certificateReuse: { authorized: qualified, mode: 'qualified-source-public-parity', stepIndex: input.bankRow.stepIndex,
      authority: source.certificateReuse.authority }, phasesObserved: false, actualProjectionCertificatesObserved: false };
}
