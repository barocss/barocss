import { CadNumericPolicy } from '@barocss/cad';
import { arcOf, type Arc, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

type Polygon = Extract<SketchShape, { kind: 'polygon' }> & { ids: [string, string] };
type Circle = Extract<SketchShape, { kind: 'circle' }> & { ids: [string] };

export type PreparedPathGap =
  | { kind: 'line'; shape: Polygon; arc: null }
  | { kind: 'arc'; shape: Polygon; arc: Arc }
  | { kind: 'circle'; shape: Circle };

export type PathGapPlan = {
  hit: P2;
  removed: P2[];
  cutA: P2;
  cutB: P2;
} & ({ kind: 'segment'; bulges: [number, number] } | { kind: 'circle'; bulges: [number] });

const fullTurn = 2 * Math.PI;
// Finish calls joinOpen with this distance. A stored gap must survive that join.
const openJoinTolerance = 1e-4;
const storedPathTolerance = 1e-5;

const inRange = (point: P2) => point.every(value => Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs);
const distance = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const storedPoint = ([x, y]: P2): P2 => [Math.round(x * 1e6) / 1e6 || 0, Math.round(y * 1e6) / 1e6 || 0];

function boundedCircle(center: P2, radius: number): boolean {
  const { coordinateAbs, linearTolerance } = CadNumericPolicy;
  return inRange(center) && Number.isFinite(radius) && radius > linearTolerance &&
    center.every(value => Math.abs(value) + radius <= coordinateAbs);
}

export function preparePathGap(shape: SketchShape, ordinaryDraftLine = false): PreparedPathGap | null {
  const straightDraft = ordinaryDraftLine && shape.kind === 'polygon' && (shape.bulges?.[0] ?? 0) === 0;
  if (!shape.construction && !straightDraft) return null;
  if (shape.kind === 'circle') {
    if (shape.ids?.length !== 1 || typeof shape.ids[0] !== 'string' || !shape.ids[0] || !boundedCircle(shape.c, shape.r)) return null;
    return { kind: 'circle', shape: shape as Circle };
  }
  if (shape.kind !== 'polygon' || shape.closed || shape.pending || shape.points.length !== 2) return null;
  const { ids } = shape;
  if (ids?.length !== 2 || typeof ids[0] !== 'string' || typeof ids[1] !== 'string' || !ids[0] || !ids[1] || ids[0] === ids[1]) return null;
  if (shape.fromRectangle || shape.fromSpline || shape.spline || shape.fromEllipse || shape.ellipse) return null;
  if (Object.keys(shape.lengths ?? {}).length || Object.keys(shape.radii ?? {}).length || shape.tangents?.length ||
      shape.equalRadii?.length || shape.concentric?.length || shape.hv?.h?.length || shape.hv?.v?.length ||
      shape.rules?.length || shape.circles?.length || shape.circleIds?.length) return null;

  const [a, b] = shape.points, bulge = shape.bulges?.[0] ?? 0;
  const { linearTolerance } = CadNumericPolicy;
  if (!Number.isFinite(bulge) || !inRange(a) || !inRange(b) || distance(a, b) <= linearTolerance) return null;
  const identified = shape as Polygon;
  if (bulge === 0) return { kind: 'line', shape: identified, arc: null };
  const arc = arcOf(a, b, bulge);
  if (!boundedCircle(arc.center, arc.radius) ||
      Math.abs(distance(b, arc.center) - arc.radius) > linearTolerance || Math.abs(arc.sweep) >= fullTurn) return null;
  return { kind: 'arc', shape: identified, arc };
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
  return { kind: 'segment', hit: pointAt(travelled), removed: [cutA, cutB], cutA, cutB, bulges: [0, 0] };
}

function retainedLength(source: Pick<Arc, 'center' | 'radius' | 'sweep'>, a: P2, b: P2, bulge: number, expectedLength: number): number | null {
  if (Math.sign(bulge) !== Math.sign(source.sweep)) return null;
  const stored = arcOf(a, b, bulge), length = stored.radius * Math.abs(stored.sweep);
  if (!(distance(stored.center, source.center) <= storedPathTolerance) ||
      !(Math.abs(stored.radius - source.radius) <= storedPathTolerance) ||
      !(Math.abs(length - expectedLength) <= storedPathTolerance)) return null;
  return length;
}

function sampleRemovedArc(pointAt: (angle: number) => P2, lo: number, hi: number, cutA: P2, cutB: P2): P2[] {
  const segments = Math.max(2, Math.ceil((hi - lo) / (Math.PI / 24)));
  return [cutA, ...Array.from({ length: segments - 1 }, (_, i) => pointAt(lo + (hi - lo) * (i + 1) / segments)), cutB];
}

function planCircleGap(shape: Circle, pointer: P2, gapMm: number): PathGapPlan | null {
  const { c: center, r: radius } = shape;
  const dx = pointer[0] - center[0], dy = pointer[1] - center[1];
  const pointerRadius = Math.hypot(dx, dy);
  if (!Number.isFinite(pointerRadius) || pointerRadius <= radius / 2) return null;

  const gapSweep = gapMm / radius, remaining = fullTurn - gapSweep;
  if (!(remaining > 0)) return null;
  const angle = Math.atan2(dy, dx), lo = angle - gapSweep / 2, hi = angle + gapSweep / 2;
  const pointAt = (theta: number): P2 => [center[0] + radius * Math.cos(theta), center[1] + radius * Math.sin(theta)];
  const cutA = storedPoint(pointAt(lo)), cutB = storedPoint(pointAt(hi));
  if (!inRange(cutA) || !inRange(cutB) || distance(cutA, cutB) <= openJoinTolerance) return null;

  // A circle is CCW. Its remainder starts after the cut and runs back to the first cut end.
  const bulge = Math.round(Math.tan(remaining / 4) * 1e9) / 1e9;
  if (retainedLength({ center, radius, sweep: fullTurn }, cutB, cutA, bulge, radius * remaining) === null) return null;
  return { kind: 'circle', hit: pointAt(angle), removed: sampleRemovedArc(pointAt, lo, hi, cutA, cutB), cutA, cutB, bulges: [bulge] };
}

export function planPathGap(source: PreparedPathGap, pointer: P2, gapMm: number): PathGapPlan | null {
  if (!Number.isFinite(gapMm) || gapMm <= openJoinTolerance) return null;
  if (source.kind === 'circle') return planCircleGap(source.shape, pointer, gapMm);
  const [a, b] = source.shape.points;
  if (source.kind === 'line') return planLineGap(a, b, pointer, gapMm);
  const { arc } = source;
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

  return { kind: 'segment', hit: pointAt(travelled), removed: sampleRemovedArc(pointAt, lo, hi, cutA, cutB), cutA, cutB, bulges };
}
