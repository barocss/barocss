import { FLUID_SMOOTHING_RADIUS_M } from './constants.js';
import { NeighborGrid } from './neighbors.js';

const radiusSquared = FLUID_SMOOTHING_RADIUS_M ** 2;

export function densityKernel(distanceSquared: number): number {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? q * q * q : 0;
}

export function gradientScale(distanceSquared: number): number {
  const q = 1 - distanceSquared / radiusSquared;
  return q > 0 ? -6 * q * q / radiusSquared : 0;
}

export function densities(positions: Float64Array, grid: NeighborGrid,
  output: Float64Array): void {
  grid.rebuild(positions);
  for (let index = 0; index < output.length; index++) {
    let density = 0;
    grid.each(index, (_other, _x, _y, _z, distanceSquared) => {
      density += densityKernel(distanceSquared);
    });
    output[index] = density;
  }
}

export function initialRestDensity(positions: Float64Array): number {
  const count = positions.length / 3;
  const result = new Float64Array(count);
  densities(positions, new NeighborGrid(), result);
  return result.reduce((sum, density) => sum + density, 0) / count;
}
