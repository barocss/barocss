import type { Vec3 } from '../types.js';

export const FLUID_COUNT = 256;
export const FLUID_STEP_SECONDS = 1 / 120;
export const FLUID_MAX_STEPS = 3600;
export const FLUID_BASIN_M: Vec3 = [0.7, 1.3, 0.5];
export const FLUID_GRAVITY_MPS2: Vec3 = [0, -9.81, 0];
export const FLUID_SPACING_M = 0.05;
export const FLUID_MIN_SPACING_M = 0.025;
export const FLUID_PARTICLE_RADIUS_M = 0.0125;
export const FLUID_SMOOTHING_RADIUS_M = 1.8 * FLUID_SPACING_M;
