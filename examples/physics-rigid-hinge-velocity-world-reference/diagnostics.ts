import { add, sub, dot, scale } from '../../packages/barocss-physics/src/math.js';
import { measureBodies } from '../physics-rigid-hinge-velocity-reference/diagnostics.js';
import { copyData, copyPair, ownData, denseNumbers } from './copy.js';
import { worldFailure } from './errors.js';
import type { Body, PairBodies, PairDiagnostic, WorldAttempt, WorldDiagnostics, WorldFrames, WorldProfile } from './types.js';

const PAIR_KEYS = ['jointId', 'aId', 'bId', 'acceptedReportAngleRad', 'rawSourceAngleRad', 'rawFreeAngleRad',
  'rawPostContactAngleRad', 'rawFinalAngleRad', 'parsedActions', 'motor', 'projection', 'jointReport', 'bodyCorrections',
  'energyByPhase', 'work', 'reportCap', 'metrics', 'calls'];
const FRAME_KEYS = ['sourceBodies', 'angularBodies', 'motorBodies', 'freeBodies', 'postContactBodies', 'projectedBodies'] as const;
const METRIC_KEYS = ['relativeAngleRad', 'anchorAM', 'anchorBM', 'anchorGapM', 'axisDeviationRad', 'quaternionNormError',
  'limitExcessRad', 'centerOfMassM', 'linearMomentumVectorKgMps', 'orbitalAngularMomentumVectorKgM2ps',
  'spinAngularMomentumVectorKgM2ps', 'angularMomentumVectorKgM2ps', 'energyJ', 'anchorVelocityAMps',
  'anchorVelocityBMps', 'anchorRelativeVelocityMps', 'relativeAngularVelocityRadps'];
const ENERGY_KEYS = ['sourceJ', 'angularJ', 'motorJ', 'freeJ', 'postContactJ', 'projectedJ'];
const WORK_KEYS = ['externalAngularByBodyJ', 'externalAngularTotalJ', 'motorMidpointJ', 'motorSpinMidpointJ', 'motorResidualJ',
  'freeDeltaKJ', 'projectionDeltaKJ', 'projectionObjectiveJ', 'contactDeltaKJ'];
const METRIC_STAGES = ['source', 'angular', 'motor', 'free', 'postContact', 'projected'] as const;

function spinMidpoint(before: PairBodies, after: PairBodies): [number, number] {
  return before.map((body, i) => (.5 * body.inertiaKgM2!) * dot(
    sub(after[i].angularVelocityRadps, body.angularVelocityRadps),
    add(body.angularVelocityRadps, after[i].angularVelocityRadps))) as [number, number];
}

/** Six-stage measurements use unchanged parent operations, with explicit POSTCONTACT accounting. */
export function makePairDiagnostic(profile: WorldProfile, attempt: WorldAttempt, index: 0 | 1): PairDiagnostic {
  const global = profile.joints[index], local = profile.localJoints[index], progress = attempt.pairProgress[index];
  const angularFrame = attempt.frames.angularBodies, motorFrame = attempt.frames.motorBodies;
  const freeFrame = attempt.frames.freeBodies, postContactFrame = attempt.frames.postContactBodies;
  const motor = progress.motor, projection = progress.projection, report = progress.report;
  if (!angularFrame || !motorFrame || !freeFrame || !postContactFrame || !motor || !projection || !report) worldFailure('diagnostics');
  const select = (bodies: readonly Body[]) => copyPair([bodies[global.aIndex], bodies[global.bIndex]]);
  const source = select(attempt.frames.sourceBodies), angular = select(angularFrame), motorBodies = select(motorFrame);
  const free = select(freeFrame), postContact = select(postContactFrame), projected = copyPair(projection.bodies);
  const config = profile.pairConfigs[index];
  const origin = scale(add(config.bodies[0].positionM, config.bodies[1].positionM), .5);
  const metrics = {
    source: measureBodies(source, local, origin), angular: measureBodies(angular, local, origin),
    motor: measureBodies(motorBodies, local, origin), free: measureBodies(free, local, origin),
    postContact: measureBodies(postContact, local, origin), projected: measureBodies(projected, local, origin),
  };
  const energyByPhase = { sourceJ: metrics.source.energyJ, angularJ: metrics.angular.energyJ,
    motorJ: metrics.motor.energyJ, freeJ: metrics.free.energyJ, postContactJ: metrics.postContact.energyJ,
    projectedJ: metrics.projected.energyJ };
  const externalAngularByBodyJ = spinMidpoint(source, angular), motorByBody = spinMidpoint(angular, motorBodies);
  const motorMidpointJ = (motor.impulseNms * (motor.relativeSpeedBeforeRadps + motor.relativeSpeedAfterRadps)) * .5;
  const motorSpinMidpointJ = motorByBody[0] + motorByBody[1];
  const work = { externalAngularByBodyJ, externalAngularTotalJ: externalAngularByBodyJ[0] + externalAngularByBodyJ[1],
    motorMidpointJ, motorSpinMidpointJ, motorResidualJ: motorSpinMidpointJ - motorMidpointJ,
    freeDeltaKJ: energyByPhase.freeJ - energyByPhase.motorJ,
    projectionDeltaKJ: energyByPhase.projectedJ - energyByPhase.postContactJ,
    projectionObjectiveJ: projection.diagnostics.projection.objectiveJ,
    contactDeltaKJ: energyByPhase.postContactJ - energyByPhase.freeJ };
  const result: PairDiagnostic = {
    jointId: global.id, aId: source[0].id, bId: source[1].id,
    acceptedReportAngleRad: attempt.acceptedReportAnglesRad[index], rawSourceAngleRad: metrics.source.relativeAngleRad,
    rawFreeAngleRad: metrics.free.relativeAngleRad, rawPostContactAngleRad: metrics.postContact.relativeAngleRad,
    rawFinalAngleRad: metrics.projected.relativeAngleRad,
    parsedActions: copyData([attempt.parsedActions[global.aIndex], attempt.parsedActions[global.bIndex]]),
    motor: copyData(motor), projection: copyData(projection), jointReport: copyData(report.jointReport),
    bodyCorrections: copyData(report.bodyCorrections), energyByPhase, work, reportCap: copyData(report.reportCap),
    metrics, calls: copyData(progress.calls),
  };
  validatePairDiagnostic(result);
  return copyData(result);
}

