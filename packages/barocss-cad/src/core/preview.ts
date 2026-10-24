import type { Point, Surface } from '../types.js';
import { evaluateSurface, sampleSurface, validateSurface } from './math.js';
import { validatePreviewPacket, type PreviewPacket } from './packet.js';
import { cross, dot, sub as subtract } from './vec3.js';

export interface TessellationOptions { countU: number; countV: number; revision: number }
export interface ApproximationReport {
  grid: { countU: number; countV: number };
  vertexCount: number;
  triangleCount: number;
  cellCount: number;
  probeCount: number;
  domain: { u: [number, number]; v: [number, number] };
  normalMethod: 'area-weighted-incident-triangle';
  maxSampledDeviationMM: number;
  certified: false;
}
function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new RangeError(message);
}
const scaled = (a: Point, scale: number): Point => [a[0] / scale, a[1] / scale, a[2] / scale];
const positionAt = (positions: number[], index: number): Point => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];

// Closest point from the triangle's vertex/edge/face Voronoi regions. Normalize
// local vectors first so products do not underflow for small nonzero triangles.
function triangleDistance(p: Point, a: Point, b: Point, c: Point): number {
  const abRaw = subtract(b, a), acRaw = subtract(c, a), apRaw = subtract(p, a);
  const scale = Math.max(...abRaw.map(Math.abs), ...acRaw.map(Math.abs), ...apRaw.map(Math.abs));
  requireValue(Number.isFinite(scale) && scale > 0, 'Invalid triangle distance scale');
  const ab = scaled(abRaw, scale), ac = scaled(acRaw, scale), ap = scaled(apRaw, scale);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  let closest: Point;
  if (d1 <= 0 && d2 <= 0) closest = [0, 0, 0];
  else {
    const bp = subtract(ap, ab), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) closest = ab;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        const t = d1 / (d1 - d3); closest = ab.map(value => value * t) as Point;
      } else {
        const cp = subtract(ap, ac), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) closest = ac;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            const t = d2 / (d2 - d6); closest = ac.map(value => value * t) as Point;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              const t = (d4 - d3) / ((d4 - d3) + (d5 - d6));
              closest = ab.map((value, axis) => value + t * (ac[axis] - value)) as Point;
            } else {
              const denominator = va + vb + vc;
              requireValue(Number.isFinite(denominator) && denominator > 0, 'Nonfinite triangle projection');
              closest = ab.map((value, axis) => value * (vb / denominator) + ac[axis] * (vc / denominator)) as Point;
            }
          }
        }
      }
    }
  }
  const result = Math.hypot(...subtract(ap, closest)) * scale;
  requireValue(Number.isFinite(result), 'Nonfinite triangle distance');
  return result;
}

/** Uniform bounded preview mesh. The report is finite-sample evidence, not a bound. */
export function tessellateSurface(surface: Surface, options: TessellationOptions): { packet: PreviewPacket; report: ApproximationReport } {
  requireValue(options !== null && typeof options === 'object', 'Tessellation options are required');
  const { countU, countV, revision } = options;
  requireValue(Number.isInteger(countU) && countU >= 2 && countU <= 64 && Number.isInteger(countV) && countV >= 2 && countV <= 64, 'Grid counts must be integers in 2..64');
  requireValue(Number.isInteger(revision) && revision >= 0 && revision <= 2147483647, 'Revision must be an integer in 0..2147483647');
  const vertexCount = countU * countV, cellCount = (countU - 1) * (countV - 1);
  requireValue(vertexCount <= 4096 && cellCount <= 3969 && cellCount * 5 <= 19845, 'Preview workload exceeds bounds');
  validateSurface(surface);
  const samples = sampleSurface(surface, countU, countV);
  const positions: number[] = [], parameters: number[] = [], indices: number[] = [];
  const normals = Array<number>(vertexCount * 3).fill(0);
  const minimum: Point = [Infinity, Infinity, Infinity], maximum: Point = [-Infinity, -Infinity, -Infinity];
  for (const row of samples) for (const { u, v, point } of row) {
    requireValue(point.every(value => Number.isFinite(value) && Math.abs(value) <= 1e6), 'Preview positions exceed finite coordinate bounds');
    positions.push(...point); parameters.push(u, v);
    for (let axis = 0; axis < 3; axis++) { minimum[axis] = Math.min(minimum[axis], point[axis]); maximum[axis] = Math.max(maximum[axis], point[axis]); }
  }
  const triangle = (a: number, b: number, c: number) => {
    const normal = cross(subtract(positionAt(positions, b), positionAt(positions, a)), subtract(positionAt(positions, c), positionAt(positions, a)));
    const area = Math.hypot(...normal);
    requireValue(Number.isFinite(area) && area > 0, 'Collapsed or nonfinite preview triangle');
    indices.push(a, b, c);
    for (const vertex of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[vertex * 3 + axis] += normal[axis];
  };
  for (let i = 0; i < countU - 1; i++) for (let j = 0; j < countV - 1; j++) {
    const a = i * countV + j, b = (i + 1) * countV + j, c = a + 1, d = b + 1;
    triangle(a, b, c); triangle(b, d, c);
  }
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    const length = Math.hypot(...positionAt(normals, vertex));
    requireValue(Number.isFinite(length) && length > 0, 'Cancelling or zero incident preview normals');
    for (let axis = 0; axis < 3; axis++) normals[vertex * 3 + axis] /= length;
  }
  const packet: PreviewPacket = { version: 0, surfaceId: surface.id, revision, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions, normals, indices, parameters, bounds: { min: minimum, max: maximum } };
  validatePreviewPacket(packet);
  let maxSampledDeviationMM = 0;
  const probes = [[0.5, 0.5], [0.25, 0.25], [0.25, 0.75], [0.75, 0.25], [0.75, 0.75]];
  for (let i = 0; i < countU - 1; i++) for (let j = 0; j < countV - 1; j++) {
    const a = samples[i][j].point, b = samples[i + 1][j].point, c = samples[i][j + 1].point, d = samples[i + 1][j + 1].point;
    for (const [fractionU, fractionV] of probes) {
      const u = (1 - fractionU) * samples[i][j].u + fractionU * samples[i + 1][j].u;
      const v = (1 - fractionV) * samples[i][j].v + fractionV * samples[i][j + 1].v;
      const point = evaluateSurface(surface, u, v);
      const distance = Math.min(triangleDistance(point, a, b, c), triangleDistance(point, b, d, c));
      maxSampledDeviationMM = Math.max(maxSampledDeviationMM, distance);
    }
  }
  return { packet, report: { grid: { countU, countV }, vertexCount, triangleCount: cellCount * 2, cellCount, probeCount: cellCount * 5,
    domain: { u: [samples[0][0].u, samples[countU - 1][0].u], v: [samples[0][0].v, samples[0][countV - 1].v] },
    normalMethod: 'area-weighted-incident-triangle', maxSampledDeviationMM, certified: false } };
}
