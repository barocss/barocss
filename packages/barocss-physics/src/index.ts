/** A bounded, deterministic-order 3D sphere dynamics profile. Units are SI. */
export type Vec3 = [number, number, number];
/** Local-to-world quaternion in [x, y, z, w] order. */
export type Quat = [number, number, number, number];
export type PhysicsErrorCode = 'INVALID_CONFIG' | 'INVALID_STEP' | 'INVALID_COMMAND' | 'INVALID_QUERY' | 'WORLD_LIMIT' | 'NUMERIC_LIMIT' | 'DISPOSED';

export class PhysicsError extends Error {
  constructor(readonly code: PhysicsErrorCode, message: string) {
    super(message);
    this.name = 'PhysicsError';
  }
}

export type SphereShape = { kind: 'sphere'; radiusM: number };
export type BoxShape = { kind: 'box'; halfExtentsM: Vec3 };
export type CapsuleShape = { kind: 'capsule'; radiusM: number; halfLengthM: number };
export type PhysicsShape = SphereShape | BoxShape | CapsuleShape;
export type PhysicsFriction = { static: number; dynamic: number };
export type PhysicsBodyConfig =
  | { id: string; kind: 'dynamic'; shape: PhysicsShape; positionM: Vec3; velocityMps: Vec3; massKg: number; restitution: number;
      orientation?: Quat; angularVelocityRadps?: Vec3; inertiaKgM2?: number; friction?: PhysicsFriction }
  | { id: string; kind: 'static' | 'kinematic'; shape: PhysicsShape; positionM: Vec3; restitution: number;
      orientation?: Quat; sensor?: true; friction?: PhysicsFriction };
export type PhysicsStepCommand =
  | { kind: 'force'; bodyId: string; forceN: Vec3 }
  | { kind: 'impulse'; bodyId: string; impulseNs: Vec3 }
  | { kind: 'torque'; bodyId: string; torqueNm: Vec3 }
  | { kind: 'angularImpulse'; bodyId: string; angularImpulseNms: Vec3 }
  | { kind: 'kinematicTarget'; bodyId: string; positionM: Vec3 };
export interface PhysicsWorldConfig {
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  bodies: PhysicsBodyConfig[];
}
export interface PhysicsBodyState {
  id: string;
  kind: 'dynamic' | 'static' | 'kinematic';
  shape: PhysicsShape;
  positionM: Vec3;
  velocityMps: Vec3;
  orientation: Quat;
  angularVelocityRadps: Vec3;
  inertiaKgM2?: number;
  inertiaDiagonalKgM2?: Vec3;
  sensor?: boolean;
}
export interface PhysicsContact {
  aId: string;
  bId: string;
  normalAtoB: Vec3;
  pointM: Vec3;
  penetrationM: number;
  impulseNs: number;
  tangentImpulseNs: Vec3;
}
export interface PhysicsEvent {
  aId: string;
  bId: string;
  kind: 'contact' | 'sensor';
  phase: 'begin' | 'stay' | 'end';
}
export interface PhysicsState {
  stepIndex: number;
  timeSeconds: number;
  bodies: PhysicsBodyState[];
  contacts: PhysicsContact[];
  events: PhysicsEvent[];
}
export interface PhysicsOverlapSphereQuery { centerM: Vec3; radiusM: number; includeSensors?: boolean }
export interface PhysicsRayQuery { originM: Vec3; direction: Vec3; maxDistanceM: number; includeSensors?: boolean }
export interface PhysicsRayHit { bodyId: string; distanceM: number }
export interface PhysicsWorld {
  getState(): PhysicsState;
  step(fixedStepSeconds: number, commands?: PhysicsStepCommand[]): PhysicsState;
  overlapSphere(query: PhysicsOverlapSphereQuery): string[];
  raycast(query: PhysicsRayQuery): PhysicsRayHit | null;
  dispose(): void;
}

interface Body extends PhysicsBodyState {
  sensor: boolean;
  inverseMass: number;
  inverseInertiaLocal: Vec3;
  restitution: number;
  frictionStatic: number;
  frictionDynamic: number;
}
interface Hit { normal: Vec3; penetration: number; pointM: Vec3 }

const ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
const MAX_BODIES = 32;
const MAX_STEPS = 3600;
const MAX_STEP_DISPLACEMENT_M = 10;
const MAX_COMMANDS = 64;
const MAX_FORCE_N = 1000000;
const MAX_IMPULSE_NS = 100000;
const MAX_TORQUE_NM = 1000000;
const MAX_ANGULAR_IMPULSE_NMS = 100000;
const SOLVER_PASSES = 8;

function error(code: PhysicsErrorCode, message: string): never { throw new PhysicsError(code, message); }
function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) error('INVALID_CONFIG', `${label} must be an object`);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) error('INVALID_CONFIG', `${label} must be a plain object`);
  return value as Record<string, unknown>;
}
function fields(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    error('INVALID_CONFIG', `${label} has an unsupported field`);
  }
}
function finite(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    error('INVALID_CONFIG', `${label} must be finite and in [${min}, ${max}]`);
  }
  return value;
}
function vector(value: unknown, min: number, max: number, label: string): Vec3 {
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
function multiplyQuaternion(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz];
}
function advanceOrientation(orientation: Quat, angularVelocity: Vec3, dt: number): Quat {
  const speed = Math.hypot(...angularVelocity);
  if (speed === 0) return [...orientation];
  const halfAngle = speed * dt / 2;
  const scale = Math.sin(halfAngle) / speed;
  const delta: Quat = [angularVelocity[0] * scale, angularVelocity[1] * scale,
    angularVelocity[2] * scale, Math.cos(halfAngle)];
  const next = multiplyQuaternion(delta, orientation);
  const norm = Math.hypot(...next);
  return next.map((component) => component / norm) as Quat;
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
function parseBody(value: unknown): Body {
  const input = record(value, 'body');
  if (typeof input.id !== 'string' || !ID.test(input.id)) error('INVALID_CONFIG', 'invalid body ID');
  if (input.kind !== 'dynamic' && input.kind !== 'static' && input.kind !== 'kinematic') {
    error('INVALID_CONFIG', 'invalid body kind');
  }
  const kind = input.kind;
  fields(input, kind === 'dynamic'
    ? ['id', 'kind', 'shape', 'positionM', 'velocityMps', 'massKg', 'restitution',
      'orientation', 'angularVelocityRadps', 'inertiaKgM2', 'friction']
    : ['id', 'kind', 'shape', 'positionM', 'restitution', 'orientation', 'sensor', 'friction'], 'body');
  if (Object.hasOwn(input, 'sensor') && input.sensor !== true) error('INVALID_CONFIG', 'sensor must be true');
  const sensor = input.sensor === true;
  const parsedShape = shape(input.shape);
  const positionM = vector(input.positionM, -10000, 10000, 'positionM');
  const restitution = finite(input.restitution, 0, 1, 'restitution');
  const material = Object.hasOwn(input, 'friction') ? friction(input.friction) : { static: 0, dynamic: 0 };
  const orientation = Object.hasOwn(input, 'orientation') ? quaternion(input.orientation) : [0, 0, 0, 1] as Quat;
  if (kind !== 'dynamic') {
    return { id: input.id, kind, shape: parsedShape, positionM, velocityMps: [0, 0, 0],
      orientation, angularVelocityRadps: [0, 0, 0], inverseInertiaLocal: [0, 0, 0],
      sensor, inverseMass: 0, restitution,
      frictionStatic: material.static, frictionDynamic: material.dynamic };
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
    velocityMps: vector(input.velocityMps, -1000, 1000, 'velocityMps'),
    orientation,
    angularVelocityRadps: Object.hasOwn(input, 'angularVelocityRadps') ? angularVector(input.angularVelocityRadps) : [0, 0, 0],
    ...(inertiaKgM2 === undefined ? {} : { inertiaKgM2 }),
    ...(inertiaDiagonalKgM2 === undefined ? {} : { inertiaDiagonalKgM2 }),
    inverseInertiaLocal: inertia.map((value) => 1 / value) as Vec3,
    inverseMass: 1 / massKg, restitution,
    frictionStatic: material.static, frictionDynamic: material.dynamic };
}
function copyShape(value: PhysicsShape): PhysicsShape {
  return value.kind === 'sphere' ? { kind: 'sphere', radiusM: value.radiusM }
    : value.kind === 'box' ? { kind: 'box', halfExtentsM: [...value.halfExtentsM] as Vec3 }
      : { kind: 'capsule', radiusM: value.radiusM, halfLengthM: value.halfLengthM };
}
function copyBody(body: Body): Body {
  return { ...body, shape: copyShape(body.shape), positionM: [...body.positionM], velocityMps: [...body.velocityMps],
    orientation: [...body.orientation], angularVelocityRadps: [...body.angularVelocityRadps],
    ...(body.inertiaDiagonalKgM2 ? { inertiaDiagonalKgM2: [...body.inertiaDiagonalKgM2] as Vec3 } : {}),
    inverseInertiaLocal: [...body.inverseInertiaLocal] };
}
type AdmittedCommands = { forceN?: Vec3; impulseNs?: Vec3; torqueNm?: Vec3; angularImpulseNms?: Vec3; positionM?: Vec3 };
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
function parseCommands(input: unknown, bodies: Body[]): Map<string, AdmittedCommands> {
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
function queryRecord(input: unknown, required: string[], optional: string[]): Record<string, unknown> {
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
function queryVector(input: unknown, bound: number, label: string): Vec3 {
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
function queryNumber(input: unknown, min: number, max: number, label: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max) {
    error('INVALID_QUERY', `${label} must be finite and in [${min}, ${max}]`);
  }
  return input;
}
function includeSensors(query: Record<string, unknown>): boolean {
  if (!Object.hasOwn(query, 'includeSensors')) return true;
  if (typeof query.includeSensors !== 'boolean') error('INVALID_QUERY', 'includeSensors must be boolean');
  return query.includeSensors;
}
function publicState(bodies: Body[], contacts: PhysicsContact[], events: PhysicsEvent[], stepIndex: number, dt: number): PhysicsState {
  return {
    stepIndex, timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps, orientation, angularVelocityRadps, inertiaKgM2, inertiaDiagonalKgM2, sensor }) =>
      ({ id, kind, shape: copyShape(collider), positionM: [...positionM], velocityMps: [...velocityMps],
        orientation: [...orientation], angularVelocityRadps: [...angularVelocityRadps],
        ...(inertiaKgM2 === undefined ? {} : { inertiaKgM2 }),
        ...(inertiaDiagonalKgM2 === undefined ? {} : { inertiaDiagonalKgM2: [...inertiaDiagonalKgM2] as Vec3 }),
        ...(sensor ? { sensor: true } : {}) })),
    contacts: contacts.map(({ aId, bId, normalAtoB, pointM, penetrationM, impulseNs, tangentImpulseNs }) =>
      ({ aId, bId, normalAtoB: [...normalAtoB], pointM: [...pointM], penetrationM, impulseNs,
        tangentImpulseNs: [...tangentImpulseNs] })),
    events: events.map((event) => ({ ...event })),
  };
}
const add = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value + b[index]) as Vec3;
const sub = (a: Vec3, b: Vec3): Vec3 => a.map((value, index) => value - b[index]) as Vec3;
const scale = (a: Vec3, value: number): Vec3 => a.map((component) => component * value) as Vec3;
const dot = (a: Vec3, b: Vec3): number => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a: Vec3, b: Vec3): Vec3 =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const inverse = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
function rotate(q: Quat, v: Vec3): Vec3 {
  const axis: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(axis, v), 2);
  return add(v, add(scale(t, q[3]), cross(axis, t)));
}
const localPoint = (body: Body, point: Vec3): Vec3 => rotate(inverse(body.orientation), sub(point, body.positionM));
const worldPoint = (body: Body, point: Vec3): Vec3 => add(body.positionM, rotate(body.orientation, point));
function inverseInertia(body: Body, vector: Vec3): Vec3 {
  const local = rotate(inverse(body.orientation), vector);
  return rotate(body.orientation, local.map((value, index) => value * body.inverseInertiaLocal[index]) as Vec3);
}
function capsuleCenter(body: Body, point: Vec3): Vec3 {
  const half = (body.shape as CapsuleShape).halfLengthM;
  const local = localPoint(body, point);
  return worldPoint(body, [0, Math.max(-half, Math.min(half, local[1])), 0]);
}
function boxAxes(body: Body): Vec3[] {
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((axis) => rotate(body.orientation, axis as Vec3));
}
function boxSupport(body: Body, direction: Vec3): Vec3 {
  const axes = boxAxes(body);
  const extents = (body.shape as BoxShape).halfExtentsM;
  return add(body.positionM, axes.reduce((result, axis, index) =>
    add(result, scale(axis, dot(axis, direction) >= 0 ? extents[index] : -extents[index])), [0, 0, 0] as Vec3));
}
function sphereSphere(a: Body, b: Body): Hit | null {
  const aRadius = (a.shape as SphereShape).radiusM;
  const bRadius = (b.shape as SphereShape).radiusM;
  const delta = sub(b.positionM, a.positionM);
  const distance = Math.hypot(...delta);
  if (distance > aRadius + bRadius) return null;
  const normal: Vec3 = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  const aSurface = add(a.positionM, scale(normal, aRadius));
  const bSurface = sub(b.positionM, scale(normal, bRadius));
  return { normal, penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale(add(aSurface, bSurface), 0.5) };
}
function sphereBox(sphere: Body, box: Body): Hit | null {
  const radius = (sphere.shape as SphereShape).radiusM;
  const extents = (box.shape as BoxShape).halfExtentsM;
  const relative = localPoint(box, sphere.positionM);
  const nearest = relative.map((value, index) => Math.max(-extents[index], Math.min(extents[index], value))) as Vec3;
  const towardBox = sub(nearest, relative);
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return { normal: rotate(box.orientation, scale(towardBox, 1 / distance)),
    penetration: Math.max(0, radius - distance), pointM: worldPoint(box, nearest) };
  // Inside or on a face: axis X, Y, Z; negative face first on a tie.
  let axis = 0, side = -1, faceDistance = Infinity;
  for (let index = 0; index < 3; index++) for (const candidate of [-1, 1]) {
    const gap = extents[index] - candidate * relative[index];
    if (gap < faceDistance) { faceDistance = gap; axis = index; side = candidate; }
  }
  const localNormal: Vec3 = [0, 0, 0];
  localNormal[axis] = -side;
  nearest[axis] = side * extents[axis];
  return { normal: rotate(box.orientation, localNormal), penetration: radius + faceDistance,
    pointM: worldPoint(box, nearest) };
}
function capsuleSphere(capsule: Body, sphere: Body): Hit | null {
  const center = capsuleCenter(capsule, sphere.positionM);
  const delta = sub(sphere.positionM, center);
  const distance = Math.hypot(...delta);
  const capsuleRadius = (capsule.shape as CapsuleShape).radiusM;
  const sphereRadius = (sphere.shape as SphereShape).radiusM;
  if (distance > capsuleRadius + sphereRadius) return null;
  const normal: Vec3 = distance === 0 ? [1, 0, 0] : scale(delta, 1 / distance);
  return { normal, penetration: Math.max(0, capsuleRadius + sphereRadius - distance),
    pointM: scale(add(add(center, scale(normal, capsuleRadius)),
      sub(sphere.positionM, scale(normal, sphereRadius))), 0.5) };
}
function boxBox(a: Body, b: Body): Hit | null {
  const axesA = boxAxes(a), axesB = boxAxes(b);
  const extentA = (a.shape as BoxShape).halfExtentsM, extentB = (b.shape as BoxShape).halfExtentsM;
  const delta = sub(b.positionM, a.positionM);
  let bestAxis: Vec3 = [1, 0, 0], bestOverlap = Infinity;
  const candidates = [...axesA, ...axesB, ...axesA.flatMap((axisA) => axesB.map((axisB) => cross(axisA, axisB)))];
  for (const candidate of candidates) {
    const length = Math.hypot(...candidate);
    if (length < 1e-12) continue;
    const axis = scale(candidate, 1 / length);
    const radiusA = axesA.reduce((sum, basis, index) => sum + extentA[index] * Math.abs(dot(basis, axis)), 0);
    const radiusB = axesB.reduce((sum, basis, index) => sum + extentB[index] * Math.abs(dot(basis, axis)), 0);
    const signedDistance = dot(delta, axis);
    const overlap = radiusA + radiusB - Math.abs(signedDistance);
    if (overlap < -1e-12) return null;
    if (overlap < bestOverlap) { bestOverlap = overlap; bestAxis = scale(axis, signedDistance < 0 ? -1 : 1); }
  }
  const aPoint = boxSupport(a, bestAxis);
  const bPoint = boxSupport(b, scale(bestAxis, -1));
  return { normal: bestAxis, penetration: Math.max(0, bestOverlap), pointM: scale(add(aPoint, bPoint), 0.5) };
}
function detect(a: Body, b: Body): Hit | null {
  if (a.shape.kind === 'sphere' && b.shape.kind === 'sphere') return sphereSphere(a, b);
  if (a.shape.kind === 'sphere' && b.shape.kind === 'box') return sphereBox(a, b);
  if (a.shape.kind === 'box' && b.shape.kind === 'sphere') {
    const hit = sphereBox(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === 'capsule' && b.shape.kind === 'sphere') return capsuleSphere(a, b);
  if (a.shape.kind === 'sphere' && b.shape.kind === 'capsule') {
    const hit = capsuleSphere(b, a);
    return hit && { ...hit, normal: scale(hit.normal, -1) };
  }
  if (a.shape.kind === 'box' && b.shape.kind === 'box') return boxBox(a, b);
  return null;
}
function sphereOverlaps(center: Vec3, radius: number, body: Body): boolean {
  if (body.shape.kind === 'sphere') {
    return Math.hypot(...sub(center, body.positionM)) <= radius + body.shape.radiusM;
  }
  if (body.shape.kind === 'capsule') {
    return Math.hypot(...sub(center, capsuleCenter(body, center))) <= radius + body.shape.radiusM;
  }
  const extents = body.shape.halfExtentsM;
  const local = localPoint(body, center);
  const delta = local.map((value, index) => Math.max(0, Math.abs(value) - extents[index]));
  return Math.hypot(...delta) <= radius;
}
function raySphere(origin: Vec3, direction: Vec3, center: Vec3, radius: number): number | null {
  const relative = sub(origin, center);
  const c = dot(relative, relative) - radius ** 2;
  if (c <= 0) return 0;
  const projection = dot(relative, direction);
  const discriminant = projection ** 2 - c;
  return projection > 0 || discriminant < 0 ? null : -projection - Math.sqrt(discriminant);
}
function rayDistance(origin: Vec3, direction: Vec3, body: Body): number | null {
  if (body.shape.kind === 'sphere') return raySphere(origin, direction, body.positionM, body.shape.radiusM);
  const localOrigin = localPoint(body, origin);
  const localDirection = rotate(inverse(body.orientation), direction);
  if (body.shape.kind === 'capsule') {
    const { radiusM: radius, halfLengthM: half } = body.shape;
    const closest: Vec3 = [0, Math.max(-half, Math.min(half, localOrigin[1])), 0];
    if (Math.hypot(...sub(localOrigin, closest)) <= radius) return 0;
    const results: number[] = [];
    for (const y of [-half, half]) {
      const hit = raySphere(localOrigin, localDirection, [0, y, 0], radius);
      if (hit !== null) results.push(hit);
    }
    const a = localDirection[0] ** 2 + localDirection[2] ** 2;
    if (a > 1e-12) {
      const b = 2 * (localOrigin[0] * localDirection[0] + localOrigin[2] * localDirection[2]);
      const c = localOrigin[0] ** 2 + localOrigin[2] ** 2 - radius ** 2;
      const discriminant = b ** 2 - 4 * a * c;
      if (discriminant >= 0) for (const sign of [-1, 1]) {
        const hit = (-b + sign * Math.sqrt(discriminant)) / (2 * a);
        const y = localOrigin[1] + localDirection[1] * hit;
        if (hit >= 0 && y >= -half && y <= half) results.push(hit);
      }
    }
    return results.length ? Math.min(...results) : null;
  }
  let near = -Infinity, far = Infinity;
  for (let index = 0; index < 3; index++) {
    const lower = -body.shape.halfExtentsM[index];
    const upper = body.shape.halfExtentsM[index];
    const component = localDirection[index];
    if (Math.abs(component) < 1e-12) {
      if (localOrigin[index] < lower || localOrigin[index] > upper) return null;
      continue;
    }
    const first = (lower - localOrigin[index]) / component;
    const second = (upper - localOrigin[index]) / component;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    if (far < near) return null;
  }
  return far < 0 ? null : Math.max(0, near);
}
function solve(a: Body, b: Body, hit: Hit): { normalImpulseNs: number; tangentImpulseNs: Vec3 } {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return { normalImpulseNs: 0, tangentImpulseNs: [0, 0, 0] };
  const armA = sub(hit.pointM, a.positionM), armB = sub(hit.pointM, b.positionM);
  const pointVelocityA = add(a.velocityMps, cross(a.angularVelocityRadps, armA));
  const pointVelocityB = add(b.velocityMps, cross(b.angularVelocityRadps, armB));
  const relativeSpeed = dot(hit.normal, sub(pointVelocityB, pointVelocityA));
  const torqueAxisA = cross(armA, hit.normal), torqueAxisB = cross(armB, hit.normal);
  const effectiveMass = inverseTotal + dot(torqueAxisA, inverseInertia(a, torqueAxisA))
    + dot(torqueAxisB, inverseInertia(b, torqueAxisB));
  let impulse = 0;
  if (relativeSpeed < 0) {
    const bounce = -relativeSpeed > 0.5 ? Math.min(a.restitution, b.restitution) : 0;
    impulse = -(1 + bounce) * relativeSpeed / effectiveMass;
  }
  a.angularVelocityRadps = sub(a.angularVelocityRadps, scale(inverseInertia(a, torqueAxisA), impulse));
  b.angularVelocityRadps = add(b.angularVelocityRadps, scale(inverseInertia(b, torqueAxisB), impulse));
  for (let i = 0; i < 3; i++) {
    a.velocityMps[i] -= hit.normal[i] * impulse * a.inverseMass;
    b.velocityMps[i] += hit.normal[i] * impulse * b.inverseMass;
    a.positionM[i] -= hit.normal[i] * hit.penetration * a.inverseMass / inverseTotal;
    b.positionM[i] += hit.normal[i] * hit.penetration * b.inverseMass / inverseTotal;
  }
  const staticFriction = Math.sqrt(a.frictionStatic * b.frictionStatic);
  if (impulse === 0 || staticFriction === 0) {
    return { normalImpulseNs: impulse, tangentImpulseNs: [0, 0, 0] };
  }
  const frictionArmA = sub(hit.pointM, a.positionM);
  const frictionArmB = sub(hit.pointM, b.positionM);
  const afterA = add(a.velocityMps, cross(a.angularVelocityRadps, frictionArmA));
  const afterB = add(b.velocityMps, cross(b.angularVelocityRadps, frictionArmB));
  const relative = sub(afterB, afterA);
  const tangent = sub(relative, scale(hit.normal, dot(relative, hit.normal)));
  const speed = Math.hypot(...tangent);
  if (speed === 0) return { normalImpulseNs: impulse, tangentImpulseNs: [0, 0, 0] };
  const direction = scale(tangent, 1 / speed);
  const tangentAxisA = cross(frictionArmA, direction), tangentAxisB = cross(frictionArmB, direction);
  const tangentMass = inverseTotal + dot(tangentAxisA, inverseInertia(a, tangentAxisA))
    + dot(tangentAxisB, inverseInertia(b, tangentAxisB));
  const required = speed / tangentMass;
  const dynamicFriction = Math.sqrt(a.frictionDynamic * b.frictionDynamic);
  const magnitude = required <= staticFriction * impulse
    ? required : Math.min(required, dynamicFriction * impulse);
  const tangentImpulse = scale(direction, -magnitude);
  a.velocityMps = sub(a.velocityMps, scale(tangentImpulse, a.inverseMass));
  b.velocityMps = add(b.velocityMps, scale(tangentImpulse, b.inverseMass));
  a.angularVelocityRadps = sub(a.angularVelocityRadps,
    inverseInertia(a, cross(frictionArmA, tangentImpulse)));
  b.angularVelocityRadps = add(b.angularVelocityRadps,
    inverseInertia(b, cross(frictionArmB, tangentImpulse)));
  return { normalImpulseNs: impulse, tangentImpulseNs: tangentImpulse };
}
function validateResult(bodies: Body[], contacts: PhysicsContact[]): void {
  for (const body of bodies) {
    for (const [label, values, bound] of [['position', body.positionM, 10000], ['velocity', body.velocityMps, 1000],
      ['angularVelocity', body.angularVelocityRadps, 1000]] as const) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error('NUMERIC_LIMIT', `${body.id} ${label} exceeded bounds`);
    }
    if (body.orientation.some((value) => !Number.isFinite(value)) ||
      Math.abs(Math.hypot(...body.orientation) - 1) > 1e-12) error('NUMERIC_LIMIT', `${body.id} orientation exceeded tolerance`);
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) ||
    contact.normalAtoB.some((value) => !Number.isFinite(value)) ||
    contact.pointM.some((value) => !Number.isFinite(value)) ||
    contact.tangentImpulseNs.some((value) => !Number.isFinite(value)))) error('NUMERIC_LIMIT', 'unsafe contact result');
}

