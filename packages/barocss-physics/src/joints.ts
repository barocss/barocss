import type { Body, Joint, PhysicsHingeMotorConfig, PhysicsJointState, Quat, Vec3 } from './types.js';
import { ID, MAX_STEP_DISPLACEMENT_M } from './limits.js';
import { error, record, fields, finite, vector } from './validation.js';
import { sub, worldPoint, multiplyQuaternion, inverse, dot, scale, rotate, inertia } from './math.js';
import { projectDynamicFixedJoint } from './dynamic-fixed-joint.js';
import { projectDynamicHingeJoint } from './dynamic-hinge-joint.js';

function denseJointVector(value: unknown, bound: number, label: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 ||
    ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error('INVALID_CONFIG', `${label} must be a dense 3-vector`);
  }
  return vector(value, -bound, bound, label);
}
export function parseJoints(value: unknown, bodies: Body[]): Joint[] {
  if (!Array.isArray(value) || value.length > 8 || Reflect.ownKeys(value).length !== value.length + 1 ||
    !Array.from({ length: value.length }, (_, index) => Object.hasOwn(value, index)).every(Boolean)) {
    error('INVALID_CONFIG', 'joints must be a dense array of at most 8');
  }
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seenIds = new Set<string>(), seenDynamic = new Set<string>();
  const joints = value.map((raw): Joint => {
    const input = record(raw, 'joint');
    if (input.kind !== 'fixed' && input.kind !== 'hinge') error('INVALID_CONFIG', 'unsupported joint kind');
    fields(input, input.kind === 'fixed'
      ? ['id', 'kind', 'aId', 'bId', 'anchorALocalM', 'anchorBLocalM']
      : ['id', 'kind', 'aId', 'bId', 'anchorALocalM', 'anchorBLocalM', 'axisWorld', 'limitRad', 'motor'], 'joint');
    if (typeof input.id !== 'string' || !ID.test(input.id) || seenIds.has(input.id)) {
      error('INVALID_CONFIG', 'joint IDs must be unique valid identifiers');
    }
    const a = typeof input.aId === 'string' ? byId.get(input.aId) : undefined;
    const b = typeof input.bId === 'string' ? byId.get(input.bId) : undefined;
    if (!a || !b || a.index === b.index || b.body.kind !== 'dynamic' ||
      seenDynamic.has(b.body.id)) {
      error('INVALID_CONFIG', 'joint needs a distinct A and unique dynamic B');
    }
    if (a.body.kind === 'dynamic' && (value.length !== 1 ||
      bodies.length !== 2 || a.body.shape.kind !== 'sphere' || b.body.shape.kind !== 'sphere')) {
      error('INVALID_CONFIG', 'dynamic pair supports one joint between two dynamic spheres');
    }
    const anchorALocalM = denseJointVector(input.anchorALocalM, 100, 'anchorALocalM');
    const anchorBLocalM = denseJointVector(input.anchorBLocalM, 100, 'anchorBLocalM');
    if (Math.hypot(...sub(worldPoint(a.body, anchorALocalM), worldPoint(b.body, anchorBLocalM))) > 1e-6) {
      error('INVALID_CONFIG', 'initial joint anchors must coincide');
    }
    let axisWorld: Vec3 | undefined, limitRad: [number, number] | undefined;
    let motor: PhysicsHingeMotorConfig | undefined;
    if (input.kind === 'hinge') {
      axisWorld = denseJointVector(input.axisWorld, 1 + 1e-9, 'axisWorld');
      if (Math.abs(Math.hypot(...axisWorld) - 1) > 1e-9) error('INVALID_CONFIG', 'hinge axis must be unit length');
      const limits = input.limitRad;
      if (!Array.isArray(limits) || limits.length !== 2 || Reflect.ownKeys(limits).length !== 3 ||
        ![0, 1].every((index) => Object.hasOwn(limits, index))) {
        error('INVALID_CONFIG', 'hinge limits must be a dense pair');
      }
      const low = finite(limits[0], -Math.PI / 2, 0, 'limitRad[0]');
      const high = finite(limits[1], 0, Math.PI / 2, 'limitRad[1]');
      limitRad = [low, high];
      if (Object.hasOwn(input, 'motor')) {
        const motorInput = record(input.motor, 'motor');
        fields(motorInput, ['targetSpeedRadps', 'maxImpulseNms', 'maxReactionNms'], 'motor');
        const targetSpeedRadps = finite(motorInput.targetSpeedRadps, -2, 2, 'motor.targetSpeedRadps');
        const maxImpulseNms = finite(motorInput.maxImpulseNms, 0, 0.05, 'motor.maxImpulseNms');
        const maxReactionNms = finite(motorInput.maxReactionNms, 0, 1, 'motor.maxReactionNms');
        if (maxImpulseNms === 0 || maxReactionNms === 0) {
          error('INVALID_CONFIG', 'motor impulse and reaction limits must be positive');
        }
        motor = { targetSpeedRadps, maxImpulseNms, maxReactionNms };
      }
    }
    seenIds.add(input.id);
    seenDynamic.add(b.body.id);
    return { id: input.id, kind: input.kind, aIndex: a.index, bIndex: b.index,
      anchorALocalM, anchorBLocalM,
      referenceOrientation: input.kind === 'fixed'
        ? multiplyQuaternion(inverse(a.body.orientation), b.body.orientation)
        : [...b.body.orientation],
      ...(axisWorld ? { axisWorld } : {}), ...(limitRad ? { limitRad } : {}),
      ...(motor ? { motor } : {}) };
  });
  return joints;
}
export function projectJoint(joint: Joint, next: Body[], previous: Body[], dt: number): PhysicsJointState {
  const a = next[joint.aIndex], b = next[joint.bIndex];
  if (a.kind === 'dynamic') return joint.kind === 'fixed'
    ? projectDynamicFixedJoint(joint, next, dt) : projectDynamicHingeJoint(joint, next, dt);
  const beforeVelocity = [...b.velocityMps] as Vec3;
  const beforeAngular = [...b.angularVelocityRadps] as Vec3;
  let targetOrientation: Quat, angleRad: number | undefined;
  if (joint.kind === 'fixed') {
    targetOrientation = multiplyQuaternion(a.orientation, joint.referenceOrientation);
    b.angularVelocityRadps = [0, 0, 0];
  } else {
    const axis = joint.axisWorld!;
    const delta = multiplyQuaternion(b.orientation, inverse(joint.referenceOrientation));
    const signed = dot([delta[0], delta[1], delta[2]], axis);
    const raw = 2 * Math.atan2(signed, delta[3]);
    const wrapped = raw > Math.PI ? raw - 2 * Math.PI : raw < -Math.PI ? raw + 2 * Math.PI : raw;
    angleRad = Math.max(joint.limitRad![0], Math.min(joint.limitRad![1], wrapped));
    const half = angleRad / 2;
    targetOrientation = multiplyQuaternion([axis[0] * Math.sin(half), axis[1] * Math.sin(half),
      axis[2] * Math.sin(half), Math.cos(half)], joint.referenceOrientation);
    let speed = dot(b.angularVelocityRadps, axis);
    if ((angleRad === joint.limitRad![0] && speed < 0) ||
      (angleRad === joint.limitRad![1] && speed > 0)) speed = 0;
    b.angularVelocityRadps = scale(axis, speed);
  }
  const norm = Math.hypot(...targetOrientation);
  b.orientation = targetOrientation.map((value) => value / norm) as Quat;
  const targetPosition = sub(worldPoint(a, joint.anchorALocalM), rotate(b.orientation, joint.anchorBLocalM));
  if (Math.hypot(...sub(targetPosition, b.positionM)) > MAX_STEP_DISPLACEMENT_M) {
    error('NUMERIC_LIMIT', `${joint.id} projection exceeded movement limit`);
  }
  b.positionM = targetPosition;
  b.velocityMps = scale(sub(targetPosition, previous[joint.bIndex].positionM), 1 / dt);
  return { id: joint.id, kind: joint.kind, aId: a.id, bId: b.id,
    linearImpulseNs: scale(sub(b.velocityMps, beforeVelocity), 1 / b.inverseMass),
    angularImpulseNms: inertia(b, sub(b.angularVelocityRadps, beforeAngular)),
    ...(angleRad === undefined ? {} : { angleRad }) };
}
