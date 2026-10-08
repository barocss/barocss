import { BASIN_M, confine, GRAVITY_MPS2, SMOOTHING_RADIUS_M, STEP_SECONDS } from './fixture.mjs';
import { floorSamples, withFloor } from './boundary.mjs';
import { densities, gradientScale } from './kernel.mjs';
import { NeighborGrid } from './neighbors.mjs';

export function createSph(fixture, restDensity, basinM = BASIN_M) {
  const { count, positions, velocities } = fixture;
  const radiusSquared = SMOOTHING_RADIUS_M ** 2;
  const grid = new NeighborGrid(SMOOTHING_RADIUS_M);
  const floor = floorSamples(basinM);
  const density = new Float64Array(count);
  const pressure = new Float64Array(count);
  const acceleration = new Float64Array(count * 3);
  let boundaryHits = 0;

  function step() {
    densities(withFloor(positions, floor), grid, radiusSquared, density);
    for (let index = 0; index < count; index++) {
      pressure[index] = 5 * Math.max(0, density[index] / restDensity - 1);
      acceleration[index * 3 + 1] = GRAVITY_MPS2;
    }
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale = -0.5 * (pressure[index] + (other < count ? pressure[other] : 0))
          * gradientScale(distanceSquared, radiusSquared) / restDensity;
        acceleration[offset] += scale * rx;
        acceleration[offset + 1] += scale * ry;
        acceleration[offset + 2] += scale * rz;
      });
    }
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] = 0.998 * (velocities[offset + axis]
          + STEP_SECONDS * acceleration[offset + axis]);
        positions[offset + axis] += STEP_SECONDS * velocities[offset + axis];
        acceleration[offset + axis] = 0;
      }
      boundaryHits += confine(positions, velocities, index, basinM);
    }
  }

  return { positions, velocities, step, get boundaryHits() { return boundaryHits; } };
}
