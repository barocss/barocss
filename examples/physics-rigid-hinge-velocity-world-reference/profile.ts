import type { Body, Joint, PhysicsBodyConfig, PhysicsWorldConfig, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { MAX_BODIES, MAX_LARGE_BODIES } from '../../packages/barocss-physics/src/limits.js';
import { record, fields, finite, vector, parseBody, copyBody, error, copyShape } from '../../packages/barocss-physics/src/validation.js';
import { parseJoints } from '../../packages/barocss-physics/src/joints.js';
import { admitDynamicHingeScene } from '../../packages/barocss-physics/src/dynamic-hinge-joint.js';
import { admitCcd } from '../../packages/barocss-physics/src/ccd.js';
import { copyData, copyBodies } from './copy.js';
import { worldFailure } from './errors.js';
import type { WorldProfile } from './types.js';

export const PRIVATE_GROUP_PROFILE = 'private multi-hinge reference requires literal HINGE2 fixture';
const equal = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Original archived1279 configuration checks; retain their exact first error. */
function admitPrivateConfiguration(input: Record<string, unknown>, bodies: Body[], gravity: Vec3, dt: number): void {
  if (dt !== 1 / 120 || !equal(gravity, [0, 0, 0]) || bodies.length !== 4 ||
    ['broadPhase', 'sceneMode', 'contactMode'].some(key => Object.hasOwn(input, key))) error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
  for (const body of bodies) {
    const match = /^pair([AB])([01])$/.exec(body.id);
    if (!match || body.kind !== 'dynamic' || body.shape.kind !== 'sphere' || body.shape.radiusM !== .1 ||
      body.inverseMass !== 1 || body.restitution !== 0 || body.sensor || body.ccd || body.collisionFilter ||
      body.frictionStatic !== 1 || body.frictionDynamic !== .7 || !equal(body.velocityMps, [0, 0, 0]) ||
      !equal(body.angularVelocityRadps, [0, 0, 0]) || !equal(body.orientation, [0, 0, 0, 1]) ||
      !equal(body.positionM, [match[1] === 'A' ? -.1 : .1, 0, Number(match[2])]) ||
      body.inertiaKgM2 !== 0.4 * .1 ** 2) error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
  }
}
function parsePrivateGroups(value: unknown, bodies: Body[]): Joint[] {
  if (!Array.isArray(value) || value.length !== 2 || Reflect.ownKeys(value).length !== 3 ||
    ![0, 1].every(i => Object.hasOwn(value, i))) error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
  const byId = new Map(bodies.map((body, index) => [body.id, { body, index }]));
  const seen = new Set<string>();
  return value.map((raw): Joint => {
    if (!raw || typeof raw !== 'object') error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
    const input = raw as Record<string, unknown>;
    const match = typeof input.id === 'string' ? /^hinge([01])$/.exec(input.id) : null;
    if (!match || input.kind !== 'hinge' || input.aId !== `pairA${match[1]}` || input.bId !== `pairB${match[1]}` ||
      seen.has(String(input.aId)) || seen.has(String(input.bId))) error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
    const a = byId.get(String(input.aId)), b = byId.get(String(input.bId));
    if (!a || !b) error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
    const local = parseJoints([raw], [a.body, b.body])[0];
    if (!equal(local.anchorALocalM, [.1, 0, 0]) || !equal(local.anchorBLocalM, [-.1, 0, 0]) ||
      !equal(local.axisWorld!, [0, 0, 1]) || !equal(local.limitRad!, [-.8, .8]) ||
      local.motor?.targetSpeedRadps !== .5 || local.motor.maxImpulseNms !== .0001 || local.motor.maxReactionNms !== .01)
      error('INVALID_CONFIG', PRIVATE_GROUP_PROFILE);
    seen.add(a.body.id); seen.add(b.body.id);
    return { ...local, aIndex: a.index, bIndex: b.index };
  });
}
function admitPrivateHingeScene(joint: Joint, bodies: Body[], gravity: Vec3): void {
  const inspected = bodies.map(copyBody), z = bodies[joint.aIndex].positionM[2];
  for (const index of [joint.aIndex, joint.bIndex]) inspected[index].positionM[2] -= z;
  admitDynamicHingeScene(joint, inspected, gravity);
}
function denseBodyArray(value: unknown[]): boolean {
  return Object.getPrototypeOf(value) === Array.prototype && Reflect.ownKeys(value).length === value.length + 1 &&
    Array.from({ length: value.length }, (_, i) => i).every(i => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      return !!descriptor && descriptor.enumerable && 'value' in descriptor;
    });
}
function restBodyConfig(body: Body): PhysicsBodyConfig {
  return { id: body.id, kind: 'dynamic', shape: copyShape(body.shape), positionM: [...body.positionM],
    velocityMps: [...body.velocityMps], angularVelocityRadps: [...body.angularVelocityRadps], orientation: [...body.orientation],
    massKg: 1 / body.inverseMass, restitution: body.restitution,
    friction: { static: body.frictionStatic, dynamic: body.frictionDynamic } };
}

