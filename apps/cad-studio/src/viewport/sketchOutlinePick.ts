import { cornersOf } from '@barocss/cad-model/sketch/entityIds';
import { isSettled, type SketchPick } from '@barocss/cad-model/sketch/rules';
import { pickSketch, type Project } from '@barocss/cad-model/sketch/select';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { canActivateDraftOutline } from '../app/sketchControls';

type ClosedOutline = Extract<SketchShape, { kind: 'rectangle' | 'polygon' }>;
export type ParkedOutlinePoint = { kind: 'parked-outline-point'; outline: ClosedOutline; point: [number, number] };
export type SketchViewportPick = SketchPick | ParkedOutlinePoint;

/** Prefer existing sketch picks. If they miss, check the vertices of other closed outlines. */
export function pickSketchViewport(sketch: SketchState, shape: SketchShape | null, project: Project, x: number, y: number): SketchViewportPick | null {
  const active = isSettled(shape) ? pickSketch(shape, project, x, y, sketch.done) : null;
  if (active) return active;
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
