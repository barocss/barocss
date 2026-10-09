import { projectDistance, projectSphere } from './constraints.js';
import { CLOTH_PROFILE, CLOTH_SUBSTEPS, CLOTH_ITERATIONS } from './profile.js';
import type { ClothSheet } from './types.js';

/** The measured XPBD order: eight inner steps, two projections per inner step. */
export class ClothSolver {
  private readonly before = new Float64Array(289 * 3);
  private readonly decay = Math.exp(-CLOTH_PROFILE.velocityDecayPerSecond * CLOTH_PROFILE.dt);

  step(sheet: ClothSheet, positions: Float64Array, velocities: Float64Array): void {
    const p = positions, dt = CLOTH_PROFILE.dt;
    for (let substep = 0; substep < CLOTH_SUBSTEPS; substep++) {
      this.before.set(p);
      for (let i = 0; i < sheet.inverseMasses.length; i++) {
        if (sheet.inverseMasses[i] === 0) continue;
        for (let axis = 0; axis < 3; axis++) {
          const j = 3 * i + axis;
          velocities[j] = this.decay * velocities[j] + dt * CLOTH_PROFILE.gravityMps2[axis];
          p[j] += dt * velocities[j];
        }
      }
      for (const constraint of sheet.constraints) constraint.lambda = 0;
      for (let iteration = 0; iteration < CLOTH_ITERATIONS; iteration++) {
        for (const constraint of sheet.constraints) projectDistance(sheet, constraint);
        projectSphere(sheet);
      }
      for (let j = 0; j < p.length; j++) velocities[j] = (p[j] - this.before[j]) / dt;
    }
  }
}
