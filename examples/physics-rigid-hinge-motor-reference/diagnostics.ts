import type { Joint, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { add, sub, dot } from '../../packages/barocss-physics/src/math.js';
import { measureBodies } from '../physics-rigid-hinge-velocity-reference/diagnostics.js';
import { copyData, ownData, denseNumbers } from './copy.js';
import { diagnosticsError } from './errors.js';
import type { BodyCorrection, EnergyByPhase, Frames, HingeMotorDiagnostics, MotorDiagnostics,
  PairBodies, ProjectionOutput, ReportCap, WorkDiagnostics, ActionRecord } from './types.js';

function spinMidpoint(before: PairBodies, after: PairBodies): [number, number] {
  return before.map((body, i) => (.5 * body.inertiaKgM2!) * dot(
    sub(after[i].angularVelocityRadps, body.angularVelocityRadps),
    add(body.angularVelocityRadps, after[i].angularVelocityRadps))) as [number, number];
}

/** The parent observer fixes the arithmetic and measurement fields for all five frames. */
export function makeDiagnostics(input: {
  sourceStepIndex: number; sourceTimeSeconds: number; acceptedReportAngleRad: number;
  parsedActions: [ActionRecord, ActionRecord]; frames: Frames; joint: Joint; origin: Vec3;
  motor: MotorDiagnostics; projection: ProjectionOutput;
  bodyCorrections: [BodyCorrection, BodyCorrection]; reportCap: ReportCap;
}): HingeMotorDiagnostics {
  const frames = input.frames;
  const metrics = {
    source: measureBodies(frames.sourceBodies, input.joint, input.origin),
    angular: measureBodies(frames.angularBodies, input.joint, input.origin),
    motor: measureBodies(frames.motorBodies, input.joint, input.origin),
    free: measureBodies(frames.freeBodies, input.joint, input.origin),
    projected: measureBodies(frames.projectedBodies, input.joint, input.origin),
  };
  const energyByPhase: EnergyByPhase = { sourceJ: metrics.source.energyJ, angularJ: metrics.angular.energyJ,
    motorJ: metrics.motor.energyJ, freeJ: metrics.free.energyJ, projectedJ: metrics.projected.energyJ };
  const externalAngularByBodyJ = spinMidpoint(frames.sourceBodies, frames.angularBodies);
  const motorByBody = spinMidpoint(frames.angularBodies, frames.motorBodies);
  const motorMidpointJ = (input.motor.impulseNms *
    (input.motor.relativeSpeedBeforeRadps + input.motor.relativeSpeedAfterRadps)) * .5;
  const motorSpinMidpointJ = motorByBody[0] + motorByBody[1];
  const work: WorkDiagnostics = {
    externalAngularByBodyJ, externalAngularTotalJ: externalAngularByBodyJ[0] + externalAngularByBodyJ[1],
    motorMidpointJ, motorSpinMidpointJ, motorResidualJ: motorSpinMidpointJ - motorMidpointJ,
    freeDeltaKJ: energyByPhase.freeJ - energyByPhase.motorJ,
    projectionDeltaKJ: energyByPhase.projectedJ - energyByPhase.freeJ,
    projectionObjectiveJ: input.projection.diagnostics.projection.objectiveJ,
  };
  const result: HingeMotorDiagnostics = {
    sourceStepIndex: input.sourceStepIndex, sourceTimeSeconds: input.sourceTimeSeconds,
    acceptedReportAngleRad: input.acceptedReportAngleRad,
    rawSourceAngleRad: metrics.source.relativeAngleRad, rawFreeAngleRad: metrics.free.relativeAngleRad,
    rawFinalAngleRad: metrics.projected.relativeAngleRad, parsedActions: copyData(input.parsedActions),
    frames: copyData(frames), metrics: copyData(metrics), motor: copyData(input.motor),
    projection: copyData(input.projection), bodyCorrections: copyData(input.bodyCorrections),
    energyByPhase: copyData(energyByPhase), work: copyData(work), reportCap: copyData(input.reportCap),
    calls: { motorCalls: 1, projectionCalls: 1 },
  };
  validateDiagnostics(result);
  return copyData(result);
}

/** Internal known data only. Signed work, momentum and energy changes remain signed. */
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

export function validateDiagnostics(value: HingeMotorDiagnostics): void {
  const keys = ['sourceStepIndex', 'sourceTimeSeconds', 'acceptedReportAngleRad', 'rawSourceAngleRad',
    'rawFreeAngleRad', 'rawFinalAngleRad', 'parsedActions', 'frames', 'metrics', 'motor', 'projection',
    'bodyCorrections', 'energyByPhase', 'work', 'reportCap', 'calls'];
  if (!ownData(value, keys) || !Number.isSafeInteger(value.sourceStepIndex) || value.sourceStepIndex < 0 ||
    value.sourceStepIndex > 3600 || value.sourceTimeSeconds !== value.sourceStepIndex * (1 / 120)) diagnosticsError();
  if (!Array.isArray(value.parsedActions) || value.parsedActions.length !== 2 ||
    Reflect.ownKeys(value.parsedActions).length !== 3) diagnosticsError();
  for (let i = 0; i < 2; i++) {
    const action = ownData(value.parsedActions[i], ['bodyId', 'torqueNm', 'angularImpulseNms']);
    if (!action || action.bodyId !== value.frames.sourceBodies[i].id ||
      action.torqueNm !== null && denseNumbers(action.torqueNm, 3) === null ||
      action.angularImpulseNms !== null && denseNumbers(action.angularImpulseNms, 3) === null) diagnosticsError();
  }
  for (const key of keys.filter(k => k !== 'parsedActions')) {
    if (!finiteTree((value as unknown as Record<string, unknown>)[key])) diagnosticsError();
  }
  if (!ownData(value.frames, ['sourceBodies', 'angularBodies', 'motorBodies', 'freeBodies', 'projectedBodies']) ||
    Object.values(value.frames).some(pair => pair.length !== 2) ||
    !ownData(value.metrics, ['source', 'angular', 'motor', 'free', 'projected']) ||
    !ownData(value.motor, ['inputAngleRad', 'targetSpeedRadps', 'limitRad', 'maxImpulseNms', 'blocked',
      'impulseNms', 'relativeSpeedBeforeRadps', 'relativeSpeedAfterRadps']) ||
    !ownData(value.projection, ['bodies', 'poseReport', 'diagnostics']) ||
    !ownData(value.energyByPhase, ['sourceJ', 'angularJ', 'motorJ', 'freeJ', 'projectedJ']) ||
    !ownData(value.work, ['externalAngularByBodyJ', 'externalAngularTotalJ', 'motorMidpointJ',
      'motorSpinMidpointJ', 'motorResidualJ', 'freeDeltaKJ', 'projectionDeltaKJ', 'projectionObjectiveJ']) ||
    !ownData(value.reportCap, ['angularReactionNormNms', 'maxReactionNms', 'exceedsCap']) ||
    !ownData(value.calls, ['motorCalls', 'projectionCalls']) ||
    value.calls.motorCalls !== 1 || value.calls.projectionCalls !== 1 ||
    Object.values(value.energyByPhase).some(energy => energy < 0) || value.work.projectionObjectiveJ < 0 ||
    !denseNumbers(value.work.externalAngularByBodyJ, 2) || value.reportCap.maxReactionNms !== .01 ||
    value.reportCap.exceedsCap !== (value.reportCap.angularReactionNormNms > .01)) diagnosticsError();
}
