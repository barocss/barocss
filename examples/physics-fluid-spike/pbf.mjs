import { BASIN_M, confine, GRAVITY_MPS2, SMOOTHING_RADIUS_M, SPACING_M, STEP_SECONDS,
  stopOutwardVelocity } from './fixture.mjs';
import { floorSamples, withFloor } from './boundary.mjs';
import { densities, gradientScale } from './kernel.mjs';
import { NeighborGrid } from './neighbors.mjs';

export function createPbf(fixture, restDensity, basinM = BASIN_M) {
  const { count, positions, velocities } = fixture;
  const radiusSquared = SMOOTHING_RADIUS_M ** 2;
  const grid = new NeighborGrid(SMOOTHING_RADIUS_M);
  const floor = floorSamples(basinM);
  const predicted = new Float64Array(positions.length);
  const density = new Float64Array(count);
  const lambda = new Float64Array(count);
  const corrections = new Float64Array(positions.length);
  let boundaryHits = 0;

  function constraints() {
    densities(withFloor(predicted, floor), grid, radiusSquared, density);
    for (let index = 0; index < count; index++) {
      const compression = Math.max(0, density[index] / restDensity - 1);
      if (compression === 0) { lambda[index] = 0; continue; }
      let ownX = 0, ownY = 0, ownZ = 0, gradientSum = 0;
      grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale = gradientScale(distanceSquared, radiusSquared) / restDensity;
        const gx = scale * rx, gy = scale * ry, gz = scale * rz;
        ownX += gx; ownY += gy; ownZ += gz;
        gradientSum += gx * gx + gy * gy + gz * gz;
      });
      gradientSum += ownX * ownX + ownY * ownY + ownZ * ownZ;
      lambda[index] = -compression / (gradientSum + 0.01);
    }
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      let dx = 0, dy = 0, dz = 0;
      grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale = (lambda[index] + (other < count ? lambda[other] : 0))
          * gradientScale(distanceSquared, radiusSquared) / restDensity;
        dx += scale * rx; dy += scale * ry; dz += scale * rz;
      });
      const length = Math.hypot(dx, dy, dz);
      const limit = length > SPACING_M * 0.25 ? SPACING_M * 0.25 / length : 1;
      corrections[offset] = dx * limit;
      corrections[offset + 1] = dy * limit;
      corrections[offset + 2] = dz * limit;
    }
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) predicted[offset + axis] += corrections[offset + axis];
      boundaryHits += confine(predicted, velocities, index, basinM);
    }
  }

  function step() {
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      velocities[offset + 1] += STEP_SECONDS * GRAVITY_MPS2;
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] *= 0.998;
        predicted[offset + axis] = positions[offset + axis]
          + STEP_SECONDS * velocities[offset + axis];
      }
      boundaryHits += confine(predicted, velocities, index, basinM);
    }
    for (let iteration = 0; iteration < 3; iteration++) constraints();
    for (let index = 0; index < count; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] = (predicted[offset + axis] - positions[offset + axis]) / STEP_SECONDS;
        positions[offset + axis] = predicted[offset + axis];
      }
      stopOutwardVelocity(positions, velocities, index, basinM);
    }
  }

  return { positions, velocities, step, get boundaryHits() { return boundaryHits; } };
}
