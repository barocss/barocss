import type { Body, PhysicsBodyState, PhysicsJointState, PhysicsState } from '../../packages/barocss-physics/src/types.js';
import { copyShape } from '../../packages/barocss-physics/src/validation.js';
import { projectHingePoseVelocityReference } from '../physics-rigid-hinge-velocity-reference/candidate.js';
import { makeReport } from '../physics-rigid-hinge-motor-reference/report.js';
import { copyData, copyBodies, copyPair } from './copy.js';
import { makePairDiagnostic } from './diagnostics.js';
import type { PairBodies, PairOperation, ProjectionOutput, WorldAttempt, WorldProfile } from './types.js';

/** Exactly one adopted projection. This adapter performs no motor, FREE or contact work. */
export function projectPostContactPairReference(config: WorldProfile['pairConfigs'][number], carrier: PhysicsState,
  dt: number): ProjectionOutput {
  return copyData(projectHingePoseVelocityReference(config, carrier, dt));
}
export function beginPairCall(attempt: WorldAttempt, index: 0 | 1, operation: PairOperation): void {
  const key = operation === 'motor' ? 'motorCalls' : operation === 'projection' ? 'projectionCalls' : 'reportCalls';
  attempt.calls[key]++;
  attempt.pairProgress[index].calls[key] = 1;
  attempt.pairProgress[index].lastCall = { operation, ordinal: attempt.calls[key] as 1 | 2, outcome: 'started' };
}
export function completePairCall(attempt: WorldAttempt, index: 0 | 1, operation: PairOperation): void {
  const key = operation === 'motor' ? 'motorCalls' : operation === 'projection' ? 'projectionCalls' : 'reportCalls';
  attempt.pairProgress[index].completedCalls[key] = 1;
  attempt.pairProgress[index].lastCall!.outcome = 'returned';
}
function publicCarrierBody(body: Body): PhysicsBodyState {
  return { id: body.id, kind: body.kind, shape: copyShape(body.shape), positionM: [...body.positionM],
    velocityMps: [...body.velocityMps], orientation: [...body.orientation], angularVelocityRadps: [...body.angularVelocityRadps],
    inertiaKgM2: body.inertiaKgM2! };
}
function pairRawHex(bodies: PairBodies): string {
  const bytes = new Uint8Array(208), view = new DataView(bytes.buffer);
  let cursor = 0;
  for (const body of bodies) for (const value of [...body.positionM, ...body.velocityMps, ...body.orientation, ...body.angularVelocityRadps]) {
    view.setFloat64(cursor, value, true); cursor += 8;
  }
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export function runPostContactStage(profile: WorldProfile, next: Body[], attempt: WorldAttempt,
  jointStates: readonly PhysicsJointState[]): void {
  const postContact = attempt.frames.postContactBodies!;
  for (const index of [0, 1] as const) {
    const global = profile.joints[index], local = profile.localJoints[index];
    const before = copyPair([postContact[global.aIndex], postContact[global.bIndex]]);
    const carrier: PhysicsState = { stepIndex: attempt.sourceStepIndex, timeSeconds: attempt.sourceTimeSeconds,
      bodies: before.map(publicCarrierBody), contacts: [], events: [],
      joints: [{ ...copyData(jointStates[index]), angleRad: attempt.acceptedReportAnglesRad[index] }],
      ccdHits: [], pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 } };
    beginPairCall(attempt, index, 'projection');
    const projection = projectPostContactPairReference(profile.pairConfigs[index], carrier, profile.dt);
    completePairCall(attempt, index, 'projection');
    attempt.pairProgress[index].projection = copyData(projection);
    attempt.pairProgress[index].projectedRawHex = pairRawHex(copyPair(projection.bodies));
    const returned = copyPair(projection.bodies);
    next[global.aIndex] = returned[0];
    next[global.bIndex] = returned[1];
    beginPairCall(attempt, index, 'report');
    const report = makeReport(local, before, copyPair(projection.bodies), projection.poseReport.targetAngleRad,
      attempt.pairProgress[index].motor!.impulseNms);
    completePairCall(attempt, index, 'report');
    attempt.pairProgress[index].report = copyData(report);
    const diagnostic = makePairDiagnostic(profile, attempt, index);
    attempt.pairs[index] = copyData(diagnostic);
    attempt.stage = index === 0 ? 'pair0-ready' : 'pair1-ready';
  }
  attempt.frames.projectedBodies = copyBodies(next);
}
