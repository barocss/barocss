import { PhysicsError } from '../../packages/barocss-physics/src/types.js';
import type { FailureCode as PhysicsErrorCode, Vec3 } from '../../packages/barocss-physics/src/types.js';

/** Moment about the +Z axis through the COM, or through the fixed pivot, in kg m². */
export interface PlanarPendulumInertia {
  about: 'com' | 'pivot';
  kgM2: number;
}

/** SI units. The pivot is the origin, gravity is -Y, and positive angles turn about +Z. */
export interface PlanarPendulumConfig {
  massKg: number;
  comDistanceM: number;
  inertia: PlanarPendulumInertia;
  gravityMps2: number;
  initialAngleRad: number;
  initialAngularVelocityRadps: number;
  fixedStepSeconds: number;
  /** Integer in [1, 1000000]. Default: 1000000. */
  maxSteps?: number;
}

export interface PlanarPendulumState {
  stepIndex: number;
  timeSeconds: number;
  angleRad: number;
  angularVelocityRadps: number;
  angularAccelerationRadps2: number;
  comPositionM: Vec3;
  /** Kinetic plus gravitational potential energy. Potential is zero at angle zero. */
  energyJ: number;
}

/** A reduced one-coordinate ODE, separate from PhysicsWorld and its joint solver. */
export interface PlanarPendulum {
  getState(): PlanarPendulumState;
  step(fixedStepSeconds: number): PlanarPendulumState;
  dispose(): void;
}

function fail(code: PhysicsErrorCode, message: string): never {
  throw new PhysicsError(code, message);
}

// Copy own data once. Do not execute getters while admitting a numeric model.
function data(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      fail('INVALID_CONFIG', `${label} must be a plain object`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) {
      fail('INVALID_CONFIG', `${label} must be a plain object`);
    }
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !allowed.includes(key)) {
        fail('INVALID_CONFIG', `${label} has an unsupported field`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        fail('INVALID_CONFIG', `${label} must contain data fields`);
      }
      out[key] = descriptor.value;
    }
    return out;
  } catch (error) {
    if (error instanceof PhysicsError) throw error;
    return fail('INVALID_CONFIG', `${label} reflection failed`);
  }
}

function number(value: unknown, low: number, high: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) {
    fail('INVALID_CONFIG', `${label} must be finite and in [${low}, ${high}]`);
  }
  return value;
}

/**
 * Admit one rigid planar pendulum. No contacts, motors, damping, or body geometry.
 * Each step uses velocity Verlet. Failed steps keep the last accepted state.
 */
export function createPlanarPendulum(config: PlanarPendulumConfig): PlanarPendulum {
  const input = data(config, ['massKg', 'comDistanceM', 'inertia', 'gravityMps2',
    'initialAngleRad', 'initialAngularVelocityRadps', 'fixedStepSeconds', 'maxSteps'], 'pendulum');
  const mass = number(input.massKg, 1e-6, 1e6, 'massKg');
  const length = number(input.comDistanceM, 1e-4, 100, 'comDistanceM');
  const gravity = number(input.gravityMps2, 0, 100, 'gravityMps2');
  const moment = data(input.inertia, ['about', 'kgM2'], 'inertia');
  const specifiedInertia = number(moment.kgM2, 0, 1e10, 'inertia.kgM2');
  const offsetInertia = mass * length * length;
  if (moment.about !== 'com' && moment.about !== 'pivot') {
    fail('INVALID_CONFIG', 'inertia.about must be com or pivot');
  }
  const pivotInertia = moment.about === 'com' ? specifiedInertia + offsetInertia : specifiedInertia;
  if (!Number.isFinite(pivotInertia) || pivotInertia < offsetInertia || pivotInertia > 1e10) {
    fail('INVALID_CONFIG', 'Pivot inertia must be in [massKg * comDistanceM², 1e10]');
  }
  const dt = number(input.fixedStepSeconds, 1e-6, 1 / 30, 'fixedStepSeconds');
  const gravityMoment = mass * gravity * length;
  const frequencySquared = gravityMoment / pivotInertia;
  if (dt * Math.sqrt(frequencySquared) > 0.05) {
    fail('INVALID_CONFIG', 'fixedStepSeconds * naturalFrequency must be at most 0.05');
  }
  const maxSteps = Object.hasOwn(input, 'maxSteps')
    ? number(input.maxSteps, 1, 1e6, 'maxSteps') : 1e6;
  if (!Number.isInteger(maxSteps)) fail('INVALID_CONFIG', 'maxSteps must be an integer');
  let angle = number(input.initialAngleRad, -1e6, 1e6, 'initialAngleRad');
  let velocity = number(input.initialAngularVelocityRadps, -1000, 1000, 'initialAngularVelocityRadps');
  let stepIndex = 0;
  let disposed = false;
  const acceleration = (q: number): number => -frequencySquared * Math.sin(q);
  const energy = (q: number, w: number): number =>
    0.5 * pivotInertia * w * w + 2 * gravityMoment * Math.sin(q / 2) ** 2;
  function active(): void {
    if (disposed) fail('DISPOSED', 'Planar pendulum is disposed');
  }
  function getState(): PlanarPendulumState {
    active();
    return { stepIndex, timeSeconds: stepIndex * dt, angleRad: angle,
      angularVelocityRadps: velocity, angularAccelerationRadps2: acceleration(angle),
      comPositionM: [length * Math.sin(angle), -length * Math.cos(angle), 0],
      energyJ: energy(angle, velocity) };
  }
  return {
    getState,
    step(fixedStepSeconds: number): PlanarPendulumState {
      active();
      if (fixedStepSeconds !== dt) fail('INVALID_STEP', 'Pendulum step must equal its fixedStepSeconds');
      if (stepIndex >= maxSteps) fail('WORLD_LIMIT', 'Pendulum step limit reached');
      // Kick, drift, kick. Commit only after the complete candidate passes admission.
      const halfVelocity = velocity + 0.5 * dt * acceleration(angle);
      const nextAngle = angle + dt * halfVelocity;
      const nextVelocity = halfVelocity + 0.5 * dt * acceleration(nextAngle);
      if (!Number.isFinite(nextAngle) || Math.abs(nextAngle) > 1e6
        || !Number.isFinite(nextVelocity) || Math.abs(nextVelocity) > 1000
        || !Number.isFinite(energy(nextAngle, nextVelocity))) {
        fail('NUMERIC_LIMIT', 'Pendulum candidate exceeded numeric bounds');
      }
      angle = nextAngle;
      velocity = nextVelocity;
      stepIndex++;
      return getState();
    },
    dispose(): void { disposed = true; },
  };
}
