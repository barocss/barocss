/** A small, deterministic-order translational 3D dynamics profile. Units are SI. */
export type Vec3 = [number, number, number];
export type PhysicsErrorCode = 'INVALID_CONFIG' | 'INVALID_STEP' | 'INVALID_COMMAND' | 'WORLD_LIMIT' | 'NUMERIC_LIMIT' | 'DISPOSED';

export class PhysicsError extends Error {
  constructor(readonly code: PhysicsErrorCode, message: string) {
    super(message);
    this.name = 'PhysicsError';
  }
}

export type SphereShape = { kind: 'sphere'; radiusM: number };
export type BoxShape = { kind: 'box'; halfExtentsM: Vec3 };
export type PhysicsBodyConfig =
  | { id: string; kind: 'dynamic'; shape: SphereShape; positionM: Vec3; velocityMps: Vec3; massKg: number; restitution: number }
  | { id: string; kind: 'static' | 'kinematic'; shape: SphereShape | BoxShape; positionM: Vec3; restitution: number };
export type PhysicsStepCommand =
  | { kind: 'force'; bodyId: string; forceN: Vec3 }
  | { kind: 'impulse'; bodyId: string; impulseNs: Vec3 }
  | { kind: 'kinematicTarget'; bodyId: string; positionM: Vec3 };
export interface PhysicsWorldConfig {
  fixedStepSeconds: number;
  gravityMps2: Vec3;
  bodies: PhysicsBodyConfig[];
}
export interface PhysicsBodyState {
  id: string;
  kind: 'dynamic' | 'static' | 'kinematic';
  shape: SphereShape | BoxShape;
  positionM: Vec3;
  velocityMps: Vec3;
}
export interface PhysicsContact {
  aId: string;
  bId: string;
  normalAtoB: Vec3;
  penetrationM: number;
  impulseNs: number;
}
export interface PhysicsState {
  stepIndex: number;
  timeSeconds: number;
  bodies: PhysicsBodyState[];
  contacts: PhysicsContact[];
}
export interface PhysicsWorld {
  getState(): PhysicsState;
  step(fixedStepSeconds: number, commands?: PhysicsStepCommand[]): PhysicsState;
  dispose(): void;
}

interface Body extends PhysicsBodyState {
  inverseMass: number;
  restitution: number;
}
interface Hit { normal: Vec3; penetration: number }

