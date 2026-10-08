import { FLUID_COUNT } from './constants.js';
import { densityKernel } from './kernel.js';
import { NeighborGrid } from './neighbors.js';

/** Simultaneous neighbour velocity blend for the opt-in visual profile. */
export function blendVisualViscosity(positions: Float64Array, velocities: Float64Array,
  grid: NeighborGrid, output: Float64Array, coefficient: number): void {
  grid.rebuild(positions);
  for (let index = 0; index < FLUID_COUNT; index++) {
    const offset = index * 3;
    let weightSum = 0;
    let vx = 0, vy = 0, vz = 0;
    grid.each(index, (other, _rx, _ry, _rz, distanceSquared) => {
      const weight = densityKernel(distanceSquared);
      const otherOffset = other * 3;
      weightSum += weight;
      vx += weight * velocities[otherOffset];
      vy += weight * velocities[otherOffset + 1];
      vz += weight * velocities[otherOffset + 2];
    });
    const blend = weightSum > 0 ? coefficient / weightSum : 0;
    output[offset] = velocities[offset] + blend * (vx - weightSum * velocities[offset]);
    output[offset + 1] = velocities[offset + 1] + blend * (vy - weightSum * velocities[offset + 1]);
    output[offset + 2] = velocities[offset + 2] + blend * (vz - weightSum * velocities[offset + 2]);
  }
  velocities.set(output);
}
