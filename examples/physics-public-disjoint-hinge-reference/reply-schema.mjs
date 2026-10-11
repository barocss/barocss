/** Saved-phase qualification only: never calls the old whole-World qualifier. */
export const OUTER_KEYS = Object.freeze(['ok', 'resolved', 'executionFailure', 'referenceStatus', 'metrics', 'reference', 'violations', 'error']);
export const REFERENCE_KEYS = Object.freeze(['derived80', 'derived120', 'pairModels80', 'pairModels120', 'historicalPairReplies', 'bank']);
export const METRIC_KEYS = Object.freeze(['actualCompared', 'pairActualCompared', 'checks', 'projectedErrors', 'pairErrors', 'reportErrors', 'capErrors', 'precision']);
export const EXPECTED_CHECKS = Object.freeze(['inputMappingMatch', 'sourceInputBitsMatch', 'postContactInputBitsMatch', 'bankBeforeMatch',
  'derivedPostContactMatch', 'derivedExpectedMatch', 'bankCertificateCorrespondence', 'independentExpectedPhysicalQualified']);
export const ACTUAL_CHECKS = Object.freeze(['callerBodyOrderMatch', 'callerJointOrderMatch', 'actualIdentityMatch', 'actualRawMatchesJSON',
  'projectedBankBitsMatch', 'jointReportsBankBitsMatch', 'bodyCorrectionsBankBitsMatch', 'reportCapsBankBitsMatch', 'callsMatch',
  'reportBaselineIsPostContact', 'reportBMatchesCorrection', 'reportTargetAuthorityMatch', 'capDecisionMatch']);
export const CHECK_KEYS = Object.freeze([...EXPECTED_CHECKS, ...ACTUAL_CHECKS]);
const PROJECTED = { positionM: 1e-12, quaternion: 1e-12, velocityMps: 1e-10, angularVelocityRadps: 1e-9 };
const PAIR = Object.fromEntries(['positionM', 'angleRad', 'quaternion', 'velocityMps', 'angularVelocityRadps',
  'linearMomentumKgMps', 'angularMomentumKgM2ps', 'energyJ'].map(key => [key, 1e-12]));
const REPORT = { angleRad: 1e-9, linearImpulseNs: 1e-12, angularImpulseNms: 1e-12, motorImpulseNms: 1e-12,
  bodyLinearImpulseNs: 1e-12, bodyAngularImpulseNms: 1e-12 };
const CAP = { angularReactionNormNms: 1e-12, maxReactionNms: 0 };
const PRECISION_UNITS = ['positionM', 'quaternion', 'velocityMps', 'angularVelocityRadps', 'linearMomentumKgMps',
  'angularMomentumKgM2ps', 'energyJ', 'impulseNs', 'angularImpulseNms'];
const PRECISION_KEYS = ['algebraMaxDifferenceByUnit', 'scalarRepeatMaxDifferenceRad', 'algebraResolved', 'scalarResolved'];
const PARENT_KEYS = ['ok', 'resolved', 'executionFailure', 'metrics', 'violations', 'reference', 'certificate', 'transcendentals', 'zeroAuthority'];
// Exact returned shapes from immutable world_derivation.py and velocity reference.py.
const DERIVED_KEYS = ['stage', 'authority', 'parsedActions', 'frames', 'rawFrames', 'pairs', 'contactChecks', 'calls', 'expectedRefusal', 'pairReplies'];
const MODEL_KEYS = ['metrics', 'before', 'after', 'expectedBodies', 'expectedVelocity', 'poseReport', 'projection', 'problem',
  'exact', 'actualFrame', 'actualCertificate', 'geometricInertiaKgM2', 'nativeInertiaKgM2', 'actualRecords', 'objectiveDecimalJ', 'energyDifferenceJ'];

