import { BASIN_M, SPACING_M } from './fixture.mjs';

// Fixed samples give the density solver a nonzero normal near the basin floor.
export function floorSamples(basinM = BASIN_M) {
  const points = [];
  const xSteps = Math.round(basinM[0] / SPACING_M);
  const zSteps = Math.round(basinM[2] / SPACING_M);
  for (const y of [0, -SPACING_M]) {
    for (let z = 0; z <= zSteps; z++) {
      for (let x = 0; x <= xSteps; x++) {
        points.push(x * SPACING_M, y, z * SPACING_M);
      }
    }
  }
  return new Float64Array(points);
}

export function withFloor(positions, floor) {
  const combined = new Float64Array(positions.length + floor.length);
  combined.set(positions);
  combined.set(floor, positions.length);
  return combined;
}
