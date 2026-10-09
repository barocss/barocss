import { createSheet } from './topology.mjs';
import { projectDistance, projectSphere } from './constraints.mjs';

// Research-only mutable state. This is not a public Physics API.
export function createClothTrial(fixture, model, iterations, substeps = 1) {
  const schedule = `${substeps}x${iterations}`;
  if (!['pbd', 'xpbd'].includes(model) || !['1x4', '1x8', '1x16', '4x2', '8x2', '16x1'].includes(schedule) ||
    (substeps > 1 && model !== 'xpbd') ||
    ![17, 33].includes(fixture.size)) throw new Error('Unsupported research configuration');
  const sheet = createSheet(fixture);
  const velocities = new Float64Array(sheet.positions.length);
  const before = new Float64Array(sheet.positions.length);
  const innerFixture = { ...fixture, dt: fixture.dt / substeps };
  const decay = Math.exp(-fixture.velocityDecayPerSecond * innerFixture.dt);
  let stepIndex = 0;
  function advance() {
      const p = sheet.positions, dt = innerFixture.dt;
      before.set(p);
      for (let i = 0; i < sheet.inverseMasses.length; i++) {
        if (sheet.inverseMasses[i] === 0) continue;
        for (let axis = 0; axis < 3; axis++) {
          const j = 3 * i + axis;
          velocities[j] = decay * velocities[j] + dt * fixture.gravityMps2[axis];
          p[j] += dt * velocities[j];
        }
      }
      for (const constraint of sheet.constraints) constraint.lambda = 0;
      for (let iteration = 0; iteration < iterations; iteration++) {
        for (const constraint of sheet.constraints) projectDistance(sheet, constraint, innerFixture, model);
        projectSphere(sheet, innerFixture);
      }
      for (let j = 0; j < p.length; j++) velocities[j] = (p[j] - before[j]) / dt;
      if (!p.every(Number.isFinite) || !velocities.every(Number.isFinite)) {
        throw new Error(`Non-finite research state at step ${stepIndex + 1}`);
      }
  }
  return { sheet, velocities, getStep: () => stepIndex,
    step() {
      for (let i = 0; i < substeps; i++) advance();
      stepIndex++;
      return sheet;
    },
  };
}