export function admitWorldProfile(config: PhysicsWorldConfig): WorldProfile {
  const input = record(config, 'world');
  fields(input, ['fixedStepSeconds', 'gravityMps2', 'bodies', 'joints', 'broadPhase', 'contactMode', 'sceneMode'], 'world');
  if (Object.hasOwn(input, 'sceneMode') && input.sceneMode !== 'large-v1') error('INVALID_CONFIG', 'sceneMode must be large-v1 when present');
  if (Object.hasOwn(input, 'broadPhase') && input.broadPhase !== 'aabb') error('INVALID_CONFIG', 'broadPhase must be aabb when present');
  if (Object.hasOwn(input, 'contactMode') && input.contactMode !== 'persistent-box-v1') error('INVALID_CONFIG', 'contactMode must be persistent-box-v1 when present');
  const useAabb = input.broadPhase === 'aabb', usePersistentBox = input.contactMode === 'persistent-box-v1';
  const largeMode = input.sceneMode === 'large-v1';
  if (largeMode && (!useAabb || usePersistentBox || Object.hasOwn(input, 'joints'))) {
    error('INVALID_CONFIG', 'large-v1 requires aabb and excludes joints and persistent-box-v1');
  }
  const dt = finite(input.fixedStepSeconds, 1 / 240, 1 / 30, 'fixedStepSeconds');
  const gravity = vector(input.gravityMps2, -1000, 1000, 'gravityMps2');
  const bodyLimit = largeMode ? MAX_LARGE_BODIES : MAX_BODIES;
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > bodyLimit) {
    error('INVALID_CONFIG', `bodies must contain 1..${bodyLimit} entries`);
  }
  if (usePersistentBox && input.bodies.length > 4) error('INVALID_CONFIG', 'persistent-box-v1 admits at most four bodies');
  if (!denseBodyArray(input.bodies)) worldFailure('profile');
  const bodies = input.bodies.map(value => parseBody(value, largeMode));
  if (largeMode && bodies.some(body => body.ccd)) error('INVALID_CONFIG', 'large-v1 excludes CCD');
  if (!bodies.some(body => body.kind === 'dynamic')) error('INVALID_CONFIG', 'at least one dynamic body is required');
  if (new Set(bodies.map(body => body.id)).size !== bodies.length) error('INVALID_CONFIG', 'duplicate body ID');
  admitPrivateConfiguration(input, bodies, gravity, dt);
  const joints = parsePrivateGroups(input.joints, bodies);
  const dynamicHinges = joints.filter(joint => joint.kind === 'hinge' && bodies[joint.aIndex].kind === 'dynamic');
  for (const hinge of dynamicHinges) admitPrivateHingeScene(hinge, bodies, gravity);
  const ccd = admitCcd(bodies, joints.length, gravity);
  if (ccd.kind === 'box-pair' && usePersistentBox) error('INVALID_CONFIG', 'box CCD excludes persistent-box-v1');
  if (bodies.some((body, i) => body.id !== ['pairA0', 'pairB0', 'pairA1', 'pairB1'][i]) ||
    joints.some((joint, i) => joint.id !== ['hinge0', 'hinge1'][i]) ||
    input.bodies.some(raw => Object.hasOwn(raw, 'inertiaKgM2') || Object.hasOwn(raw, 'inertiaDiagonalKgM2'))) worldFailure('profile');
  const disabledPairs = new Set(joints.map(joint => [bodies[joint.aIndex].id, bodies[joint.bIndex].id].sort().join('\u0000')));
  const pairs: Array<[number, number]> = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      if (disabledPairs.has([bodies[a].id, bodies[b].id].sort().join('\u0000'))) continue;
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 : bodies[left[0]].id > bodies[right[0]].id ? 1 :
    bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  const localJoints = joints.map(joint => ({ ...copyData(joint), aIndex: 0, bIndex: 1 })) as [Joint, Joint];
  const pairConfigs = joints.map(joint => ({ fixedStepSeconds: dt, gravityMps2: [...gravity] as Vec3,
    bodies: [restBodyConfig(bodies[joint.aIndex]), restBodyConfig(bodies[joint.bIndex])],
    joints: [{ id: joint.id, kind: 'hinge' as const, aId: bodies[joint.aIndex].id, bId: bodies[joint.bIndex].id,
      anchorALocalM: [...joint.anchorALocalM] as Vec3, anchorBLocalM: [...joint.anchorBLocalM] as Vec3,
      axisWorld: [...joint.axisWorld!] as Vec3, limitRad: [...joint.limitRad!] as [number, number], motor: { ...joint.motor! } }],
  })) as [PhysicsWorldConfig, PhysicsWorldConfig];
  return { dt, gravity: [...gravity], bodies: copyBodies(bodies), joints: copyData(joints) as [Joint, Joint],
    pairs, pairConfigs, localJoints };
}
