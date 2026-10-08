import { FLUID_BASIN_M, FLUID_PARTICLE_RADIUS_M, FLUID_SPACING_M } from './constants.js';

export function floorSamples(): Float64Array {
  const points: number[] = [];
  const xSteps = Math.round(FLUID_BASIN_M[0] / FLUID_SPACING_M);
  const zSteps = Math.round(FLUID_BASIN_M[2] / FLUID_SPACING_M);
  for (const y of [0, -FLUID_SPACING_M]) {
    for (let z = 0; z <= zSteps; z++) {
      for (let x = 0; x <= xSteps; x++) {
        points.push(x * FLUID_SPACING_M, y, z * FLUID_SPACING_M);
      }
    }
  }
  return new Float64Array(points);
}

export function confine(positions: Float64Array, velocities: Float64Array, index: number): number {
  let hits = 0;
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = FLUID_PARTICLE_RADIUS_M;
    const high = FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M;
    if (positions[point] < low || positions[point] > high) {
      positions[point] = Math.max(low, Math.min(high, positions[point]));
      velocities[point] *= -0.1;
      hits++;
    }
  }
  return hits;
}

export function stopOutwardVelocity(positions: Float64Array, velocities: Float64Array,
  index: number): void {
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = FLUID_PARTICLE_RADIUS_M;
    const high = FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M;
    if ((positions[point] <= low + 1e-9 && velocities[point] < 0)
      || (positions[point] >= high - 1e-9 && velocities[point] > 0)) {
      velocities[point] *= -0.1;
    }
  }
}

export function insideBasin(positions: Float64Array): boolean {
  for (let index = 0; index < positions.length / 3; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[index * 3 + axis];
      if (!Number.isFinite(value) || value < FLUID_PARTICLE_RADIUS_M - 1e-9
        || value > FLUID_BASIN_M[axis] - FLUID_PARTICLE_RADIUS_M + 1e-9) return false;
    }
  }
  return true;
}
