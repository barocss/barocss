import type { Joint, Vec3, PhysicsState } from '../../packages/barocss-physics/src/types.js';
import { error, type AdmittedCommands } from '../../packages/barocss-physics/src/validation.js';
import { add, sub, scale, dot, inverseInertia, advanceOrientation } from '../../packages/barocss-physics/src/math.js';
import { driveDynamicHingeMotor } from '../../packages/barocss-physics/src/joint-motor.js';
import { MAX_STEP_DISPLACEMENT_M } from '../../packages/barocss-physics/src/limits.js';
import { copyData } from './copy.js';
import type { ActionRecord, Calls, MotorDiagnostics, PairBodies } from './types.js';

export function actionRecords(bodies: PairBodies, actions: Map<string, AdmittedCommands>): [ActionRecord, ActionRecord] {
  return bodies.map(body => {
    const action = actions.get(body.id);
    return { bodyId: body.id, torqueNm: action?.torqueNm ? [...action.torqueNm] as Vec3 : null,
      angularImpulseNms: action?.angularImpulseNms ? [...action.angularImpulseNms] as Vec3 : null };
  }) as [ActionRecord, ActionRecord];
}

/** Original World angular update, A then B, including the empty additions. */
export function applyAngularCommands(bodies: PairBodies, actions: Map<string, AdmittedCommands>, dt: number): void {
  for (const body of bodies) {
    const action = actions.get(body.id);
    body.angularVelocityRadps = add(body.angularVelocityRadps,
      inverseInertia(body, add(action?.angularImpulseNms ?? [0, 0, 0],
        scale(action?.torqueNm ?? [0, 0, 0], dt))));
  }
}

/** The incoming report is the original motor angle argument, without geometry substitution. */
export function applyOriginalMotor(bodies: PairBodies, joint: Joint, angleRad: number, calls: Calls): MotorDiagnostics {
  const a = bodies[joint.aIndex], b = bodies[joint.bIndex], motor = joint.motor!, axis = joint.axisWorld!;
  const [low, high] = joint.limitRad!;
  const relativeSpeedBeforeRadps = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  const blocked = angleRad <= low && motor.targetSpeedRadps < 0 || angleRad >= high && motor.targetSpeedRadps > 0;
  calls.motorCalls = 1;
  const impulseNms = driveDynamicHingeMotor(joint, a, b, angleRad);
  const relativeSpeedAfterRadps = dot(sub(b.angularVelocityRadps, a.angularVelocityRadps), axis);
  return { inputAngleRad: angleRad, targetSpeedRadps: motor.targetSpeedRadps,
    limitRad: [low, high], maxImpulseNms: motor.maxImpulseNms, blocked, impulseNms,
    relativeSpeedBeforeRadps, relativeSpeedAfterRadps };
}

/** Original dynamic integration order and limits; no extra result validation. */
export function integrateFree(bodies: PairBodies, actions: Map<string, AdmittedCommands>,
  gravity: Vec3, dt: number): void {
  for (const body of bodies) {
    const action = actions.get(body.id);
    if (body.angularVelocityRadps.some(value => !Number.isFinite(value) || Math.abs(value) > 1000) ||
      Math.hypot(...body.angularVelocityRadps) * dt > 10) {
      error('NUMERIC_LIMIT', `${body.id} exceeded angular movement limit`);
    }
    body.orientation = advanceOrientation(body.orientation, body.angularVelocityRadps, dt);
    for (let i = 0; i < 3; i++) {
      body.velocityMps[i] += (action?.impulseNs?.[i] ?? 0) * body.inverseMass;
      body.velocityMps[i] += (gravity[i] + (action?.forceN?.[i] ?? 0) * body.inverseMass) * dt;
    }
    if (Math.hypot(...body.velocityMps) * dt > MAX_STEP_DISPLACEMENT_M) {
      error('NUMERIC_LIMIT', `${body.id} exceeded step displacement limit`);
    }
    for (let i = 0; i < 3; i++) body.positionM[i] += body.velocityMps[i] * dt;
  }
}

/** Replace only raw13 fields. Original carrier metadata, memory and cursor remain. */
export function makeFreeCarrier(carrier: PhysicsState, free: PairBodies): PhysicsState {
  const result = copyData(carrier);
  for (let i = 0; i < 2; i++) {
    result.bodies[i].positionM = [...free[i].positionM];
    result.bodies[i].velocityMps = [...free[i].velocityMps];
    result.bodies[i].orientation = [...free[i].orientation];
    result.bodies[i].angularVelocityRadps = [...free[i].angularVelocityRadps];
  }
  return result;
}
