import {ProofFailure} from './proof-storage.mjs';

const OUTER = ['ok', 'resolved', 'executionFailure', 'referenceStatus', 'metrics', 'reference', 'violations', 'error'];
const PHASES = ['source', 'angular', 'motor', 'free', 'postContact', 'projected'];
const METRICS = ['actualCompared', 'pairActualCompared', 'checks', 'frameErrors', 'pairErrors', 'contactChecks', 'reportErrors', 'workErrors', 'precision'];
const CHECKS = ['sourceRawMatchesInput', 'commandsRawMatchesInput', 'negativeZeroPathsMatch', 'sourceCursorRetained',
  'attemptCursorCorrect', 'parsedActionsMatch', 'heldFrameBitsMatch', 'namedZeroSignsMatch', 'outputAttemptCorrespondence',
  'frameReachabilityMatch', 'pairProgressMatch', 'contactSequenceMatch', 'callsMatch', 'finiteSignedWork',
  'nonnegativeEnergiesAndObjective', 'actualErrorMatch', 'actualOutcomeMatch', 'pairs'];
const PAIR_CHECKS = ['acceptedReportAuthorityMatch', 'motorMetadataMatch', 'motorBranchMatch', 'jointReportIdentityMatch',
  'targetAngleAuthorityMatch', 'reportBaselineIsPostContact', 'capDecisionMatch', 'parentActualQualified'];
const PARENT = ['ok', 'resolved', 'executionFailure', 'metrics', 'violations', 'reference', 'certificate', 'transcendentals', 'zeroAuthority'];

function invalid() { throw new ProofFailure('reply', 'IPC_REPLY_SCHEMA_INVALID', 'hinge World reference reply schema is invalid'); }
export function exact(value, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype ||
    Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)) ||
    Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key))) invalid();
}
function finite(value) { if (typeof value !== 'number' || !Number.isFinite(value)) invalid(); return value; }
function boolOrNull(value) { if (value !== null && typeof value !== 'boolean') invalid(); }
function errorBound(value, limit, label, failures) {
  if (value === null) return;
  if (finite(value) < 0) invalid();
  if (value > limit) failures.push(label);
}
export function envelope(reply) {
  exact(reply, OUTER);
  for (const key of ['ok', 'resolved', 'executionFailure']) if (typeof reply[key] !== 'boolean') invalid();
  if (!['RETURN', 'PRODUCER_REFUSAL', 'MISMATCH', 'UNRESOLVED'].includes(reply.referenceStatus) ||
    !Array.isArray(reply.violations) || !reply.violations.every(value => typeof value === 'string')) invalid();
  return reply;
}