/** Construction is separate from final validation so original World result errors keep priority. */
export function makeWorldDiagnostics(profile: WorldProfile, attempt: WorldAttempt): WorldDiagnostics {
  const { frames } = attempt;
  if (!frames.angularBodies || !frames.motorBodies || !frames.freeBodies || !frames.postContactBodies ||
    !frames.projectedBodies || !attempt.pairs[0] || !attempt.pairs[1]) worldFailure('diagnostics');
  const completeFrames: WorldFrames = {
    sourceBodies: frames.sourceBodies, angularBodies: frames.angularBodies, motorBodies: frames.motorBodies,
    freeBodies: frames.freeBodies, postContactBodies: frames.postContactBodies, projectedBodies: frames.projectedBodies,
  };
  const result: WorldDiagnostics = { sourceStepIndex: attempt.sourceStepIndex, sourceTimeSeconds: attempt.sourceTimeSeconds,
    acceptedStepIndex: attempt.attemptedStepIndex, acceptedTimeSeconds: attempt.attemptedTimeSeconds,
    fixedStepSeconds: profile.dt, frames: completeFrames, pairs: [attempt.pairs[0], attempt.pairs[1]],
    contactPasses: attempt.contactPasses, pairStats: attempt.pairStats, calls: attempt.calls, contactChecks: attempt.contactChecks };
  return copyData(result);
}

