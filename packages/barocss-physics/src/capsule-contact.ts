import type { Body, BoxShape, CapsuleShape, Hit, Vec3 } from './types.js';
import { add, dot, localPoint, rotate, scale, sub, worldPoint } from './math.js';

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

function capsuleEnds(body: Body): [Vec3, Vec3] {
  const half = (body.shape as CapsuleShape).halfLengthM;
  return [worldPoint(body, [0, -half, 0]), worldPoint(body, [0, half, 0])];
}

function segmentPair(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): [Vec3, Vec3] {
  const u = sub(a1, a0), v = sub(b1, b0), w = sub(a0, b0);
  const aa = dot(u, u), bb = dot(u, v), cc = dot(v, v);
  const dd = dot(u, w), ee = dot(v, w), determinant = aa * cc - bb * bb;
  const candidates: Array<[number, number]> = [
    [0, clamp(ee / cc, 0, 1)], [1, clamp((bb + ee) / cc, 0, 1)],
    [clamp(-dd / aa, 0, 1), 0], [clamp((bb - dd) / aa, 0, 1), 1],
    [0.5, clamp((bb * 0.5 + ee) / cc, 0, 1)],
    [clamp((bb * 0.5 - dd) / aa, 0, 1), 0.5],
  ];
  if (determinant > 1e-12 * aa * cc) {
    const s = (bb * ee - cc * dd) / determinant;
    const t = (aa * ee - bb * dd) / determinant;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidates.push([s, t]);
  }
  let best = candidates[0], bestDistance = Infinity, bestTie = Infinity;
  for (const candidate of candidates) {
    const difference = sub(add(a0, scale(u, candidate[0])), add(b0, scale(v, candidate[1])));
    const distance = dot(difference, difference);
    const tie = Math.abs(candidate[0] - 0.5) + Math.abs(candidate[1] - 0.5);
    if (distance < bestDistance - 1e-12 || (Math.abs(distance - bestDistance) <= 1e-12 && tie < bestTie)) {
      best = candidate; bestDistance = distance; bestTie = tie;
    }
  }
  return [add(a0, scale(u, best[0])), add(b0, scale(v, best[1]))];
}

function segmentBox(segmentStart: Vec3, segmentEnd: Vec3, extents: Vec3): [Vec3, Vec3] {
  const direction = sub(segmentEnd, segmentStart);
  const breaks = [0, 1];
  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(direction[axis]) < 1e-15) continue;
    for (const face of [-extents[axis], extents[axis]]) {
      const t = (face - segmentStart[axis]) / direction[axis];
      if (t > 0 && t < 1) breaks.push(t);
    }
  }
  breaks.sort((a, b) => a - b);
  let bestT = 0.5, bestDistance = Infinity;
  for (let interval = 0; interval < breaks.length - 1; interval++) {
    const low = breaks[interval], high = breaks[interval + 1];
    if (high - low < 1e-15) continue;
    const midpoint = (low + high) / 2;
    let numerator = 0, denominator = 0;
    for (let axis = 0; axis < 3; axis++) {
      const value = segmentStart[axis] + midpoint * direction[axis];
      const face = value < -extents[axis] ? -extents[axis]
        : value > extents[axis] ? extents[axis] : null;
      if (face === null) continue;
      numerator += direction[axis] * (segmentStart[axis] - face);
      denominator += direction[axis] ** 2;
    }
    const t = clamp(denominator ? -numerator / denominator : 0.5, low, high);
    const point = add(segmentStart, scale(direction, t));
    const nearest = point.map((value, axis) => clamp(value, -extents[axis], extents[axis])) as Vec3;
    const delta = sub(point, nearest), distance = dot(delta, delta);
    if (distance < bestDistance - 1e-12
      || (Math.abs(distance - bestDistance) <= 1e-12 && Math.abs(t - 0.5) < Math.abs(bestT - 0.5))) {
      bestT = t; bestDistance = distance;
    }
  }
  const point = add(segmentStart, scale(direction, bestT));
  return [point, point.map((value, axis) => clamp(value, -extents[axis], extents[axis])) as Vec3];
}

export function capsuleCapsule(a: Body, b: Body): Hit | null {
  const [aPoint, bPoint] = segmentPair(...capsuleEnds(a), ...capsuleEnds(b));
  const delta = sub(bPoint, aPoint), distance = Math.hypot(...delta);
  const aRadius = (a.shape as CapsuleShape).radiusM;
  const bRadius = (b.shape as CapsuleShape).radiusM;
  if (distance > aRadius + bRadius) return null;
  const centerDelta = sub(b.positionM, a.positionM);
  const normal = distance > 1e-12 ? scale(delta, 1 / distance)
    : Math.hypot(...centerDelta) > 1e-12 ? scale(centerDelta, 1 / Math.hypot(...centerDelta))
      : (a.id < b.id ? [1, 0, 0] : [-1, 0, 0]) as Vec3;
  const surfaceA = add(aPoint, scale(normal, aRadius));
  const surfaceB = sub(bPoint, scale(normal, bRadius));
  return { normal, penetration: Math.max(0, aRadius + bRadius - distance),
    pointM: scale(add(surfaceA, surfaceB), 0.5) };
}

export function capsuleBox(capsule: Body, box: Body): Hit | null {
  const [start, end] = capsuleEnds(capsule).map((point) => localPoint(box, point)) as [Vec3, Vec3];
  const extents = (box.shape as BoxShape).halfExtentsM;
  const [axisPoint, boxPoint] = segmentBox(start, end, extents);
  const delta = sub(boxPoint, axisPoint), distance = Math.hypot(...delta);
  const radius = (capsule.shape as CapsuleShape).radiusM;
  if (distance > radius) return null;
  if (distance > 1e-12) return { normal: rotate(box.orientation, scale(delta, 1 / distance)),
    penetration: radius - distance, pointM: worldPoint(box, boxPoint) };
  let bestAxis = 0, bestSide = -1, bestGap = Infinity;
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    const gap = extents[axis] - side * axisPoint[axis];
    if (gap < bestGap) { bestGap = gap; bestAxis = axis; bestSide = side; }
  }
  const normalLocal: Vec3 = [0, 0, 0];
  normalLocal[bestAxis] = -bestSide;
  boxPoint[bestAxis] = bestSide * extents[bestAxis];
  return { normal: rotate(box.orientation, normalLocal), penetration: radius + bestGap,
    pointM: worldPoint(box, boxPoint) };
}