export function createPhysicsWorld(config: PhysicsWorldConfig): PhysicsWorld {
  const input = record(config, 'world');
  fields(input, ['fixedStepSeconds', 'gravityMps2', 'bodies'], 'world');
  const dt = finite(input.fixedStepSeconds, 1 / 240, 1 / 30, 'fixedStepSeconds');
  const gravity = vector(input.gravityMps2, -1000, 1000, 'gravityMps2');
  if (!Array.isArray(input.bodies) || input.bodies.length < 1 || input.bodies.length > MAX_BODIES) {
    error('INVALID_CONFIG', `bodies must contain 1..${MAX_BODIES} entries`);
  }
  let bodies = input.bodies.map(parseBody);
  if (!bodies.some((body) => body.kind === 'dynamic')) error('INVALID_CONFIG', 'at least one dynamic body is required');
  if (new Set(bodies.map((body) => body.id)).size !== bodies.length) error('INVALID_CONFIG', 'duplicate body ID');
  const pairs: Array<[number, number]> = [];
  for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
    if (bodies[a].inverseMass !== 0 || bodies[b].inverseMass !== 0) {
      if (bodies[a].shape.kind === 'capsule' && bodies[b].shape.kind !== 'sphere' ||
        bodies[b].shape.kind === 'capsule' && bodies[a].shape.kind !== 'sphere') {
        error('INVALID_CONFIG', `unsupported collider pair: ${bodies[a].shape.kind}/${bodies[b].shape.kind}`);
      }
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 :
    bodies[left[0]].id > bodies[right[0]].id ? 1 :
      bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  let contacts: PhysicsContact[] = [];
  let events: PhysicsEvent[] = [];
  let activePairs = new Map<string, Omit<PhysicsEvent, 'phase'>>();
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => { if (disposed) error('DISPOSED', 'world is disposed'); };
  return {
    getState() { ensureActive(); return publicState(bodies, contacts, events, stepIndex, dt); },
    step(fixedStepSeconds, commands = []) {
      ensureActive();
      if (fixedStepSeconds !== dt) error('INVALID_STEP', 'step must equal configured fixedStepSeconds');
      if (stepIndex >= MAX_STEPS) error('WORLD_LIMIT', 'world step limit reached');
      const actions = parseCommands(commands, bodies);
      const next = bodies.map(copyBody);
      for (const body of next) {
        const action = actions.get(body.id);
        if (body.kind === 'kinematic') {
          const target = action?.positionM ?? body.positionM;
          const delta = target.map((value, index) => value - body.positionM[index]) as Vec3;
          if (Math.hypot(...delta) > MAX_STEP_DISPLACEMENT_M ||
            delta.some((value) => Math.abs(value / dt) > 1000)) {
            error('NUMERIC_LIMIT', `${body.id} exceeded kinematic movement limit`);
          }
          body.velocityMps = delta.map((value) => value / dt) as Vec3;
          body.positionM = [...target];
        } else if (body.kind === 'dynamic') {
          const angularImpulse = action?.angularImpulseNms ?? [0, 0, 0];
          const torque = action?.torqueNm ?? [0, 0, 0];
          body.angularVelocityRadps = add(body.angularVelocityRadps,
            inverseInertia(body, add(angularImpulse, scale(torque, dt))));
          if (body.angularVelocityRadps.some((value) => !Number.isFinite(value) || Math.abs(value) > 1000) ||
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
      const found = new Map<string, PhysicsContact>();
      const sensed = new Map<string, Omit<PhysicsEvent, 'phase'>>();
      for (let pass = 0; pass < SOLVER_PASSES; pass++) for (const [aIndex, bIndex] of pairs) {
        const a = next[aIndex], b = next[bIndex];
        const hit = detect(a, b);
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
        contact.pointM = [...hit.pointM];
        contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
        const resolved = solve(a, b, hit);
        contact.impulseNs += resolved.normalImpulseNs;
        contact.tangentImpulseNs = add(contact.tangentImpulseNs, resolved.tangentImpulseNs);
      }
      const nextContacts = [...found.values()];
      const nextActive = new Map<string, Omit<PhysicsEvent, 'phase'>>(sensed);
      for (const contact of nextContacts) {
        nextActive.set(`${contact.aId}\u0000${contact.bId}`,
          { aId: contact.aId, bId: contact.bId, kind: 'contact' });
      }
      const nextEvents = [...new Set([...activePairs.keys(), ...nextActive.keys()])].sort().map((key): PhysicsEvent => {
        const current = nextActive.get(key);
        const previous = activePairs.get(key);
        return { ...(current ?? previous!), phase: current ? previous ? 'stay' : 'begin' : 'end' };
      });
      validateResult(next, nextContacts);
      bodies = next;
      contacts = nextContacts;
      events = nextEvents;
      activePairs = nextActive;
      stepIndex++;
      return publicState(bodies, contacts, events, stepIndex, dt);
    },
    overlapSphere(input) {
      ensureActive();
      const query = queryRecord(input, ['centerM', 'radiusM'], ['includeSensors']);
      const center = queryVector(query.centerM, 10000, 'centerM');
      const radius = queryNumber(query.radiusM, 0.0001, 1000, 'radiusM');
      const sensors = includeSensors(query);
      return bodies.filter((body) => (sensors || !body.sensor) && sphereOverlaps(center, radius, body))
        .map((body) => body.id).sort();
    },
    raycast(input) {
      ensureActive();
      const query = queryRecord(input, ['originM', 'direction', 'maxDistanceM'], ['includeSensors']);
      const origin = queryVector(query.originM, 10000, 'originM');
      const direction = queryVector(query.direction, 1 + 1e-9, 'direction');
      if (Math.abs(Math.hypot(...direction) - 1) > 1e-9) {
        error('INVALID_QUERY', 'direction must be a unit 3-vector');
      }
      const limit = queryNumber(query.maxDistanceM, 0.0001, 10000, 'maxDistanceM');
      const sensors = includeSensors(query);
      let best: PhysicsRayHit | null = null;
      for (const body of bodies) {
        if (!sensors && body.sensor) continue;
        const distance = rayDistance(origin, direction, body);
        if (distance === null || distance > limit) continue;
        if (best === null || distance < best.distanceM ||
          (distance === best.distanceM && body.id < best.bodyId)) {
          best = { bodyId: body.id, distanceM: distance };
        }
      }
      return best;
    },
    dispose() { disposed = true; bodies = []; contacts = []; events = []; activePairs.clear(); },
  };
}
