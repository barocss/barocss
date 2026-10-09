import { createClothTrial } from './world.mjs';
import { CLOTH_FIXTURE } from './fixture.mjs';

// Vertex collision cannot guarantee continuous triangle/sphere separation.
// Independently sample each rendered triangle's centroid and edge midpoints.
const world = createClothTrial(CLOTH_FIXTURE, 'xpbd', 2, 8);
function sampledLoss() {
  const { triangles, positions } = world.sheet;
  const centre = CLOTH_FIXTURE.sphereCentreM;
  let maxPenetrationM = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    for (const weights of [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]]) {
      const point = [0, 1, 2].map(axis => weights.reduce((sum, weight, i) =>
        sum + weight * positions[3 * triangles[t + i] + axis], 0) - centre[axis]);
      maxPenetrationM = Math.max(maxPenetrationM, CLOTH_FIXTURE.sphereRadiusM - Math.hypot(...point));
    }
  }
  return maxPenetrationM;
}
const snapshots = [{ step: 0, sampledPenetrationM: sampledLoss() }];
let peakSampledPenetrationM = 0, peakStep = 0;
for (let step = 1; step <= 240; step++) {
  world.step();
  const loss = sampledLoss();
  if (loss > peakSampledPenetrationM) { peakSampledPenetrationM = loss; peakStep = step; }
  if (step === 60 || step === 240) snapshots.push({ step, sampledPenetrationM: loss });
}
console.log(JSON.stringify({ result: 'measured', peakSampledPenetrationM, peakStep, snapshots,
  samplesPerTriangle: 4, triangles: 512, continuousTriangleCollision: false }));
