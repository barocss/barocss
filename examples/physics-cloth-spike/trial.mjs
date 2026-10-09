import { createClothTrial } from './world.mjs';
import { clothMetrics, percentile95 } from './metrics.mjs';
import { FEASIBILITY } from './fixture.mjs';

export function runTrial(fixture, model, iterations, capture = false, substeps = 1) {
  const world = createClothTrial(fixture, model, iterations, substeps);
  const peaks = { maxExtension: 0, maxCompression: 0, maxPenetrationM: 0, maxPinDriftM: 0 };
  const snapshots = [{ step: 0, metrics: clothMetrics(world.sheet, fixture),
    ...(capture ? { positionsM: Array.from(world.sheet.positions) } : {}) }];
  const timings = [];
  for (let step = 1; step <= FEASIBILITY.steps; step++) {
    const start = performance.now();
    world.step();
    timings.push(performance.now() - start);
    const metrics = clothMetrics(world.sheet, fixture);
    for (const key of Object.keys(peaks)) peaks[key] = Math.max(peaks[key], metrics[key]);
    if (step === 60 || step === 240) snapshots.push({ step, metrics,
      ...(capture ? { positionsM: Array.from(world.sheet.positions) } : {}) });
  }
  const p95StepMs = percentile95(timings.slice(30));
  return { size: fixture.size, vertices: fixture.size ** 2,
    triangles: world.sheet.triangles.length / 3, constraints: world.sheet.constraints.length,
    model, iterations, substeps, totalMassKg: world.sheet.totalMassKg, peaks, snapshots, p95StepMs,
    feasibilityPassed: fixture.size === 17 && peaks.maxExtension <= FEASIBILITY.maxExtension &&
      peaks.maxPenetrationM <= FEASIBILITY.maxPenetrationM &&
      peaks.maxPinDriftM <= FEASIBILITY.maxPinDriftM && p95StepMs <= FEASIBILITY.maxP95StepMs,
    finalPositionsM: world.sheet.positions.slice() };
}
