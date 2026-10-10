// Minimum original private helper text plus parseBody; only its CCD predicate changes.
import type { Body, PhysicsCollisionFilter, PhysicsFriction, PhysicsShape, Quat, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { ID } from '../../packages/barocss-physics/src/limits.js';
import { record, fields, finite, vector, error } from '../../packages/barocss-physics/src/validation.js';

function angularVector(value: unknown): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4 ||
    ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    error('INVALID_CONFIG', 'angularVelocityRadps must be a dense 3-vector');
  }
  return vector(value, -1000, 1000, 'angularVelocityRadps');
}
function quaternion(value: unknown): Quat {
  if (!Array.isArray(value) || value.length !== 4 || Reflect.ownKeys(value).length !== 5 ||
    ![0, 1, 2, 3].every((index) => Object.hasOwn(value, index))) {
    error('INVALID_CONFIG', 'orientation must be a dense [x,y,z,w] quaternion');
  }
  const values = value.map((component) => finite(component, -1, 1, 'orientation')) as Quat;
  const magnitude = Math.hypot(...values);
  if (Math.abs(magnitude - 1) > 1e-6) error('INVALID_CONFIG', 'orientation must have unit norm');
  return values.map((component) => component / magnitude) as Quat;
}

function shape(value: unknown): PhysicsShape {
  const input = record(value, 'shape');
  if (input.kind === 'sphere') {
    fields(input, ['kind', 'radiusM'], 'sphere');
    return { kind: 'sphere', radiusM: finite(input.radiusM, 0.0001, 1000, 'radiusM') };
  }
  if (input.kind === 'box') {
    fields(input, ['kind', 'halfExtentsM'], 'box');
    return { kind: 'box', halfExtentsM: vector(input.halfExtentsM, 0.0001, 1000, 'halfExtentsM') };
  }
  if (input.kind === 'capsule') {
    fields(input, ['kind', 'radiusM', 'halfLengthM'], 'capsule');
    return { kind: 'capsule', radiusM: finite(input.radiusM, 0.0001, 1000, 'radiusM'),
      halfLengthM: finite(input.halfLengthM, 0.0001, 1000, 'halfLengthM') };
  }
  return error('INVALID_CONFIG', 'unsupported collider shape');
}
function friction(value: unknown): PhysicsFriction {
  const input = record(value, 'friction');
  fields(input, ['static', 'dynamic'], 'friction');
  const staticCoefficient = finite(input.static, 0, 2, 'friction.static');
  const dynamicCoefficient = finite(input.dynamic, 0, staticCoefficient, 'friction.dynamic');
  return { static: staticCoefficient, dynamic: dynamicCoefficient };
}
function collisionFilter(value: unknown): PhysicsCollisionFilter {
  const input = record(value, 'collisionFilter');
  fields(input, ['categoryBits', 'maskBits'], 'collisionFilter');
  if (!Number.isInteger(input.categoryBits) || !Number.isInteger(input.maskBits)) {
    error('INVALID_CONFIG', 'collision filter bits must be integers');
  }
  return { categoryBits: finite(input.categoryBits, 1, 65535, 'categoryBits'),
    maskBits: finite(input.maskBits, 0, 65535, 'maskBits') };
}
export function parseCandidateBody(value: unknown, largeMode = false): Body {
  const input = record(value, 'body');
  if (typeof input.id !== 'string' || !ID.test(input.id)) error('INVALID_CONFIG', 'invalid body ID');
  if (input.kind !== 'dynamic' && input.kind !== 'static' && input.kind !== 'kinematic') {
    error('INVALID_CONFIG', 'invalid body kind');
  }
  const kind = input.kind;
  fields(input, kind === 'dynamic'
    ? ['id', 'kind', 'shape', 'positionM', 'velocityMps', 'massKg', 'restitution',
      'orientation', 'angularVelocityRadps', 'inertiaKgM2', 'friction', 'ccd',
      ...(largeMode ? ['collisionFilter'] : [])]
    : ['id', 'kind', 'shape', 'positionM', 'restitution', 'orientation', 'sensor', 'friction',
      ...(largeMode ? ['collisionFilter'] : [])], 'body');
  if (Object.hasOwn(input, 'sensor') && input.sensor !== true) error('INVALID_CONFIG', 'sensor must be true');
  const sensor = input.sensor === true;
  const parsedShape = shape(input.shape);
  if (Object.hasOwn(input, 'ccd') && (input.ccd !== true ||
    (parsedShape.kind !== 'sphere' && parsedShape.kind !== 'box' &&
      !(kind === 'dynamic' && parsedShape.kind === 'capsule')))) {
    error('INVALID_CONFIG', 'ccd is supported for dynamic spheres or boxes only and must be true');
  }
  const positionM = vector(input.positionM, -10000, 10000, 'positionM');
  const restitution = finite(input.restitution, 0, 1, 'restitution');
  const material = Object.hasOwn(input, 'friction') ? friction(input.friction) : { static: 0, dynamic: 0 };
  const filter = largeMode ? Object.hasOwn(input, 'collisionFilter')
    ? collisionFilter(input.collisionFilter) : { categoryBits: 1, maskBits: 65535 } : undefined;
  const orientation = Object.hasOwn(input, 'orientation') ? quaternion(input.orientation) : [0, 0, 0, 1] as Quat;
  if (kind !== 'dynamic') {
    return { id: input.id, kind, shape: parsedShape, positionM, velocityMps: [0, 0, 0],
      orientation, angularVelocityRadps: [0, 0, 0], inverseInertiaLocal: [0, 0, 0],
      sensor, inverseMass: 0, restitution,
      frictionStatic: material.static, frictionDynamic: material.dynamic,
      ...(filter ? { collisionFilter: filter } : {}) };
  }
  const massKg = finite(input.massKg, 0.000001, 1000000, 'massKg');
  if (parsedShape.kind !== 'sphere' && Object.hasOwn(input, 'inertiaKgM2')) {
    error('INVALID_CONFIG', 'inertiaKgM2 override is supported for spheres only');
  }
  const inertiaKgM2 = parsedShape.kind === 'sphere'
    ? Object.hasOwn(input, 'inertiaKgM2')
      ? finite(input.inertiaKgM2, 1e-12, 1e12, 'inertiaKgM2')
      : 0.4 * massKg * parsedShape.radiusM ** 2
    : undefined;
  const inertiaDiagonalKgM2: Vec3 | undefined = parsedShape.kind === 'box'
    ? [massKg / 3 * (parsedShape.halfExtentsM[1] ** 2 + parsedShape.halfExtentsM[2] ** 2),
      massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[2] ** 2),
      massKg / 3 * (parsedShape.halfExtentsM[0] ** 2 + parsedShape.halfExtentsM[1] ** 2)]
    : parsedShape.kind === 'capsule'
      ? Array(3).fill(0.4 * massKg * (parsedShape.radiusM + parsedShape.halfLengthM) ** 2) as Vec3
      : undefined;
  const inertia = inertiaDiagonalKgM2 ?? [inertiaKgM2!, inertiaKgM2!, inertiaKgM2!];
  return { id: input.id, kind, shape: parsedShape, positionM, sensor,
    ...(filter ? { collisionFilter: filter, sleeping: false } : {}),
    ...(input.ccd === true ? { ccd: true as const } : {}),
    velocityMps: vector(input.velocityMps, -1000, 1000, 'velocityMps'),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, 'angularVelocityRadps') ? angularVector(input.angularVelocityRadps) : [0, 0, 0],
    ...(inertiaKgM2 === undefined ? {} : { inertiaKgM2 }),
    ...(inertiaDiagonalKgM2 === undefined ? {} : { inertiaDiagonalKgM2 }),
    inverseInertiaLocal: inertia.map((value) => 1 / value) as Vec3,
    inverseMass: 1 / massKg, restitution,
    frictionStatic: material.static, frictionDynamic: material.dynamic };
}
