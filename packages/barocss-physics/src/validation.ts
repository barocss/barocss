import { PhysicsError } from './types.js';
import type { Body, PhysicsCollisionFilter, PhysicsErrorCode, PhysicsFriction, PhysicsShape, Quat, Vec3 } from './types.js';
import { ID, MAX_COMMANDS, MAX_FORCE_N, MAX_IMPULSE_NS, MAX_TORQUE_NM, MAX_ANGULAR_IMPULSE_NMS } from './limits.js';

export function error(code: PhysicsErrorCode, message: string): never { throw new PhysicsError(code, message); }
export function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) error('INVALID_CONFIG', `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) error('INVALID_CONFIG', `${label} must be a plain object`);
  return value as Record<string, unknown>;
}
export function fields(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    error('INVALID_CONFIG', `${label} has an unsupported field`);
  }
}
export function finite(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    error('INVALID_CONFIG', `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
export function vector(value: unknown, min: number, max: number, label: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) error('INVALID_CONFIG', `${label} must be a 3-vector`);
  return [0, 1, 2].map((index) => finite(value[index], min, max, `${label}[${index}]`)) as Vec3;
}
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
export function parseBody(value: unknown, largeMode = false): Body {
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
  if (Object.hasOwn(input, 'ccd') && (input.ccd !== true || parsedShape.kind !== 'sphere')) {
    error('INVALID_CONFIG', 'ccd is supported for dynamic spheres only and must be true');
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
export function copyShape(value: PhysicsShape): PhysicsShape {
  return value.kind === 'sphere' ? { kind: 'sphere', radiusM: value.radiusM }
    : value.kind === 'box' ? { kind: 'box', halfExtentsM: [...value.halfExtentsM] as Vec3 }
      : { kind: 'capsule', radiusM: value.radiusM, halfLengthM: value.halfLengthM };
}
export function copyBody(body: Body): Body {
  return { ...body, shape: copyShape(body.shape), positionM: [...body.positionM], velocityMps: [...body.velocityMps],
    orientation: [...body.orientation], angularVelocityRadps: [...body.angularVelocityRadps],
    ...(body.collisionFilter ? { collisionFilter: { ...body.collisionFilter } } : {}),
    ...(body.inertiaDiagonalKgM2 ? { inertiaDiagonalKgM2: [...body.inertiaDiagonalKgM2] as Vec3 } : {}),
    inverseInertiaLocal: [...body.inverseInertiaLocal] };
}
export type AdmittedCommands = { forceN?: Vec3; impulseNs?: Vec3; torqueNm?: Vec3; angularImpulseNms?: Vec3; positionM?: Vec3 };
function commandVector(input: unknown, bound: number, label: string): Vec3 {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 ||
    ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error('INVALID_COMMAND', `${label} must be a dense 3-vector`);
  }
  const result = [input[0], input[1], input[2]];
  if (result.some((value) => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error('INVALID_COMMAND', `${label} must have finite components within ±${bound}`);
  }
  return result as Vec3;
}
export function parseCommands(input: unknown, bodies: Body[]): Map<string, AdmittedCommands> {
  if (!Array.isArray(input) || input.length > MAX_COMMANDS ||
    Reflect.ownKeys(input).length !== input.length + 1 ||
    !Array.from({ length: input.length }, (_, index) => Object.hasOwn(input, index)).every(Boolean)) {
    error('INVALID_COMMAND', `commands must be a dense array of at most ${MAX_COMMANDS}`);
  }
  const byId = new Map(bodies.map((body) => [body.id, body]));
  const admitted = new Map<string, AdmittedCommands>();
  for (const [index, raw] of input.entries()) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw) ||
      (Object.getPrototypeOf(raw) !== Object.prototype && Object.getPrototypeOf(raw) !== null)) {
      error('INVALID_COMMAND', `command ${index} must be a plain object`);
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const keys = Reflect.ownKeys(raw);
    const kind = descriptors.kind?.value;
    const valueKey = kind === 'force' ? 'forceN' : kind === 'impulse' ? 'impulseNs'
      : kind === 'torque' ? 'torqueNm' : kind === 'angularImpulse' ? 'angularImpulseNms'
        : kind === 'kinematicTarget' ? 'positionM' : null;
    if (!valueKey || keys.length !== 3 || keys.some((key) => typeof key !== 'string' ||
      !['kind', 'bodyId', valueKey].includes(key)) ||
      ['kind', 'bodyId', valueKey].some((key) => !descriptors[key]?.enumerable || !('value' in descriptors[key]))) {
      error('INVALID_COMMAND', `command ${index} has unsupported fields`);
    }
    const bodyId = descriptors.bodyId.value;
    const body = typeof bodyId === 'string' ? byId.get(bodyId) : undefined;
    if (!body || (kind === 'kinematicTarget' ? body.kind !== 'kinematic' : body.kind !== 'dynamic')) {
      error('INVALID_COMMAND', `command ${index} targets an unknown or unsupported body`);
    }
    const previous = admitted.get(body.id) ?? {};
    if (Object.hasOwn(previous, valueKey)) error('INVALID_COMMAND', `duplicate ${kind} command for ${body.id}`);
    const bound = kind === 'force' ? MAX_FORCE_N : kind === 'impulse' ? MAX_IMPULSE_NS
      : kind === 'torque' ? MAX_TORQUE_NM : kind === 'angularImpulse' ? MAX_ANGULAR_IMPULSE_NMS : 10000;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted;
}
export function queryRecord(input: unknown, required: string[], optional: string[]): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)) {
    error('INVALID_QUERY', 'query must be a plain object');
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== 'string' || ![...required, ...optional].includes(key)) ||
    required.some((key) => !Object.hasOwn(descriptors, key)) ||
    keys.some((key) => !descriptors[key as string]?.enumerable || !('value' in descriptors[key as string]))) {
    error('INVALID_QUERY', 'query has missing or unsupported fields');
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key as string].value]));
}
export function queryVector(input: unknown, bound: number, label: string): Vec3 {
  if (!Array.isArray(input) || input.length !== 3 || Reflect.ownKeys(input).length !== 4 ||
    ![0, 1, 2].every((index) => Object.hasOwn(input, index))) {
    error('INVALID_QUERY', `${label} must be a dense 3-vector`);
  }
  const values = [input[0], input[1], input[2]];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > bound)) {
    error('INVALID_QUERY', `${label} components must be finite within ±${bound}`);
  }
  return values as Vec3;
}
export function queryNumber(input: unknown, min: number, max: number, label: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max) {
    error('INVALID_QUERY', `${label} must be finite and in [${min}, ${max}]`);
  }
  return input;
}
export function includeSensors(query: Record<string, unknown>): boolean {
  if (!Object.hasOwn(query, 'includeSensors')) return true;
  if (typeof query.includeSensors !== 'boolean') error('INVALID_QUERY', 'includeSensors must be boolean');
  return query.includeSensors;
}