export class ReplySchemaError extends Error {
  constructor(detail) {
    super('hinge saved phase reference reply schema is invalid: ' + detail);
    this.name = 'ReplySchemaError'; this.code = 'IPC_REPLY_SCHEMA_INVALID'; this.disposition = 'EXECUTION_FAILURE';
  }
}
function need(test, detail) { if (!test) throw new ReplySchemaError(detail); }
function data(value, key, label) {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  need(descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), label + ': own data required');
  return descriptor.value;
}
export function exactKeys(value, keys, label = 'object') {
  need(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype, label + ': plain object required');
  const actual = Reflect.ownKeys(value);
  need(actual.length === keys.length && actual.every(key => typeof key === 'string' && keys.includes(key)), label + ': exact keys required');
  for (const key of keys) data(value, key, label);
  return value;
}
function dense(value, length, label) {
  need(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length === length &&
    Reflect.ownKeys(value).length === length + 1, label + ': dense array required');
  for (let index = 0; index < length; index++) data(value, String(index), label);
  return value;
}
function stringList(value, label) {
  need(Array.isArray(value), label + ': array required'); dense(value, value.length, label);
  need(value.every(item => typeof item === 'string' && item.length > 0), label + ': nonempty strings required');
}
function boolean(value, label) { need(typeof value === 'boolean', label + ': Boolean required'); }
function errorNumber(value, label) {
  need(typeof value === 'number' && Number.isFinite(value) && value >= 0, label + ': finite nonnegative Number required');
}
function errorObject(value, limits, label, failures, required) {
  if (value === null) { need(!required, label + ': reached value cannot be null'); return; }
  exactKeys(value, Object.keys(limits), label);
  for (const [key, limit] of Object.entries(limits)) {
    errorNumber(value[key], label + '.' + key);
    if (value[key] > limit) failures.push(label + '.' + key + ' exceeds ' + limit);
  }
}
function precision(value, required, resolved, failures) {
  if (value === null) { need(!required, 'precision is unreached'); return; }
  exactKeys(value, PRECISION_KEYS, 'precision');
  exactKeys(value.algebraMaxDifferenceByUnit, PRECISION_UNITS, 'precision algebra');
  boolean(value.algebraResolved, 'precision.algebraResolved'); boolean(value.scalarResolved, 'precision.scalarResolved');
  for (const key of PRECISION_UNITS) {
    const number = value.algebraMaxDifferenceByUnit[key];
    if (number === null) need(!required && !value.algebraResolved, 'resolved algebra cannot contain null');
    else {
      errorNumber(number, 'precision.' + key);
      if (number > 1e-25) failures.push('precision.' + key + ' exceeds 1e-25');
    }
  }
  if (value.scalarRepeatMaxDifferenceRad === null) need(!required && !value.scalarResolved, 'resolved scalar cannot be null');
  else {
    errorNumber(value.scalarRepeatMaxDifferenceRad, 'precision scalar');
    if (value.scalarRepeatMaxDifferenceRad > 1e-12) failures.push('precision scalar exceeds 1e-12');
  }
  if (resolved) need(value.algebraResolved && value.scalarResolved && failures.length === 0,
    'unresolved precision cannot claim a resolved reply');
}

