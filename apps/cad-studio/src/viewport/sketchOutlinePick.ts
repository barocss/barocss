import { cornersOf } from '@barocss/cad-model/sketch/entityIds';
import { segmentDistance } from '@barocss/cad-model/engine/geom2';
import { isSettled, type SketchPick } from '@barocss/cad-model/sketch/rules';
import { pickSketch, type Project } from '@barocss/cad-model/sketch/select';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { canActivateDraftOutline } from '../app/sketchControls';

type ClosedOutline = Extract<SketchShape, { kind: 'rectangle' | 'polygon' }>;
type Circle = Extract<SketchShape, { kind: 'circle' }>;
export type ParkedOutlinePoint = { kind: 'parked-outline-point'; outline: ClosedOutline; point: [number, number] };
export type SketchViewportPick = SketchPick | ParkedOutlinePoint | { kind: 'active-circle'; outline: Circle };

/** Project the same ring used by the overlay. */
export function projectSketchCircle(circle: Circle, project: Project): [number, number][] {
  const { c: [x, y], r } = circle;
  return Array.from({ length: 72 }, (_, i) => {
    const [px, py] = project(x + r * Math.cos(i * Math.PI / 36), y + r * Math.sin(i * Math.PI / 36));
    return [px, py];
  });
}

function hitsCircleRim(circle: Circle, project: Project, x: number, y: number): boolean {
  if (!(circle.r > 0)) return false;
  const ring = projectSketchCircle(circle, project), at = [x, y];
  return ring.some((p, i) => segmentDistance(at, p, ring[(i + 1) % ring.length]) <= 7);
}

/** Prefer existing sketch picks. If they miss, check the vertices of other closed outlines. */
export function pickSketchViewport(sketch: SketchState, shape: SketchShape | null, project: Project, x: number, y: number): SketchViewportPick | null {
  const active = isSettled(shape) ? pickSketch(shape, project, x, y, sketch.done) : null;
  if (active) return active;
  if (sketch.tool === 'dimension' && shape?.kind === 'circle' && hitsCircleRim(shape, project, x, y)) {
    return { kind: 'active-circle', outline: shape };
  }
  let best: ParkedOutlinePoint | null = null;
  let distance = 9;
  for (const outline of sketch.done ?? []) {
    if (!canActivateDraftOutline(outline)) continue;
    for (const point of cornersOf(outline) ?? []) {
      const [px, py] = project(...point);
      const gap = Math.hypot(px - x, py - y);
      if (gap <= distance) {
        distance = gap;
        best = { kind: 'parked-outline-point', outline, point };
      }
    }
  }
  return best;
}
