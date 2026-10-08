import { confine, floorSamples, stopOutwardVelocity } from './boundary.js';
import { FLUID_COUNT, FLUID_GRAVITY_MPS2, FLUID_SPACING_M, FLUID_STEP_SECONDS } from './constants.js';
import { densities, gradientScale } from './kernel.js';
import { NeighborGrid } from './neighbors.js';
import { blendVisualViscosity } from './visual-viscosity.js';

export class PbfSolver {
  private readonly grid = new NeighborGrid();
  private readonly predicted = new Float64Array(FLUID_COUNT * 3);
  private readonly combined: Float64Array;
  private readonly density = new Float64Array(FLUID_COUNT);
  private readonly lambda = new Float64Array(FLUID_COUNT);
  private readonly corrections = new Float64Array(FLUID_COUNT * 3);
  private readonly smoothedVelocities: Float64Array | null;

  constructor(private readonly restDensity: number,
    private readonly visualViscosityCoefficient: number) {
    this.smoothedVelocities = visualViscosityCoefficient > 0
      ? new Float64Array(FLUID_COUNT * 3) : null;
    const floor = floorSamples();
    this.combined = new Float64Array(this.predicted.length + floor.length);
    this.combined.set(floor, this.predicted.length);
  }

  private projectDensity(velocities: Float64Array): number {
    this.combined.set(this.predicted);
    densities(this.combined, this.grid, this.density);
    for (let index = 0; index < FLUID_COUNT; index++) {
      const compression = Math.max(0, this.density[index] / this.restDensity - 1);
      if (compression === 0) { this.lambda[index] = 0; continue; }
      let ownX = 0, ownY = 0, ownZ = 0, gradientSum = 0;
      this.grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale = gradientScale(distanceSquared) / this.restDensity;
        const gx = scale * rx, gy = scale * ry, gz = scale * rz;
        ownX += gx; ownY += gy; ownZ += gz;
        gradientSum += gx * gx + gy * gy + gz * gz;
      });
      gradientSum += ownX * ownX + ownY * ownY + ownZ * ownZ;
      this.lambda[index] = -compression / (gradientSum + 0.01);
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      let dx = 0, dy = 0, dz = 0;
      this.grid.each(index, (other, rx, ry, rz, distanceSquared) => {
        if (other === index) return;
        const scale = (this.lambda[index] + (other < FLUID_COUNT ? this.lambda[other] : 0))
          * gradientScale(distanceSquared) / this.restDensity;
        dx += scale * rx; dy += scale * ry; dz += scale * rz;
      });
      const length = Math.hypot(dx, dy, dz);
      const limit = length > FLUID_SPACING_M * 0.25 ? FLUID_SPACING_M * 0.25 / length : 1;
      this.corrections[offset] = dx * limit;
      this.corrections[offset + 1] = dy * limit;
      this.corrections[offset + 2] = dz * limit;
    }
    let boundaryHits = 0;
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        this.predicted[offset + axis] += this.corrections[offset + axis];
      }
      boundaryHits += confine(this.predicted, velocities, index);
    }
    return boundaryHits;
  }

  step(positions: Float64Array, velocities: Float64Array): number {
    let boundaryHits = 0;
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      velocities[offset + 1] += FLUID_STEP_SECONDS * FLUID_GRAVITY_MPS2[1];
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] *= 0.998;
        this.predicted[offset + axis] = positions[offset + axis]
          + FLUID_STEP_SECONDS * velocities[offset + axis];
      }
      boundaryHits += confine(this.predicted, velocities, index);
    }
    for (let iteration = 0; iteration < 3; iteration++) {
      boundaryHits += this.projectDensity(velocities);
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      const offset = index * 3;
      for (let axis = 0; axis < 3; axis++) {
        velocities[offset + axis] = (this.predicted[offset + axis] - positions[offset + axis])
          / FLUID_STEP_SECONDS;
        positions[offset + axis] = this.predicted[offset + axis];
      }
    }
    if (this.smoothedVelocities) {
      blendVisualViscosity(positions, velocities, this.grid, this.smoothedVelocities,
        this.visualViscosityCoefficient);
    }
    for (let index = 0; index < FLUID_COUNT; index++) {
      stopOutwardVelocity(positions, velocities, index);
    }
    return boundaryHits;
  }
}