/** Enforce the frozen SI gates; no null/boolean-to-number coercion. */
export function qualifyReply(reply, request) {
  envelope(reply);
  if (reply.resolved !== true || reply.executionFailure !== false || reply.error !== null) invalid();
  exact(reply.metrics, METRICS);
  const metrics = reply.metrics, failures = [];
  if (metrics.actualCompared !== true || !Array.isArray(metrics.pairActualCompared) || metrics.pairActualCompared.length !== 2 ||
    !metrics.pairActualCompared.every(value => typeof value === 'boolean')) invalid();
  exact(metrics.checks, CHECKS);
  for (const key of CHECKS.filter(key => key !== 'pairs')) {
    boolOrNull(metrics.checks[key]);
    if (metrics.checks[key] === false) failures.push('check ' + key);
    if (request.op === 'world-step' && request.outcome === 'returned' && metrics.checks[key] === null) invalid();
  }
  if (!Array.isArray(metrics.checks.pairs) || metrics.checks.pairs.length !== 2) invalid();
  for (const pair of metrics.checks.pairs) {
    exact(pair, PAIR_CHECKS);
    for (const key of PAIR_CHECKS) {
      boolOrNull(pair[key]);
      if (pair[key] === false) failures.push('pair check ' + key);
      if (request.op === 'world-step' && request.outcome === 'returned' && pair[key] === null) invalid();
    }
  }
  exact(metrics.frameErrors, PHASES);
  for (const phase of PHASES) {
    const value = metrics.frameErrors[phase];
    if (value === null) {
      if (request.op === 'world-step' && request.rawFrames[phase] !== null || request.op === 'initial' && phase === 'source') invalid();
      continue;
    }
    exact(value, ['positionM', 'quaternion', 'velocityMps', 'angularVelocityRadps', 'metadataMatch']);
    for (const [key, limit] of [['positionM', 1e-12], ['quaternion', 1e-12], ['velocityMps', 1e-10],
      ['angularVelocityRadps', phase === 'projected' ? 1e-9 : 1e-10]]) {
      if (value[key] === null) invalid();
      errorBound(value[key], limit, phase + ' ' + key, failures);
    }
    if (typeof value.metadataMatch !== 'boolean') invalid();
    if (!value.metadataMatch) failures.push(phase + ' metadata');
  }
  for (const field of ['pairErrors', 'reportErrors', 'workErrors']) if (!Array.isArray(metrics[field]) || metrics[field].length !== 2) invalid();
  for (const phases of metrics.pairErrors) {
    exact(phases, PHASES);
    if (request.op === 'world-step' && request.outcome === 'returned' && PHASES.some(phase => phases[phase] === null)) invalid();
    for (const phase of PHASES) if (phases[phase] !== null) {
      exact(phases[phase], ['positionM', 'angleRad', 'quaternion', 'velocityMps', 'angularVelocityRadps',
        'linearMomentumKgMps', 'angularMomentumKgM2ps', 'energyJ']);
      for (const [key, value] of Object.entries(phases[phase])) {
        if (value === null) invalid();
        errorBound(value, 1e-12, 'pair ' + phase + ' ' + key, failures);
      }
    }
  }
  for (const report of metrics.reportErrors) if (report !== null) {
    exact(report, ['angleRad', 'linearImpulseNs', 'angularImpulseNms', 'motorImpulseNms', 'bodyLinearImpulseNs',
      'bodyAngularImpulseNms', 'angularReactionNormNms', 'motorSpeedBeforeRadps', 'motorSpeedAfterRadps']);
    for (const [key, value] of Object.entries(report)) {
      if (request.op === 'world-step' && request.outcome === 'returned' && value === null) invalid();
      errorBound(value, key === 'angleRad' ? 1e-9 : key.includes('Speed') ? 1e-10 : 1e-12, 'report ' + key, failures);
    }
  }
  for (const work of metrics.workErrors) if (work !== null) {
    exact(work, ['externalAngularByBodyJ', 'externalAngularTotalJ', 'motorMidpointJ', 'motorSpinMidpointJ',
      'motorResidualJ', 'freeDeltaKJ', 'contactDeltaKJ', 'projectionDeltaKJ', 'projectionObjectiveJ', 'energyByPhaseJ', 'motorBalanceResidualJ']);
    for (const [key, value] of Object.entries(work)) {
      if (value === null) invalid();
      errorBound(value, key === 'projectionObjectiveJ' ? 1e-10 : 1e-12, 'work ' + key, failures);
    }
  }
  exact(metrics.precision, ['algebraMaxDifferenceByUnit', 'scalarRepeatMaxDifferenceRad', 'algebraResolved', 'scalarResolved']);
  exact(metrics.precision.algebraMaxDifferenceByUnit, ['positionM', 'quaternion', 'velocityMps', 'angularVelocityRadps',
    'linearMomentumKgMps', 'angularMomentumKgM2ps', 'energyJ', 'impulseNs', 'angularImpulseNms']);
  if (metrics.precision.algebraResolved !== true || metrics.precision.scalarResolved !== true) invalid();
  for (const [unit, value] of Object.entries(metrics.precision.algebraMaxDifferenceByUnit)) errorBound(value, 1e-25, 'precision ' + unit, failures);
  if (request.op === 'world-step' && request.outcome === 'returned' &&
    Object.values(metrics.precision.algebraMaxDifferenceByUnit).some(value => value === null)) invalid();
  if (metrics.precision.scalarRepeatMaxDifferenceRad === null) invalid();
  errorBound(metrics.precision.scalarRepeatMaxDifferenceRad, 1e-12, 'scalar repeat', failures);
  exact(metrics.contactChecks, ['passes', 'final']);
  if (!Array.isArray(metrics.contactChecks.passes) || metrics.contactChecks.passes.length !== 32 ||
    !Array.isArray(metrics.contactChecks.final) || metrics.contactChecks.final.length !== 4) invalid();
  for (const item of [...metrics.contactChecks.passes, ...metrics.contactChecks.final]) if (item !== null) {
    exact(item, ['pass', 'pairIndex', 'aId', 'bId', 'positionsMatch', 'hitMatch', 'noHit', 'separationRawM', 'separationNormalizedM', 'precisionMaxDifferenceM']);
    for (const key of ['positionsMatch', 'hitMatch', 'noHit']) { boolOrNull(item[key]); if (item[key] === false) failures.push('contact ' + key); }
    if (request.op === 'world-step' && request.outcome === 'returned') {
      if (item.positionsMatch === null || item.noHit === null) invalid();
      // No extra producer detector is called on final poses. Its hit comparison is honestly unreached.
      if (item.pass === null ? item.hitMatch !== null : item.hitMatch === null) invalid();
    }
    finite(item.separationRawM); finite(item.separationNormalizedM);
    errorBound(item.precisionMaxDifferenceM, 1e-25, 'contact precision', failures);
  }
  if (request.op === 'world-step' && request.outcome === 'returned') {
    if (!metrics.pairActualCompared.every(Boolean) || metrics.contactChecks.passes.some(item => item === null) ||
      metrics.contactChecks.final.some(item => item === null) || metrics.reportErrors.some(item => item === null) ||
      metrics.workErrors.some(item => item === null)) invalid();
    if (!Array.isArray(reply.reference?.pairReplies) || reply.reference.pairReplies.length !== 2) invalid();
    for (const parent of reply.reference.pairReplies) {
      exact(parent, PARENT);
      if (parent.ok !== true || parent.resolved !== true || parent.executionFailure !== false || parent.violations.length !== 0) failures.push('parent actual proof');
    }
  }
  failures.push(...reply.violations);
  if (!reply.ok && failures.length === 0) invalid();
  if (failures.length > 0 || reply.referenceStatus === 'MISMATCH')
    return {qualified: false, disposition: 'NUMERICAL_MISMATCH', failures};
  if (reply.ok !== true) invalid();
  const wanted = request.op === 'initial' || request.outcome === 'returned' ? 'RETURN' : 'PRODUCER_REFUSAL';
  if (reply.referenceStatus !== wanted) invalid();
  return {qualified: true, disposition: wanted, failures: []};
}
