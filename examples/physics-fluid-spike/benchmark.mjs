import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { createFixture, BASIN_M, SMOOTHING_RADIUS_M, SPACING_M, STEP_SECONDS } from './fixture.mjs';
import { measure, restDensity } from './metrics.mjs';
import { createPbf } from './pbf.mjs';
import { createSph } from './sph.mjs';

const steps = Number(process.env.FLUID_SPIKE_STEPS ?? 60);
if (!Number.isInteger(steps) || steps < 1 || steps > 600) throw new Error('Steps must be 1..600');
const outputPath = process.argv[2];
if (process.argv.length > 3) throw new Error('Usage: node --expose-gc benchmark.mjs [report.json]');

const results = [];
for (const count of [256, 1024, 4096]) {
  const referenceDensity = restDensity(createFixture(count).positions);
  for (const [solver, create] of [['sph-pressure-spike', createSph], ['pbf-density-spike', createPbf]]) {
    global.gc?.();
    const beforeHeapBytes = process.memoryUsage().heapUsed;
    const state = create(createFixture(count), referenceDensity);
    const stepTimesMs = [];
    for (let step = 0; step < steps; step++) {
      const start = performance.now();
      state.step();
      stepTimesMs.push(performance.now() - start);
    }
    global.gc?.();
    const retainedHeapDeltaBytes = process.memoryUsage().heapUsed - beforeHeapBytes;
    const metrics = measure(state.positions, state.velocities, referenceDensity,
      stepTimesMs, state.boundaryHits);
    const row = { solver, particles: count, steps, referenceDensity,
      retainedHeapDeltaBytes, ...metrics };
    results.push(row);
    process.stderr.write(`${solver} ${count}: p95 ${row.p95StepMs.toFixed(2)} ms, density error ${row.meanAbsoluteDensityError.toFixed(3)}\n`);
  }
}

const report = { format: 'barocss-fluid-solver-spike', version: 1,
  fixture: { dimension: 3, basinM: BASIN_M, spacingM: SPACING_M,
    smoothingRadiusM: SMOOTHING_RADIUS_M, fixedStepSeconds: STEP_SECONDS,
    steps, densityReference: 'mean initial normalized kernel density',
    boundary: 'static axis-aligned clamp with 0.1 rebound and two layers of fixed floor density samples',
    particleCounts: [256, 1024, 4096] },
  environment: { node: process.version, platform: process.platform, arch: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown', totalMemoryBytes: totalmem(),
    garbageCollectionExposed: typeof global.gc === 'function' },
  methods: {
    sph: 'Positive normalized-density pressure, stiffness 5, explicit velocity step, damping 0.998',
    pbf: 'Three positive-compression density iterations, epsilon 0.01, correction capped at 0.25 spacing',
    memory: 'GC-assisted retained heap delta; not total allocations or peak resident memory',
  }, results };
if (outputPath) writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
