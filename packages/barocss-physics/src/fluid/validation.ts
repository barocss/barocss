import { PhysicsError } from '../types.js';
import type { Vec3 } from '../types.js';
import { FLUID_BASIN_M, FLUID_COUNT, FLUID_GRAVITY_MPS2, FLUID_MIN_SPACING_M,
  FLUID_PARTICLE_RADIUS_M, FLUID_STEP_SECONDS } from './constants.js';
import type { AcceptedFluidScene } from './types.js';

function invalid(message: string): never { throw new PhysicsError('INVALID_CONFIG', message); }

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Fluid scene must be a plain object');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) invalid('Fluid scene must be a plain object');
  return value as Record<string, unknown>;
}

function exactFields(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    invalid(`${label} has an unsupported field`);
  }
  if (allowed.some((key) => !Object.hasOwn(value, key))) invalid(`${label} is missing a field`);
}

function triple(value: unknown, label: string): Vec3 {
  if (!Array.isArray(value) || value.length !== 3 || Reflect.ownKeys(value).length !== 4
    || ![0, 1, 2].every((index) => Object.hasOwn(value, index))) {
    invalid(`${label} must be a dense 3-vector`);
  }
  if (!value.every((part) => typeof part === 'number' && Number.isFinite(part))) {
    invalid(`${label} must contain finite numbers`);
  }
  return [value[0], value[1], value[2]];
}

function exactTriple(value: unknown, expected: Vec3, label: string): void {
  const actual = triple(value, label);
  if (actual.some((part, axis) => part !== expected[axis])) invalid(`${label} is unsupported`);
}

export function admitFluidScene(value: unknown): AcceptedFluidScene {
  const scene = plainObject(value);
  exactFields(scene, ['format', 'version', 'revision', 'basis', 'fixedStepSeconds',
    'gravityMps2', 'basinM', 'initialPositionsM'], 'Fluid scene');
  if (scene.format !== 'barocss-fluid-scene' || scene.version !== 1
    || scene.basis !== 'right-handed-xyz-metres'
    || scene.fixedStepSeconds !== FLUID_STEP_SECONDS) invalid('Unsupported FluidSceneV1 contract');
  if (typeof scene.revision !== 'string' || !/^[A-Za-z][A-Za-z0-9._:-]{0,63}$/.test(scene.revision)) {
    invalid('Fluid scene revision must be a qualified ASCII identifier');
  }
  exactTriple(scene.gravityMps2, FLUID_GRAVITY_MPS2, 'gravityMps2');
  exactTriple(scene.basinM, FLUID_BASIN_M, 'basinM');
  const points = scene.initialPositionsM;
  if (!Array.isArray(points) || points.length !== FLUID_COUNT
    || Reflect.ownKeys(points).length !== FLUID_COUNT + 1
    || !Array.from({ length: FLUID_COUNT }, (_, index) => Object.hasOwn(points, index)).every(Boolean)) {
    invalid(`initialPositionsM must contain exactly ${FLUID_COUNT} dense tuples`);
  }
  const positions = new Float64Array(FLUID_COUNT * 3);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const point = triple(points[index], `initialPositionsM[${index}]`);
    for (let axis = 0; axis < 3; axis++) {
      if (point[axis] < FLUID_PARTICLE_RADIUS_M
        || point[axis] > FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M) {
        invalid(`initialPositionsM[${index}] is outside the basin`);
      }
      positions[index * 3 + axis] = point[axis];
    }
  }
  const minimumSquared = FLUID_MIN_SPACING_M ** 2;
  for (let first = 0; first < FLUID_COUNT; first++) {
    for (let second = first + 1; second < FLUID_COUNT; second++) {
      const dx = positions[first * 3] - positions[second * 3];
      const dy = positions[first * 3 + 1] - positions[second * 3 + 1];
      const dz = positions[first * 3 + 2] - positions[second * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < minimumSquared - 1e-12) {
        invalid('Initial particles must be at least 0.025 m apart');
      }
    }
  }
  return { revision: scene.revision, initialPositionsM: positions };
}
