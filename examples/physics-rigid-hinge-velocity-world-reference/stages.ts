import type { PhysicsContact, PhysicsEvent, PhysicsJointState, Vec3 } from '../../packages/barocss-physics/src/types.js';
import type { PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { error } from '../../packages/barocss-physics/src/validation.js';
import { add, scale, inverseInertia, advanceOrientation } from '../../packages/barocss-physics/src/math.js';
import { MAX_STEP_DISPLACEMENT_M, SOLVER_PASSES } from '../../packages/barocss-physics/src/limits.js';
import { detect, solve } from '../../packages/barocss-physics/src/collision.js';
import { applyOriginalMotor } from '../physics-rigid-hinge-motor-reference/motor-stages.js';
import { copyBodies, copyData } from './copy.js';
import { worldFailure } from './errors.js';
import { beginPairCall, completePairCall } from './postcontact-pair.js';
import type { Actions, Body, ContactStageResult, PairProgress, WorldActions, WorldAttempt, WorldProfile } from './types.js';
export { runPostContactStage } from './postcontact-pair.js';

const emptyPairCalls = () => ({ motorCalls: 0 as const, projectionCalls: 0 as const, reportCalls: 0 as const });
function progress(jointId: string): PairProgress {
  return { jointId, motor: null, projection: null, report: null, calls: emptyPairCalls(), completedCalls: emptyPairCalls(),
    lastCall: null, projectedRawHex: null };
}
export function makeWorldAttempt(profile: WorldProfile, sourceBodies: readonly Body[], jointStates: readonly PhysicsJointState[],
  sourceStepIndex: number, actions: Actions): WorldAttempt {
  const parsedActions = sourceBodies.map(body => {
    const action = actions.get(body.id);
    return { bodyId: body.id, torqueNm: action?.torqueNm ? [...action.torqueNm] as Vec3 : null,
      angularImpulseNms: action?.angularImpulseNms ? [...action.angularImpulseNms] as Vec3 : null };
  }) as WorldActions;
  return { stage: 'admitted', sourceStepIndex, sourceTimeSeconds: sourceStepIndex * profile.dt,
    attemptedStepIndex: sourceStepIndex + 1, attemptedTimeSeconds: (sourceStepIndex + 1) * profile.dt,
    acceptedReportAnglesRad: [jointStates[0].angleRad!, jointStates[1].angleRad!], parsedActions: copyData(parsedActions),
    frames: { sourceBodies: copyBodies(sourceBodies), angularBodies: null, motorBodies: null, freeBodies: null,
      postContactBodies: null, projectedBodies: null }, pairs: [null, null],
    pairProgress: [progress(profile.joints[0].id), progress(profile.joints[1].id)], contactPasses: 0,
    pairStats: { eligiblePairs: 0, candidatePairs: 0, aabbTests: 0 },
    calls: { angularUpdates: 0, freeIntegrations: 0, motorCalls: 0, projectionCalls: 0, reportCalls: 0 },
    contactChecks: [], error: null };
}

/** Global original1279 angular loop, including empty additions and body order. */
export function runAngularStage(_profile: WorldProfile, next: Body[], attempt: WorldAttempt, actions: Actions): void {
  for (const body of next) {
    if (body.kind !== 'dynamic') continue;
    attempt.calls.angularUpdates++;
    const action = actions.get(body.id);
    body.angularVelocityRadps = add(body.angularVelocityRadps,
      inverseInertia(body, add(action?.angularImpulseNms ?? [0, 0, 0],
        scale(action?.torqueNm ?? [0, 0, 0], _profile.dt))));
  }
  attempt.frames.angularBodies = copyBodies(next);
  attempt.stage = 'angular-ready';
}
export function runMotorStage(profile: WorldProfile, next: Body[], attempt: WorldAttempt, jointStates: readonly PhysicsJointState[]): void {
  for (const index of [0, 1] as const) {
    const joint = profile.joints[index];
    beginPairCall(attempt, index, 'motor');
    const motor = applyOriginalMotor([next[joint.aIndex], next[joint.bIndex]], profile.localJoints[index],
      jointStates[index].angleRad!, attempt.pairProgress[index].calls);
    completePairCall(attempt, index, 'motor');
    attempt.pairProgress[index].motor = copyData(motor);
  }
  attempt.frames.motorBodies = copyBodies(next);
  attempt.stage = 'motor-ready';
}

/** Original global dynamic integration, not a second pair-level FREE pass. */
export function runFreeStage(profile: WorldProfile, next: Body[], attempt: WorldAttempt, actions: Actions): void {
  for (const body of next) {
    if (body.kind !== 'dynamic') continue;
    attempt.calls.freeIntegrations++;
    const action = actions.get(body.id);
    if (body.angularVelocityRadps.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) ||
      Math.hypot(...body.angularVelocityRadps) * profile.dt > 10) {
      error('NUMERIC_LIMIT', `${body.id} exceeded angular movement limit`);
    }
    body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, profile.dt);
    for (let i = 0; i < 3; i++) {
      body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
      body.velocityMps[i] += (profile.gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * profile.dt;
    }
    if (Math.hypot(...body.velocityMps) * profile.dt > MAX_STEP_DISPLACEMENT_M) {
      error('NUMERIC_LIMIT', `${body.id} exceeded step displacement limit`);
    }
    for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * profile.dt;
  }
  attempt.frames.freeBodies = copyBodies(next);
  attempt.stage = 'free-ready';
}

