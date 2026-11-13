import { cornersOf } from '@barocss/cad-model/sketch/entityIds';
import { segmentDistance } from '@barocss/cad-model/engine/geom2';
import { isSettled, type Polygon, type SketchPick } from '@barocss/cad-model/sketch/rules';
import { pickSketch, type Project } from '@barocss/cad-model/sketch/select';
import { arcOf, sampleSegment, type P2 } from '@barocss/cad-model/sketch/profile';
import type { SketchShape, SketchState } from '@barocss/cad-model/sketch/types';
import { canActivateDraftOutline } from '../app/sketchControls';
import type { OrbitCamera } from './camera';

type ClosedOutline = Extract<SketchShape, { kind: 'rectangle' | 'polygon' }>;
type Circle = Extract<SketchShape, { kind: 'circle' }>;
export type ParkedOutlinePoint = { kind: 'parked-outline-point'; outline: ClosedOutline; point: [number, number] };
export type SketchViewportPick = SketchPick | ParkedOutlinePoint | { kind: 'active-circle'; outline: Circle };

const ARC_TOLERANCE_CSS = 0.25;
const ARC_MAX_SEGMENTS = 512;

/** Bound the radius of the orthographic projection for any oriented unit sketch plane. */
export function orthographicSketchScale(camera: OrbitCamera, width: number, height: number): number | undefined {
  if (!camera.ortho || width <= 0 || height <= 0) return undefined;
  const matrix = camera.projection();
  return Math.max(width * Math.abs(matrix[0]), height * Math.abs(matrix[5])) / 2;
}

/** One path for the active outline and its marks and hits. Keep the authored endpoints. */
export function projectSketchEdge(shape: Pick<Polygon, 'points' | 'bulges'>, index: number,
  project: Project, orthographicScale?: number): P2[] {
  const a = shape.points[index], b = shape.points[(index + 1) % shape.points.length];
  const bulge = shape.bulges?.[index] ?? 0;
  const point = ([x, y]: P2): P2 => {
    const p = project(x, y);
    return [p[0], p[1]];
  };
  if (!bulge || (a[0] === b[0] && a[1] === b[1])) return [point(a), point(b)];
  if (orthographicScale === undefined || !Number.isFinite(orthographicScale)) {
    return [a, ...sampleSegment(a, b, bulge, 16).slice(1), b].map(point);
  }
  const { center, radius, sweep, start } = arcOf(a, b, bulge);
  const screenRadius = radius * orthographicScale;
  // Sagitta r * (1 - cos(step/2)) = 2r * sin²(step/4). The budget bounds work at extreme zoom.
  const step = Math.min(Math.PI / 2, 4 * Math.asin(Math.sqrt(Math.min(1, ARC_TOLERANCE_CSS / (2 * screenRadius)))));
  const steps = Math.min(ARC_MAX_SEGMENTS, Math.max(2, Math.ceil(Math.abs(sweep) / step)));
  const middle = Array.from({ length: steps - 1 }, (_, j) => {
    const angle = start + sweep * (j + 1) / steps;
    return point([center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)]);
  });
  return [point(a), ...middle, point(b)];
}

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
export function pickSketchViewport(sketch: SketchState, shape: SketchShape | null, project: Project, x: number, y: number, scale?: number): SketchViewportPick | null {
  const active = isSettled(shape) ? pickSketch(shape, project, x, y, sketch.done, undefined, undefined, index => projectSketchEdge(shape, index, project, scale)) : null;
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