/** Known constructed data only; signed momentum/work/deltas are not made nonnegative. */
function finiteTree(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean' || typeof value === 'string') return true;
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let i = 0; i < value.length; i++) {
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d || !d.enumerable || !('value' in d) || !finiteTree(d.value)) return false;
    }
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Reflect.ownKeys(value).every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && d !== undefined && d.enumerable && 'value' in d && finiteTree(d.value);
  });
}
function ordinaryDense(value: unknown, length: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length ||
    Reflect.ownKeys(value).length !== length + 1) return false;
  return Array.from({ length }, (_, i) => i).every(i => {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    return !!d && d.enumerable && 'value' in d;
  });
}
function validatePairDiagnostic(value: PairDiagnostic): void {
  if (!ownData(value, PAIR_KEYS) || PAIR_KEYS.filter(key => key !== 'parsedActions')
    .some(key => !finiteTree((value as unknown as Record<string, unknown>)[key])) ||
    !ordinaryDense(value.parsedActions, 2) || !ordinaryDense(value.bodyCorrections, 2) ||
    !ownData(value.motor, ['inputAngleRad', 'targetSpeedRadps', 'limitRad', 'maxImpulseNms', 'blocked', 'impulseNms',
      'relativeSpeedBeforeRadps', 'relativeSpeedAfterRadps']) ||
    !ownData(value.projection, ['bodies', 'poseReport', 'diagnostics']) ||
    !ownData(value.jointReport, ['id', 'kind', 'aId', 'bId', 'angleRad', 'linearImpulseNs', 'angularImpulseNms', 'motorImpulseNms']) ||
    !ownData(value.energyByPhase, ENERGY_KEYS) || !ownData(value.work, WORK_KEYS) ||
    !ownData(value.reportCap, ['angularReactionNormNms', 'maxReactionNms', 'exceedsCap']) ||
    !ownData(value.metrics, METRIC_STAGES) || !ownData(value.calls, ['motorCalls', 'projectionCalls', 'reportCalls']) ||
    value.calls.motorCalls !== 1 || value.calls.projectionCalls !== 1 || value.calls.reportCalls !== 1 ||
    Object.values(value.energyByPhase).some(energy => energy < 0) || value.work.projectionObjectiveJ < 0 ||
    value.reportCap.maxReactionNms !== .01 ||
    value.reportCap.exceedsCap !== (value.reportCap.angularReactionNormNms > .01) ||
    !denseNumbers(value.work.externalAngularByBodyJ, 2)) worldFailure('diagnostics');
  const ids = [value.aId, value.bId];
  for (let i = 0; i < 2; i++) {
    const action = ownData(value.parsedActions[i], ['bodyId', 'torqueNm', 'angularImpulseNms']);
    const correction = ownData(value.bodyCorrections[i], ['bodyId', 'linearImpulseNs', 'angularImpulseNms']);
    if (!action || action.bodyId !== ids[i] ||
      action.torqueNm !== null && !denseNumbers(action.torqueNm, 3) ||
      action.angularImpulseNms !== null && !denseNumbers(action.angularImpulseNms, 3) ||
      !correction || correction.bodyId !== ids[i] || !denseNumbers(correction.linearImpulseNs, 3) ||
      !denseNumbers(correction.angularImpulseNms, 3)) worldFailure('diagnostics');
  }
  for (const stage of METRIC_STAGES) if (!ownData(value.metrics[stage], METRIC_KEYS) ||
    value.metrics[stage].energyJ < 0) worldFailure('diagnostics');
}

export function validateWorldDiagnostics(value: WorldDiagnostics): void {
  if (!ownData(value, ['sourceStepIndex', 'sourceTimeSeconds', 'acceptedStepIndex', 'acceptedTimeSeconds', 'fixedStepSeconds',
    'frames', 'pairs', 'contactPasses', 'pairStats', 'calls', 'contactChecks']) ||
    !Number.isSafeInteger(value.sourceStepIndex) || value.sourceStepIndex < 0 || value.sourceStepIndex > 3600 ||
    value.fixedStepSeconds !== 1 / 120 || value.sourceTimeSeconds !== value.sourceStepIndex * value.fixedStepSeconds ||
    value.acceptedStepIndex !== value.sourceStepIndex + 1 || value.acceptedTimeSeconds !== value.acceptedStepIndex * value.fixedStepSeconds ||
    !ownData(value.frames, FRAME_KEYS) || !ordinaryDense(value.pairs, 2) ||
    !ownData(value.pairStats, ['eligiblePairs', 'candidatePairs', 'aabbTests']) ||
    !ownData(value.calls, ['angularUpdates', 'freeIntegrations', 'motorCalls', 'projectionCalls', 'reportCalls']) ||
    !finiteTree(value.frames) || !finiteTree(value.pairStats) || !finiteTree(value.calls) ||
    value.calls.angularUpdates !== 4 || value.calls.freeIntegrations !== 4 || value.calls.motorCalls !== 2 ||
    value.calls.projectionCalls !== 2 || value.calls.reportCalls !== 2 || value.contactPasses !== 8 ||
    value.pairStats.eligiblePairs !== 32 || value.pairStats.candidatePairs !== 32 || value.pairStats.aabbTests !== 0 ||
    !ordinaryDense(value.contactChecks, 32)) worldFailure('diagnostics');
  for (const key of FRAME_KEYS) if (!ordinaryDense(value.frames[key], 4)) worldFailure('diagnostics');
  for (const pair of value.pairs) validatePairDiagnostic(pair);
  for (let i = 0; i < value.contactChecks.length; i++) {
    const check = value.contactChecks[i];
    if (!ownData(check, ['pass', 'pairIndex', 'aId', 'bId', 'aPositionM', 'bPositionM', 'hit']) ||
      check.pass !== Math.floor(i / 4) || check.pairIndex !== i % 4 || check.hit !== null ||
      !denseNumbers(check.aPositionM, 3) || !denseNumbers(check.bPositionM, 3) ||
      typeof check.aId !== 'string' || typeof check.bId !== 'string') worldFailure('diagnostics');
  }
}