const ID = /^[A-Za-z][A-Za-z0-9._:-]{0,63}$/;
const MAX_BODIES = 32;
const MAX_STEPS = 3600;
const MAX_STEP_DISPLACEMENT_M = 10;
const MAX_COMMANDS = 64;
const MAX_FORCE_N = 1000000;
const MAX_IMPULSE_NS = 100000;
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
function shape(value: unknown, allowBox: boolean): SphereShape | BoxShape {
  const input = record(value, 'shape');
  if (input.kind === 'sphere') {
    fields(input, ['kind', 'radiusM'], 'sphere');
    return { kind: 'sphere', radiusM: finite(input.radiusM, 0.0001, 1000, 'radiusM') };
  }
  if (allowBox && input.kind === 'box') {
    fields(input, ['kind', 'halfExtentsM'], 'box');
    return { kind: 'box', halfExtentsM: vector(input.halfExtentsM, 0.0001, 1000, 'halfExtentsM') };
  }
  return error('INVALID_CONFIG', 'unsupported collider shape');
}
function parseBody(value: unknown): Body {
  const input = record(value, 'body');
  if (typeof input.id !== 'string' || !ID.test(input.id)) error('INVALID_CONFIG', 'invalid body ID');
  if (input.kind !== 'dynamic' && input.kind !== 'static' && input.kind !== 'kinematic') {
    error('INVALID_CONFIG', 'invalid body kind');
  }
  const kind = input.kind;
  fields(input, kind === 'dynamic'
    ? ['id', 'kind', 'shape', 'positionM', 'velocityMps', 'massKg', 'restitution']
    : ['id', 'kind', 'shape', 'positionM', 'restitution'], 'body');
  const parsedShape = shape(input.shape, kind !== 'dynamic');
  const positionM = vector(input.positionM, -10000, 10000, 'positionM');
  const restitution = finite(input.restitution, 0, 1, 'restitution');
  if (kind !== 'dynamic') {
    return { id: input.id, kind, shape: parsedShape, positionM, velocityMps: [0, 0, 0], inverseMass: 0, restitution };
  }
  const massKg = finite(input.massKg, 0.000001, 1000000, 'massKg');
  return { id: input.id, kind, shape: parsedShape as SphereShape, positionM,
    velocityMps: vector(input.velocityMps, -1000, 1000, 'velocityMps'), inverseMass: 1 / massKg, restitution };
}
function copyShape(value: SphereShape | BoxShape): SphereShape | BoxShape {
  return value.kind === 'sphere' ? { kind: 'sphere', radiusM: value.radiusM } : { kind: 'box', halfExtentsM: [...value.halfExtentsM] as Vec3 };
}
function copyBody(body: Body): Body {
  return { ...body, shape: copyShape(body.shape), positionM: [...body.positionM], velocityMps: [...body.velocityMps] };
}
type AdmittedCommands = { forceN?: Vec3; impulseNs?: Vec3; positionM?: Vec3 };
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
    const bound = kind === 'force' ? MAX_FORCE_N : kind === 'impulse' ? MAX_IMPULSE_NS : 10000;
    const value = commandVector(descriptors[valueKey].value, bound, `command ${index}.${valueKey}`);
    admitted.set(body.id, { ...previous, [valueKey]: value });
  }
  return admitted;
}
function publicState(bodies: Body[], contacts: PhysicsContact[], stepIndex: number, dt: number): PhysicsState {
  return {
    stepIndex, timeSeconds: stepIndex * dt,
    bodies: bodies.map(({ id, kind, shape: collider, positionM, velocityMps }) =>
      ({ id, kind, shape: copyShape(collider), positionM: [...positionM], velocityMps: [...velocityMps] })),
    contacts: contacts.map(({ aId, bId, normalAtoB, penetrationM, impulseNs }) =>
      ({ aId, bId, normalAtoB: [...normalAtoB], penetrationM, impulseNs })),
  };
}
function sphereSphere(a: Body, b: Body): Hit | null {
  const radius = (a.shape as SphereShape).radiusM + (b.shape as SphereShape).radiusM;
  const delta: Vec3 = [0, 1, 2].map((i) => b.positionM[i] - a.positionM[i]) as Vec3;
  const distance = Math.hypot(...delta);
  if (distance > radius) return null;
  return { normal: distance === 0 ? [1, 0, 0] : delta.map((v) => v / distance) as Vec3,
    penetration: Math.max(0, radius - distance) };
}
function sphereBox(sphere: Body, box: Body): Hit | null {
  const radius = (sphere.shape as SphereShape).radiusM;
  const extents = (box.shape as BoxShape).halfExtentsM;
  const relative: Vec3 = [0, 1, 2].map((i) => sphere.positionM[i] - box.positionM[i]) as Vec3;
  const nearest: Vec3 = [0, 1, 2].map((i) => Math.max(-extents[i], Math.min(extents[i], relative[i]))) as Vec3;
  const towardBox: Vec3 = [0, 1, 2].map((i) => nearest[i] - relative[i]) as Vec3;
  const distance = Math.hypot(...towardBox);
  if (distance > radius) return null;
  if (distance > 0) return { normal: towardBox.map((v) => v / distance) as Vec3, penetration: Math.max(0, radius - distance) };
  // Inside or exactly on the box: X, then Y, then Z; negative face first on a tie.
  let axis = 0;
  let side = -1;
  let faceDistance = Infinity;
  for (let i = 0; i < 3; i++) {
    for (const candidate of [-1, 1]) {
      const gap = extents[i] - candidate * relative[i];
      if (gap < faceDistance) { faceDistance = gap; axis = i; side = candidate; }
    }
  }
  const normal: Vec3 = [0, 0, 0];
  normal[axis] = -side;
  return { normal, penetration: radius + faceDistance };
}
function detect(a: Body, b: Body): Hit | null {
  if (a.shape.kind === 'sphere' && b.shape.kind === 'sphere') return sphereSphere(a, b);
  if (a.shape.kind === 'sphere' && b.shape.kind === 'box') return sphereBox(a, b);
  if (a.shape.kind === 'box' && b.shape.kind === 'sphere') {
    const hit = sphereBox(b, a);
    return hit && { normal: hit.normal.map((v) => -v) as Vec3, penetration: hit.penetration };
  }
  return null;
}
function solve(a: Body, b: Body, hit: Hit): number {
  const inverseTotal = a.inverseMass + b.inverseMass;
  if (inverseTotal === 0) return 0;
  const relativeSpeed = hit.normal.reduce((sum, component, i) => sum + component * (b.velocityMps[i] - a.velocityMps[i]), 0);
  let impulse = 0;
  if (relativeSpeed < 0) {
    const bounce = -relativeSpeed > 0.5 ? Math.min(a.restitution, b.restitution) : 0;
    impulse = -(1 + bounce) * relativeSpeed / inverseTotal;
  }
  for (let i = 0; i < 3; i++) {
    a.velocityMps[i] -= hit.normal[i] * impulse * a.inverseMass;
    b.velocityMps[i] += hit.normal[i] * impulse * b.inverseMass;
    a.positionM[i] -= hit.normal[i] * hit.penetration * a.inverseMass / inverseTotal;
    b.positionM[i] += hit.normal[i] * hit.penetration * b.inverseMass / inverseTotal;
  }
  return impulse;
}
function validateResult(bodies: Body[], contacts: PhysicsContact[]): void {
  for (const body of bodies) {
    for (const [label, values, bound] of [['position', body.positionM, 10000], ['velocity', body.velocityMps, 1000]] as const) {
      if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > bound)) error('NUMERIC_LIMIT', `${body.id} ${label} exceeded bounds`);
    }
  }
  if (contacts.some((contact) => !Number.isFinite(contact.impulseNs) || !Number.isFinite(contact.penetrationM) ||
    contact.normalAtoB.some((value) => !Number.isFinite(value)))) error('NUMERIC_LIMIT', 'unsafe contact result');
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
      pairs.push(bodies[a].id < bodies[b].id ? [a, b] : [b, a]);
    }
  }
  pairs.sort((left, right) => bodies[left[0]].id < bodies[right[0]].id ? -1 :
    bodies[left[0]].id > bodies[right[0]].id ? 1 :
      bodies[left[1]].id < bodies[right[1]].id ? -1 : 1);
  let contacts: PhysicsContact[] = [];
  let stepIndex = 0;
  let disposed = false;
  const ensureActive = () => { if (disposed) error('DISPOSED', 'world is disposed'); };
  return {
    getState() { ensureActive(); return publicState(bodies, contacts, stepIndex, dt); },
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
      for (let pass = 0; pass < SOLVER_PASSES; pass++) for (const [aIndex, bIndex] of pairs) {
        const a = next[aIndex], b = next[bIndex];
        const hit = detect(a, b);
        if (!hit) continue;
        if (hit.penetration > MAX_STEP_DISPLACEMENT_M) error('NUMERIC_LIMIT', 'contact penetration exceeded limit');
        const key = `${a.id}\u0000${b.id}`;
        let contact = found.get(key);
        if (!contact) {
          contact = { aId: a.id, bId: b.id, normalAtoB: [...hit.normal], penetrationM: 0, impulseNs: 0 };
          found.set(key, contact);
        }
        contact.penetrationM = Math.max(contact.penetrationM, hit.penetration);
        contact.impulseNs += solve(a, b, hit);
      }
      const nextContacts = [...found.values()];
      validateResult(next, nextContacts);
      bodies = next;
      contacts = nextContacts;
      stepIndex++;
      return publicState(bodies, contacts, stepIndex, dt);
    },
    dispose() { disposed = true; bodies = []; contacts = []; },
  };
}