/** Original selected default contact loop. Connected pairs and all old joint passes are excluded. */
export function runContactStage(profile: WorldProfile, next: Body[], attempt: WorldAttempt,
  _priorPersistentPoints: Map<string, PointImpulse>): ContactStageResult {
  const found = new Map<string, PhysicsContact>();
  const persistentPoints = new Map<string, PointImpulse>();
  const sensed = new Map<string, Omit<PhysicsEvent, 'phase'>>();
  for (let pass = 0; pass < SOLVER_PASSES; pass++) {
    for (let pairIndex = 0; pairIndex < profile.pairs.length; pairIndex++) {
      const [aIndex, bIndex] = profile.pairs[pairIndex];
      attempt.pairStats.eligiblePairs++;
      attempt.pairStats.candidatePairs++;
      const a = next[aIndex], b = next[bIndex];
      const aPositionM = [...a.positionM] as Vec3, bPositionM = [...b.positionM] as Vec3;
      const hit = detect(a, b);
      attempt.contactChecks.push({ pass, pairIndex, aId: a.id, bId: b.id, aPositionM, bPositionM, hit: copyData(hit) });
      if (!hit) continue;
      if (hit.penetration > MAX_STEP_DISPLACEMENT_M) error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
      const key = `${a.id}\u0000${b.id}`;
      if (a.sensor || b.sensor) {
        sensed.set(key, { aId: a.id, bId: b.id, kind: 'sensor' });
        continue;
      }
      let contact = found.get(key);
      if (!contact) {
        contact = { aId: a.id, bId: b.id, normalAtoB: [...hit.normal], pointM: [...hit.pointM],
          penetrationM: 0, impulseNs: 0, tangentImpulseNs: [0, 0, 0] };
        found.set(key, contact);
      }
      const points = [hit.pointM];
      contact.pointM = points.reduce((sum, point) => add(sum, point), [0, 0, 0] as Vec3)
        .map(value => value / points.length) as Vec3;
      contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
      const resolved = solve(a, b, hit);
      contact.impulseNs += resolved.normalImpulseNs;
      contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
    }
    attempt.contactPasses++;
  }
  attempt.frames.postContactBodies = copyBodies(next);
  attempt.stage = 'contact-ready';
  if (attempt.contactChecks.some(check => check.hit !== null)) worldFailure('contact');
  return { contacts: [...found.values()], persistentPoints, sensed };
}

/** Called only after the outer calculation catch classified the actual error. */
export function markKnownRefusedCall(attempt: WorldAttempt): void {
  for (const entry of attempt.pairProgress) {
    if (entry.lastCall?.outcome === 'started') entry.lastCall.outcome = 'known-refused';
  }
}