/** Check representation without converting exact Decimal/Fraction strings to Number. */
function exactTree(value, label, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { need(Number.isFinite(value), label + ': nonfinite JSON number'); return; }
  need(typeof value === 'object' && !seen.has(value), label + ': JSON tree required');
  seen.add(value);
  if (Array.isArray(value)) {
    dense(value, value.length, label);
    value.forEach((item, index) => exactTree(item, label + '/' + index, seen));
  } else {
    need(Object.getPrototypeOf(value) === Object.prototype, label + ': plain object required');
    const keys = Reflect.ownKeys(value);
    need(keys.every(key => typeof key === 'string'), label + ': string keys required');
    for (const key of keys) data(value, key, label);
    if (value.kind === 'decimal') {
      exactKeys(value, ['kind', 'text'], label);
      need(typeof value.text === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.text), label + ': exact Decimal text required');
    } else if (value.kind === 'fraction') {
      exactKeys(value, ['kind', 'numerator', 'denominator'], label);
      need(typeof value.numerator === 'string' && /^-?\d+$/.test(value.numerator) &&
        typeof value.denominator === 'string' && /^[1-9]\d*$/.test(value.denominator), label + ': exact Fraction strings required');
    } else for (const key of keys) exactTree(value[key], label + '/' + key, seen);
  }
  seen.delete(value);
}
function reference(value, complete) {
  if (value === null) { need(!complete, 'complete reference is required'); return; }
  exactKeys(value, REFERENCE_KEYS, 'reference'); exactTree(value, 'reference');
  for (const key of REFERENCE_KEYS) if (complete) need(value[key] !== null, 'reference.' + key + ' is unreached');
  for (const key of ['derived80', 'derived120']) if (value[key] !== null) {
    exactKeys(value[key], DERIVED_KEYS, key);
    dense(value[key].pairReplies, 2, key + '.pairReplies');
    need(value[key].pairReplies.every(item => item === null), key + ': historical replies must not replace no-output nulls');
    if (complete) need(value[key].stage === 'report-ready' && value[key].expectedRefusal === null, key + ': complete independent expected result required');
  }
  for (const key of ['pairModels80', 'pairModels120']) if (value[key] !== null) {
    dense(value[key], 2, key);
    for (const item of value[key]) {
      if (item === null) { need(!complete, key + ': complete model required'); continue; }
      exactKeys(item, MODEL_KEYS, key);
      need(item.actualFrame === null && item.actualCertificate === null, key + ': no new actual certificate may be claimed');
      if (complete) for (const field of MODEL_KEYS.filter(field => !['actualFrame', 'actualCertificate'].includes(field)))
        need(item[field] !== null, key + '/' + field + ': full returned model must be retained');
    }
  }
  if (value.historicalPairReplies !== null) {
    dense(value.historicalPairReplies, 2, 'historicalPairReplies');
    for (const parent of value.historicalPairReplies) {
      if (parent === null) { need(!complete, 'historical parent reply is unreached'); continue; }
      exactKeys(parent, PARENT_KEYS, 'historical parent');
      boolean(parent.ok, 'historical ok'); boolean(parent.resolved, 'historical resolved'); boolean(parent.executionFailure, 'historical executionFailure');
      stringList(parent.violations, 'historical violations');
      if (complete) {
        need(parent.ok && parent.resolved && !parent.executionFailure && parent.violations.length === 0, 'historical full parent proof did not pass');
        exactKeys(parent.certificate, ['expected', 'actualFrame', 'actualOutput'], 'historical certificate');
        for (const field of ['expected', 'actualFrame', 'actualOutput']) need(parent.certificate[field] !== null, 'historical certificate is incomplete');
      }
    }
  }
  if (value.bank !== null) need(typeof value.bank === 'object' && !Array.isArray(value.bank), 'reference.bank must be an object');
}
function metrics(value, status, failures) {
  if (value === null) { need(status === 'UNRESOLVED', 'resolved reply metrics are required'); return; }
  exactKeys(value, METRIC_KEYS, 'metrics'); boolean(value.actualCompared, 'actualCompared');
  dense(value.pairActualCompared, 2, 'pairActualCompared'); value.pairActualCompared.forEach(item => boolean(item, 'pairActualCompared'));
  exactKeys(value.checks, CHECK_KEYS, 'checks');
  for (const key of CHECK_KEYS) {
    need(value.checks[key] === null || typeof value.checks[key] === 'boolean', 'check must be Boolean or null: ' + key);
    if (value.checks[key] === false) failures.push('check ' + key);
  }
  const resolved = status !== 'UNRESOLVED';
  const complete = status === 'RETURN' || resolved && value.actualCompared;
  if (complete) {
    need(value.actualCompared && value.pairActualCompared.every(item => item === true), 'complete actual comparison flags required');
    need(CHECK_KEYS.every(key => value.checks[key] !== null), 'complete checks cannot be null');
  }
  if (value.actualCompared) {
    need(EXPECTED_CHECKS.every(key => value.checks[key] === true), 'actual was accessed before expected qualification');
  } else {
    need(value.pairActualCompared.every(item => item === false), 'unread actual cannot have pair comparison flags');
    need(ACTUAL_CHECKS.every(key => value.checks[key] === null), 'unread actual checks must remain null');
    need(value.projectedErrors === null, 'unread actual projected errors must remain null');
  }
  errorObject(value.projectedErrors, PROJECTED, 'projectedErrors', failures, complete);
  dense(value.pairErrors, 2, 'pairErrors'); dense(value.reportErrors, 2, 'reportErrors'); dense(value.capErrors, 2, 'capErrors');
  for (let index = 0; index < 2; index++) {
    const pair = value.pairErrors[index]; exactKeys(pair, ['postContact', 'projected'], 'pairErrors/' + index);
    if (!value.actualCompared) need(pair.projected === null && value.reportErrors[index] === null && value.capErrors[index] === null,
      'unread actual pair/report/cap metrics must remain null');
    errorObject(pair.postContact, PAIR, 'pairErrors/' + index + '/postContact', failures, complete);
    errorObject(pair.projected, PAIR, 'pairErrors/' + index + '/projected', failures, complete);
    errorObject(value.reportErrors[index], REPORT, 'reportErrors/' + index, failures, complete);
    errorObject(value.capErrors[index], CAP, 'capErrors/' + index, failures, complete);
    if (value.pairActualCompared[index]) need(pair.projected !== null && value.reportErrors[index] !== null && value.capErrors[index] !== null,
      'compared pair metrics cannot be null');
  }
  const precisionFailures = [];
  precision(value.precision, complete, resolved, precisionFailures); failures.push(...precisionFailures);
}

