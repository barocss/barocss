import { CadNumericPolicy } from '@barocss/cad';
import { finiteBinary64Integer } from '@barocss/cad-model/engine/binary64';
import type { P2 } from '@barocss/cad-model/sketch/profile';

const { coordinateAbs, linearTolerance } = CadNumericPolicy;
const minRadius = 0.25;
const coordinateLimit = finiteBinary64Integer(coordinateAbs);
const inRange = (p: P2) => p.length === 2 && p.every(value => Number.isFinite(value) && Math.abs(value) <= coordinateAbs);
const compare = (a: P2, b: P2) => a[0] - b[0] || a[1] - b[1];
const nearDiameter = 'The points are too close to a diameter to separate the two centers.';

function squaredDiscriminant(a: P2, b: P2, radius: bigint): bigint {
  const dx = finiteBinary64Integer(b[0]) - finiteBinary64Integer(a[0]);
  const dy = finiteBinary64Integer(b[1]) - finiteBinary64Integer(a[1]);
  const diameter = 2n * radius;
  return diameter * diameter - dx * dx - dy * dy;
}

/** Candidate centers of a circle through two accepted points in sketch coordinates. */
export function circleFromChord(a: P2, b: P2, radius: number): { centers: readonly P2[] } | { error: string } {
  if (!Number.isFinite(radius) || radius < minRadius || radius > coordinateAbs) {
    return { error: `Enter a radius from ${minRadius} to ${coordinateAbs} mm.` };
  }
  if (!inRange(a) || !inRange(b)) return { error: 'The two points must be within the supported sketch coordinates.' };

  // Canonical endpoint order also makes the arithmetic identical when picks are reversed.
  const [first, last] = compare(a, b) <= 0 ? [a, b] : [b, a];
  const dx = last[0] - first[0], dy = last[1] - first[1], chord = Math.hypot(dx, dy);
  if (!(chord > linearTolerance)) return { error: 'Choose two distinct points farther apart.' };

  const exactRadius = finiteBinary64Integer(radius), discriminant = squaredDiscriminant(first, last, exactRadius);
  if (discriminant < 0n) return { error: 'The chord is longer than the entered diameter.' };
  const midpoint: P2 = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
  const centers = [midpoint];
  if (discriminant > 0n) {
    if (2 * radius - chord <= linearTolerance) return { error: nearDiameter };

    // The exact discriminant is in units of 2^-2148 mm². Shift it before conversion
    // so it fits binary64. The quarter discriminant loses less than 2^-102 mm² in
    // that shift, below binary64 resolution throughout the admitted two-center range.
    const offset = Math.sqrt(Number(discriminant >> 2048n) * 2 ** -102);
    const x = -dy / chord * offset, y = dx / chord * offset;
    centers[0] = [midpoint[0] - x, midpoint[1] - y];
    centers.push([midpoint[0] + x, midpoint[1] + y]);
    if (!(Math.hypot(centers[0][0] - centers[1][0], centers[0][1] - centers[1][1]) > linearTolerance)) {
      return { error: nearDiameter };
    }
  }

  const limit = coordinateLimit - exactRadius;
  for (const center of centers) {
    if (!inRange(center) || center.some(value => finiteBinary64Integer(Math.abs(value)) > limit)) {
      return { error: 'A possible circle extends beyond the supported sketch coordinates.' };
    }
    if ([first, last].some(point => Math.abs(Math.hypot(center[0] - point[0], center[1] - point[1]) - radius) > linearTolerance)) {
      return { error: 'The circle cannot pass through both points within sketch precision.' };
    }
  }
  return { centers: centers.sort(compare) };
}
