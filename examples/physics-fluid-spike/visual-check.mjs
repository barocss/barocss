import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createFixture, VISUAL_BASIN_M } from './fixture.mjs';
import { measure, restDensity } from './metrics.mjs';
import { createPbf } from './pbf.mjs';
import { createSph } from './sph.mjs';

const count = 256;
const density = restDensity(createFixture(count).positions);
const report = { format: 'barocss-fluid-visual-fixture', version: 1,
  fixture: { particles: count, basinM: VISUAL_BASIN_M, horizons: [60, 240],
    fixedStepSeconds: 1 / 120 }, results: [] };

function run(create) {
  const state = create(createFixture(count), density, VISUAL_BASIN_M);
  const times = [];
  const checkpoints = [];
  for (let step = 1; step <= 240; step++) {
    const start = performance.now();
    state.step();
    times.push(performance.now() - start);
    if (step === 60 || step === 240) {
      const ys = Array.from({ length: count }, (_, index) => state.positions[index * 3 + 1]);
      checkpoints.push({ step, particlesAbove5cm: ys.filter((y) => y > 0.05).length,
        maxHeightM: Math.max(...ys), ...measure(state.positions, state.velocities,
          density, times, state.boundaryHits, VISUAL_BASIN_M) });
    }
  }
  return checkpoints;
}

for (const [name, create] of [['sph-pressure-spike', createSph], ['pbf-density-spike', createPbf]]) {
  const checkpoints = run(create);
  const repeat = run(create);
  report.results.push({ solver: name, checkpoints,
    repeatStateMatches: checkpoints.every((point, index) =>
      point.positionSha256 === repeat[index].positionSha256) });
}

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