/** Invalid replies throw EXECUTION_FAILURE. Negative protocol controls need explicit caller opt-in. */
export function validateReply(reply, { expectedInputError = false } = {}) {
  boolean(expectedInputError, 'expectedInputError');
  exactKeys(reply, OUTER_KEYS, 'reply');
  for (const key of ['ok', 'resolved', 'executionFailure']) boolean(reply[key], key);
  need(['RETURN', 'MISMATCH', 'UNRESOLVED'].includes(reply.referenceStatus), 'unsupported saved-phase status');
  stringList(reply.violations, 'violations');
  const status = reply.referenceStatus;
  need(status === 'RETURN' ? reply.ok && reply.resolved && !reply.executionFailure :
    status === 'MISMATCH' ? !reply.ok && reply.resolved && !reply.executionFailure :
      !reply.ok && !reply.resolved && reply.executionFailure, 'status/Boolean contradiction');
  if (reply.error !== null) {
    exactKeys(reply.error, ['code', 'message'], 'error');
    const messages = { REFERENCE_JSON: 'hinge world reference line must be valid JSON', REFERENCE_INPUT: 'hinge world reference input is invalid' };
    need(typeof reply.error.code === 'string' && typeof reply.error.message === 'string' &&
      Object.hasOwn(messages, reply.error.code) && messages[reply.error.code] === reply.error.message, 'unknown protocol error');
    need(status === 'UNRESOLVED' && reply.metrics === null && reply.reference === null && reply.violations.length === 0,
      'protocol error cannot contain reached results');
    const control = expectedInputError === true && reply.error.code === 'REFERENCE_INPUT';
    return { qualified: false, disposition: control ? 'SCHEMA_CONTROL' : 'EXECUTION_FAILURE', failures: [reply.error.code + ': ' + reply.error.message] };
  }
  need(expectedInputError === false, 'expected input-negative control did not return REFERENCE_INPUT');
  const failures = [];
  metrics(reply.metrics, status, failures);
  const complete = status === 'RETURN' || status === 'MISMATCH' && reply.metrics.actualCompared;
  reference(reply.reference, complete);
  if (status === 'RETURN') {
    need(reply.violations.length === 0 && failures.length === 0 && CHECK_KEYS.every(key => reply.metrics.checks[key] === true),
      'RETURN contains failing evidence');
    return { qualified: true, disposition: 'RETURN', failures: [] };
  }
  need(reply.violations.length > 0, status + ' requires reason violations');
  if (status === 'MISMATCH') {
    need(failures.length > 0, 'MISMATCH requires reached failing evidence');
    return { qualified: false, disposition: 'NUMERICAL_MISMATCH', failures: [...failures, ...reply.violations] };
  }
  return { qualified: false, disposition: 'EXECUTION_FAILURE', failures: [...failures, ...reply.violations] };
}

export function assertReply(reply, options) { validateReply(reply, options); return reply; }
