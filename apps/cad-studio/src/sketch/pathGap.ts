import { CadNumericPolicy } from '@barocss/cad';
import { arcOf, type Arc, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

type Polygon = Extract<SketchShape, { kind: 'polygon' }>;

export interface PreparedPathGap {
  shape: Polygon & { ids: [string, string] };
  arc: Arc | null;
}

export interface PathGapPlan {
  hit: P2;
  removed: P2[];
  cutA: P2;
  cutB: P2;
  bulges: [number, number];
}

const fullTurn = 2 * Math.PI;
// Finish calls joinOpen with this distance. A stored gap must survive that join.
const openJoinTolerance = 1e-4;
const storedPathTolerance = 1e-5;

const inRange = (point: P2) => point.every(value => Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs);
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const storedPoint = ([x, y]: P2): P2 => [Math.round(x * 1e6) / 1e6 || 0, Math.round(y * 1e6) / 1e6 || 0];

export function preparePathGap(shape: SketchShape): PreparedPathGap | null {
  if (shape.kind !== 'polygon' || !shape.construction || shape.closed || shape.pending || shape.points.length !== 2) return null;
  const { ids } = shape;
  if (ids?.length !== 2 || typeof ids[0] !== 'string' || typeof ids[1] !== 'string' || !ids[0] || !ids[1] || ids[0] === ids[1]) return null;
  if (shape.fromRectangle || shape.fromSpline || shape.spline || shape.fromEllipse || shape.ellipse) return null;
  if (Object.keys(shape.lengths ?? {}).length || Object.keys(shape.radii ?? {}).length || shape.tangents?.length ||
      shape.equalRadii?.length || shape.concentric?.length || shape.hv?.h?.length || shape.hv?.v?.length ||
      shape.rules?.length || shape.circles?.length || shape.circleIds?.length) return null;

  const [a, b] = shape.points, bulge = shape.bulges?.[0] ?? 0;
  const { coordinateAbs, linearTolerance } = CadNumericPolicy;
  if (!Number.isFinite(bulge) || !inRange(a) || !inRange(b) || distance(a, b) <= linearTolerance) return null;
  const identified = shape as PreparedPathGap['shape'];
  if (bulge === 0) return { shape: identified, arc: null };
  const arc = arcOf(a, b, bulge);
  if (!inRange(arc.center) || !Number.isFinite(arc.radius) || arc.radius <= linearTolerance ||
      arc.center.some(value => Math.abs(value) + arc.radius > coordinateAbs) ||
      Math.abs(distance(b, arc.center) - arc.radius) > linearTolerance || Math.abs(arc.sweep) >= fullTurn) return null;
  return { shape: identified, arc };
}

function separateStoredEnds(a: P2, cutA: P2, cutB: P2, b: P2): boolean {
  if (!inRange(cutA) || !inRange(cutB)) return false;
  const ends = [a, cutA, cutB, b];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      if (distance(ends[i], ends[j]) <= openJoinTolerance) return false;
    }
  }
  return true;
}

function planLineGap(a: P2, b: P2, pointer: P2, gapMm: number): PathGapPlan | null {
  const total = distance(a, b);
  const dx = (b[0] - a[0]) / total, dy = (b[1] - a[1]) / total;
  const travelled = dx * (pointer[0] - a[0]) + dy * (pointer[1] - a[1]);
  const lo = travelled - gapMm / 2, hi = travelled + gapMm / 2;
  if (!(0 < lo && lo < hi && hi < total)) return null;
  const pointAt = (length: number): P2 => [a[0] + dx * length, a[1] + dy * length];
  const cutA = storedPoint(pointAt(lo)), cutB = storedPoint(pointAt(hi));
  if (!separateStoredEnds(a, cutA, cutB, b)) return null;
  if (Math.abs(distance(cutA, cutB) - gapMm) > storedPathTolerance ||
      Math.abs(distance(a, cutA) - lo) > storedPathTolerance ||
      Math.abs(distance(cutB, b) - (total - hi)) > storedPathTolerance) return null;
  return { hit: pointAt(travelled), removed: [cutA, cutB], cutA, cutB, bulges: [0, 0] };
}

function retainedLength(source: Arc, a: P2, b: P2, bulge: number, expectedLength: number): number | null {
  if (Math.sign(bulge) !== Math.sign(source.sweep)) return null;
  const stored = arcOf(a, b, bulge), length = stored.radius * Math.abs(stored.sweep);
  if (!(distance(stored.center, source.center) <= storedPathTolerance) ||
      !(Math.abs(stored.radius - source.radius) <= storedPathTolerance) ||
      !(Math.abs(length - expectedLength) <= storedPathTolerance)) return null;
  return length;
}

export function planPathGap(source: PreparedPathGap, pointer: P2, gapMm: number): PathGapPlan | null {
  if (!Number.isFinite(gapMm) || gapMm <= openJoinTolerance) return null;
  const { arc } = source;
  const [a, b] = source.shape.points;
  if (!arc) return planLineGap(a, b, pointer, gapMm);
  const { center, radius, start, sweep } = arc;
  const dx = pointer[0] - center[0], dy = pointer[1] - center[1];
  const pointerRadius = Math.hypot(dx, dy);
  if (!Number.isFinite(pointerRadius) || pointerRadius <= radius / 2) return null;

  const direction = Math.sign(sweep), total = Math.abs(sweep);
  const offset = direction * (Math.atan2(dy, dx) - start);
  const travelled = offset < 0 ? offset + fullTurn : offset;
  const halfGap = gapMm / (2 * radius), lo = travelled - halfGap, hi = travelled + halfGap;
  if (!(0 < lo && lo < hi && hi < total)) return null;

  const pointAt = (travel: number): P2 => {
    const angle = start + direction * travel;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  };
  const cutA = storedPoint(pointAt(lo)), cutB = storedPoint(pointAt(hi));
  if (!separateStoredEnds(a, cutA, cutB, b)) return null;

  const storedBulge = (travel: number) => Math.round(Math.tan(direction * travel / 4) * 1e9) / 1e9;
  const bulges: [number, number] = [storedBulge(lo), storedBulge(total - hi)];
  const head = retainedLength(arc, a, cutA, bulges[0], radius * lo);
  const tail = retainedLength(arc, cutB, b, bulges[1], radius * (total - hi));
  if (head === null || tail === null || Math.abs(head + tail + gapMm - radius * total) > storedPathTolerance) return null;

  const segments = Math.max(2, Math.ceil((hi - lo) / (Math.PI / 24)));
  const removed = [cutA, ...Array.from({ length: segments - 1 }, (_, i) => pointAt(lo + (hi - lo) * (i + 1) / segments)), cutB];
  return { hit: pointAt(travelled), removed, cutA, cutB, bulges };
}
