import { CadNumericPolicy } from '@barocss/cad';
import { nearestSnap, type SnapPoint } from '@barocss/cad-model/sketch/osnap';
import { arcOf, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape } from '@barocss/cad-model/sketch/types';

const turn = 2 * Math.PI;
const quarterTurn = Math.PI / 2;
const inRange = (point: P2) => point.every(value => Number.isFinite(value) && Math.abs(value) <= CadNumericPolicy.coordinateAbs);

export interface ArcExtension {
  center: P2;
  radius: number;
  end: P2;
  direction: number;
  radial: P2;
  remaining: number;
  angleTolerance: number;
  limit: number;
}

export function prepareArcExtension(source: SketchShape): ArcExtension | null {
  if (source.kind !== 'polygon' || !source.construction || source.closed || source.pending || source.points.length !== 2 ||
      source.fromSpline || source.spline || source.fromEllipse || source.ellipse) return null;
  const [a, end] = source.points, bulge = source.bulges?.[0] ?? 0;
  const { coordinateAbs, linearTolerance } = CadNumericPolicy;
  if (!bulge || !Number.isFinite(bulge) || !inRange(a) || !inRange(end) ||
      Math.hypot(end[0] - a[0], end[1] - a[1]) <= linearTolerance) return null;
  const { center, radius, sweep } = arcOf(a, end, bulge);
  const dx = end[0] - center[0], dy = end[1] - center[1], length = Math.hypot(dx, dy);
  if (!inRange(center) || !Number.isFinite(radius) || radius <= linearTolerance || radius > coordinateAbs ||
      Math.abs(length - radius) > linearTolerance) return null;
  if (center.some(coordinate => Math.abs(coordinate) + radius > coordinateAbs)) return null;
  const size = Math.abs(bulge);
  const remaining = size > 1 ? 4 * Math.atan(1 / size) : turn - Math.abs(sweep);
  const angleTolerance = Math.max(32 * Number.EPSILON, linearTolerance / radius);
  const limit = Math.min(quarterTurn, remaining - 2 * angleTolerance);
  if (limit <= angleTolerance) return null;
  return { center, radius, end, direction: Math.sign(bulge), radial: [dx / length, dy / length], remaining, angleTolerance, limit };
}

export function arcExtensionPoint(arc: ArcExtension, point: P2): P2 | null {
  const [cx, cy] = arc.center, [ex, ey] = arc.radial;
  const dx = point[0] - cx, dy = point[1] - cy, distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance <= arc.radius / 2) return null;
  const x = dx / distance, y = dy / distance;
  const angle = arc.direction * Math.atan2(ex * y - ey * x, ex * x + ey * y);
  const afterEnd = angle < 0 ? angle + turn : angle;
  if (afterEnd <= arc.angleTolerance || afterEnd > arc.limit || afterEnd >= arc.remaining - arc.angleTolerance) return null;
  const candidate: P2 = [cx + x * arc.radius, cy + y * arc.radius];
  return inRange(candidate) ? candidate : null;
}

export function arcExtensionGuide(arc: ArcExtension): P2[] {
  const start = Math.atan2(arc.radial[1], arc.radial[0]);
  const [cx, cy] = arc.center;
  return Array.from({ length: 13 }, (_, index): P2 => {
    if (!index) return arc.end;
    const angle = start + arc.direction * arc.limit * index / 12;
    return [cx + arc.radius * Math.cos(angle), cy + arc.radius * Math.sin(angle)];
  });
}

export function uniqueArcTerminal(end: P2, winner: SnapPoint | null, points: SnapPoint[], project: (point: P2) => P2, pointer: P2): boolean {
  if (winner?.kind !== 'end' || winner.at !== end) return false;
  const projected = project(end);
  const reach = Math.hypot(projected[0] - pointer[0], projected[1] - pointer[1]) + 1e-7;
  return !nearestSnap(points.filter(point => point !== winner), project, pointer, reach);
}
