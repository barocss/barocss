export const STEP_SECONDS = 1 / 120;
export const SPACING_M = 0.05;
export const SMOOTHING_RADIUS_M = 1.8 * SPACING_M;
export const BASIN_M = [1.8, 1.3, 1.8];
export const VISUAL_BASIN_M = [0.7, 1.3, 0.5];
export const PARTICLE_RADIUS_M = 0.0125;
export const GRAVITY_MPS2 = -9.81;

const layouts = new Map([
  [256, [8, 8, 4]],
  [1024, [16, 8, 8]],
  [4096, [16, 16, 16]],
]);

export function createFixture(count) {
  const layout = layouts.get(count);
  if (!layout) throw new Error(`Unsupported spike count: ${count}`);
  const positions = new Float64Array(count * 3);
  const velocities = new Float64Array(count * 3);
  let index = 0;
  for (let z = 0; z < layout[2]; z++) {
    for (let y = 0; y < layout[1]; y++) {
      for (let x = 0; x < layout[0]; x++) {
        const offset = index++ * 3;
        positions[offset] = 0.2 + x * SPACING_M;
        positions[offset + 1] = 0.45 + y * SPACING_M;
        positions[offset + 2] = 0.3 + z * SPACING_M;
      }
    }
  }
  return { count, positions, velocities };
}

export function confine(positions, velocities, index, basinM = BASIN_M) {
  let hits = 0;
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = PARTICLE_RADIUS_M;
    const high = basinM[axis] - PARTICLE_RADIUS_M;
    if (positions[point] < low || positions[point] > high) {
      positions[point] = Math.max(low, Math.min(high, positions[point]));
      velocities[point] *= -0.1;
      hits++;
    }
  }
  return hits;
}

export function stopOutwardVelocity(positions, velocities, index, basinM = BASIN_M) {
  const offset = index * 3;
  for (let axis = 0; axis < 3; axis++) {
    const point = offset + axis;
    const low = PARTICLE_RADIUS_M;
    const high = basinM[axis] - PARTICLE_RADIUS_M;
    if ((positions[point] <= low + 1e-9 && velocities[point] < 0)
      || (positions[point] >= high - 1e-9 && velocities[point] > 0)) {
      velocities[point] *= -0.1;
    }
  }
}

export function countEscapes(positions, basinM = BASIN_M) {
  let escaped = 0;
  for (let index = 0; index < positions.length / 3; index++) {
    for (let axis = 0; axis < 3; axis++) {
      const value = positions[index * 3 + axis];
      if (!Number.isFinite(value) || value < PARTICLE_RADIUS_M - 1e-9
        || value > basinM[axis] - PARTICLE_RADIUS_M + 1e-9) {
        escaped++;
        break;
      }
    }
  }
  return escaped;
}
