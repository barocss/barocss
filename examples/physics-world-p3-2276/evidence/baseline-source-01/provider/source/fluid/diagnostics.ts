import { floorSamples } from './boundary.js';
import { FLUID_COUNT } from './constants.js';
import { densities } from './kernel.js';
import { NeighborGrid } from './neighbors.js';
import type { FluidDiagnostics } from './types.js';

const floor = floorSamples();

export function fluidDiagnostics(positions: Float64Array, restDensity: number,
  boundaryHits: number): FluidDiagnostics {
  const combined = new Float64Array(positions.length + floor.length);
  combined.set(positions);
  combined.set(floor, positions.length);
  const density = new Float64Array(FLUID_COUNT);
  densities(combined, new NeighborGrid(), density);
  let absoluteError = 0;
  const compressions = new Array<number>(FLUID_COUNT);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const difference = density[index] / restDensity - 1;
    absoluteError += Math.abs(difference);
    compressions[index] = Math.max(0, difference);
  }
  compressions.sort((a, b) => a - b);
  return { meanAbsoluteDensityError: absoluteError / FLUID_COUNT,
    p95Compression: compressions[Math.ceil(0.95 * FLUID_COUNT) - 1], boundaryHits };
}
