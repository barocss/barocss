import { createHash } from 'node:crypto';
import { BASIN_M, countEscapes, SMOOTHING_RADIUS_M } from './fixture.mjs';
import { floorSamples, withFloor } from './boundary.mjs';
import { densities } from './kernel.mjs';
import { NeighborGrid } from './neighbors.mjs';

function percentile(values, ratio) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ratio * ordered.length) - 1)];
}

export function restDensity(positions) {
  const grid = new NeighborGrid(SMOOTHING_RADIUS_M);
  const sample = densities(positions, grid, SMOOTHING_RADIUS_M ** 2,
    new Float64Array(positions.length / 3));
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

export function measure(positions, velocities, referenceDensity, stepTimesMs, boundaryHits,
  basinM = BASIN_M) {
  const grid = new NeighborGrid(SMOOTHING_RADIUS_M);
  const current = densities(withFloor(positions, floorSamples(basinM)), grid, SMOOTHING_RADIUS_M ** 2,
    new Float64Array(positions.length / 3));
  const errors = [...current].map((value) => Math.abs(value / referenceDensity - 1));
  const compressions = [...current].map((value) => Math.max(0, value / referenceDensity - 1));
  const finite = [...positions, ...velocities].every(Number.isFinite);
  return {
    medianStepMs: percentile(stepTimesMs, 0.5),
    p95StepMs: percentile(stepTimesMs, 0.95),
    meanAbsoluteDensityError: errors.reduce((sum, value) => sum + value, 0) / errors.length,
    p95Compression: percentile(compressions, 0.95),
    boundaryHits,
    escapedParticles: countEscapes(positions, basinM),
    finite,
    positionSha256: createHash('sha256').update(Buffer.from(positions.buffer,
      positions.byteOffset, positions.byteLength)).digest('hex'),
  };
}
